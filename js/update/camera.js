"use strict";
/* Update stage: camera. */

const chaseOff=new THREE.Vector3(0,2.6,9);   // chase camera offset from the ship, eased each frame
const leanE=new THREE.Euler(0,0,0,'YXZ'), leanQ=new THREE.Quaternion();
/* the flight HUD's anchors: eased wingtip positions on screen (chase); scratch for the cockpit glass point */
const hudSway={lx:0,ly:0,rx:0,ry:0,init:false};
const hudTipL=new THREE.Vector3(), hudTipR=new THREE.Vector3(), hudQ=new THREE.Quaternion(), hudE=new THREE.Euler();

/* the trench's feel: a low rumble at boost and on a pad, and sparks and a jolt when you skim a wall at speed */
function trenchFeel(fr){
  const {dt,p}=fr, spd=S.vel.length();
  if(S.boost||S.padT>0)S.shake=Math.max(S.shake,.12);
  S.skimT=(S.skimT||0)-dt;
  if(Math.abs(p.x)>HALF_W-5&&spd>80&&S.skimT<=0){
    S.skimT=.07;S.shake=Math.max(S.shake,.18);
    spark(tmp.set(Math.sign(p.x)*(HALF_W-.4),p.y,p.z-4),0xffb300,6,22);
  }
}
/* FOV, cockpit/chase camera, shake + impulse spring, chase reticle, engine flames */
function updateCamera(fr){
  if(S.bridge){bridgeCamera(fr);return;}   // the command bridge's tactical view (js/bridge.js)
  const {dt,p,sx}=fr;
  if(!fr.arena)trenchFeel(fr);
  /* ----- camera ----- */
  const baseF=(S.cam==='fp'?78:75)+SETTINGS.fov;
  const zoomF=(S.cam==='fp'?48:58)+SETTINGS.fov*.5;
  let fovT=baseF+(S.boost?(S.cam==='fp'?12:11):0);
  if(S.launchT>0)fovT+=9;   // catapult run: the view stretches
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
    // chase HUD: each pane hangs just off a wingtip, so it banks, leans and drifts with the hull
    // (wingtips projected from the leaning hull, eased lightly so it doesn't jitter)
    camera.updateMatrixWorld();ship.updateMatrixWorld();   // this frame's poses, not last render's
    const hw=shipById(PROG.ship).visual.wingSpan/2+1.4;   // half span plus the engine pods
    shipVis.localToWorld(hudTipL.set(-hw,.3,0)).project(camera);
    shipVis.localToWorld(hudTipR.set(hw,.3,0)).project(camera);
    if(hudTipL.z<1&&hudTipR.z<1){
      const lx=(hudTipL.x*.5+.5)*innerWidth, ly=(-hudTipL.y*.5+.5)*innerHeight,
            rx=(hudTipR.x*.5+.5)*innerWidth, ry=(-hudTipR.y*.5+.5)*innerHeight, k=Math.min(1,14*dt);
      if(!hudSway.init){Object.assign(hudSway,{lx,ly,rx,ry,init:true});}
      hudSway.lx+=(lx-hudSway.lx)*k;hudSway.ly+=(ly-hudSway.ly)*k;hudSway.rx+=(rx-hudSway.rx)*k;hudSway.ry+=(ry-hudSway.ry)*k;
      const ang=Math.max(-14,Math.min(14,Math.atan2(hudSway.ry-hudSway.ly,hudSway.rx-hudSway.lx)*57.3));
      const rot=' rotate('+ang.toFixed(2)+'deg)', vS=hudVel.style, yS=hudSys.style;
      vS.left=Math.max(180,hudSway.lx-16)+'px';vS.top=Math.max(130,Math.min(innerHeight-150,hudSway.ly-40))+'px';
      vS.right='auto';vS.bottom='auto';vS.transform='translate(-100%,-50%)'+rot;vS.transformOrigin='100% 50%';
      yS.left=Math.min(innerWidth-200,hudSway.rx+16)+'px';yS.top=Math.max(130,Math.min(innerHeight-150,hudSway.ry-40))+'px';
      yS.right='auto';yS.bottom='auto';yS.transform='translateY(-50%)'+rot;yS.transformOrigin='0 50%';
    }
  }else{
    // cockpit HUD: painted on the targeting glass. A point on the glass ahead of the eye is projected
    // each frame, so the HUD moves with the cockpit as the head leans, the view trails the airframe in
    // a turn, and the camera kicks; it also takes the cockpit's roll relative to the view.
    hudSway.init=false;
    camera.updateMatrixWorld();ship.updateMatrixWorld();
    ship.localToWorld(hudTipL.set(0,1.05,-1.6)).project(camera);
    hudQ.copy(camera.quaternion).invert().multiply(ship.quaternion);hudE.setFromQuaternion(hudQ,'YXZ');
    const x=Math.max(-70,Math.min(70,hudTipL.x*.5*innerWidth)), y=Math.max(-50,Math.min(50,-hudTipL.y*.5*innerHeight));
    fpHud.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) rotate('+(hudE.z*57.3).toFixed(2)+'deg)';
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
