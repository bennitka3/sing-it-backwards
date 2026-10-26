// A static file server for trying the site locally: node test/serve.mjs [port]. GitHub Pages serves it for real.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

export function serve(port = 0) {
  const server = http.createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, rel.endsWith('/') ? rel + 'index.html' : rel));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const s = await serve(Number(process.argv[2]) || 3000);
  console.log(`Open http://localhost:${s.address().port}/`);
}
