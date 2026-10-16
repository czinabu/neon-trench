// Smoke test: boots the game headless, clicks through every screen and flies a few
// seconds of each sector, failing on any JavaScript error. Run with `npm test`.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const click = id => page.evaluate(id => document.getElementById(id).click(), id);
const key = code => page.evaluate(code => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}, code);
const visible = id => page.evaluate(id => !document.getElementById(id).classList.contains('hidden'), id);
const fly = async ms => {
  await page.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); dispatchEvent(new MouseEvent('mousedown', { button: 0 })); });
  await page.waitForTimeout(ms);
  await page.evaluate(() => { dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); dispatchEvent(new MouseEvent('mouseup', { button: 0 })); });
};
const steps = [];
const check = (name, ok) => { steps.push((ok ? 'ok   ' : 'FAIL ') + name); if (!ok) errors.push('check failed: ' + name); };

// headless Chromium can't capture the mouse; stub the request so runs start unpaused
await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
await page.goto(url);
await page.waitForTimeout(500);
check('menu shows on load', await visible('menu'));

await click('launchBtn'); await fly(1500);
check('trench run is playing', await page.evaluate(() => S.mode === 'play' && S.sector === 'trench'));
await key('KeyT'); await key('KeyR'); await page.waitForTimeout(300);
await page.evaluate(() => document.dispatchEvent(new Event('pointerlockerror')));
check('refused mouse capture holds the run', await page.evaluate(async () => {
  const t = S.time; await new Promise(r => setTimeout(r, 300));
  return S.awaitLock && S.time === t && lockPrompt.style.display === 'block';
}));
await key('Escape'); check('pause opens', await visible('pause'));
await click('pauseSetBtn'); check('settings opens from pause', await visible('settings') && !(await visible('pause')));
await key('Escape'); check('Esc returns from settings to pause', await visible('pause') && !(await visible('settings')));
await click('resumeBtn'); check('HUD survives a settings visit', await page.evaluate(() => hud.classList.contains('on')));
await key('KeyP'); await click('resumeBtn'); check('resume works', await page.evaluate(() => S.mode === 'play' && !S.awaitLock));
await key('KeyP'); await click('menuBtn'); check('back to menu', await visible('menu'));

await click('arenaBtn'); await fly(1500);
check('arena is playing', await page.evaluate(() => S.mode === 'play' && S.sector === 'arena'));
await page.evaluate(() => {   // park a fighter dead astern and take a hit from it
  S.hull = 1e9; spawnFighter(0); const F = fighters[fighters.length - 1];
  F.mesh.position.copy(ship.position).add(new THREE.Vector3(0, 0, 150).applyQuaternion(ship.quaternion));
  damage(1, 'smoke test', F.mesh.position);
});
await page.waitForTimeout(200);
check('off-screen contact gets an edge arrow', await page.evaluate(() => threatPool.some(el => el.style.display === 'block')));
check('hit shows its direction', await page.evaluate(() => dmgHits.some(h => h.life > 0 && parseFloat(h.el.style.opacity) > 0)));
await key('KeyP'); await click('menuBtn');

await click('campaignBtn'); check('mission select opens', await visible('missionSelect'));
await page.evaluate(() => document.querySelector('#msList .mcard').click());
check('briefing opens', await visible('briefing'));
await click('bfLaunch'); await fly(1000);
check('mission launches', await page.evaluate(() => S.mode === 'play' && S.mission && S.mission.id === 'm1'));
await page.evaluate(() => endGame(false, 'smoke test'));
check('debrief opens', await visible('debrief'));
await page.evaluate(() => openMissions()); await click('msBack');

await click('settingsBtn'); check('settings opens from menu', await visible('settings'));
await page.evaluate(() => { setSens.value = 1.5; setSens.oninput(); setQuality.value = 'low'; setQuality.onchange(); });
check('settings apply', await page.evaluate(() => SETTINGS.sens === 1.5 && !bloomOn()));
await click('setBack');
check('settings save', await page.evaluate(() => JSON.parse(localStorage.getItem('neonTrench.settings')).quality === 'low'));
await click('arenaBtn'); await fly(500); await key('KeyP'); await click('menuBtn');   // fly a moment without bloom
check('no-bloom render keeps running', await page.evaluate(() => S.sector === 'arena'));
await page.evaluate(() => { setQuality.value = 'high'; setQuality.onchange(); });
await click('hangarBtn'); check('hangar opens', await visible('hangar'));
check('hangar renders a card per ship', await page.evaluate(() => document.querySelectorAll('#hgList .mcard').length === SHIPS.length));
await click('hgBack');

console.log(steps.join('\n'));
await browser.close();
if (errors.length) { console.error('\nErrors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nSmoke test passed.');
