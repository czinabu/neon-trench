"use strict";
/* Fleet battles (missions with `fleet:true`): HALCYON and the destroyer SOLACE hold a line, MAW and VESPER warp
   in across from them, and the two lines trade broadsides. Numbers are in js/data/capitals.js (FLEET).

   The player's job is the enemy capitals' subsystems: the shield generator (drops the reactor shield and lets
   the fleet's broadsides bite), the engines (stops the ship closing on HALCYON, and the frigate swinging its
   lance) and the bridge (fire control). An enemy capital goes when its reactor is destroyed or its hull runs
   out under the broadsides. The per-frame hooks are called from js/update/capital.js. */

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
CAP_BUILD.escort=function(C){
  const mt=capHullMaterials(),{fore,aft}=C;
  capSolid(C,fore,capTaperBox(24,14,60,.3),mt.cHull,0,0,-100,'the destroyer bow',[10,6,30]);
  capSolid(C,fore,capBox(26,16,70),mt.cHull,0,0,-35,'the destroyer hull');
  capSolid(C,fore,capBox(14,6,60),mt.cHull2,0,11,-35,'the destroyer deck');
  capSolid(C,aft,capBox(28,18,90),mt.cHull,0,0,45,'the destroyer hull');
  capSolid(C,aft,capBox(16,6,80),mt.cHull2,0,12,40,'the destroyer deck');
  capSolid(C,aft,capBox(10,12,14),mt.cTrim,0,21,22,'the destroyer bridge');
  capPart(aft,capBox(10.4,1.4,14.4),C.mats.window,0,24,22);
  capSolid(C,aft,capBox(34,22,18),mt.cHull2,0,0,99,'the destroyer engines');
  capNozzles(C,aft,[[-10,2],[10,2],[0,-6]],108,4);
  for(const sx of[-1,1]){
    capPart(fore,capBox(.6,1.2,68),C.mats.neon,sx*13.2,3,-35);capPart(aft,capBox(.6,1.2,88),C.mats.neon,sx*14.2,3,45);
    capPart(fore,capBox(.4,.8,60),C.mats.window,sx*13.2,-3,-35);capPart(aft,capBox(.4,.8,80),C.mats.window,sx*14.2,-3,45);
  }
  for(const [x,y,z] of [[0,-2,-131],[-17,12,108],[17,12,108],[0,28,22]])capLight(z<0?fore:aft,x,y,z,0x00f0ff);
  C.hull={w:26,h:16,z0:-130,z1:108,len:240};
};

