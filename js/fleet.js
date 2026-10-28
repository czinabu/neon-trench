"use strict";
/* Fleet battles (missions with `fleet:true`): HALCYON and the destroyer SOLACE hold a line, MAW and VESPER warp
   in across from them, and the two lines trade broadsides. Numbers are in js/data/capitals.js (FLEET).

   The player's job is the enemy capitals' subsystems: the shield generator (drops the reactor shield and lets
   the fleet's broadsides bite), the engines (stops the ship closing on HALCYON, and the frigate swinging its
   lance) and the bridge (fire control). An enemy capital goes when its reactor is destroyed or its hull runs
   out under the broadsides. The per-frame hooks are called from js/update/capital.js.

   From the command bridge (js/bridge.js) HALCYON and SOLACE take orders: C.focus pins their broadsides on one
   enemy capital (C.focusSys on one of its subsystems), and C.stance moves them (hold, close in, return to station).
   Movement orders (fleetMoveTo, fleetFallBack, fleetHold, fleetFormation, fleetSetStance below) are plain functions on a
   friendly capital, so the bridge and a mission script give them the same way. C.goal is a waypoint the ship steers to
   (it takes priority over everything else); C.form keeps SOLACE in a slot off HALCYON.

   Admiral ops (Act IV) put more destroyers in the friendly line (spawnAlly: the op's `allies`, and a `reserve` called in
   from the bridge with fleetCallReserve), and fleetAll gives one order to every friendly capital at once (the bridge's
   FLEET row). The Kiru Gate (spawnKiruGate, gateFrame) sits behind the enemy line and sends ships through until its three
   anchors are shot out.

   Every fleet ship has a role (C.role, FLEET.roles): line, screen or artillery. It decides what the ship does when no order
   moves it (fleetStance for the friendly line, fleetAdvance for the enemy's: a screen keeps between its ward and the enemy,
   artillery stands off) and how it fights (fleetSalvo: artillery hits harder from further out; fleetCatch: a screen takes
   shells meant for its ward). Destroyers holding a fleet-wide formation slot get its effect (C.inForm, FLEET.formFx). In
   Admiral ops the enemy line answers to an admiral aboard its flagship (js/enemyadm.js), who picks what its guns go for
   and where its screens stand. */

const fleetShells=[];   // broadside shells {m,from,to,local,miss,v,t,life,delay,muzzle,prev}
const fsA=new THREE.Vector3(), fsB=new THREE.Vector3(), fsC=new THREE.Vector3();
const FLEET_SYS_AT={   // [half, x, y, z] in the ship's frame (-z is the bow)
  cruiser:{shieldgen:['aft',0,19,8],engines:['aft',0,14,78],bridge:['aft',0,31,21.6]},
  frigate:{shieldgen:['fore',0,5,-15],engines:['aft',0,5,84],bridge:['aft',0,14,32.6]},
};
const FLEET_BATTERIES={   // friendly broadside guns on the deck, [half, x, y, z]
  escort:[['fore',0,14,-50],['fore',0,14,-20],['aft',0,15,5],['aft',0,15,65]],
  carrier:[['fore',-24,18,-100],['fore',24,18,-100],['aft',-20,18,100]],
};
const FLEET_SHELL_MAT={};
function fleetShellMat(friend){
  const k=friend?'f':'e';
  return FLEET_SHELL_MAT[k]||(FLEET_SHELL_MAT[k]=new THREE.MeshBasicMaterial({color:friend?0x7ff4ff:0xff5a7a,
    blending:THREE.AdditiveBlending,transparent:true,opacity:.95,depthWrite:false}));
}

/* SOLACE: a lean destroyer in HALCYON's colours, with four broadside batteries down its spine */
CAP_PALETTE.escort={neon:0x00f0ff,eng:0x1f9cff,window:0xbfe8ff,eye:0x00f0ff};
CAP_PALETTE.ally={neon:0x6dffb0,eng:0x2fd89a,window:0xd8ffe8,eye:0x6dffb0};    // the Rim's other destroyers (BASTION, MERIDIAN)
CAP_PALETTE.flag={neon:0xffc23c,eng:0xffaa30,window:0xffe6a8,eye:0xffc23c};    // the syndicate flagship SOVEREIGN
CAP_PALETTE.gate={neon:0xff3a6a,eng:0xff2d78,window:0xffb36b,eye:0xff5a7a};
CAP_BUILD.escort=function(C){
  const mt=capHullMaterials(),{fore,aft}=C,K=capKit(C),P=CAP_PROF,rng=capRng(3);
  capCol(C,fore,0,0,-100,10,6,30,'the destroyer bow');
  capCol(C,fore,0,0,-35,13,8,35,'the destroyer hull');capCol(C,aft,0,0,45,14,9,45,'the destroyer hull');
  capCol(C,fore,0,11,-35,7,3,30,'the destroyer deck');capCol(C,aft,0,12,40,8,3,40,'the destroyer deck');
  capCol(C,aft,0,21,22,5,6,7,'the destroyer bridge');
  capCol(C,aft,0,0,99,17,11,9,'the destroyer engines');
  // a long arrowhead hull, the battery deck down its back, neon on the chine and lit windows below it
  const hull=[[-133,1,1,-1.5],[-112,6.5,4.4,-.6],[-72,12.4,7.5,0],[-30,13,8,0],[10,14,9,0],[88,14,9,0],[91,13,8.2,0]];
  K.loft(mt.cHull,P.dd,hull);
  K.loft(mt.cHull2,P.deck,[[-68,3.6,1.6,10],[-62,7,3,11],[-8,7,3,11],[-1,8,3,12],[78,8,3,12],[82,6,2.4,11.4]]);
  K.loft(mt.cHull2,P.keel,[[-90,2,1,-8.4],[-80,4,1.6,-9],[80,4,1.6,-9.6],[86,2,1,-9.2]]);
  K.strip(mt.cTrim,P.dd,hull,1,.8,.2).strip(C.mats.neon,P.dd,hull,2,.6,.2);
  K.windows(C.mats.window,rng,14.1,0,-30,86,2.8,1.4).windows(C.mats.window,rng,13.1,0,-70,-32,3.2,1.4);
  for(let z=-66;z<86;z+=11)for(const sx of[-1,1])K.at(z,mt.cHull2).box(.7,5.4,1.1,sx*(z<0?13.2:14.2),.7,z);
  for(const sx of[-1,1])K.greeble(mt.cHull2,rng,sx*7.6,sx*12,8,-66,86,44,null,.6);
  for(const sx of[-1,1])K.greeble(mt.cHull,rng,sx*3.4,sx*6.6,15,-60,78,18,[[0,-50,4],[0,-20,4],[0,5,4],[0,22,9],[0,65,4]],.45);
  // the bridge: a tower with its lit band, a mast and a crossbar of aerials
  K.loft(mt.cTrim,P.box,[[15.2,4.6,6,21],[28.8,5,6,21]]);
  K.aft(C.mats.window).box(10.4,1.4,14.4,0,24,22);
  K.aft(mt.cHull2).box(.6,8,.6,0,31,24).box(6,.35,.35,0,33,24);
  // engine bank with radiator slats and three drives
  K.loft(mt.cHull2,P.box,[[88,14,9,0],[92,17,11,0],[108,17,11,0]]);
  for(const sx of[-1,1])for(let z=94;z<107;z+=1.8)K.at(z,mt.cHull).box(.6,16,.6,sx*17.2,0,z);
  for(const [x,y] of [[-10,2],[10,2],[0,-6]])capEngine(C,K,x,y,108,4,5);
  for(const [x,y,z] of [[0,-2,-132],[-17,12,108],[17,12,108],[0,35.6,24],[-14.3,3,-20],[14.3,3,-20],[-14.3,3,50],[14.3,3,50]])
    capLight(z<0?fore:aft,x,y,z,0x00f0ff);
  K.done();
  C.hull={w:26,h:16,z0:-130,z1:108,len:240};
};

