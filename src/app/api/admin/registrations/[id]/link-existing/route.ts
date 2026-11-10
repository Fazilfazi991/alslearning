import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { validAccountId } from "@/lib/account-validation";
import { isSameOriginRequest } from "@/lib/request-origin";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params;
    if (!validAccountId(id)) return NextResponse.json({ error: "Application not found." }, { status: 404, headers });
    const result = await session.db!.rpc("registration_existing_student_ready", { p_registration_id: id });
    if (result.error) throw new Error();
    return NextResponse.json({ ready: result.data === true }, { headers });
  } catch { return NextResponse.json({ error: "Existing account verification is unavailable." }, { status: 503, headers }); }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403, headers });
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params;
    if (!validAccountId(id)) return NextResponse.json({ error: "Application not found." }, { status: 404, headers });
    if (Number(request.headers.get("content-length")) > 1024) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    let body: unknown;
    try {
      const reader = request.body?.getReader(); if (!reader) throw new Error();
      let size = 0, text = ""; const decoder = new TextDecoder("utf-8", { fatal: true });
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024) { await reader.cancel(); throw new Error(); } text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
      finally { reader.releaseLock(); }
      body = JSON.parse(text);
    } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !validAccountId((body as Record<string, unknown>).batch_id)) return NextResponse.json({ error: "Choose a compatible batch." }, { status: 400, headers });
    // This RPC revalidates proof, identity, application, capacity and enrollment
    // under database locks and preserves the existing student code and history.
    const result = await session.db!.rpc("approve_existing_registration", { p_registration_id: id, p_batch_id: (body as { batch_id: string }).batch_id });
    if (result.error || !result.data || result.data.linked_existing !== true || !validAccountId(result.data.student_id)) return NextResponse.json({ error: "Approval could not be completed. Refresh and review the application, verified account and batch." }, { status: 409, headers });
    return NextResponse.json({ success: true, student_id: result.data.student_id, linked_existing: true }, { headers });
  } catch { return NextResponse.json({ error: "Approval could not be completed. Please retry." }, { status: 503, headers }); }
}
