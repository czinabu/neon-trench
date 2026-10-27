"use strict";
/* Autopilot: the command bridge can give your own ship an order (bdgOrder in js/bridge.js) and it flies it
   with the wingman AI's target picking (wingTargetFor in js/update/wingmen.js) until you take the stick.
   S.auto is the order id ('form' holds on HALCYON; the rest are the WING_ORDERS ids plus 'focus'), or null.
   updateFlight runs autopilotSteer first: it writes the cursor, throttle and trigger the way your inputs
   would, so the normal flight model, bounds and guns do the rest. Any flight input calls autoOff. */

const SELF_ORDERS={form:'HOLD ON HALCYON',target:'ATTACK MY TARGET',free:'FREE ENGAGE',cover:'COVER THE WING',defend:'DEFEND HALCYON',strike:'STRIKE CAPITAL'};
/* the same fields a wingman has, so wingTargetFor can pick the target; `mesh` is your ship */
const selfPilot={get mesh(){return ship;},order:null,focus:null,guard:null,tgt:null,tgtT:0,slot:0};
let autoCruise=false;   // cruise control as it was before the autopilot took the throttle
const spDes=new THREE.Vector3(), spLoc=new THREE.Vector3(), spQ=new THREE.Quaternion();

const selfOrderName=()=>S.auto==='focus'?'ATTACK '+wingFocusName(selfPilot.focus)
  :S.auto==='defend'&&selfPilot.guard?'DEFEND '+selfPilot.guard.T.name:SELF_ORDERS[S.auto]||'';
/* give your ship an order: an order id, 'focus' on a hostile (ref), 'defend' a friendly capital (ref), or null for manual */
function setSelfOrder(o,ref){
  if(o&&!toolOn('auto'))return false;
  if(!o){autoOff();return true;}
  if(S.mode!=='play'||S.sector!=='arena'||S.school||S.launchT>0)return false;
  if(o!=='focus'&&!SELF_ORDERS[o])return false;
  if(o==='target'&&!(S.target&&!S.target.dead)){announce('NO TARGET','Target a hostile with R first','');return false;}
  if(o!=='focus'&&!(o==='defend'&&ref)&&!wingOrderOk(o))return false;
  if(!S.auto){autoCruise=S.cruise;S.cruise=true;setMslMode(false);}
  S.auto=o;selfPilot.order=o;selfPilot.focus=o==='focus'?ref:null;selfPilot.guard=o==='defend'?ref||null:null;selfPilot.tgt=null;selfPilot.tgtT=0;
  return true;
}
/* back to manual: flight input, the bridge's button, or the order running out */
function autoOff(why){
  if(!S.auto)return;
  S.auto=null;selfPilot.order=selfPilot.focus=selfPilot.guard=selfPilot.tgt=null;
  S.cursor.x=S.cursor.y=0;S.fireHeld=false;setCruise(autoCruise);
  if(why)announce('MANUAL CONTROL',why,'');
  autoHud.style.display='none';
}
const AUTO_KEYS=/^(KeyW|KeyS|KeyA|KeyD|KeyQ|KeyE|KeyX|KeyC|KeyT|Space|ShiftLeft|ShiftRight)$/;
const autoTakeover=()=>{if(S.auto)autoOff('You have the stick');};

