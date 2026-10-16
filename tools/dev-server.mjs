// Local dev server for `npm run dev`: serves the project folder on localhost and reloads the
// browser when a file changes. No dependencies, so it works right after `git clone`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startPort = Number(process.env.PORT) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};
// added to every HTML page: reload when the server says a file changed
const reloadSnippet = `<script>new EventSource('/__reload').addEventListener('change', () => location.reload());</script>`;
const clients = new Set();

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (urlPath === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (urlPath === '/favicon.ico') { res.writeHead(204).end(); return; }   // the game has none
  let file = path.join(root, urlPath);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') data = data.toString().replace(/<\/body>/i, reloadSnippet + '</body>');
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// one reload per burst of saves; ignore folders the game never loads
let timer = null;
fs.watch(root, { recursive: true }, (_, name) => {
  if (!name || /^(\.git|node_modules|archive|tests|tools)([\\/]|$)/.test(name)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`  changed: ${name}, reloading`);
    for (const c of clients) c.write('event: change\ndata: reload\n\n');
  }, 100);
});

const listen = port => {
  server.once('error', err => {
    if (err.code === 'EADDRINUSE' && port < startPort + 20) listen(port + 1);
    else throw err;
  });
  server.listen(port, () => {
    console.log(`\n  NEON TRENCH dev server\n\n  ➜  Local:   http://localhost:${port}/\n\n  Edits to the game reload the page. Ctrl+C to stop.\n`);
  });
};
listen(startPort);
