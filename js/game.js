"use strict";
/* Game flow: start/pause/end, damage, kills, targeting, HUD element pools. */

/* ============================ GAME FLOW ============================ */
function startGame(sector){
  S.sector=(typeof sector==='string')?sector:(S.sector||'trench');
  audioInit();if(AC.state==='suspended')AC.resume();
  [...beams.map(b=>b.mesh),...gates.map(g=>g.group),...turrets.map(t=>t.mesh),
   ...fighters.map(f=>f.mesh),...bombers.map(b=>b.mesh),...mines.map(m=>m.mesh),
   ...pickups.map(k=>k.mesh),...msls.map(m=>m.m),
   ...pBolts.map(b=>b.m),...eBolts.map(b=>b.m)].forEach(m=>scene.remove(m));
  // pooled effects go back to their pools rather than leaving the scene
  sparks.forEach(s=>freeSparkMesh(s.m));rings.forEach(freeRing);
  smoke.forEach(s=>smokePool.put(s.m));trail.forEach(t=>trailPool.put(t.m));
  fxLights.forEach(freeLight);fireballs.forEach(freeFireball);debris.forEach(freeDebris);
  fireballs.length=debris.length=0;
  if(portGroup){scene.remove(portGroup);portGroup=null;exhaustPort=null;}
  if(torpedo){scene.remove(torpedo.m);torpedo=null;}
  eMsls.forEach(e=>scene.remove(e.m));eMsls.length=0;
  clearFlares();
  resetDamageFx();
  bridgeHide();autoOff();
  clearWingmen();
  clearCapitals();
  clearBranch();clearSetPieces();
  beams.length=gates.length=turrets.length=fighters.length=bombers.length=mines.length=pickups.length=msls.length=
    pBolts.length=eBolts.length=sparks.length=smoke.length=rings.length=trail.length=0;
  Object.assign(S,{vel:new THREE.Vector3(0,0,-MAX_SPD*curShip.spdMul*.45),throttle:.45,cruise:false,boost:false,
    zoomHeld:false,zoomK:0,shield:100,hull:100,kills:0,time:0,lastHit:-9,
    lock:0,locked:false,fired:false,missiles:MSL_START+curShip.mslBonus,mslCD:0,mslTarget:null,lockTarget:null,lockT:0,target:null,mslMode:false,
    score:0,combo:0,comboT:0,comboMax:0,
    cursor:{x:0,y:0},nextShot:0,fireKick:0,fireIdx:0,fighterT:5,squadT:12,bomberT:16,flakT:0,shake:0,slowT:0,nextSpawnZ:-300,forkZ:-1500,pieceZ:-1000,padT:0,skimT:0,buffT:0,flowX:0,flowY:0,boostE:100,boostLock:false,boostUsed:false,hitMarkT:0,
    launchT:0,cm:curShip.cmMax,cmT:0,cmCD:0,lockWarn:false,lockBeepT:0,bumpT:-9});
  S.kick.set(0,0,0);S.kickV.set(0,0,0);
  for(let i=0;i<popPool.length;i++)popPool[i].style.display='none';popups.length=0;
  for(const h of dmgHits){h.life=0;h.el.style.opacity=0;}
  const arena=S.sector==='arena';
  const m=S.mission;
  S.diff=diffFor(m);
  S.carry=sectorCarry(m);   // the sector map's front line: fleet damage carried in, and the struck target's effect (js/sector.js)
  S.surviveTime=(m&&m.survive)||0;                          // >0 → win on the clock (defensive hold)
  S.arenaTarget=S.surviveTime>0?999:(m&&m.count!==undefined?m.count:14);     // survive holds spawns open; else clear N (0: a skirmish with no fighter cover)
  S.leaderMode=!!(m&&m.leader);S.leaderSpawned=S.leaderDown=false;   // leader missions: the leader is the final kill
  if(S.carry&&S.carry.base)S.arenaTarget=Math.ceil(S.arenaTarget*SECTOR_CARRY.base);   // their fighter base was struck
  if(S.leaderMode)S.arenaTarget++;
  // capital ships (js/data/capitals.js): free arena gets a random enemy capital and the carrier; missions opt in
  const capKinds=Object.keys(CAPITAL_TYPES),capPick=()=>capKinds[(Math.random()*capKinds.length)|0];
  S.capMode=arena&&!S.school&&(!m||!!m.capital)?(m&&CAPITAL_TYPES[m.capital]?m.capital:capPick()):false;
  S.capSpawned=S.capDown=false;S.capName=S.capMode?CAPITAL_TYPES[S.capMode].name:'';
  S.carrierMode=arena&&!S.school&&(!m||!!m.carrier);S.carrierLost=false;S.carrierLostT=0;
  // random capital ship event (setting capEvents): a campaign arena op that names no capital or carrier may still get one
  if(arena&&!S.school&&m&&!m.fleet&&m.capital===undefined&&m.carrier===undefined&&SETTINGS.capEvents!=='off'&&
     Math.random()<(SETTINGS.capEvents==='always'?1:CAP_EVENT_CHANCE)){
    if(Math.random()<CAP_EVENT_HOSTILE){S.capMode=capPick();S.capName=CAPITAL_TYPES[S.capMode].name;}
    S.carrierMode=true;   // the carrier is on station either way (it launches the wing)
  }
  // fleet battle (js/fleet.js): HALCYON and SOLACE against MAW and VESPER, line against line
  S.fleet=arena&&!S.school&&!!(m&&m.fleet);S.sysDown=0;S.carMoved=0;S.formT=0;S.sqLaunched=0;S.bridgeUsed=false;S.autoT=0;   // the bridge opened, seconds on autopilot, metres HALCYON has moved under orders, seconds SOLACE held a formation, squadrons launched (commander bonuses)
  S.fleetLine=((m&&m.line)||FLEET.enemies).map(e=>Object.assign({},e));S.fleetN=0;S.fleetHp=(m&&m.carrierHp)||FLEET.carrierHp;S.fleetEscort=!(m&&m.escort===false);   // a fleet op can set its own enemy line (copied: the Kiru Gate adds to it), HALCYON's hull and whether SOLACE is there
  S.gate=null;S.gateSent=0;S.fleetOrders=0;S.alliesLost=0;S.reserveDef=S.fleet&&m.reserve||null;S.reserveUsed=false;   // Admiral ops (js/fleet.js): the Kiru Gate, fleet-wide orders given, destroyers lost, the reserve
  S.screenCatch=0;S.fleetSunk=0;admSetup(S.fleet&&m);fleetTipsReset();   // shells your destroyers caught for HALCYON, and the enemy admiral (js/enemyadm.js)
  if(S.fleet){S.capMode='fleet';S.carrierMode=true;S.capName=S.fleetLine.map(e=>e.name||CAPITAL_TYPES[e.kind].name).join(' + ');}
  // capital ship interior (js/interior.js): a trench run down the inside of the ship named by `interior`
  S.interior=!arena&&!!(m&&m.interior);S.runLen=S.interior?INTERIOR_LEN:TRENCH_LEN;S.ventHits=0;S.escape=null;clearEscape();
  S.radio={i:0,q:[],t:0,low:false,downs:0,cap:false};radioBox.style.opacity=0;   // the op's radio chatter (js/update/radio.js)
  S.wingFlown=[];S.wingDowned=[];   // callsigns that flew and were shot down this run (fleet record, js/command.js)
  if(S.interior)S.capName=(INTERIOR_SHIPS[m.interior]||INTERIOR_SHIPS.dreadnought).name;
  if(S.school)S.arenaTarget=999;
  S.mslWarnD=1e9;S.mslBeepT=0;ann.style.opacity=0;S.annT=0;
  segments.forEach((s,i)=>{s.position.z=-i*SEG_LEN;s.visible=!arena&&!S.interior;});
  setInterior(S.interior);
  spaceSky(arena);
  if(arena){
    buildArena();arenaEnv.visible=true;arenaAtmosphere(true);
    arenaEnv.children.forEach(c=>{c.visible=!S.school;});   // flight school hides the whole arena: it has its own range
    if(schoolEnv)schoolEnv.visible=!!S.school;
    if(S.school){buildSchoolEnv();arenaSky.visible=false;schoolAtmosphere();}
    if(portGroup){scene.remove(portGroup);portGroup=null;exhaustPort=null;}
    ship.position.set(0,0,0);S.fighterT=.8;S.bomberT=14;  // first hostiles inbound quickly
    if(S.carrierMode){spawnCarrier();S.launchT=LAUNCH_T;S.fighterT+=LAUNCH_T;}   // before the wingmen, who launch from its bay; you launch first (js/update/launch.js)
    if(S.fleet&&S.fleetEscort)spawnEscort();
    if(S.fleet)fleetSetup(m);   // an Admiral op's allies and the Kiru Gate
    if(!S.school&&(!m||(rankLevel()>=1&&m.wingmen!==false)))spawnWingmen();   // two friendly wingmen (1-6 give orders); campaign ops need Lieutenant rank; a mission can set wingmen:false to fly solo
    S.throttle=.4;                                        // drift in; coupled arcade lets you hover & dogfight
  }else{
    if(arenaEnv)arenaEnv.visible=false;
    if(schoolEnv)schoolEnv.visible=false;
    arenaAtmosphere(false);if(S.interior)interiorAtmosphere();
    buildPort();
    ship.position.set(0,0,80);
  }
  ship.quaternion.identity();chaseOff.set(0,2.6,9);
  camera.position.copy(ship.position).add(tmp.set(0,1.05,.55));camera.quaternion.identity();camera.up.set(0,1,0);camera.fov=78;
  launchHint.style.display='none';if(S.launchT>0)launchBegin();   // from the bay when HALCYON is on station
  setCam(S.cam);setModel(S.model);setMslMode(false);
  $('menu').classList.add('hidden');$('endWin').classList.add('hidden');$('endDead').classList.add('hidden');$('pause').classList.add('hidden');
  $('missionSelect').classList.add('hidden');$('command').classList.add('hidden');$('school').classList.add('hidden');$('briefing').classList.add('hidden');$('debrief').classList.add('hidden');$('hangar').classList.add('hidden');
  for(const id of ['deck','sector','skirmish','saves','roadmap'])$(id).classList.add('hidden');   // the walkable deck's labels and prompts must not ride into the sortie
  $('hud').classList.toggle('school',!!S.school);
  tutStart();
  objLbl.textContent='Objective // '+(m?m.name:(S.school?'Flight School':arena?'Combat Zone':'Reactor Intake'));
  // progress rail captions follow the sector (the arena used to show the trench's labels)
  railA.textContent=arena?(S.surviveTime>0?'Hold':'Engaged'):S.interior?'Hull breach':'Trench entry';
  railB.textContent=arena?(S.surviveTime>0?'Evac ready':'Zone clear'):S.interior?S.capName+' reactor':'Reactor intake';
  $('hud').classList.add('on');
  setAwaitLock(false);syncFullscreen();
  if(!isTouch)renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();
  S.mode='play';
}
$('againBtn').onclick=startGame;   // replays the same sector (free play)
$('retryBtn').onclick=startGame;
/* ---- mission-framework screen wiring ---- */
$('scBack').onclick=()=>schoolBack();
$('controlsBtn').onclick=()=>openControls('menu');
$('pauseCtlBtn').onclick=()=>openControls('pause');
$('ctlBack').onclick=closeControls;
$('bfChange').onclick=()=>openHangar('briefing');
$('bfFleet').onclick=()=>{S.mode='menu';openCommand();selectStation('fleet');};   // the fleet station; Back from the hub or Brief and launch returns here
$('msBack').onclick=()=>openHub();
$('bfBack').onclick=briefBack;
$('bfLaunch').onclick=()=>launchMission(S.briefM);
$('hgTabHulls').onclick=()=>setHangarTab('hulls');
$('hgTabUp').onclick=()=>setHangarTab('up');
$('hgTabPaint').onclick=()=>setHangarTab('paint');
$('hgBack').onclick=closeHangar;
/* engine drone is only driven inside update(), which stops running once mode leaves 'play' —
   without this it freezes at whatever volume it had (often loud) and never fades out */
