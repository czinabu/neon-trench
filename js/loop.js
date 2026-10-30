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
  padPoll();   // gamepad (js/gamepad.js)
  if(S.mode==='play'&&!S.awaitLock){
    frame.rdt=dt;   // real time, for what keeps its pace while the game is slowed (the bridge camera)
    if(S.slowT>0){S.slowT-=dt;dt*=0.14;}   // hit-stop / slow-mo on big impacts & kills
    if(S.bridge)dt*=BRIDGE.slow;   // on the command bridge the battle runs slow (js/bridge.js)
    update(dt);
  }
  if(!renderDeck(dt)&&!renderStage(dt)&&!renderHolo())renderFrame();   // HALCYON's deck draws itself (js/deck.js), the menus draw their own backdrop (js/stage.js), the bridge its command room (js/holoroom.js)
}
requestAnimationFrame(loop);
function hitStop(t){ if(t>S.slowT)S.slowT=t; }   // request a brief time-dilation

/* Per-frame context shared between the update stages below (reused, never reallocated).
   Each stage reads what it needs and writes values later stages depend on. */
const frame={dt:0,rdt:0,arcade:false,arena:false,p:null,prevP:new THREE.Vector3(),sx:0,gateNear:false,distPort:0,impactDist:0};
/* One simulation tick. Stage order matters: it is the exact order the original
   single-function update ran in. A stage returning true means the run just ended. */
function update(dt){
  S.time+=dt;
  const fr=frame;
  fr.dt=dt;
  fr.arcade=S.model==='arcade';
  fr.arena=S.sector==='arena';      // dogfighting → free flight (no auto-level / stick-recenter)
  fr.p=ship.position;
  if(S.launchT>0)updateLaunch(fr);else updateFlight(fr);   // the carrier launch run flies the ship itself
  if(updateWorld(fr))return;
  updateWeapons(fr);
  updateEnemies(fr);
  updateWingmen(fr);
  updateCapital(fr);
  if(S.launchT<=0)updateCollisions(fr);
  updateParticles(fr);
  if(updateObjective(fr))return;
  updateCamera(fr);
  updateAimAids(fr);
  updateAudio(fr);
  updateRadio(fr);
  updateHud(fr);
}
