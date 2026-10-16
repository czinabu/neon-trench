"use strict";
/* Main loop: fixed-order update stages, then render. */

/* ============================ MAIN LOOP ============================ */
const fwd=new THREE.Vector3(),tmp=new THREE.Vector3(),tmp2=new THREE.Vector3(),
      sv0=new THREE.Vector3(),sv1=new THREE.Vector3(),sv2=new THREE.Vector3(),
      aimP=new THREE.Vector3(),eul=new THREE.Euler();  // shared scratch — avoid per-frame allocation
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  let dt=Math.min(.05,(now-last)/1000);last=now;
  if(S.mode==='play'&&!S.awaitLock){
    if(S.slowT>0){S.slowT-=dt;dt*=0.14;}   // hit-stop / slow-mo on big impacts & kills
    update(dt);
  }
  renderFrame();
}
requestAnimationFrame(loop);
function hitStop(t){ if(t>S.slowT)S.slowT=t; }   // request a brief time-dilation

/* Per-frame context shared between the update stages below (reused, never reallocated).
   Each stage reads what it needs and writes values later stages depend on. */
const frame={dt:0,arcade:false,arena:false,p:null,prevP:new THREE.Vector3(),sx:0,gateNear:false,distPort:0,impactDist:0};
/* One simulation tick. Stage order matters: it is the exact order the original
   single-function update ran in. A stage returning true means the run just ended. */
function update(dt){
  S.time+=dt;
  const fr=frame;
  fr.dt=dt;
  fr.arcade=S.model==='arcade';
  fr.arena=S.sector==='arena';      // dogfighting → free flight (no auto-level / stick-recenter)
  fr.p=ship.position;
  updateFlight(fr);
  if(updateWorld(fr))return;
  updateWeapons(fr);
  updateEnemies(fr);
  updateCollisions(fr);
  updateParticles(fr);
  if(updateObjective(fr))return;
  updateCamera(fr);
  updateAimAids(fr);
  updateAudio(fr);
  updateHud(fr);
}
