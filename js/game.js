"use strict";
/* Game flow: start/pause/end, damage, kills, targeting, HUD element pools. */

/* ============================ GAME FLOW ============================ */
function startGame(sector){
  S.sector=(typeof sector==='string')?sector:(S.sector||'trench');
  audioInit();if(AC.state==='suspended')AC.resume();
  [...beams.map(b=>b.mesh),...gates.map(g=>g.group),...turrets.map(t=>t.mesh),
   ...fighters.map(f=>f.mesh),...bombers.map(b=>b.mesh),...mines.map(m=>m.mesh),
   ...pickups.map(k=>k.mesh),...msls.map(m=>m.m),
   ...pBolts.map(b=>b.m),...eBolts.map(b=>b.m),...smoke.map(s=>s.m),
   ...rings.map(r=>r.m),...trail.map(t=>t.m)].forEach(m=>scene.remove(m));
  sparks.forEach(s=>freeSparkMesh(s.m));   // pooled — return to the pool, don't remove from scene
  if(portGroup){scene.remove(portGroup);portGroup=null;exhaustPort=null;}
  if(torpedo){scene.remove(torpedo.m);torpedo=null;}
  beams.length=gates.length=turrets.length=fighters.length=bombers.length=mines.length=pickups.length=msls.length=
    pBolts.length=eBolts.length=sparks.length=smoke.length=rings.length=trail.length=0;
  Object.assign(S,{vel:new THREE.Vector3(0,0,-MAX_SPD*curShip.spdMul*.45),throttle:.45,boost:false,
    zoomHeld:false,zoomK:0,shield:100,hull:100,kills:0,time:0,lastHit:-9,
    lock:0,locked:false,fired:false,missiles:MSL_START+curShip.mslBonus,mslCD:0,mslTarget:null,lockTarget:null,lockT:0,
    score:0,combo:0,comboT:0,comboMax:0,
    cursor:{x:0,y:0},nextShot:0,fireKick:0,fireIdx:0,fighterT:5,bomberT:16,flakT:0,shake:0,slowT:0,nextSpawnZ:-300,buffT:0,flowX:0,flowY:0,boostE:100,boostLock:false,boostUsed:false,hitMarkT:0});
  S.kick.set(0,0,0);S.kickV.set(0,0,0);
  for(let i=0;i<popPool.length;i++)popPool[i].style.display='none';popups.length=0;
  const arena=S.sector==='arena';
  const m=S.mission;
  S.surviveTime=(m&&m.survive)||0;                          // >0 → win on the clock (defensive hold)
  S.arenaTarget=S.surviveTime>0?999:((m&&m.count)||14);     // survive holds spawns open; else clear N
  segments.forEach((s,i)=>{s.position.z=-i*SEG_LEN;s.visible=!arena;});
  if(arena){
    buildArena();arenaEnv.visible=true;
    if(portGroup){scene.remove(portGroup);portGroup=null;exhaustPort=null;}
    scene.fog.color.setHex(0x0a1424);scene.background.copy(scene.fog.color);
    ship.position.set(0,0,0);S.fighterT=.8;S.bomberT=14;  // first hostiles inbound quickly
    S.throttle=.4;                                        // drift in; coupled arcade lets you hover & dogfight
  }else{
    if(arenaEnv)arenaEnv.visible=false;
    buildPort();
    ship.position.set(0,0,80);
  }
  ship.quaternion.identity();
  camera.position.copy(ship.position).add(tmp.set(0,1.05,.55));camera.quaternion.identity();camera.up.set(0,1,0);camera.fov=78;
  setCam(S.cam);setModel(S.model);
  $('menu').classList.add('hidden');$('endWin').classList.add('hidden');$('endDead').classList.add('hidden');$('pause').classList.add('hidden');
  $('missionSelect').classList.add('hidden');$('briefing').classList.add('hidden');$('debrief').classList.add('hidden');$('hangar').classList.add('hidden');
  objLbl.textContent='Objective // '+(m?m.name:(arena?'Combat Zone':'Reactor Intake'));
  $('hud').classList.add('on');
  if(!isTouch)renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();
  S.mode='play';
}
$('launchBtn').onclick=()=>{S.mission=null;startGame('trench');};   // free flight — no mission wrapper
$('arenaBtn').onclick=()=>{S.mission=null;startGame('arena');};
$('againBtn').onclick=startGame;   // replays the same sector (free play)
$('retryBtn').onclick=startGame;
/* ---- mission-framework screen wiring ---- */
$('campaignBtn').onclick=openMissions;
$('msBack').onclick=()=>{S.mode='menu';showScreen('menu');};
$('bfBack').onclick=openMissions;
$('bfLaunch').onclick=()=>launchMission(S.briefM);
$('hangarBtn').onclick=openHangar;
$('hgBack').onclick=()=>{S.mode='menu';showScreen('menu');};
/* engine drone is only driven inside update(), which stops running once mode leaves 'play' —
   without this it freezes at whatever volume it had (often loud) and never fades out */
