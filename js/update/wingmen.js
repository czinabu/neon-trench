"use strict";
/* Update stage: friendly wingmen. FORM UP holds a slot off your wing; the other orders pursue a hostile
   with the same turn-limited steering the arena pilots use, and fire when the nose lines up. */

const WING_MAX_SPD=230;
const wgDes=new THREE.Vector3(), wgHdg=new THREE.Vector3(), wgTo=new THREE.Vector3(), wgPt=new THREE.Vector3();

/* the hostile a wingman should go for: your selected target (order 2); in free engage each wingman keeps
   its own, preferring one its wingmate isn't already on, and re-picks every few seconds */
/* the friendly capital the defend order guards: the one the bridge set for this wingman, else the carrier,
   else any friendly capital in the fight */
const wingDefendAnchor=w=>w&&w.guard&&!w.guard.dead&&w.guard.state==='fight'?w.guard:carrierShip()||friendlyCaps()[0]||null;
/* is a focus order's mark still worth chasing? (a fighter, a capital part, or a whole capital still fighting) */
const wingFocusLive=F=>!!F&&(F.g?F.state==='fight':!F.dead&&(fighters.includes(F)||capTargets.includes(F)));
/* nearest living hostile in `list` to `from`, within `range` (null if none) */
function nearestFoe(list,from,range){
  let best=null,bd=range;
  for(const E of list){if(E.dead||E.drone)continue;const d=E.mesh.position.distanceTo(from);if(d<bd){bd=d;best=E;}}
  return best;
}
function wingTargetFor(w,order,dt){
  if(order==='focus'){   // set on a mark from the bridge: a whole capital means whatever on it can still be shot
    const F=w.focus;
    if(wingFocusLive(F)){
      if(!F.g)return F;
      w.tgtT-=dt;
      if(w.tgt&&!w.tgt.dead&&w.tgt.ship===F&&capTargets.includes(w.tgt)&&w.tgtT>0)return w.tgt;
      w.tgt=nearestFoe(capTargets.filter(E=>E.ship===F),w.mesh.position,1e5);w.tgtT=4;
      if(w.tgt)return w.tgt;
    }
    w.order=null;w.focus=null;w.tgt=null;setWingOrderHud();   // the mark is gone: back in with the wing
    return S.wingOrder==='form'?null:wingTargetFor(w,S.wingOrder,dt);
  }
  if(order==='cover'||order==='defend'||order==='strike'){
    w.tgtT-=dt;
    if(w.tgt&&(w.tgt.dead||!fighters.includes(w.tgt)&&!capTargets.includes(w.tgt)))w.tgt=null;
    if(w.tgt&&w.tgtT>0)return w.tgt;
    let from=ship.position,list=fighters,range=1100;
    if(order==='defend'){const K=wingDefendAnchor(w);if(K)from=K.g.position;range=1400;}
    else if(order==='strike'){list=capTargets;range=1e5;from=w.mesh.position;}
    const E=nearestFoe(list,from,range);
    // each wingman prefers a different foe to its wingmate when more than one is in reach
    const alt=E&&wingmen.some(o=>o!==w&&!o.dead&&o.tgt===E)&&order!=='strike'?nearestFoe(list.filter(x=>x!==E),from,range):null;
    w.tgt=alt||E;w.tgtT=3+Math.random()*2;
    return w.tgt;
  }
  if(order==='target'&&S.target&&!S.target.dead&&(fighters.includes(S.target)||capTargets.includes(S.target)))return S.target;
  w.tgtT-=dt;
  if(w.tgt&&(w.tgt.dead||!fighters.includes(w.tgt)&&!capTargets.includes(w.tgt)))w.tgt=null;
  if(w.tgt&&w.tgtT>0)return w.tgt;
  let best=null,bd=1500,fb=null,fd=1500;
  for(const E of fighters){if(E.dead||E.drone)continue;
    const d=E.mesh.position.distanceTo(w.mesh.position);
    if(d<fd){fd=d;fb=E;}
    if(d<bd&&!wingmen.some(o=>o!==w&&!o.dead&&o.tgt===E)){bd=d;best=E;}}
  for(const E of capTargets){   // cruiser guns too, though a fighter closer than about half the distance comes first
    const d=E.mesh.position.distanceTo(w.mesh.position)*1.8;
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
    if(w.launch>0){wingLaunch(w,dt);continue;}
    if(S.wingOrder==='defend'&&!wingDefendAnchor())S.wingOrder='form';   // nothing left to guard
    for(const sq of squadrons)if(sq.order==='defend'&&!wingDefendAnchor())sq.order='form';
    if(w.order==='defend'&&!wingDefendAnchor(w))w.order=null;
    const order=wingOrderOf(w),tgt=order==='form'?null:wingTargetFor(w,order,dt);
    let turn=2.6*wingTurnMul(),spd=w.spd,fire=false;
    if(tgt){
      // pursue: lead the target a little, close to gun range, hold fire until the nose is on
      wgTo.copy(tgt.mesh.position).sub(m.position);const dist=wgTo.length()||1;
      wgPt.copy(tgt.mesh.position).addScaledVector(tgt.wvel,Math.min(1,dist/700));
      wgDes.copy(wgPt).sub(m.position).normalize();
      wgHdg.copy(w.wvel).normalize();
      fire=wgHdg.dot(wgTo.multiplyScalar(1/dist))>.97&&dist<420*wingRangeMul();
      spd=dist>300?WING_MAX_SPD*.8:tgt.T.speed*1.05;
      if(dist<50){wgDes.addScaledVector(tmp.crossVectors(wgHdg,AP_UP),1.2).normalize();}   // overshoot: peel off
      w.mode='attack';
    }else{
      // formation: a slot off the player's wing, matched to the player's velocity so it holds station at any speed
      const wo=wingOrderOf(w),K=wo==='defend'||wo==='form'&&w.sq?wingDefendAnchor(w):null;   // guarding (or a launched squadron at rest): loiter off the carrier's flank instead
      if(K)wgPt.set(w.slot*170,70+w.sq*35,-40-w.sq*70).applyQuaternion(K.g.quaternion).add(K.g.position);
      else wgPt.set(w.slot*WING_SLOT.x,WING_SLOT.y,WING_SLOT.z).applyQuaternion(ship.quaternion).add(p);
      wgTo.copy(wgPt).sub(m.position);
      w.mode=K?'guard':'form';
    }
    if(w.mode==='guard'){   // a slow orbit-free hold beside the carrier: steer to the point, easing off as it closes
      wgDes.copy(wgTo).multiplyScalar(1.2);
      if(wgDes.length()>WING_MAX_SPD)wgDes.setLength(WING_MAX_SPD);
      w.wvel.lerp(wgDes,Math.min(1,2*dt));w.spd=w.wvel.length();
    }else if(w.mode==='attack'){
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
    if(w.mode==='guard'){tmp.copy(m.position).sub(wgHdg.set(0,0,-1).applyQuaternion(wingDefendAnchor(w).g.quaternion));m.up.set(0,1,0);}
    else if(w.mode==='form'&&w.wvel.distanceToSquared(S.vel)<400){tmp.copy(m.position).sub(fwd.set(0,0,-1).applyQuaternion(ship.quaternion));m.up.set(0,1,0).applyQuaternion(ship.quaternion);}
    else{tmp.copy(m.position).sub(w.wvel);m.up.copy(w.up);}
    m.lookAt(tmp);
    if(fire){
      w.fireT-=dt;
      if(w.fireT<=0){w.fireT=.45*wingRofMul();
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
/* launching from the carrier: hold in the bay, then run out of the mouth along its heading, up to cruise
   speed, before the normal flying takes over */
function wingLaunch(w,dt){
  const K=w.carrier,m=w.mesh;
  w.launch-=dt;
  if(K.dead||K.state!=='fight'){w.launch=0;return;}
  wgHdg.set(0,0,-1).applyQuaternion(K.g.quaternion);
  if(w.launch<2.2){
    if(!w.outT){w.outT=1;sfx('flyby',m.position);}
    w.spd=Math.min(170,w.spd+110*dt);
    m.position.addScaledVector(wgHdg,w.spd*dt);
  }else{m.position.copy(K.bay);m.position.x+=w.bayX||0;K.g.localToWorld(m.position);}
  w.wvel.copy(wgHdg).multiplyScalar(w.spd);
  m.quaternion.copy(K.g.quaternion);
  if(w.launch<=0){w.launch=0;w.up.set(0,1,0).applyQuaternion(K.g.quaternion);}
  w.trailT-=dt;
  if(w.launch<2.2&&w.trailT<=0&&!reduceMotion){w.trailT=.05;
    const tm=trailPool.get();tm.material.color.setHex(0x1f9cff);tm.material.opacity=.6;
    tm.position.copy(m.position);tm.quaternion.copy(m.quaternion);tm.scale.set(.35,.35,2.2);
    trail.push({m:tm,life:.55});}
}
