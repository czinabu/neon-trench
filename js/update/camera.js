"use strict";
/* Update stage: camera. */

/* FOV, cockpit/chase camera, shake + impulse spring, chase reticle, engine flames */
function updateCamera(fr){
  const {dt,p,sx}=fr;
  /* ----- camera ----- */
  const baseF=S.cam==='fp'?78:75;
  const zoomF=S.cam==='fp'?48:58;
  let fovT=baseF+(S.boost?(S.cam==='fp'?12:11):0);
  fovT+=(zoomF-fovT)*S.zoomK;
  camera.fov+=(fovT-camera.fov)*8*dt;camera.updateProjectionMatrix();
  if(S.cam==='fp'){
    // cockpit eye-point with g-lean; view rotation trails the airframe for sway
    tmp.set(-S.cursor.x*.12-sx*.05,1.05-S.cursor.y*.06,.55).applyQuaternion(ship.quaternion).add(p);
    camera.position.copy(tmp);
    camera.quaternion.slerp(ship.quaternion,1-Math.exp(-26*dt));
    if(S.fireKick>0&&!reduceMotion){            // weapon recoil: brief pull-back + muzzle climb
      camera.position.addScaledVector(fwd,-S.fireKick*.05);
      camera.rotateX(-S.fireKick*.006);
    }
    if(S.shake>0&&!reduceMotion){
      camera.position.x+=(Math.random()-.5)*S.shake*.6;
      camera.position.y+=(Math.random()-.5)*S.shake*.6;
      camera.rotateZ((Math.random()-.5)*S.shake*.02);
    }
  }else{
    // chase cam with light mouse orbit
    const orb=new THREE.Euler(-S.cursor.y*.3,-S.cursor.x*.45,0,'YXZ');
    tmp.set(0,2.6,9).applyEuler(orb).applyQuaternion(ship.quaternion).add(p); // pulled in closer to the ship
    camera.position.lerp(tmp,1-Math.pow(.0015,dt));
    tmp.set(0,1.1,-30).applyQuaternion(ship.quaternion).add(p);
    if(S.shake>0&&!reduceMotion){
      tmp.x+=(Math.random()-.5)*S.shake*3;tmp.y+=(Math.random()-.5)*S.shake*3;
    }
    // roll the chase cam with the airframe: bank the camera "up" toward the ship's up
    sv2.set(0,1,0).applyQuaternion(ship.quaternion);
    camera.up.lerp(sv2,1-Math.exp(-9*dt)).normalize();
    camera.lookAt(tmp);
  }
  S.shake=Math.max(0,S.shake-2.4*dt);
  // integrate the impulse spring (underdamped → punchy overshoot) and apply in camera-local space
  S.kickV.x+=(-S.kick.x*200-S.kickV.x*22)*dt;
  S.kickV.y+=(-S.kick.y*200-S.kickV.y*22)*dt;
  S.kickV.z+=(-S.kick.z*200-S.kickV.z*22)*dt;
  S.kick.addScaledVector(S.kickV,dt);
  if(!reduceMotion){camera.translateX(S.kick.x);camera.translateY(S.kick.y);camera.translateZ(S.kick.z);}
  // projected gun reticle in third person
  if(S.cam==='tp'){
    sv0.copy(aimP).project(camera);
    if(sv0.z<1){
      aimT.style.display='block';
      aimT.style.left=((sv0.x*.5+.5)*innerWidth)+'px';
      aimT.style.top=((-sv0.y*.5+.5)*innerHeight)+'px';
    }else aimT.style.display='none';
    // chase HUD: flank the SHIP itself so the readouts frame it and track as it drifts/banks
    sv0.copy(ship.position).project(camera);
    if(sv0.z<1){
      const sx=(sv0.x*.5+.5)*innerWidth, sy=(-sv0.y*.5+.5)*innerHeight;
      const vS=hudVel.style, yS=hudSys.style;
      vS.left=Math.max(150,sx-200)+'px';vS.top=sy+'px';vS.right='auto';vS.bottom='auto';vS.transform='translate(-100%,-50%)';
      yS.left=Math.min(innerWidth-150,sx+180)+'px';yS.top=sy+'px';yS.right='auto';yS.bottom='auto';yS.transform='translateY(-50%)';
    }
  }
  // engine flames scale with throttle (cached refs — no per-frame traverse) — punchier response
  // than before so the thrusters themselves read as "firing hard", not just a trail behind them
  {const k=.34+Math.abs(S.throttle)*(S.boost?2.1:1.2);
   for(const o of flameMeshes)o.scale.setScalar(k+Math.random()*.18);
   const li=Math.min(3.4,k*1.9), lc=S.boost?0xffb300:0x35e8ff;
   for(const el of engineLights){el.intensity=li;el.color.setHex(lc);}}
}
