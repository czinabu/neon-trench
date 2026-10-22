"use strict";
/* Capital ships: the enemy capitals (the cruiser MAW and the lance frigate VESPER) and the friendly carrier
   HALCYON. Numbers are in js/data/capitals.js; the per-frame behaviour is in js/update/capital.js.

   An enemy capital warps into free arena runs (and missions with `capital`) once the fight is under way.
   Its hull is armour: bolts spark off it. Its weapons are separate parts you can shoot off (gun turrets on
   the cruiser; flak turrets and the spinal lance on the frigate). Knock every one out and the reactor
   shield drops; destroy the reactor and the ship tears itself apart.
   The carrier holds near the start (free arena, or missions with `carrier:true`). Your wingmen launch
   from its bay, and it sends out replacements for wingmen you lose while its reserve lasts.
   Fleet battles (js/fleet.js) put both enemy capitals and a friendly escort in the zone at once. */

const capitals=[];     // every capital ship in the zone, enemy and friendly (see capNew for the fields)
const capTargets=[];   // live enemy weapon parts, plus a reactor once its shield is down: shootable, targetable with R
const capShells=[];    // flak shells in flight {m,v,fuse,T,C}
const CAP_PART_SPEED=40;   // what wingmen pace themselves to when attacking a part
const enemyCap=()=>capitals.find(C=>!C.friendly&&C.state!=='wreck')||null;
const carrierShip=()=>capitals.find(C=>C.kind==='carrier'&&!C.dead)||null;
const friendlyCaps=()=>capitals.filter(C=>C.friendly&&!C.dead&&C.state==='fight');   // the carrier, and the escort in a fleet battle

let capHullMats=null;
function capHullMaterials(){
  if(capHullMats)return capHullMats;
  const env=getShipEnvMap(),panel=getHullPanelTex().clone();
  panel.wrapS=panel.wrapT=THREE.RepeatWrapping;panel.repeat.set(6,6);panel.needsUpdate=true;
  const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,map:panel,metalness:.55,roughness:.5,envMap:env,envMapIntensity:.3},o||{}));
  capHullMats={hull:std(0x2c313d),hull2:std(0x1a1d25,{roughness:.65}),trim:std(0x3a0d16,{metalness:.7}),
    fHull:std(0x3a3226,{metalness:.5}),fTrim:std(0x46280c,{metalness:.7}),
    cHull:std(0x363e4e,{metalness:.5,roughness:.55}),cHull2:std(0x2a3448),cTrim:std(0x1c3c5c,{metalness:.7}),
    scorch:new THREE.MeshLambertMaterial({color:0x0b0b0d})};
  return capHullMats;
}
/* lights that flicker out as a ship dies are per ship, so one burning hull doesn't darken another */
const CAP_PALETTE={cruiser:{neon:0xff2d78,eng:0xff4a2a,window:0xffb36b,eye:0xff2d78},
  frigate:{neon:0xff8a1a,eng:0xffa040,window:0xffd08a,eye:0xff7a1a},
  carrier:{neon:0x00f0ff,eng:0x1f9cff,window:0xbfe8ff,eye:0x00f0ff}};
