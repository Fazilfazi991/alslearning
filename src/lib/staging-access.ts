import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const cookieName = "als_staging_access";
const formCookieName = "als_staging_form";
const sessionSeconds = 8 * 60 * 60;
const formSeconds = 15 * 60;
const stagingMode = () => process.env.NODE_ENV === "production" || process.env.ALS_STAGING_MODE === "true";

function equal(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

function signature(expiry: string, secret: string) {
  return createHmac("sha256", secret).update(`als-staging-v1:${expiry}`).digest("base64url");
}

function formSignature(expiry: string, nonce: string, secret: string) {
  return createHmac("sha256", secret).update(`als-staging-form-v1:${expiry}:${nonce}`).digest("base64url");
}

function validFormToken(value: string | undefined, submitted: FormData, secret: string) {
  if (!value) return false;
  const [expiry, nonce, mac, extra] = value.split(".");
  if (extra || !/^\d{13}$/.test(expiry || "") || !/^[A-Za-z0-9_-]{32}$/.test(nonce || "") || !mac) return false;
  const until = Number(expiry);
  if (until <= Date.now() || until > Date.now() + formSeconds * 1000) return false;
  const token = submitted.get("csrf");
  return typeof token === "string" && equal(token, nonce) && equal(mac, formSignature(expiry, nonce, secret));
}

function hasAccess(value: string | undefined, secret: string) {
  if (!value) return false;
  const [expiry, mac, extra] = value.split(".");
  if (extra || !/^\d{13}$/.test(expiry || "") || !mac) return false;
  const until = Number(expiry);
  if (until <= Date.now() || until > Date.now() + sessionSeconds * 1000) return false;
  return equal(mac, signature(expiry, secret));
}

function gatePage(nonce: string, error = false) {
  // Self-contained HTML is intentional: the gate must work before the app's
  // client bundle, fonts, and Supabase session are configured.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>ALS staging access</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8f9fc;color:#11131a;font-family:Arial,Helvetica,sans-serif}main{width:min(100%,420px);background:#fff;border:1px solid #e5e7ef;border-radius:16px;padding:32px;box-shadow:0 12px 32px rgba(42,67,127,.06)}.eyebrow{color:#a4226c;font-size:12px;font-weight:750;letter-spacing:.11em;text-transform:uppercase}h1{margin:12px 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.025em}p{margin:0 0 24px;color:#646978;line-height:1.5}label{display:block;margin-bottom:8px;font-weight:700}input{display:block;width:100%;min-height:48px;padding:12px;border:1px solid #aeb4c2;border-radius:8px;font:inherit}input:focus-visible,button:focus-visible{outline:3px solid rgba(42,67,127,.4);outline-offset:2px}button{width:100%;min-height:48px;margin-top:16px;border:0;border-radius:8px;background:#a4226c;color:#fff;font:inherit;font-weight:700;cursor:pointer}button:hover{background:#830053}.error{color:#a20e31;margin:0 0 16px;font-weight:600}@media(max-width:480px){main{padding:24px}}
  </style></head><body><main><div class="eyebrow">Academy for Laboratory Science</div><h1>Staging access</h1><p>This isolated classroom test is restricted. Enter the staging access phrase before signing in to ALS.</p>${error ? '<div class="error" role="alert">Access phrase not accepted.</div>' : ""}<form method="post" action="/_staging-access"><input type="hidden" name="csrf" value="${nonce}"><label for="password">Access phrase</label><input id="password" name="password" type="password" autocomplete="off" required maxlength="256"><button type="submit">Continue to ALS</button></form></main></body></html>`;
}

function formPage(secret: string, error = false) {
  const nonce = randomBytes(24).toString("base64url");
  const expiry = String(Date.now() + formSeconds * 1000);
  const response = guarded(new NextResponse(gatePage(nonce, error), { status: error ? 401 : 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
  response.cookies.set(formCookieName, `${expiry}.${nonce}.${formSignature(expiry, nonce, secret)}`, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/_staging-access", maxAge: formSeconds,
  });
  return response;
}

function guarded(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function stagingAccessResponse(request: NextRequest): Promise<NextResponse | null> {
  if (!stagingMode()) return null;
  const phrase = process.env.ALS_STAGING_ACCESS_PHRASE;
  const secret = process.env.ALS_STAGING_COOKIE_SECRET;
  const canonical = process.env.ALS_STAGING_ORIGIN;
  if (!phrase || phrase.length < 24 || !secret || secret.length < 32 || !canonical || !/^https:\/\/[^/]+$/.test(canonical)) {
    return guarded(new NextResponse("Staging access is not configured.", { status: 503 }));
  }
  const path = request.nextUrl.pathname;
  if (path === "/api/auth/qa-password" || path.startsWith("/live-poc/") || path === "/api/cloudflare/realtime") {
    return guarded(new NextResponse("Not found", { status: 404 }));
  }
  if (path === "/_staging-access") {
    if (request.method === "GET") {
      return formPage(secret);
    }
    // A signed, short-lived form cookie protects POST even when an embedded
    // browser or reverse proxy omits/rewrites the navigation's Origin header.
    if (request.method !== "POST" || Number(request.headers.get("content-length") || 0) > 4096) {
      return guarded(new NextResponse("Invalid request", { status: 403 }));
    }
    let submitted: FormData;
    try { submitted = await request.formData(); } catch { return guarded(new NextResponse("Invalid request", { status: 400 })); }
    if (!validFormToken(request.cookies.get(formCookieName)?.value, submitted, secret)) {
      return guarded(new NextResponse("Invalid request", { status: 403 }));
    }
    const password = submitted.get("password");
    if (typeof password !== "string" || password.length > 256 || !equal(password, phrase)) {
      return formPage(secret, true);
    }
    const expiry = String(Date.now() + sessionSeconds * 1000);
    const response = guarded(new NextResponse(null, { status: 303, headers: { Location: `${canonical}/login` } }));
    response.cookies.set(cookieName, `${expiry}.${signature(expiry, secret)}`, {
      httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: sessionSeconds,
    });
    return response;
  }
  if (hasAccess(request.cookies.get(cookieName)?.value, secret)) return null;
  if (path.startsWith("/api/") || path.startsWith("/_next/")) {
    return guarded(NextResponse.json({ error: "Staging access required" }, { status: 401 }));
  }
  return guarded(new NextResponse(null, { status: 307, headers: { Location: `${canonical}/_staging-access` } }));
}

export function applyStagingHeaders(response: NextResponse) {
  return stagingMode() ? guarded(response) : response;
}
