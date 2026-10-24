"use strict";
/* Global game state (S), best-score record, camera/flight-model toggles. */

/* ============================ STATE & INPUT ============================ */
const S={mode:'menu',vel:new THREE.Vector3(),throttle:.45,boost:false,
  cam:'fp',model:'arcade',cruise:false,zoomHeld:false,zoomK:0,
  shield:100,hull:100,kills:0,time:0,lastHit:-9,lock:0,locked:false,fired:false,
  missiles:MSL_START,mslMode:false,mslCD:0,mslTarget:null,lockTarget:null,lockT:0,target:null,
  score:0,combo:0,comboT:0,comboMax:0,
  cursor:{x:0,y:0},keys:{},fireHeld:false,nextShot:0,fireKick:0,fireIdx:0,fighterT:6,squadT:12,bomberT:18,flakT:0,leaderMode:false,leaderSpawned:false,leaderDown:false,mslWarnD:1e9,mslBeepT:0,annT:0,
  shake:0,slowT:0,kick:new THREE.Vector3(),kickV:new THREE.Vector3(),nextSpawnZ:0,buffT:0,flowX:0,flowY:0,
  boostE:100,boostLock:false,boostUsed:false,
  cm:4,cmT:0,cmCD:0,lockWarn:false,lockBeepT:0,bumpT:-9,   // flares (countermeasures), enemy-lock warning, obstacle-impact cooldown
  mission:null,school:false,shots:0,drillHits:0,briefM:null,surviveTime:0,hitMarkT:0,hitMarkKind:'',
  awaitLock:false,wingOrder:'form',capMode:false,capSpawned:false,capDown:false,capName:'',carrierMode:false,carrierLost:false,carrierLostT:0,launchT:0,launchSpd:0,fleet:false,fleetLine:null,fleetHp:0,fleetEscort:true,sysDown:0,carMoved:0,formT:0,sqLaunched:0,bridge:false,auto:null,
  interior:false,runLen:TRENCH_LEN,ventHits:0,escape:null,wingFlown:[],wingDowned:[],
  muted:(()=>{try{return localStorage.getItem('neonTrench.mute')==='1';}catch(e){return false;}})(),alarmT:0};
/* spring-loaded camera impulse: a punchy directional kick that overshoots and settles */
function addKick(x,y,z){S.kickV.x+=x;S.kickV.y+=y;S.kickV.z+=z;}
let BEST=loadBest();
function loadBest(){try{return JSON.parse(localStorage.getItem(LS_KEY))||{score:0,time:0};}catch(e){return {score:0,time:0};}}
function saveBest(){try{localStorage.setItem(LS_KEY,JSON.stringify(BEST));}catch(e){}}
const isTouch=('ontouchstart' in window)&&matchMedia('(pointer:coarse)').matches;
const $=id=>document.getElementById(id);

function setCam(c){
  S.cam=c;
  cockpit.visible=(c==='fp');
  canopy.visible=(c==='tp');
  for(const m of shipFpHide)m.visible=(c!=='fp');
  if(cabLight)cabLight.intensity=c==='fp'?cabLight.userData.on:0;
  $('cross').style.display=c==='fp'?'block':'none';
  $('cockHud').classList.toggle('on',c==='fp'); // physical instruments (ADI/prox/frame) are FP-only
  $('hud').classList.toggle('cam-fp',c==='fp');$('hud').classList.toggle('cam-tp',c==='tp'); // positions flight HUD
  $('tl').style.display='none'; // flight data now lives in the centre/ship-framing HUD cluster
  if(c==='fp'){$('aimT').style.display='none';camera.up.set(0,1,0);
    // clear the chase-view inline positions so the CSS centre-flank rules take over
    for(const el of [hudVel,hudSys]){el.style.left=el.style.top=el.style.right=el.style.bottom=el.style.transform='';}}
  hudCamV.textContent=c==='fp'?'COCKPIT':'CHASE';
  camV.textContent='Cam · '+(c==='fp'?'Cockpit':'Chase')+' [Alt]';
}
/* middle click: left click fires lasers, or (in missile mode) a missile at the target selected with R */
function setMslMode(on){
  S.mslMode=on;
  hudWpn.classList.toggle('msl',on);
  if(!on){S.lockTarget=null;S.lockT=0;}
}
/* cruise control (T): holds the set throttle speed in either model; engaging it keeps your current forward speed */
function setCruise(on){
  S.cruise=on;
  if(on){tmp.set(0,0,-1).applyQuaternion(ship.quaternion);
    S.throttle=Math.max(-.35,Math.min(1,S.vel.dot(tmp)/(MAX_SPD*curShip.spdMul)));}
  cruiseV.textContent='Cruise · '+(on?'On':'Off')+' [T]';
  cruiseV.style.color=on?'#ffb300':'';
}
function setModel(m){
  S.model=m;
  modeV.textContent=(m==='arcade'?'Arcade · Assist':'Realistic · Decoupled')+' [V]';
  modeV.style.color=m==='arcade'?'':'#ffb300';
}
