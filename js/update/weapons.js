"use strict";
/* Update stage: player weapons. */

/* zoom/aim, player lasers, missile lock-on and missiles in flight */
function updateWeapons(fr){
  const {dt,p}=fr;
  /* ----- zoom / aim ----- */
  S.zoomK+=((S.zoomHeld?1:0)-S.zoomK)*Math.min(1,10*dt);
  $('zoomVig').style.opacity=S.zoomK*.85;
  const conv=380+S.zoomK*320; // gun convergence distance
  fwd.set(0,0,-1).applyQuaternion(ship.quaternion);
  aimP.copy(p).addScaledVector(fwd,conv);

  /* ----- player lasers (converge on the reticle) ----- */
  S.nextShot-=dt;
  if(S.fireHeld&&S.nextShot<=0){
    S.nextShot=(S.buffT>0?.055:.10)*curShip.rofMul;
    S.fireIdx=(S.fireIdx+1)%curGunPositions.length;   // cycle through the equipped hull's barrels
    const gp=curGunPositions[S.fireIdx];
    tmp.set(gp.x,gp.y,gp.z).applyQuaternion(ship.quaternion).add(p); // muzzle in world space
    tmp2.copy(aimP).sub(tmp);
    const spread=(.010*(1-S.zoomK*.85))*(1+S.fireKick*.6); // sustained fire drifts a little
    tmp2.normalize();
    tmp2.x+=(Math.random()-.5)*spread;tmp2.y+=(Math.random()-.5)*spread;
    fireBolt(pBolts,M.boltP,tmp,tmp2,720);sfx('laser');
    // muzzle flash + light + a couple of sparks, and recoil kick
    const mz=muzzles[S.fireIdx];if(mz)mz.material.opacity=1;
    if(muzzleLight){muzzleLight.intensity=2.6;muzzleLight.position.set(gp.x*.3,gp.y,gp.z);}
    spark(tmp,0x9ff7ff,2,46);
    S.fireKick=Math.min(.5,S.fireKick+.12);
  }
  // decay muzzle flash, muzzle light and recoil
  for(let mi=0;mi<muzzles.length;mi++){const o=muzzles[mi].material;if(o.opacity>0)o.opacity=Math.max(0,o.opacity-dt*16);}
  if(muzzleLight&&muzzleLight.intensity>0)muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*18);
  S.fireKick=Math.max(0,S.fireKick-dt*3.2);
  /* ----- missile lock-on (continuous acquisition + on-screen reticle) ----- */
  S.mslCD-=dt;
  // real lock: a candidate must dwell in the cone ~0.7s to charge to 100% before it homes
  const cand=acquireTarget();
  if(cand&&cand===S.lockTarget&&!cand.dead){
    const before=S.lockT;S.lockT=Math.min(1,S.lockT+dt/0.7);
    if(before<1&&S.lockT>=1)sfx('lock');          // lock acquired
  }else{const had=S.lockTarget;S.lockTarget=cand;S.lockT=0;if(cand&&!had)sfx('acquire');}
  if(S.lockTarget&&S.lockTarget.dead){S.lockTarget=null;S.lockT=0;}
  const locked=S.lockT>=1&&S.lockTarget;
  S.mslTarget=S.lockTarget;                        // HUD pip/lead follow the lock candidate
  if(S.lockTarget&&S.missiles>0){
    sv0.copy(S.lockTarget.mesh.position).project(camera);
    if(sv0.z<1){
      const minor=isTurret(S.lockTarget);
      mslLock.style.display='block';
      mslLock.style.transform='scale('+((minor?.6:1)*(1+(1-S.lockT)*.6)).toFixed(2)+')'; // bracket closes as it charges
      mslLock.style.opacity=minor?.5:(locked?1:.4+S.lockT*.5);
      mslLock.style.left=((sv0.x*.5+.5)*innerWidth)+'px';
      mslLock.style.top=((-sv0.y*.5+.5)*innerHeight)+'px';
      const dist=S.lockTarget.mesh.position.distanceTo(p);
      const tname=minor?'TURRET':bombers.indexOf(S.lockTarget)>=0?'BOMBER':'FIGHTER';
      mslLockTxt.textContent=locked?('LOCK · '+tname+' · '+(dist<1000?Math.round(dist)+'M':(dist/1000).toFixed(1)+'KM'))
        :('ACQUIRING '+Math.round(S.lockT*100)+'%');
    }else mslLock.style.display='none';
  }else mslLock.style.display='none';
  if(S.keys.KeyV&&S.mslCD<=0&&S.missiles>0){
    S.mslCD=.5;S.missiles--;
    launchMissile(locked?S.lockTarget:null);        // homing only on a full lock, else dumbfire forward
  }
  for(let i=msls.length-1;i>=0;i--){const ms=msls[i];
    ms.life-=dt;
    if(ms.target&&!ms.target.dead){
      tmp.copy(ms.target.mesh.position).sub(ms.m.position).normalize();
      sv1.copy(ms.v).normalize().lerp(tmp,Math.min(1,4.5*dt)).normalize();
      ms.v.copy(sv1).multiplyScalar(310);
    }
    ms.m.position.addScaledVector(ms.v,dt);
    if(ms.light)ms.light.position.copy(ms.m.position);
    ms.m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),sv1.copy(ms.v).normalize());
    if(Math.random()<.8)spark(ms.m.position,0xffb300,1,6); // smoke trail
    let boom=ms.life<=0;
    if(ms.target&&!ms.target.dead&&ms.m.position.distanceTo(ms.target.mesh.position)<7){
      boom=true;hitEnemy(ms.target,99); // missile guts most things in one shot
    }
    if(boom){
      burst(ms.m.position,0xff8844,1.8);spark(ms.m.position,0xff5500,22,34);spark(ms.m.position,0xffee88,12,40);
      S.shake=Math.min(1,S.shake+.35);addKick(0,.6,0);hitStop(.07);sfx('boom');freeLight(ms.light);scene.remove(ms.m);msls.splice(i,1);
    }
  }
}
