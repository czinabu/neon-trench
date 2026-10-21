"use strict";
/* Update stage: enemy AI, mines, pickups. */

/* turrets, fighters, bombers, mines, pickups */
function updateEnemies(fr){
  const {dt,arena,p}=fr;
  S.lockWarn=false;   // set again below by any missile boat lining up a launch
  /* ----- wall turrets: ambient — occasional slow telegraphed tracers to weave past ----- */
  for(let i=turrets.length-1;i>=0;i--){const T=turrets[i];
    if(T.mesh.position.z>p.z+200){T.dead=true;scene.remove(T.mesh);turrets.splice(i,1);continue;}
    T.head.lookAt(p);
    const d=T.mesh.position.distanceTo(p);
    const inRange=d<460&&T.mesh.position.z<p.z;
    T.t-=dt;
    // eye pulses up in the last moment before firing (gentle, non-nagging telegraph)
    const warming=(inRange&&T.t<.45)?1:0;
    T.fireGlow+=(warming-T.fireGlow)*Math.min(1,8*dt);
    T.eye.scale.setScalar(1+T.fireGlow*.8);
    T.eyeMat.color.setHex(T.fireGlow>.5?0xff7d5d:0xff2d78);
    if(inRange&&T.t<=0){
      T.t=2.6+Math.random()*2.4;                // relaxed cadence — never a wall of fire
      T.head.getWorldPosition(sv0);
      // loose aim: mild lead + scatter so it's easy to weave through, not a suppress demand
      tmp.copy(p).addScaledVector(S.vel,d/170).sub(sv0);
      tmp.x+=(Math.random()-.5)*11;tmp.y+=(Math.random()-.5)*11;
      fireBolt(eBolts,M.boltE,sv0,tmp,165);sfx('ezap',sv0);     // slow tracer
    }
  }
  /* ----- enemy fighters (weave + react: juke when you line them up) ----- */
  if(arena)assignAttackers(dt);
  for(let i=fighters.length-1;i>=0;i--){const F=fighters[i];
    F.t+=dt;const m=F.mesh;
    if(F.drone){m.position.y=F.y0+Math.sin(F.t*.8)*3;continue;}   // flight-school target: hangs in place
    const d=m.position.distanceTo(p);
    // threat sense (trench only — the arena pilots have their own, see arenaPilot)
    tmp.copy(m.position).sub(p);const ahead=tmp.z<0; tmp.normalize();
    const aim=tmp.dot(fwd);                       // fighter inside the player's bore cone (1=dead-centre)
    let evading=false;
    if(!arena){
      const targeted=ahead&&d<480&&(aim>.95&&(S.fireHeld||S.zoomK>.4)||F===S.mslTarget&&aim>.9);
      F.evadeCD-=dt; F.evadeT-=dt;
      if(targeted&&F.evadeCD<=0){
        F.jx=(Math.random()<.5?-1:1)*(15+Math.random()*9);
        F.jy=(Math.random()<.5?-1:1)*(9+Math.random()*7);
        F.evadeT=.55+Math.random()*.45; F.evadeCD=1.1+Math.random()*.8;
      }
      evading=F.evadeT>0;
    }
    const T=F.T;
    // close pass: a whoosh panned to the side it went by on
    if(d<45&&!F.flyby&&S.vel.length()+F.wvel.length()>120){F.flyby=true;sfx('flyby',m.position);}else if(d>110)F.flyby=false;
    if(F.shield)F.shield.material.opacity=Math.max(0,F.shield.material.opacity-dt*1.6);   // leader's shield flash fades
    if(arena){
      if(F.squad&&!squadEngaged(F.squad,p)?squadFly(F,dt,p):arenaPilot(F,dt,p)){F.dead=true;scene.remove(m);fighters.splice(i,1);}
    }else{
      // trench: weave ahead on a lane (per-pilot amplitude/approach) + gentle juke while evading
      const wv=T.standoff?.5:1;                      // missile boats hold a steadier line
      let tx=Math.sin(F.t*.7+F.seed)*(HALF_W-11)*F.ampX*wv;
      let ty=FLOOR_Y+9+(Math.sin(F.t*.9+F.seed*2)*.5+.5)*(TOP_Y-FLOOR_Y-17)*F.ampY;
      let tz=p.z-(F.app+Math.sin(F.t*.4+F.seed)*90);
      if(evading){tx+=F.jx*.7; ty+=F.jy*.7; tz=p.z-(F.app-60);}
      tx=Math.max(-(HALF_W-6),Math.min(HALF_W-6,tx)); ty=Math.max(FLOOR_Y+5,Math.min(TOP_Y-5,ty));
      const resp=(evading?2.2:1.3)*(F.kind==='dart'?1.5:1);
      const tvx=(tx-m.position.x)*resp, tvy=(ty-m.position.y)*resp, tvz=(tz-m.position.z)*1.7;
      const k=Math.min(1,7*dt);   // low-pass the velocity → smooth, non-jittery pathing
      F.wvel.x+=(tvx-F.wvel.x)*k; F.wvel.y+=(tvy-F.wvel.y)*k; F.wvel.z+=(tvz-F.wvel.z)*k;
      m.position.addScaledVector(F.wvel,dt);
      F.bank+=((-F.wvel.x*(evading?.04:.02))-F.bank)*Math.min(1,8*dt);
      m.rotation.set(F.wvel.y*.008,0,F.bank);
      F.head.lookAt(p);
      F.head.getWorldPosition(sv0);
      enemyFire(F,dt,ahead&&d<(T.missile?720:620)&&!evading,d,sv0,p);
      if(m.position.z>p.z+500){F.dead=true;scene.remove(m);fighters.splice(i,1);}
    }
  }
  /* ----- heavy bombers (slow, lay mines, lob fire) ----- */
  for(let i=bombers.length-1;i>=0;i--){const Bm=bombers[i];const m=Bm.mesh;
    Bm.t+=dt;let bvx,bvy,bvz;
    if(arena){
      // wallow toward a standoff point near the player
      sv0.copy(p).sub(m.position);const bd=sv0.length()||1;sv0.multiplyScalar(1/bd);
      tmp.copy(p).addScaledVector(sv0,-300);
      bvx=(tmp.x-m.position.x)*.6;bvy=(tmp.y-m.position.y)*.6;bvz=(tmp.z-m.position.z)*.6;
      m.position.x+=bvx*dt;m.position.y+=bvy*dt;m.position.z+=bvz*dt;
      {const ec=m.position.length()||1;if(ec>ARENA_R-40)m.position.multiplyScalar((ARENA_R-40)/ec);} // stay inside the player's reach
      arenaPushOut(m.position,5);
      tmp.set(m.position.x+bvx,m.position.y+bvy,m.position.z+bvz);m.lookAt(tmp);
    }else{
      const tx=Math.sin(Bm.t*.35+Bm.seed)*(HALF_W-13);
      const ty=FLOOR_Y+8+(Math.sin(Bm.t*.5+Bm.seed*2)*.5+.5)*16;
      const tz=p.z-(230+Math.sin(Bm.t*.3)*40);
      bvx=(tx-m.position.x)*.7;bvy=(ty-m.position.y)*.7;bvz=(tz-m.position.z)*.9;
      m.position.x+=bvx*dt;m.position.y+=bvy*dt;m.position.z+=bvz*dt;
      m.rotation.z=(tx-m.position.x)*.01;
    }
    Bm.wvel.set(bvx,bvy,bvz);
    Bm.glow.material.opacity=.6+Math.sin(Bm.t*8)*.4;
    Bm.mineT-=dt;
    if(Bm.mineT<=0&&(arena?m.position.distanceTo(p)>40:m.position.z<p.z-30)){
      Bm.mineT=2.2+Math.random()*1.2;
      dropMine(m.position);
      for(let s=-1;s<=1;s++){
        tmp.copy(p).sub(m.position);tmp.x+=s*60;tmp.normalize();
        fireBolt(eBolts,M.boltE,m.position,tmp,180);
      }
      sfx('ezap',m.position);
    }
    const gone=arena?m.position.length()>ARENA_R+300:m.position.z>p.z+500;
    if(gone){Bm.dead=true;scene.remove(m);bombers.splice(i,1);}
  }
  /* ----- floating mines ----- */
  for(let i=mines.length-1;i>=0;i--){const Mi=mines[i];
    Mi.t+=dt;Mi.life-=dt;
    Mi.mesh.rotation.y+=dt*1.4;Mi.mesh.rotation.x+=dt*.8;
    Mi.mesh.position.y+=Math.sin(Mi.t*1.5)*.4*dt;
    Mi.eye.material.opacity=.5+Math.sin(Mi.t*9)*.5;
    if((!arena&&Mi.mesh.position.z>p.z+60)||Mi.life<=0){scene.remove(Mi.mesh);mines.splice(i,1);continue;}
    if(segSphere(fr.prevP,p,Mi.mesh.position,3.4)){
      burst(Mi.mesh.position,0xff2d78,1.3);damage(20,'Clipped a drifting proximity mine.',Mi.mesh.position);
      scene.remove(Mi.mesh);mines.splice(i,1);
    }
  }
  /* ----- enemy homing missiles ----- */
  let warnD=1e9;
  for(let i=eMsls.length-1;i>=0;i--){const E=eMsls[i];
    E.life-=dt;
    sv0.copy(p).sub(E.m.position);const md=sv0.length()||1;sv0.multiplyScalar(1/md);
    sv1.copy(E.v).normalize();
    if(E.decoy){   // seduced by a flare: chase it, burst on it, or fly on blind once it burns out
      if(!E.decoy.dead){
        tmp.copy(E.decoy.m.position).sub(E.m.position);
        if(tmp.length()<6){burst(E.m.position,0xff4030,.8);sfx('boom',E.m.position);scene.remove(E.m);eMsls.splice(i,1);continue;}
        tmp.normalize();const da=Math.acos(Math.max(-1,Math.min(1,sv1.dot(tmp))));
        if(da>1e-3)sv1.lerp(tmp,Math.min(1,3*dt/da)).normalize();
      }
    }else{
      const ang=Math.acos(Math.max(-1,Math.min(1,sv1.dot(sv0))));
      if(ang>1e-3)sv1.lerp(sv0,Math.min(1,1.5*dt/ang)).normalize();   // limited turn: a hard break shakes it
    }
    E.v.copy(sv1).multiplyScalar(Math.min(arena?235:205,E.v.length()+140*dt));   // accelerates off the rail
    relA.copy(E.m.position).sub(fr.prevP);
    E.m.position.addScaledVector(E.v,dt);
    relB.copy(E.m.position).sub(p);
    tmp.copy(E.m.position).sub(E.v);E.m.lookAt(tmp);
    if(segSphere(relA,relB,ORIGIN,3.2)){
      burst(E.m.position,0xff4030,1.1);damage(16,'Caught by a homing missile.',E.m.position);
      scene.remove(E.m);eMsls.splice(i,1);continue;}
    if(E.life<=0){burst(E.m.position,0xff4030,.6);scene.remove(E.m);eMsls.splice(i,1);continue;}
    if(arena&&arenaSegHit(sv2.copy(relA).add(fr.prevP),E.m.position)){burst(E.m.position,0xff4030,.9);sfx('boom',E.m.position);scene.remove(E.m);eMsls.splice(i,1);continue;}   // flew into cover
    if(!E.decoy&&sv1.dot(sv0)>.3)warnD=Math.min(warnD,md);   // still has you
    else if(md<40&&!E.whoosh){E.whoosh=true;sfx('flyby',E.m.position);}   // shook it: it screams past
  }
  S.mslWarnD=warnD;
  if(warnD<700){S.mslBeepT-=dt;if(S.mslBeepT<=0){S.mslBeepT=.1+warnD/700*.45;sfx('mslwarn');}}else S.mslBeepT=0;
  // a missile boat lining up a shot: steady lock tone, so a flare can go out before the launch
  if(S.lockWarn&&warnD>=700){S.lockBeepT-=dt;if(S.lockBeepT<=0){S.lockBeepT=.38;sfx('lockwarn');}}else S.lockBeepT=0;
  /* ----- pickups (fly through to collect) ----- */
  for(let i=pickups.length-1;i>=0;i--){const K=pickups[i];
    K.t+=dt;K.life-=dt;
    K.mesh.rotation.y+=dt*2.2;K.ring.rotation.x+=dt*1.6;
    K.core.scale.setScalar(1+Math.sin(K.t*5)*.12);
    if(K.life<2)K.mesh.visible=((K.t*8)|0)%2===0; // blink as it expires
    if(K.light)K.light.intensity=K.mesh.visible?1.3:0;
    // arena has no 'behind' (you fly every direction), so only the trench culls pickups you've passed
    if((!arena&&K.mesh.position.z>p.z+50)||K.life<=0){freeLight(K.light);scene.remove(K.mesh);pickups.splice(i,1);continue;}
    if(segSphere(fr.prevP,p,K.mesh.position,3.8)){collectPickup(K);freeLight(K.light);scene.remove(K.mesh);pickups.splice(i,1);}
  }
}

