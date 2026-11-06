import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { validAccountId } from "@/lib/account-validation";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params, body = await request.json();
    if (!validAccountId(id) || !body || typeof body !== "object" || Array.isArray(body) || !["note", "contact", "follow_up"].includes(body.kind) || typeof body.note !== "string" || !body.note.trim() || body.note.length > 4000) return NextResponse.json({ error: "Choose an activity and enter a note (up to 4,000 characters)." }, { status: 400 });
    if (body.due_at && (!Number.isFinite(Date.parse(body.due_at)) || body.kind !== "follow_up")) return NextResponse.json({ error: "Choose a valid follow-up date." }, { status: 400 });
    if (body.kind === "follow_up" && !body.follow_up_id && !body.due_at) return NextResponse.json({ error: "Choose a follow-up date." }, { status: 400 });
    if (body.follow_up_id && (!validAccountId(body.follow_up_id) || typeof body.outcome !== "string" || !body.outcome.trim() || body.outcome.length > 4000)) return NextResponse.json({ error: "Enter the follow-up outcome." }, { status: 400 });
    const result = await session.db!.rpc("record_enquiry_activity", { p_id: id, p_activity: body });
    if (result.error) return NextResponse.json({ error: "Activity could not be saved. Refresh the enquiry and retry." }, { status: 409 });
    return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Activity could not be saved. Please retry." }, { status: 503 }); }
}