function silenceEngine(){if(AC&&engGain)engGain.gain.setTargetAtTime(0,AC.currentTime,.2);}
/* ---- pause / resume ---- */
let pausedAt=0;   // one Esc press can both drop the mouse capture (which pauses) and arrive as a key (which would resume)
function pauseGame(){
  if(S.mode!=='play')return;
  S.mode='paused';pausedAt=performance.now();$('pause').classList.remove('hidden');setAwaitLock(false);syncFullscreenUI();
  document.exitPointerLock&&document.exitPointerLock();silenceEngine();
}
function resumeGame(){
  if(S.mode!=='paused')return;
  $('pause').classList.add('hidden');S.mode='play';last=performance.now();setAwaitLock(false);syncFullscreen();
  if(!isTouch)renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();
}
function toMenu(){           // bail out of a run back to the home menu (from pause, or a run's end screen)
  if(TUT){TUT=null;tut.classList.remove('on');}
  schoolReset();S.school=false;ACADEMY=null;
  bridgeHide();
  S.mode='menu';S.launchT=0;launchHint.style.display='none';document.exitPointerLock&&document.exitPointerLock();silenceEngine();setAwaitLock(false);
  $('pause').classList.add('hidden');$('endWin').classList.add('hidden');$('endDead').classList.add('hidden');
  $('hud').classList.remove('on');
  $('cockHud').classList.remove('on');$('mslLock').style.display='none';$('speed').style.opacity=0;
  showScreen('menu');
}
$('resumeBtn').onclick=resumeGame;
$('restartBtn').onclick=startGame;
$('menuBtn').onclick=toMenu;
$('winMenuBtn').onclick=toMenu;
$('deadMenuBtn').onclick=toMenu;
// losing pointer lock (Esc, alt-tab) auto-pauses so you never fly blind
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===renderer.domElement){setAwaitLock(false);return;}
  if(!isTouch&&S.mode==='play'&&!S.awaitLock&&!S.bridge)pauseGame();   // the command bridge frees the mouse on purpose
});
/* Browsers refuse to re-capture the mouse for a moment after Esc releases it, so resuming from the
   keyboard could leave the run going with no steering. Hold the run and ask for a click instead
   (input.js re-requests the lock on that click). */