/* a deck battery: an armoured house on a turntable and a twin long-barrelled head that swings onto the ship
   it is firing at (+z is its muzzle) */
function fleetBattery(C,half,x,y,z){
  const mt=capHullMaterials(),base=new THREE.Group();base.position.set(x,y,z);half.add(base);
  capPart(base,new THREE.CylinderGeometry(2.4,3,1.8,14),mt.hull2,0,.9,0);
  capPart(base,new THREE.CylinderGeometry(3.3,3.4,.4,14),mt.metal,0,.2,0);
  const head=new THREE.Group();head.position.set(0,2.8,0);base.add(head);
  const house=capLoftGeo(CAP_PROF.deck,[[-2.2,2.1,1.1,0],[1.2,2.1,1.1,0],[2.4,1.4,.7,-.3]]);capWorldUV(house,6);
  capPart(head,house,mt.cTrim,0,0,0);
  for(const bx of[-.8,.8]){
    capPart(head,new THREE.CylinderGeometry(.3,.38,5.5,8),mt.hull2,bx,0,3.6).rotation.x=Math.PI/2;
    capPart(head,new THREE.CylinderGeometry(.46,.46,.9,8),mt.metal,bx,0,6.3).rotation.x=Math.PI/2;
  }
  capPart(head,new THREE.BoxGeometry(2.6,.25,.25),C.mats.neon,0,.9,1.25);
  return head;
}
/* a friendly capital joins the fleet: deck batteries and a broadside timer */
function fleetArm(C){
  C.fleet=true;C.salvoT=2+Math.random()*2;C.bTgt=null;C.focus=C.focusSys=null;C.stance='hold';C.goal=null;C.goalT=0;C.retreat=false;C.form='free';
  C.role='line';C.held=false;C.inForm=null;C.withdraw=0;C.wardName=null;   // C.held: parked by Hold here, Hold position or a waypoint, so its role doesn't move it
  C.batteries=(FLEET_BATTERIES[C.kind]||[]).map(([h,x,y,z])=>fleetBattery(C,C[h],x,y,z));
}
/* an enemy capital's three subsystems; they sit on the hull and are shot like its guns (at and spec: a Kiru Gate anchor's) */
function fleetSystem(C,kind,at,spec){
  const [h,x,y,z]=at||FLEET_SYS_AT[C.kind][kind],mt=capHullMaterials();spec=spec||FLEET.systems[kind];
  const base=new THREE.Group();base.position.set(x,y,z);C[h].add(base);
  const head=new THREE.Group();base.add(head);
  let eyeMat,eye,ring=null;
  if(kind==='shieldgen'){   // a mast with a glowing emitter and a ring spinning round it
    capPart(base,new THREE.CylinderGeometry(1.2,2.4,6,10),mt.hull2,0,3,0);
    head.position.set(0,7.5,0);
    eyeMat=new THREE.MeshBasicMaterial({color:0x5fe8ff});
    ring=capPart(head,new THREE.TorusGeometry(4.2,.35,6,24),eyeMat,0,0,0);ring.rotation.x=Math.PI/2;
    eye=capPart(head,new THREE.SphereGeometry(2.2,14,10),eyeMat,0,0,0);
  }else if(kind==='anchor'){   // a Kiru Gate anchor: an armoured pylon on the ring with a glowing emitter
    capPart(base,capBox(16,22,26),mt.hull2,0,0,0);
    head.position.set(0,13,0);
    eyeMat=new THREE.MeshBasicMaterial({color:C.mats.P.eye});
    ring=capPart(head,new THREE.TorusGeometry(5.5,.5,6,24),eyeMat,0,0,0);ring.rotation.x=Math.PI/2;
    eye=capPart(head,new THREE.SphereGeometry(3.2,14,10),eyeMat,0,0,0);
  }else if(kind==='engines'){   // a vented drive housing glowing in the engine colour
    capPart(base,capBox(12,3,8),mt.hull2,0,1.5,0);
    head.position.set(0,3.6,0);
    eyeMat=C.mats.eng.clone();eyeMat.opacity=.9;
    for(const sx of[-3.5,0,3.5])capPart(head,capBox(2.2,1.4,6),eyeMat,sx,0,0);
    eye=head.children[1];
  }else{   // the bridge: a lit command deck across the front of the tower
    eyeMat=new THREE.MeshBasicMaterial({color:0xfff0c8});
    capPart(base,capBox(12.4,3.4,.8),mt.hull2,0,0,.3);
    eye=capPart(head,capBox(11,1.6,.6),eyeMat,0,.4,-.2);
  }
  const E=capPartEntity(C,kind,spec,{sys:true,base,head,eye,eyeMat,ring,up:1});
  C.systems.push(E);return E;
}
function fleetSystems(C){for(const k of ['shieldgen','engines','bridge'])fleetSystem(C,k);}
/* a subsystem shot off (called from hitCapPart after the blast) */
function fleetSystemDown(C,E){
  S.sysDown++;
  const scorch=capHullMaterials().scorch;
  if(E.kind==='shieldgen'){
    E.head.visible=false;E.base.children[0].material=scorch;
    const cp=C.core.mesh.position;burst(cp,0x5fe8ff,3);spark(cp,0x5fe8ff,30,40);sfx('shieldhit',cp);
    C.shield.visible=false;if(!capTargets.includes(C.core))capTargets.push(C.core);
    announce('SHIELDS DOWN',C.T.name+' is open to the fleet\'s guns. Hit the reactor','ace');fleetTip('focus',C.T.name);
  }else if(E.kind==='engines'){
    E.head.children.forEach(m=>m.material=scorch);C.adrift=true;C.mats.eng.opacity=.12;
    announce('ENGINES DOWN',C.T.name+' is dead in space','ace');
  }else if(E.kind==='anchor'){
    E.head.visible=false;E.base.children[0].material=scorch;
    const left=C.systems.filter(o=>!o.dead).length;
    if(!left){gateCollapse(C);return;}
    announce('ANCHOR DOWN',left+' left holding '+C.T.name+' open','ace');
  }else{
    E.eye.material=scorch;C.blind=true;C.mats.window.color.setHex(0x1a1008);
    announce('BRIDGE DOWN',C.T.name+' has lost fire control','ace');
  }
}
function fleetSystemsFrame(C,dt){
  for(const E of C.systems){
    E.head.getWorldPosition(E.mesh.position);
    if(E.dead){E.smokeT-=dt;if(E.smokeT<=0){E.smokeT=.2;puff(E.mesh.position,1);if(Math.random()<.35)spark(E.mesh.position,0xff7733,2,8);}continue;}
    if(E.ring)E.ring.rotation.z+=2.5*dt;
    E.eye.scale.setScalar(1+Math.sin(S.time*6+E.t)*.08);
  }
}