function capLightMats(kind){
  const P=CAP_PALETTE[kind];
  const add=c=>new THREE.MeshBasicMaterial({color:c,blending:THREE.AdditiveBlending,transparent:true,opacity:.95,depthWrite:false});
  return {P,neon:new THREE.MeshBasicMaterial({color:P.neon}),window:new THREE.MeshBasicMaterial({color:P.window}),eng:add(P.eng),
    eye:new THREE.MeshBasicMaterial({color:P.eye}),core:new THREE.MeshBasicMaterial({color:0x5fe8ff}),
    beam:new THREE.MeshBasicMaterial({color:0xff4a6a,blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false}),
    shield:new THREE.MeshBasicMaterial({color:0x5fe8ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide})};
}
/* a box whose front (-z) face is pinched toward its centre line: wedge bows */
function capTaperBox(w,h,d,k){
  const g=new THREE.BoxGeometry(w,h,d),pa=g.attributes.position;
  for(let i=0;i<pa.count;i++)if(pa.getZ(i)<0){pa.setX(i,pa.getX(i)*k);pa.setY(i,pa.getY(i)*k-h*.15);}
  g.computeVertexNormals();return g;
}
function capPart(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
const capBox=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
/* a solid box part: the mesh plus a matching arena collider (half extents from its geometry unless given) */
function capSolid(C,parent,geo,mat,x,y,z,name,half){
  const m=capPart(parent,geo,mat,x,y,z),p=geo.parameters;
  C.colDefs.push([m,half?half[0]:p.width/2,half?half[1]:p.height/2,half?half[2]:p.depth/2,name]);
  return m;
}
function capLight(parent,x,y,z,col,s){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,blending:THREE.AdditiveBlending,transparent:true,opacity:.9,depthWrite:false,sizeAttenuation:false}));
  sp.scale.setScalar(s||.035);sp.position.set(x,y,z);parent.add(sp);return sp;
}
function capNozzles(C,parent,list,z,r){
  for(const [x,y] of list){
    const n=capPart(parent,new THREE.CylinderGeometry(r,r*1.2,4,14),capHullMats.hull2,x,y,z);n.rotation.x=Math.PI/2;
    capPart(parent,new THREE.CircleGeometry(r*.87,14),C.mats.eng,x,y,z+2.1);
  }
}
/* a weapon part on the hull: a base on the deck and a head that tracks its target (it uses lookAt, so +z is
   its muzzle). up = 1 on the dorsal side, -1 on the ventral. */
function capPartEntity(C,kind,spec,extra){
  return Object.assign({cap:true,ship:C,kind,mesh:new THREE.Object3D(),T:Object.assign({speed:CAP_PART_SPEED},spec),hp:spec.hp,
    callsign:C.T.name+' '+spec.name,wvel:C.wvel,t:1.5+Math.random()*2,glow:0,burst:0,burstT:0,foe:null,foeT:0,smokeT:0,dead:false},extra);
}
function capTurret(C,half,x,y,z,up,kind,spec){
  const mt=capHullMaterials(),base=new THREE.Group();base.position.set(x,y,z);if(up<0)base.rotation.x=Math.PI;half.add(base);
  capPart(base,new THREE.CylinderGeometry(3.2,3.8,2.4,12),mt.hull2,0,1.2,0);
  const head=new THREE.Group();head.position.set(0,3.6,0);base.add(head);
  const eyeMat=C.mats.eye.clone();
  if(kind==='flak'){   // a squat dome with four stubby barrels
    capPart(head,new THREE.SphereGeometry(3,12,8,0,Math.PI*2,0,Math.PI/2),C.T.palTrim,0,-1,0);
    for(const [bx,by] of [[-.9,.2],[.9,.2],[-.9,1.3],[.9,1.3]]){const b=capPart(head,new THREE.CylinderGeometry(.3,.35,4,6),mt.hull2,bx,by,2.6);b.rotation.x=Math.PI/2;}
    capPart(head,new THREE.SphereGeometry(.7,8,6),eyeMat,0,.8,1.6);
  }else{
    capPart(head,capBox(5,2.6,5),C.T.palTrim,0,0,0);
    for(const bx of[-1,1]){const b=capPart(head,new THREE.CylinderGeometry(.35,.45,6.5,6),mt.hull2,bx,0,3.4);b.rotation.x=Math.PI/2;}
    capPart(head,new THREE.SphereGeometry(.9,8,6),eyeMat,0,.4,2.5);
  }
  const E=capPartEntity(C,kind,spec,{base,head,eye:head.children[head.children.length-1],eyeMat,up});
  C.parts.push(E);return E;
}
/* reactor dome under a shield bubble until the ship's weapons are gone */
function capReactor(C,half,x,y,z){
  const dome=capPart(half,new THREE.SphereGeometry(6,20,12,0,Math.PI*2,0,Math.PI/2),C.mats.core,x,y,z);
  C.shield=capPart(half,new THREE.SphereGeometry(11,24,16),C.mats.shield,x,y,z);
  C.core=capPartEntity(C,'core',C.T.core,{core:true,dome});
}

