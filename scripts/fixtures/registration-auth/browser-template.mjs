// The template service is reachable only inside the disposable Compose network.
import { createServer } from 'node:http';
const templates = {
  '/invite': '<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite">Open student setup</a>',
  '/recovery': '<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Open student setup</a>',
};
createServer((req, res) => {
  const template = templates[req.url];
  if (!template) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(template);
}).listen(8080, '0.0.0.0');
