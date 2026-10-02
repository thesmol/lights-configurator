import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalog, quote } from '../shared.js';

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const dist = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && path === '/api/catalog') return json(res, 200, catalog);
  if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true });
  if (req.method === 'POST' && path === '/api/quote') {
    try {
      let text = '';
      for await (const chunk of req) { text += chunk; if (text.length > 20_000) throw new Error('Слишком большой запрос'); }
      return json(res, 200, quote(JSON.parse(text)));
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (req.method === 'GET' && !path.startsWith('/api/')) {
    try {
      const relative = decodeURIComponent(path).replace(/^\/+/, '');
      const filename = resolve(dist, relative || 'index.html');
      if (!filename.startsWith(dist + '/') && filename !== resolve(dist, 'index.html')) return json(res, 403, { error: 'Доступ запрещён' });
      const content = await readFile(filename);
      res.writeHead(200, { 'content-type': (mime[extname(filename)] || 'application/octet-stream') + '; charset=utf-8' });
      return res.end(content);
    } catch {
      try { const html = await readFile(resolve(dist, 'index.html')); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); } catch {}
    }
  }
  return json(res, 404, { error: 'Не найдено' });
});
server.listen(Number(process.env.API_PORT) || 8787, '0.0.0.0', () => console.log('Catalog API listening on port', Number(process.env.API_PORT) || 8787));
