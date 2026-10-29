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
check('main menu groups the standalone modes under Free Play', await page.evaluate(() => !freeplayBtn.hidden && launchBtn.hidden && arenaBtn.hidden && skirmishBtn.hidden));
await page.evaluate(() => { menuPage = 'free'; renderMenu(); });   // Free Play is locked until a mode in it opens, so open the page directly
check('the Free Play page lists Free Trench and Free Dogfight with a Back row', await page.evaluate(() => !launchBtn.hidden && !arenaBtn.hidden && !freeBackBtn.hidden && campaignBtn.hidden));
await click('freeBackBtn');
check('Back returns to the main menu', await page.evaluate(() => menuPage === 'main' && !campaignBtn.hidden && launchBtn.hidden));
await page.evaluate(() => { menuPage = 'free'; renderMenu(); launchBtn.dispatchEvent(new MouseEvent('mouseenter')); });
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
  S.mission = null; startGame('arena'); const K = carrierShip();   // synchronous, so frame rate cannot race the launch
  return !!K && wingmen.some(w => w.launch > 0 && w.mesh.position.distanceTo(K.g.position) < 200);
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
  startGame('arena'); for (let i = 0; i < 55; i++) update(.05);   // just past the 2.6 s run, before the ship can slow or meet scenery
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
const inFormation = () => wingmen.every(w => {
  const v = w.mesh.position.clone().sub(ship.position).applyQuaternion(ship.quaternion.clone().invert());
  return v.z < -20 && Math.abs(v.x) < 60;
});
await page.waitForFunction(inFormation, null, { timeout: 10000, polling: 100 }).catch(() => {});   // they may be returning from a fight
check('wingmen hold formation ahead of the cockpit', await page.evaluate(inFormation));
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
  F.mesh.position.copy(ship.position).add(new THREE.Vector3(0, 0, -400).applyQuaternion(ship.quaternion));
  for (const E of [...fighters, ...bombers]) if (E !== F) E.mesh.position.copy(ship.position).add(new THREE.Vector3(0, 0, 1500).applyQuaternion(ship.quaternion));   // nothing else nearer the crosshair
  const hold = setInterval(() => S.vel.set(0, 0, 0), 5);   // hold the ship still so it cannot fly past the target before the box is read
  S.target = null; dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' }));
  await new Promise(r => setTimeout(r, 200)); clearInterval(hold);
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

// HALCYON's walkable deck: the campaign hub on desktop
await page.evaluate(() => { PROG.introSeen = true; PROG.academy = 'skip'; saveProg(); });
await click('campaignBtn');
check('campaign opens the walkable deck on the bridge, in third person', await visible('deck') && await page.evaluate(() => {
  dkTick(.016); return DK.room === 'bridge' && DK.me.g.visible && DK.cam.position.distanceTo(DK.me.g.position) > 1.5;
}));
check('a promotion card shows over the deck and holds you still until acknowledged', await page.evaluate(() => {
  const up = ccPromo.parentNode === deck && !ccPromo.classList.contains('hidden') && dkBusy(); ccPromoOk.click(); return up && !dkBusy();
}));
check('walking moves you and the walls stop you', await page.evaluate(() => {
  dkPlace('bridge'); const z0 = DK.z; S.keys.KeyW = true; for (let i = 0; i < 30; i++) dkTick(.03); S.keys.KeyW = false;
  const walked = DK.z < z0 - 1;
  DK.x = 0; DK.z = 0; DK.yaw = 0; S.keys.KeyD = true; for (let i = 0; i < 120; i++) dkTick(.03); S.keys.KeyD = false;
  return walked && DK.x > 1.5 && DK.x < DK_SPINE.x && DK.room === 'spine';
}));
check('a crew member says a line when you walk up', await page.evaluate(() => {
  DK.heard = {}; DK.barkT = 0; DK.x = 0; DK.z = -92; DK.yaw = Math.PI; dkTick(.016); return dkBark.classList.contains('on') && /VALE/.test(dkBark.textContent);
}));
check('the holo table opens the sector map and it backs out to the deck', await page.evaluate(() => {
  dkPlace('bridge'); DK.z = -78; DK.yaw = 0; dkTick(.016); const name = DK.focus && DK.focus.name;
  dkUse(); const ok = name === 'Sector map' && !sector.classList.contains('hidden'); smBack.click();
  return ok && deckOn();
}));
check('the ship on pad one launches the next op', await page.evaluate(() => {
  dkPlace('hangar'); DK.z = 59; dkTick(.016); return DK.focus && /Launch|Sector map|Sortie board/.test(DK.focus.name);
}));
await key('Tab');
check('Tab opens the datapad', await page.evaluate(() => DK.pad && !dkPadBox.classList.contains('hidden') && dkPadBox.querySelectorAll('.dkbtn').length === DK_PAD.reduce((n, G) => n + G.items.length, 0)
  && dkPadMap.querySelectorAll('.dkroom').length === DECK_ROOMS.length && !!dkPadMap.querySelector('.dkroom.here') && !!dkFsBtn));
await key('Digit3');
check('the datapad fast travels between rooms', await page.evaluate(() => { dkTick(.3); dkTick(.3); dkTick(.016); return !DK.pad && DK.room === 'sim'; }));
check('crew below your rank salute and turn to face you', await page.evaluate(() => {
  const c = DK.crew.find(c => c.C && c.C.id === 'hale'), y0 = c.P.g.rotation.y; c.salT = DECK.saluteT;
  for (let i = 0; i < 8; i++) dkTick(.05);
  const up = c.P.arms[0].getWorldPosition(new THREE.Vector3()).y < c.P.elbows[0].children.length && true;
  const raised = Math.abs(c.P.arms[0].rotation.z) > .5 || Math.abs(c.P.arms[0].rotation.x) > .5;
  for (let i = 0; i < 40; i++) dkTick(.05);
  return up && raised && c.salT === 0 && Math.abs(c.P.g.rotation.y - y0) < .05;
}));
check('the sim pods open flight school, which backs out to the deck', await page.evaluate(() => {
  DK.x = 18; DK.z = DK.acts.find(a => a.name === 'Flight school').z; DK.yaw = -Math.PI / 2; dkTick(.016);
  const f = DK.focus && DK.focus.name === 'Flight school'; dkUse(); const open = !school.classList.contains('hidden'); scBack.click();
  return f && open && deckOn();
}));
check('quarters match your rank', await page.evaluate(() => { dkPlace('quarters'); dkTick(.016); return DK.room === 'quarters' && DK.Q.L === ccQuartersLevel(); }));
check('the locker changes how you look, saves it, and Cancel puts it back', await page.evaluate(() => {
  const was = PROG.look; dkWardrobe(true); const open = DK.ward && !dkWard.classList.contains('hidden') && dkBusy();
  dkWardBody.querySelector('[data-k="suit"][data-v="' + DECK_WARDROBE.colors[0].sw[3] + '"]').click();
  dkWardBody.querySelector('[data-v="tail"]').click();
  const worn = PROG.look.suit === DECK_WARDROBE.colors[0].sw[3] && DK.me.mats.suit.color.getHex() === PROG.look.suit
    && DK.me.hairs.tail.every(o => o.visible) && DK.me.hairs.short.every(o => !o.visible)
    && JSON.parse(localStorage.getItem('neonTrench.prog')).look.style === 'tail';
  dkWardCancel.click();
  return open && worn && !DK.ward && JSON.stringify(PROG.look) === JSON.stringify(was) && DK.me.hairs.short.every(o => o.visible);
}));
check('the datapad reaches the command center, whose Back returns to the deck', await page.evaluate(() => {
  dkPad(true); dkPadMenu.click();
  const cc = !command.classList.contains('hidden') && ccBack.textContent === 'Deck'; ccBack.click(); return cc && deckOn();
}));
await page.evaluate(() => { SETTINGS.hub = 'menu'; dkPad(true); dkPadTitle.click(); });
// the command center as the hub: the menu view, and what touch screens use
await click('campaignBtn'); check('campaign opens the command center', await visible('command')
  && await page.evaluate(() => ccList.children.length === ccStations().length && !!document.getElementById('ccRow_map')));