/* a deck battery: a base and a twin-barrelled head that swings onto the ship it is firing at (+z is its muzzle) */
function fleetBattery(C,half,x,y,z){
  const mt=capHullMaterials(),base=new THREE.Group();base.position.set(x,y,z);half.add(base);
  capPart(base,new THREE.CylinderGeometry(2.4,3,1.8,10),mt.hull2,0,.9,0);
  const head=new THREE.Group();head.position.set(0,2.8,0);base.add(head);
  capPart(head,capBox(4,2,4),mt.cTrim,0,0,0);
  for(const bx of[-.8,.8]){const b=capPart(head,new THREE.CylinderGeometry(.3,.38,5.5,6),mt.hull2,bx,0,2.8);b.rotation.x=Math.PI/2;}
  return head;
}
/* a friendly capital joins the fleet: deck batteries and a broadside timer */
function fleetArm(C){
  C.fleet=true;C.salvoT=2+Math.random()*2;C.bTgt=null;
  C.batteries=(FLEET_BATTERIES[C.kind]||[]).map(([h,x,y,z])=>fleetBattery(C,C[h],x,y,z));
}
/* an enemy capital's three subsystems; they sit on the hull and are shot like its guns */
function fleetSystem(C,kind){
  const [h,x,y,z]=FLEET_SYS_AT[C.kind][kind],spec=FLEET.systems[kind],mt=capHullMaterials();
  const base=new THREE.Group();base.position.set(x,y,z);C[h].add(base);
  const head=new THREE.Group();base.add(head);
  let eyeMat,eye,ring=null;
  if(kind==='shieldgen'){   // a mast with a glowing emitter and a ring spinning round it
    capPart(base,new THREE.CylinderGeometry(1.2,2.4,6,10),mt.hull2,0,3,0);
    head.position.set(0,7.5,0);
    eyeMat=new THREE.MeshBasicMaterial({color:0x5fe8ff});
    ring=capPart(head,new THREE.TorusGeometry(4.2,.35,6,24),eyeMat,0,0,0);ring.rotation.x=Math.PI/2;
    eye=capPart(head,new THREE.SphereGeometry(2.2,14,10),eyeMat,0,0,0);
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
    announce('SHIELDS DOWN',C.T.name+' is open to the fleet\'s guns. Hit the reactor','ace');
  }else if(E.kind==='engines'){
    E.head.children.forEach(m=>m.material=scorch);C.adrift=true;C.mats.eng.opacity=.12;
    announce('ENGINES DOWN',C.T.name+' is dead in space','ace');
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
function spawnEscort(){
  const C=capNew('escort',ESCORT_TYPE,true);
  C.hp=C.T.hp;
  C.station=new THREE.Vector3();C.hdg=new THREE.Vector3();
  capStation(C.station,C.hdg,C.hull.len,fsA.fromArray(FLEET.escortAt),0,90,20,fsB.set(0,0,FLEET.enemies[0].at[2]));
  capPlace(C);scene.add(C.g);capitals.push(C);
  C.state='fight';C.g.updateMatrixWorld(true);capAddCols(C);
  fleetArm(C);
  return C;
}
/* the enemy line warps in on its schedule; once all of it is in, killing it clears the zone */
function fleetSpawns(){
  const n=capitals.filter(C=>C.fleetSlot!==undefined).length;
  const next=FLEET.enemies[n];
  if(!next){S.capSpawned=true;return;}
  if(S.time>=next.t)spawnCapital(next.kind,n);
}
/* while its engines run, an enemy capital closes on HALCYON (and holds if rock is in the way) */
function fleetAdvance(C,dt){
  if(C.adrift)return;
  const K=carrierShip()||friendlyCaps()[0];if(!K)return;
  fsA.copy(K.g.position).sub(C.g.position);fsA.y*=.3;
  if(fsA.length()<=FLEET.closeTo)return;
  fsA.normalize();
  fsB.copy(C.g.position).addScaledVector(fsA,C.hull.len*.5+70);
  if(arenaSdf(fsB,90)<30)return;
  C.g.position.addScaledVector(fsA,FLEET.advance*dt);
  C.wvel.copy(fsA).multiplyScalar(FLEET.advance);
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
  if(!C.friendly){const K=foes.find(o=>o.kind==='carrier');return K&&(foes.length===1||Math.random()<.6)?K:foes.find(o=>o!==K)||K;}
  const open=foes.filter(o=>!o.shield.visible);
  if(open.length&&Math.random()<.7)return open[(Math.random()*open.length)|0];
  return foes[(Math.random()*foes.length)|0];
}
function fleetFrame(dt,p){
  for(const C of capitals){
    if(!C.fleet||C.state!=='fight')continue;
    const foes=capitals.filter(o=>o.friendly!==C.friendly&&o.state==='fight'&&!o.dead);
    if(!C.bTgt||!foes.includes(C.bTgt))C.bTgt=fleetPick(C,foes);
    if(!C.bTgt)continue;
    if(C.batteries)for(const B of C.batteries)B.lookAt(C.bTgt.g.position);
    C.salvoT-=dt;if(C.salvoT>0)continue;
    C.salvoT=FLEET.salvo[0]+Math.random()*FLEET.salvo[1];
    fleetSalvo(C,C.bTgt);
    if(Math.random()<.35)C.bTgt=null;
  }
  fleetShellsFrame(dt,p);
}
/* one broadside: up to FLEET.shots shells rippling out of the batteries (an enemy fires from the guns it has left) */
function fleetSalvo(C,T){
  const muzzles=C.friendly?C.batteries.map(b=>b.getWorldPosition(new THREE.Vector3()))
    :C.parts.filter(t=>!t.dead&&t.kind!=='lance').map(t=>t.mesh.position.clone());
  for(let i=muzzles.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[muzzles[i],muzzles[j]]=[muzzles[j],muzzles[i]];}
  const d=C.g.position.distanceTo(T.g.position);
  let hit=FLEET.hit[0]+(FLEET.hit[1]-FLEET.hit[0])*Math.max(0,Math.min(1,(FLEET.farRange-d)/(FLEET.farRange-FLEET.nearRange)));
  if(C.blind)hit*=FLEET.blindHit;
  muzzles.slice(0,FLEET.shots).forEach((mz,i)=>{
    const local=new THREE.Vector3();capHullPoint(T,local);T.g.worldToLocal(local);
    const m=new THREE.Mesh(sharedGeo('fleetShell',()=>new THREE.BoxGeometry(.9,.9,9)),fleetShellMat(C.friendly));
    m.visible=false;scene.add(m);
    fleetShells.push({m,from:C,to:T,local,miss:Math.random()>hit,v:new THREE.Vector3(),t:0,life:0,delay:i*.22,muzzle:mz,prev:new THREE.Vector3(),
      dmg:C.friendly?FLEET.shellDmg.friend:FLEET.shellDmg.enemy});
  });
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
  if(C.state==='warp')return '<span class="cw">WARPING IN</span>';
  if(C.state==='dying')return '<span class="cx">'+(C.breached?'HULL BREACHED':'REACTOR CRITICAL')+'</span>';
  const guns=C.parts.filter(t=>t.kind!=='lance'),left=guns.filter(t=>!t.dead).length;
  let h='HULL '+capBar(Math.ceil(C.hp/C.T.hp*10),10)+' · '+(C.kind==='frigate'?'FLAK ':'GUNS ')+left+'/'+guns.length;
  if(C.lance)h+=' · LANCE '+capLanceTxt(C);
  h+='<br>'+C.systems.map(E=>'<span class="'+(E.dead?'cg':'cs')+'">'+E.T.short+'</span>').join(' ');
  if(!C.shield.visible)h+=' · <span class="cx">REACTOR EXPOSED</span> '+capBar(Math.ceil(C.core.hp/C.core.T.hp*10),10);
  return h;
}
