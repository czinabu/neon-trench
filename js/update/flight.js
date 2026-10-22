"use strict";
/* Update stage: player flight model. */

/* rotation, thrust, boost energy, sector bounds, shield regen */
function updateFlight(fr){
  const {dt,arcade,arena}=fr;
  /* ----- rotation ----- */
  const turn=(arena?1.85:arcade?1.5:1.75)*curShip.turnMul*(1-S.zoomK*.35);
  ship.rotateY(-S.cursor.x*turn*dt);
  ship.rotateX(-S.cursor.y*turn*dt);
  const roll=(S.keys.KeyQ?1:0)-(S.keys.KeyE?1:0);
  ship.rotateZ(roll*1.9*dt);
  if(arcade&&!arena){                   // arcade assists belong to the trench, not the dogfight
    if(!roll){ // hands-off auto-level
      eul.setFromQuaternion(ship.quaternion,'YXZ');
      ship.rotateZ(-eul.z*Math.min(1,1.5*dt));
    }
    const rec=Math.exp(-2.8*dt); // virtual stick springs back to centre
    S.cursor.x*=rec;S.cursor.y*=rec;
  }
  /* ----- thrust ----- arcade = COUPLED (release → coast to 0); realistic = set-and-hold cruise */
  if(S.keys.KeyW)S.throttle=Math.min(1,S.throttle+.8*dt);
  else if(S.keys.KeyS)S.throttle=Math.max(-.35,S.throttle-.8*dt);
  else if(arcade)S.throttle*=Math.exp(-5*dt);   // coupled: hands off → throttle (and speed) bleed to zero
  if(S.keys.KeyX)S.throttle=0;
  // boost now draws from a limited energy cell: drains while held, recharges when released
  const wantBoost=!!(S.keys.ShiftLeft||S.keys.ShiftRight);
  S.boost=wantBoost&&S.boostE>0&&!S.boostLock;
  if(S.boost)S.boostUsed=true;
  if(S.boost){S.boostE=Math.max(0,S.boostE-30*dt);if(S.boostE<=0)S.boostLock=true;}
  else{S.boostE=Math.min(100,S.boostE+16*curShip.boostRegenMul*dt);
    if(S.boostLock&&!wantBoost&&S.boostE>25)S.boostLock=false;} // must release + recharge to re-engage
  const sx=(S.keys.KeyD?1:0)-(S.keys.KeyA?1:0);
  const sy=(S.keys.Space?1:0)-(S.keys.KeyC?1:0);
  const mult=(S.boost?BOOST_MULT:1)*(S.buffT>0?1.15:1);
  tmp.set(sx*.65,sy*.65,-S.throttle).multiplyScalar(MAX_SPD*curShip.spdMul*mult).applyQuaternion(ship.quaternion);
  tmp2.copy(tmp).sub(S.vel);
  const a=((arcade||arena)?ACCEL_ARC:ACCEL_REAL)*curShip.accelMul*mult*dt;  // responsive authority in the dogfight
  if(tmp2.length()>a)tmp2.setLength(a);
  S.vel.add(tmp2);
  fr.prevP.copy(ship.position);   // collision checks sweep from here, so a fast frame can't skip an obstacle
  ship.position.addScaledVector(S.vel,dt);

  /* ----- bounds (per sector) ----- */
  const p=ship.position;
  if(arena){
    // soft spherical combat-zone boundary — a gentle nudge well before the dome, warning only AT the edge
    const RR=S.school?SCHOOL_R:ARENA_R;   // flight school's range is bigger than the arena
    const dc=p.length()||1; sv0.copy(p).multiplyScalar(1/dc); // unit outward
    if(dc>RR-140) S.vel.addScaledVector(sv0,-((dc-(RR-140))/140)*240*dt); // quiet steer-back
    if(dc>RR){p.multiplyScalar(RR/dc);const vd=S.vel.dot(sv0);if(vd>0)S.vel.addScaledVector(sv0,-vd*1.3);}
    // the energy dome brightens as you push toward it → a clear, distinct edge
    if(arenaDomeMat){const k=Math.max(0,Math.min(1,(dc-(RR-200))/200));
      arenaDomeMat.uniforms.k.value=k*k;arenaDomeMat.uniforms.pp.value.copy(sv0).multiplyScalar(ARENA_R);arenaDomeMat.visible=k>.01;}
    if(dc>RR-40){warn.textContent=S.school?'!! RETURN TO THE RANGE !!':'!! RETURN TO COMBAT ZONE !!';warn.style.display='block';}
    else threatWarn();
  }else{
    if(Math.abs(p.x)>HALF_W-2.2){p.x=Math.sign(p.x)*(HALF_W-2.2);S.vel.x*=-.4;
      damage(9,'Scraped into the trench wall at speed.');spark(p,0xffb300,8);}
    if(p.y<FLOOR_Y+2.2){p.y=FLOOR_Y+2.2;S.vel.y*=-.4;
      damage(9,'Bellied out on the trench floor.');spark(p,0xffb300,8);}
    if(S.interior){   // inside a capital ship the ceiling is solid hull, not flak
      if(p.y>INT_CEIL-5){p.y=INT_CEIL-5;S.vel.y*=-.4;
        damage(9,'Scraped the ceiling inside '+S.capName+'.');spark(p,0xffb300,8);}
      if(p.y>INT_CEIL-9){warn.textContent='!! ceiling !!';warn.style.display='block';}
      else threatWarn();
    }else if(p.y>TOP_Y){
      warn.textContent='!! AA flak — dive back into the trench !!';warn.style.display='block';
      S.flakT-=dt;
      if(S.flakT<=0){S.flakT=.55;damage(7,'Shredded by anti-air flak above the trench.');
        spark(tmp.set(p.x+(Math.random()-.5)*14,p.y+(Math.random()-.5)*10,p.z-10),0xffb300,12);sfx('boom',tmp);}
    }else if(p.y>TOP_Y-6){warn.textContent='!! flak ceiling !!';warn.style.display='block';}
    else threatWarn();
  }

  /* ----- shields regen ----- */
  if(S.time-S.lastHit>3)S.shield=Math.min(100,S.shield+7*curShip.shieldRegenMul*dt);
  fr.sx=sx;
}
/* missile / lock / hull warnings shared by both sectors (the sector's own edge warnings take priority) */
function threatWarn(){
  let t='';
  if(S.mslWarnD<650)t=S.cm>0?'!! MISSILE INBOUND — FLARES [G] !!':'!! MISSILE INBOUND — BREAK !!';
  else if(S.lockWarn)t=S.cm>0?'!! ENEMY LOCK — FLARES READY [G] !!':'!! ENEMY LOCK !!';
  else if(S.hull<=25)t='!! hull critical !!';
  if(t){warn.textContent=t;warn.style.display='block';}else warn.style.display='none';
}