const CAP_BUILD={
  /* MAW: a wedge-bowed cruiser with a bridge tower and six gun turrets */
  cruiser(C){
    const mt=capHullMaterials(),{fore,aft}=C;
    C.T.palTrim=mt.trim;
    capSolid(C,fore,capTaperBox(36,22,80,.22),mt.hull,0,0,-100,'the cruiser bow',[15,9,40]);
    capSolid(C,fore,capBox(36,22,65),mt.hull,0,0,-27.5,'the cruiser hull');
    capSolid(C,fore,capBox(18,8,55),mt.hull2,0,15,-27.5,'the cruiser deck');
    capSolid(C,fore,capBox(12,8,50),mt.hull2,0,-15,-25,'the cruiser keel');
    capSolid(C,aft,capBox(36,22,70),mt.hull,0,0,35,'the cruiser hull');
    capSolid(C,aft,capBox(18,8,55),mt.hull2,0,15,27.5,'the cruiser deck');
    capSolid(C,aft,capBox(12,8,50),mt.hull2,0,-15,25,'the cruiser keel');
    capSolid(C,aft,capBox(14,16,16),mt.trim,0,27,30,'the cruiser bridge');
    capPart(aft,capBox(14.4,1.4,16.4),C.mats.window,0,31,30);   // lit bridge windows
    capSolid(C,aft,capBox(44,28,22),mt.hull2,0,0,81,'the cruiser engines');
    capNozzles(C,aft,[[-13,0],[0,0],[13,0],[-6.5,-8],[6.5,-8]],93,4.6);
    for(const sx of[-1,1]){   // neon trim and window rows down each flank
      capPart(fore,capBox(.6,1.2,64),C.mats.neon,sx*18.2,4,-27.5);capPart(aft,capBox(.6,1.2,70),C.mats.neon,sx*18.2,4,35);
      capPart(fore,capBox(.4,.8,58),C.mats.window,sx*18.2,-3,-27);capPart(aft,capBox(.4,.8,62),C.mats.window,sx*18.2,-3,33);
      const b=capPart(fore,capBox(.6,1.2,62),C.mats.neon,sx*12,-3,-100);b.rotation.y=sx*.17;
    }
    for(const [x,y,z,col] of [[0,-3,-138,0xff3a2a],[-22,14,92,0xff3a2a],[22,14,92,0xff3a2a],[0,36,30,0xffb300]])capLight(z<0?fore:aft,x,y,z,col);
    capReactor(C,aft,0,19,50);
    for(const [x,y,z,up] of [[0,19,-40,1],[0,19,-6,1],[-14,11,42,1],[14,11,42,1],[0,-19,-30,-1],[0,-19,30,-1]])
      capTurret(C,z<0?fore:aft,x,y,z,up,'gun',C.T.gun);
    C.hull={w:34,h:22,z0:-130,z1:85,len:240};
  },
  /* VESPER: a long spine between two outrigger pods, with a spinal lance in the nose and four flak turrets */
  frigate(C){
    const mt=capHullMaterials(),{fore,aft}=C;
    C.T.palTrim=mt.fTrim;
    capSolid(C,fore,capTaperBox(20,16,44,.35),mt.fHull,0,0,-102,'the frigate prow',[9,7,22]);
    capSolid(C,fore,capBox(14,10,90),mt.fHull,0,0,-35,'the frigate spine');
    capSolid(C,aft,capBox(14,10,80),mt.fHull,0,0,50,'the frigate spine');
    for(const sx of[-1,1]){
      capSolid(C,fore,capTaperBox(16,14,55,.4),mt.fHull,sx*34,0,-17.5,'a frigate pod',[8,7,27.5]);
      capSolid(C,aft,capBox(16,14,55),mt.fHull,sx*34,0,37.5,'a frigate pod');
      capSolid(C,fore,capBox(22,4,12),mt.hull2,sx*18.5,0,-20,'a frigate pylon');
      capSolid(C,aft,capBox(22,4,12),mt.hull2,sx*18.5,0,45,'a frigate pylon');
      capPart(fore,capBox(.5,1,52),C.mats.neon,sx*(34+8.2),2,-17);capPart(aft,capBox(.5,1,54),C.mats.neon,sx*(34+8.2),2,37);
      capPart(aft,capBox(.4,.7,50),C.mats.window,sx*(34+8.2),-2.5,37);
      capNozzles(C,aft,[[sx*34,0]],67,5);
      capLight(fore,sx*34,8,-45,0xff9a20);
    }
    capSolid(C,aft,capBox(10,12,14),mt.fTrim,0,11,40,'the frigate bridge');
    capPart(aft,capBox(10.4,1.2,14.4),C.mats.window,0,14,40);
    capNozzles(C,aft,[[0,0]],92,4);
    // the lance: glowing coils down the spine and an emitter at the tip of the prow
    C.coils=[];
    for(let i=0;i<5;i++){const c=capPart(i<3?fore:aft,new THREE.TorusGeometry(8.2,.8,6,20),C.mats.neon,0,0,-70+i*22);C.coils.push(c);}
    const emitter=new THREE.Group();emitter.position.set(0,0,-125);fore.add(emitter);
    capPart(emitter,new THREE.SphereGeometry(3.2,14,10),C.mats.eye,0,0,0);
    C.beam=capPart(emitter,new THREE.CylinderGeometry(1,1,1,10,1,true),C.mats.beam,0,0,0);
    C.beam.rotation.x=Math.PI/2;C.beam.visible=false;
    C.lance=capPartEntity(C,'lance',C.T.lance,{base:emitter,head:emitter,eye:emitter.children[0],eyeMat:C.mats.eye,up:0,phase:'idle',cool:4,pt:0});
    C.parts.push(C.lance);
    capReactor(C,aft,0,5,64);
    for(const [x,y,z,up] of [[-34,7,-25,1],[34,7,-25,1],[-34,-7,40,-1],[34,-7,40,-1]])capTurret(C,z<0?fore:aft,x,y,z,up,'flak',C.T.flak);
    C.hull={w:80,h:14,z0:-120,z1:90,len:250};
  },
  /* HALCYON: a broad carrier with a flight deck, an island and a launch bay open at the bow */
  carrier(C){
    const mt=capHullMaterials(),{fore,aft}=C;
    // the bay runs from the bow mouth (z -130) back to z -40: walls, floor and roof around an open tunnel
    capSolid(C,fore,capBox(60,20,130),mt.cHull2,0,-14,-65,'the carrier hull');
    capSolid(C,fore,capBox(60,10,130),mt.cHull,0,13,-65,'the carrier deck');
    for(const sx of[-1,1])capSolid(C,fore,capBox(14,12,130),mt.cHull2,sx*23,2,-65,'the carrier bay wall');
    capSolid(C,fore,capBox(32,12,40),mt.cHull2,0,2,-20,'the carrier bay');
    capSolid(C,aft,capBox(60,42,130),mt.cHull,0,-3,65,'the carrier hull');
    capSolid(C,aft,capBox(12,26,40),mt.cTrim,22,31,40,'the carrier island');
    capPart(aft,capBox(12.4,1.6,40.4),C.mats.window,22,38,40);
    capSolid(C,aft,capBox(64,30,20),mt.cHull2,0,-3,140,'the carrier engines');
    capNozzles(C,aft,[[-18,4],[0,4],[18,4],[-9,-8],[9,-8]],152,5);
    // bay glow at the back of the tunnel, cyan edge lights round the mouth, and runway lights down the deck
    capPart(fore,capBox(30,10,.4),C.mats.window,0,2,-39.5);
    for(const sx of[-1,1]){capPart(fore,capBox(.6,12,.6),C.mats.neon,sx*16.3,2,-130.2);
      capPart(fore,capBox(.6,1.2,128),C.mats.neon,sx*30.2,4,-65);capPart(aft,capBox(.6,1.2,128),C.mats.neon,sx*30.2,4,65);}
    capPart(fore,capBox(32,.6,.6),C.mats.neon,0,8.3,-130.2);
    for(let z=-120;z<120;z+=20)capPart(z<0?fore:aft,capBox(1.2,.3,1.2),C.mats.window,-12,z<0?18.2:18.2,z);
    for(const [x,y,z] of [[-30,20,-128],[30,20,-128],[22,45,40]])capLight(z<0?fore:aft,x,y,z,0x00f0ff);
    C.hull={w:56,h:30,z0:-125,z1:145,len:300};
    C.bay=new THREE.Vector3(0,2,-55);   // where a wingman sits before it launches
  },
};
/* a ship record; the builder fills in its parts */
function capNew(kind,T,friendly){
  const g=new THREE.Group(),fore=new THREE.Group(),aft=new THREE.Group();
  g.add(fore);g.add(aft);   // two halves, so the hull can break in two when it goes
  const C={kind,T:Object.assign({},T),friendly,g,fore,aft,mesh:g,wvel:new THREE.Vector3(),mats:capLightMats(kind),
    colDefs:[],cols:[],parts:[],systems:[],shield:null,core:null,state:'warp',t:0,yaw:0,dead:false,hudH:''};
  CAP_BUILD[kind](C);
  return C;
}
/* somewhere clear of rock and hull for a ship of length len: within [r0,r1] of `near`, away from the player */
function capStation(pos,hdg,len,near,r0,r1,yr,face){
  let best=-1e9;const c=new THREE.Vector3(),h=new THREE.Vector3(),q=new THREE.Vector3();
  for(let i=0;i<160;i++){
    c.set(Math.random()*2-1,0,Math.random()*2-1);if(c.lengthSq()>1||c.lengthSq()<.05)continue;
    c.setLength(r0+Math.random()*(r1-r0)).add(near);c.y=near.y+(Math.random()*2-1)*yr;
    if(face){h.copy(face).sub(c);h.y=0;h.normalize();}
    else{const a=Math.random()*6.283;h.set(Math.cos(a),0,Math.sin(a));}
    if(c.distanceTo(ship.position)<180)continue;
    let clear=1e9;
    for(let k=-1;k<=1;k+=.2){q.copy(c).addScaledVector(h,k*len*.55);
      if(q.length()>ARENA_R-50){clear=-1e9;break;}
      clear=Math.min(clear,arenaSdf(q,120));}
    for(const o of capitals)if(o.state!=='wreck')clear=Math.min(clear,c.distanceTo(o.g.position)-(len+o.hull.len)*.5-40);
    if(clear>best){best=clear;pos.copy(c);hdg.copy(h);}
    if(clear>50)break;
  }
  if(best===-1e9){pos.copy(near);if(face)hdg.copy(face).sub(near).setY(0).normalize();else hdg.set(0,0,1);}   // nowhere clear (you were in the way): take the spot itself
}
function capPlace(C){C.g.position.copy(C.station);C.g.lookAt(tmp.copy(C.station).sub(C.hdg));}   // nose (-z) along the heading
/* an enemy capital warps in: kind 'cruiser' | 'frigate'. fleetSlot: its place in a fleet battle's line (FLEET.enemies) */
function spawnCapital(kind,fleetSlot){
  kind=CAPITAL_TYPES[kind]?kind:'cruiser';
  const fleet=fleetSlot!==undefined;
  if(!fleet)S.capSpawned=true;
  const C=capNew(kind,CAPITAL_TYPES[kind],false);
  C.yaw=(Math.random()<.5?-1:1)*(C.T.yaw||0);
  C.station=new THREE.Vector3();C.hdg=new THREE.Vector3();
  if(fleet){   // takes its place in the enemy line, facing HALCYON, with subsystems and a hull the broadsides wear down
    const K=carrierShip();
    C.fleetSlot=fleetSlot;C.yaw=0;C.hp=C.T.hp=FLEET.hp[kind];fleetSystems(C);fleetArm(C);
    capStation(C.station,C.hdg,C.hull.len,tmp2.fromArray(FLEET.enemies[fleetSlot].at),0,90,30,K?K.g.position:ORIGIN);
  }else{
    const face=kind==='frigate'?ship.position:null;   // the frigate arrives already pointing its lance at you
    capStation(C.station,C.hdg,C.hull.len,ORIGIN,150,400,130,face);
    S.capName=C.T.name;
  }
  capPlace(C);C.g.position.addScaledVector(C.hdg,-1400);C.g.scale.set(1,1,6);
  scene.add(C.g);capitals.push(C);
  sfx('elaunch',C.station);
  announce('CAPITAL SHIP',C.T.name+' '+C.T.cls.toLowerCase()+' warping in','ace');
  return C;
}
/* the friendly carrier: on station from the start, a little way behind and below the player, bay facing the fight */
function spawnCarrier(){
  const C=capNew('carrier',CARRIER_TYPE,true);
  C.hp=C.T.hp;C.reserve=C.T.reserve;C.relT=[0,0];C.launched=0;
  C.station=new THREE.Vector3();C.hdg=new THREE.Vector3();
  if(S.fleet)capStation(C.station,C.hdg,C.hull.len,tmp2.fromArray(FLEET.carrierAt),0,80,20,new THREE.Vector3(0,0,FLEET.enemies[0].at[2]));   // the head of the friendly line
  else capStation(C.station,C.hdg,C.hull.len,tmp2.set(0,-50,0),220,330,25,ORIGIN);
  capPlace(C);scene.add(C.g);capitals.push(C);
  C.state='fight';C.g.updateMatrixWorld(true);capAddCols(C);
  if(S.fleet){C.hp=C.T.hp=FLEET.carrierHp;fleetArm(C);}
  return C;
}
/* solid hull for ships, bolts and missiles: arena colliders that follow the ship (see capSyncCols) */
function capAddCols(C){
  for(const [obj,a,b,c,name] of C.colDefs){
    const e={kind:'box',inv:new THREE.Matrix4(),a,b,c,c0:new THREE.Vector3(),br:Math.hypot(a,b,c),name,obj};
    C.cols.push(e);arenaCols.push(e);
  }
  capSyncCols(C);
}
const _capQ=new THREE.Quaternion(),_capS=new THREE.Vector3(),_capOne=new THREE.Vector3(1,1,1),_capP=new THREE.Vector3();
function capSyncCols(C){
  for(const e of C.cols){e.obj.matrixWorld.decompose(e.c0,_capQ,_capS);e.inv.compose(e.c0,_capQ,_capOne).invert();}
}
function capDropCols(C){
  for(const e of C.cols){const i=arenaCols.indexOf(e);if(i>=0)arenaCols.splice(i,1);}
  C.cols.length=0;
}
/* does the segment a→b run into this ship's hull? (enemy fire striking the carrier) */
function capSegHit(C,a,b){
  if(!C.cols.length||!segSphere(a,b,C.g.position,C.hull.len*.6))return false;
  const n=Math.max(1,Math.min(16,Math.ceil(a.distanceTo(b)/2.5)));
  for(const e of C.cols){
    if(!segSphere(a,b,e.c0,e.br+1))continue;
    for(let k=1;k<=n;k++){_capP.lerpVectors(a,b,k/n);if(colSdf(e,_capP)<.4)return true;}
  }
  return false;
}
function clearCapitals(){
  for(const C of capitals){capDropCols(C);scene.remove(C.g);if(C.ring)scene.remove(C.ring);if(C.flash)scene.remove(C.flash);}
  for(const F of capShells)scene.remove(F.m);
  fleetClear();
  capitals.length=capTargets.length=capShells.length=0;
  capHud.style.display='none';
}
/* a bolt or missile hit on an enemy weapon part or an exposed reactor */
function hitCapPart(E,dmg){
  if(E.dead)return;
  const C=E.ship;
  if(E.core)dmg=Math.min(dmg,E.T.maxHit||dmg);
  E.hp-=dmg;
  hitMarker(E.hp<=0?'kill':'hit');
  if(E.hp>0){spark(E.mesh.position,E.core?0xff5a3c:0x00f0ff,6);if(E.core)puff(E.mesh.position,1);return;}
  E.dead=true;E.hp=0;
  const i=capTargets.indexOf(E);if(i>=0)capTargets.splice(i,1);
  if(E.core){capDie(C);return;}
  if(E.sys){   // a fleet battle subsystem (js/fleet.js)
    const q=E.mesh.position;spark(q,0xff5500,24,36);spark(q,0xffb300,12,28);burst(q,0xff7733,2.6);shatter(q,7,1.3);
    S.shake=Math.min(1,S.shake+.25);hitStop(.06);sfx('boom',q);
    S.score+=E.T.worth;spawnPop(q,E.T.name+' +'+E.T.worth,'big');
    fleetSystemDown(C,E);return;}
  // weapon knocked out: blast, a scorched stump that keeps smoking, and a score pop
  const q=E.mesh.position;
  spark(q,0xff5500,24,36);spark(q,0xffb300,12,28);burst(q,0xff7733,E.kind==='lance'?3.2:2.2);shatter(q,7,1.3);
  S.shake=Math.min(1,S.shake+.25);hitStop(.06);sfx('boom',q);
  if(E.kind==='lance'){C.beam.visible=false;E.eye.material=capHullMaterials().scorch;for(const c of C.coils)c.material=capHullMaterials().scorch;}
  else{E.head.visible=false;E.base.children[0].material=capHullMaterials().scorch;}
  S.score+=E.T.worth;spawnPop(q,E.T.name+' +'+E.T.worth,'big');
  const left=C.parts.filter(t=>!t.dead).length;
  if(left===0&&C.fleet){if(S.annT<=0)announce('GUNS SILENT',C.T.name+' has no weapons left','');}
  else if(left===0){
    // shield drops: the bubble pops and the reactor turns hot and targetable
    const cp=C.core.mesh.position;
    burst(cp,0x5fe8ff,3);spark(cp,0x5fe8ff,30,40);sfx('shieldhit',cp);
    C.shield.visible=false;capTargets.push(C.core);
    announce('SHIELDS DOWN','Hit the reactor on '+C.T.name,'ace');
  }else if(E.kind==='lance')announce('LANCE DOWN',C.T.name+' has lost its main gun','ace');
  else if(S.annT<=0)announce(E.T.name+' DOWN',left+' left on '+C.T.name,'');
}
/* enemy fire reaching a friendly capital: the carrier, or the escort in a fleet battle */
function hitCarrier(C,dmg,pos){
  if(C.dead)return;
  C.hp-=dmg;spark(pos,0x5fe8ff,5,18);
  if(C.hp<=0){C.hp=0;C.dead=true;if(C.kind==='carrier')S.carrierLost=true;capDie(C);}
}
/* reactor gone (or the carrier's hull): a few seconds of chain explosions, then the big one (js/update/capital.js) */
function capDie(C){
  C.state='dying';C.t=0;C.boomT=0;
  for(let i=capTargets.length-1;i>=0;i--)if(capTargets[i].ship===C){capTargets[i].dead=true;capTargets.splice(i,1);}   // whatever was still standing goes with it
  const q=C.core?C.core.mesh.position:C.g.position;
  burst(q,0xffee88,3.5);spark(q,0xffee88,40,50);sfx('boom',q);
  hitStop(.1);
  if(C.friendly)announce(C.T.name+' IS HIT','The '+C.T.cls.toLowerCase()+' is breaking up','ace');
  else announce('REACTOR BREACH',C.T.name+' is going up','ace');
}
