import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { validAccountId } from "@/lib/account-validation";
import { isSameOriginRequest } from "@/lib/request-origin";
import { registrationBatchOccupancy } from "@/lib/registration-batch-occupancy";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params;
    if (!validAccountId(id)) return NextResponse.json({ error: "Application not found." }, { status: 404, headers });
    const db = session.db!;
    const [application, events, programs] = await Promise.all([
      db.from("student_registrations").select("*,programs(id,name,status)").eq("id", id).maybeSingle(),
      db.from("student_registration_events").select("id,kind,details,created_at,actor_id").eq("registration_id", id).order("created_at", { ascending: false }),
      db.from("programs").select("id,name,status").order("name"),
    ]);
    if ([application, events, programs].some(result => result.error)) throw Error();
    if (!application.data) return NextResponse.json({ error: "Application not found." }, { status: 404, headers });
    const [batchRows, identity] = await Promise.all([
      db.from("batches").select("id,name,program_id,status,batch_code,max_students,registration_default").eq("program_id", application.data.program_id).order("name"),
      db.from("profiles").select("id").eq("email", application.data.email).limit(1),
    ]);
    if (batchRows.error || identity.error) throw Error();
    const occupancy = await registrationBatchOccupancy(db, (batchRows.data || []).map(batch => batch.id));
    const batches = (batchRows.data || []).map(batch => ({ ...batch, reserved_seats: occupancy.get(batch.id)! }));
    return NextResponse.json({ application: application.data, events: events.data, programs: programs.data, batches, identity_conflict: Boolean(identity.data?.length) }, { headers });
  } catch { return NextResponse.json({ error: "Application could not be loaded. Please retry." }, { status: 503, headers }); }
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403, headers });
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params;
    if (!validAccountId(id)) return NextResponse.json({ error: "Application not found." }, { status: 404, headers });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid changes." }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid changes." }, { status: 400, headers });
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some(key => !["action", "changes"].includes(key)) || !["edit", "needs_information", "rejected"].includes(String(value.action)) || !value.changes || typeof value.changes !== "object" || Array.isArray(value.changes)) return NextResponse.json({ error: "Invalid review action." }, { status: 400, headers });
    const changes = value.changes as Record<string, unknown>;
    const allowed = value.action === "edit" ? ["full_name", "email", "phone", "qualification", "institution", "program_id", "preferred_batch_id", "notes"] : ["reason"];
    if (!Object.keys(changes).length || Object.keys(changes).some(key => !allowed.includes(key)) || Object.values(changes).some(v => v !== null && (typeof v !== "string" || v.length > 2000))) return NextResponse.json({ error: "Invalid review details." }, { status: 400, headers });
    const result = await session.db!.rpc("review_student_registration", { p_id: id, p_action: value.action, p_changes: changes });
    if (result.error) return NextResponse.json({ error: "Review could not be saved. Refresh and check the application status and details." }, { status: 409, headers });
    return NextResponse.json({ success: true }, { headers });
  } catch { return NextResponse.json({ error: "Review could not be saved. Please retry." }, { status: 503, headers }); }
}