/* SOLACE takes station beside HALCYON, facing the enemy line */
const spawnEscort=()=>spawnAlly(ESCORT_TYPE.name,FLEET.escortAt);
/* a destroyer joins the friendly line near `at` (an array or Vector3), facing the enemy: SOLACE in HALCYON's colours, any
   other in the allies' green. warp: it drops out of warp there (the reserve) rather than starting on station. role: FLEET.roles */
function spawnAlly(name,at,warp,role){
  const C=capNew('escort',Object.assign({},ESCORT_TYPE,{name}),true,name===ESCORT_TYPE.name?null:'ally');
  C.hp=Math.round(C.T.hp*carryHull(name));C.formIdx=capitals.filter(o=>o.kind==='escort').length;   // its formation slot (FLEET.form)
  C.station=new THREE.Vector3();C.hdg=new THREE.Vector3();
  if(Array.isArray(at))fsA.fromArray(at);else fsA.copy(at);
  capStation(C.station,C.hdg,C.hull.len,fsA,0,warp?60:90,20,fsB.set(0,0,S.fleetLine[0].at[2]));
  capPlace(C);scene.add(C.g);capitals.push(C);
  if(warp){C.g.position.addScaledVector(C.hdg,-1400);C.g.scale.set(1,1,6);}   // capShip brings it in (state 'warp')
  else{C.state='fight';C.g.updateMatrixWorld(true);capAddCols(C);}
  fleetArm(C);C.role=FLEET.roles[role]?role:'line';
  return C;
}
/* an Admiral op's extra ships: its allies on station, and the Kiru Gate if it has one */
function fleetSetup(m){
  if(!m)return;
  for(const a of m.allies||[])spawnAlly(a.name,a.at,false,a.role);
  if(m.gate)spawnKiruGate(m.gate);
}
/* the enemy line warps in on its schedule (S.fleetN of it is in so far); once all of it is in, and the Kiru Gate has
   nothing more to send, killing it clears the zone */
function fleetSpawns(){
  const next=S.fleetLine[S.fleetN];
  if(!next){if(!gateOpen())S.capSpawned=true;return;}
  if(S.time>=next.t){spawnCapital(next.kind,S.fleetN);S.fleetN++;}
}
/* an enemy capital's movement while its engines run, by role: a screen keeps between its ward and your fleet, artillery
   keeps its distance, and a line ship closes on HALCYON down to closeTo (faster and closer while its admiral pursues). A
   ship its admiral has pulled back (C.withdraw) runs from HALCYON first. */
function fleetAdvance(C,dt){
  C.wvel.set(0,0,0);
  if(C.adrift)return;
  const K=carrierShip()||friendlyCaps()[0];if(!K)return;
  let dest=K.g.position,stop=FLEET.closeTo,spd=FLEET.advance,W=null;
  if(C.withdraw>0){C.withdraw-=dt;fsF.copy(C.g.position).sub(K.g.position).setY(0).setLength(200).add(C.g.position);dest=fsF;stop=0;spd*=1.6;}
  else if(C.role==='screen'&&(W=fleetWard(C))&&fleetGuardSpot(C,W,fsF)){dest=fsF;stop=25;spd=FLEET.closeSpd*1.3;}
  else if(C.role==='artillery'){if(!fleetStandOff(C,fsF,true))return;dest=fsF;stop=10;}
  else if(admOn()&&S.adm.plan==='pursue'){stop=ADMIRAL.pursueTo;spd*=ADMIRAL.pursue;}
  fleetSteer(C,dest,stop,spd,dt,W);
}
/* who a screen guards: HALCYON for the friendly line; for the enemy, the ship its admiral is covering, else the ship its
   line entry names (`ward`), else the flagship */
