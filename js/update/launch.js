"use strict";
/* Update stage: the scripted starts. The carrier launch: arena runs with HALCYON on station start with your ship in its bay,
   and the catapult run carries you out of the mouth and hands control over (S.launchT counts down; 0 = flying).
   The trench dive: a trench run launched from a briefing or the menus (after its intro, js/cutscene.js) starts high over
   the trench mouth, or out in front of a capital ship's breach, and dives in, levelling off where a run starts (S.diveT). */

const LAUNCH_T = 2.6, LAUNCH_EXIT_SPD = 170;   // seconds of scripted run; speed leaving the mouth
const launchHdg = new THREE.Vector3(), launchOut = new THREE.Vector3();

/* The flight phase of a sortie, read off the two timers so it can never disagree with them:
     launch  S.launchT>0: the catapult run out of HALCYON's bay (updateLaunch flies the ship)
     dive    S.diveT>0:   the scripted dive into the trench mouth (updateDive flies the ship)
     free    the pilot has the controls (updateFlight)
   A sortie starts in launch or dive (startGame) or straight in free; both scripted phases end in free. */
const flightPhase=()=>S.launchT>0?'launch':S.diveT>0?'dive':'free';

/* put the player in HALCYON's bay, nose out; startGame sets S.launchT first (so the wingmen queue behind) and
   calls this once the ship and camera have been reset */
function launchBegin(){
  const K=carrierShip();
  if(!K||K.dead||K.state!=='fight'){S.launchT=0;return;}
  ship.position.copy(K.bay);K.g.localToWorld(ship.position);
  ship.quaternion.copy(K.g.quaternion);
  S.launchSpd=25;
  S.vel.set(0,0,0);
  chaseOff.set(0,2.6,9).applyQuaternion(ship.quaternion);
  camera.quaternion.copy(ship.quaternion);
  camera.position.copy(ship.position).add(tmp.set(0,1.05,.55).applyQuaternion(ship.quaternion));
  announce('HALCYON LAUNCH','Bay clear · catapult run','');
  launchHint.textContent='Launching from HALCYON · click or Enter to skip';launchHint.style.display='block';
}

/* control comes back to the player; skipping jumps straight to the mouth's end */
function launchEnd(skipped){
  const K=carrierShip();
  if(skipped&&K){
    launchHdg.set(0,0,-1).applyQuaternion(K.g.quaternion);
    launchOut.copy(K.bay);K.g.localToWorld(launchOut);
    launchOut.addScaledVector(launchHdg,100);        // just past the bay mouth
    if(launchOut.sub(ship.position).dot(launchHdg)>0)ship.position.add(launchOut);   // never back up if already clear
    wingmen.forEach(w=>{if(w.launch>2.2)w.launch=2.2;});
  }
  S.launchT=0;
  S.vel.copy(launchHdg.set(0,0,-1).applyQuaternion(ship.quaternion)).multiplyScalar(LAUNCH_EXIT_SPD);
  S.throttle=.9;
  launchHint.style.display='none';
}

function updateLaunch(fr){
  const dt=fr.dt;
  if(S.fireHeld){S.fireHeld=false;launchEnd(true);return;}
  const K=carrierShip();
  if(!K||K.dead||K.state!=='fight'){launchEnd(false);return;}
  S.launchT-=dt;
  fr.prevP.copy(ship.position);
  launchHdg.set(0,0,-1).applyQuaternion(K.g.quaternion);
  S.launchSpd=Math.min(LAUNCH_EXIT_SPD,S.launchSpd+95*dt);
  ship.quaternion.copy(K.g.quaternion);
  ship.position.addScaledVector(launchHdg,S.launchSpd*dt);
  S.vel.copy(launchHdg).multiplyScalar(S.launchSpd);
  S.throttle=S.launchSpd/LAUNCH_EXIT_SPD;
  fr.sx=0;
  if(S.launchT<=0)launchEnd(false);
}

/* ---- the trench dive ---- */
const DIVE_T=2.4, DIVE_FROM=[0,DECK_Y+50,520], DIVE_FROM_INT=[150,55,470];   // seconds; where it starts over the trench mouth, and off THRONE's breach
const DIVE_CAM=[26,6], DIVE_FOV=56;   // the dive's opening camera: metres behind and above the hull, and its field of view
const diveQ=new THREE.Matrix4(), diveA=new THREE.Vector3(), diveB=new THREE.Vector3(), diveUp=new THREE.Vector3(0,1,0),
  diveCP=new THREE.Vector3(), diveAt=new THREE.Vector3(), diveCQ=new THREE.Quaternion(), diveTQ=new THREE.Quaternion();
