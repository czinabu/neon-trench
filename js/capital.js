"use strict";
/* Enemy capital ship: the syndicate cruiser MAW. It warps into free arena runs (and any mission with
   `capital:true`) once the fight is under way, holds station and turns slowly. Its hull is armour (bolts
   spark off it) and its six turrets fire on you and your wingmen. Knock out every turret and the reactor
   shield drops; destroy the reactor and the ship tears itself apart. The per-frame behaviour is in
   js/update/capital.js. */

const CAP_NAME='MAW';
const CAP_SPAWN_KILLS=3;      // the cruiser warps in after this many kills
const CAP_RANGE=700;          // turret reach
const CAP_TURRET={name:'TURRET',hp:16,r:5,speed:40};
const CAP_CORE={name:'REACTOR',hp:60,r:7,speed:40};
const CAP_CORE_MAX_HIT=20;    // a missile takes a chunk out of the reactor, not the whole thing
/* turret mounts in the cruiser's frame (nose toward -z); up = 1 dorsal, -1 ventral */
const CAP_MOUNTS=[[0,19,-40,1],[0,19,-6,1],[-14,11,42,1],[14,11,42,1],[0,-19,-30,-1],[0,-19,30,-1]];
const capTargets=[];   // live turrets, plus the reactor once its shield is down: shootable, targetable with R
let CAP=null;          // {g,fore,aft,state,t,turrets,core,cols,...} while a cruiser is in the zone
let capMats=null;