function fleetWard(C){
  if(C.friendly){const K=carrierShip();return K&&K.state==='fight'?K:null;}
  const ok=o=>!!o&&o!==C&&o.state==='fight'&&!o.dead,A=S.adm;
  if(admOn()&&ok(A.cover))return A.cover;
  const n=C.wardName&&capitals.find(o=>o.T.name===C.wardName&&ok(o));
  if(n)return n;
  return A&&ok(A.C)?A.C:null;
}
/* the other side's battle line (ships that fire broadsides) */
const fleetFoesOf=C=>capitals.filter(o=>o.friendly!==C.friendly&&o.fleet&&!o.gate&&o.state==='fight'&&!o.dead);
/* where a screen stands: FLEET.roles.screen.at metres out from its ward toward the middle of the other line, a second or third
   screen on the same ward spaced out to either side */
function fleetGuardSpot(C,W,out){
  const foes=fleetFoesOf(C);if(!foes.length)return false;
  out.set(0,0,0);for(const o of foes)out.add(o.g.position);
  out.multiplyScalar(1/foes.length).sub(W.g.position);out.y=0;
  if(out.lengthSq()<1)return false;
  out.normalize();
  const mates=capitals.filter(o=>o.role==='screen'&&o.friendly===C.friendly&&o.state==='fight'&&!o.dead&&fleetWard(o)===W),i=Math.max(0,mates.indexOf(C));
  const side=i?(i%2?1:-1)*Math.ceil(i/2)*170:0;
  fsG.set(-out.z,0,out.x);
  return out.multiplyScalar(FLEET.roles.screen.at).addScaledVector(fsG,side).add(W.g.position);
}
/* artillery: a point that opens the range to the nearest enemy ship back out to FLEET.roles.artillery.keep (advance: or
   closes it to that, for the enemy's artillery); false if it is about right */
function fleetStandOff(C,out,advance){
  let E=null,bd=1e9;
  for(const o of fleetFoesOf(C)){const d=o.g.position.distanceTo(C.g.position);if(d<bd){bd=d;E=o;}}
  if(!E)return false;
  const keep=FLEET.roles.artillery.keep;
  if(bd<keep-40){out.copy(C.g.position).sub(E.g.position).setY(0).setLength(keep-bd+30).add(C.g.position);return true;}
  if(advance&&bd>keep+80){out.copy(E.g.position).sub(C.g.position).setY(0).setLength(bd-keep).add(C.g.position);return true;}
  return false;
}
/* ---- movement orders: each takes a friendly fleet capital and returns false if it can't be given ---- */
const FLEET_FORMS={free:'Free',line:'Line abreast',column:'Column',screen:'Screen'};
const fsD=new THREE.Vector3(), fsE=new THREE.Vector3(), fsF=new THREE.Vector3(), fsG=new THREE.Vector3(), fsH=new THREE.Vector3();
const fleetMovable=C=>!!C&&C.fleet&&C.friendly&&C.state==='fight'&&!C.dead;
/* steer to a world point (an array or Vector3), kept inside the arena; it holds there on arrival */
function fleetMoveTo(C,pos){
  if(!fleetMovable(C))return false;
  const g=C.goal||(C.goal=new THREE.Vector3());
  if(Array.isArray(pos))g.fromArray(pos);else g.copy(pos);
  if(g.length()>fleetEdge(C))g.setLength(fleetEdge(C));
  C.goalT=FLEET.goalTime;C.retreat=false;C.stance='hold';C.form='free';
  return true;
}
/* pull back from the enemy line: a point FLEET.retreat metres directly away from the enemy capitals */
function fleetFallBack(C){
  if(!fleetMovable(C))return false;
  fsD.set(0,0,0);let n=0;
  for(const o of capitals)if(!o.friendly&&o.state==='fight'){fsD.add(o.g.position);n++;}
  if(n)fsD.multiplyScalar(1/n);else fsD.copy(C.station).addScaledVector(C.hdg,FLEET.retreat);   // nobody to run from: the stern of the line
  fsE.copy(C.g.position).sub(fsD);fsE.y=0;
  if(fsE.lengthSq()<1)fsE.set(0,0,1);
  fsE.setLength(FLEET.retreat).add(C.g.position);
  if(!fleetMoveTo(C,fsE))return false;
  C.retreat=true;return true;
}
/* stop where it is and drop any waypoint, formation or return to station */
function fleetHold(C){
  if(!fleetMovable(C))return false;
  C.goal=null;C.retreat=false;C.stance='hold';C.form='free';C.held=true;return true;
}
function fleetSetStance(C,st){
  if(!fleetMovable(C)||!BDG_STANCES.some(s=>s[0]===st))return false;
  C.goal=null;C.retreat=false;C.form='free';C.stance=st;C.held=st==='hold';return true;
}
/* a destroyer's role (FLEET.roles); it drops a Hold so the role can move it */
function fleetSetRole(C,role){
  if(!fleetMovable(C)||C.kind!=='escort'||!FLEET.roles[role])return false;
  C.role=role;C.held=false;return true;
}
/* SOLACE takes a slot off HALCYON and keeps it as HALCYON moves: 'free' | 'line' | 'column' | 'screen' */
function fleetFormation(form,C){
  C=C||capitals.find(o=>o.kind==='escort');
  if(!fleetMovable(C)||C.kind!=='escort'||!FLEET_FORMS[form])return false;
  C.goal=null;C.retreat=false;C.stance='hold';C.form=form;C.held=false;return true;
}
/* ---- fleet-wide orders (the bridge's FLEET row, Admiral ops): one order to every friendly capital that can take it.
   'engage' T (an enemy capital, sys one of its parts): every ship focuses its broadsides on it and the destroyers close to
   gun range, while HALCYON fires from where she is. 'free' lifts the focus; 'hold' and 'back' are stances; 'retreat'
   falls back; 'form' puts the destroyers in formation T off HALCYON ('line' | 'column' | 'screen', the default).
   Counts in S.fleetOrders; false if no ship took it. ---- */
