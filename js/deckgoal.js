"use strict";
/* The objective tracker on the walkable deck (js/deck.js): top right, across from where you are. One line for what to do next
   (the next op, a sector map pick, or boarding once briefed) with a waypoint marker that leads you there through the
   doors, and up to two optional things below it (upgrades to buy, repairs, someone with something new to say, a side bet).
   It only suggests: nothing is locked behind it. Settings > Display turns it off (SETTINGS.dkGoals). */

/* every room joins the spine through one door: where that door is */
const DK_GOAL_DOOR={bridge:[0,DK_SPINE.z0],hangar:[0,DK_SPINE.z1],quarters:[-DK_SPINE.x,DK_QZ],sim:[DK_SPINE.x,-38],ready:[DK_SPINE.x,14],eng:[-DK_SPINE.x,DK_ENG.door]};
const DK_GOAL_SPOT={brief:[17.2,14,'ready'],pad:[0,66,'hangar'],board:[-14.2,-88,'bridge'],shop:[-17.4,54,'hangar'],fleet:[-14.2,-78,'bridge'],repair:[DK_ENG_DC[0],DK_ENG_DC[1],'eng']};
const dkGoalV=new THREE.Vector3();
const DK_GOAL_ROOM={spine:'Spine',bridge:'Bridge',hangar:'Hangar',sim:'Sim deck',quarters:'Quarters',ready:'Ready room',eng:'Engineering'};
let dkGoalKey='',dkGoalT=0,dkGoalTo=null;

/* the main goal and its waypoint, from the campaign state */
function dkGoalMain(){
  const nm=nextMission(),L=sectorChoice(),inHangar=DK.room==='hangar';
  const C=dkCoopGoal();if(C)return C;   // in a co-op room (js/deckcoop.js)
  if(DK.armed)return {tag:'Ready to launch',t:'Board your '+curShip.name,s:'Pad one, hangar bay · '+DK.armed.name,at:'pad'};
  if(L)return {tag:'Before the next op',t:'Pick a target for '+L.name,s:'Sector map · '+(inHangar?'at your ship':'Ready room briefing table'),at:inHangar?'pad':'brief'};
  if(nm)return {tag:'Next op',t:nm.name,s:inHangar?'Launch from pad one, or get briefed in the Ready room':'Get briefed in the Ready room',at:inHangar?'pad':'brief'};
  if(campaignDone())return {tag:'All ops clear',t:'Contracts and free play',s:'Contracts board in the Ready room',at:'brief'};
  return {tag:'All ops clear',t:'Replay any op',s:'Sortie board on the bridge',at:'board'};
}
/* optional things worth a look, most useful first (at most two) */
function dkGoalSide(){
  const out=[],buy=ccShipBuyable(),hurt=dockHurt().length,where=r=>DK_GOAL_ROOM[r]||'';
  if(hurt)out.push(hurt+' ship'+(hurt===1?'':'s')+' to repair · Engineering');
  if(buy)out.push(buy+' upgrade'+(buy===1?'':'s')+' you can buy · Hangar');
  for(const c of DK.crew){if(out.length>=3)break;
    if(!c.C||(c.C.when&&!c.C.when()))continue;
    if(dkBeat(c.C.id)){out.push(c.who.name+' has news · '+where(c.C.room));break;}}
  if(!PROG.bet){const c=DK.crew.find(x=>x.C&&(!x.C.when||x.C.when())&&dkBetFor(x));if(c)out.push('Side bet on offer · '+c.who.name+' · '+where(c.C.room));}
  return out.slice(0,2);
}
/* where to walk now: the target itself if you are in its room, else the door out of this room, else the door into its room */
function dkGoalLeg(tx,tz,room){
  const here=DK.room||'spine';
  if(here===room)return [[tx,tz]];
  const legs=[];
  if(here!=='spine'&&DK_GOAL_DOOR[here])legs.push(DK_GOAL_DOOR[here]);
  if(DK_GOAL_DOOR[room])legs.push(DK_GOAL_DOOR[room]);
  legs.push([tx,tz]);return legs;
}
/* once a frame from dkTick, after the camera has moved */
function dkGoalTick(dt){
  const on=SETTINGS.dkGoals&&!dkBusy();
  dkGoal.classList.toggle('on',on);
  if(!on){dkWay.classList.remove('on');return;}
  dkGoalT-=dt;
  if(dkGoalT<=0){dkGoalT=.3;   // the text changes rarely: rebuild it a few times a second, and only touch the page when it differs
    const G=dkGoalMain(),side=dkGoalSide(),key=G.tag+'|'+G.t+'|'+G.s+'|'+side.join('|');
    dkGoalTo=G.at;
    if(key!==dkGoalKey){dkGoalKey=key;
      dkGoalTag.textContent=G.tag;dkGoalName.textContent=G.t;dkGoalSub.textContent=G.s;
      dkGoalList.innerHTML=side.map(t=>'<li>'+t+'</li>').join('');}
  }
  const sp=DK_GOAL_SPOT[dkGoalTo];
  if(!sp){dkWay.classList.remove('on');return;}
  const legs=dkGoalLeg(sp[0],sp[1],sp[2]);
  let d=0,px=DK.x,pz=DK.z;for(const [x,z] of legs){d+=Math.hypot(x-px,z-pz);px=x;pz=z;}
  const [wx,wz]=legs[0],near=legs.length===1&&d<DECK.reach+1.5;   // close enough that the Use prompt takes over
  if(near){dkWay.classList.remove('on');return;}
  // project the next leg onto the screen; behind you, or off the edge, it pins to the edge pointing the way
  const cam=DK.cam;dkGoalV.set(wx,legs.length===1?2:2.9,wz).project(cam);
  let x=dkGoalV.x,y=dkGoalV.y;const behind=dkGoalV.z>1;
  if(behind){x=-x;y=-y;}
  const m=Math.max(Math.abs(x)/.9,y>0?y/.72:-y/.74),edge=behind||m>1;   // the bottom stops short of the key hints
  if(edge){const k=1/Math.max(m,1e-3);x*=k;y*=k;}
  dkWay.style.transform='translate('+((x+1)/2*innerWidth)+'px,'+((1-y)/2*innerHeight)+'px)';
  dkWay.classList.toggle('edge',edge);
  dkWayD.textContent=Math.round(d)+' m';
  dkWay.classList.add('on');
}
/* the Settings row (Display) */
setDkGoals.checked=SETTINGS.dkGoals;
setDkGoals.onchange=()=>{SETTINGS.dkGoals=setDkGoals.checked;saveSettings();};
dkPadFs.onclick=toggleFullscreen;