document.addEventListener('pointerlockerror',()=>{if(!isTouch&&S.mode==='play')setAwaitLock(true);});
function setAwaitLock(on){S.awaitLock=on;lockPrompt.style.display=on?'block':'none';if(on)S.fireHeld=false;}

function endGame(win,cause){
  if(TUT){TUT=null;tut.classList.remove('on');}schoolReset();   // an unfinished training run shows again next time
  S.launchT=0;launchHint.style.display='none';bridgeHide();fleetTipsReset();
  S.mode=win?'win':'dead';document.exitPointerLock&&document.exitPointerLock();silenceEngine();setAwaitLock(false);
  $('hud').classList.remove('on');$('zoomVig').style.opacity=0;$('speed').style.opacity=0;S.streakK=0;
  $('mslLock').style.display='none';$('cockHud').classList.remove('on');
  // a clean run earns a completion bonus that scales with leftover hull
  if(win)S.score+=2000+Math.round(S.hull*20);
  // death spectacle fires regardless of mode
  if(!win){burst(ship.position,0xff5500,2.5);spark(ship.position,0xff5500,40,40);spark(ship.position,0x00f0ff,20,30);puff(ship.position,8);}
  sfx('bigboom');if(win)sfx('win');
  // mission runs debrief through the progression layer; free play keeps the classic screens
  if(S.mission){openDebrief(win,cause);return;}
  const fmtT=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
  // persist record: highest score wins; ties break on faster time
  const isRecord = S.score>BEST.score || (S.score===BEST.score && win && (!BEST.time||S.time<BEST.time));
  if(S.score>BEST.score){BEST.score=S.score;}
  if(win && (!BEST.time||S.time<BEST.time))BEST.time=S.time;
  saveBest();
  const bestStr='Best '+BEST.score+' · '+fmtT(BEST.time||0);
  if(win){
    $('winTitle').textContent=S.sector==='arena'?'ZONE CLEAR':'CORE BREACH';
    $('winSub').textContent=S.sector==='arena'?'Hostiles eliminated':'The grid goes dark';
    $('finalScore').textContent=S.score.toLocaleString();
    $('scoreLabel').textContent=isRecord?'New record':'Final score';
    $('stT').textContent=fmtT(S.time);
    $('stK').textContent=S.kills;$('stC').textContent='x'+S.comboMax;$('stH').textContent=Math.round(S.hull)+'%';
    $('bestLine').textContent=bestStr;
    $('endWin').classList.remove('hidden');
  }else{
    $('deathCause').textContent=cause||'The trench keeps what it takes.';
    $('deathScore').textContent='Score '+S.score.toLocaleString()+' · '+bestStr+(isRecord?' · NEW BEST':'');
    $('endDead').classList.remove('hidden');
  }
}

