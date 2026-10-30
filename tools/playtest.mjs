// Campaign playtest bot: flies every mission with a simple autopilot at a fixed timestep and reports
// win/loss, time, hull, shield and kills, so pacing and difficulty spikes show up as numbers.
// Usage: node tools/playtest.mjs [--diff=easy|normal|hard] [--runs=3] [--only=m5,m6] [--limit=420]
// What it is good for: spotting crashes, stalls and unwinnable ops, and comparing trench and dogfight ops
// run to run. What it is not: a balance oracle. It never uses the bridge, never dodges and always shoots the
// nearest thing, so fleet ops (which need orders) read as losses and capital ops as slow. Results are noisy,
// so use --runs=3 or more before trusting a number.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const diff = opt.diff || 'normal', runs = +opt.runs || 3, limit = +opt.limit || 420, only = opt.only ? String(opt.only).split(',') : null;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
await page.goto(url);
await page.waitForTimeout(500);

await page.evaluate(d => { SETTINGS.difficulty = d; const end = endGame; endGame = (w, c) => { S.lastCause = c; end(w, c); }; }, diff);
const ids = await page.evaluate(() => MISSIONS.map(m => m.id));
const rows = [];

for (const id of ids) {
  if (only && !only.includes(id)) continue;
  const res = [];
  for (let r = 0; r < runs; r++) {
    const out = await page.evaluate(({ id, limit }) => {
      const m = MISSIONS.find(x => x.id === id);
      MISSIONS.forEach(x => { if (MISSIONS.indexOf(x) < MISSIONS.indexOf(m)) PROG.completed[x.id] = PROG.completed[x.id] || { score: 1, time: 60, bonuses: 0 }; });
      launchMission(m);
      S.awaitLock = true; lockPrompt.style.display = 'none';   // the real loop stays idle; the bot steps the sim itself
      const dt = 1 / 30, keys = S.keys, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const inv = new THREE.Quaternion(), v = new THREE.Vector3(), tgt = { x: 0, y: 0 };
      const aim = (pt, gain) => {
        v.copy(pt).sub(ship.position); const d = v.length() || 1;
        v.applyQuaternion(inv.copy(ship.quaternion).invert());
        S.cursor.x = clamp(v.x / d * gain, -1, 1); S.cursor.y = clamp(-v.y / d * gain, -1, 1);
        return -v.z / d;   // 1 = dead ahead
      };
      const dotTo = pt => { v.copy(pt).sub(ship.position).normalize().applyQuaternion(inv.copy(ship.quaternion).invert()); return -v.z; };
      let minHull = 100, steps = 0, lostWhy = '';
      while (S.mode === 'play' && S.time < limit) {
        steps++;
        for (const k of ['KeyW', 'KeyF', 'ShiftLeft']) keys[k] = false;
        keys.KeyW = true; S.fireHeld = false;
        if (S.launchT > 0) { update(dt); continue; }
        if (S.sector === 'trench') {
          const p = ship.position, ahead = new THREE.Vector3();
          const top = S.interior ? INT_CEIL - 12 : ceilY();
          tgt.x = 0; tgt.y = (FLOOR_Y + top) / 2;
          if (exhaustPort && p.z - (-S.runLen) < 900 && !S.escape) { tgt.x = 0; tgt.y = exhaustPort.position.y; }
                    trenchSteer(p, S.vel.z, 3, tgt);
          ahead.set(tgt.x, tgt.y, p.z + (S.escape ? 90 : -90));
          aim(ahead, 4);
          const foe = [...fighters, ...bombers].filter(f => !f.dead && f.mesh.position.z < p.z && p.z - f.mesh.position.z < 500)
            .sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0];
          if (foe && dotTo(foe.mesh.position) > .985) S.fireHeld = true;
          if (S.locked) keys.KeyF = true;
        } else {
          const p = ship.position;
          let best = null, bd = 1e9;
          const pool = [...fighters, ...bombers, ...capTargets].filter(f => f && !f.dead && f.mesh && f.mesh.visible !== false);
          for (const f of pool) { const d = f.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(p); if (d < bd) { bd = d; best = f; } }
          if (best) {
            const wp = best.mesh.getWorldPosition(new THREE.Vector3());
            const dot = aim(wp, 3);
            if (dot > .96 && bd < 650) S.fireHeld = true;
            keys.KeyW = bd > 120 || dot < .5;
            if (bd < 90) S.throttle = Math.min(S.throttle, .35);
          } else { S.cursor.x = S.cursor.y = 0; }
          if (p.length() > ARENA_R - 200) aim(new THREE.Vector3(), 3);
        }
        update(dt);
        if (S.hull < minHull) minHull = S.hull;
      }
      const win = S.mode === 'win';
      const stalled = S.mode === 'play';
      return { win, stalled, t: +S.time.toFixed(1), hull: Math.round(S.hull), minHull: Math.round(minHull), kills: S.kills, cause: stalled ? 'timeout' : (win ? '' : (S.lastCause || '')) };
    }, { id, limit });
    res.push(out);
    await page.evaluate(() => { S.mode = 'menu'; S.mission = null; showScreen && showScreen('menu'); });
  }
  const wins = res.filter(r => r.win).length;
  const avg = k => Math.round(res.reduce((a, r) => a + r[k], 0) / res.length);
  const name = await page.evaluate(id => MISSIONS.find(m => m.id === id).name, id);
  console.log('     ' + res.filter(r => !r.win).map(r => r.cause || 'lost').join(' | ').slice(0, 150));
  rows.push({ id, name, wins, runs, t: avg('t'), hull: avg('hull'), timeouts: res.filter(r => r.stalled).length });
  console.log(`${id.padEnd(4)} ${name.padEnd(22)} win ${wins}/${runs}  avg ${String(avg('t')).padStart(4)}s  end hull ${String(avg('hull')).padStart(3)}%  min hull ${String(avg('minHull')).padStart(3)}%  kills ${avg('kills')}${res.some(r => r.stalled) ? '  TIMEOUT' : ''}`);
}
if (errors.length) { console.log('\nPAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exitCode = 1; }
await browser.close();
