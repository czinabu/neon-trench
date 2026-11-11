// Draws the app icon with the headless Chromium that Playwright brings: the desktop app's
// build/icon.png (512x512) and the web page's favicon, touch and manifest icons in ../icons/.
// Run from desktop/ with `npm run icon` after `npm install` in the repo root. Only needed if the icon changes.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');

// tile: rounded dark tile with a transparent margin (desktop, favicons); full: square, edge to edge
// (iOS and Android round or mask it themselves). Drawn at 512 and scaled down to `out` px.
const draw = ([tile, out]) => {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  // rounded dark tile
  if (tile) { const r = 96; g.beginPath(); g.roundRect(16, 16, S - 32, S - 32, r); g.clip(); }
  const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#120024'); bg.addColorStop(1, '#03030a');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  const vx = S / 2, vy = 200;   // vanishing point of the trench
  const glow = (col, w, blur) => { g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = blur; };
  // trench floor grid
  glow('#ff2d78', 4, 18);
  for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + i * 120, S); g.stroke(); }
  for (let k = 1; k <= 6; k++) { const t = Math.pow(k / 6, 2.2), y = vy + (S - vy) * t;
    g.globalAlpha = .35 + .65 * t; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  g.globalAlpha = 1;
  // trench walls
  glow('#00f0ff', 10, 30);
  g.beginPath(); g.moveTo(vx - 20, vy); g.lineTo(40, S); g.moveTo(vx + 20, vy); g.lineTo(S - 40, S); g.stroke();
  // ship chevron
  glow('#00f0ff', 14, 36); g.lineJoin = 'round';
  g.beginPath(); g.moveTo(vx - 110, 380); g.lineTo(vx, 300); g.lineTo(vx + 110, 380); g.stroke();
  glow('#ffffff', 6, 20);
  g.beginPath(); g.moveTo(vx - 110, 380); g.lineTo(vx, 300); g.lineTo(vx + 110, 380); g.stroke();
  // horizon glow
  const hz = g.createRadialGradient(vx, vy, 0, vx, vy, 140); hz.addColorStop(0, 'rgba(255,45,120,.9)'); hz.addColorStop(1, 'rgba(255,45,120,0)');
  g.shadowBlur = 0; g.fillStyle = hz; g.fillRect(0, 0, S, S);
  if (out === S) return c.toDataURL('image/png');
  const o = document.createElement('canvas'); o.width = o.height = out;
  const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, out, out);
  return o.toDataURL('image/png');
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const png = async (tile, out) => Buffer.from((await page.evaluate(draw, [tile, out])).split(',')[1], 'base64');
const write = (rel, buf) => { writeFileSync(new URL(rel, import.meta.url), buf); console.log('wrote', rel); };

write('./build/icon.png', await png(true, 512));
mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
write('../icons/icon-192.png', await png(true, 192));
write('../icons/icon-512.png', await png(true, 512));
write('../icons/maskable-512.png', await png(false, 512));
write('../icons/apple-touch-icon.png', await png(false, 180));
// favicon.ico: 16, 32 and 48 px PNGs in one ICO container
const ico = await Promise.all([16, 32, 48].map(n => png(true, n)));
const head = Buffer.alloc(6 + 16 * ico.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4);
let off = head.length;
ico.forEach((b, i) => {
  const n = [16, 32, 48][i], e = 6 + 16 * i;
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(off, e + 12); off += b.length;
});
const favicon = Buffer.concat([head, ...ico]);
write('../icons/favicon.ico', favicon);
write('../favicon.ico', favicon);   // the path browsers and crawlers ask for by default
await browser.close();