/* the enemy-fighter and damage multipliers for a run (DIFFICULTY in js/config.js): a skirmish uses its own level at full strength;
   a campaign op eases in from the first op to DIFF_RAMP; free modes run at the setting's late values */
function diffFor(m){
  const level=DIFFICULTY[m&&m.difficulty]||DIFFICULTY[SETTINGS.difficulty]||DIFFICULTY.normal;
  const i=m&&!m.skirmish?MISSIONS.findIndex(x=>x.id===(m.leg||m.id)):-1;   // a sector map target eases in like the op it comes before
  const r=i<0?1:Math.min(1,i/DIFF_RAMP),d={};
  for(const k in level.late)d[k]=level.early[k]+(level.late[k]-level.early[k])*r;
  d.attackers=Math.round(d.attackers);
  return d;
}
function damage(amount,cause,from){
  if(S.mode!=='play'||S.launchT>0)return;   // nothing touches you on the catapult run
  if(S.school){if(SCH)SCH.hits++;return;}   // flight school is harmless; hits are only counted (the evasion drill grades on them)
  if(from)markHitFrom(from);   // hostile fire shows which side it came from
  amount*=curShip.armorMul*(S.diff?S.diff.dmg:1);     // hull-specific damage taken — the ship's one "tankiness" knob
  S.lastHit=S.time;S.shake=Math.min(1,S.shake+amount/22);
  const onShield=S.shield>0, hullBefore=S.hull;
  if(onShield){S.shield-=amount;if(S.shield<0){S.hull+=S.shield;S.shield=0;}}
  else S.hull-=amount;
  hitShipFx(from,onShield,onShield&&S.shield===0,S.hull<hullBefore);   // shield ripple / collapse flare, hull scorch
  // hit reaction on the airframe: shield ripple = cyan, hull hits throw sparks + smoke
  spark(ship.position,onShield?0x00f0ff:0xff7733,onShield?6:10,onShield?16:26);
  if(!onShield)puff(ship.position,2);
  // directional impulse + hit-stop scaled by severity
  addKick((Math.random()-.5)*amount*.05,(Math.random()-.5)*amount*.04,amount*.03);
  if(amount>=18)hitStop(.06);
  sfx(onShield?'shieldhit':'hit');$('flash').style.opacity=onShield?.55:.85;setTimeout(()=>$('flash').style.opacity=0,60);
  if(S.hull<=0){S.hull=0;endGame(false,cause);}
}