const fleetShips=()=>capitals.filter(fleetMovable);
function fleetAll(o,T,sys){
  let n=0;
  if(o==='engage'&&!(T&&T.fleet&&!T.friendly&&T.state==='fight'))return false;
  for(const C of fleetShips()){
    if(o==='engage'){C.focus=C.bTgt=T;C.focusSys=sys&&sys.ship===T?sys:null;if(C.kind==='carrier'||fleetSetStance(C,'close'))n++;}
    else if(o==='free'){C.focus=C.focusSys=null;n++;}
    else if(o==='retreat'){if(fleetFallBack(C))n++;}
    else if(o==='form'){if(C.kind==='escort'&&fleetFormation(T||'screen',C))n++;}
    else if(fleetSetStance(C,o))n++;   // 'hold' | 'back'
  }
  if(n)S.fleetOrders++;
  return n>0;
}
/* what the fleet is engaging, if every ship that can fire is on the same mark (for the FLEET row) */
function fleetMark(){
  const ships=fleetShips(),f=ships.length&&ships[0].focus;
  return f&&ships.every(C=>C.focus===f)?f:null;
}
/* the reserve destroyer (an op's `reserve`) warps in at a point on the map, once per op */
const reserveReady=()=>!!S.reserveDef&&!S.reserveUsed&&toolOn('reserve');
function fleetCallReserve(pos){
  if(!reserveReady())return false;
  S.reserveUsed=true;
  const C=spawnAlly(S.reserveDef.name,pos,true,S.reserveDef.role);
  sfx('elaunch',C.station);announce('RESERVE COMMITTED',C.T.name+' warping in','ace');
  return true;
}
/* where a formation puts SOLACE: relative to HALCYON's bow and starboard side (null if free, or HALCYON is gone) */
function fleetFormSlot(C,out){
  const K=carrierShip();
  if(!K||C.kind!=='escort'||C.form==='free'||!FLEET.form[C.form])return null;
  const sl=FLEET.form[C.form],f=sl[(C.formIdx||0)%sl.length];
  fsE.set(0,0,-1).applyQuaternion(K.g.quaternion);fsE.y=0;fsE.normalize();
  out.set(-fsE.z,0,fsE.x);   // starboard
  return out.multiplyScalar(f[0]).addScaledVector(fsE,f[1]).add(K.g.position);
}
/* how far out from the arena's centre a hull's middle may sit with its nose still inside the wall */
const fleetEdge=C=>ARENA_R-60-C.hull.len*.5;
const FLEET_SWING=[.35,-.35,.7,-.7,1.05,-1.05,1.4,-1.4];   // headings tried, in radians off the straight line, when something is in the way
/* is a rock, a derelict or another hull in the way of heading `dir`? (looked for past the bow; `ignore`: a ship it means to
   stay close to, such as a screen's ward) */
function fleetBlocked(C,dir,ignore){
  const clear=Math.max(30,C.hull.w*.5+15);   // rock, the derelict station and the wrecked cruiser: two looks ahead, wide enough for the beam
  for(const ahead of [40,130]){fsC.copy(C.g.position).addScaledVector(dir,C.hull.len*.5+ahead);if(fleetSdf(fsC,clear+60,C,ignore)<clear)return true;}
  fsC.copy(C.g.position).addScaledVector(dir,C.hull.len*.5+60);
  for(const o of capitals)if(o!==C&&o!==ignore&&o.state!=='wreck'&&!(o.kind==='carrier'&&C.form!=='free'&&!C.goal)&&fsC.distanceTo(o.g.position)<(C.hull.len+o.hull.len)*.35)return true;
  return false;
}
/* arenaSdf without the moving ship's own hull (or its ward's) */
function fleetSdf(wp,reach,C,ignore){
  let d=1e9;
  for(const e of arenaCols){
    if(wp.distanceTo(e.c0)-e.br>Math.min(d,reach)||C.cols.includes(e)||ignore&&ignore.cols.includes(e))continue;
    d=Math.min(d,colSdf(e,wp));
  }
  return d;
}
/* move toward `dest` at spd, swinging round rock and hulls in the way and stopping at the arena's edge: 'there' once within
   `stop` of it, 'moved', or false if it couldn't move this frame */
function fleetSteer(C,dest,stop,spd,dt,ignore){
  fsA.copy(dest).sub(C.g.position);
  if(fsA.length()<=stop)return 'there';
  fsA.y*=.3;fsA.normalize();
  if(fleetBlocked(C,fsA,ignore)){   // rock or another hull dead ahead: swing round it (the nearest clear heading off the straight line), or wait if there is none
    let clear=false;
    for(const a of FLEET_SWING){
      fsB.copy(fsA).applyAxisAngle(AP_UP,a);
      if(!fleetBlocked(C,fsB,ignore)){fsA.copy(fsB);clear=true;break;}
    }
    if(!clear)return false;
  }
  fsB.copy(C.g.position).addScaledVector(fsA,spd*dt);
  if(fsB.length()>fleetEdge(C)&&fsB.length()>C.g.position.length())return false;   // the arena's edge
  C.g.position.addScaledVector(fsA,spd*dt);
  C.wvel.copy(fsA).multiplyScalar(spd);
  return 'moved';
}
/* a friendly capital's movement each frame, in priority order: a waypoint, RETURN TO STATION (the position it started
   on), its formation slot, CLOSE IN (closes on its broadside target down to nearRange, or farRange for artillery: better
   odds for its guns, and for the enemy's), then its role: a screen keeps between HALCYON and the enemy, artillery backs
   off to its range. HOLD (C.held) stays where it is. */
