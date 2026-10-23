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
check('every screen but the menu is really hidden on load', await page.evaluate(() => SCR.filter(id => id !== 'menu').every(id => getComputedStyle(document.getElementById(id)).display === 'none')));
check('menu draws the 3D backdrop', await page.evaluate(() => document.body.classList.contains('staged') && stageCur && stageCur.name === 'campaign'));
await page.evaluate(() => launchBtn.dispatchEvent(new MouseEvent('mouseenter')));
// the backdrop cross-fades over a few frames, which can take a while in a software-rendered browser
const swapped = await page.waitForFunction(() => stageCur.name === 'trench' && miTitle.textContent === 'Free Trench', null, { timeout: 5000 }).then(() => true, () => false);
check('hovering a mode swaps the backdrop', swapped);
await click('launchBtn');
check('free modes stay locked before the campaign is done', await page.evaluate(() => S.mode === 'menu' && launchBtn.classList.contains('locked')));
await page.evaluate(() => { MISSIONS.forEach(m => PROG.completed[m.id] = { score: 1, time: 60, bonuses: 0 }); saveProg(); renderMenu(); });
check('clearing the campaign unlocks them', await page.evaluate(() => !launchBtn.classList.contains('locked') && !arenaBtn.classList.contains('locked')));
await click('menuFsBtn');
check('fullscreen toggle saves the choice', await page.evaluate(() => typeof SETTINGS.fullscreen === 'boolean'));

