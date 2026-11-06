import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { enquiryService, getPublicEnquiryPrograms } from "@/lib/enquiries-server";
import { validateEnquiry } from "@/lib/enquiries-validation";
import { isSameOriginRequest } from "@/lib/request-origin";
export const runtime = "nodejs";
export async function GET() {
  try { return NextResponse.json({ programs: await getPublicEnquiryPrograms() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Course information is currently unavailable. Please try again shortly." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 12000) return NextResponse.json({ error: "Form is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { const raw = await request.text(); if (raw.length > 12000) throw Error(); body = JSON.parse(raw); if (!body || typeof body !== "object" || Array.isArray(body)) throw Error(); }
  catch { return NextResponse.json({ error: "Invalid enquiry form." }, { status: 400 }); }
  if (body.website) return NextResponse.json({ error: "Your enquiry could not be accepted. Please try again." }, { status: 400 });
  const { errors, value } = validateEnquiry(body);
  if (Object.keys(errors).length) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
  try {
    // Enable a header only when the deployment's reverse proxy overwrites it
    // and the origin is inaccessible directly. Otherwise use a shared bucket;
    // a caller-controlled forwarded header must never defeat throttling.
    const trustedHeader = process.env.ENQUIRY_TRUSTED_IP_HEADER;
    const ip = trustedHeader && ["cf-connecting-ip", "x-real-ip"].includes(trustedHeader)
      ? request.headers.get(trustedHeader) || "unknown" : "unknown";
    const secret = process.env.ENQUIRY_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw Error();
    const digest = (v: string) => createHmac("sha256", secret).update(v).digest("hex");
    const result = await enquiryService().rpc("submit_admission_enquiry", {
      p_full_name: value.fullName, p_phone: value.phone, p_email: value.email,
      p_program_id: value.programId, p_message: value.message,
      p_request_id: value.idempotencyKey, p_ip_hash: digest(ip), p_phone_hash: digest(value.phone),
    });
    if (result.error) {
      if (result.error.message.includes("rate_limit")) return NextResponse.json({ error: "Too many enquiries. Please wait an hour and try again." }, { status: 429, headers: { "Retry-After": "3600" } });
      if (result.error.message.includes("invalid_program")) return NextResponse.json({ error: "That course is no longer available. Please choose another.", errors: { programId: "Choose an available course." } }, { status: 400 });
      throw Error();
    }
    return NextResponse.json({ success: true }, { status: result.data?.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Your enquiry could not be saved. Please try again shortly." }, { status: 503 }); }
}