/* An enemy attack: a burst of leading bolts, or a homing missile for missile boats (the leader
   mixes one in every third attack). `ready` gates the start of an attack; a burst in progress finishes. */
function enemyFire(F,dt,ready,dist,from,p){
  const T=F.T;
  if(F.burst>0){F.burstT-=dt;if(F.burstT<=0){F.burst--;F.burstT=T.gap;enemyBolt(T,from,dist,p);}return;}
  F.fireT-=dt;
  // a missile attack has to hold a lock on you for ENEMY_LOCK_T first (the lock tone plays the whole
  // time, so there is always time for flares), and only ENEMY_MSL_CAP missiles fly at once
  const mslNext=T.missile||(T.missile2&&(F.attacks+1)%3===0&&eMsls.length<ENEMY_MSL_CAP);   // the leader shoots bolts instead when the cap is full
  if(mslNext){
    F.mlock=ready&&F.fireT<ENEMY_LOCK_T&&eMsls.length<ENEMY_MSL_CAP?(F.mlock||0)+dt:0;
    if(F.mlock>0)S.lockWarn=true;   // locking on to you
    if(F.mlock<ENEMY_LOCK_T)return;
  }
  if(!ready||F.fireT>0)return;
  F.fireT=T.fire[0]+Math.random()*T.fire[1];F.attacks++;F.mlock=0;
  if(mslNext){
    spawnEnemyMissile(from,tmp2.copy(p).sub(from));
    if(T.missile)return;
  }
  F.burst=(T.shots||1)-1;F.burstT=T.gap||0;enemyBolt(T,from,dist,p);
}
function enemyBolt(T,from,dist,p){
  tmp2.copy(p).addScaledVector(S.vel,dist/T.boltSpd).sub(from);
  fireBolt(eBolts,M.boltE,from,tmp2,T.boltSpd);sfx('ezap',from);
}

