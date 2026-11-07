// Draws the app icon (build/icon.png, 512x512) with the headless Chromium that Playwright brings.
// Run from desktop/ with `npm run icon` after `npm install` in the repo root. Only needed if the icon changes.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');

const draw = () => {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  // rounded dark tile
  const r = 96; g.beginPath(); g.roundRect(16, 16, S - 32, S - 32, r); g.clip();
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
  return c.toDataURL('image/png');
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const url = await page.evaluate(draw);
await browser.close();
writeFileSync(new URL('./build/icon.png', import.meta.url), Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote desktop/build/icon.png');