/* `byCarrier`: HALCYON's turrets made the kill. It still counts toward the wave, but earns you no score, combo or pop. */
function killEnemy(E,arr,i,worth,byCarrier){
  E.dead=true;
  const heavy=(worth||100)>=300;
  // bigger, layered detonation + impulse + a beat of hit-stop
  spark(E.mesh.position,0xff5500,26,40);spark(E.mesh.position,0xffb300,14,30);
  spark(E.mesh.position,0x00f0ff,10,26);burst(E.mesh.position,0xff7733,heavy?1.9:1.2);
  shatter(E.mesh.position,heavy?9:6,heavy?1.3:1);
  S.shake=Math.min(1,S.shake+(heavy?.45:.3));
  addKick((Math.random()-.5)*.3,heavy?.9:.5,0);hitStop(heavy?.10:.05);
  sfx('boom',E.mesh.position);scene.remove(E.mesh);arr.splice(i,1);S.kills++;
  if(byCarrier)return;
  // combo: chain kills inside COMBO_WINDOW to ramp the multiplier
  S.combo=S.comboT>0?S.combo+1:1;S.comboT=COMBO_WINDOW;
  S.comboMax=Math.max(S.comboMax,S.combo);
  const mult=S.combo;
  const gain=Math.round((worth||100)*mult);
  S.score+=gain;
  // floating score at the kill site
  spawnPop(E.mesh.position,'+'+gain+(mult>1?'  x'+mult:''),mult>=4?'crit':heavy?'big':'');
  if(mult>=2){comboPop.textContent='x'+mult+' COMBO';comboPop.style.opacity=1;
    comboPop.style.transform='translateX(-50%) scale('+(1+Math.min(mult,6)*.06)+')';}
}

