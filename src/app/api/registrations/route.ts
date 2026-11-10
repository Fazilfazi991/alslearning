import { createHash, createHmac } from "node:crypto";
import { rateIdentity } from "./rate-identity";
import { NextResponse } from "next/server";
import { enquiryService } from "@/lib/enquiries-server";
import { validateRegistration } from "@/lib/registration-validation";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
const limit = 12000;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new RangeError(); }
      text += decoder.decode(part.value, { stream: true });
    }
    const body: unknown = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new SyntaxError();
    return body as Record<string, unknown>;
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > limit) return NextResponse.json({ error: "Application is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch (error) { return NextResponse.json({ error: error instanceof RangeError ? "Application is too large." : "Invalid application." }, { status: error instanceof RangeError ? 413 : 400 }); }
  if (body.website) return NextResponse.json({ error: "Your application could not be accepted." }, { status: 400 });
  const linkToken = body.linkToken;
  delete body.linkToken;
  if (linkToken != null && (typeof linkToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(linkToken))) return NextResponse.json({ error: "The registration link is invalid." }, { status: 400 });
  const { errors, value } = validateRegistration(body);
  if (!value) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
  try {
    const secret = process.env.REGISTRATION_RATE_LIMIT_SECRET || process.env.ENQUIRY_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("Registration unavailable");
    const identity = rateIdentity(request, secret);
    const respond = (payload: unknown, status: number, extra: Record<string, string> = {}) => NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store", ...extra, ...(identity.cookie ? { "Set-Cookie": identity.cookie } : {}) } });
    const hash = (kind: string, input: string) => createHmac("sha256", secret).update(`als-registration-${kind}:${input}`).digest("hex");
    const result = await enquiryService().rpc("submit_student_registration", {
      p_full_name: value.fullName, p_email: value.email, p_phone: value.phone,
      p_qualification: value.qualification, p_institution: value.institution,
      p_program_id: value.programId, p_preferred_batch_id: value.preferredBatchId,
      p_notes: value.notes, p_consent: value.consent, p_request_id: value.requestId, p_ip_hash: identity.hash,
      p_link_hash: typeof linkToken === "string" ? createHash("sha256").update(linkToken).digest("hex") : null,
      p_phone_hash: hash("phone", value.phone), p_email_hash: hash("email", value.email),
    });
    if (result.error) {
      if (result.error.message.includes("rate_limit")) return respond({ error: "Too many applications. Please wait an hour and try again." }, 429, { "Retry-After": "3600" });
      if (result.error.message.includes("invalid_program")) return respond({ error: "That program is no longer available.", errors: { programId: "Choose an available program." } }, 400);
      if (result.error.message.includes("invalid_batch")) return respond({ error: "That batch is no longer available.", errors: { preferredBatchId: "Choose another batch or leave it blank." } }, 400);
      if (result.error.message.includes("invalid_link")) return respond({ error: "This registration link has expired or has already been used. Contact admissions for a new link." }, 400);
      return respond({ error: "Your application could not be saved. Please try again shortly." }, 503);
    }
    return respond({ success: true }, 200);
  } catch { return NextResponse.json({ error: "Your application could not be saved. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

