import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

// The signed browser token is a fairness measure alongside persistent contact
// limits. Never trust arbitrary forwarded IP headers as a rate identity.
export function rateIdentity(request: Request, secret: string) {
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


