import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import { validAccountId } from "@/lib/account-validation";
import { isSameOriginRequest } from "@/lib/request-origin";
import { registrationPasswordSetupAvailable } from "@/lib/registration-setup-availability";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await adminSession();
  if (session.response) return session.response;
  const { id } = await context.params;
  if (!validAccountId(id)) return NextResponse.json({ error: "Invalid application." }, { status: 400, headers });
  const result = await session.db!.rpc("registration_setup_recovery_status", { p_registration: id });
  if (result.error) return NextResponse.json({ error: "Recovery status is unavailable." }, { status: 503, headers });
  if (!result.data) return NextResponse.json({ error: "Application is unavailable." }, { status: 404, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: Request, context: Context) {
  if (!registrationPasswordSetupAvailable) return NextResponse.json({ error: "Recovery is temporarily unavailable." }, { status: 503, headers });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403, headers });
  const session = await adminSession();
  if (session.response) return session.response;
  const { id } = await context.params;
  const data: unknown = await request.json().catch(() => null);
  if (!validAccountId(id) || !data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length !== 2) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  const { operationId, reason } = data as Record<string, unknown>;
  if (!validAccountId(operationId) || (reason !== "setup_acknowledgement_lost" && reason !== "operator_assisted_setup")) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  const result = await session.db!.rpc("authorize_registration_setup_recovery", { p_registration: id, p_operation: operationId, p_reason: reason });
  if (result.error) return NextResponse.json({ error: "Recovery could not be authorized." }, { status: 503, headers });
  if (typeof result.data !== "string") return NextResponse.json({ error: "Recovery is not available for this operation." }, { status: 409, headers });
  return NextResponse.json({ authorized: true }, { headers });
}