function fleetStance(C,dt){
  C.wvel.set(0,0,0);C.inForm=null;
  if(C.form!=='free'&&!C.goal)S.formT+=dt;
  let dest=null,stop=FLEET.closeSpd*dt*2,spd=FLEET.closeSpd,W=null;
  if(C.goal){
    C.goalT-=dt;if(C.goalT<=0){fleetHold(C);return;}
    dest=C.goal;stop=Math.max(stop,14);
  }
  else if(C.stance==='back')dest=C.station;
  else if(C.form!=='free'){
    dest=fleetFormSlot(C,fsD);stop=20;spd*=1.4;
    if(dest&&dest.distanceTo(C.g.position)<FLEET.formNear)C.inForm=C.form;
  }
  else if(C.stance==='close'&&C.bTgt){dest=C.bTgt.g.position;stop=C.role==='artillery'?FLEET.farRange-60:FLEET.nearRange;}
  else if(!C.held&&C.kind==='escort'){
    if(C.role==='screen'&&(W=fleetWard(C))&&fleetGuardSpot(C,W,fsD)){dest=fsD;stop=25;spd*=1.3;}
    else if(C.role==='artillery'&&fleetStandOff(C,fsD,false)){dest=fsD;stop=10;}
  }
  if(!dest)return;
  const r=fleetSteer(C,dest,stop,spd,dt,W);
  if(r==='there'){if(C.goal)fleetHold(C);else if(C.stance==='back')C.stance='hold';}
  else if(r==='moved'&&C.kind==='carrier')S.carMoved+=spd*dt;
}
/* the frigate's lance: you when you're close, otherwise HALCYON */
function fleetLanceAim(C,p){
  if(!C.fleet)return p;
  const L=C.lance;
  if(L.phase==='idle'){const K=carrierShip();L.aimK=K&&C.g.position.distanceTo(p)>500?K:null;}
  return L.aimK&&!L.aimK.dead?L.aimK.g.position:p;
}
/* enemy fire is spread over the friendly line; the fleet's guns favour a ship whose shield is down */
function fleetPick(C,foes){
  if(!foes.length)return null;
  if(!C.friendly){
    const f=admOn()&&S.adm.focus;   // the admiral's mark draws most of the fire
    if(f&&foes.includes(f)&&Math.random()<ADMIRAL.focusP)return f;
    const K=foes.find(o=>o.kind==='carrier');return K&&(foes.length===1||Math.random()<.6)?K:foes.find(o=>o!==K)||K;}
  const open=foes.filter(o=>!o.shield.visible);
  if(open.length&&Math.random()<.7)return open[(Math.random()*open.length)|0];
  return foes[(Math.random()*foes.length)|0];
}
function fleetFrame(dt,p){
  admFrame(dt);
  for(const C of capitals){
    if(!C.fleet||C.state!=='fight')continue;
    if(C.gate){gateFrame(C,dt);continue;}   // the Kiru Gate has no guns
    const foes=capitals.filter(o=>o.friendly!==C.friendly&&o.state==='fight'&&!o.dead);
    const want=C.friendly?fleetFocus(C,foes):null;
    if(want)C.bTgt=want;
    else if(!C.bTgt||!foes.includes(C.bTgt))C.bTgt=fleetPick(C,foes);
    if(!C.bTgt)continue;
    if(C.batteries)for(const B of C.batteries)B.lookAt(C.bTgt.g.position);
    C.salvoT-=dt;if(C.salvoT>0)continue;
    C.salvoT=(FLEET.salvo[0]+Math.random()*FLEET.salvo[1])*(C.role==='artillery'?FLEET.roles.artillery.salvo:1);
    fleetSalvo(C,C.bTgt);
    if(!want&&(Math.random()<.35||!C.friendly&&admOn()&&S.adm.focus&&C.bTgt!==S.adm.focus))C.bTgt=null;
  }
  fleetShellsFrame(dt,p);
}
/* a bridge order's mark while it lasts: an enemy capital, and maybe one of its subsystems */
function fleetFocus(C,foes){
  if(C.focus&&!foes.includes(C.focus))C.focus=null;
  if(C.focusSys&&(C.focusSys.dead||C.focusSys.ship!==C.focus))C.focusSys=null;
  return C.focus;
}
/* one broadside: up to FLEET.shots shells rippling out of the batteries (an enemy fires from the guns it has left) */
function fleetSalvo(C,T){
  const muzzles=C.friendly?C.batteries.map(b=>b.getWorldPosition(new THREE.Vector3()))
    :C.parts.filter(t=>!t.dead&&t.kind!=='lance').map(t=>t.mesh.position.clone());
  for(let i=muzzles.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[muzzles[i],muzzles[j]]=[muzzles[j],muzzles[i]];}
  const d=C.g.position.distanceTo(T.g.position);
  let hit=FLEET.hit[0]+(FLEET.hit[1]-FLEET.hit[0])*Math.max(0,Math.min(1,(FLEET.farRange-d)/(FLEET.farRange-FLEET.nearRange)));
  if(C.role==='artillery')hit=Math.max(hit,FLEET.roles.artillery.hit);
  if(C.inForm==='line')hit*=FLEET.formFx.line.hit;
  if(T.inForm==='column')hit*=FLEET.formFx.column.foeHit;
  if(C.blind)hit*=FLEET.blindHit;
  const sys=C.friendly&&C.focusSys&&C.focusSys.ship===T&&!C.focusSys.dead?C.focusSys:null;   // aimed at one subsystem
  if(sys)hit*=FLEET.sysHit;
  const dmg=(C.friendly?FLEET.shellDmg.friend:FLEET.shellDmg.enemy)*(C.role==='artillery'?FLEET.roles.artillery.dmg:1);
  muzzles.slice(0,FLEET.shots).forEach((mz,i)=>{
    const miss=Math.random()>hit,to=sys||miss?T:fleetCatch(C,T);   // a screen can step into a shell's path
    const local=new THREE.Vector3();if(sys)local.copy(sys.mesh.position);else capHullPoint(to,local);to.g.worldToLocal(local);
    const m=new THREE.Mesh(sharedGeo('fleetShell',()=>new THREE.BoxGeometry(.9,.9,9)),fleetShellMat(C.friendly));
    m.visible=false;scene.add(m);
    fleetShells.push({m,from:C,to,local,sys,miss,v:new THREE.Vector3(),t:0,life:0,delay:i*.22,muzzle:mz,prev:new THREE.Vector3(),dmg});
  });
}
/* a shell from C aimed at T: a destroyer on T's side standing guard on the shooter's side of it, within the screen's guard
   range, takes it instead (a screen most of the time, any other destroyer now and then); the first that does is hit */
