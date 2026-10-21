"use strict";
/* Update stage: friendly wingmen. FORM UP holds a slot off your wing; the other orders pursue a hostile
   with the same turn-limited steering the arena pilots use, and fire when the nose lines up. */

const WING_MAX_SPD=230;
const wgDes=new THREE.Vector3(), wgHdg=new THREE.Vector3(), wgTo=new THREE.Vector3(), wgPt=new THREE.Vector3();

/* the hostile a wingman should go for: your selected target (order 2); in free engage each wingman keeps
   its own, preferring one its wingmate isn't already on, and re-picks every few seconds */
function wingTargetFor(w,order,dt){
  if(order==='target'&&S.target&&!S.target.dead&&fighters.includes(S.target))return S.target;
  w.tgtT-=dt;
  if(w.tgt&&(w.tgt.dead||!fighters.includes(w.tgt)))w.tgt=null;
  if(w.tgt&&w.tgtT>0)return w.tgt;
  let best=null,bd=1500,fb=null,fd=1500;
  for(const E of fighters){if(E.dead||E.drone)continue;
    const d=E.mesh.position.distanceTo(w.mesh.position);
    if(d<fd){fd=d;fb=E;}
    if(d<bd&&!wingmen.some(o=>o!==w&&!o.dead&&o.tgt===E)){bd=d;best=E;}}
  w.tgt=best||fb;w.tgtT=6+Math.random()*4;
  return w.tgt;
}
function updateWingmen(fr){
  if(!wingmen.length)return;
  const {dt,p}=fr;
  for(const w of wingmen){
    if(w.dead)continue;
    const m=w.mesh;
    const tgt=S.wingOrder==='form'?null:wingTargetFor(w,S.wingOrder,dt);
    let turn=2.6,spd=w.spd,fire=false;
    if(tgt){
      // pursue: lead the target a little, close to gun range, hold fire until the nose is on
      wgTo.copy(tgt.mesh.position).sub(m.position);const dist=wgTo.length()||1;
      wgPt.copy(tgt.mesh.position).addScaledVector(tgt.wvel,Math.min(1,dist/700));
      wgDes.copy(wgPt).sub(m.position).normalize();
      wgHdg.copy(w.wvel).normalize();
      fire=wgHdg.dot(wgTo.multiplyScalar(1/dist))>.97&&dist<420;
      spd=dist>300?WING_MAX_SPD*.8:tgt.T.speed*1.05;
      if(dist<50){wgDes.addScaledVector(tmp.crossVectors(wgHdg,AP_UP),1.2).normalize();}   // overshoot: peel off
      w.mode='attack';
    }else{
      // formation: a slot off the player's wing, matched to the player's velocity so it holds station at any speed
      wgPt.set(w.slot*WING_SLOT.x,WING_SLOT.y,WING_SLOT.z).applyQuaternion(ship.quaternion).add(p);
      wgTo.copy(wgPt).sub(m.position);
      w.mode='form';
    }
    if(w.mode==='attack'){
      const ang=Math.acos(Math.max(-1,Math.min(1,wgHdg.dot(wgDes))));
      if(ang>1e-3)wgHdg.lerp(wgDes,Math.min(1,turn*dt/ang)).normalize();
      w.spd+=(spd-w.spd)*Math.min(1,1.6*dt);
      w.wvel.copy(wgHdg).multiplyScalar(w.spd);
    }else{
      wgDes.copy(S.vel).addScaledVector(wgTo,2.2);
      if(wgDes.length()>WING_MAX_SPD*1.8)wgDes.setLength(WING_MAX_SPD*1.8);
      w.wvel.lerp(wgDes,Math.min(1,4*dt));
      w.spd=w.wvel.length();
    }
    m.position.addScaledVector(w.wvel,dt);
    arenaPushOut(m.position,6);
    const ec=m.position.length();if(ec>ARENA_R-30)m.position.multiplyScalar((ARENA_R-30)/ec);
    // orientation: nose along the flight path, or the player's heading when holding station
    if(w.mode==='form'&&w.wvel.distanceToSquared(S.vel)<400){tmp.copy(m.position).sub(fwd.set(0,0,-1).applyQuaternion(ship.quaternion));m.up.set(0,1,0).applyQuaternion(ship.quaternion);}
    else{tmp.copy(m.position).sub(w.wvel);m.up.copy(w.up);}
    m.lookAt(tmp);
    if(fire){
      w.fireT-=dt;
      if(w.fireT<=0){w.fireT=.45;
        wgTo.copy(w.wvel).normalize();
        tmp.copy(m.position).addScaledVector(wgTo,5);
        tmp2.copy(tgt.mesh.position).addScaledVector(tgt.wvel,tmp.distanceTo(tgt.mesh.position)/720).sub(tmp);
        fireBolt(pBolts,M.boltP,tmp,tmp2,720);sfx('laser');}
    }
    w.trailT-=dt;
    if(w.trailT<=0&&!reduceMotion){w.trailT=.05;
      const tm=trailPool.get();tm.material.color.setHex(0x1f9cff);tm.material.opacity=.6;
      tm.position.copy(m.position);tm.quaternion.copy(m.quaternion);tm.scale.set(.35,.35,2.2);
      trail.push({m:tm,life:.55});}
  }
}
