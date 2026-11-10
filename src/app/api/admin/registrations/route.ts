import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import type { SupabaseClient } from "@supabase/supabase-js";

const statuses = ["pending", "ready_for_approval", "needs_information", "approved", "rejected"];
const headers = { "Cache-Control": "private, no-store" };
type Candidate = { id: string; full_name: string; email: string; phone: string; qualification: string; institution: string; program_id: string; status: string; consent_at: string | null; created_at: string; student_id: string | null; programs: { id: string; name: string; status: string } | null };
type Batch = { id: string; program_id: string; status: string; batch_code: string | null; max_students: number | null; registration_default: boolean };

// Readiness is a convenience filter, not permission to admit. A fresh database
// transaction must recheck Auth identity, batch capacity and application state.
async function readyApplications(db: SupabaseClient, q: string, page: number) {
  const found: Candidate[] = [];
  const availability = new Map<string, boolean>();
  const chunkSize = 100;
  // Bound work and fail closed instead of returning a silently incomplete count.
  const maximumCandidates = 3000;
  for (let offset = 0; offset <= maximumCandidates; offset += chunkSize) {
    let query = db.from("student_registrations").select("id,full_name,email,phone,qualification,institution,program_id,status,consent_at,created_at,student_id,programs(id,name,status)").eq("status", "pending");
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const result = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + chunkSize - 1);
    if (result.error || !result.data) throw Error("Readiness could not be evaluated");
    const candidates = (result.data || []) as unknown as Candidate[];
    if (offset === maximumCandidates && candidates.length) throw Error("Readiness scan exceeded the safe limit");
    const complete = candidates.filter(row => row.programs?.status === "active" && row.consent_at && row.full_name?.trim() && row.email?.trim() && row.phone?.trim() && row.qualification?.trim() && row.institution?.trim() && !row.student_id);
    const programIds = [...new Set(complete.map(row => row.program_id).filter(id => !availability.has(id)))];
    if (programIds.length) {
      const resultBatches = await db.from("batches").select("id,program_id,status,batch_code,max_students,registration_default").in("program_id", programIds).eq("registration_default", true);
      if (resultBatches.error || !resultBatches.data) throw Error("Batch readiness could not be evaluated");
      const batches = (resultBatches.data || []) as Batch[];
      await Promise.all(programIds.map(async programId => {
        const eligible = batches.filter(batch => batch.program_id === programId && batch.status === "active" && batch.batch_code);
        if (eligible.length !== 1) { availability.set(programId, false); return; }
        const batch = eligible[0];
        if (batch.max_students === null) { availability.set(programId, true); return; }
        const occupied = await db.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", batch.id).eq("status", "active");
        if (occupied.error || occupied.count === null) throw Error("Batch capacity could not be evaluated");
        availability.set(programId, occupied.count < batch.max_students);
      }));
    }
    // The admin profile query is deliberately exact and case-insensitive; it
    // cannot enumerate Auth-only identities, which approval must still check.
    const eligible = complete.filter(row => availability.get(row.program_id));
    const checked = await Promise.all(eligible.map(async row => {
      const email = row.email.replace(/[\\%_]/g, "\\$&");
      const profile = await db.from("profiles").select("id").ilike("email", email).limit(1);
      if (profile.error || !profile.data) throw Error("Identity readiness could not be evaluated");
      return profile.data?.length ? null : row;
    }));
    found.push(...checked.filter((row): row is Candidate => row !== null));
    if (candidates.length < chunkSize) break;
  }
  return { registrations: found.slice((page - 1) * 20, page * 20), count: found.length, page, page_size: 20, readiness_is_advisory: true };
}

export async function GET(request: Request) {
  try {
    const session = await adminSession();
    if (session.response) return session.response;
    const params = new URL(request.url).searchParams;
    const status = params.get("status") || "";
    if (status && !statuses.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400, headers });
    const rawPage = Number(params.get("page") || "1");
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
    const q = (params.get("q") || "").trim().slice(0, 120).replace(/[^\p{L}\p{N}@+ .-]/gu, "");
    if (status === "ready_for_approval") return NextResponse.json(await readyApplications(session.db!, q, page), { headers });
    let query = session.db!.from("student_registrations").select("id,full_name,email,phone,program_id,status,created_at,student_id,programs(id,name)", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const result = await query.order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
    if (result.error) throw Error();
    return NextResponse.json({ registrations: result.data, count: result.count ?? 0, page, page_size: 20 }, { headers });
  } catch { return NextResponse.json({ error: "Applications could not be loaded. Please retry." }, { status: 503, headers }); }
}
