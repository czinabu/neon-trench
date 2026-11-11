// README screenshots: boots the game headless, sets up a few scenes and saves them to docs/screenshots/.
// Run with `node tools/screenshots.mjs [scene ...]` (same setup as `npm test`). Scenes are staged through the game's own globals,
// so a rename in js/ can break one; fix the scene here rather than the game.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

// a fresh page per scene, with the campaign cleared and every tip and intro already seen
async function fresh(){
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => console.error('  page error:', e.message));
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    MISSIONS.forEach(m => PROG.completed[m.id] = { score: 1, time: 60, bonuses: 0 });
    PROG.introSeen = true; PROG.academy = 'skip';
    SETTINGS.trenchIntro = false; SETTINGS.quality = 'high';
    if (typeof FLEET_TIPS !== 'undefined') { PROG.tips = PROG.tips || {}; for (const k in FLEET_TIPS) PROG.tips[k] = 1; }
    saveProg(); renderMenu();
  });
  return page;
}
const hold = (page, code, down) => page.evaluate(([c, d]) => dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })), [code, down]);

// in-page helpers: run the game forward faster than a software-rendered browser can draw it, and point the ship
const HELPERS = () => {
  window.shotSim = (sec, fire) => {
    S.keys = S.keys || {}; S.keys.KeyW = true; S.fireHeld = !!fire;
    for (let t = 0; t < sec; t += .05) { S.hull = 1e9; update(.05); }
  };
  window.shotAim = (target, back, up) => {   // park the ship `back` metres behind target, nose on it
    const at = target.clone ? target.clone() : target;
    const dir = at.clone().sub(ship.position).normalize();
    ship.position.copy(at).addScaledVector(dir, -back); ship.position.y += up || 0;
    ship.lookAt(ship.position.clone().multiplyScalar(2).sub(at));
    if (S.vel) S.vel.set(0, 0, 0);
  };
  window.shotFoe = () => {
    let best = null, d = 1e9;
    for (const F of fighters) { if (F.dead) continue; const e = F.mesh.position.distanceTo(ship.position); if (e < d) { d = e; best = F; } }
    return best;
  };
};

async function fly(page, mission, sector, cam){
  await page.evaluate(HELPERS);
  await page.evaluate(([m, sec, cam]) => {
    PROG.tutDone = true; S.school = false; S.mission = missionById(m); startGame(sec);
    if (sec === 'arena') launchEnd(true);
    setCam(cam);
  }, [mission, sector, cam]);
}

const scenes = {
  async title(page){
    await page.waitForTimeout(2500);
  },
  async trench(page){
    await fly(page, 'm1', 'trench', 'fp');
    await page.evaluate(() => shotSim(3, false));
    await page.waitForTimeout(2500);
  },
  async fleet(page){
    await fly(page, 'm10', 'arena', 'tp');
    await page.evaluate(() => {
      shotSim(24, false);
      const foe = enemyCap(); if (foe) shotAim(foe.g.position, 900, 60); shotSim(.4, true);
    });
    await page.waitForTimeout(2500);
  },
  async bridge(page){
    await fly(page, 'm15', 'arena', 'tp');
    await page.evaluate(() => {
      shotSim(18, false);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyB' }));
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }));
    });
    await page.waitForTimeout(3000);
  },
  async drift(page){
    await fly(page, 'm18', 'arena', 'fp');
    await page.evaluate(() => { shotSim(14, false); const F = shotFoe(); if (F) shotAim(F.mesh.position, 120, 4); shotSim(.4, true); });
    await page.waitForTimeout(2500);
  },
  async hangar(page){
    await page.evaluate(() => { PROG.parts = 6; PROG.credits = 2450; saveProg(); hangarBtn.click(); });
    await page.waitForTimeout(3000);
  },
  async deck(page){
    await page.evaluate(() => campaignBtn.click());
    await page.waitForTimeout(1000);
    await page.evaluate(() => { if (typeof ccPromoOk !== 'undefined') ccPromoOk.click(); });
    await page.waitForTimeout(2500);
  },
};

for (const [name, run] of Object.entries(scenes)) {
  if (only.length && !only.includes(name)) continue;
  const page = await fresh();
  await run(page);
  await page.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 85 });
  console.log('saved', name);
  await page.close();
}
await browser.close();