await click('launchBtn'); await fly(1500);
check('trench run is playing', await page.evaluate(() => S.mode === 'play' && S.sector === 'trench'));
await key('AltLeft'); await key('KeyV'); await page.waitForTimeout(300);
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
check('arena starts with two wingmen', await page.evaluate(() => wingmen.length === 2));
check('wingmen launch from the carrier bay', await page.evaluate(() => {
  const K = carrierShip(); return !!K && wingmen.some(w => w.launch > 0 && w.mesh.position.distanceTo(K.g.position) < 200);
}));
check('the arena opens on the carrier launch run, harmless and skippable', await page.evaluate(() => {
  S.mission = null; startGame('arena'); const K = carrierShip();
  const bay = S.launchT > 0 && ship.position.distanceTo(K.g.position) < 100 && launchHint.style.display === 'block' && wingmen[0].launch > 2.2 + 1;
  damage(50, 'test'); const safe = S.hull === 100;
  for (let i = 0; i < 20; i++) update(.05);
  const moving = S.launchT > 0 && ship.position.distanceTo(K.g.position) > 60;
  launchEnd(true);
  return bay && safe && moving && S.launchT === 0 && launchHint.style.display === 'none' && S.vel.length() > 100 && wingmen.every(w => w.launch <= 2.2);
}));
check('the launch run ends on its own and hands over control', await page.evaluate(() => {
  startGame('arena'); for (let i = 0; i < 70; i++) update(.05);
  return S.launchT === 0 && launchHint.style.display === 'none' && S.vel.length() > 100;
}));
await page.evaluate(() => wingmen.forEach((w, i) => {   // skip the launch: put them out near the player
  w.launch = 0; w.mesh.position.copy(ship.position).add(new THREE.Vector3(i ? 40 : -40, 0, -60).applyQuaternion(ship.quaternion));
}));
await key('Digit3'); await page.waitForTimeout(1500);
check('wingmen take orders and keep flying', await page.evaluate(() => S.wingOrder === 'free' && wingmen.every(w => isFinite(w.mesh.position.x) && w.mesh.position.length() < ARENA_R)));
await key('Digit4'); await page.waitForTimeout(800);
check('cover me order sets', await page.evaluate(() => S.wingOrder === 'cover'));
await key('Digit6'); await page.waitForTimeout(300);
check('strike order refused with no capital targets', await page.evaluate(() => S.wingOrder === 'cover' && !capTargets.length));
await key('Digit1');
check('form up order sets', await page.evaluate(() => S.wingOrder === 'form'));
await page.waitForTimeout(2500);
check('wingmen hold formation ahead of the cockpit', await page.evaluate(() => wingmen.every(w => {
  const v = w.mesh.position.clone().sub(ship.position).applyQuaternion(ship.quaternion.clone().invert());
  return v.z < -20 && Math.abs(v.x) < 60;
})));
await page.evaluate(() => {   // park a fighter dead astern and take a hit from it
  S.hull = 1e9; spawnFighter(0); const F = fighters[fighters.length - 1];
  F.mesh.position.copy(ship.position).add(new THREE.Vector3(0, 0, 150).applyQuaternion(ship.quaternion));
  damage(1, 'smoke test', F.mesh.position);
});
await page.waitForTimeout(200);
check('off-screen contact gets an edge arrow', await page.evaluate(() => threatPool.some(el => el.style.display === 'block')));
check('hit shows its direction', await page.evaluate(() => dmgHits.some(h => h.life > 0 && parseFloat(h.el.style.opacity) > 0)));
check('flares decoy an incoming missile', await page.evaluate(() => {
  spawnEnemyMissile(ship.position.clone().add(new THREE.Vector3(0, 0, -300)), new THREE.Vector3(0, 0, 1));
  S.cm = 2; deployFlares(); return S.cm === 1 && flares.length > 0 && eMsls[eMsls.length - 1].decoy;
}));
check('R targets the hostile nearest the crosshair and boxes it', await page.evaluate(async () => {
  spawnFighter(0); const F = fighters[fighters.length - 1];
  F.mesh.position.copy(ship.position).add(new THREE.Vector3(0, 0, -200).applyQuaternion(ship.quaternion));
  S.target = null; dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' }));
  await new Promise(r => setTimeout(r, 200));
  return S.target === F && tgtBox.style.display === 'block' && S.leadTarget === F;
}));
check('arena obstacles are solid', await page.evaluate(() => {
  const C = arenaCols.find(c => c.kind === 'sphere' && c.a > 10), p = C.c0.clone().add(new THREE.Vector3(0, C.a * .5, 0));
  return arenaSdf(p, 1) < 0 && arenaPushOut(p, 3) && arenaSdf(p, 10) >= 2.9;
}));
const capTick = n => `for (let i = 0; i < ${n}; i++) updateCapital({ dt: .05, arena: true, p: ship.position });`;
check('the cruiser warps in with six turrets and a shielded reactor', await page.evaluate(`(() => {
  S.hull = 1e9; const free = !!S.capMode; spawnCapital('cruiser'); ${capTick(60)}
  const C = enemyCap();
  return free && C.kind === 'cruiser' && C.state === 'fight' && capTargets.length === 6 && C.shield.visible && arenaCols.includes(C.cols[0]) && /MAW/.test(capHud.textContent);
})()`));
check('downing the turrets exposes the reactor, and the reactor breaks the cruiser', await page.evaluate(`(() => {
  const C = enemyCap(); C.parts.forEach(t => hitEnemy(t, 99));
  const exposed = capTargets.length === 1 && capTargets[0].core && !C.shield.visible;
  for (let i = 0; i < 10 && !C.core.dead; i++) hitEnemy(C.core, 99);
  ${capTick(140)}
  return exposed && C.state === 'wreck' && S.capDown && C.cols.length === 0 && !arenaCols.some(c => C.colDefs.some(d => d[0] === c.obj));
})()`));
check('the frigate charges its lance, fires down its bore, and loses its shield with its guns', await page.evaluate(`(() => {
  S.capDown = false; S.hull = 1e9; S.shield = 100; const C = spawnCapital('frigate'); ${capTick(60)}
  const L = C.lance; L.cool = 0; L.eye.getWorldPosition(ship.position);
  ship.position.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(C.g.quaternion), 300);
  const before = S.shield + S.hull; let charged = false;
  for (let i = 0; i < 90; i++) { updateCapital({ dt: .05, arena: true, p: ship.position }); charged = charged || L.phase === 'charge'; }
  const hit = S.shield + S.hull < before;
  const n = capTargets.filter(t => t.ship === C).length;
  C.parts.forEach(t => hitEnemy(t, 99));
  return charged && hit && n === 5 && !C.shield.visible && capTargets.includes(C.core);
})()`));
check('the carrier relaunches a lost wingman and takes enemy fire', await page.evaluate(`(() => {
  const K = carrierShip(), w = wingmen[0]; hitWingman(w, 999);
  ${capTick(220)}
  const back = !wingmen[0].dead && wingmen[0] !== w && wingmen[0].launch > 0 && K.reserve === CARRIER_TYPE.reserve - 1;
  const hp = K.hp; const from = K.g.position.clone().add(new THREE.Vector3(0, 200, 0));
  if (capSegHit(K, from, K.g.position)) hitCarrier(K, 8, K.g.position);
  return back && K.hp === hp - 8 && /HALCYON/.test(capHud.textContent);
})()`));
check('HALCYON\'s point-defence turrets shoot down a fighter that strays near', await page.evaluate(`(() => {
  const K = carrierShip(); fighters.forEach(E => scene.remove(E.mesh)); fighters.length = 0; ship.position.set(0, 0, 3000);
  const n = K.pd.filter(g => g.on).length;
  spawnFighter(0, 'grunt'); const E = fighters[fighters.length - 1]; E.hp = 3;
  E.mesh.position.copy(K.g.position).add(new THREE.Vector3(0, 90, 0)); E.wvel.set(0, 0, 0); E.T = Object.assign({}, E.T, { speed: 0 });
  let fired = false; for (let i = 0; i < 200 && !E.dead; i++) { update(.05); fired = fired || pdBolts.length > 0; }
  return n === CARRIER_PD.base && K.pd.length === CARRIER_PD.mounts.length && fired && E.dead;
})()`));
await key('KeyP'); await click('menuBtn');

