"use strict";
/* Co-op flight: up to four pilots in one open-space battle with HALCYON on station (js/net.js carries the messages).

   The host's game runs the battle, as it does solo. Every other pilot leads a squadron of their own (TALON, WRAITH,
   SABRE) with two AI wingmen. On the host that pilot is a wingman entry flagged `human` (its player's id), so enemy
   fire, targeting, the order wheel and the bridge treat it as one of the squadron; it moves where its player says
   (coopPilotTick), its two wingmen form on it, and hits on it are sent to its player (hitWingman). The host is the
   commander: an order to a squadron a player leads also reaches that player as an order card (js/orders.js).

   A guest flies their own ship in their own game (flight, guns, camera and HUD run locally, so it never lags), sends
   its pose about COOP.poseHz times a second and each shot and missile, and draws the host's battle from snapshots
   (COOP.snapHz a second): fighters, bombers and enemy missiles go into the guest's own lists as stand-ins so pips,
   targeting and the target box work; friendly ships are stand-in meshes; bolts are echoed as events. A guest's run
   skips the battle's own simulation (coopGuestUpdate replaces update's stages).

   Both games build the scenery from the same seed (coopSeeded), so rocks and hulls sit in the same places.

   Messages, guest to host: pose, shot, msl (a missile at a target), sqo (an order for your own squadron, keys 1-6),
   dead. Host to guests: snap, hit (damage to one pilot), order (an order card for one pilot), spawn (a capital joins the
   battle: coopSpawn), end. The lobby picks the battle (COOP.battle: the dogfight or a fleet battle) and the host's seat
   (COOP.seat: flying, or the admiral seat at the holo table: coopAdmiralStart). */

const COOP={live:false,max:4,snapHz:15,poseHz:20,snapT:0,poseT:0,nid:0,ev:[],owner:'',snap:null,friends:new Map(),
  foes:new Map(),me:null,ended:false,fs:[],spawning:0,battle:'dogfight',seat:'fly',admiral:false};
const COOP_CALLS=['TALON LEAD','WRAITH LEAD','SABRE LEAD'];
const COOP_KIND=['grunt','dart','hunter','ace','leader'];
const coopNid=E=>E.nid||(E.nid=++COOP.nid);
const cR=v=>Math.round(v*10)/10, cQ=v=>Math.round(v*1000)/1000;
const cV=(a,v)=>{a.push(cR(v.x),cR(v.y),cR(v.z));return a;}, cQt=(a,q)=>{a.push(cQ(q.x),cQ(q.y),cQ(q.z),cQ(q.w));return a;};

