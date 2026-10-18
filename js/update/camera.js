"use strict";
/* Update stage: camera. */

const chaseOff=new THREE.Vector3(0,2.6,9);   // chase camera offset from the ship, eased each frame
const leanE=new THREE.Euler(0,0,0,'YXZ'), leanQ=new THREE.Quaternion();

/* FOV, cockpit/chase camera, shake + impulse spring, chase reticle, engine flames */
function updateCamera(fr){
  const {dt,p,sx}=fr;
  /* ----- camera ----- */
  const baseF=(S.cam==='fp'?78:75)+SETTINGS.fov;
  const zoomF=(S.cam==='fp'?48:58)+SETTINGS.fov*.5;
  let fovT=baseF+(S.boost?(S.cam==='fp'?12:11):0);
  fovT+=(zoomF-fovT)*S.zoomK;
  camera.fov+=(fovT-camera.fov)*8*dt;camera.updateProjectionMatrix();
  // chase view: the hull's nose drifts toward the mouse (yaw/pitch lead plus a bank into the turn),
  // easing in so it reads as the ship leaning into where you're steering. Cockpit view stays rigid.
  if(S.cam==='tp'){
    leanE.set(-S.cursor.y*.2,-S.cursor.x*.3,-S.cursor.x*.42);leanQ.setFromEuler(leanE);
    shipVis.quaternion.slerp(leanQ,1-Math.exp(-5*dt));
  }else shipVis.quaternion.identity();
  if(S.cam==='fp'){
    // cockpit eye-point with g-lean; view rotation trails the airframe for sway
    tmp.set(-S.cursor.x*.12-sx*.05,1.05-S.cursor.y*.06,.55).applyQuaternion(ship.quaternion).add(p);
    camera.position.copy(tmp);
    camera.quaternion.slerp(ship.quaternion,1-Math.exp(-26*dt));
    if(S.fireKick>0&&shakeOn()){            // weapon recoil: brief pull-back + muzzle climb
      camera.position.addScaledVector(fwd,-S.fireKick*.05);
      camera.rotateX(-S.fireKick*.006);
    }
    if(S.shake>0&&shakeOn()){
      camera.position.x+=(Math.random()-.5)*S.shake*.6;
      camera.position.y+=(Math.random()-.5)*S.shake*.6;
      camera.rotateZ((Math.random()-.5)*S.shake*.02);
    }
  }else{
    // chase cam with a light mouse orbit (kept small: the hull's own lean shows the steering now)
    const orb=new THREE.Euler(-S.cursor.y*.14,-S.cursor.x*.2,0,'YXZ');
    // Ease the camera's OFFSET from the ship rather than its world position: easing the world
    // position left it trailing ~v/6 metres behind, so at full speed the ship shrank to a speck.
    // It still swings behind the ship when you turn, and drops back a touch with speed.
    const pull=Math.min(1.6,S.vel.length()/MAX_SPD)*2.2;
    tmp.set(0,2.6,9+pull).applyEuler(orb).applyQuaternion(ship.quaternion);
    chaseOff.lerp(tmp,1-Math.pow(.0015,dt));
    camera.position.copy(p).add(chaseOff);
    tmp.set(0,1.1,-30).applyQuaternion(ship.quaternion).add(p);
    if(S.shake>0&&shakeOn()){
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
  if(shakeOn()){camera.translateX(S.kick.x);camera.translateY(S.kick.y);camera.translateZ(S.kick.z);}
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
   // stretch the flame into a plume along the thrust axis instead of a growing ball
   for(const o of flameMeshes){const f=Math.random()*.18;o.scale.set(.45+k*.12+f*.4,.45+k*.12+f*.4,(k+f)*1.7);}
   const li=Math.min(2.4,k*1.4), lc=S.boost?0xffb300:0x35e8ff;
   for(const el of engineLights){el.intensity=li;el.color.setHex(lc);}
   const blink=(S.time%1.3)<.07;for(const st of shipStrobes)st.visible=blink;}
}