function fleetCatch(C,T){
  const R=FLEET.roles.screen;
  fsH.copy(C.g.position).sub(T.g.position).setY(0).normalize();
  for(const G of capitals){
    if(G===T||G.friendly!==T.friendly||!G.fleet||G.gate||G.kind==='carrier'||G.state!=='fight'||G.dead)continue;
    fsG.copy(G.g.position).sub(T.g.position).setY(0);const d=fsG.length();
    if(d>R.guard||fsG.dot(fsH)<d*.35)continue;
    let k=G.role==='screen'?R.catch:R.catchAny;
    if(G.inForm==='screen'&&T.kind==='carrier')k=Math.max(k,FLEET.formFx.screen.catch);
    if(Math.random()<k){if(G.friendly)S.screenCatch++;fleetTip(G.friendly?'screen':'foeScreen',G.T.name);return G;}
  }
  return T;
}
function fleetShellsFrame(dt,p){
  for(let i=fleetShells.length-1;i>=0;i--){const F=fleetShells[i],m=F.m;
    if(F.delay>0){F.delay-=dt;if(F.delay>0)continue;
      // leaves the muzzle: a flash, then flight toward its mark (a miss is aimed wide and flies on past)
      m.position.copy(F.muzzle);m.visible=true;
      fsA.copy(F.local);F.to.g.localToWorld(fsA);
      if(F.miss){fsB.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();fsA.addScaledVector(fsB,40+Math.random()*50);}
      F.v.copy(fsA).sub(F.muzzle);F.life=F.v.length()/FLEET.shellSpd+(F.miss?1.4:3);F.v.setLength(FLEET.shellSpd);
      burst(F.muzzle,F.from.friendly?0x7ff4ff:0xff6a4a,1.4);spark(F.muzzle,0xffd0a0,6,30);
      if(F.muzzle.distanceTo(p)<500)sfx('ezap',F.muzzle);
    }
    F.prev.copy(m.position);F.t+=dt;
    let impact=false;
    if(!F.miss&&F.to.state==='fight'){   // a hit homes on its point on the target's hull as the target moves
      fsA.copy(F.local);F.to.g.localToWorld(fsA);
      fsB.copy(fsA).sub(m.position);const dl=fsB.length();
      if(dl<=FLEET.shellSpd*dt){m.position.copy(fsA);impact=true;}
      else F.v.copy(fsB).setLength(FLEET.shellSpd);
    }
    if(!impact)m.position.addScaledVector(F.v,dt);
    m.lookAt(fsC.copy(m.position).add(F.v));
    if(!F.from.friendly){   // enemy broadsides are deadly to fly through
      if(segSphere(F.prev,m.position,p,5)){damage(FLEET.playerDmg,'Caught in the crossfire between the capital ships.',m.position);fleetShellEnd(i);continue;}
      const w=wingmen.find(w=>!w.dead&&w.launch<=0&&segSphere(F.prev,m.position,w.mesh.position,WING_HIT_R));
      if(w){hitWingman(w,FLEET.playerDmg);fleetShellEnd(i);continue;}
    }
    if(impact){fleetImpact(F);fleetShellEnd(i);continue;}
    if(F.t>=F.life){fleetShellEnd(i);continue;}
  }
}
function fleetImpact(F){
  const q=F.m.position,T=F.to;
  if(F.sys&&!F.sys.dead){   // a shell on its subsystem: it takes the damage, the hull none
    burst(q,0xff7733,1.4);spark(q,0xffb300,10,30);
    if(q.distanceTo(ship.position)<600&&Math.random()<.6)sfx('boom',q);
    hitCapPart(F.sys,F.dmg*FLEET.sysDmg,true);return;
  }
  if(!T.friendly&&T.shield.visible){   // the enemy's shield soaks most of it
    spark(q,0x5fe8ff,10,30);burst(q,0x5fe8ff,1.1);
  }else{burst(q,0xff7733,1.6+Math.random());spark(q,0xffb300,12,36);puff(q,2);}
  if(q.distanceTo(ship.position)<600&&Math.random()<.6)sfx('boom',q);
  if(T.friendly)hitCarrier(T,F.dmg,q);else fleetHullHit(T,F.dmg);
}
function fleetShellEnd(i){scene.remove(fleetShells[i].m);fleetShells.splice(i,1);}
/* broadside damage to an enemy capital's hull: mostly soaked while its shield generator runs */
function fleetHullHit(C,dmg){
  if(C.state!=='fight')return;
  if(C.shield.visible)dmg*=1-FLEET.shieldSoak;
  C.hp-=dmg;
  if(C.hp<=0){C.hp=0;C.breached=true;capDie(C);}
}
function fleetClear(){for(const F of fleetShells)scene.remove(F.m);fleetShells.length=0;}
/* the capital ship HUD's lines for an enemy in a fleet battle: hull, guns, then its subsystems */
function fleetHud(C){
  if(C.state==='warp')return ' <span class="cw">WARPING IN</span>';
  if(C.gate&&C.state==='dying')return ' <span class="cx">COLLAPSING</span>';
  if(C.gate)return '<br><span class="cd">'+gateTxt(C)+'</span> '+C.systems.map(E=>'<span class="'+(E.dead?'cg':'cs')+'">'+E.T.short+'</span>').join(' ');
  if(C.state==='dying')return ' <span class="cx">'+(C.breached?'HULL BREACHED':'REACTOR CRITICAL')+'</span>';
  const guns=C.parts.filter(t=>t.kind!=='lance'),left=guns.filter(t=>!t.dead).length;
  let h='<br><span class="cd">'+(C.kind==='frigate'?'FLAK ':'GUNS ')+left+'/'+guns.length;
  if(C.lance)h+=' · LANCE '+capLanceTxt(C);
  if(S.adm&&S.adm.C===C&&!S.adm.silenced)h+=' · FLAGSHIP';
  h+='</span> '+C.systems.map(E=>'<span class="'+(E.dead?'cg':'cs')+'">'+E.T.short+'</span>').join(' ');
  if(!C.shield.visible)h+=' <span class="cx">REACTOR EXPOSED</span>';
  return h;
}