/* run fn with Math.random seeded, so host and guests build the same arena */
function coopSeeded(seed,fn){
  let s=seed>>>0;const rnd=Math.random;
  Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  try{return fn();}finally{Math.random=rnd;}
}
/* host: Launch on the Co-op screen */
function coopLaunch(){
  const seed=(Math.random()*4294967296)>>>0;
  const fleet=COOP.battle==='fleet'?JSON.parse(JSON.stringify(SKIRM)):null;   // a fleet battle: the host's Skirmish setup
  const admiral=COOP.seat==='admiral';
  netSend({t:'start',seed,players:NET.players,fleet,admiral});
  coopStart(seed,NET.players,fleet,admiral);
}
function coopStart(seed,players,fleet,admiral){
  NET.players=players;COOP.live=true;COOP.ended=false;COOP.snap=null;COOP.snapT=COOP.poseT=0;COOP.ev.length=COOP.fs.length=0;
  coopClearStandIns();dkCoopStarted();
  S.mission=fleet?Object.assign(skirmishMission(fleet),{name:'CO-OP',sub:'Fleet battle',coop:true}):null;S.survivalNext=false;S.school=false;
  COOP.spawning++;   // both games build the opening ships themselves
  try{coopSeeded(seed,()=>startGame('arena'));}finally{COOP.spawning--;}
  if(S.launchT>0)launchEnd(true);
  if(TUT){TUT=null;tut.classList.remove('on');}
  const me=players.find(p=>p.id===NET.id)||{slot:0};COOP.me=me;
  ship.position.add(coopOffset(me.slot).applyQuaternion(ship.quaternion));   // each pilot starts off to one side of the lead
  if(netHost()){
    S.arenaTarget=Math.round(S.arenaTarget*(1+.6*(players.length-1)));   // more pilots, more to shoot down
    for(const P of players)if(P.id!==NET.id)coopAddPilot(P);
    if(admiral)coopAdmiralStart();
    setWingOrderHud();
  }else{
    COOP.admiral=!!admiral;
    clearWingmen();
    announce('CO-OP','You lead '+SQUAD_DEFS[me.slot].name+' squadron · 1-6 order your wing','');
  }
}
const coopOffset=slot=>new THREE.Vector3([0,-70,70,0][slot]||0,[0,0,0,30][slot]||0,[0,20,20,60][slot]||0);
/* host: a pilot from the lobby, with their squadron's two AI wingmen */
function coopAddPilot(P){
  const q=P.slot,cfg=effectiveShip(shipById(P.ship));
  const mesh=new THREE.Group();mesh.add(coopHull(cfg));addBeacon(mesh,SQUAD_DEFS[q].col);
  mesh.position.copy(ship.position).add(coopOffset(q).applyQuaternion(ship.quaternion).sub(coopOffset(0)));
  mesh.quaternion.copy(ship.quaternion);scene.add(mesh);
  const H={mesh,callsign:P.name,slot:0,spd:0,wvel:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),fireT:0,trailT:0,hp:100,maxHp:100,dead:false,
    tgt:null,tgtT:0,launch:0,order:null,focus:null,guard:null,sq:q,human:P.id,ship:P.ship,
    net:{p:mesh.position.clone(),q:mesh.quaternion.clone(),v:new THREE.Vector3(),t:S.time},ptgt:null};
  const sq=squadrons[q];sq.up=true;sq.order='form';sq.idx.length=0;
  sq.idx.push(wingmen.length);wingmen.push(H);
  for(let j=0;j<2;j++){const W=newWingman(j,SQUAD_DEFS[q].calls[j],q);
    W.mesh.position.copy(mesh.position).add(tmp.set((j?1:-1)*WING_SLOT.x,WING_SLOT.y,WING_SLOT.z).applyQuaternion(mesh.quaternion));
    sq.idx.push(wingmen.length);wingmen.push(W);}
  return H;
}
/* another player's hull, outside only: buildShip would make it the ship you fly (its cockpit, guns and lights are globals) */
const coopHull=cfg=>buildShipExterior(cfg.visual).group;
const coopLeader=q=>q?wingmen.find(w=>w.human&&w.sq===q&&!w.dead)||null:null;
const coopHuman=id=>wingmen.find(w=>w.human===id)||null;
/* host: a player's ship follows their last pose, carried on by its velocity between messages */
const cpP=new THREE.Vector3();
function coopPilotTick(w,dt){
  const N=w.net,m=w.mesh,age=Math.min(.5,S.time-N.t);
  cpP.copy(N.p).addScaledVector(N.v,age);
  m.position.addScaledVector(N.v,dt).lerp(cpP,Math.min(1,10*dt));
  m.quaternion.slerp(N.q,Math.min(1,12*dt));
  w.wvel.copy(N.v);w.spd=N.v.length();
}
function coopFind(nid){
  if(!nid)return null;
  for(const L of [fighters,bombers,capTargets])for(const E of L)if(E.nid===nid&&!E.dead)return E;
  return null;
}
/* host: someone left; their squadron falls back on HALCYON */
function coopPilotLeft(id){
  const w=coopHuman(id);if(!w||w.dead)return;
  w.dead=true;scene.remove(w.mesh);announce(w.callsign+' LEFT','Their wing falls back on HALCYON','');setWingOrderHud();
}
function coopPilotDown(w){
  if(w.dead)return;
  w.dead=true;w.hp=0;const q=w.mesh.position;
  spark(q,0xff5500,30,40);burst(q,0xff7733,1.8);shatter(q,8,1.2);sfx('bigboom',q);scene.remove(w.mesh);
  announce(w.callsign+' DOWN','Their wing falls back on HALCYON','ace');setWingOrderHud();
}