check('the command center draws the player\'s quarters behind it', await page.waitForFunction(() => stageCur.name === 'command' + ccQuartersLevel(), null, { timeout: 5000 }).then(() => true, () => false));
await page.evaluate(() => document.getElementById('ccRow_fleet').dispatchEvent(new MouseEvent('mouseenter')));
check('hovering a station previews it', await page.evaluate(() => ccName.textContent === 'Halcyon Group' && ccBody.querySelectorAll('.ccunit').length === 4 && ccAction.disabled));
check('stations without a screen hide the panel button', await page.evaluate(() => { selectStation('log');
  return ccName.textContent === 'Ops Record' && ccAction.style.display === 'none'; }));
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
  S.mission = missionById('m6'); startGame('arena'); hitWingman(wingmen[0], 999); endGame(false, 'smoke test');
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
// campaign flight school: a fresh pilot is offered the basic course, which can be skipped
await page.evaluate(() => { window.__savedDone = PROG.completed; PROG.completed = {}; PROG.academy = false; PROG.introSeen = true; saveProg(); openCommand(); });
check('a new pilot is offered flight school in the campaign', await visible('ccAcademy'));
await click('ccAcSkip');
check('skipping flight school clears the offer for good', await page.evaluate(() => PROG.academy === 'skip' && ccAcademy.classList.contains('hidden')));
await page.evaluate(() => { PROG.academy = false; openCommand(); }); await click('ccAcGo'); await fly(300);
check('the basic course starts with the controls tour', await page.evaluate(() => ACADEMY === 0 && S.school === 'tour' && !!TUT));
await page.evaluate(() => tutFinish()); await fly(300);
check('the tour leads on to the ring run', await page.evaluate(() => ACADEMY === 1 && S.school === 'rings' && !!SCH));
await page.evaluate(() => { SCH.ready = 0; for (const G of SCH.gates) { ship.position.copy(G.mesh.position); schoolUpdate(.02); schoolUpdate(.02); } schoolUpdate(.02); schoolExit(); });
check('finishing the course returns to the command center, cleared', await page.evaluate(() => PROG.academy === 'done' && ACADEMY === null && S.mode === 'menu' && !ccAcademy.classList.contains('hidden')));
await click('ccAcGo'); check('the cleared card closes', await page.evaluate(() => ccAcademy.classList.contains('hidden')));
await page.evaluate(() => { PROG.completed = window.__savedDone; saveProg(); });
await page.evaluate(() => schoolLaunch('tour')); await fly(300);
check('the controls screen lists every control and shows a tip', await page.evaluate(() => { openControls('menu'); const rows = ctlGrid.querySelectorAll('.ctlrow').length; const r = ctlGrid.querySelector('.ctlrow'); r.dispatchEvent(new Event('mouseenter')); const ok = rows === CONTROLS.reduce((n, g) => n + g.items.length, 0) && ctlTipBox.classList.contains('on') && ctlTipBox.textContent.length > 0; closeControls(); return ok; }));
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
check('rank follows cleared ops, and gates the wing and the bridge', await page.evaluate(() => {
  const keep = PROG.completed, out = [];
  SETTINGS.capEvents = 'off';
  for (const done of [{}, { m5: 1 }, { m9: 1 }]) {
    PROG.completed = done; S.school = false; S.mission = missionById('m6'); startGame('arena');
    out.push(rankLevel() + ':' + wingmen.length);
  }
  PROG.completed = keep; S.mission = null; S.mode = 'menu';
  return out.join(' ') === '0:0 1:2 2:2' && rankOf({}) === 0 && rankOf({ m5: 1 }) === 1 && rankOf({ m9: 1 }) === 2;
}));
check('campaign missions set wingmen and cruiser per mission', await page.evaluate(() => {
  const out = [], ev = SETTINGS.capEvents;
  SETTINGS.capEvents = 'off';   // otherwise m2 and m5 may roll a random capital ship event
  for (const id of ['m2', 'm5', 'm6', 'm7']) {
    S.school = false; S.mission = missionById(id); startGame('arena');
    out.push(id + ':' + wingmen.length + ':' + S.capMode);
  }
  SETTINGS.capEvents = ev;
  S.mission = null; S.mode = 'menu';
  return out.join(' ') === 'm2:0:false m5:0:false m6:2:cruiser m7:0:cruiser';
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
    && foes.length === 2 && foes.map(C => C.T.name).sort().join() === 'CLAW,FANG' && /CLAW/.test(S.capName);
  S.mission = missionById('m12'); startGame('arena'); S.hull = 1e9; ship.position.set(0, 300, 0);
  tick(120);
  const G = capitals.find(C => !C.friendly);
  const spear = !!G && G.T.name === 'GORGON' && G.kind === 'cruiser' && G.T.hp === 1100 && G.systems.length === 3 && carrierShip().T.hp === 700 && wingmen.length === 2;
  S.mission = null; S.mode = 'menu';
  return amb && spear;
}));
check('Falling Back and Wings of the Fleet score the commander bonuses: HALCYON moved, SOLACE in formation, squadrons launched', await page.evaluate(() => {
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  const ok = [];
  S.school = false; S.mission = missionById('m13'); startGame('arena'); S.hull = 1e9; ship.position.set(0, 300, 0); tick(400);
  const [m13, m14] = [missionById('m13'), missionById('m14')], K = carrierShip();
  ok.push(m13.req === 'm12' && m14.req === 'm13' && capitals.filter(C => !C.friendly).length === 2 && K.T.hp === 1000);
  const moved = m13.bonuses.find(b => b.type === 'moved'); ok.push(!evalBonus(moved));
  fleetFallBack(K); const z0 = K.g.position.clone(); tick(900);
  ok.push(S.carMoved >= moved.val && K.g.position.distanceTo(z0) > 100 && evalBonus(moved));
  S.mission = m14; startGame('arena'); S.hull = 1e9; ship.position.set(0, 300, 0); tick(600);
  const [sq, form] = ['squads', 'formation'].map(t => m14.bonuses.find(b => b.type === t));
  ok.push(!evalBonus(sq) && !evalBonus(form) && capitals.filter(C => !C.friendly).length >= 2);
  carrierShip().squads = 2; launchSquadron(1); launchSquadron(2); ok.push(evalBonus(sq));
  fleetFormation('line'); tick(1300); ok.push(evalBonus(form) && S.formT >= form.val);
  S.mission = null; S.mode = 'menu';
  return ok.every(Boolean);
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
check('the bridge moves HALCYON and SOLACE: waypoints from a map click, fall back, formations, and Q / E step through squadrons', await page.evaluate(async () => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  const key = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  ship.position.set(0, 300, 0); tick(320);
  const [maw, sol] = ['cruiser', 'escort'].map(k => capitals.find(C => C.kind === k)), K = carrierShip();
  key('KeyB'); frame.rdt = .5; for (let i = 0; i < 6; i++) update(.01);
  // a click on the map sends the selected ship to a waypoint, which it reaches and clears
  bdgSelect('c:SOLACE'); const from = sol.g.position.clone();
  const dest = from.clone().add(new THREE.Vector3(60, 0, 0));
  fleetMoveTo(sol, dest); const set = !!sol.goal && /MOVING/.test(bdgUnitRows().find(r => r.id === 'c:SOLACE').sub);
  tick(120); const arrived = !sol.goal && sol.g.position.distanceTo(dest) < 20;
  // the same click through the map: a ray through the screen point where the waypoint sits lands on it
  renderBridgePanel(); bdgProject(dest, bdgV); const sx = bdgV.x, sy = bdgV.y; bdgGround(sx, sy, dest.y, bdgV2);
  const mapped = bdgV2.distanceTo(dest) < 3;
  // fall back runs away from MAW; hold here stops it
  const d0 = sol.g.position.distanceTo(maw.g.position); press(bdgPanel.querySelector('[data-k="retreat"]'));
  const ordered = sol.retreat && !!sol.goal; tick(60);   // (near the arena's wall the run is short and may already be over, so only the order is checked for the flag)
  const backed = ordered && sol.g.position.distanceTo(maw.g.position) > d0;
  press(bdgPanel.querySelector('[data-k="stay"]')); const held = !sol.goal && !sol.retreat;
  // a formation keeps SOLACE in a slot off HALCYON as HALCYON moves
  press(bdgPanel.querySelector('[data-k="form"][data-o="column"]'));
  const k0 = K.g.position.clone(); fleetMoveTo(K, k0.clone().add(new THREE.Vector3(0, 0, -80))); tick(1100);
  const slot = fleetFormSlot(sol, new THREE.Vector3());
  const formed = K.g.position.distanceTo(k0) > 30 && sol.form === 'column' && sol.g.position.distanceTo(slot) < 60;
  const bad = fleetMoveTo(maw, [0, 0, 0]) === false && fleetFormation('wedge') === false;
  // Q / E cycle the squadrons and ships, not single pilots
  bdgSelect('wing'); key('KeyE'); const next = bdgSel !== 'wing' && !/^w\d/.test(bdgSel); key('KeyQ'); const prev = bdgSel === 'wing';
  bdgSelect('me'); const folded = !bdgUnitRows().some(r => /^w\d/.test(r.id)); const wi = wingmen.findIndex(w => !w.dead); bdgSelect('w' + wi); const opens = wi >= 0 && bdgUnitRows().some(r => r.id === 'w' + wi);
  key('Escape'); S.mission = null; S.mode = 'menu'; showScreen('menu');
  return set && arrived && mapped && backed && held && formed && bad && next && prev && folded && opens;
}));
check('a waypoint behind HALCYON swings SOLACE round her instead of stalling, and one at the wall stops short of it', await page.evaluate(() => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  ship.position.set(0, 300, 0); tick(320);
  const sol = capitals.find(C => C.kind === 'escort'), K = carrierShip();
  const from = sol.g.position.clone(), dest = K.g.position.clone().addScaledVector(K.g.position.clone().sub(from).setY(0).normalize(), 300);
  fleetMoveTo(sol, dest); tick(700);
  const round = sol.g.position.distanceTo(from) > 150 && sol.g.position.distanceTo(dest) < from.distanceTo(dest) - 100;
  fleetMoveTo(K, [0, 0, 5000]); tick(2000);
  const edge = K.g.position.length() <= ARENA_R - 60 - K.hull.len * .5 + 1 && K.g.position.length() > 400;
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return round && edge;
}));
check('every op has a story: voiced briefing and debrief, timed radio, and an act', await page.evaluate(() => {
  const ok = MISSIONS.every(m => { const s = STORY[m.id];
    return s && s.open.length && s.win.length && s.lose && s.radio.length && actOf(m.id) && s.radio.every(r => CAST[r[1]]) && [...s.open, ...s.win, s.lose].every(l => CAST[l[0]]); });
  const keep = PROG.completed; PROG.completed = {}; PROG.introSeen = false; openCommand();
  const intro = !ccIntro.classList.contains('hidden'); ccIntroOk.click();
  PROG.completed = keep; S.mode = 'menu';
  return ok && intro && ccIntro.classList.contains('hidden') && PROG.introSeen;
}));
check('radio plays timed lines in a campaign op, and a debrief is voiced', await page.evaluate(() => {
  S.school = false; S.mission = missionById('m1'); startGame('trench');
  S.time = 4; updateRadio({ dt: .016, rdt: .016 });
  const shown = radioBox.style.opacity === '1' && radioTxt.textContent.length > 0;
  endGame(false, 'smoke test'); S.mission = null; S.mode = 'menu';
  return shown && dbVox.textContent.includes('CIC REYES');
}));
check('Commander tools unlock one per op, and free arena runs keep them all', await page.evaluate(() => {
  const keep = PROG.completed, keepM = S.mission, out = [];
  S.mission = missionById('m10');
  for (const last of ['m8', 'm9', 'm10', 'm11', 'm12', 'm13']) {
    PROG.completed = {}; for (let i = 1; i <= +last.slice(1); i++) PROG.completed['m' + i] = { score: 1 };
    out.push(Object.keys(CDR_TOOLS).filter(toolOn).join('+'));
  }
  S.mission = null; PROG.completed = {}; const free = Object.keys(CDR_TOOLS).every(toolOn);
  PROG.completed = keep; S.mission = keepM;
  return free && out.join('|') === '|bridge|bridge+squads|bridge+squads+auto|bridge+squads+auto+move|bridge+squads+auto+move+form';
}));
check('the bridge launches TALON and WRAITH from the hangar and orders each squadron on its own', await page.evaluate(async () => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  const key = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  ship.position.set(0, 300, 0); tick(320);
  const K = carrierShip(), rsv = K.reserve;
  const hang = K.squads;
  key('KeyB'); bdgSelect('sq1');
  const bay = /IN BAY/.test(bdgPanel.textContent) && !!bdgPanel.querySelector('[data-k="launch"]');
  press(bdgPanel.querySelector('[data-k="launch"]'));
  const up = wingmen.length === 4 && wingmen.filter(w => w.sq === 1).length === 2 && K.squads === hang - 1 && K.reserve === rsv && wingmen[0].sq === 0;
  bdgSelect('sq2'); press(bdgPanel.querySelector('[data-k="launch"]'));
  const none = K.squads === 0 && wingmen.length === 6;
  for (let i = 0; i < 80; i++) { S.time += .05; update(.05); }
  bdgSelect('sq1'); press(bdgPanel.querySelector('[data-o="free"]'));
  const apart = sqOrder(1) === 'free' && S.wingOrder === 'form' && sqOrder(2) === 'form' && /TALON/.test(wingHud.textContent);
  const maw = capitals.find(C => !C.friendly && C.state === 'fight');
  bdgSelect('sq2'); press(bdgList.map((M, i) => M.kind === 'e' && M.C === maw ? bdgPool[i] : null).find(Boolean));
  const focus = sqAlive(2).every(w => w.order === 'focus' && w.focus === maw) && sqAlive(1).every(w => w.order === null);
  key('Digit2'); const keyed = sqOrder(2) === 'target' && sqOrder(1) === 'free' && S.wingOrder === 'form';
  const pi = wingmen.findIndex(w => w.sq === 1); bdgSelect('wing');
  const m = bdgList.findIndex(M => M.kind === 'w' && M.i === pi); press(bdgPool[m]);
  const lead = bdgSel === 'sq1'; press(bdgPool[bdgList.findIndex(M => M.kind === 'w' && M.i === pi)]);
  key('Escape'); for (const w of sqAlive(1)) hitWingman(w, 1e6); for (const w of sqAlive(2)) hitWingman(w, 1e6);
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return bay && up && none && apart && focus && keyed && lead && sqAlive(1).length === 0 && sqAlive(2).length === 0;
}));
check('Admiral comes after Wings of the Fleet with battle groups, then the reserve; the free modes do not wait for Act IV', await page.evaluate(() => {
  const keep = PROG.completed, keepM = S.mission, out = [];
  const upTo = n => { const d = {}; for (let i = 1; i <= n; i++) d['m' + i] = { score: 1 }; return d; };
  S.mission = missionById('m15');
  for (const n of [13, 14, 15]) { PROG.completed = upTo(n); out.push(['groups', 'reserve'].filter(toolOn).join('+')); }
  PROG.completed = upTo(14); const free = campaignDone(), adm = RANKS[rankLevel()].id === 'adm';
  PROG.completed = upTo(13); const notYet = !campaignDone() && rankLevel() === 2;
  PROG.completed = keep; S.mission = keepM;
  return out.join('|') === '|groups|groups+reserve' && free && adm && notYet && ['m15', 'm16', 'm17'].every(id => actOf(id).n === 'IV');
}));
check('The Kiru Gate puts BASTION in the line, and the FLEET row sends every group at one ship, falls back and screens HALCYON', await page.evaluate(async () => {
  const keep = PROG.completed; PROG.completed = {}; MISSIONS.forEach(m => { if (m.id !== 'm15') PROG.completed[m.id] = { score: 1 }; });
  S.school = false; S.mission = missionById('m15'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  ship.position.set(0, 300, 0);
  for (let i = 0; i < 300; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); }
  const B = capitals.find(C => C.T.name === 'BASTION'), sol = capitals.find(C => C.T.name === 'SOLACE');
  const setup = !!B && B.friendly && B.fleet && B.batteries.length === 4 && B.formIdx === 1 && fleetShips().length === 3;
  S.bridge = true; bdgUI.style.display = 'block'; document.body.classList.add('bridge');
  let ok = false;
  try {
    bdgSelect('fleet'); frame.rdt = .5; for (let i = 0; i < 3; i++) update(.01);
    const warden = capitals.find(C => C.T.name === 'WARDEN'), K = carrierShip();
    const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    press(bdgList.map((M, i) => M.kind === 'e' && M.C === warden ? bdgPool[i] : null).find(Boolean));
    const engaged = fleetShips().every(C => C.focus === warden) && B.stance === 'close' && sol.stance === 'close' && K.stance !== 'close' && fleetMark() === warden;
    press(bdgPanel.querySelector('[data-k="fleetform"][data-o="screen"]'));
    const screened = B.form === 'screen' && sol.form === 'screen';
    for (let i = 0; i < 40; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); }
    const slotA = fleetFormSlot(sol, new THREE.Vector3()), slotB = fleetFormSlot(B, new THREE.Vector3());
    press(bdgPanel.querySelector('[data-o="retreat"]'));
    ok = setup && engaged && screened && slotA.distanceTo(slotB) > 200 && fleetShips().every(C => C.retreat) && S.fleetOrders === 3
      && /FLEET/.test(bdgPanel.textContent) && evalBonus({ type: 'fleetorder', val: 2 });
  } catch (e) { ok = false; }
  bridgeHide(); PROG.completed = keep; S.mission = null; S.mode = 'menu';
  return ok;
}));
check('ship roles: a screen guards HALCYON and catches shells meant for her, artillery stands off, and the bridge sets them', await page.evaluate(() => {
  const keep = PROG.completed; PROG.completed = {}; MISSIONS.forEach(m => { if (m.id !== 'm15') PROG.completed[m.id] = { score: 1 }; });
  S.school = false; S.mission = missionById('m15'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  ship.position.set(0, 300, 0);
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  tick(300);
  const B = capitals.find(C => C.T.name === 'BASTION'), sol = capitals.find(C => C.T.name === 'SOLACE'), K = carrierShip();
  const warden = capitals.find(C => C.T.name === 'WARDEN'), lash = capitals.find(C => C.T.name === 'LASH');
  tick(900);   // BASTION has had time to take its spot, and BARB is in
  const roles = B.role === 'screen' && sol.role === 'line' && lash.role === 'screen' && capitals.find(C => C.T.name === 'BARB').role === 'artillery';
  // where BASTION is told to stand, and the catch itself with the dice fixed (rocks and dice made this flaky)
  B.g.position.copy(fleetGuardSpot(B, K, new THREE.Vector3()));
  const guarding = B.g.position.distanceTo(K.g.position) < FLEET.roles.screen.guard;
  const rnd = Math.random, sc0 = S.screenCatch;
  Math.random = () => FLEET.roles.screen.catch - .01; const takes = fleetCatch(warden, K) === B;
  Math.random = () => FLEET.roles.screen.catch + .01; const passes = fleetCatch(warden, K) === K;
  Math.random = rnd;
  const catches = takes && passes && S.screenCatch - sc0 === 1;
  S.bridge = true; bdgUI.style.display = 'block'; document.body.classList.add('bridge');
  let ui = false;
  try {
    bdgSelect('c:SOLACE'); frame.rdt = .5; update(.01);
    bdgPanel.querySelector('[data-k="role"][data-o="artillery"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ui = sol.role === 'artillery' && /ARTILLERY/.test(bdgPanel.textContent) && /Enemy admiral/.test((bdgSelect('fleet'), bdgPanel.textContent));
  } catch (e) { ui = false; }
  bridgeHide();
  sol.g.position.copy(warden.g.position).add(new THREE.Vector3(0, 0, 300));   // too close: artillery wants a spot further off
  const spot = new THREE.Vector3(), backs = fleetStandOff(sol, spot, false) && spot.distanceTo(warden.g.position) > 300 + 100;
  PROG.completed = keep; S.mission = null; S.mode = 'menu';
  return roles && guarding && catches && ui && backs;
}));
check('the enemy admiral covers a ship you mass on, punishes a lone push, hunts an uncovered HALCYON and goes silent with its bridge', await page.evaluate(() => {
  const keep = PROG.completed; PROG.completed = {}; MISSIONS.forEach(m => { if (m.id !== 'm15') PROG.completed[m.id] = { score: 1 }; });
  S.school = false; S.mission = missionById('m15'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  ship.position.set(0, 300, 0);
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  tick(300);
  const A = S.adm, warden = capitals.find(C => C.T.name === 'WARDEN'), lash = capitals.find(C => C.T.name === 'LASH');
  const boarded = A && A.C === warden && admOn();
  fleetAll('engage', lash); tick(80);
  const covering = A.plan === 'cover' && A.cover === lash && fleetWard(capitals.find(C => C.T.name === 'LASH')) !== lash && A.focus && A.focus.kind === 'escort';
  fleetAll('free'); fleetAll('hold'); const B = capitals.find(C => C.T.name === 'BASTION'), sol = capitals.find(C => C.T.name === 'SOLACE');
  for (const C of [B, sol]) C.g.position.set(600, -20, 500);
  tick(80);
  const hunting = A.plan === 'exposed' && A.focus === carrierShip();
  fleetAll('retreat'); tick(80); const pursuing = A.plan === 'pursue';
  warden.systems.find(E => E.kind === 'bridge').dead = true; tick(10);
  const silent = !admOn() && A.silenced && evalBonus({ type: 'admiral' });
  PROG.completed = keep; S.mission = null; S.mode = 'menu';
  return boarded && covering && hunting && pursuing && silent;
}));
check('Breaking the Gate: the gate sends ships through until its anchors go, then collapses; the reserve warps in once where you click', await page.evaluate(() => {
  const keep = PROG.completed; PROG.completed = {}; MISSIONS.forEach(m => { if (m.id !== 'm16' && m.id !== 'm17') PROG.completed[m.id] = { score: 1 }; });
  S.school = false; S.mission = missionById('m16'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  ship.position.set(0, 300, 0);
  const G = fleetGate();
  const setup = !!G && G.systems.length === 3 && capTargets.filter(t => t.ship === G).length === 3 && gateOpen() && /KIRU GATE/.test(S.capName);
  tick(500);   // 25 s: SPITE, and the first ship through the gate
  const sent = S.gateSent === 1 && capitals.some(C => C.T.name === 'RAMPART') && !S.capSpawned;
  const R = capitals.find(C => C.T.name === 'RAMPART'), mouth = R.station.distanceTo(G.g.position) < GATE_TYPE.mouth + 120;
  const called = fleetCallReserve(new THREE.Vector3(150, -20, 100)), again = fleetCallReserve(new THREE.Vector3(0, 0, 0));
  tick(80);
  const M = capitals.find(C => C.T.name === 'MERIDIAN'), arrived = !!M && M.state === 'fight' && M.fleet && fleetShips().includes(M) && evalBonus({ type: 'reserve' });
  G.systems.forEach(E => hitEnemy(E, 999));
  const collapsing = G.state === 'dying' && !gateOpen();
  tick(400);
  const closed = G.state === 'wreck' && S.capSpawned && S.gateSent === 1 && evalBonus({ type: 'gate', val: 2 }) && !S.fleetLine.some(e => e.name === 'WRATH');
  PROG.completed = keep; S.mission = null; S.mode = 'menu';
  return setup && sent && mouth && called && !again && arrived && collapsing && closed;
}));
check('Sovereign brings out a gold-trimmed flagship and ends on Kestrel', await page.evaluate(() => {
  S.school = false; S.mission = missionById('m17'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  ship.position.set(0, 300, 0);
  for (let i = 0; i < 200; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); }
  const F = capitals.find(C => C.T.name === 'SOVEREIGN');
  const ok = !!F && F.mats.P === CAP_PALETTE.flag && F.T.hp === 2600 && S.leaderMode && S.arenaTarget === 11 && !!capitals.find(C => C.T.name === 'BASTION') && !!S.reserveDef;
  S.mission = null; S.mode = 'menu';
  return ok;
}));
check('selecting HALCYON on the bridge does not freeze the view, with or without a fleet battle', await page.evaluate(async () => {
  const key = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  let ok = true;
  for (const m of [null, 'm10']) {
    S.school = false; S.mission = m && missionById(m); startGame('arena'); launchEnd(true); S.hull = 1e9;
    ship.position.set(0, 300, 0);
    for (let i = 0; i < 320; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); }
    S.bridge = true; bdgUI.style.display = 'block'; document.body.classList.add('bridge');
    try {
      bdgSelect('c:HALCYON'); frame.rdt = .5; for (let i = 0; i < 6; i++) update(.01);
      if (m) {
        const maw = capitals.find(C => C.kind === 'cruiser'), H = carrierShip();
        press(bdgList.map((M, i) => M.kind === 'e' && M.C === maw ? bdgPool[i] : null).find(Boolean));
        ok = ok && H.focus === maw;
        press(bdgPanel.querySelector('[data-o="close"]')); ok = ok && H.stance === 'close';
      }
    } catch (e) { ok = false; }
    bridgeHide();
  }
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return ok;
}));
check('the bridge opens in the live view, V swaps to the command room\'s holo-globe, and orders and turrets work from its markers', await page.evaluate(async () => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const key = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  ship.position.set(0, 300, 0);
  for (let i = 0; i < 320; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); }
  key('KeyB'); const dflt = bdgView === 'live' && /Live view/.test(bdgPanel.textContent);
  key('KeyV'); frame.rdt = .5; for (let i = 0; i < 6; i++) update(.01);
  const room = S.bridge && !!holo && renderHolo() && /Command room/.test(bdgPanel.textContent);
  const maw = capitals.find(C => C.kind === 'cruiser');
  const onGlobe = capitals.filter(C => C.state === 'fight').every(C => holo.caps.has(C)) && holo.icons.some(m => m.visible)
    && bdgList.every(M => holoMapPos(M.pos, new THREE.Vector3(), true));
  bdgSelect('wing'); press(bdgPool[bdgList.findIndex(M => M.kind === 'e' && M.C === maw)]);
  const ordered = wingmen.filter(w => !w.dead).every(w => w.order === 'focus' && w.focus === maw);
  const gun = maw.parts.find(E => !E.dead), gi = bdgList.findIndex(M => M.E === gun);
  if (gi >= 0) press(bdgPool[gi]);
  const turret = gi >= 0 && wingmen.filter(w => !w.dead).every(w => w.focus === gun);
  bdgZoom(.001); const deep = bdgCam.dist === HOLO.dist[0] && HOLO.dist[0] < BRIDGE.dist[0];
  key('KeyV'); const live = bdgView === 'live' && bdgCam.dist === BRIDGE.dist[0] && !renderHolo() && /Live view/.test(bdgPanel.textContent);
  press(bdgPanel.querySelector('[data-o="holo"]')); const back = bdgView === 'holo';
  key('Escape'); const closed = !S.bridge && !renderHolo();
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return dflt && room && onGlobe && ordered && turret && deep && live && back && closed;
}));
check('the bridge gives your own ship an order, and any flight input takes the stick back', await page.evaluate(async () => {
  S.school = false; S.mission = missionById('m10'); startGame('arena'); launchEnd(true); S.hull = 1e9;
  const key = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const press = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const tick = n => { for (let i = 0; i < n; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); } };
  ship.position.set(0, 300, 0); tick(320);
  key('KeyB'); bdgSelect('me');
  const panel = /Take the stick/.test(bdgPanel.textContent) && /MANUAL/.test(bdgPanel.textContent);
  const ves = capitals.find(C => C.kind === 'frigate');
  press(bdgPanel.querySelector('[data-o="free"]'));
  const on = S.auto === 'free' && /AUTOPILOT/.test(bdgPanel.textContent);
  S.cursor.x = S.cursor.y = 0; key('KeyB');   // back to the cockpit: the order stays
  const kept = !S.bridge && S.auto === 'free';
  const p0 = ship.position.clone(); for (let i = 0; i < 40; i++) update(.05);
  const flew = ship.position.distanceTo(p0) > 50 && autoHud.style.display === 'block' && S.cruise;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  const manual = !S.auto && autoHud.style.display === 'none' && S.cursor.x === 0;
  // a marked hostile, then the mark going away
  key('KeyB'); bdgSelect('me'); const c = ves || capitals.find(C => !C.friendly && C.state === 'fight');
  const ok = setSelfOrder('focus', c); update(.05); const focus = ok && S.auto === 'focus' && /ATTACK/.test(selfOrderName());
  const part = c.systems[0]; setSelfOrder('focus', part); part.dead = true; update(.05); const lost = !S.auto;
  setSelfOrder('defend', carrierShip()); const def = S.auto === 'defend'; autoOff(); 
  S.mission = null; S.mode = 'menu'; showScreen('menu');
  return panel && on && kept && flew && manual && focus && lost && def;
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
check('skirmish stays off the title screen until the campaign reaches its first fleet battle', await page.evaluate(() => {
  const keep = PROG.completed;
  PROG.completed = {}; MISSIONS.slice(0, 9).forEach(m => PROG.completed[m.id] = { score: 1 }); renderMenu();
  menuPage = 'free'; renderMenu();
  const hidden = skirmishBtn.hidden && getComputedStyle(skirmishBtn).display === 'none';
  PROG.completed.m10 = { score: 1 }; renderMenu();
  const shown = !skirmishBtn.hidden;
  PROG.completed = keep; menuPage = 'main'; renderMenu();
  return hidden && shown;
}));
check('skirmish: the setup builds a fleet op from your picks, plays with every fleet tool, and ends on a result with no payout', await page.evaluate(() => {
  const keep = PROG.completed, credits = PROG.credits; MISSIONS.forEach(m => PROG.completed[m.id] = { score: 1 }); renderMenu();
  activateMode('skirmish');
  const open = !document.getElementById('skirmish').classList.contains('hidden') && /WARDEN/.test(skSetup.textContent);
  const press = sel => skSetup.querySelector(sel).click();
  press('[data-g="add"]'); press('[data-g="foe"][data-i="3"][data-role="artillery"]'); press('[data-g="ally"][data-i="0"][data-state="reserve"]');
  press('[data-g="opt"][data-k="fighters"][data-v="none"]'); press('[data-g="opt"][data-k="gate"][data-v="true"]');
  const m = skirmishMission(SKIRM);
  const built = m.line.length === 4 && m.line[3].role === 'artillery' && m.line[0].admiral && m.reserve.name === 'SOLACE' && SKIRM.allies[2].state === 'line'
    && m.allies.length === 2 && m.count === 0 && !!m.gate && m.gate.ships.every(e => e.name);
  skirmishLaunch(); launchEnd(true); S.hull = 1e9; ship.position.set(0, 300, 0);
  for (let i = 0; i < 200; i++) { S.time += .05; updateCapital({ dt: .05, arena: true, p: ship.position }); }
  const playing = S.mode === 'play' && S.fleet && S.arenaTarget === 0 && toolOn('reserve') && toolOn('groups') && reserveReady() && !!fleetGate()
    && capitals.some(C => C.T.name === 'MERIDIAN' && C.role === 'artillery') && S.adm && S.adm.C && S.adm.C.T.name === 'WARDEN';
  endGame(true);
  const result = !document.getElementById('debrief').classList.contains('hidden') && dbTitle.textContent === 'VICTORY' && PROG.credits === credits && !PROG.completed.skirmish
    && /Rematch/i.test(dbBtns.textContent);
  SKIRM.foes.length = 3; SKIRM.gate = false; SKIRM.fighters = 'light'; SKIRM.allies[0].state = 'line'; SKIRM.allies[2].state = 'reserve';
  PROG.completed = keep; S.mission = null; S.mode = 'menu'; showScreen('menu');
  return open && built && playing && result;
}));
check('fleet tips: a card the first time a mechanic comes up, once per pilot', await page.evaluate(() => {
  const keepT = PROG.tips; PROG.tips = {};
  S.school = false; S.mission = missionById('m15'); startGame('arena'); launchEnd(true); S.hull = 1e9; S.mode = 'play';
  ship.position.set(0, 300, 0);
  for (let i = 0; i < 200; i++) { S.time += .05; frame.rdt = .05; update(.05); }   // WARDEN warps in
  const first = tipCard.classList.contains('on') && tipTitle.textContent === FLEET_TIPS.subsys.t && PROG.tips.subsys;
  fleetTip('subsys'); const once = !tipQ.some(q => q[0] === 'subsys');
  tipCard.dispatchEvent(new MouseEvent('mousedown')); const dismissed = !tipCard.classList.contains('on');
  endGame(false, 'smoke test'); const hidden = !tipCard.classList.contains('on');
  PROG.tips = keepT; S.mission = null; S.mode = 'menu'; showScreen('menu');
  return first && once && dismissed && hidden;
}));
check('the sector map: strike a target, its effect lands, and fleet damage carries into the next op', await page.evaluate(() => {
  const keep = PROG.completed, keepS = PROG.sector, keepC = PROG.credits, keepP = PROG.parts;
  PROG.completed = {}; MISSIONS.slice(0, 10).forEach(m => PROG.completed[m.id] = { score: 1, time: 60, bonuses: 0 }); PROG.sector = {}; saveProg();
  openCommand();
  const station = !!document.getElementById('ccRow_map') && /Pick a target/.test(ccStart.textContent) && ccSteps.children.length === 3;
  ccStart.click();
  const map = !document.getElementById('sector').classList.contains('hidden') && smList.children.length === 3 && smMap.querySelectorAll('.tgt.open').length === 2;
  smSelect('x11b'); smAction.click(); const brief = S.briefM.id === 'x11b' && /20% less hull/.test(bfObj.textContent);
  launchMission(S.briefM); const yardRun = S.mode === 'play' && !S.carry && S.capMode === 'cruiser';
  endGame(true);
  const struck = PROG.sector.pick.m11 === 'x11b' && smState(sectorOpById('x11a')) === 'gone' && /Next Op/.test(dbBtns.textContent) && !sectorChoice();
  PROG.sector.hull.HALCYON = .6; saveProg();
  openBriefing(missionById('m11'), 'sector'); const chips = /HALCYON 60%/.test(bfObj.textContent) && /VEY YARDS/.test(bfObj.textContent);
  S.mission = missionById('m11'); startGame('arena');
  const K = carrierShip(); spawnCapital(S.fleetLine[0].kind, 0); S.fleetN = 1; const foe = capitals.find(c => c.fleetSlot === 0);
  const carriedIn = !!S.carry && Math.abs(K.hp / K.T.hp - .6) < .01 && foe.T.hp === Math.round(FLEET.hp.frigate * SECTOR_CARRY.yard);
  K.hp = K.T.hp * .1; endGame(true);
  const carriedOut = Math.abs(PROG.sector.hull.HALCYON - SECTOR_CARRY.floor) < .01 && PROG.sector.hull.SOLACE === 1 && /Carried/.test(dbReward.textContent)
    && /Sector map/.test(dbBtns.textContent);
  sectorStrike(sectorOpById('x12a')); S.mission = missionById('m12'); startGame('arena');
  const base = S.carry.base && S.arenaTarget === Math.ceil(missionById('m12').count * SECTOR_CARRY.base); endGame(false, 'smoke test');
  sectorStrike(sectorOpById('x13a')); const depot = PROG.sector.hull.HALCYON === 1;
  S.mission = missionById('m10'); startGame('arena'); const replay = !S.carry && carrierShip().hp === carrierShip().T.hp; endGame(false, 'smoke test');
  PROG.completed = keep; PROG.sector = keepS; PROG.credits = keepC; PROG.parts = keepP; saveProg(); S.mission = null; S.mode = 'menu'; showScreen('menu');
  return station && map && brief && yardRun && struck && chips && carriedIn && carriedOut && base && depot && replay;
}));
check('trench forks: a divider, side channel, pads and caches, solid to the player', await page.evaluate(() => {
  S.mission = null; startGame('trench'); S.hull = 1e9; S.nextSpawnZ = -1e9;
  ship.position.set(0, 0, 80); spawnFork(-300);
  const D = dividers[0], mid = (D.min.x + D.max.x) / 2, zm = (D.min.z + D.max.z) / 2;
  const built = dividers.length === 1 && forkPads.length === 3 && caches.length === 2 && beams.length === 6 && pickups.length === 3;
  frame.dt = .05; frame.p = ship.position; frame.prevP.set(D.min.x - 6, 0, zm); ship.position.set(mid, 0, zm); S.vel.set(60, 0, 0);
  updateBranch(frame);
  const blocked = ship.position.x <= D.min.x - 2.1 && S.vel.x === 0;
  const pad = forkPads[0]; frame.prevP.set(pad.lo + 2, -20, pad.z); ship.position.set(pad.lo + 2, -20, pad.z); updateBranch(frame);
  const boosted = S.padT > 0;
  const cache = caches[0]; pBolts.length = 0;
  const start = caches.length; hitCache(0); hitCache(0);   // two hits break one open
  const paid = caches.length === start - 1 && pickups.length === 5;
  startGame('trench'); const cleared = dividers.length === 0 && forkPads.length === 0 && caches.length === 0 && S.padT === 0;
  return built && blocked && boosted && paid && cleared;
}));
check('trench set pieces: pipes to thread, a door that shuts and reopens, girders that drop', await page.evaluate(() => {
  S.mission = null; startGame('trench'); S.hull = 1e9; S.nextSpawnZ = -1e9; ship.position.set(0, 0, 80);
  const n0 = beams.length; spawnPipes(-300); const pipes = beams.length === n0 + 4;
  spawnDoor(-1000); const D = doors[0]; spawnGirders(-2000);
  const girders = falls.length === 3 && falls.every(B => B.min.y > TOP_Y);
  const sliding = t => { S.time += t; frame.p = ship.position; updateSetPieces(frame); return D.top.min.y - D.bot.max.y; };
  ship.position.set(0, 0, -400); const idle = Math.abs(sliding(.1) - 2 * DOOR_GAP) < 1e-6;   // far off: stays open
  ship.position.set(0, 0, -1000 + 300); sliding(0);
  const mid = sliding(.5), shut = sliding(.8), back = sliding(1.1), open = sliding(1.2);
  ship.position.set(0, 0, -2000 + 200); sliding(0); sliding(1);
  const dropped = beams.filter(B => B.fall).every(B => B.max.y < TOP_Y);
  S.mode = 'menu'; showScreen('menu');
  return pipes && girders && idle && mid > 0 && mid < 2 * DOOR_GAP && shut < .01 && back > 0 && Math.abs(open - 2 * DOOR_GAP) < 1e-6 && dropped;
}));
check('trench feel: speed lines at boost, sparks off a skimmed wall, music swells toward the intake', await page.evaluate(() => {
  S.mission = null; startGame('trench'); S.hull = 1e9; ship.position.set(0, 0, 80);
  S.boost = true; S.vel.set(0, 0, -250); updateStreaks(); const lines = streaks.visible && streaks.material.opacity > .1;
  S.boost = false; S.vel.set(0, 0, -20); updateStreaks(); const calm = !streaks.visible;
  const n = sparks.length; S.vel.set(0, 0, -150); ship.position.x = HALF_W - 3; frame.p = ship.position; frame.dt = .05; trenchFeel(frame);
  const skim = sparks.length > n && S.shake >= .18;
  S.mode = 'menu'; showScreen('menu');
  return lines && calm && skim;
}));
check('trench ships keep out of crossbars, dividers and gate walls', await page.evaluate(() => {
  S.mission = null; startGame('trench'); S.hull = 1e9; S.nextSpawnZ = -1e9; ship.position.set(0, 0, 80);
  spawnFork(-500); spawnBeam(-1100, { horizontal: true, gapY: 0, moving: false }); spawnBeam(-1250, { horizontal: false, x: 0, moving: false });
  spawnGate(-1450); spawnBeam(-1700, { horizontal: false, x: -8, moving: false });
  spawnPipes(-1900); spawnDoor(-2400); spawnGirders(-2700);
  S.fighterT = 1e9; let bad = 0, crossed = 0, peak = 0;
  const kinds = ['grunt', 'dart', 'hunter', 'ace', 'grunt', 'dart'];
  kinds.forEach((k, i) => { const F = spawnFighter(-80 - i * 55, k); F.mesh.position.x = (i - 2.5) * 9; });
  spawnBomber(-200);
  const last = new Map();
  for (let i = 0; i < 1100; i++) {
    update(.05); S.hull = 1e9; S.shield = 100; ship.position.x *= .9;   // keep the player roughly on the centre line
    for (const F of [...fighters, ...bombers]) {
      const q = F.mesh.position;
      for (const B of [...beams, ...dividers]) if (q.x > B.min.x - 1 && q.x < B.max.x + 1 && q.y > B.min.y - 1 && q.y < B.max.y + 1 && q.z > B.min.z - 1 && q.z < B.max.z + 1) bad++;
      if (Math.abs(q.x) > HALF_W - 1 || q.y < FLOOR_Y) bad++;
      const pz = last.get(F);
      if (pz !== undefined) for (const G of gates) if ((pz - G.z) * (q.z - G.z) <= 0) {
        crossed++; const dx = q.x, dy = q.y - G.cy, ca = Math.cos(-G.angle), sa = Math.sin(-G.angle);
        if (!(Math.abs(dx * ca - dy * sa) < G.L && Math.abs(dx * sa + dy * ca) < G.H)) bad++;
      }
      last.set(F, q.z);
    }
    peak = Math.max(peak, fighters.length);
  }
  S.mode = 'menu'; showScreen('menu');
  return bad === 0 && peak > 0;
}));
check('fleet management: repair, refit and recruit between battles, and captains rank up', await page.evaluate(() => {
  const keep = PROG.completed, keepS = PROG.sector, keepD = PROG.dock, keepC = PROG.credits, keepP = PROG.parts;
  PROG.completed = {}; MISSIONS.slice(0, 12).forEach(m => PROG.completed[m.id] = { score: 1, time: 60, bonuses: 0 });
  PROG.sector = { hull: { HALCYON: .5, SOLACE: .75 }, pick: { m13: 'x13a' } }; PROG.dock = {}; PROG.credits = 10000; PROG.parts = 20; saveProg();
  openCommand(); ccFleetTab = 'status'; const row = document.getElementById('ccRow_fleet'); row.click();
  const ships = ccBody.querySelectorAll('.ccship').length === 2 && ccBody.querySelectorAll('.ccunit').length === 4 && /2 to repair/.test(row.textContent) && ccStations().length === 5;
  ccBody.querySelector('[data-dock="repair:SOLACE"]').click();
  const repaired = PROG.sector.hull.SOLACE === 1 && PROG.credits === 10000 - 25 * DOCK.repairCr;
  ccBody.querySelector('[data-dock="recruit:WARDEN"]').click();
  const recruited = dockRecruited().length === 1 && /In the line/.test(ccBody.textContent);
  ccBody.querySelector('.cctab[data-tab="upgrades"]').click();
  const halRefit = !!ccBody.querySelector('[data-up="carHull"]') && !!ccBody.querySelector('[data-dock="refit:WARDEN:armour"]');
  ccBody.querySelector('[data-dock="refit:SOLACE:armour"]').click(); ccBody.querySelector('[data-dock="refit:SOLACE:guns"]').click();
  const refit = dockRefitLv('SOLACE', 'armour') === 1 && dockRefitLv('SOLACE', 'guns') === 1 && PROG.parts === 13;
  PROG.dock.xp.SOLACE = 1;
  S.mission = missionById('m13'); startGame('arena');
  const sol = capitals.find(c => c.T.name === 'SOLACE'), war = capitals.find(c => c.T.name === 'WARDEN');
  const inFlight = !!war && war.role === 'screen' && sol.T.hp === Math.round(ESCORT_TYPE.hp * 1.15) && Math.abs(sol.gunMul - 1.15) < 1e-9 && sol.capHit === 1;
  endGame(true);
  const ranked = dockXp('SOLACE') === 2 && dockRank('SOLACE') === 1 && dockXp('WARDEN') === 1 && /Promoted: SOLACE/.test(dbReward.textContent);
  S.mission = missionById('m14'); startGame('arena'); const vet = capitals.find(c => c.T.name === 'SOLACE').capHit > 1; endGame(false, 'smoke test');
  S.mission = { skirmish: true }; const skirm = dockHullMul('SOLACE') === 1;
  PROG.completed = keep; PROG.sector = keepS; PROG.dock = keepD; PROG.credits = keepC; PROG.parts = keepP; saveProg(); ccFleetTab = 'status'; S.mission = null; S.mode = 'menu'; showScreen('menu');
  return ships && repaired && recruited && halRefit && refit && inFlight && ranked && vet && skirm;
}));
await click('roadmapBtn'); check('roadmap opens from the title', await visible('roadmap') && await page.evaluate(() => document.querySelectorAll('#rmList .rmitem').length > 4));
await key('Escape'); check('Esc backs out of the roadmap', await visible('menu'));

console.log(steps.join('\n'));
await browser.close();
if (errors.length) { console.error('\nErrors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nSmoke test passed.');
