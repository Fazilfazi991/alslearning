import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const setupCookie = "als_registration_setup";

// Random opaque capability. The database stores only its SHA-256 digest.
export function newSetupCapability() { return randomBytes(32).toString("base64url"); }
export function setupCapabilityDigest(value: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function secret() { const value = process.env.REGISTRATION_SETUP_SECRET; if (!value || value.length < 32) throw new Error("Registration setup is not configured"); return value; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function assertRegistrationSetupConfigured() { secret(); }

// The provider's public recovery endpoint must not by itself activate this
// application's setup flow. Only an administrator can request a link with
// this signed, expiring authorization bound to the approved identity.
export function makeRegistrationRecoveryGrant(registrationId: string, userId: string, now = Math.floor(Date.now() / 1000), recoveryId?: string) {
  const payload = Buffer.from(JSON.stringify({ purpose: "registration-recovery", registrationId, userId, expires: now + 86400, ...(recoveryId ? { recoveryId } : {}) })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function readRegistrationRecoveryGrant(value: string, now = Math.floor(Date.now() / 1000)): { registrationId: string; userId: string; recoveryId?: string } | null {
  try {
    const [payload, supplied, extra] = value.split("."); if (!payload || !supplied || extra) return null;
    const expected = Buffer.from(signature(payload)), actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return null;
    const grant = data as Record<string, unknown>;
    if (grant.purpose !== "registration-recovery" || typeof grant.registrationId !== "string" || typeof grant.userId !== "string" || typeof grant.expires !== "number" || grant.expires <= now || grant.expires > now + 86400) return null;
    if (grant.recoveryId !== undefined && (typeof grant.recoveryId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(grant.recoveryId))) return null;
    return { registrationId: grant.registrationId, userId: grant.userId, ...(typeof grant.recoveryId === "string" ? { recoveryId: grant.recoveryId } : {}) };
  } catch { return null; }
}
export function validRegistrationRecoveryGrant(value: string, registrationId: string, userId: string, now = Math.floor(Date.now() / 1000)) {
  const grant = readRegistrationRecoveryGrant(value, now);
  return grant?.registrationId === registrationId && grant.userId === userId;
}