/* ---- the Kiru Gate (Admiral ops with `gate`): a ring on the far side of the enemy line, its aperture facing the friendly
   line. It never moves or fires; while its anchors hold it open it sends the op's ships through on a timer, and it
   collapses when the last anchor goes (or its hull runs out under the broadsides). ---- */
CAP_BUILD.gate=function(C){
  const mt=capHullMaterials(),R=C.T.r,{fore,aft}=C;
  C.T.palTrim=mt.trim;
  // the ring, in two halves (left in fore, right in aft, so it breaks in two when it goes), solid all the way round
  for(const [half,rz] of [[fore,Math.PI/2],[aft,-Math.PI/2]]){
    capPart(half,new THREE.TorusGeometry(R,8,10,36,Math.PI),mt.hull,0,0,0).rotation.z=rz;
    capPart(half,new THREE.TorusGeometry(R-8.5,1.1,6,36,Math.PI),C.mats.neon,0,0,5).rotation.z=rz;
    capPart(half,new THREE.TorusGeometry(R-8.5,1.1,6,36,Math.PI),C.mats.neon,0,0,-5).rotation.z=rz;
  }
  for(let i=0;i<16;i++){
    const a=(i+.5)/16*Math.PI*2,half=Math.cos(a)<0?fore:aft;
    capCol(C,half,Math.cos(a)*R,Math.sin(a)*R,0,R*Math.PI/16+3,9,9,'the Kiru Gate').rotation.z=a+Math.PI/2;
  }
  // armour plates and lights round the outside of the ring
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,half=Math.cos(a)<0?fore:aft;
    const m=capPart(half,capBox(16,5,22),mt.hull2,Math.cos(a)*(R+8),Math.sin(a)*(R+8),0);m.rotation.z=a+Math.PI/2;
    if(i%2)capLight(half,Math.cos(a)*(R+11),Math.sin(a)*(R+11),0,C.mats.P.neon);
  }
  // the aperture: a shimmering disc that soaks the fleet's broadsides while the gate is open (capShip shimmers it as a shield)
  C.shield=capPart(aft,new THREE.CircleGeometry(R-9,48),C.mats.shield,0,0,0);
  C.spin=new THREE.Group();aft.add(C.spin);   // lit beads spinning round the inside of the ring
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;capPart(C.spin,capBox(3,3,3),C.mats.eye,Math.cos(a)*(R-14),Math.sin(a)*(R-14),0);}
  // three anchors on the ring, pointing out from it
  for(const deg of [90,210,330]){
    const a=deg*Math.PI/180,half=Math.cos(a)<-.01?'fore':'aft';
    const E=fleetSystem(C,'anchor',[half,Math.cos(a)*(R+20),Math.sin(a)*(R+20),0],C.T.anchor);
    E.base.rotation.z=a-Math.PI/2;E.up=0;   // it faces out from the ring, not up off a deck: no side of the hull hides it
  }
  C.hull={w:2*R+40,h:2*R+40,z0:-12,z1:12,len:2*R};
};
/* the gate is in place from the start, on its op's `at`, its aperture toward HALCYON */
function spawnKiruGate(def){
  const C=capNew('gate',GATE_TYPE,false);
  C.station=new THREE.Vector3().fromArray(def.at);C.hdg=new THREE.Vector3().fromArray(FLEET.carrierAt).sub(C.station).setY(0).normalize();
  capPlace(C);scene.add(C.g);capitals.push(C);
  fleetArm(C);C.gate=true;C.adrift=true;C.hp=C.T.hp;C.sendT=def.first||def.every;
  C.state='fight';C.g.updateMatrixWorld(true);capAddCols(C);capTargets.push(...C.systems);
  S.gate={def,i:0};S.capName+=' + '+C.T.name;
  return C;
}
const fleetGate=()=>capitals.find(C=>C.gate&&C.state==='fight')||null;
const gateOpen=()=>!!S.gate&&!!fleetGate()&&S.gate.i<S.gate.def.ships.length;
const gateTxt=C=>'ANCHORS '+C.systems.filter(E=>!E.dead).length+'/'+C.systems.length+' · '
  +(S.gate.i<S.gate.def.ships.length?'NEXT SHIP '+Math.max(0,Math.ceil(C.sendT))+'s':'NOTHING LEFT TO SEND');
function gateFrame(C,dt){
  C.spin.rotation.z+=.5*dt;
  const G=S.gate;if(G.i>=G.def.ships.length)return;
  C.sendT-=dt;if(C.sendT>0)return;
  C.sendT=G.def.every;
  const e=G.def.ships[G.i++];S.gateSent++;
  S.fleetLine.push(Object.assign({t:0,gate:true},e));   // fleetSpawns brings it through on the next frame
  S.capName+=' + '+(e.name||CAPITAL_TYPES[e.kind].name);
  tmp.copy(C.g.position).addScaledVector(C.hdg,20);burst(tmp,C.mats.P.neon,8);spark(tmp,0xffd0e0,40,90);sfx('elaunch',tmp);
  announce('GATE ACTIVE',(e.name||CAPITAL_TYPES[e.kind].name)+' coming through','ace');
}
/* the last anchor is gone: the aperture closes and the ring tears itself apart */
function gateCollapse(C){
  C.shield.visible=false;C.hp=0;
  capDie(C);
  announce('GATE COLLAPSING',C.T.name+' is closed for good','ace');
}

