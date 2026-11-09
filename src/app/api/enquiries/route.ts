import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { enquiryService, getPublicEnquiryPrograms } from "@/lib/enquiries-server";
import { validateEnquiry } from "@/lib/enquiries-validation";
import { isSameOriginRequest } from "@/lib/request-origin";
import { enquiryRateIdentity } from "@/lib/enquiries-rate-limit";
export const runtime = "nodejs";
async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing form");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 12000) { await reader.cancel(); throw new RangeError("Form is too large"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
export async function GET() {
  try { return NextResponse.json({ programs: await getPublicEnquiryPrograms() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Course information is currently unavailable. Please try again shortly." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 12000) return NextResponse.json({ error: "Form is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = await boundedBody(request); if (!body || typeof body !== "object" || Array.isArray(body)) throw Error(); }
  catch (error) { return NextResponse.json({ error: error instanceof RangeError ? "Form is too large." : "Invalid enquiry form." }, { status: error instanceof RangeError ? 413 : 400 }); }
  if (body.website) return NextResponse.json({ error: "Your enquiry could not be accepted. Please try again." }, { status: 400 });
  const { errors, value } = validateEnquiry(body);
  if (Object.keys(errors).length) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
  try {
    const secret = process.env.ENQUIRY_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw Error();
    const identity = enquiryRateIdentity(request, secret);
    const response = (value: unknown, status: number, extraHeaders: Record<string, string> = {}) => NextResponse.json(value, {
      status, headers: { "Cache-Control": "no-store", ...extraHeaders, ...(identity.cookie ? { "Set-Cookie": identity.cookie } : {}) },
    });
    const digest = (v: string) => createHmac("sha256", secret).update(v).digest("hex");
    const result = await enquiryService().rpc("submit_admission_enquiry", {
      p_full_name: value.fullName, p_phone: value.phone, p_email: value.email,
      p_program_id: value.programId, p_message: value.message,
      p_request_id: value.idempotencyKey, p_ip_hash: identity.originHash, p_phone_hash: digest(value.phone),
    });
    if (result.error) {
      if (result.error.message.includes("rate_limit")) return response({ error: "Too many enquiries. Please wait an hour and try again." }, 429, { "Retry-After": "3600" });
      if (result.error.message.includes("invalid_program")) return response({ error: "That course is no longer available. Please choose another.", errors: { programId: "Choose an available course." } }, 400);
      return response({ error: "Your enquiry could not be saved. Please try again shortly." }, 503);
    }
    return response({ success: true }, result.data?.duplicate ? 200 : 201);
  } catch { return NextResponse.json({ error: "Your enquiry could not be saved. Please try again shortly." }, { status: 503 }); }
}
