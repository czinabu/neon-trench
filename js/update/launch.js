"use strict";
/* Update stage: the scripted starts. The carrier launch: arena runs with HALCYON on station start with your ship in its bay,
   and the catapult run carries you out of the mouth and hands control over (S.launchT counts down; 0 = flying).
   The trench dive: a trench run launched from a briefing or the menus (after its intro, js/cutscene.js) starts high over
   the trench mouth, or out in front of a capital ship's breach, and dives in, levelling off where a run starts (S.diveT). */

const LAUNCH_T = 2.6, LAUNCH_EXIT_SPD = 170;   // seconds of scripted run; speed leaving the mouth
const launchHdg = new THREE.Vector3(), launchOut = new THREE.Vector3();

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
const DIVE_T=2.4, DIVE_FROM=[0,52,480], DIVE_FROM_INT=[150,55,470];   // seconds; where it starts over the trench mouth (under the skyline), and off THRONE's breach
const diveQ=new THREE.Matrix4(), diveA=new THREE.Vector3(), diveB=new THREE.Vector3();
/* where the dive has the ship at time t (0 to DIVE_T): along the run at a speed that eases down to the run's own, while
   the height and the sideways offset ease out so the ship arrives level at the start point */
function divePos(t,o){
  const k=Math.min(1,t/DIVE_T),e=(1-k)*(1-k),F=S.interior?DIVE_FROM_INT:DIVE_FROM,v1=S.diveSpd,D=F[2]-80,v0=2*D/DIVE_T-v1;
  const tt=Math.min(t,DIVE_T)*1,z=F[2]-(v0*tt-(v0-v1)/(2*DIVE_T)*tt*tt)-Math.max(0,t-DIVE_T)*v1;
  return o.set(F[0]*e,F[1]*e,z);
}
function diveBegin(){
  S.diveSpd=-S.vel.z;S.diveT=DIVE_T;
  divePos(0,ship.position);diveFace(0);
  camera.position.copy(ship.position).add(tmp.set(0,1.05,.55).applyQuaternion(ship.quaternion));camera.quaternion.copy(ship.quaternion);
  launchHint.textContent=(S.interior?'Into the breach':'Diving into the trench')+' · click or Enter to skip';launchHint.style.display='block';
}
function diveFace(t){
  divePos(t,diveA);divePos(t+.08,diveB);
  ship.quaternion.setFromRotationMatrix(diveQ.lookAt(diveA,diveB,ship.up));
  const k=Math.min(1,t/DIVE_T);ship.rotateZ(Math.sin(k*Math.PI)*(S.interior?-.3:.1));   // a little bank on the way in
}
function diveEnd(){
  S.diveT=0;launchHint.style.display='none';
  divePos(DIVE_T,ship.position);ship.quaternion.identity();
  S.vel.set(0,0,-S.diveSpd);
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