/* where the dive has the ship at time t (0 to DIVE_T), starting from F at the speed that eases down to v1 (the run's
   own) at the start point (z 80), while the height and the sideways offset ease out so it arrives level */
function divePos(t,o,v1,F){
  v1=v1===undefined?S.diveSpd:v1;F=F||(S.interior?DIVE_FROM_INT:DIVE_FROM);
  const k=Math.min(1,t/DIVE_T),e=(1-k)*(1-k),D=F[2]-80,v0=2*D/DIVE_T-v1,tt=Math.min(t,DIVE_T);
  return o.set(F[0]*e,F[1]*e,F[2]-(v0*tt-(v0-v1)/(2*DIVE_T)*tt*tt)-Math.max(0,t-DIVE_T)*v1);
}
/* the dive's opening camera for a hull at p heading along dir (unit): behind it and above, looking down its line.
   A trench intro's last frame is this same pose (js/cutscene.js), so the cut into the dive lands on the same view. */
function diveCamPose(p,dir,oPos,oQ){
  oPos.copy(p).addScaledVector(dir,-DIVE_CAM[0]);oPos.y+=DIVE_CAM[1];
  diveAt.copy(p).addScaledVector(dir,60);oQ.setFromRotationMatrix(diveQ.lookAt(oPos,diveAt,diveUp));
}
function diveBegin(){
  S.diveSpd=-S.vel.z;S.diveT=DIVE_T;S.diveCam=S.cam;
  if(S.cam==='fp')setCam('tp');   // it opens outside the hull; a cockpit pilot is flown into the cockpit (diveCamera)
  divePos(0,ship.position);diveFace(0);
  camera.fov=DIVE_FOV;camera.updateProjectionMatrix();chaseOff.set(0,2.6,9).applyQuaternion(ship.quaternion);
  diveCamera();
  launchHint.textContent=(S.interior?'Into the breach':'Diving into the trench')+' · click or Enter to skip';launchHint.style.display='block';
}
function diveFace(t){
  divePos(t,diveA);divePos(t+.08,diveB);
  ship.quaternion.setFromRotationMatrix(diveQ.lookAt(diveA,diveB,ship.up));
  const k=Math.min(1,t/DIVE_T);ship.rotateZ(Math.sin(k*Math.PI)*(S.interior?-.3:.1));   // a little bank on the way in
}
/* after the camera stage: ease from the opening pose to the view the pilot flies with (the chase camera, or the
   cockpit's eye point, switching to the cockpit once the camera is inside it) */
function diveCamera(){
  const t=DIVE_T-S.diveT,b=cutEase((t-.15)/(DIVE_T-.45));
  divePos(t,diveA);divePos(t+.05,diveB);diveB.sub(diveA).normalize();
  diveCamPose(diveA,diveB,diveCP,diveCQ);
  if(S.diveCam==='fp'){camera.position.set(0,1.05,.55).applyQuaternion(ship.quaternion).add(ship.position);camera.quaternion.copy(ship.quaternion);}
  diveTQ.copy(camera.quaternion);
  camera.position.lerpVectors(diveCP,camera.position,b);camera.quaternion.copy(diveCQ).slerp(diveTQ,b);
  camera.fov=DIVE_FOV+(camera.fov-DIVE_FOV)*b;camera.updateProjectionMatrix();
  if(S.diveCam==='fp'&&b>.985&&S.cam!=='fp')setCam('fp');
}
/* a run that ends or restarts mid-dive gives a cockpit pilot their cockpit back */
function diveCamRestore(){if(S.diveT>0&&S.diveCam==='fp'&&S.cam!=='fp')setCam('fp');}
function diveEnd(){
  S.diveT=0;launchHint.style.display='none';
  divePos(DIVE_T,ship.position);ship.quaternion.identity();
  S.vel.set(0,0,-S.diveSpd);
  if(S.diveCam==='fp'&&S.cam!=='fp')setCam('fp');
}
function updateDive(fr){
  if(S.fireHeld){S.fireHeld=false;diveEnd();return;}
  fr.prevP.copy(ship.position);
  S.diveT=Math.max(0,S.diveT-fr.dt);
  const t=DIVE_T-S.diveT;
  divePos(t,ship.position);diveFace(t);
  divePos(t+.05,diveB);S.vel.copy(diveB).sub(ship.position).multiplyScalar(20);
  fr.sx=0;
  if(S.diveT<=0)diveEnd();
}
