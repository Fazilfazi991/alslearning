import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enquiryService } from "@/lib/enquiries-server";
import { validAccountId } from "@/lib/account-validation";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

// A proof associates an existing *authenticated* student with their pending
// application. It does not approve or enroll them. The request ID is a random
// capability retained only in the applicant's tab; no identity is taken from
// the request body, and the database rechecks Auth, profile and application.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > 1024) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  let value: unknown;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    let size = 0, text = ""; const decoder = new TextDecoder("utf-8", { fatal: true });
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024) { await reader.cancel(); throw new Error(); } text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { reader.releaseLock(); }
    value = JSON.parse(text);
  } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers }); }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 || !validAccountId((value as Record<string, unknown>).requestId)) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  try {
    const db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Sign in to your existing ALS student account, then return to this tab." }, { status: 401, headers });
    const user = data.user;
    if (!user.email || !user.email_confirmed_at) return NextResponse.json({ error: "This account cannot be verified for the application. Contact admissions." }, { status: 403, headers });
    const profile = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (profile.error || profile.data?.role !== "student" || profile.data.is_active !== true) return NextResponse.json({ error: "This account cannot be verified for the application. Contact admissions." }, { status: 403, headers });
    const result = await enquiryService().rpc("record_registration_identity_proof", {
      p_request_id: (value as { requestId: string }).requestId,
      p_user_id: user.id,
      p_email: user.email.toLowerCase(),
    });
    if (result.error) return NextResponse.json({ error: "Account verification is temporarily unavailable. Please try again." }, { status: 503, headers });
    if (result.data !== true) return NextResponse.json({ error: "This account could not be matched to the application. Contact admissions." }, { status: 409, headers });
    return NextResponse.json({ success: true }, { headers });
  } catch { return NextResponse.json({ error: "Account verification is temporarily unavailable. Please try again." }, { status: 503, headers }); }
}
