// Disposable local acceptance only. One incoming request yields at most one
// upstream request; the proxy never retries or logs request paths or bodies.
import { createServer, request } from 'node:http';
import { pipeline } from 'node:stream';
import { createServerClient } from '@supabase/ssr';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

if (process.env.ALS_LOCAL_REGISTRATION_QA !== '1' || process.env.NODE_ENV !== 'development' || process.env.VERCEL !== undefined) throw new Error('Local browser acceptance opt-in is required');
const origin = 'http://127.0.0.1:19422';
const proxyOrigin = 'http://127.0.0.1:19424';
let bootstrapAvailable = true;
let refreshBundle = null;
if (process.env.ALS_LOCAL_BROWSER_JOURNEY_QA === '1') {
  const localRequire = createRequire(join(tmpdir(), 'als-playwright-test-tooling', 'package.json'));
  const esbuild = localRequire('esbuild');
  const source = `import {createBrowserClient} from '@supabase/ssr';
    const client=createBrowserClient('http://127.0.0.1:19424',${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)});
    document.getElementById('refresh').addEventListener('click',async()=>{const result=await client.auth.refreshSession();document.getElementById('result').textContent=result.error?'Refresh failed':'Session refreshed';});`;
  const built = await esbuild.build({ stdin: { contents: source, resolveDir: process.cwd() }, bundle: true, platform: 'browser', write: false, format: 'iife' });
  refreshBundle = built.outputFiles[0].contents;
}
createServer(async (incoming, outgoing) => {
  const incomingOrigin = incoming.headers.origin;
  if (incomingOrigin && incomingOrigin !== origin && incomingOrigin !== proxyOrigin) { outgoing.writeHead(403); outgoing.end(); return; }
  if (incomingOrigin === origin) { outgoing.setHeader('Access-Control-Allow-Origin', origin); outgoing.setHeader('Vary', 'Origin'); }
  if (incoming.method === 'OPTIONS') {
    outgoing.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,range-unit' });
    outgoing.end(); return;
  }
  const path = incoming.url || '';
  if (refreshBundle && path === '/__local_refresh' && incoming.method === 'GET') {
    outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY' });
    outgoing.end('<!doctype html><title>Local session refresh</title><button id="refresh">Refresh session</button><p id="result"></p><script src="/__local_refresh.js"></script>');
    return;
  }
  if (refreshBundle && path === '/__local_refresh.js' && incoming.method === 'GET') {
    outgoing.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' }); outgoing.end(refreshBundle); return;
  }
  if (path === '/__local_admin_bootstrap' && incoming.method === 'GET' && bootstrapAvailable) {
    // The form posts to the proxy, whose 303 redirects to the exact local app.
    // Chromium applies form-action to that redirect as well as the POST.
    outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; form-action 'self' ${origin}; frame-ancestors 'none'`, 'X-Frame-Options': 'DENY' });
    outgoing.end(`<!doctype html><title>Local browser fixture</title><form method="post" action="/__local_admin_session"><input type="hidden" name="capability" value="${process.env.ALS_BROWSER_BOOTSTRAP_CAPABILITY}"><button>Open synthetic Admin session</button></form>`);
    return;
  }
  if (path === '/__local_admin_session' && incoming.method === 'POST' && incomingOrigin === proxyOrigin && bootstrapAvailable) {
    let body = '';
    for await (const chunk of incoming) { body += chunk; if (body.length > 1024) { outgoing.writeHead(400); outgoing.end(); return; } }
    if (new URLSearchParams(body).get('capability') !== process.env.ALS_BROWSER_BOOTSTRAP_CAPABILITY) { outgoing.writeHead(403); outgoing.end(); return; }
    bootstrapAvailable = false;
    // Bootstrap a synthetic Admin via real local GoTrue. This fixture-only
    // endpoint never exists in the application or a hosted deployment.
    const setCookies = [];
    const client = createServerClient('http://127.0.0.1:19424', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: { getAll: () => [], setAll: values => { for (const { name, value, options } of values) {
        const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`, 'SameSite=Lax'];
        if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
        if (options.httpOnly) parts.push('HttpOnly');
        if (options.secure) parts.push('Secure');
        setCookies.push(parts.join('; '));
      } } },
    });
    try {
      const result = await client.auth.signInWithPassword({ email: 'browser-admin@example.test', password: process.env.ALS_BROWSER_ADMIN_PASSWORD });
      if (result.error || result.data.user?.app_metadata?.role !== 'admin') throw new Error('Synthetic admin login failed');
      outgoing.writeHead(303, { Location: `${origin}/admin/registrations`, 'Set-Cookie': setCookies, 'Cache-Control': 'no-store' }); outgoing.end();
    } catch { outgoing.writeHead(503, { 'Cache-Control': 'no-store' }); outgoing.end(); }
    return;
  }
  const endpoint = path.startsWith('/auth/v1/') ? { port: 19421, path: path.slice('/auth/v1'.length) }
    : path.startsWith('/rest/v1/') ? { port: 19423, path: path.slice('/rest/v1'.length) } : null;
  if (!endpoint) { outgoing.writeHead(404); outgoing.end(); return; }
  const headers = { ...incoming.headers, host: `127.0.0.1:${endpoint.port}` };
  const upstream = request({ hostname: '127.0.0.1', port: endpoint.port, path: endpoint.path, method: incoming.method, headers }, response => {
    outgoing.writeHead(response.statusCode || 502, response.headers);
    pipeline(response, outgoing, () => {});
  });
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
  pipeline(incoming, upstream, () => {});
}).listen(19424, '127.0.0.1');
