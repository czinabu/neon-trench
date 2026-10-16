"use strict";
/* Update stage: enemy AI, mines, pickups. */

/* turrets, fighters, bombers, mines, pickups */
function updateEnemies(fr){
  const {dt,arena,p}=fr;
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
  for(let i=fighters.length-1;i>=0;i--){const F=fighters[i];
    F.t+=dt;const m=F.mesh;
    const d=m.position.distanceTo(p);
    // threat sense (trench only — the open-space dogfight uses committed attack runs, no reactive jink)
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
      // attack-run dogfight: gentle straight run-in → pass beside you → extend straight (clean shot) → loop back
      sv0.copy(p).sub(m.position);const dist=sv0.length()||1;sv0.multiplyScalar(1/dist); // toward player
      if(F.wvel.lengthSq()<1)F.wvel.copy(sv0).multiplyScalar(T.speed);
      sv1.copy(F.wvel).normalize();                                   // current heading
      F.stateT-=dt;let turnRate=T.turn,canFire=false;
      if(T.standoff){
        // missile boat: circles on a ring around you at standoff range and lobs missiles from there
        tmp.copy(m.position).sub(p);tmp.y*=.5;tmp.setLength(T.standoff);
        sv2.set(0,1,0).cross(tmp).setLength(T.standoff*.6*(F.seed>4.5?1:-1));
        sv0.copy(p).add(tmp).add(sv2).sub(m.position).normalize();
        canFire=dist<760;
      }else{
        if(F.state==='extend'){turnRate=T.ace?1.2:.3;if(F.stateT<=0)F.state='approach';}     // blow past, fly straight out (clean tail shot)
        else{canFire=true;if(dist<(T.ace?90:120)){F.state='extend';F.stateT=(T.ace?.35:.55)+Math.random()*.4;}} // steady, leadable run-in; banks it back for the next pass
        if(F.state==='extend'){sv0.copy(sv1);}      // hold heading
        else{sv2.set(0,1,0).cross(sv0);if(sv2.lengthSq()>1e-4){sv2.normalize();sv0.addScaledVector(sv2,F.passOff);}sv0.normalize();} // aim just BESIDE the player (pass-by, not ram)
      }
      // elite pilots break hard the moment you line them up (gun held or missile lock on them)
      if(T.jink){
        F.jinkCD-=dt;F.jinkT-=dt;
        tmp.copy(m.position).sub(p).normalize();
        if(F.jinkCD<=0&&tmp.dot(fwd)>.975&&dist<600&&(S.fireHeld||F===S.mslTarget)){
          F.jinkT=.45+Math.random()*.35;F.jinkCD=1.3+Math.random();
          F.jinkDir.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).cross(sv1).normalize();
        }
        if(F.jinkT>0){sv0.copy(sv1).addScaledVector(F.jinkDir,1.6).normalize();turnRate*=1.8;canFire=false;}
      }
      const ang=Math.acos(Math.max(-1,Math.min(1,sv1.dot(sv0))));
      if(ang>1e-3)sv1.lerp(sv0,Math.min(1,turnRate*dt/ang)).normalize(); // turn-rate-limited steer
      F.wvel.copy(sv1).multiplyScalar(T.speed*(F.jinkT>0?1.15:1));
      m.position.addScaledVector(F.wvel,dt);
      // keep fighters inside the SAME zone the player is bound to — otherwise an attack run can
      // carry them past the dome (player is hard-walled at ARENA_R) and they go unreachable until they drift back
      {const ec=m.position.length()||1;tmp2.copy(m.position).multiplyScalar(1/ec);
       if(ec>ARENA_R-140)F.wvel.addScaledVector(tmp2,-((ec-(ARENA_R-140))/140)*240*dt);
       if(ec>ARENA_R-20){m.position.multiplyScalar((ARENA_R-20)/ec);const vd=F.wvel.dot(tmp2);if(vd>0)F.wvel.addScaledVector(tmp2,-vd*1.3);}}
      tmp.copy(m.position).sub(F.wvel);m.lookAt(tmp);                // nose (-z) along the flight path
      sv0.copy(p).sub(m.position).normalize();
      enemyFire(F,dt,canFire&&dist<(T.missile?760:470)&&(T.standoff||sv1.dot(sv0)>.5),dist,m.position,p); // guns only on the inbound run
      if(m.position.length()>ARENA_R+260){F.dead=true;scene.remove(m);fighters.splice(i,1);}
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
    const ang=Math.acos(Math.max(-1,Math.min(1,sv1.dot(sv0))));
    if(ang>1e-3)sv1.lerp(sv0,Math.min(1,1.5*dt/ang)).normalize();   // limited turn: a hard break shakes it
    E.v.copy(sv1).multiplyScalar(Math.min(arena?235:205,E.v.length()+140*dt));   // accelerates off the rail
    relA.copy(E.m.position).sub(fr.prevP);
    E.m.position.addScaledVector(E.v,dt);
    relB.copy(E.m.position).sub(p);
    tmp.copy(E.m.position).sub(E.v);E.m.lookAt(tmp);
    if(segSphere(relA,relB,ORIGIN,3.2)){
      burst(E.m.position,0xff4030,1.1);damage(16,'Caught by a homing missile.',E.m.position);
      scene.remove(E.m);eMsls.splice(i,1);continue;}
    if(E.life<=0){burst(E.m.position,0xff4030,.6);scene.remove(E.m);eMsls.splice(i,1);continue;}
    if(sv1.dot(sv0)>.3)warnD=Math.min(warnD,md);   // still has you
    else if(md<40&&!E.whoosh){E.whoosh=true;sfx('flyby',E.m.position);}   // shook it: it screams past
  }
  S.mslWarnD=warnD;
  if(warnD<700){S.mslBeepT-=dt;if(S.mslBeepT<=0){S.mslBeepT=.1+warnD/700*.45;sfx('mslwarn');}}else S.mslBeepT=0;
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
  if(!ready||F.fireT>0)return;
  F.fireT=T.fire[0]+Math.random()*T.fire[1];F.attacks++;
  if(T.missile||(T.missile2&&F.attacks%3===0)){
    spawnEnemyMissile(from,tmp2.copy(p).sub(from));
    if(T.missile)return;
  }
  F.burst=(T.shots||1)-1;F.burstT=T.gap||0;enemyBolt(T,from,dist,p);
}
function enemyBolt(T,from,dist,p){
  tmp2.copy(p).addScaledVector(S.vel,dist/T.boltSpd).sub(from);
  fireBolt(eBolts,M.boltE,from,tmp2,T.boltSpd);sfx('ezap',from);
}