function capMaterials(){
  if(capMats)return capMats;
  const env=getShipEnvMap(),panel=getHullPanelTex().clone();
  panel.wrapS=panel.wrapT=THREE.RepeatWrapping;panel.repeat.set(6,6);panel.needsUpdate=true;
  const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,map:panel,metalness:.55,roughness:.5,envMap:env,envMapIntensity:.3},o||{}));
  const add=c=>new THREE.MeshBasicMaterial({color:c,blending:THREE.AdditiveBlending,transparent:true,opacity:.95,depthWrite:false});
  capMats={hull:std(0x2c313d),hull2:std(0x1a1d25,{roughness:.65}),trim:std(0x3a0d16,{metalness:.7}),
    neon:new THREE.MeshBasicMaterial({color:0xff2d78}),window:new THREE.MeshBasicMaterial({color:0xffb36b}),
    eng:add(0xff4a2a),eye:new THREE.MeshBasicMaterial({color:0xff2d78}),
    core:new THREE.MeshBasicMaterial({color:0x5fe8ff}),
    shield:new THREE.MeshBasicMaterial({color:0x5fe8ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}),
    scorch:new THREE.MeshLambertMaterial({color:0x0b0b0d})};
  return capMats;
}
/* a box whose front (-z) face is pinched toward its centre line: the cruiser's wedge bow */
function capTaperBox(w,h,d,k){
  const g=new THREE.BoxGeometry(w,h,d),pa=g.attributes.position;
  for(let i=0;i<pa.count;i++)if(pa.getZ(i)<0){pa.setX(i,pa.getX(i)*k);pa.setY(i,pa.getY(i)*k-h*.15);}
  g.computeVertexNormals();return g;
}
function capPart(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
function buildCapital(){
  const mt=capMaterials(),g=new THREE.Group(),fore=new THREE.Group(),aft=new THREE.Group();
  g.add(fore);g.add(aft);   // two halves, so the hull can break in two when it goes
  const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  const parts={};
  // fore half: wedge bow, front of the hull, the forward deck and keel
  parts.bow=capPart(fore,capTaperBox(36,22,80,.22),mt.hull,0,0,-100);
  parts.hullF=capPart(fore,box(36,22,65),mt.hull,0,0,-27.5);
  parts.deckF=capPart(fore,box(18,8,55),mt.hull2,0,15,-27.5);
  parts.keelF=capPart(fore,box(12,8,50),mt.hull2,0,-15,-25);
  // aft half: rear hull, bridge tower, reactor dome, engine block
  parts.hullA=capPart(aft,box(36,22,70),mt.hull,0,0,35);
  parts.deckA=capPart(aft,box(18,8,55),mt.hull2,0,15,27.5);
  parts.keelA=capPart(aft,box(12,8,50),mt.hull2,0,-15,25);
  parts.bridge=capPart(aft,box(14,16,16),mt.trim,0,27,30);
  capPart(aft,box(14.4,1.4,16.4),mt.window,0,31,30);   // lit bridge windows
  parts.engine=capPart(aft,box(44,28,22),mt.hull2,0,0,81);
  for(const [x,y] of [[-13,0],[0,0],[13,0],[-6.5,-8],[6.5,-8]]){
    const n=capPart(aft,new THREE.CylinderGeometry(4.6,5.6,4,14),mt.hull,x,y,93);n.rotation.x=Math.PI/2;
    const f=capPart(aft,new THREE.CircleGeometry(4,14),mt.eng,x,y,95.1);f.userData.eng=true;
  }
  // neon trim and window rows down each flank (both halves)
  for(const sx of[-1,1]){
    capPart(fore,box(.6,1.2,64),mt.neon,sx*18.2,4,-27.5);capPart(aft,box(.6,1.2,70),mt.neon,sx*18.2,4,35);
    capPart(fore,box(.4,.8,58),mt.window,sx*18.2,-3,-27);capPart(aft,box(.4,.8,62),mt.window,sx*18.2,-3,33);
    const b=capPart(fore,box(.6,1.2,62),mt.neon,sx*12,-3,-100);b.rotation.y=sx*.17;
  }
  // running lights at the bow and the engine corners: they hold their size, so the ship reads at range
  for(const [x,y,z,col] of [[0,-3,-138,0xff3a2a],[-22,14,92,0xff3a2a],[22,14,92,0xff3a2a],[0,36,30,0xffb300]]){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,blending:THREE.AdditiveBlending,transparent:true,opacity:.9,depthWrite:false,sizeAttenuation:false}));
    sp.scale.setScalar(.035);sp.position.set(x,y,z);(z<0?fore:aft).add(sp);
  }
  // reactor dome behind the bridge, under a shield bubble until the turrets are gone
  const dome=capPart(aft,new THREE.SphereGeometry(6,20,12,0,Math.PI*2,0,Math.PI/2),mt.core,0,19,50);
  const shield=capPart(aft,new THREE.SphereGeometry(11,24,16),mt.shield,0,19,50);
  // turrets: a squat base and a head with twin barrels and a glowing eye (barrels point +z: the head uses lookAt)
  const turrets=CAP_MOUNTS.map(([x,y,z,up],i)=>{
    const half=z<0?fore:aft,base=new THREE.Group();base.position.set(x,y,z);if(up<0)base.rotation.x=Math.PI;half.add(base);
    capPart(base,new THREE.CylinderGeometry(3.2,3.8,2.4,12),mt.hull2,0,1.2,0);
    const head=new THREE.Group();head.position.set(0,3.6,0);base.add(head);
    capPart(head,box(5,2.6,5),mt.trim,0,0,0);
    for(const bx of[-1,1]){const b=capPart(head,new THREE.CylinderGeometry(.35,.45,6.5,6),mt.hull2,bx*1,0,3.4);b.rotation.x=Math.PI/2;}
    const eyeMat=mt.eye.clone();const eye=capPart(head,new THREE.SphereGeometry(.9,8,6),eyeMat,0,.4,2.5);
    return {cap:true,mesh:new THREE.Object3D(),base,head,eye,eyeMat,up,T:CAP_TURRET,hp:CAP_TURRET.hp,callsign:CAP_NAME+' TURRET',
      wvel:new THREE.Vector3(),t:1.5+i*.6+Math.random(),glow:0,burst:0,burstT:0,foe:null,foeT:0,smokeT:0,dead:false};
  });
  const core={cap:true,core:true,mesh:new THREE.Object3D(),dome,T:CAP_CORE,hp:CAP_CORE.hp,callsign:CAP_NAME+' REACTOR',wvel:new THREE.Vector3(),dead:false};
  return {g,fore,aft,parts,shield,turrets,core};
}
/* somewhere clear of rock and hull for a 240 m ship, inside the zone and a fair distance from the player */
function capStation(pos,hdg){
  let best=-1e9;const c=new THREE.Vector3(),h=new THREE.Vector3(),q=new THREE.Vector3();
  for(let i=0;i<120;i++){
    c.set(Math.random()*2-1,(Math.random()*2-1)*.35,Math.random()*2-1);if(c.lengthSq()>1){i--;continue;}
    c.multiplyScalar(380);
    const a=Math.random()*6.283;h.set(Math.cos(a),0,Math.sin(a));
    if(c.distanceTo(ship.position)<300)continue;
    let clear=1e9;
    for(let k=-1;k<=1;k+=.25){q.copy(c).addScaledVector(h,k*125);
      if(q.length()>ARENA_R-50){clear=-1e9;break;}
      clear=Math.min(clear,arenaSdf(q,120));}
    if(clear>best){best=clear;pos.copy(c);hdg.copy(h);}
    if(clear>45)break;
  }
}
function spawnCapital(){
  if(CAP)return;
  S.capSpawned=true;
  const mt=capMaterials();   // undo the last cruiser's burnt-out lights
  mt.neon.color.setHex(0xff2d78);mt.window.color.setHex(0xffb36b);mt.eng.opacity=.95;mt.core.color.setHex(0x5fe8ff);mt.shield.opacity=.18;
  const C=buildCapital();
  C.state='warp';C.t=0;C.cols=[];C.yaw=(Math.random()<.5?-1:1)*.012;
  C.station=new THREE.Vector3();C.hdg=new THREE.Vector3();capStation(C.station,C.hdg);
  C.g.position.copy(C.station).addScaledVector(C.hdg,-1400);
  C.g.lookAt(tmp.copy(C.g.position).sub(C.hdg));   // nose (-z) along the heading
  C.g.scale.set(1,1,6);
  scene.add(C.g);
  CAP=C;
  sfx('elaunch',C.station);
  announce('CAPITAL SHIP',CAP_NAME+' cruiser warping in','ace');
}
/* solid hull for ships, bolts and missiles: arena colliders that follow the cruiser (see capSyncCols) */
function capAddCols(C){
  const p=C.parts,add=(obj,a,b,c,name)=>{
    const e={kind:'box',inv:new THREE.Matrix4(),a,b,c,c0:new THREE.Vector3(),br:Math.hypot(a,b,c),name,obj};
    C.cols.push(e);arenaCols.push(e);
  };
  add(p.bow,15,9,40,'the cruiser bow');
  add(p.hullF,18,11,32.5,'the cruiser hull');add(p.hullA,18,11,35,'the cruiser hull');
  add(p.deckF,9,4,27.5,'the cruiser deck');add(p.deckA,9,4,27.5,'the cruiser deck');
  add(p.keelF,6,4,25,'the cruiser keel');add(p.keelA,6,4,25,'the cruiser keel');
  add(p.bridge,7,8,8,'the cruiser bridge');add(p.engine,22,14,11,'the cruiser engines');
  capSyncCols(C);
}
const _capQ=new THREE.Quaternion(),_capS=new THREE.Vector3(),_capOne=new THREE.Vector3(1,1,1);
function capSyncCols(C){
  for(const e of C.cols){e.obj.matrixWorld.decompose(e.c0,_capQ,_capS);e.inv.compose(e.c0,_capQ,_capOne).invert();}
}
function capDropCols(C){
  for(const e of C.cols){const i=arenaCols.indexOf(e);if(i>=0)arenaCols.splice(i,1);}
  C.cols.length=0;
}
function clearCapital(){
  if(CAP){capDropCols(CAP);scene.remove(CAP.g);if(CAP.ring)scene.remove(CAP.ring);if(CAP.flash)scene.remove(CAP.flash);}
  CAP=null;capTargets.length=0;
  capHud.style.display='none';
}
/* a bolt or missile hit on a turret or the exposed reactor */
function hitCapPart(E,dmg){
  if(E.dead)return;
  if(E.core)dmg=Math.min(dmg,CAP_CORE_MAX_HIT);
  E.hp-=dmg;
  hitMarker(E.hp<=0?'kill':'hit');
  if(E.hp>0){spark(E.mesh.position,E.core?0xff5a3c:0x00f0ff,6);if(E.core)puff(E.mesh.position,1);return;}
  E.dead=true;E.hp=0;
  const i=capTargets.indexOf(E);if(i>=0)capTargets.splice(i,1);
  if(E.core){capDie();return;}
  // turret knocked out: blast, a scorched stump that keeps smoking, and a score pop
  const q=E.mesh.position;
  spark(q,0xff5500,24,36);spark(q,0xffb300,12,28);burst(q,0xff7733,2.2);shatter(q,7,1.3);
  S.shake=Math.min(1,S.shake+.25);hitStop(.06);sfx('boom',q);
  E.head.visible=false;E.base.children[0].material=capMats.scorch;
  S.score+=300;spawnPop(q,'TURRET +300','big');
  const left=CAP.turrets.filter(t=>!t.dead).length;
  if(left===0){
    // shield drops: the bubble pops and the reactor turns hot and targetable
    const cp=CAP.core.mesh.position;
    burst(cp,0x5fe8ff,3);spark(cp,0x5fe8ff,30,40);sfx('shieldhit',cp);
    CAP.shield.visible=false;capTargets.push(CAP.core);
    announce('SHIELDS DOWN','Hit the reactor behind the bridge','ace');
  }else if(S.annT<=0)announce('TURRET DOWN',left+' left on '+CAP_NAME,'');
}
/* reactor gone: a few seconds of chain explosions down the hull, then the big one (js/update/capital.js) */
function capDie(){
  CAP.state='dying';CAP.t=0;CAP.boomT=0;
  burst(CAP.core.mesh.position,0xffee88,3.5);spark(CAP.core.mesh.position,0xffee88,40,50);sfx('boom',CAP.core.mesh.position);
  hitStop(.1);
  announce('REACTOR BREACH',CAP_NAME+' is going up','ace');
}