function silenceEngine(){if(AC&&engGain)engGain.gain.setTargetAtTime(0,AC.currentTime,.2);}
/* ---- pause / resume ---- */
function pauseGame(){
  if(S.mode!=='play')return;
  S.mode='paused';$('pause').classList.remove('hidden');
  document.exitPointerLock&&document.exitPointerLock();silenceEngine();
}
function resumeGame(){
  if(S.mode!=='paused')return;
  $('pause').classList.add('hidden');S.mode='play';last=performance.now();
  if(!isTouch)renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();
}
function toMenu(){           // bail out of a run back to the home menu (from pause, or a run's end screen)
  S.mode='menu';document.exitPointerLock&&document.exitPointerLock();silenceEngine();
  $('pause').classList.add('hidden');$('endWin').classList.add('hidden');$('endDead').classList.add('hidden');
  $('hud').classList.remove('on');
  $('cockHud').classList.remove('on');$('mslLock').style.display='none';$('speed').style.opacity=0;
  $('menu').classList.remove('hidden');
}
$('resumeBtn').onclick=resumeGame;
$('restartBtn').onclick=startGame;
$('menuBtn').onclick=toMenu;
$('winMenuBtn').onclick=toMenu;
$('deadMenuBtn').onclick=toMenu;
// losing pointer lock (Esc, alt-tab) auto-pauses so you never fly blind
document.addEventListener('pointerlockchange',()=>{
  if(!isTouch&&S.mode==='play'&&document.pointerLockElement!==renderer.domElement)pauseGame();
});

function endGame(win,cause){
  S.mode=win?'win':'dead';document.exitPointerLock&&document.exitPointerLock();silenceEngine();
  $('hud').classList.remove('on');$('zoomVig').style.opacity=0;$('speed').style.opacity=0;S.streakK=0;
  $('mslLock').style.display='none';$('cockHud').classList.remove('on');
  // a clean run earns a completion bonus that scales with leftover hull
  if(win)S.score+=2000+Math.round(S.hull*20);
  // death spectacle fires regardless of mode
  if(!win){burst(ship.position,0xff5500,2.5);spark(ship.position,0xff5500,40,40);spark(ship.position,0x00f0ff,20,30);puff(ship.position,8);}
  sfx('bigboom');
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
    $('winSub').textContent=S.sector==='arena'?'// hostiles eliminated':'// the grid goes dark';
    $('finalScore').textContent=S.score.toLocaleString();
    $('scoreLabel').textContent=isRecord?'// new record':'// final score';
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

function damage(amount,cause){
  if(S.mode!=='play')return;
  amount*=curShip.armorMul;     // hull-specific damage taken — the ship's one "tankiness" knob
  S.lastHit=S.time;S.shake=Math.min(1,S.shake+amount/22);
  const onShield=S.shield>0;
  if(onShield){S.shield-=amount;if(S.shield<0){S.hull+=S.shield;S.shield=0;}}
  else S.hull-=amount;
  // hit reaction on the airframe: shield ripple = cyan, hull hits throw sparks + smoke
  spark(ship.position,onShield?0x00f0ff:0xff7733,onShield?6:10,onShield?16:26);
  if(!onShield)puff(ship.position,2);
  // directional impulse + hit-stop scaled by severity
  addKick((Math.random()-.5)*amount*.05,(Math.random()-.5)*amount*.04,amount*.03);
  if(amount>=18)hitStop(.06);
  sfx('hit');$('flash').style.opacity=onShield?.55:.85;setTimeout(()=>$('flash').style.opacity=0,60);
  if(S.hull<=0){S.hull=0;endGame(false,cause);}
}

function killEnemy(E,arr,i,worth){
  E.dead=true;
  const heavy=(worth||100)>=300;
  // bigger, layered detonation + impulse + a beat of hit-stop
  spark(E.mesh.position,0xff5500,26,40);spark(E.mesh.position,0xffb300,14,30);
  spark(E.mesh.position,0x00f0ff,10,26);burst(E.mesh.position,0xff7733,heavy?1.9:1.2);
  S.shake=Math.min(1,S.shake+(heavy?.45:.3));
  addKick((Math.random()-.5)*.3,heavy?.9:.5,0);hitStop(heavy?.10:.05);
  sfx('boom');scene.remove(E.mesh);arr.splice(i,1);S.kills++;
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
function hitEnemy(E,dmg){
  if(!E||E.dead)return;
  E.hp-=dmg;
  hitMarker(E.hp<=0?'kill':'hit');
  let idx=fighters.indexOf(E);
  if(idx>=0){if(E.hp<=0){const q=E.mesh.position.clone();killEnemy(E,fighters,idx,120);if(Math.random()<.3)dropPickup(q,rollPickup());}else spark(E.mesh.position,0x00f0ff,6);return;}
  idx=turrets.indexOf(E);
  if(idx>=0){if(E.hp<=0){const q=E.mesh.position.clone();killEnemy(E,turrets,idx,120);dropPickup(q,rollPickup());}else spark(E.mesh.position,0x00f0ff,6);return;}
  idx=bombers.indexOf(E);
  if(idx>=0){if(E.hp<=0){const q=E.mesh.position.clone();killEnemy(E,bombers,idx,300);dropPickup(q,'missile');dropPickup(q,'score');}else{spark(E.mesh.position,0xffb300,6);puff(E.mesh.position,1);}return;}
}

/* missile target: prefer hostile SHIPS in the forward cone; wall turrets are only a
   tight, short-range fallback so the lock doesn't constantly snap onto side emplacements */
function acquireTarget(){
  fwd.set(0,0,-1).applyQuaternion(ship.quaternion);
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
/* floating world-space score popups (pooled) */
const popPool=[],popups=[];
function getPopEl(i){
  let el=popPool[i];
  if(!el){el=document.createElement('div');el.className='pop';document.getElementById('pops').appendChild(el);popPool[i]=el;}
  return el;
}
function spawnPop(pos,txt,cls){popups.push({p:pos.clone(),life:1,txt,cls:cls||''});}
