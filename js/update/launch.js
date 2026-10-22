"use strict";
/* Update stage: the carrier launch intro. Arena runs with HALCYON on station start with your ship in its bay;
   the catapult run carries you out of the mouth and hands control over (S.launchT counts down; 0 = flying). */

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
  launchHint.style.display='block';
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