/* ---- host: messages from pilots ---- */
netOn('pose',m=>{
  if(!COOP.live||!netHost())return;const w=coopHuman(m.from);if(!w||w.dead)return;
  const a=m.a;w.net.p.set(a[0],a[1],a[2]);w.net.q.set(a[3],a[4],a[5],a[6]);w.net.v.set(a[7],a[8],a[9]);w.net.t=S.time;
  w.hp=Math.max(1,a[10]);w.ptgt=coopFind(m.tg);
});
netOn('shot',m=>{
  if(!COOP.live||!netHost())return;const w=coopHuman(m.from);if(!w||w.dead)return;
  const a=m.a;COOP.owner=m.from;
  fireBolt(pBolts,M.boltP,sv0.set(a[0],a[1],a[2]),sv1.set(a[3],a[4],a[5]),720);sfx('laser',sv0);
  COOP.owner='';
});
netOn('msl',m=>{
  if(!COOP.live||!netHost())return;const w=coopHuman(m.from),T=coopFind(m.tg);if(!w||w.dead||!T)return;
  launchMissile(T,w.mesh);
});
netOn('sqo',m=>{
  if(!COOP.live||!netHost())return;const w=coopHuman(m.from);if(!w||w.dead||!WING_ORDERS[m.o])return;
  setSquadOrder(w.sq,m.o);
});
netOn('dead',m=>{if(COOP.live&&netHost()){const w=coopHuman(m.from);if(w)coopPilotDown(w);}});
/* a hit on a player's ship (hitWingman): their own game takes it off their shield and hull */
function coopHitPilot(w,dmg){
  netSend({t:'hit',to:w.human,d:dmg,a:cV([],w.mesh.position)});
  spark(w.mesh.position,0x00f0ff,6);
}
/* the host's commander gives an order to a squadron a player leads: it shows on their screen */
const COOP_TASK={cover:'COVER THE LEAD',form:'FORM ON THE LEAD',free:'FREE ENGAGE',defend:'DEFEND HALCYON',strike:'STRIKE THE CAPITAL'};   // how an order reads to the player leading the squadron
function coopOrderPilot(q,o,task,T){
  const w=coopLeader(q);if(!w||!COOP.live)return;
  if(o!=='target')task=COOP_TASK[o]||task;
  netSend({t:'order',to:w.human,who:NET.name,task,on:T?wingFocusName(T):'',ref:T?coopNid(T):0,o});
}
/* bolts fired on the host, for the guests to draw (js/effects.js fireBolt) */
function coopBoltEv(team,pos,v){
  if(COOP.ev.length<400)COOP.ev.push([team,cR(pos.x),cR(pos.y),cR(pos.z),cR(v.x),cR(v.y),cR(v.z),COOP.owner]);
}

/* ---- host: snapshots, once a frame from update (js/loop.js) ---- */
function coopHostFrame(dt){
  COOP.snapT-=dt;if(COOP.snapT>0)return;COOP.snapT=1/COOP.snapHz;
  const P=S.admiral?[]:[['h',...cV([],ship.position),...cQt([],ship.quaternion),...cV([],S.vel),Math.round(S.hull),curShip.id,NET.name,0]];   // the admiral seat has no ship out
  const W=[];
  for(const w of wingmen){
    if(w.human){if(!w.dead)P.push([w.human,...cV([],w.mesh.position),...cQt([],w.mesh.quaternion),...cV([],w.wvel),Math.round(w.hp),w.ship,w.callsign,w.sq]);continue;}
    if(w.dead)continue;
    W.push([coopNid(w),w.sq||0,...cV([],w.mesh.position),...cQt([],w.mesh.quaternion),...cV([],w.wvel),Math.ceil(w.hp/w.maxHp*5),w.callsign,w.hullId||'']);   // 14: the hull it flies (js/wingmen.js)
  }
  const F=fighters.filter(E=>!E.dead).map(E=>[coopNid(E),Math.max(0,COOP_KIND.indexOf(E.kind)),...cV([],E.mesh.position),...cQt([],E.mesh.quaternion),...cV([],E.wvel),E.hp,E.maxHp]);
  const B=bombers.filter(E=>!E.dead).map(E=>[coopNid(E),...cV([],E.mesh.position),...cQt([],E.mesh.quaternion),E.hp]);
  const C=capitals.map(K=>[K.cid,...cV([],K.g.position),...cQt([],K.g.quaternion),Math.round(K.hp),K.state,cR(K.g.scale.z),
    (K.parts||[]).map(t=>t.dead?1:0).join('')+(K.core&&K.core.dead?'1':'0'),   // which of its guns are out, then its reactor
    K.lance?COOP_LANCE.indexOf(K.lance.phase):0,K.lance&&K.lance.phase!=='idle'?cR(K.lance.pt/(K.lance.phase==='charge'?K.lance.T.charge:K.lance.T.fire)):0,
    (K.systems||[]).map(t=>t.dead?1:0).join('')]);   // a fleet battle's subsystems (shield generator, engines, bridge; the gate's anchors)
  const EM=eMsls.map(E=>cV([],E.m.position));
  const SQ=squadrons.map((s,q)=>sqMembers(q).length?sqOrderName(q):'');
  netSend({t:'snap',tm:S.time,k:S.kills,sc:S.score,at:S.arenaTarget,P,W,F,B,C,EM,SQ,ev:COOP.ev.splice(0),fs:COOP.fs.splice(0)});
}