/* the hostile to engage: the wing AI's pick, except cover, which works around the wing instead of you */
function autoTarget(dt){
  if(S.auto==='form')return null;
  if(S.auto==='cover'){
    selfPilot.tgtT-=dt;
    if(selfPilot.tgt&&!selfPilot.tgt.dead&&fighters.includes(selfPilot.tgt)&&selfPilot.tgtT>0)return selfPilot.tgt;
    const w=wingmen.find(o=>!o.dead&&o.launch<=0);
    selfPilot.tgt=nearestFoe(fighters,w?w.mesh.position:ship.position,1100);selfPilot.tgtT=3;
    return selfPilot.tgt;
  }
  return wingTargetFor(selfPilot,S.auto,dt);
}
function autopilotSteer(fr){
  const {dt,p}=fr;
  if(!fr.arena||S.school){autoOff();return;}
  if(S.auto==='defend'&&!wingDefendAnchor(selfPilot)){autoOff('Nothing left to guard');return;}
  if(S.auto==='focus'&&!wingFocusLive(selfPilot.focus)){autoOff('Mark lost');return;}
  S.autoT+=dt;
  const tgt=autoTarget(dt);
  if(S.auto==='focus'&&!selfPilot.order){autoOff('Mark lost');return;}   // wingTargetFor dropped it
  let thr=0,fire=false;
  if(tgt){
    spLoc.copy(tgt.mesh.position).sub(p);const dist=spLoc.length()||1;
    spDes.copy(tgt.mesh.position).addScaledVector(tgt.wvel,Math.min(1,dist/700));
    if(tgt.cap&&tgt.up)spDes.addScaledVector(wgUp.set(0,tgt.up,0).applyQuaternion(tgt.ship.g.quaternion),Math.min(45,dist*.22));   // aim over the hull face the part sits on
    if((selfPilot.viaT=(selfPilot.viaT||0)-dt)<=0){selfPilot.viaT=.4;selfPilot.via=dist>80?wingDetour(p,spDes):null;}   // go round the hull, not through it
    if(selfPilot.via&&dist>80)spDes.copy(selfPilot.via);
    spDes.sub(p).normalize();
    fwd.set(0,0,-1).applyQuaternion(ship.quaternion);
    fire=fwd.dot(spLoc.multiplyScalar(1/dist))>(tgt.cap?.985:.97)&&dist<420;   // the gun assist (js/update/weapons.js) puts the bolts on the mark
    thr=tgt.cap?(dist>300?.7:.45):dist>300?1:Math.min(1,tgt.T.speed*1.05/(MAX_SPD*curShip.spdMul));   // a gun on a hull: pass at speed, don't hover
    if(selfPilot.hullT>0){selfPilot.hullT-=dt;spDes.addScaledVector(selfPilot.hullN,1.6*Math.min(1,selfPilot.hullT/.4)).normalize();}   // just scraped a hull: peel away first
    if(tgt.cap){   // a gun on a hull: a firing pass ends in a clean break (straight on and away from it), as the wingmen fly it
      if(selfPilot.breakT>0){selfPilot.breakT-=dt;spDes.copy(fwd).addScaledVector(spLoc,-.9).normalize();}
      else if(dist<90&&fwd.dot(spLoc)>.2)selfPilot.breakT=.7;
    }else if(dist<50)spDes.addScaledVector(tmp.crossVectors(fwd,AP_UP),1.2).normalize();   // overshoot: peel off
  }else{
    // hold off HALCYON's flank, or where you are if she is gone
    const K=carrierShip();
    if(K)spLoc.set(0,90,-60).applyQuaternion(K.g.quaternion).add(K.g.position).sub(p);else spLoc.set(0,0,0);
    const dist=spLoc.length();
    if(dist>60){spDes.copy(spLoc).multiplyScalar(1/dist);thr=Math.min(.8,dist/500);}
    else{spDes.set(0,0,-1).applyQuaternion(K?K.g.quaternion:ship.quaternion);thr=0;S.vel.multiplyScalar(Math.exp(-1.5*dt));}
  }
  // steer: the heading error in the ship's own frame drives the cursor, as a mouse would
  spQ.copy(ship.quaternion).invert();spLoc.copy(spDes).applyQuaternion(spQ);
  const yaw=Math.atan2(spLoc.x,-spLoc.z),pit=Math.atan2(spLoc.y,Math.hypot(spLoc.x,spLoc.z));
  S.cursor.x=Math.max(-1,Math.min(1,yaw*2.2));S.cursor.y=Math.max(-1,Math.min(1,-pit*2.2));
  S.throttle+=(thr-S.throttle)*Math.min(1,2*dt);
  S.fireHeld=fire;
  if(arenaPushOut(p,8)){const into=S.vel.dot(_pn);if(into<0)S.vel.addScaledVector(_pn,-into);selfPilot.hullN=selfPilot.hullN||new THREE.Vector3();selfPilot.hullN.copy(_pn);selfPilot.hullT=.8;}   // scraping a hull: lose the speed into it
  const h='AUTOPILOT // '+selfOrderName()+'<br><span>any flight input takes the stick</span>';
  if(autoHud._h!==h){autoHud.innerHTML=h;autoHud._h=h;}
  autoHud.style.display='block';
}