/* apply damage to whichever array holds this enemy; award score + drop loot on kill */
function hitEnemy(E,dmg,byCarrier){
  if(!E||E.dead)return;
  if(E.cap){hitCapPart(E,dmg);return;}   // cruiser turret or reactor (js/capital.js)
  if(E.drone)S.drillHits++;
  E.hp-=dmg;
  if(!byCarrier)hitMarker(E.hp<=0?'kill':'hit');
  let idx=fighters.indexOf(E);
  if(idx>=0){
    if(E.hp<=0){const q=E.mesh.position.clone();killEnemy(E,fighters,idx,E.T.worth,byCarrier);
      if(E.kind==='leader'){S.leaderDown=true;announce(E.callsign+' DOWN','Squadron leader destroyed','ace');dropPickup(q,'shield');}
      else if(E.T.ace){announce('ACE DOWN',E.callsign,'ace');dropPickup(q,rollPickup());}
      else if(!E.drone&&Math.random()<(E.kind==='hunter'?.6:.3))dropPickup(q,rollPickup());}
    else{spark(E.mesh.position,E.shield?0xff4a6a:0x00f0ff,6);if(E.shield)E.shield.material.opacity=.55;}
    return;}
  idx=turrets.indexOf(E);
  if(idx>=0){if(E.hp<=0){const q=E.mesh.position.clone();killEnemy(E,turrets,idx,120);dropPickup(q,rollPickup());}else spark(E.mesh.position,0x00f0ff,6);return;}
  idx=bombers.indexOf(E);
  if(idx>=0){if(E.hp<=0){const q=E.mesh.position.clone();killEnemy(E,bombers,idx,300,byCarrier);dropPickup(q,'missile');dropPickup(q,'score');}else{spark(E.mesh.position,0xffb300,6);puff(E.mesh.position,1);}return;}
}

/* missile target: prefer hostile SHIPS in the forward cone; wall turrets are only a
   tight, short-range fallback so the lock doesn't constantly snap onto side emplacements */
