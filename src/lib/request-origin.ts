export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try { return new URL(origin).origin === `${new URL(request.url).protocol}//${host}`; }
  catch { return false; }
}