/* ============================ ARENA DOGFIGHT PILOTS ============================ */
/* Only a couple of ships press the attack at once (aces always do); the rest fly a wide wing orbit
   around the fight and take snap shots, swapping in as attackers rotate out. An attacker never meets
   you nose-to-nose: if it is out in front of you it swings wide for your flank or six, otherwise it
   flies lead pursuit. When you get on its tail it matches your speed instead of running, and when
   your guns or a lock are on it, it breaks hard across your view, then settles again. That gives a
   chase you can win by staying on it, instead of head-on jousting passes. */
const ARENA_ATTACKERS=2;
const apTo=new THREE.Vector3(), apHdg=new THREE.Vector3(), apDes=new THREE.Vector3(), apPt=new THREE.Vector3(),
      apSide=new THREE.Vector3(), apPrev=new THREE.Vector3(), apAcc=new THREE.Vector3(), apLook=new THREE.Vector3(),
      apN=new THREE.Vector3(), AP_UP=new THREE.Vector3(0,1,0);
function assignAttackers(dt){
  let n=0;for(const F of fighters)if(F.attacker&&!F.T.ace)n++;
  const waiting=fighters.some(F=>!F.attacker&&!F.T.standoff);
  for(const F of fighters){
    if(F.T.standoff)continue;
    if(F.T.ace){F.attacker=true;continue;}
    if(F.attacker){F.roleT-=dt;if(F.roleT<=0&&waiting&&F.state!=='break'){F.attacker=false;n--;}}
    else if(n<ARENA_ATTACKERS){F.attacker=true;F.roleT=9+Math.random()*6;n++;}
  }
}
/* Squadrons: the lead cruises past on a loose line toward the fight and the wingmen hold a slot off
   its wing (same station-keeping as the friendly wingmen: match the leader's velocity, pull toward the
   slot). The whole squadron breaks into normal dogfight AI the moment any member is hit or the player
   closes to within SQUAD_ENGAGE, or the lead goes down. */
