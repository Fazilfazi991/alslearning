import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const cookieName = "als_enquiry_browser";
const lifetime = 30 * 24 * 60 * 60;
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(`als-enquiry-browser:${value}`).digest("hex");

/** Anonymous browser fairness, not a replacement for the persistent phone limit.
 * A browser may clear cookies; an unsigned or modified token cannot select a
 * different rate bucket. No raw network identifier is persisted. */
export function enquiryRateIdentity(request: Request, secret: string, now = Math.floor(Date.now() / 1000)) {
  const supplied = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  let token = supplied, browserId: string | undefined;
  if (supplied && supplied.length < 200) {
    const [version, nonce, expiration, signature, extra] = supplied.split(".");
    if (!extra && version === "v1" && /^[a-f0-9]{64}$/.test(nonce || "") && /^\d{10}$/.test(expiration || "") && /^[a-f0-9]{64}$/.test(signature || "")) {
      const expires = Number(expiration), expected = sign(`${version}.${nonce}.${expiration}`, secret);
      if (expires > now && expires <= now + lifetime && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) browserId = nonce;
    }
  }
  const fresh = !browserId;
  if (!browserId) {
    browserId = randomBytes(32).toString("hex");
    const payload = `v1.${browserId}.${now + lifetime}`;
    token = `${payload}.${sign(payload, secret)}`;
  }
  // Only configure this after confirming the ingress overwrites the header and
  // blocks direct-origin access. Forwarded-for chains are never accepted.
  const header = process.env.ENQUIRY_TRUSTED_IP_HEADER;
  const candidate = header && ["cf-connecting-ip", "x-real-ip"].includes(header) ? request.headers.get(header)?.trim() : undefined;
  const origin = candidate && isIP(candidate) ? `network:${candidate}` : `browser:${browserId}`;
  const originHash = createHmac("sha256", secret).update(`als-enquiry-rate:${origin}`).digest("hex");
  const cookie = fresh ? `${cookieName}=${token}; Max-Age=${lifetime}; Path=/api/enquiries; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` : null;
  return { originHash, cookie };
}