/* ---- guest ---- */
/* a capital ship joins the battle on the host (an enemy warping in, a gate ship, the reserve): the host runs the spawner
   with a fresh seed and tells the guests, who run it with the same seed and take the host's ids for the new ships.
   A spawner calls coopSpawn first and returns what it gives back; null means build it here as normal. */
const COOP_SPAWN={capital:(kind,slot)=>spawnCapital(kind,slot===null?undefined:slot),ally:(name,at,warp,role)=>spawnAlly(name,at,warp,role)};
function coopSpawn(fn,args,extra){
  if(!COOP.live||!netHost()||COOP.spawning)return null;
  const seed=(Math.random()*4294967296)>>>0,n=capitals.length,a=[...args].map(v=>v===undefined?null:v&&v.isVector3?v.toArray():v);
  COOP.spawning++;let v;try{v=coopSeeded(seed,()=>COOP_SPAWN[fn](...a));}finally{COOP.spawning--;}
  netSend(Object.assign({t:'spawn',fn,args:a,seed,ids:capitals.slice(n).map(C=>C.cid)},extra||{}));
  return {v};
}
netOn('spawn',m=>{
  if(!COOP.live||!netGuest()||!COOP_SPAWN[m.fn])return;
  if(m.line&&m.args[1]!==null)S.fleetLine[m.args[1]]=m.line;   // a ship the Kiru Gate sent: the host added it to the line
  const n=capitals.length;
  COOP.spawning++;try{coopSeeded(m.seed,()=>COOP_SPAWN[m.fn](...m.args));}finally{COOP.spawning--;}
  capitals.slice(n).forEach((C,i)=>{if(m.ids[i]!==undefined)C.cid=m.ids[i];});
});
netOn('snap',m=>{if(COOP.live&&netGuest()){COOP.snap=m;COOP.snapAt=S.time;coopApply(m);}});
netOn('hit',m=>{
  if(!COOP.live||!netGuest()||S.mode!=='play')return;
  damage(m.d,'Shot down by hostile fire.',sv2.set(m.a[0],m.a[1],m.a[2]));
});
netOn('order',m=>{
  if(!COOP.live||!netGuest())return;
  const ref=m.ref?COOP.foes.get(m.ref)||null:null;
  ordReceive({who:m.who,task:m.task,on:m.on||'',ref,line:''});
});
netOn('end',m=>{if(COOP.live&&netGuest()&&S.mode==='play'){COOP.ended=true;endGame(m.win,m.cause||'');}});
/* the guest's frame: your own flight and guns, the host's battle from its last snapshot */
function coopGuestUpdate(fr){
  if(S.launchT>0)updateLaunch(fr);else updateFlight(fr);
  arenaSky.position.copy(camera.position);
  for(const d of arenaDebris){d.m.rotation.y+=d.rs*fr.dt;d.m.rotation.x+=d.rs*.5*fr.dt;}
  coopDrift(fr.dt);
  coopCapFrame(fr.dt,fr.p);
  updateWeapons(fr);
  coopGuestCollide(fr);
  updateParticles(fr);
  updateCamera(fr);
  updateAimAids(fr);
  updateAudio(fr);
  updateHud(fr);
  COOP.poseT-=fr.dt;
  if(COOP.poseT<=0){COOP.poseT=1/COOP.poseHz;
    const a=[...cV([],ship.position),...cQt([],ship.quaternion),...cV([],S.vel),Math.round(S.hull)];
    netSend({t:'pose',a,tg:S.target&&S.target.nid||0});}
}
/* your shots and missiles, for the host to fire for real (js/update/weapons.js) */
function coopShot(pos,dir){netSend({t:'shot',a:[cR(pos.x),cR(pos.y),cR(pos.z),cQ(dir.x),cQ(dir.y),cQ(dir.z)]});}
function coopMissile(T){if(T&&T.nid)netSend({t:'msl',tg:T.nid});}
/* stand-ins: what a snapshot says, eased toward between snapshots */
const cpQ=new THREE.Quaternion();
function coopTarget(o,a,i,hasV){
  o.np=o.np||new THREE.Vector3();o.nq=o.nq||new THREE.Quaternion();o.nv=o.nv||new THREE.Vector3();
  o.np.set(a[i],a[i+1],a[i+2]);o.nq.set(a[i+3],a[i+4],a[i+5],a[i+6]);
  if(hasV)o.nv.set(a[i+7],a[i+8],a[i+9]);
}
function coopApply(m){
  S.kills=m.k;S.score=m.sc;S.arenaTarget=m.at;
  // enemy fighters: stand-ins in fighters[], so pips, targeting (R) and the target box work
  const seen=new Set();
  for(const a of m.F){
    const nid=a[0];seen.add(nid);let E=COOP.foes.get(nid);
    if(!E){E=spawnFighter(0,COOP_KIND[a[1]]||'grunt');E.nid=nid;E.mesh.position.set(a[2],a[3],a[4]);E.mesh.quaternion.set(a[5],a[6],a[7],a[8]);COOP.foes.set(nid,E);}
    coopTarget(E,a,2,true);E.wvel.copy(E.nv);E.hp=a[12];E.maxHp=a[13];
  }
  for(const a of m.B){
    const nid=a[0];seen.add(nid);let E=COOP.foes.get(nid);
    if(!E){spawnBomber(0);E=bombers[bombers.length-1];E.nid=nid;E.mesh.position.set(a[1],a[2],a[3]);COOP.foes.set(nid,E);}
    coopTarget(E,a,1,false);E.hp=a[8];
  }
  for(const [nid,E] of COOP.foes)if(!seen.has(nid)){   // gone on the host: shot down (or left the fight)
    COOP.foes.delete(nid);
    for(const L of [fighters,bombers]){const i=L.indexOf(E);if(i>=0){
      E.dead=true;const q=E.mesh.position;spark(q,0xff5500,24,38);spark(q,0xffb300,12,28);burst(q,0xff7733,1.2);shatter(q,6,1);sfx('boom',q);
      scene.remove(E.mesh);L.splice(i,1);}}
    if(S.target===E)S.target=null;
  }
  // friendly ships: the host, the other pilots and every AI wingman
  const fseen=new Set();
  for(const a of m.P){
    if(a[0]===NET.id)continue;
    const id='p'+a[0];fseen.add(id);let o=COOP.friends.get(id);
    if(!o){const cfg=effectiveShip(shipById(a[12]||(SHIPS[0].id)));o={mesh:new THREE.Group(),name:a[13],q:a[14]};
      o.mesh.add(coopHull(cfg));addBeacon(o.mesh,SQUAD_DEFS[a[14]].col);o.mesh.position.set(a[1],a[2],a[3]);scene.add(o.mesh);COOP.friends.set(id,o);}
    coopTarget(o,a,1,true);o.hull=a[11];
  }
  for(const a of m.W){
    const id='w'+a[0];fseen.add(id);let o=COOP.friends.get(id);
    if(!o){o={mesh:buildWingman(a[14],a[1]),name:a[13],q:a[1]};   // an older host sends no hull: buildWingman picks one
      o.mesh.scale.setScalar(WING_SCALE);addBeacon(o.mesh,a[1]?SQUAD_DEFS[a[1]].col:0x00f0ff);o.mesh.position.set(a[2],a[3],a[4]);scene.add(o.mesh);COOP.friends.set(id,o);}
    coopTarget(o,a,2,true);o.pips=a[12];
  }
  for(const [id,o] of COOP.friends)if(!fseen.has(id)){COOP.friends.delete(id);const q=o.mesh.position;spark(q,0xff5500,20,34);burst(q,0xff7733,1.1);scene.remove(o.mesh);}
  // capitals that both games built (HALCYON): where the host has them
  for(const a of m.C){const K=capitals.find(o=>o.cid===a[0]);if(!K||!K.g)continue;coopTarget(K,a,1,false);K.hp=a[8];K.g.scale.z=a[10];
    if(K.state==='warp'&&a[9]!=='warp')coopCapArrive(K);
    const dead=a[11]||'',parts=K.parts||[];   // guns shot out on the host go out here too, with their blast
    parts.forEach((t,j)=>{if(dead[j]==='1'&&!t.dead)coopKillPart(t);});
    if(K.core&&dead[parts.length]==='1'&&!K.core.dead)coopKillPart(K.core);
    const sd=a[14]||'';(K.systems||[]).forEach((t,j)=>{if(sd[j]==='1'&&!t.dead)coopKillPart(t);});
    if(K.state==='fight'&&(a[9]==='dying'||a[9]==='wreck')){K.dead=true;capDie(K);}   // HALCYON or the escort going down
    if(K.lance){K.lance.sync=COOP_LANCE[a[12]]||'idle';K.lance.syncK=a[13]||0;}}
  // broadsides fired on the host: the same shells fly here, for the look of it (fleetShellsFrame; hits are the host's)
  for(const e of m.fs||[]){const C=capitals.find(o=>o.cid===e[0]),T=capitals.find(o=>o.cid===e[1]);if(!C||!T)continue;
    const g=new THREE.Mesh(sharedGeo('fleetShell',()=>new THREE.BoxGeometry(.9,.9,9)),fleetShellMat(C.friendly));g.visible=false;scene.add(g);
    fleetShells.push({m:g,from:C,to:T,local:new THREE.Vector3(e[3],e[4],e[5]),sys:null,miss:!!e[2],v:new THREE.Vector3(),t:0,life:0,delay:e[9],
      muzzle:new THREE.Vector3(e[6],e[7],e[8]),prev:new THREE.Vector3(),dmg:0,coop:true});}
  // enemy missiles: small stand-ins in eMsls, for the threat arrows
  while(eMsls.length>m.EM.length){const E=eMsls.pop();scene.remove(E.m);}
  m.EM.forEach((a,i)=>{let E=eMsls[i];if(!E){const g=new THREE.Mesh(sharedGeo('coopMsl',()=>new THREE.ConeGeometry(.35,2,6)),M.mag);scene.add(g);E={m:g,v:new THREE.Vector3(),life:9,coop:true};eMsls.push(E);}
    E.m.position.set(a[0],a[1],a[2]);});
  // bolts fired on the host (not your own: you already drew those)
  for(const e of m.ev){if(e[7]===NET.id)continue;
    fireBolt(e[0]?eBolts:pBolts,e[0]?M.boltE:M.boltP,sv0.set(e[1],e[2],e[3]),sv1.set(e[4],e[5],e[6]),sv1.length());}
  coopGuestBoard(m);
}
function coopDrift(dt){   // ease every stand-in toward where it should be now
  const k=Math.min(1,8*dt),age=Math.min(.4,S.time-(COOP.snapAt||S.time));
  const ease=o=>{if(!o.np)return;const g=o.g||o.mesh;cpP.copy(o.np);if(o.nv)cpP.addScaledVector(o.nv,age);g.position.lerp(cpP,k);g.quaternion.slerp(o.nq,k);};
  for(const E of COOP.foes.values())ease(E);
  for(const o of COOP.friends.values())ease(o);
  for(const K of capitals)ease(K);
}
/* capitals on a guest: the host runs them (guns, lance, death); here they arrive, smoke, aim their lance and break up
   on cue from the snapshots, with the same effects as js/update/capital.js */