await click('campaignBtn'); check('campaign opens the command center', await visible('command')
  && await page.evaluate(() => ccList.children.length === CC_STATIONS.length));
check('the command center draws HALCYON behind it', await page.waitForFunction(() => stageCur.name === 'command', null, { timeout: 5000 }).then(() => true, () => false));
await page.evaluate(() => document.getElementById('ccRow_fleet').dispatchEvent(new MouseEvent('mouseenter')));
check('hovering a station previews it', await page.evaluate(() => ccName.textContent === 'HALCYON GROUP' && ccBody.querySelectorAll('.ccunit').length === 5 && ccAction.disabled));
check('stations without a screen hide the panel button', await page.evaluate(() => { selectStation('log');
  return ccName.textContent === 'OPS RECORD' && ccAction.style.display === 'none'; }));
check('the fleet upgrades subtab buys a wing upgrade, spends credits, saves, and applies it', await page.evaluate(() => {
  PROG.credits = 1000; document.getElementById('ccRow_fleet').click(); ccBody.querySelector('.cctab[data-tab="upgrades"]').click();
  const b = ccBody.querySelector('.ccbuy[data-up="wingHull"]'); const hp0 = wingHullMax(); b.click();
  return PROG.credits === 600 && fleetLevel('wingHull') === 1 && wingHullMax() > hp0 && JSON.parse(localStorage.getItem(PROG_KEY)).fleetUp.wingHull === 1;
}));
await page.evaluate(() => { PROG.credits = 0; PROG.fleetUp = {}; saveProg(); ccFleetTab = 'status'; renderCommand(); });
await page.evaluate(() => document.getElementById('ccRow_hangar').click()); await click('ccAction');
check('the hangar opens from command and backs out to it', await visible('hangar') && (await click('hgBack'), await visible('command')));
await page.evaluate(() => document.getElementById('ccRow_ops').click()); await click('ccAction');
check('mission select opens', await visible('missionSelect'));
await page.evaluate(() => document.querySelector('#msList .hgrow').click()); await click('msAction');
check('briefing opens', await visible('briefing'));
await click('bfLaunch'); await fly(1000);
check('mission launches', await page.evaluate(() => S.mode === 'play' && S.mission && S.mission.id === 'm1'));
await page.evaluate(() => endGame(false, 'smoke test'));
check('debrief opens', await visible('debrief'));
check('a campaign debrief writes the fleet record', await page.evaluate(() => {
  S.mission = missionById('m2'); startGame('arena'); hitWingman(wingmen[0], 999); endGame(false, 'smoke test');
  const P = PROG.fleet.pilots; return P.PIKE.downs === 1 && P.PIKE.last === 'down' && P.LARK.sorties === 1 && P.LARK.last === 'home';
}));
await page.evaluate(() => [...dbBtns.children].find(b => b.textContent === 'Command').click());
check('debrief returns to the command center', await visible('command'));
await page.evaluate(() => { delete PROG.completed.m10; renderCommand(); });
await click('ccStart'); check('Next op opens its briefing', await visible('briefing') && await page.evaluate(() => S.briefM.id === 'm10'));
await click('bfBack'); check('and its Back returns to command', await visible('command'));
await page.evaluate(() => document.getElementById('ccRow_ops').click()); await click('ccAction'); await click('msBack');
check('sortie board backs out to command', await visible('command'));
await page.evaluate(() => { PROG.completed.m10 = { score: 1, time: 60, bonuses: 0 }; saveProg(); });
await click('ccBack');

