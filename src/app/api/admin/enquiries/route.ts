import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { enquiryStatuses } from "@/types/enquiries";
import { validAccountId } from "@/lib/account-validation";
export async function GET(request: Request) {
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const db = session.db!, params = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1)) | 0, size = 20;
    const status = params.get("status"), program = params.get("program_id"), q = (params.get("q") || "").trim().slice(0, 120);
    if ((status && !enquiryStatuses.includes(status as typeof enquiryStatuses[number])) || (program && !validAccountId(program))) return NextResponse.json({ error: "Invalid filters." }, { status: 400 });
    const pending = params.get("pending") === "true";
    let query = db.from("admission_enquiries").select(pending ? "*,programs(id,name),enquiry_follow_ups!inner(id,completed_at)" : "*,programs(id,name)", { count: "exact" });
    if (pending) query = query.is("enquiry_follow_ups.completed_at", null).not("status", "in", "(converted,closed)");
    if (status) query = query.eq("status", status);
    if (program) query = query.eq("program_id", program);
    if (q) { const safe = q.replace(/[^\p{L}\p{N}@+ ._-]/gu, "").replace(/[%_]/g, ""); if (safe) query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`); }
    for (const key of ["from", "to"] as const) {
      const day = params.get(key);
      if (day) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) return NextResponse.json({ error: "Invalid date filter." }, { status: 400 });
        query = key === "from" ? query.gte("created_at", `${day}T00:00:00+04:00`) : query.lte("created_at", `${day}T23:59:59.999+04:00`);
      }
    }
    const [rows, programs, staff, ...counts] = await Promise.all([
      query.order("created_at", { ascending: params.get("sort") === "oldest" }).order("id").range((page - 1) * size, page * size - 1),
      db.from("programs").select("id,name").order("name"),
      db.from("profiles").select("id,full_name,email").eq("role", "admin").eq("is_active", true).order("full_name"),
      ...[null, "new", "interested", "follow_up", "converted"].map(s => {
        if (s === "follow_up") return db.from("enquiry_follow_ups").select("id,admission_enquiries!inner(status)", { count: "exact", head: true }).is("completed_at", null).not("admission_enquiries.status", "in", "(converted,closed)");
        const count = db.from("admission_enquiries").select("id", { count: "exact", head: true }); return s ? count.eq("status", s) : count;
      }),
    ]);
    if ([rows, programs, staff, ...counts].some(r => r.error)) throw Error();
    const [total, fresh, interested, follow_up, converted] = counts.map(r => r.count ?? 0);
    return NextResponse.json({ enquiries: rows.data, count: rows.count, page, page_size: size, programs: programs.data, staff: staff.data, stats: { total, new: fresh, interested, follow_up, converted } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Enquiries could not be loaded. Please retry." }, { status: 503 }); }
}