const COOP_LANCE=['idle','charge','fire'];
function coopKillPart(E){E.hp=Math.min(E.hp,.5);hitCapPart(E,1,true);}   // a gun, subsystem or reactor the host has destroyed
function coopCapArrive(C){
  C.state='fight';C.g.scale.z=1;C.g.updateMatrixWorld(true);capAddCols(C);capTargets.push(...C.parts,...C.systems);
  tmp.copy(C.station||C.g.position).addScaledVector(C.hdg||sv0.set(0,0,0),C.hull.len*.55);burst(tmp,0x9fe8ff,5);spark(tmp,0x9fe8ff,40,70);sfx('boom',tmp);
}
function coopCapFrame(dt,p){
  for(let i=capitals.length-1;i>=0;i--){const C=capitals[i];
    C.t+=dt;C.g.updateMatrixWorld(true);
    if(C.cols.length)capSyncCols(C);
    for(const T of C.parts)T.head.getWorldPosition(T.mesh.position);
    if(C.core){C.core.dome.getWorldPosition(C.core.mesh.position);capUp.set(0,1,0).applyQuaternion(C.g.quaternion);C.core.mesh.position.addScaledVector(capUp,3);}
    if(C.systems.length&&C.state!=='wreck')fleetSystemsFrame(C,dt);
    if(C.gate&&C.spin&&C.state==='fight')C.spin.rotation.z+=.5*dt;
    if(C.state==='fight'&&!C.friendly&&!C.gate){
      if(C.shield&&C.shield.visible)C.mats.shield.opacity=.12+Math.sin(S.time*5)*.05+(Math.random()<.04?.15:0);
      else if(C.mats.core)C.mats.core.color.setHSL(.02,1,.45+Math.sin(S.time*9)*.15);
      for(const T of C.parts)if(T.dead){T.smokeT=(T.smokeT||0)-dt;if(T.smokeT<=0){T.smokeT=.22;puff(T.mesh.position,1);}}
      if(C.lance&&!C.lance.dead)coopLance(C,C.lance,dt);
    }else if(C.state==='dying')capDying(C,dt,p);
    else if(C.state==='wreck')capWreck(C,dt,p);
  }
  if(fleetShells.length)fleetShellsFrame(dt,p);
  capHudUpdate(p);
}
function coopLance(C,L,dt){   // the look of capLance, from the phase and progress the host sends
  const T=L.T,ph=L.sync||'idle',k=L.syncK||0;
  if(ph==='fire'&&L.phase!=='fire'){L.eye.getWorldPosition(sv0);sfx('bigboom',sv0);burst(sv0,0xffd0e0,4);spark(sv0,0xffd0e0,30,80);}
  if(ph==='charge'&&L.phase==='idle'&&S.annT<=0)announce(C.T.name+' LANCE CHARGING','Stay out of its line','ace');
  L.phase=ph;
  if(ph==='idle'){C.beam.visible=false;L.glow+=(0-L.glow)*Math.min(1,4*dt);}
  else if(ph==='charge'){L.glow=k;C.beam.visible=true;C.beam.scale.set(.25+k*.5,T.reach,.25+k*.5);C.beam.position.set(0,0,-T.reach/2);
    C.mats.beam.color.setHex(0xff4a6a);C.mats.beam.opacity=(.12+k*.35)*(Math.random()<.15?.4:1);}
  else{const j=1-k;C.beam.visible=true;C.beam.position.set(0,0,-T.reach/2);C.beam.scale.set(T.width*.8*(.6+j*.4),T.reach,T.width*.8*(.6+j*.4));
    C.mats.beam.color.setHex(0xffe0ea);C.mats.beam.opacity=.55+j*.4;}
  L.eye.scale.setScalar(1+L.glow*1.2);
  L.eyeMat.color.setHex(ph==='idle'?C.mats.P.eye:0xfff0f4);
  C.mats.neon.color.setHex(ph==='idle'?C.mats.P.neon:(Math.random()<.5?0xffe0ea:C.mats.P.neon));
}
/* your bolts and the host's: they fly and spark on what they reach, but only the host's game decides hits */
function coopGuestCollide(fr){
  const {dt,p,prevP}=fr;
  arenaShipHit(prevP,p);   // rocks and hulls are the same in both games
  for(let i=pBolts.length-1;i>=0;i--){const B=pBolts[i];
    sv0.copy(B.m.position);B.m.position.addScaledVector(B.v,dt);B.life-=dt;
    let dead=B.life<=0||arenaSegHit(sv0,B.m.position);
    for(const L of [fighters,bombers])for(let j=0;j<L.length&&!dead;j++)
      if(segSphere(sv0,B.m.position,L[j].mesh.position,L[j].T?L[j].T.r:4.5)){dead=true;spark(B.m.position,0x00f0ff,5);hitMarker('hit');}
    if(dead){scene.remove(B.m);pBolts.splice(i,1);}
  }
  for(let i=eBolts.length-1;i>=0;i--){const B=eBolts[i];
    sv1.copy(B.m.position);B.m.position.addScaledVector(B.v,dt);B.life-=dt;
    let dead=B.life<=0||arenaSegHit(sv1,B.m.position)||segSphere(sv1,B.m.position,p,3.6);
    if(!dead&&!B.near&&segSphere(sv1,B.m.position,p,NEAR_MISS_R)){B.near=true;sfx('whiz',B.m.position);}
    if(dead){scene.remove(B.m);eBolts.splice(i,1);}
  }
}
/* the guest's squadron board: every squadron's order and its pilots, from the snapshot */
function coopGuestBoard(m){
  const q0=COOP.me?COOP.me.slot:1;let h='';
  for(let q=0;q<squadrons.length;q++){
    const mem=m.W.filter(a=>a[1]===q),lead=m.P.find(a=>a[14]===q&&a[0]!==NET.id);
    if(!mem.length&&!lead&&q!==q0)continue;
    h+='<div class="sqb'+(q===q0?' mine':'')+'"><div class="sqh" style="--c:'+ORD_COL[q]+'"><i></i><b>'+SQUAD_DEFS[q].name+'</b><span>'+(m.SQ[q]||'')+'</span></div>';
    if(q===q0)h+='<div class="sqp">YOU <span class="wown">leading</span></div>';
    else if(lead)h+='<div class="sqp">'+lead[13]+'</div>';
    for(const a of mem)h+='<div class="sqp">'+a[13]+' <span class="wbar">'+'▮'.repeat(a[12])+'<i>'+'▮'.repeat(5-a[12])+'</i></span></div>';
    h+='</div>';
  }
  if(!ORD.used)h+='<div class="sqk"><b>1-6</b> order your squadron</div>';
  wingHud.style.display='block';wingHud.innerHTML=h;
}
/* ---- both ---- */
/* callsign tags over the other players' ships */
const coopTagPool=[];
function coopTags(){
  let n=0;
  const put=(pos,name,col)=>{
    sv0.copy(pos).project(camera);if(sv0.z>=1||Math.abs(sv0.x)>1||Math.abs(sv0.y)>1)return;
    let el=coopTagPool[n];if(!el){el=document.createElement('div');el.className='coTag';coopTagsBox.appendChild(el);coopTagPool.push(el);}
    n++;el.style.display='block';el.textContent=name;el.style.color=col;
    el.style.left=((sv0.x*.5+.5)*innerWidth).toFixed(1)+'px';el.style.top=((-sv0.y*.5+.5)*innerHeight).toFixed(1)+'px';
  };
  if(COOP.live&&S.mode==='play'){
    if(netHost())for(const w of wingmen)if(w.human&&!w.dead)put(w.mesh.position,w.callsign,ORD_COL[w.sq]);
    if(netGuest())for(const [id,o] of COOP.friends)if(id[0]==='p')put(o.mesh.position,o.name,ORD_COL[o.q]);
  }
  for(let i=n;i<coopTagPool.length;i++)coopTagPool[i].style.display='none';
}
/* a run ends: the host's ends everyone's; a guest shot down tells the host */
function coopRunEnd(win,cause){
  if(!COOP.live)return;
  if(netHost())netSend({t:'end',win,cause:win?'':'The lead was shot down: '+(cause||'')});
  else if(!COOP.ended)netSend({t:'dead'});
  COOP.live=false;coopClearStandIns();
}
function coopLost(why){
  const was=COOP.live;COOP.live=false;if(NET.tx)NET.tx.close();NET.role='';NET.tx=null;
  if(was&&S.mode==='play'){COOP.ended=true;endGame(false,why);}
  coopNote=why;if(!$('coop').classList.contains('hidden'))renderCoop();
}
function coopClearStandIns(){
  for(const o of COOP.friends.values())scene.remove(o.mesh);
  COOP.friends.clear();COOP.foes.clear();
  for(const el of coopTagPool)el.style.display='none';
}

/* the admiral seat: the host doesn't fly. Their ship is parked out of the fight over HALCYON (hidden, and nothing hurts it),
   their own wing defends HALCYON, and the bridge stays open (the holo table) for the whole run; Esc pauses. Enemy fighters
   go for the pilots (pickFoes), and the bridge runs at full speed in co-op like everything else (js/loop.js). */
function coopAdmiralStart(){
  S.admiral=true;shipVis.visible=false;S.wingOrder='defend';
  if(squadrons[0])squadrons[0].order='defend';
}
function coopAdmiralTick(){
  if(!S.admiral||S.mode!=='play')return;
  const K=carrierShip();
  if(K){ship.position.copy(K.g.position);ship.position.y+=(K.hull?K.hull.h:30)*3+60;}
  S.vel.set(0,0,0);S.hull=Math.max(S.hull,1);
  if(!S.bridge&&bridgeAvailable()){bridgeOpen();if(bdgView!=='holo')bdgSetView('holo');}
}
