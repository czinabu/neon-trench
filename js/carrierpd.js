"use strict";
/* HALCYON's point-defence turrets: small twin-barrelled mounts on the carrier's decks that shoot down enemy
   fighters, bombers and missiles that come within reach, whoever they are chasing. Tuned in CARRIER_PD
   (js/data/capitals.js) and the refit upgrades in js/data/fleet.js. The turret models are built in
   carrierPdArm (one small function, so the carrier's hull can be redesigned without touching the guns).
   Called from spawnCarrier (js/capital.js) and capCarrier (js/update/capital.js). */

const pdBolts=[];   // this carrier's own bolts {m,v,life}; kept apart from the player's so they only ever hit hostiles
const pdV=new THREE.Vector3(), pdAim=new THREE.Vector3(), pdUp=new THREE.Vector3(), pdA=new THREE.Vector3();
/* a point-defence mount: a squat base and a twin-barrelled head (+z is its muzzle) */
function carrierPdMount(C,half,x,y,z){
  const mt=capHullMaterials(),base=new THREE.Group();base.position.set(x,y,z);half.add(base);
  capPart(base,new THREE.CylinderGeometry(1.6,2,1.2,8),mt.hull2,0,.6,0);
  const head=new THREE.Group();head.position.set(0,1.8,0);base.add(head);
  capPart(head,capBox(2.4,1.4,2.4),mt.cTrim,0,0,0);
  for(const bx of[-.5,.5]){const b=capPart(head,new THREE.CylinderGeometry(.16,.2,3.4,6),mt.hull2,bx,.1,1.9);b.rotation.x=Math.PI/2;}
  return {base,head,t:Math.random()*.5,tgt:null,tgtT:0};
}
/* the carrier gets every mount; the ones its refit hasn't bought yet stay hidden and idle */
function carrierPdArm(C){
  C.pd=CARRIER_PD.mounts.map(([h,x,y,z])=>carrierPdMount(C,C[h],x,y,z));
  const n=CARRIER_PD.base+fleetLevel('carPdMount');
  C.pd.forEach((G,i)=>{G.on=i<n;G.base.visible=G.on;});
  C.pdRange=CARRIER_PD.range*(1+.15*fleetLevel('carPdRange'));
  C.pdFire=CARRIER_PD.fire/(1+.25*fleetLevel('carPdRof'));
}
const pdLive=E=>!E.dead&&(eMsls.includes(E)||fighters.includes(E)||bombers.includes(E));
/* nearest hostile in reach of this mount: incoming missiles count as closer than they are, so they come first */
function carrierPdPick(C,pos){
  let best=null,bd=C.pdRange;
  for(const E of eMsls){const d=E.m.position.distanceTo(pos)*.6;if(d<bd){bd=d;best=E;}}
  for(const E of fighters){if(E.dead||E.drone)continue;const d=E.mesh.position.distanceTo(pos);if(d<bd){bd=d;best=E;}}
  for(const E of bombers){if(E.dead)continue;const d=E.mesh.position.distanceTo(pos);if(d<bd){bd=d;best=E;}}
  return best;
}
const pdPos=E=>E.m?E.m.position:E.mesh.position;
function carrierPdFrame(C,dt){
  if(!C.pd)return;
  capUp.set(0,1,0).applyQuaternion(C.g.quaternion);
  for(const G of C.pd){
    if(!G.on)continue;
    G.head.getWorldPosition(pdA);
    G.tgtT-=dt;
    if(G.tgt&&!pdLive(G.tgt))G.tgt=null;
    if(!G.tgt||G.tgtT<=0){G.tgt=carrierPdPick(C,pdA);G.tgtT=.5;}
    if(!G.tgt)continue;
    const tp=pdPos(G.tgt),d=tp.distanceTo(pdA);
    if(d>C.pdRange*1.1){G.tgt=null;continue;}
    pdAim.copy(tp).addScaledVector(G.tgt.wvel||G.tgt.v,d/CARRIER_PD.boltSpd);
    G.head.lookAt(pdAim);
    pdV.copy(pdAim).sub(pdA).normalize();
    G.t-=dt;
    if(G.t>0||pdV.dot(capUp)<.05)continue;   // only above its own deck
    G.t=C.pdFire*(.8+Math.random()*.4);
    sv0.copy(pdA).addScaledVector(pdV,3);
    pdV.copy(pdAim).sub(sv0);const sc=CARRIER_PD.scatter;pdV.x+=(Math.random()-.5)*sc;pdV.y+=(Math.random()-.5)*sc;pdV.z+=(Math.random()-.5)*sc;
    fireBolt(pdBolts,M.boltP,sv0,pdV,CARRIER_PD.boltSpd);
    sfx('laser',sv0);
  }
}
/* the carrier's bolts in flight: they stop on rock, and hit fighters, bombers and missiles */
function carrierPdBolts(dt){
  for(let i=pdBolts.length-1;i>=0;i--){const B=pdBolts[i];
    sv1.copy(B.m.position);B.m.position.addScaledVector(B.v,dt);B.life-=dt;
    let dead=B.life<=0;
    if(!dead&&S.sector==='arena'&&arenaSegHit(sv1,B.m.position)){dead=true;spark(B.m.position,0x9ff7ff,3,14);}
    for(let j=fighters.length-1;j>=0&&!dead;j--)
      if(!fighters[j].drone&&segSphere(sv1,B.m.position,fighters[j].mesh.position,fighters[j].T.r)){dead=true;hitEnemy(fighters[j],CARRIER_PD.dmg);}
    for(let j=bombers.length-1;j>=0&&!dead;j--)
      if(segSphere(sv1,B.m.position,bombers[j].mesh.position,4.5)){dead=true;hitEnemy(bombers[j],CARRIER_PD.dmg);}
    for(let j=eMsls.length-1;j>=0&&!dead;j--)
      if(segSphere(sv1,B.m.position,eMsls[j].m.position,2.4)){dead=true;burst(eMsls[j].m.position,0xff4030,.8);sfx('boom',eMsls[j].m.position);
        scene.remove(eMsls[j].m);eMsls.splice(j,1);}
    if(dead){scene.remove(B.m);pdBolts.splice(i,1);}
  }
}
function carrierPdClear(){for(const B of pdBolts)scene.remove(B.m);pdBolts.length=0;}