await click('schoolBtn'); check('flight school lists the lessons', await visible('school') && await page.evaluate(() => scList.children.length === SCHOOL_LESSONS.length));
await page.evaluate(() => schoolLaunch('speed')); await fly(500);
check('flight school runs in its own harmless range', await page.evaluate(() => {
  damage(999, 'test');
  return S.mode === 'play' && S.school === 'speed' && tutActive() && schoolEnv.visible && !arenaSky.visible && !arenaEnv.children[1].visible
    && arenaSdf(ship.position, 50) > 1e8 && S.hull === 100;
}));
check('a gate drill grades by time and speed', await page.evaluate(() => {
  SCH.ready = 0;
  for (const G of SCH.gates) { ship.position.copy(G.mesh.position); S.vel.set(0, 0, G.g.spd === 'fast' ? -250 : -40); schoolUpdate(.02); schoolUpdate(.02); }
  return SCH.pen === 0 && SCH.result === 'A' && PROG.school.speed.grade === 'A';
}));
await page.evaluate(() => schoolExit()); check('lessons return to the school screen', await visible('school'));
await page.evaluate(() => schoolLaunch('moving')); await fly(300);
check('a gunnery drill ends when the drones are down', await page.evaluate(() => {
  SCH.ready = 0; const n = fighters.filter(f => f.drone).length;
  fighters.filter(f => f.drone).forEach(f => hitEnemy(f, 99)); schoolUpdate(.02);
  return n === SCH.L.drones.length && SCH.result === 'A';
}));
await page.evaluate(() => schoolExit());
await page.evaluate(() => schoolLaunch('evade')); await fly(300);
check('the evasion drill launches missiles and grades by hits', await page.evaluate(() => {
  SCH.ready = 0; let launched = 0;
  for (let i = 0; i < 900 && !SCH.result; i++) { schoolUpdate(.1); launched = Math.max(launched, SCH.wave); if (SCH.wave === 1 && eMsls.length) { damage(16, 'test'); } eMsls.forEach(e => scene.remove(e.m)); eMsls.length = 0; }
  return launched === SCH.L.waves && SCH.hits === 1 && SCH.result === 'B';
}));
await page.evaluate(() => schoolExit());
await page.evaluate(() => schoolLaunch('exam')); await fly(300);
check('the check ride chains gates into drones', await page.evaluate(() => {
  SCH.ready = 0;
  for (const G of SCH.gates) { ship.position.copy(G.mesh.position); S.vel.set(0, 0, G.g.spd === 'fast' ? -250 : -40); schoolUpdate(.02); schoolUpdate(.02); }
  const midway = SCH.dr && !SCH.result && fighters.filter(f => f.drone).length === SCH.L.drones.length;
  fighters.filter(f => f.drone).forEach(f => hitEnemy(f, 99)); schoolUpdate(.02);
  return midway && SCH.result === 'A' && PROG.school.exam.grade === 'A';
}));
await page.evaluate(() => schoolExit());
await page.evaluate(() => schoolLaunch('tour')); await fly(300);
check('the controls tour runs and returns', await page.evaluate(() => { const ok = tutActive() && !!TUT; tutFinish(); return ok && S.mode === 'menu' && PROG.school.tour; }));
await click('scBack'); check('school backs out to the title', await visible('menu'));