const SQUAD_ENGAGE=420;
function squadEngaged(sq,p){
  if(sq.engaged)return true;
  for(const M of sq.members){
    if(M.dead||M.hp<M.T.hp||M.mesh.position.distanceTo(p)<SQUAD_ENGAGE){sq.engaged=true;break;}
  }
  if(sq.engaged){
    for(const M of sq.members){M.squad=null;M.state='engage';}
    if(S.annT<=0)announce('SQUADRON BREAKING','dogfight','ace');
  }
  return sq.engaged;
}
function squadFly(F,dt,p){
  const m=F.mesh,sq=F.squad;
  if(F.slot){
    // wingman: slot in the lead's frame
    const L=sq.lead.mesh;
    apPt.copy(F.slot).applyQuaternion(L.quaternion).add(L.position).sub(m.position);
    apDes.copy(sq.lead.wvel).addScaledVector(apPt,2.2);
    F.wvel.lerp(apDes,Math.min(1,4*dt));
    F.spd=F.wvel.length();
    m.up.copy(L.up);
  }else{
    // lead: steady heading toward a point beside the player, steering round rock and hull
    apSide.crossVectors(AP_UP,fwd).normalize();
    apPt.copy(p).addScaledVector(apSide,F.side*260);
    apDes.copy(apPt).sub(m.position).normalize();
    apHdg.copy(F.wvel).normalize();
    for(const look of [35,85]){
      apLook.copy(m.position).addScaledVector(apHdg,look);
      const dd=arenaSdf(apLook,40);
      if(dd<30){arenaNormal(apLook,apN);apDes.addScaledVector(apN,(1-dd/30)*2.4+.3);}
    }
    apDes.normalize();
    const ang=Math.acos(Math.max(-1,Math.min(1,apHdg.dot(apDes))));
    if(ang>1e-3)apHdg.lerp(apDes,Math.min(1,F.T.turn*.6*dt/ang)).normalize();
    F.spd+=(F.T.speed*.85-F.spd)*Math.min(1,1.6*dt);
    F.wvel.copy(apHdg).multiplyScalar(F.spd);
    m.up.copy(F.up);
  }
  m.position.addScaledVector(F.wvel,dt);
  arenaPushOut(m.position,F.T.r);
  const ec=m.position.length();if(ec>ARENA_R-30)m.position.multiplyScalar((ARENA_R-30)/ec);
  tmp.copy(m.position).sub(F.wvel);m.lookAt(tmp);
  F.trailT-=dt;
  if(F.trailT<=0&&!reduceMotion){F.trailT=.05;
    const tm=trailPool.get();tm.material.color.setHex(0xff5a3c);tm.material.opacity=.6;
    tm.position.copy(m.position);tm.quaternion.copy(m.quaternion);tm.scale.set(.35,.35,2.2);
    trail.push({m:tm,life:.55});}
  return false;
}
/* steer one arena ship for a frame; returns true if it has left the zone for good */
function arenaPilot(F,dt,p){
  const T=F.T,m=F.mesh;
  apTo.copy(p).sub(m.position);const dist=apTo.length()||1;apTo.multiplyScalar(1/dist);   // toward the player
  if(F.wvel.lengthSq()<1)F.wvel.copy(apTo).multiplyScalar(T.speed);
  apHdg.copy(F.wvel).normalize();
  const noseOnMe=-apTo.dot(fwd);       // 1 = the player's nose is dead on me
  const aspect=apHdg.dot(apTo);        // 1 = I'm pointing straight at the player
  const pSpd=S.vel.length();
  const chased=noseOnMe>.88&&dist<600&&apHdg.dot(fwd)>.2;   // player sits behind me, flying my way
  const matchSpd=()=>Math.max(T.speed*.8,Math.min(T.speed*1.45,pSpd*.92));
  let turn=T.turn,spd=T.speed,canFire=false;
  F.stateT-=dt;F.breakCD-=dt;
  if(!T.standoff&&F.state!=='break'&&F.breakCD<=0&&noseOnMe>.975&&dist<620&&(S.fireHeld||(F===S.lockTarget&&S.lockT>.35))){
    F.state='break';F.stateT=T.ace?.8+Math.random()*.5:1.1+Math.random()*.7;F.reversed=false;
    // break across the player's line of sight, so it becomes a deflection shot rather than a vanishing act
    F.breakDir.crossVectors(apTo,apHdg);if(F.breakDir.lengthSq()<1e-4)F.breakDir.crossVectors(AP_UP,apHdg);
    F.breakDir.normalize();if(Math.random()<.5)F.breakDir.negate();
  }
  if(T.standoff){
    // missile boat: circles on a ring around you at standoff range and lobs missiles from there
    apPt.copy(m.position).sub(p);apPt.y*=.5;apPt.setLength(T.standoff);
    apSide.crossVectors(AP_UP,apPt).setLength(T.standoff*.6*(F.seed>4.5?1:-1));
    apDes.copy(p).add(apPt).add(apSide).sub(m.position).normalize();
    canFire=dist<760;
  }else if(F.state==='break'){
    apDes.copy(apHdg).addScaledVector(F.breakDir,1.4).normalize();turn*=1.15;spd=T.speed*1.1;
    if(T.ace&&!F.reversed&&F.stateT<.4){F.breakDir.negate();F.reversed=true;}   // aces scissor: reverse the break
    if(F.stateT<=0){F.state='engage';F.breakCD=(T.ace?1.4:2.6)+Math.random()*1.5;}
  }else if(F.state==='extend'){
    apDes.copy(apHdg).addScaledVector(apTo,-.6).normalize();turn*=.6;spd=T.speed*1.15;   // overshot: clear out, then come round
    if(F.stateT<=0)F.state='engage';
  }else if(F.attacker){
    if(noseOnMe>.35&&dist<520){
      // out in front of the player: swing wide for their flank and six instead of a head-on pass
      apSide.crossVectors(fwd,AP_UP);if(apSide.lengthSq()<1e-4)apSide.set(1,0,0);apSide.normalize();
      apPt.copy(p).addScaledVector(fwd,-150).addScaledVector(apSide,F.side*130);apPt.y+=F.alt;
    }else apPt.copy(p).addScaledVector(S.vel,Math.min(1.2,dist/(T.boltSpd||240)));   // lead pursuit
    apDes.copy(apPt).sub(m.position).normalize();
    canFire=aspect>.95;
    spd=chased?matchSpd():dist>380?T.speed*1.3:T.speed;
    if(dist<55){F.state='extend';F.stateT=.8+Math.random()*.5;}
  }else{
    // wing: a wide orbit round the fight, snap shots when one lines up
    apPt.copy(m.position).sub(p);apPt.y*=.4;if(apPt.lengthSq()<1)apPt.set(1,0,0);apPt.normalize();
    apSide.crossVectors(AP_UP,apPt).multiplyScalar(F.side);
    apDes.copy(p).addScaledVector(apPt,300).addScaledVector(apSide,180);apDes.y+=F.alt;
    apDes.sub(m.position).normalize();
    canFire=aspect>.985;
    if(chased)spd=matchSpd();
  }
  // look ahead for rock and hull and steer round it
  let avoid=false;
  for(const look of [35,85]){
    apLook.copy(m.position).addScaledVector(apHdg,look);
    const dd=arenaSdf(apLook,40);
    if(dd<30){arenaNormal(apLook,apN);apDes.addScaledVector(apN,(1-dd/30)*2.4+.3);avoid=true;}
  }
  if(avoid){apDes.normalize();turn*=1.6;}
  const ang=Math.acos(Math.max(-1,Math.min(1,apHdg.dot(apDes))));
  if(ang>1e-3)apHdg.lerp(apDes,Math.min(1,turn*dt/ang)).normalize();   // turn-rate-limited steer
  F.spd+=(spd-F.spd)*Math.min(1,1.6*dt);
  apPrev.copy(F.wvel);
  F.wvel.copy(apHdg).multiplyScalar(F.spd);
  m.position.addScaledVector(F.wvel,dt);
  arenaPushOut(m.position,T.r);
  // keep fighters inside the SAME zone the player is bound to
  {const ec=m.position.length()||1;apPt.copy(m.position).multiplyScalar(1/ec);
   if(ec>ARENA_R-140)F.wvel.addScaledVector(apPt,-((ec-(ARENA_R-140))/140)*240*dt);
   if(ec>ARENA_R-20){m.position.multiplyScalar((ARENA_R-20)/ec);const vd=F.wvel.dot(apPt);if(vd>0)F.wvel.addScaledVector(apPt,-vd*1.3);}}
  // bank into the turn: the lift vector leans toward the centre of the turn
  apAcc.copy(F.wvel).sub(apPrev).multiplyScalar(1/Math.max(dt,1e-3)).addScaledVector(AP_UP,40);
  apAcc.addScaledVector(apHdg,-apAcc.dot(apHdg));
  if(apAcc.lengthSq()>1e-3){apAcc.normalize();F.up.lerp(apAcc,Math.min(1,5*dt)).normalize();}
  m.up.copy(F.up);
  tmp.copy(m.position).sub(F.wvel);m.lookAt(tmp);                // nose (-z) along the flight path
  // contrail: a short glowing wake so a ship's motion reads at range
  F.trailT-=dt;
  if(F.trailT<=0&&!reduceMotion){F.trailT=.05;
    const tm=trailPool.get();tm.material.color.setHex(T.ace?0xffd23c:T.standoff?0xffb300:0xff5a3c);tm.material.opacity=.6;
    tm.position.copy(m.position).addScaledVector(apHdg,-3);tm.quaternion.copy(m.quaternion);tm.scale.set(.35,.35,2.2);
    trail.push({m:tm,life:.55});}
  enemyFire(F,dt,canFire&&dist<(T.missile?760:470)&&(T.standoff||aspect>.5),dist,m.position,p);
  return m.position.length()>ARENA_R+260;
}
