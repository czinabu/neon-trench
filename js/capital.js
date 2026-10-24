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
  panel.wrapS=panel.wrapT=THREE.RepeatWrapping;panel.needsUpdate=true;   // hulls are UV-mapped in metres (CAP_UV, js/capkit.js)
  const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,map:panel,metalness:.6,roughness:.42,envMap:env,envMapIntensity:.55},o||{}));
  capHullMats={hull:std(0x5c6272),hull2:std(0x262a34,{roughness:.55}),trim:std(0x5c1626,{metalness:.7,roughness:.38}),
    fHull:std(0x6e5e46),fHull2:std(0x2c261e,{roughness:.55}),fTrim:std(0x6e3c12,{metalness:.7,roughness:.38}),
    cHull:std(0x6e7c98,{roughness:.36}),cHull2:std(0x2e3749,{roughness:.5}),cTrim:std(0x1f4f78,{metalness:.7,roughness:.36}),
    deck:std(0x1b2130,{roughness:.85,metalness:.2,envMapIntensity:.3}),
    metal:std(0x9aa3b8,{map:null,metalness:.95,roughness:.25,envMapIntensity:.8}),
    bell:std(0x1c2028,{map:null,metalness:.9,roughness:.35,side:THREE.DoubleSide}),
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
/* hull cross-sections for the faceted lofts: half sections from the top centre round to the bottom centre
   (see capLoftGeo in js/capkit.js) */
const CAP_PROF={
  maw:[[0,1],[.86,1],[1,.45],[1,-.2],[.72,-.8],[.3,-1],[0,-1]],   // the cruiser: a flat deck, a hard chine, a narrowing keel
  deck:[[0,1],[.8,1],[1,.35],[1,-1],[0,-1]],                        // superstructure tiers and gun houses
  keel:[[0,1],[1,1],[1,-.3],[.6,-1],[0,-1]],
  box:[[0,1],[.85,1],[1,.8],[1,-.8],[.85,-1],[0,-1]],               // a chamfered box: engine banks and towers
  hex:[[0,1],[.6,1],[1,.3],[1,-.3],[.6,-1],[0,-1]],                 // the frigate's spine and prow
  pod:[[0,1],[.7,.72],[1,0],[.7,-.72],[0,-1]],                      // the frigate's outrigger pods
  dd:[[0,1],[.7,1],[1,.35],[1,-.3],[.65,-.85],[.25,-1],[0,-1]],     // the destroyer SOLACE
};
/* a weapon part on the hull: a base on the deck and a head that tracks its target (it uses lookAt, so +z is
   its muzzle). up = 1 on the dorsal side, -1 on the ventral. The base's first child is scorched when the part
   is shot off, and the head's last child is the glowing eye. */
function capPartEntity(C,kind,spec,extra){
  return Object.assign({cap:true,ship:C,kind,mesh:new THREE.Object3D(),T:Object.assign({speed:CAP_PART_SPEED},spec),hp:spec.hp,
    callsign:C.T.name+' '+spec.name,wvel:C.wvel,t:1.5+Math.random()*2,glow:0,burst:0,burstT:0,foe:null,foeT:0,smokeT:0,dead:false},extra);
}
function capTurret(C,half,x,y,z,up,kind,spec){
  const mt=capHullMaterials(),base=new THREE.Group();base.position.set(x,y,z);if(up<0)base.rotation.x=Math.PI;half.add(base);
  capPart(base,new THREE.CylinderGeometry(3.2,3.8,2.4,16),mt.hull2,0,1.2,0);
  capPart(base,new THREE.CylinderGeometry(4.1,4.3,.5,16),mt.metal,0,.25,0);
  const head=new THREE.Group();head.position.set(0,3.6,0);base.add(head);
  capPart(head,new THREE.TorusGeometry(3.25,.2,6,24),C.mats.neon,0,-1.2,0).rotation.x=Math.PI/2;
  const eyeMat=C.mats.eye.clone();
  if(kind==='flak'){   // an armoured dome on a collar, four stubby barrels with muzzle sleeves
    capPart(head,new THREE.SphereGeometry(3,16,8,0,Math.PI*2,0,Math.PI/2),C.T.palTrim,0,-1,0);
    capPart(head,new THREE.CylinderGeometry(3.1,3.2,.7,16),mt.hull2,0,-.85,0);
    for(const [bx,by] of [[-.9,.2],[.9,.2],[-.9,1.3],[.9,1.3]]){
      capPart(head,new THREE.CylinderGeometry(.3,.35,4,8),mt.hull2,bx,by,2.6).rotation.x=Math.PI/2;
      capPart(head,new THREE.CylinderGeometry(.45,.45,.8,8),mt.metal,bx,by,4.4).rotation.x=Math.PI/2;
    }
    capPart(head,new THREE.SphereGeometry(.7,8,6),eyeMat,0,.8,1.6);
  }else{   // a sloped gun house with twin long barrels and muzzle brakes
    const house=capLoftGeo(CAP_PROF.deck,[[-2.8,2.7,1.4,0],[1.4,2.7,1.4,0],[3,1.8,.9,-.4]]);capWorldUV(house,6);
    capPart(head,house,C.T.palTrim,0,0,0);
    capPart(head,capBox(3.6,.5,2.6),mt.hull2,0,1.6,-1.2);
    for(const bx of[-1,1]){
      capPart(head,new THREE.CylinderGeometry(.35,.45,6.5,8),mt.hull2,bx,0,5).rotation.x=Math.PI/2;
      capPart(head,new THREE.CylinderGeometry(.55,.55,1.1,8),mt.metal,bx,0,8.2).rotation.x=Math.PI/2;
    }
    capPart(head,new THREE.SphereGeometry(.9,8,6),eyeMat,0,.4,2.9);
  }
  const E=capPartEntity(C,kind,spec,{base,head,eye:head.children[head.children.length-1],eyeMat,up});
  C.parts.push(E);return E;
}
/* reactor dome under a shield bubble until the ship's weapons are gone */
function capReactor(C,half,x,y,z){
  const mt=capHullMaterials();
  capPart(half,new THREE.CylinderGeometry(7.4,8,1.2,24),mt.hull2,x,y+.3,z);
  capPart(half,new THREE.TorusGeometry(6.6,.35,6,32),C.mats.neon,x,y+.9,z).rotation.x=Math.PI/2;
  const dome=capPart(half,new THREE.SphereGeometry(6,24,12,0,Math.PI*2,0,Math.PI/2),C.mats.core,x,y,z);
  C.shield=capPart(half,new THREE.SphereGeometry(11,24,16),C.mats.shield,x,y,z);
  C.core=capPartEntity(C,'core',C.T.core,{core:true,dome});
}

/* Each builder lays down its arena colliders first (plain boxes, the shapes the fights are tuned around), then
   the hull that dresses them, then its weapons. */
const CAP_BUILD={
  /* MAW: a wedge-bowed cruiser in gunmetal and blood red, a stepped deck down its spine, a bridge tower with
     twin sensor globes and six gun turrets */
  cruiser(C){
    const mt=capHullMaterials(),{fore,aft}=C,K=capKit(C),P=CAP_PROF,rng=capRng(7);
    C.T.palTrim=mt.trim;
    capCol(C,fore,0,-1,-125,7,6,15,'the cruiser bow');capCol(C,fore,0,0,-85,15,9,25,'the cruiser bow');
    capCol(C,fore,0,0,-27.5,18,11,32.5,'the cruiser hull');capCol(C,aft,0,0,35,18,11,35,'the cruiser hull');
    capCol(C,fore,0,15,-27.5,9,4,27.5,'the cruiser deck');capCol(C,aft,0,15,27.5,9,4,27.5,'the cruiser deck');
    capCol(C,fore,0,-15,-25,6,4,25,'the cruiser keel');capCol(C,aft,0,-15,25,6,4,25,'the cruiser keel');
    capCol(C,aft,0,27,30,7,8,8,'the cruiser bridge');
    capCol(C,aft,0,0,81,22,14,11,'the cruiser engines');
    // the hull: a long wedge with a hard chine, the gun deck on its back and a keel under it
    const hull=[[-142,1.2,1.4,-2.5],[-122,6.5,5,-1.5],[-96,12,8,-.5],[-62,17.6,10.6,0],[64,18,11,0],[69,17,10.4,0]];
    K.loft(mt.hull,P.maw,hull);
    K.loft(mt.hull2,P.deck,[[-58,5,2,13],[-50,9,4,15],[54,9,4,15],[57,7.5,3,14.5]]);
    K.loft(mt.hull2,P.keel,[[-52,3,2,-14],[-46,6,4,-15],[48,6,4,-15],[52,4,2.5,-14]]);
    K.loft(mt.hull2,P.box,[[64,18,11,0],[71,22,14,0],[92,22,14,0]]);
    // red trim along the deck edge, neon down the chine, window rows and ribs on the flanks
    K.strip(mt.trim,P.maw,hull,1,.9,.2);
    K.strip(C.mats.neon,P.maw,hull,2,.7,.2);
    K.windows(C.mats.window,rng,18.1,2.8,-60,63,3.1).windows(C.mats.window,rng,18.1,.4,-58,60,4.3);
    for(let z=-56;z<62;z+=9)for(const sx of[-1,1])K.at(z,mt.hull2).box(.8,6.6,1.2,sx*18.2,1.3,z);
    K.windows(C.mats.window,rng,9.1,15.6,-46,50,3.6,1.2);
    // plant on the shoulders either side of the gun deck, kept clear of the waist guns
    for(const sx of[-1,1])K.greeble(mt.hull2,rng,sx*9.8,sx*15.8,11,-60,62,70,[[sx*14,42,6]],.8);
    for(const sx of[-1,1])K.greeble(mt.hull,rng,sx*4.5,sx*8.2,19,-48,52,22,[[0,-40,6],[0,-6,6],[0,8,6],[0,30,10],[0,50,12]],.5);
    K.greeble(mt.hull2,rng,-5,5,-19,-46,46,26,[[0,-30,6],[0,30,6]],.6);
    // the engine bank: radiator slats glowing over a heat panel on each side, five drives
    for(const sx of[-1,1]){
      K.at(82,C.mats.eng).box(.1,15,15,sx*22.05,0,82);
      for(let z=75.5;z<90;z+=1.8)K.at(z,mt.hull2).box(.7,16,.6,sx*22.3,0,z);
    }
    for(const [x,y] of [[-13,0],[0,0],[13,0],[-6.5,-8],[6.5,-8]])capEngine(C,K,x,y,92,4.6,6);
    // the bridge tower: a neck, the command deck with its lit band, sensor globes and a mast
    K.loft(mt.trim,P.box,[[21,5.5,6,25],[37,6.5,6,25]]);
    K.loft(mt.trim,P.deck,[[22,7,3.5,32],[38,7,3.5,32]]);
    K.aft(C.mats.window).box(14.3,1.2,16.3,0,31,30);
    for(const sx of[-1,1]){K.aft(mt.hull).add(new THREE.SphereGeometry(2.4,14,10),sx*4,38.6,33);K.aft(mt.hull2).box(1,2,1,sx*4,36.2,33);}
    K.aft(mt.hull2).box(.5,9,.5,0,40,36).box(5,.4,.4,0,42,36);
    for(const [x,y,z,col] of [[0,-3,-141,0xff3a2a],[-22,14,92,0xff3a2a],[22,14,92,0xff3a2a],[0,44.6,36,0xffb300],
      [-18.3,5,-60,0xff3a2a],[18.3,5,-60,0xff3a2a],[-18.3,5,8,0xff3a2a],[18.3,5,8,0xff3a2a]])capLight(z<0?fore:aft,x,y,z,col);
    K.done();
    capReactor(C,aft,0,19,50);
    for(const [x,y,z,up] of [[0,19,-40,1],[0,19,-6,1],[-14,11,42,1],[14,11,42,1],[0,-19,-30,-1],[0,-19,30,-1]])
      capTurret(C,z<0?fore:aft,x,y,z,up,'gun',C.T.gun);
    C.hull={w:34,h:22,z0:-130,z1:85,len:240};
  },
  /* VESPER: a long bronze spine between two outrigger pods, the spinal lance's coils down its length and a
     forked prow round the emitter, four flak turrets on the pods */
  frigate(C){
    const mt=capHullMaterials(),{fore,aft}=C,K=capKit(C),P=CAP_PROF,rng=capRng(11);
    C.T.palTrim=mt.fTrim;
    capCol(C,fore,0,0,-102,9,7,22,'the frigate prow');
    capCol(C,fore,0,0,-35,7,5,45,'the frigate spine');capCol(C,aft,0,0,50,7,5,40,'the frigate spine');
    for(const sx of[-1,1]){
      capCol(C,fore,sx*34,0,-17.5,8,7,27.5,'a frigate pod');capCol(C,aft,sx*34,0,37.5,8,7,27.5,'a frigate pod');
      capCol(C,fore,sx*18.5,0,-20,11,2,6,'a frigate pylon');capCol(C,aft,sx*18.5,0,45,11,2,6,'a frigate pylon');
    }
    capCol(C,aft,0,11,40,5,6,7,'the frigate bridge');
    // spine and prow, with a fork of prongs either side of the lance emitter
    const spine=[[-80,6,4.5,0],[-74,7,5,0],[87,7,5,0],[90,6,4.4,0]];
    K.loft(mt.fHull,P.hex,spine);
    K.loft(mt.fHull,P.hex,[[-121,3.4,2.8,0],[-106,7.5,5.8,0],[-86,9,7,0],[-78,8,6,0],[-72,6.8,4.8,0]]);
    K.loft(mt.fHull2,P.hex,[[-90,9.2,7.2,0],[-86,9.2,7.2,0]]);
    for(const sx of[-1,1]){
      const prong=[[-136,0,0,0],[-124,1.4,2.2,0],[-104,2,3,0]];
      K.loft(mt.fTrim,P.hex,prong,sx*5.2);K.strip(C.mats.neon,P.hex,prong,3,.35,.1,sx*5.2);
    }
    K.fore(mt.metal).add(new THREE.TorusGeometry(3.7,.45,8,24),0,0,-121.5).cylZ(3.3,3.3,2,16,0,0,-120.5);
    K.strip(C.mats.neon,P.hex,spine,2,.5,.15).strip(mt.fTrim,P.hex,spine,1,.7,.15);
    K.windows(C.mats.window,rng,7.1,-1,-70,86,3.4,1.2);
    K.greeble(mt.fHull2,rng,-5,5,5,-80,88,40,[[0,-15,6],[0,64,12],[0,84,7],[0,40,10]],.5);
    // the lance coils, each in a dark housing braced to the spine
    C.coils=[];
    for(let i=0;i<5;i++){
      const z=-70+i*22,B=K.at(z,mt.fHull2);
      B.add(new THREE.TorusGeometry(8.2,1.6,6,28),0,0,z+1.5);
      B.box(1.2,3.4,1.2,0,6.6,z+1.5).box(1.2,3.4,1.2,0,-6.6,z+1.5).box(2.4,1.2,1.2,7.6,0,z+1.5).box(2.4,1.2,1.2,-7.6,0,z+1.5);
      const c=capPart(i<3?fore:aft,new THREE.TorusGeometry(8.2,.8,8,32),C.mats.neon,0,0,z);C.coils.push(c);
    }
    // the outrigger pods on swept pylons: armour bands, neon down each flank, radiator fins and a drive apiece
    for(const sx of[-1,1]){
      const pod=[[-47,1.4,1.4,0],[-40,5,4.6,0],[-30,8,7,0],[58,8,7,0],[64,7,6,0]],dx=sx*34;
      K.loft(mt.fHull,P.pod,pod,dx);
      for(const z of[-2,20,52])K.loft(mt.fHull2,P.pod,[[z,8.25,7.25,0],[z+2.5,8.25,7.25,0]],dx);
      K.strip(C.mats.neon,P.pod,pod,2,.5,.15,dx);
      K.windows(C.mats.window,rng,34+8.1,-2.6,-28,56,3.2,1.2);
      K.at(56,mt.fHull2).box(.6,5,12,dx,9.4,56);K.at(56,C.mats.eng).box(.7,.4,11,dx,11.9,56);
      capEngine(C,K,dx,0,64,5,6);
      for(const z of[-20,45]){
        K.at(z,mt.fHull2).box(22,3.4,12,sx*18.5,0,z);K.at(z,mt.fTrim).box(20,.6,7,sx*18.5,1.9,z+1);
        K.at(z,C.mats.neon).box(22,.5,.4,sx*18.5,0,z-6.1);
      }
      capLight(fore,dx,8,-45,0xff9a20);
    }
    // the bridge tower with its lit band and a pair of masts, and the spine's own drive
    K.loft(mt.fTrim,P.box,[[33,5,6,11],[47,4.6,5.6,11]]);
    K.aft(C.mats.window).box(10.4,1.2,14.4,0,14,40);
    for(const sx of[-1,1])K.aft(mt.fHull2).box(.4,8,.4,sx*2.4,20.5,44);
    capLight(aft,0,25,44,0xff9a20);
    capEngine(C,K,0,0,90,4,5);
    K.done();
    const emitter=new THREE.Group();emitter.position.set(0,0,-125);fore.add(emitter);
    capPart(emitter,new THREE.SphereGeometry(3.2,16,12),C.mats.eye,0,0,0);
    C.beam=capPart(emitter,new THREE.CylinderGeometry(1,1,1,10,1,true),C.mats.beam,0,0,0);
    C.beam.rotation.x=Math.PI/2;C.beam.visible=false;
    C.lance=capPartEntity(C,'lance',C.T.lance,{base:emitter,head:emitter,eye:emitter.children[0],eyeMat:C.mats.eye,up:0,phase:'idle',cool:4,pt:0});
    C.parts.push(C.lance);
    capReactor(C,aft,0,5,64);
    for(const [x,y,z,up] of [[-34,7,-25,1],[34,7,-25,1],[-34,-7,40,-1],[34,-7,40,-1]])capTurret(C,z<0?fore:aft,x,y,z,up,'flak',C.T.flak);
    C.hull={w:80,h:14,z0:-120,z1:90,len:250};
  },
  /* HALCYON: a broad blue-grey carrier, its flight deck on top, an island to starboard, galleries of lit
     windows down its flanks and a launch bay open at the bow */
  carrier(C){
    const mt=capHullMaterials(),{fore,aft}=C,K=capKit(C),P=CAP_PROF,rng=capRng(5);
    // the bay runs from the bow mouth (z -130) back to z -40: walls, floor and roof around an open tunnel
    capCol(C,fore,0,-14,-65,30,10,65,'the carrier hull');
    capCol(C,fore,0,13,-65,30,5,65,'the carrier deck');
    for(const sx of[-1,1])capCol(C,fore,sx*23,2,-65,7,6,65,'the carrier bay wall');
    capCol(C,fore,0,2,-20,16,6,20,'the carrier bay');
    capCol(C,aft,0,-3,65,30,21,65,'the carrier hull');
    capCol(C,aft,22,31,40,6,13,20,'the carrier island');
    capCol(C,aft,0,-3,140,32,15,10,'the carrier engines');
    capCol(C,fore,-35,15.5,-25,5,2.5,25,'the carrier deck');capCol(C,aft,-35,15.5,25,5,2.5,25,'the carrier deck');
    // the hull is one cross-section run the length of the ship, a recessed gallery down each flank and a
    // chamfered keel. Forward it is a U round the bay tunnel over a lower hull whose chin rakes back from the mouth
    const side=[[30,18],[30,12.5],[28,10],[28,-1],[30,-4],[30,-14],[23,-24]],V=([x,y])=>new THREE.Vector2(x,y);
    const shape=pts=>new THREE.Shape(pts.concat(pts.slice().reverse().map(([x,y])=>[-x,y])).map(V));
    const ext=(pts,d)=>new THREE.ExtrudeGeometry(shape(pts),{depth:d,bevelEnabled:false});
    K.fore(mt.cHull).add(ext([[16,8],[16,-4],[30,-4],[28,-1],[28,10],[30,12.5],[30,18]],130),0,0,-130);
    K.aft(mt.cHull).add(ext(side,130),0,0,0);
    K.loft(mt.cHull,[[0,1],[1,1],[1,0],[.77,-1],[0,-1]],[[-131,30,4,-8],[-108,30,10,-14],[-1,30,10,-14]]);
    for(const sx of[-1,1])K.fore(mt.cTrim).add(capLoftGeo([[0,1],[1,1],[1,-1],[0,-1]],[[-131,.4,1.6,-9.5],[-108,.4,1.6,-21]]),sx*30.1,0,0);
    K.fore(mt.cHull2).box(32,12,40,0,2,-20);   // the back of the bay
    // the flight deck: dark decking, a raised lip, runway lights and a dashed centre line, two lifts
    for(const [h,z] of [['fore',-64.5],['aft',64.5]]){
      K[h](mt.deck).box(55,.3,129,0,18.15,z);
      for(const sx of[-1,1])K[h](mt.cTrim).box(1.4,.9,129,sx*29.2,18.45,z);
    }
    for(let z=-124;z<126;z+=10){
      for(const sx of[-1,1])K.at(z,C.mats.window).box(.9,.15,.9,sx*12,18.35,z);
      if(Math.abs(z-90)>6)K.at(z,C.mats.neon).box(.5,.12,4.5,0,18.35,z);
    }
    K.fore(mt.cHull2).box(14,.36,20,-12,18.2,-25);K.aft(mt.cHull2).box(14,.36,18,8,18.2,104);
    // flank galleries: ribs, three rows of windows, neon along the upper chamfer; armour on the lower hull
    for(let z=-126;z<128;z+=13)for(const sx of[-1,1])K.at(z,mt.cHull2).box(.9,11,1.4,sx*28.4,4.5,z);
    for(const y of[1.5,4.5,7.5])K.windows(C.mats.window,rng,28.1,y,-128,128,2.6,1.6);
    for(const sx of[-1,1])for(const [h,z] of [['fore',-65],['aft',65]])K[h](C.mats.neon).box(.5,.6,130,sx*29.3,11.4,z);
    for(let z=-124;z<126;z+=6+rng()*10){const l=6+rng()*14;
      for(const sx of[-1,1])K.at(z,mt.cHull2).box(.5,3.6+rng()*3,l,sx*30.1,-9-rng()*2,z+l/2);}
    // the angled deck: a sponson off the port side that widens the flight deck amidships
    const spon=[[-64,0,2.6,15.4],[-46,10,2.6,15.4],[46,10,2.6,15.4],[62,0,2.6,15.4]];
    K.loft(mt.cHull,[[0,1],[1,1],[1,.2],[0,-1]],spon,-30);
    K.loft(mt.deck,[[0,1],[1,1],[1,-1],[0,-1]],[[-58,0,.15,18.15],[-44,9.6,.15,18.15],[44,9.6,.15,18.15],[56,0,.15,18.15]],-30);
    for(let z=-44;z<46;z+=8)K.at(z,mt.cHull2).box(1,5,1,-38.5,11,z).box(12,1,1,-34,11.5,z,0,0,-.42);
    K.fore(C.mats.window).box(.3,.3,44,-39.4,18.4,-22).box(.3,.3,44,-20,18.4,-22,0,.21);K.aft(C.mats.window).box(.3,.3,44,-39.4,18.4,22);
    // broadside blisters aft and a keel strake underneath
    for(const sx of[-1,1]){const b=[[18,0,0,-9],[30,3.8,6,-9],[100,3.8,6,-9],[112,0,0,-9]];K.loft(mt.cHull2,P.box,b,sx*30.4);
      K.windows(C.mats.window,rng,34.3,-9,32,98,3.4,1.6);}
    K.loft(mt.cHull2,P.keel,[[-124,2,.8,-24.6],[-110,6,1.6,-25.2],[118,6,1.6,-25.2],[126,3,.8,-24.6]]);
    // the bow: an armoured frame round the bay mouth, edged in cyan
    const fz=-130.8;
    K.fore(mt.cHull2).box(37,2.6,1.6,0,9.3,fz).box(37,2.6,1.6,0,-5.3,fz);
    for(const sx of[-1,1])K.fore(mt.cHull2).box(2.6,12,1.6,sx*17.3,2,fz);
    K.fore(C.mats.neon).box(32.6,.5,.5,0,8.25,fz-.8).box(32.6,.5,.5,0,-4.25,fz-.8);
    for(const sx of[-1,1])K.fore(C.mats.neon).box(.5,12.5,.5,sx*16.25,2,fz-.8);
    // inside the bay: frames every few metres, a lit deck down the middle, lamps overhead
    for(let z=-126;z<-42;z+=8){
      K.fore(mt.cHull2).box(32,.7,1,0,7.65,z);
      for(const sx of[-1,1])K.fore(mt.cHull2).box(.7,12,1,sx*15.65,2,z);
      K.fore(C.mats.window).box(1.6,.12,5,-7,7.25,z+4).box(1.6,.12,5,7,7.25,z+4);
    }
    K.fore(mt.deck).box(31,.2,90,0,-3.9,-85);
    for(let z=-128;z<-42;z+=4)K.fore(C.mats.neon).box(.4,.1,2,0,-3.75,z);
    for(const sx of[-1,1])K.fore(C.mats.window).box(.3,.1,88,sx*14.6,-3.75,-85);
    K.fore(C.mats.window).box(30,10,.4,0,2,-39.5);   // bay glow at the back of the tunnel
    // the island: a tapered tower, its bridge band, a mast, a dish and aerials
    K.loft(mt.cTrim,P.box,[[20.5,5.7,13,31],[59.5,5.2,12.6,30.6]],22);
    K.loft(C.mats.window,P.box,[[20.3,5.85,.8,38],[59.7,5.4,.8,38]],22);
    K.loft(mt.cHull,P.deck,[[19,7,1.3,40.1],[57,6.6,1.3,40.1]],22);   // the bridge deck overhangs the tower
    K.loft(mt.cHull2,P.box,[[30,3.5,2.5,45],[52,3,2.2,45]],22);
    K.aft(mt.cHull2).box(.8,14,.8,22,53,46).box(6,.4,.4,22,56,46).box(4,.4,.4,22,52,46);
    K.aft(mt.metal).add(new THREE.CylinderGeometry(3.4,1.2,.8,18),22,50,32,-.5);
    // the drives: an engine bank on the stern and five big bells
    K.loft(mt.cHull2,P.box,[[128,29,20,-3],[133,32,15,-3],[150,32,15,-3]]);
    for(const sx of[-1,1])for(let z=134;z<149;z+=2)K.at(z,mt.cHull).box(.6,22,.8,sx*32.3,-3,z);
    for(const [x,y] of [[-18,4],[0,4],[18,4],[-9,-8],[9,-8]])capEngine(C,K,x,y,150,5,7);
    for(const [x,y,z] of [[-30,20,-128],[30,20,-128],[22,60,46],[-30,19,-40],[30,19,-40],[-30,19,40],[30,19,40],[-30,19,120],[30,19,120]])
      capLight(z<0?fore:aft,x,y,z,0x00f0ff);
    K.done();
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
    C.fleetSlot=fleetSlot;C.yaw=0;const E=S.fleetLine[fleetSlot];C.hp=C.T.hp=E.hp||FLEET.hp[kind];if(E.name)C.T.name=E.name;fleetSystems(C);fleetArm(C);
    capStation(C.station,C.hdg,C.hull.len,tmp2.fromArray(E.at),0,90,30,K?K.g.position:ORIGIN);
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
  const C=capNew('carrier',fleetCarrierType(),true);
  C.hp=C.T.hp;C.reserve=C.T.reserve;C.squads=C.T.squads||0;C.relT=[0,0];C.launched=0;
  C.station=new THREE.Vector3();C.hdg=new THREE.Vector3();
  if(S.fleet)capStation(C.station,C.hdg,C.hull.len,tmp2.fromArray(FLEET.carrierAt),0,80,20,new THREE.Vector3(0,0,S.fleetLine[0].at[2]));   // the head of the friendly line
  else capStation(C.station,C.hdg,C.hull.len,tmp2.set(0,-50,0),220,330,25,ORIGIN);
  capPlace(C);scene.add(C.g);capitals.push(C);
  C.state='fight';C.g.updateMatrixWorld(true);capAddCols(C);
  if(S.fleet){C.hp=C.T.hp=S.fleetHp;fleetArm(C);}
  carrierPdArm(C);
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
  fleetClear();carrierPdClear();
  capitals.length=capTargets.length=capShells.length=0;
  capHud.style.display='none';
}
/* a bolt or missile hit on an enemy weapon part or an exposed reactor (byFleet: a broadside, no hit marker or jolt) */
function hitCapPart(E,dmg,byFleet){
  if(E.dead)return;
  const C=E.ship;
  if(E.core)dmg=Math.min(dmg,E.T.maxHit||dmg);
  E.hp-=dmg;
  if(!byFleet)hitMarker(E.hp<=0?'kill':'hit');
  if(E.hp>0){spark(E.mesh.position,E.core?0xff5a3c:0x00f0ff,6);if(E.core)puff(E.mesh.position,1);return;}
  E.dead=true;E.hp=0;
  const i=capTargets.indexOf(E);if(i>=0)capTargets.splice(i,1);
  if(E.core){capDie(C);return;}
  if(E.sys){   // a fleet battle subsystem (js/fleet.js)
    const q=E.mesh.position;spark(q,0xff5500,24,36);spark(q,0xffb300,12,28);burst(q,0xff7733,2.6);shatter(q,7,1.3);
    if(!byFleet){S.shake=Math.min(1,S.shake+.25);hitStop(.06);}sfx('boom',q);
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
