import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
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

// The signed browser token is a fairness measure alongside persistent contact
// limits. Never trust arbitrary forwarded IP headers as a rate identity.
function rateIdentity(request: Request, secret: string) {
  const name = "als_registration_browser", lifetime = 30 * 24 * 60 * 60, now = Math.floor(Date.now() / 1000);
  const sign = (s: string) => createHmac("sha256", secret).update(`als-registration-browser:${s}`).digest("hex");
  const supplied = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
  let nonce: string | undefined, token = supplied;
  if (supplied && supplied.length < 200) {
    const [version, id, expiration, signature, extra] = supplied.split(".");
    if (!extra && version === "v1" && /^[a-f0-9]{64}$/.test(id || "") && /^\d{10}$/.test(expiration || "") && /^[a-f0-9]{64}$/.test(signature || "")) {
      const expires = Number(expiration), expected = sign(`${version}.${id}.${expiration}`);
      if (expires > now && expires <= now + lifetime && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) nonce = id;
    }
  }
  const fresh = !nonce;
  if (!nonce) {
    nonce = randomBytes(32).toString("hex");
    const payload = `v1.${nonce}.${now + lifetime}`;
    token = `${payload}.${sign(payload)}`;
  }
  const header = process.env.ENQUIRY_TRUSTED_IP_HEADER;
  const candidate = header && ["cf-connecting-ip", "x-real-ip"].includes(header) ? request.headers.get(header)?.trim() : undefined;
  const origin = candidate && isIP(candidate) ? `network:${candidate}` : `browser:${nonce}`;
  return {
    hash: createHmac("sha256", secret).update(`als-registration-rate:${origin}`).digest("hex"),
    cookie: fresh ? `${name}=${token}; Max-Age=${lifetime}; Path=/api/registrations; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` : null,
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > limit) return NextResponse.json({ error: "Application is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = await readBody(request); }
  catch (error) { return NextResponse.json({ error: error instanceof RangeError ? "Application is too large." : "Invalid application." }, { status: error instanceof RangeError ? 413 : 400 }); }
  if (body.website) return NextResponse.json({ error: "Your application could not be accepted." }, { status: 400 });
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
      p_notes: value.notes, p_request_id: value.requestId, p_ip_hash: identity.hash,
      p_phone_hash: hash("phone", value.phone), p_email_hash: hash("email", value.email),
    });
    if (result.error) {
      if (result.error.message.includes("rate_limit")) return respond({ error: "Too many applications. Please wait an hour and try again." }, 429, { "Retry-After": "3600" });
      if (result.error.message.includes("invalid_program")) return respond({ error: "That program is no longer available.", errors: { programId: "Choose an available program." } }, 400);
      if (result.error.message.includes("invalid_batch")) return respond({ error: "That batch is no longer available.", errors: { preferredBatchId: "Choose another batch or leave it blank." } }, 400);
      return respond({ error: "Your application could not be saved. Please try again shortly." }, 503);
    }
    return respond({ success: true }, 200);
  } catch { return NextResponse.json({ error: "Your application could not be saved. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
