import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { enquiryService } from "@/lib/enquiries-server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateIdentity } from "../rate-identity";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > 256) return NextResponse.json({ error: "Invalid link." }, { status: 400, headers });
  let token: unknown;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const decoder = new TextDecoder("utf-8", { fatal: true }); let size = 0, text = "";
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 256) { await reader.cancel(); throw new Error(); } text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { reader.releaseLock(); }
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1) throw new Error();
    token = body.token;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error();
  } catch { return NextResponse.json({ error: "Invalid link." }, { status: 400, headers }); }
  try {
    const secret = process.env.REGISTRATION_RATE_LIMIT_SECRET || process.env.ENQUIRY_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error();
    const identity = rateIdentity(request, secret);
    const result = await enquiryService().rpc("get_registration_link", { p_token_hash: createHash("sha256").update(token as string).digest("hex"), p_ip_hash: identity.hash });
    const responseHeaders = { ...headers, ...(identity.cookie ? { "Set-Cookie": identity.cookie } : {}) };
    if (result.error) return NextResponse.json({ error: "Link details could not be loaded. Please try again." }, { status: 503, headers: responseHeaders });
    if (!result.data) return NextResponse.json({ error: "This link is invalid, expired or already used. Please contact admissions." }, { status: 404, headers: responseHeaders });
    const data = result.data;
    return NextResponse.json({ fullName: data.full_name, email: data.email, phone: data.phone, programId: data.program_id }, { headers: responseHeaders });
  } catch { return NextResponse.json({ error: "Link details could not be loaded. Please try again." }, { status: 503, headers }); }
}