await click('settingsBtn'); check('settings opens from menu', await visible('settings'));
await page.evaluate(() => { setSens.value = 1.5; setSens.oninput(); setQuality.value = 'low'; setQuality.onchange(); });
check('settings apply', await page.evaluate(() => SETTINGS.sens === 1.5 && !bloomOn()));
await click('setBack');
check('settings save', await page.evaluate(() => JSON.parse(localStorage.getItem('neonTrench.settings')).quality === 'low'));
await click('arenaBtn'); await fly(500); await key('KeyP'); await click('menuBtn');   // fly a moment without bloom
check('no-bloom render keeps running', await page.evaluate(() => S.sector === 'arena'));
await page.evaluate(() => { setQuality.value = 'high'; setQuality.onchange(); });
check('campaign missions set wingmen and cruiser per mission', await page.evaluate(() => {
  const out = [], ev = SETTINGS.capEvents;
  SETTINGS.capEvents = 'off';   // otherwise m2 and m5 may roll a random capital ship event
  for (const id of ['m2', 'm5', 'm6', 'm7']) {
    S.school = false; S.mission = missionById(id); startGame('arena');
    out.push(id + ':' + wingmen.length + ':' + S.capMode);
  }
  SETTINGS.capEvents = ev;
  S.mission = null; S.mode = 'menu';
  return out.join(' ') === 'm2:2:false m5:0:false m6:2:cruiser m7:0:cruiser';
}));
check('losing the carrier fails the defence mission', await page.evaluate(() => {
  S.school = false; S.mission = missionById('m8'); startGame('arena');
  const K = carrierShip(), setup = !!K && S.capMode === 'frigate' && wingmen.length === 2;
  S.hull = 1e9; hitCarrier(K, 1e6, K.g.position);
  for (let i = 0; i < 80 && S.mode === 'play'; i++) updateWorld({ dt: .05, arena: true, p: ship.position });
  const failed = S.mode === 'dead';
  S.mission = null; S.mode = 'menu';
  return setup && failed;
}));
check('a fleet battle lines HALCYON and SOLACE up against MAW and VESPER, and the broadsides land', await page.evaluate(() => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); S.hull = 1e9;
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  const K = carrierShip(), E = capitals.find(C => C.kind === 'escort');
  const setup = S.fleet && S.capMode === 'fleet' && !!K && !!E && K.hp === FLEET.carrierHp && E.batteries.length === 4 && wingmen.length === 2;
  ship.position.set(0, 300, 0);   // out of the crossfire
  tick(320);
  const foes = capitals.filter(C => !C.friendly);
  const lined = foes.length === 2 && foes.every(C => C.state === 'fight' && C.systems.length === 3 && C.shield.visible && C.hp > C.T.hp * .9)
    && capTargets.filter(t => t.sys).length === 6 && S.capSpawned && /SHIELD/.test(capHud.textContent) && /SOLACE/.test(capHud.textContent);
  tick(200);
  const traded = fleetShells.length > 0 || foes.some(C => C.hp < C.T.hp) || K.hp < K.T.hp || E.hp < E.T.hp;
  return setup && lined && traded;
}));
check('subsystems drop the shield, stop the engines and blind the bridge; hulls and reactors both kill', await page.evaluate(() => {
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  const [maw, ves] = [capitals.find(C => C.kind === 'cruiser'), capitals.find(C => C.kind === 'frigate')];
  const sys = k => maw.systems.find(t => t.kind === k);
  const hp = maw.hp; fleetHullHit(maw, 100); const soaked = Math.abs(hp - maw.hp - 100 * (1 - FLEET.shieldSoak)) < 1e-6;
  hitEnemy(sys('shieldgen'), 99);
  const dropped = !maw.shield.visible && capTargets.includes(maw.core);
  const hp2 = maw.hp; fleetHullHit(maw, 50); const full = Math.abs(hp2 - maw.hp - 50) < 1e-6;
  hitEnemy(sys('engines'), 99); const at = maw.g.position.clone(); tick(40);
  const stopped = maw.adrift && maw.g.position.distanceTo(at) < 1e-6;
  hitEnemy(sys('bridge'), 99);
  const blind = maw.blind && S.sysDown === 3 && /BRIDGE/.test(capHud.textContent);
  for (let i = 0; i < 10 && !maw.core.dead; i++) hitEnemy(maw.core, 99);
  fleetHullHit(ves, 1e6);
  const vesGone = ves.state === 'dying' && !capTargets.some(t => t.ship === ves);
  tick(400);
  const won = S.capDown && maw.state !== 'fight';
  S.kills = S.arenaTarget; updateWorld({ dt: .05, arena: true, p: ship.position });
  const debrief = S.mode === 'win';
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return soaked && dropped && full && stopped && blind && vesGone && won && debrief;
}));
check('Ambush Lane and Spearhead use their own enemy line, HALCYON hull and no escort', await page.evaluate(() => {
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  S.school = false; S.mission = missionById('m11'); startGame('arena'); S.hull = 1e9; ship.position.set(0, 300, 0);
  tick(400);
  const foes = capitals.filter(C => !C.friendly), K = carrierShip();
  const amb = S.fleet && !capitals.some(C => C.kind === 'escort') && K.hp <= 1300 && K.T.hp === 1300 && S.capSpawned
    && foes.length === 2 && foes.map(C => C.T.name).sort().join() === 'FANG,TALON' && /TALON/.test(S.capName);
  S.mission = missionById('m12'); startGame('arena'); S.hull = 1e9; ship.position.set(0, 300, 0);
  tick(120);
  const G = capitals.find(C => !C.friendly);
  const spear = !!G && G.T.name === 'GORGON' && G.kind === 'cruiser' && G.T.hp === 1100 && G.systems.length === 3 && carrierShip().T.hp === 700 && wingmen.length === 2;
  S.mission = null; S.mode = 'menu';
  return amb && spear;
}));
check('the command bridge slows the battle, frees the mouse, and orders the wing, HALCYON and SOLACE', await page.evaluate(async () => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  const key = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const mark = f => { const i = bdgList.findIndex(f); return i >= 0 ? bdgPool[i] : null; };
  ship.position.set(0, 300, 0); tick(320);   // both enemy capitals in, you out of the crossfire
  const [maw, ves, sol] = ['cruiser', 'frigate', 'escort'].map(k => capitals.find(C => C.kind === k));
  key('KeyB');
  const open = S.bridge && bdgUI.style.display === 'block' && document.body.classList.contains('bridge') && /HALCYON BRIDGE/.test(bdgPanel.textContent);
  frame.rdt = .5; for (let i = 0; i < 6; i++) update(.01);   // the camera swings up over the fight
  const marked = ['e', 'f', 's', 'y'].every(k => bdgList.some(M => M.kind === k));
  const t0 = S.time; await new Promise(r => setTimeout(r, 600)); const slowed = S.mode === 'play' && S.time - t0 > 0 && S.time - t0 < .4;
  // SOLACE: focus its broadsides on MAW's shield generator, then close in
  bdgSelect('c:SOLACE'); const gen = maw.systems.find(E => E.kind === 'shieldgen');
  press(mark(M => M.E === gen));
  const focused = sol.focus === maw && sol.focusSys === gen;
  fleetSalvo(sol, maw); const shell = fleetShells[fleetShells.length - 1];
  const hp = gen.hp, hull = maw.hp; fleetImpact(shell); const sysHit = shell.sys === gen && Math.abs(hp - gen.hp - FLEET.shellDmg.friend * FLEET.sysDmg) < 1e-6 && maw.hp === hull;
  press(bdgPanel.querySelector('[data-o="close"]')); const at = sol.g.position.distanceTo(maw.g.position); tick(40);
  const closing = sol.stance === 'close' && sol.g.position.distanceTo(maw.g.position) < at;
  press(bdgPanel.querySelector('[data-o="free"]')); const freed = !sol.focus && !sol.focusSys;
  // PIKE alone on VESPER, then the wing guarding SOLACE, then number keys
  bdgSelect('w0'); press(mark(M => M.kind === 'e' && M.C === ves));
  const pike = wingmen[0].order === 'focus' && wingmen[0].focus === ves && wingmen[1].order === null && /ATTACK VESPER/.test(wingHud.textContent);
  for (let i = 0; i < 10; i++) update(.05);
  const onVes = wingmen[0].dead || wingmen[0].launch > 0 || !!wingmen[0].tgt && wingmen[0].tgt.ship === ves;
  bdgSelect('wing'); press(mark(M => M.kind === 'f' && M.C === sol));
  const guard = wingmen.filter(w => !w.dead).every(w => w.order === 'defend' && w.guard === sol && wingOrderName(w) === 'DEFEND SOLACE');
  key('Digit3'); const keyed = S.wingOrder === 'free' && wingmen.every(w => w.order === null);
  key('Escape'); const closed = !S.bridge && bdgUI.style.display === 'none' && !document.body.classList.contains('bridge') && S.mode === 'play';
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return open && marked && slowed && focused && sysHit && closing && freed && pike && onVes && guard && keyed && closed;
}));
check('the dreadnought interior run has a solid ceiling, vents that burn, and a reactor that starts an escape', await page.evaluate(() => {
  S.school = false; S.mission = missionById('m9'); startGame('trench');
  const setup = S.interior && S.runLen === INTERIOR_LEN && intSegs[0].visible && !segments[0].visible && intBreach.visible
    && portGroup.position.z === -INTERIOR_LEN && S.capName === INTERIOR_SHIPS.dreadnought.name;
  S.hull = 1e9; ship.position.set(0, INT_CEIL + 10, -500); update(.02);
  const ceiling = ship.position.y <= INT_CEIL - 5;
  spawnVent(ship.position.z - 1); const V = vents[vents.length - 1]; V.t = VENT_ON + .05;
  S.vel.set(0, 0, -150); update(.02);
  const burned = S.ventHits === 1;
  S.hull = 100; S.fired = true; ship.position.set(0, 0, -S.runLen + 300);
  const m = new THREE.Mesh(new THREE.ConeGeometry(.6, 3.4, 8), M.amber); m.position.set(0, 0, -S.runLen + 40); scene.add(m); torpedo = { m, t: 0 };
  for (let i = 0; i < 20 && S.mode === 'play'; i++) update(.05);
  const escaping = S.mode === 'play' && !!S.escape && S.escape.t > ESCAPE_T - 2;   // the core blowing starts the escape, not the debrief
  for (let i = 0; i < 40; i++) update(.05);   // fly a while with collapses spawning
  const collapses = escDebris.length > 0 && intSegs.some(s => s.position.z > ship.position.z + SEG_LEN * 4);
  S.hull = 100; S.escape.t = .02; update(.05);
  const timedOut = S.mode === 'dead';
  startGame('trench'); S.hull = 1e9; S.fired = true; ship.position.set(0, 0, -S.runLen + 300);
  const m2 = new THREE.Mesh(new THREE.ConeGeometry(.6, 3.4, 8), M.amber); m2.position.set(0, 0, -S.runLen + 40); scene.add(m2); torpedo = { m: m2, t: 0 };
  for (let i = 0; i < 20 && !S.escape; i++) update(.05);
  ship.position.set(0, 0, -8); S.vel.set(0, 0, 150); update(.05);
  const won = S.mode === 'win' && PROG.completed.m9;
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return setup && ceiling && burned && escaping && collapses && timedOut && won;
}));
await click('hangarBtn'); check('hangar opens', await visible('hangar'));
check('hangar renders a row per ship', await page.evaluate(() => document.querySelectorAll('#hgList .hgrow').length === SHIPS.length));
await page.evaluate(() => document.querySelectorAll('#hgList .hgrow')[2].click());
check('selecting a hull shows it revolving with its stats', await page.waitForFunction(() =>
  stageCur.name === 'hangar' && hgName.textContent === SHIPS[2].name && STAGE_SETS.hangar.group.children.some(c => c.userData.id === SHIPS[2].id)
  && document.querySelectorAll('#hgStats .hgstat').length > 0, null, { timeout: 5000 }).then(() => true, () => false));
await key('ArrowUp');
check('arrow keys move the hull selection', await page.evaluate(() => hgName.textContent === SHIPS[1].name));
await click('hgBack');
await click('roadmapBtn'); check('roadmap opens from the title', await visible('roadmap') && await page.evaluate(() => document.querySelectorAll('#rmList .rmitem').length > 4));
await key('Escape'); check('Esc backs out of the roadmap', await visible('menu'));

console.log(steps.join('\n'));
await browser.close();
if (errors.length) { console.error('\nErrors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nSmoke test passed.');
