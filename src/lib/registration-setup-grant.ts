import { createHmac, timingSafeEqual } from "node:crypto";
export const setupCookie = "als_registration_setup";
const maxAge = 600;
function secret() { const value = process.env.REGISTRATION_SETUP_SECRET; if (!value || value.length < 32) throw new Error("Registration setup is not configured"); return value; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function makeSetupGrant(userId: string, sessionId: string, now = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, expires: now + maxAge })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function validSetupGrant(value: string, userId: string, sessionId: string, now = Math.floor(Date.now() / 1000)) {
  try {
    const [payload, supplied, extra] = value.split("."); if (!payload || !supplied || extra) return false;
    const expected = Buffer.from(signature(payload)), actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return false;
    const grant = data as Record<string, unknown>;
    return grant.userId === userId && grant.sessionId === sessionId && typeof grant.expires === "number" && grant.expires > now && grant.expires <= now + maxAge;
  } catch { return false; }
}

// The provider's public recovery endpoint must not by itself activate this
// application's setup flow. Only an administrator can request a link with
// this signed, expiring authorization bound to the approved identity.
export function makeRegistrationRecoveryGrant(registrationId: string, userId: string, now = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ purpose: "registration-recovery", registrationId, userId, expires: now + 86400 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function readRegistrationRecoveryGrant(value: string, now = Math.floor(Date.now() / 1000)): { registrationId: string; userId: string } | null {
  try {
    const [payload, supplied, extra] = value.split("."); if (!payload || !supplied || extra) return null;
    const expected = Buffer.from(signature(payload)), actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return null;
    const grant = data as Record<string, unknown>;
    if (grant.purpose !== "registration-recovery" || typeof grant.registrationId !== "string" || typeof grant.userId !== "string" || typeof grant.expires !== "number" || grant.expires <= now || grant.expires > now + 86400) return null;
    return { registrationId: grant.registrationId, userId: grant.userId };
  } catch { return null; }
}
export function validRegistrationRecoveryGrant(value: string, registrationId: string, userId: string, now = Math.floor(Date.now() / 1000)) {
  const grant = readRegistrationRecoveryGrant(value, now);
  return grant?.registrationId === registrationId && grant.userId === userId;
}
