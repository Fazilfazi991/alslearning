import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { validAccountId } from "@/lib/account-validation";
import { enquiryStatuses } from "@/types/enquiries";
import { isSameOriginRequest } from "@/lib/request-origin";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params; if (!validAccountId(id)) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    const db = session.db!;
    const [enquiry, activities, followUps, staff, programs] = await Promise.all([
      db.from("admission_enquiries").select("*,programs(id,name)").eq("id", id).maybeSingle(),
      db.from("enquiry_activities").select("*").eq("enquiry_id", id).order("created_at", { ascending: false }),
      db.from("enquiry_follow_ups").select("*").eq("enquiry_id", id).order("due_at"),
      db.from("profiles").select("id,full_name,email").eq("role", "admin").eq("is_active", true).order("full_name"),
      db.from("programs").select("id,name").order("name"),
    ]);
    if ([enquiry, activities, followUps, staff, programs].some(r => r.error)) throw Error();
    if (!enquiry.data) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    return NextResponse.json({ enquiry: enquiry.data, activities: activities.data, follow_ups: followUps.data, staff: staff.data, programs: programs.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Enquiry could not be loaded. Please retry." }, { status: 503 }); }
}
export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params; if (!validAccountId(id)) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid enquiry changes." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["status", "assigned_to", "notes"].includes(key))) return NextResponse.json({ error: "Invalid enquiry changes." }, { status: 400 });
    if (!Object.keys(body).length) return NextResponse.json({ error: "No enquiry changes supplied." }, { status: 400 });
    if (body.status !== undefined && (!enquiryStatuses.includes(body.status) || body.status === "converted")) return NextResponse.json({ error: "Use Student admission to convert an enquiry." }, { status: 400 });
    if (body.assigned_to !== undefined && body.assigned_to !== null && !validAccountId(body.assigned_to)) return NextResponse.json({ error: "Choose an active administrator." }, { status: 400 });
    if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 4000)) return NextResponse.json({ error: "Use up to 4,000 characters." }, { status: 400 });
    const result = await session.db!.rpc("update_admission_enquiry", { p_id: id, p_changes: body });
    if (result.error) return NextResponse.json({ error: "Changes could not be saved. The enquiry may have been converted. Refresh and retry." }, { status: 409 });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Changes could not be saved. Please retry." }, { status: 503 }); }
}
