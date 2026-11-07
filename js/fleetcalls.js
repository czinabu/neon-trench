"use strict";
/* Fleet calls: in a fleet battle your captains ask you for an order when the fight gives them a reason, and you approve
   it with one key (H, rebindable as 'answer'), L3 on a pad, or a click or tap on the card. A call shows on a card under
   the order card (#callCard) and lapses after FLEET_CALLS.life seconds (js/config.js); an approved one is worth
   FLEET_CALLS.bonus points and counts in S.callsOk. One call at a time, FLEET_CALLS.gap seconds apart, and each kind once
   per ship per op (S.callDone). Calls start once the command bridge is open in the campaign (toolOn('bridge')), and only
   in the game that runs the battle (single player or the co-op host). Each kind asks only for a tool you have:
     fallback  a friendly capital under FLEET_CALLS.hurt of its hull asks to fall back (fleet movement)
     focus     an enemy capital's shield generator just went down: a captain asks for every gun on it (from fleetSystemDown)
     screen    HALCYON under FLEET_CALLS.carrier with no destroyer near her: a destroyer asks to screen her (formations)
     launch    a squadron waiting in HALCYON's bay while enemy fighters swarm: the deck asks to launch it (squadrons)
   Approving runs the same order the bridge would (js/fleet.js, js/wingmen.js), so the fleet answers you the same way. */

const callOn=()=>!!S.fleet&&S.mode==='play'&&S.launchT<=0&&!S.school&&toolOn('bridge')&&!(COOP.live&&netGuest());
const callKey=()=>keyLabel(keyBound(KEY_ACTIONS.find(a=>a.id==='answer')));

/* c: {key, who: the ship or station asking, task: the ask, info: why, act: () => true if the order went out,
   ack: what the feed says once approved, valid: () => false once the call no longer makes sense} */
function callPost(c){
  if(S.call||S.callDone[c.key]||S.time-S.callLast<FLEET_CALLS.gap||S.time<FLEET_CALLS.first)return false;
  S.callDone[c.key]=1;S.callLast=S.time;
  S.call=Object.assign({t:S.time,state:'live',end:0},c);
  ccFrom.textContent=c.who;ccTask.textContent=c.task;ccInfo.textContent=c.info||'';
  ccHint.textContent=isTouch?'Tap to approve':padSeen?'L3 or '+callKey()+' to approve':callKey()+' to approve';
  callCard.className='on';sfx('tick');padRumble(.15,60);
  fleetTip('calls',callKey());
  return true;
}
/* approve the call on the card: true if there was one to answer */
function callAnswer(){
  const c=S.call;if(!c||c.state!=='live')return false;
  const ok=!!c.act();
  c.state=ok?'done':'lapsed';c.end=S.time;
  if(ok){S.callsOk++;S.score+=FLEET_CALLS.bonus;ccTask.textContent='APPROVED';ccInfo.textContent='+'+FLEET_CALLS.bonus+' · '+c.ack;sfx('acquire');}
  else{ccTask.textContent='CAN\'T DO';ccInfo.textContent='the moment has passed';sfx('ui');}
  ccHint.textContent='';callCard.className='on '+(ok?'done':'lapsed');
  return true;
}
function callReset(){S.call=null;S.callLast=-1e9;S.callDone={};callCard.className='';}

/* an enemy shield just went down (fleetSystemDown, js/fleet.js): a captain asks for the fleet's guns on it */
function callShieldDown(C){
  if(!callOn()||C.gate||fleetMark()===C)return;
  const ships=fleetShips(),A=ships.find(o=>o.kind==='escort')||ships[0];if(!A)return;
  callPost({key:'focus:'+C.T.name,who:A.T.name,task:'ALL GUNS ON '+C.T.name+'?',info:'its shield is down: the broadsides bite now',
    act:()=>fleetFocusAll(C),ack:'every broadside on '+C.T.name,valid:()=>C.state==='fight'&&!C.dead&&fleetMark()!==C});
}

/* every frame from the capital stage (js/update/capital.js): post a call the fight has earned, and run the card */
function callsFrame(dt){
  const c=S.call;
  if(c){
    if(c.state==='live'){
      if(c.valid&&!c.valid()){S.call=null;callCard.className='';}   // the reason went away: drop it quietly
      else if(S.time-c.t>FLEET_CALLS.life){c.state='lapsed';c.end=S.time;ccTask.textContent='NO REPLY';ccHint.textContent='';callCard.className='on lapsed';}
    }else if(S.time-c.end>2.6){S.call=null;callCard.className='';}
    return;
  }
  if(!callOn()||S.time<FLEET_CALLS.first||S.time-S.callLast<FLEET_CALLS.gap)return;
  const ships=fleetShips(),K=carrierShip();
  // a ship in trouble asks to pull back
  if(toolOn('move'))for(const C of ships){
    if(C.retreat||C.hp>=C.T.hp*FLEET_CALLS.hurt)continue;
    if(callPost({key:'fallback:'+C.T.name,who:C.T.name,task:'REQUEST FALL BACK',info:'hull '+Math.ceil(C.hp/C.T.hp*100)+'% and still under fire',
      act:()=>fleetFallBack(C),ack:C.T.name+' pulling back out of range',valid:()=>fleetMovable(C)&&!C.retreat}))return;
  }
  // HALCYON hurt and nobody covering her: a destroyer offers to screen
  if(toolOn('form')&&K&&fleetMovable(K)&&K.hp<K.T.hp*FLEET_CALLS.carrier){
    const dds=ships.filter(C=>C.kind==='escort');
    const covered=dds.some(C=>C.form==='screen'||C.role==='screen'&&!C.held||C.g.position.distanceTo(K.g.position)<FLEET_CALLS.near);
    const E=!covered&&dds.sort((a,b)=>a.g.position.distanceTo(K.g.position)-b.g.position.distanceTo(K.g.position))[0];
    if(E&&callPost({key:'screen:'+E.T.name,who:E.T.name,task:'REQUEST TO SCREEN HALCYON',info:'HALCYON at '+Math.ceil(K.hp/K.T.hp*100)+'% with nobody covering her',
      act:()=>fleetFormation('screen',E),ack:E.T.name+' moving in front of HALCYON',valid:()=>fleetMovable(E)&&E.form!=='screen'}))return;
  }
  // enemy fighters swarming while a squadron sits in the bay
  if(toolOn('squads')&&K&&K.state==='fight'&&K.squads>0&&fighters.filter(f=>!f.dead).length>=FLEET_CALLS.swarm){
    const q=[1,2].find(q=>!sqAlive(q).length&&!squadrons[q].up);
    if(q&&callPost({key:'launch:'+q,who:K.T.name+' DECK',task:'LAUNCH '+SQUAD_DEFS[q].name+'?',info:SQUAD_DEFS[q].name+' is fuelled and waiting in the bay',
      act:()=>launchSquadron(q),ack:SQUAD_DEFS[q].name+' launching',valid:()=>K.state==='fight'&&K.squads>0&&!sqAlive(q).length}))return;
  }
}
/* a click or tap on the card approves it (on the bridge, or on touch; in the cockpit the mouse is captured for flying) */
callCard.addEventListener('mousedown',e=>e.stopPropagation());
callCard.addEventListener('click',e=>{e.stopPropagation();callAnswer();});
callCard.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();callAnswer();},{passive:false});
