import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { validAccountId } from "@/lib/account-validation";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const session = await adminSession(); if (session.response) return session.response;
    const { id } = await context.params;
    if (!validAccountId(id)) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    const token = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await session.db!.rpc("create_registration_link", { p_enquiry_id: id, p_token_hash: createHash("sha256").update(token).digest("hex"), p_expires_at: expiresAt });
    if (result.error) return NextResponse.json({ error: "A link could not be created. Check the enquiry and try again." }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ token, expiresAt }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return NextResponse.json({ error: "A link could not be created. Please try again." }, { status: 503 }); }
}
