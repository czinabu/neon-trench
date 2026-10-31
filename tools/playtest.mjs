// Campaign playtest bot: flies every mission with a simple autopilot at a fixed timestep and reports
// win/loss, time, hull, shield and kills, so pacing and difficulty spikes show up as numbers.
// Usage: node tools/playtest.mjs [--diff=easy|normal|hard] [--runs=3] [--only=m5,m6] [--limit=420] [--noorders] [--where]
// The pilot flies and shoots the nearest thing, weaves under fire, drops flares at incoming missiles and times
// the plasma vents inside the dreadnought. A small "commander" gives the orders a player would from the command
// bridge (js/bridge.js), by calling the same functions the bridge buttons do, each only once its tool has opened
// in the campaign (toolOn): launch TALON and WRAITH, send the wings at the capitals, focus the fleet on one enemy
// ship, pull a hurt ship out, call in the reserve. --noorders turns the commander off (the old pure-pilot bot).
// What it is good for: spotting crashes, stalls and unwinnable ops, and comparing ops run to run. What it is not:
// a balance oracle. It never reads the bridge screen, so UI problems are invisible to it, and its orders are a
// fixed recipe, not a good player's. Results are noisy, so use --runs=3 or more before trusting a number.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const diff = opt.diff || 'normal', runs = +opt.runs || 3, limit = +opt.limit || 420, only = opt.only ? String(opt.only).split(',') : null, orders = !opt.noorders;
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
    const out = await page.evaluate(({ id, limit, orders, opt_where }) => {
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
      let minHull = 100, hitAt = '', steps = 0, lastHull = 100, hurtT = -9, weave = 0;
      const cmd = { t: 0, did: {}, hurt: {} };
      const foeCaps = () => capitals.filter(o => !o.friendly && o.fleet && !o.gate && o.state === 'fight' && !o.dead);
      // the commander: the orders a player gives on the command bridge, once per recipe step
      const command = () => {
        const K = carrierShip();
        if (!orders || !K || K.state !== 'fight' || S.launchT > 0) return;
        const d = cmd.did, foes = foeCaps(), gate = fleetGate();
        if (!d.squads && S.time > 2) {
          d.squads = true;
          if (toolOn('squads')) { launchSquadron(1); launchSquadron(2); }
        }
        if (S.time > 4 && (S.time - (cmd.wingT || 0) > 6)) {
          cmd.wingT = S.time;
          const big = capTargets.length > 0;
          if (sqMembers(0).length) setSquadOrder(0, big ? 'strike' : 'free');
          if (toolOn('squads')) {
            if (sqAlive(1).length) setSquadOrder(1, 'defend');
            if (sqAlive(2).length) setSquadOrder(2, big ? 'strike' : 'free');
          }
        }
        if (S.fleet && toolOn('groups')) {
          const mark = foes.slice().sort((a, b) => a.hp / a.T.hp - b.hp / b.T.hp)[0];
          if (mark && S.time > 3 && fleetMark() !== mark && S.time - (cmd.focusT || -9) > 4) { cmd.focusT = S.time; fleetAll('engage', mark); }
        }
        if (toolOn('move') && S.mission && S.mission.id === 'm13' && !d.moved && S.time > 3) { d.moved = true; fleetFallBack(K); }
        if (toolOn('move')) for (const C of fleetShips()) {   // pull a hurt ship out of the line once
          if (C.kind !== 'carrier' && C.hp < C.T.hp * .35 && !cmd.hurt[C.T.name]) { cmd.hurt[C.T.name] = 1; fleetFallBack(C); }
        }
        if (!d.reserve && reserveReady() && S.time > 25) { d.reserve = true; fleetCallReserve(K.g.position.clone().add(new THREE.Vector3(120, 0, -160))); }
      };
      const nearMsl = () => eMsls.some(E => !E.dead && !E.decoy && E.m.position.distanceTo(ship.position) < 280);
      while (S.mode === 'play' && S.time < limit) {
        steps++;
        for (const k of ['KeyW', 'KeyF', 'ShiftLeft']) keys[k] = false;
        keys.KeyW = true; S.fireHeld = false;
        if (S.launchT > 0) { update(dt); continue; }
        if (S.hull < lastHull - 1) { hurtT = S.time; hitAt = `t${S.time | 0} x${ship.position.x | 0} y${ship.position.y | 0} z${ship.position.z | 0}${S.escape ? ' escape' : ''}`; }
        lastHull = S.hull;
        cmd.t += dt; if (cmd.t > .5) { cmd.t = 0; command(); }
        if (S.cm > 0 && S.cmCD <= 0 && nearMsl()) deployFlares();
        weave += dt;
        if (S.sector === 'trench') {
          const p = ship.position, ahead = new THREE.Vector3();
          const top = S.interior ? INT_CEIL - 12 : ceilY();
          tgt.x = 0; tgt.y = (FLOOR_Y + top) / 2;
          if (exhaustPort && p.z - (-S.runLen) < 900 && !S.escape) { tgt.x = 0; tgt.y = exhaustPort.position.y; }
          // the escape run: slip round the next collapsing girder or pillar (over a floor one, under a ceiling one)
          const D = S.escape && escDebris.filter(d => d.min.z > p.z - 4 && d.min.z - p.z < 300).sort((a, b) => a.min.z - b.min.z)[0];
          if (D) {
            if (D.max.x - D.min.x < HALF_W * 2 - 1) tgt.x = D.min.x < 0 ? HALF_W * .55 : -HALF_W * .55;
            else tgt.y = D.min.y <= FLOOR_Y + 1 ? D.max.y + 9 : D.min.y - 9;
          }
          trenchSteer(p, S.vel.z, 3, tgt);
          ahead.set(tgt.x, tgt.y, p.z + (S.escape ? 90 : -90));
          const facing = aim(ahead, 4);
          if (S.escape && facing < .6) {   // the U-turn at the dead core: flat yaw, no pitch, slow down so it does not dive
            S.cursor.y = 0; S.cursor.x = S.cursor.x < 0 ? -1 : 1; keys.KeyW = false;
          }
          const foe = [...fighters, ...bombers].filter(f => !f.dead && f.mesh.position.z < p.z && p.z - f.mesh.position.z < 500)
            .sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0];
          if (foe && dotTo(foe.mesh.position) > .985) S.fireHeld = true;
          if (S.locked) keys.KeyF = true;
          // plasma vents: if one will be burning when we get there, ease off until it is not
          if (S.interior && S.vel.z < -1) {
            const V = vents.filter(x => x.z < p.z).sort((a, b) => b.z - a.z)[0];
            if (V) {
              const tt = (p.z - V.z) / -S.vel.z, ph = (V.t + tt) % VENT_CYCLE;
              if (p.z - V.z < 260 && ph > VENT_ON - .6) keys.KeyW = false;
            }
          }
        } else {
          const p = ship.position;
          let best = null, bd = 1e9;
          const pool = [...fighters, ...bombers, ...capTargets].filter(f => f && !f.dead && f.mesh && f.mesh.visible !== false);
          for (const f of pool) { const d = f.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(p); if (d < bd) { bd = d; best = f; } }
          if (best) {
            const wp = best.mesh.getWorldPosition(new THREE.Vector3());
            // under fire (hull dropped in the last 2 s): corkscrew a little round the aim point
            const hot = S.time - hurtT < 2;
            if (hot) wp.add(v.set(Math.sin(weave * 2.3), Math.cos(weave * 1.7), 0).applyQuaternion(ship.quaternion).multiplyScalar(Math.min(30, bd * .06)));
            const dot = aim(wp, 3);
            if (dot > (hot ? .93 : .96) && bd < 650) S.fireHeld = true;
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
      return { win, stalled, t: +S.time.toFixed(1), hull: Math.round(S.hull), minHull: Math.round(minHull), kills: S.kills, cause: stalled ? 'timeout' : (win ? '' : (S.lastCause || '') + (opt_where ? ' [last hit ' + hitAt + ']' : '')) };
    }, { id, limit, orders, opt_where: !!opt.where });
    res.push(out);
    await page.evaluate(() => { S.mode = 'menu'; S.mission = null; showScreen && showScreen('menu'); });
  }
  const wins = res.filter(r => r.win).length;
  const avg = k => Math.round(res.reduce((a, r) => a + r[k], 0) / res.length);
  const name = await page.evaluate(id => MISSIONS.find(m => m.id === id).name, id);
  console.log('     ' + res.filter(r => !r.win).map(r => r.cause || 'lost').join(' | ').slice(0, 400));
  rows.push({ id, name, wins, runs, t: avg('t'), hull: avg('hull'), timeouts: res.filter(r => r.stalled).length });
  console.log(`${id.padEnd(4)} ${name.padEnd(22)} win ${wins}/${runs}  avg ${String(avg('t')).padStart(4)}s  end hull ${String(avg('hull')).padStart(3)}%  min hull ${String(avg('minHull')).padStart(3)}%  kills ${avg('kills')}${res.some(r => r.stalled) ? '  TIMEOUT' : ''}`);
}
if (errors.length) { console.log('\nPAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exitCode = 1; }
await browser.close();