function acquireTarget(){
  fwd.set(0,0,-1).applyQuaternion(ship.quaternion);
  if(S.target){   // with a target selected (R), missiles lock that one only
    tmp.copy(S.target.mesh.position).sub(ship.position);const d=tmp.length();
    return d<950&&tmp.normalize().dot(fwd)>.8?S.target:null;
  }
  let ship_=null,shipD=950, tur=null,turD=360;
  const considerShip=E=>{
    tmp.copy(E.mesh.position).sub(ship.position);const d=tmp.length();
    if(d<shipD&&tmp.normalize().dot(fwd)>.8){ship_=E;shipD=d;}
  };
  const considerTur=E=>{                       // turrets: shorter reach, narrower cone
    tmp.copy(E.mesh.position).sub(ship.position);const d=tmp.length();
    if(d<turD&&tmp.normalize().dot(fwd)>.92){tur=E;turD=d;}
  };
  fighters.forEach(considerShip);bombers.forEach(considerShip);turrets.forEach(considerTur);
  return ship_||tur;
}
const isTurret=E=>turrets.indexOf(E)>=0;
/* R: Star-Citizen-style hostile targeting. The first press selects the hostile nearest the crosshair;
   each press after that steps to the next one further out from it. The selected ship gets the target
   box, the lead indicator, the gun assist and the missile lock. */
function cycleTarget(){
  fwd.set(0,0,-1).applyQuaternion(ship.quaternion);
  const list=[...fighters,...bombers,...capTargets].filter(E=>!E.dead&&E.mesh.position.distanceTo(ship.position)<1800)
    .map(E=>({E,a:tmp.copy(E.mesh.position).sub(ship.position).normalize().dot(fwd)}))
    .sort((x,y)=>y.a-x.a).map(o=>o.E);
  const i=list.indexOf(S.target);
  S.target=list.length?list[(i+1)%list.length]:null;
  if(S.target)sfx('acquire');
}
const targetName=E=>E.callsign||(E.T?E.T.name:'BOMBER');
/* reusable on-screen targeting pips (grown on demand, hidden when unused) */
const pipPool=[],labelPool=[];
function getPip(i){
  let el=pipPool[i];
  if(!el){el=document.createElement('div');el.className='pip';document.getElementById('pips').appendChild(el);pipPool[i]=el;}
  return el;
}
function getLabel(i){
  let el=labelPool[i];
  if(!el){el=document.createElement('div');el.className='clabel';document.getElementById('labels').appendChild(el);labelPool[i]=el;}
  return el;
}
/* edge-of-screen arrows for contacts out of view (grown on demand, hidden when unused) */
const threatPool=[];
function getThreat(i){
  let el=threatPool[i];
  if(!el){el=document.createElement('div');el.className='threat';threats.appendChild(el);threatPool[i]=el;}
  return el;
}
/* hit-direction arcs: the world point a hit came from, re-aimed each frame as the ship turns */
const DMG_ARCS=4, dmgHits=[];
for(let i=0;i<DMG_ARCS;i++){const el=document.createElement('div');el.className='dmgArc';dmgDir.appendChild(el);
  dmgHits.push({el,from:new THREE.Vector3(),life:0});}
function markHitFrom(pos){
  let h=dmgHits[0];for(const x of dmgHits)if(x.life<h.life)h=x;   // reuse the most faded arc
  h.from.copy(pos);h.life=1;
}
/* screen bearing of a world point, in radians clockwise from straight up (works behind the camera too) */
const camInvQ=new THREE.Quaternion(), bearingV=new THREE.Vector3();
function screenBearing(pos){
  camInvQ.copy(camera.quaternion).invert();
  bearingV.copy(pos).sub(camera.position).applyQuaternion(camInvQ);
  if(Math.abs(bearingV.x)<1e-3&&Math.abs(bearingV.y)<1e-3)return Math.PI;   // dead astern → point down
  return Math.atan2(bearingV.x,bearingV.y);
}
/* floating world-space score popups (pooled) */
const popPool=[],popups=[];
function getPopEl(i){
  let el=popPool[i];
  if(!el){el=document.createElement('div');el.className='pop';document.getElementById('pops').appendChild(el);popPool[i]=el;}
  return el;
}
/* big centre-top callout for aces arriving and going down */
function announce(title,sub,cls){
  annT.textContent=title;annS.textContent=sub||'';ann.className=cls||'';
  ann.style.opacity=1;S.annT=2.6;
}
function spawnPop(pos,txt,cls){popups.push({p:pos.clone(),life:1,txt,cls:cls||''});}
