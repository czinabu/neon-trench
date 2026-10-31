"use strict";
/* New-pilot onboarding. The first time a fresh pilot reaches the hub: the prologue cutscene ('arrival' in
   js/data/cutscenes.js), then the welcome card and the flight school offer (js/command.js), then this guided tour.
   The tour is a small coach panel that walks the hub one step at a time, each step clearing when the pilot does it:
     walkable deck   look around, walk, talk to someone or use a station, open the datapad, open the next op
     command center  pick a station, open the next op (the hub on touch screens, or when Settings picks Menu)
     briefing        what the briefing shows, and Launch
   Launching the first campaign op ends the tour, and the in-flight training (js/tutorial.js) takes over in the cockpit.
   PROG.onboard: 0 never started (and old saves), 'tour' running, 'done' finished or skipped.
   Settings > Replay intro (onboardReplay) puts everything back so it all plays again. */

const kp=(k,p)=>'<span class="kbhint">'+k+'</span><span class="padhint">'+p+'</span>';   // keyboard and pad wording, swapped by body.padmode
const COACH_STEPS={
  deck:[
    {id:'look',head:'Look around',text:()=>kp('Click the view, then move the mouse to look around.','Right stick to look around.')},
    {id:'walk',head:'Walk the deck',text:()=>kp('<b>WASD</b> to walk, hold <b>Shift</b> to run.','Left stick to walk, hold <b>B</b> to run.')},
    {id:'use',head:'Crew and stations',text:()=>kp('Walk up to anyone on the bridge, or a glowing station, and press <b>E</b>.','Walk up to anyone on the bridge, or a glowing station, and press <b>A</b>.')},
    {id:'pad',head:'Your datapad',text:()=>kp('Press <b>Tab</b> for the datapad: hangar, fleet, settings and fast travel between rooms.','Press <b>Y</b> for the datapad: hangar, fleet, settings and fast travel between rooms.')},
    {id:'next',head:'Your first op',text:()=>'The <b>Next op</b> card at the top of the datapad opens its briefing. The holo table on the bridge does too.'},
  ],
  command:[
    {id:'station',head:'HALCYON\'s stations',text:()=>(isTouch?'Tap':'Click')+' a station to see what it does: sortie board, hangar, fleet, campaign log.'},
    {id:'next',head:'Your first op',text:()=>(isTouch?'Tap':'Click')+' <b>Brief and launch</b> to open your first op.'},
  ],
  briefing:[
    {id:'brief',head:'The briefing',text:()=>'Your objective, bonus pay and loadout. <b>Hangar</b> changes your ship. Hit <b>Launch</b> when ready: flight training starts in the cockpit.'},
  ],
};
let CO=null;   // the running tour: {done:{}, ok, step, yaw, x, z, look, walk}
function coachMark(id){if(CO)CO.done[id]=true;}
function coachEnd(){CO=null;PROG.onboard='done';saveProg();coach.classList.add('hidden');}
coachSkip.onclick=coachEnd;
/* which part of the hub is up, if the tour can show over it */
function coachCtx(){
  if(CUT||S.mode!=='menu')return null;
  const up=id=>!$(id).classList.contains('hidden');
  if(up('briefing'))return 'briefing';
  if(up('deck')&&DK&&!dkOverlayUp()&&!DK.ward&&!DK.fadeT)return 'deck';
  if(up('command')&&[ccIntro,ccAcademy,ccPromo].every(o=>o.classList.contains('hidden')))return 'command';
  return null;
}
function coachTick(dt){
  if(PROG.onboard!=='tour'){if(CO)CO=null;coach.classList.add('hidden');return;}
  if(!CO)CO={done:{},ok:0,step:null,yaw:null,look:0,walk:0};
  // the first campaign launch ends the tour (flight school and the free modes do not)
  if(S.mode==='play'&&S.mission&&!S.school&&MISSIONS.some(m=>m.id===S.mission.id)&&!S.mission.contract){coachEnd();return;}
  const ctx=coachCtx();
  coach.classList.toggle('hidden',!ctx);
  coach.classList.toggle('right',ctx==='briefing');   // the briefing's left column runs to the bottom; its right one is clear
  coach.classList.toggle('mid',ctx==='command');
  if(!ctx)return;
  // what the pilot has done: looked, walked, opened the datapad
  if(ctx==='deck'){
    if(CO.yaw===null){CO.yaw=DK.yaw;CO.x=DK.x;CO.z=DK.z;}
    CO.look+=Math.abs(DK.yaw-CO.yaw);CO.yaw=DK.yaw;
    const d=Math.hypot(DK.x-CO.x,DK.z-CO.z);if(d<1)CO.walk+=d;   // a fast travel jump does not count
    CO.x=DK.x;CO.z=DK.z;
    if(CO.look>1.2)coachMark('look');
    if(CO.walk>4)coachMark('walk');
    if(DK.pad)coachMark('pad');
  }
  const steps=COACH_STEPS[ctx];
  if(CO.ok>0){CO.ok-=dt;if(CO.ok>0)return;coach.classList.remove('ok');CO.step=null;}
  const st=steps.find(s=>!CO.done[s.id]);   // each list ends on a step only the launch clears, so there is always one
  if(CO.step&&CO.step!==st&&CO.ctx===ctx&&CO.done[CO.step.id]){CO.ok=.7;coach.classList.add('ok');return;}   // a brief green tick before the next step
  if(CO.step!==st||CO.ctx!==ctx){
    CO.step=st;CO.ctx=ctx;
    const i=steps.indexOf(st);
    coachHead.textContent=st.head;coachText.innerHTML=st.text();
    coachStat.textContent=steps.length>1?steps.map((_,j)=>j<i?'●':j===i?'◉':'○').join(' '):'';
    coach.classList.remove('swap');void coach.offsetWidth;coach.classList.add('swap');
  }
}
/* Settings > Replay intro: the prologue, welcome card, flight school offer, tour and first-flight training all play again */
function onboardReplay(){
  PROG.introSeen=false;PROG.academy=false;PROG.tutDone=false;PROG.onboard=0;delete PROG.cuts.arrival;saveProg();
  CO=null;closeSettings();
  if(settingsFrom==='deck'||settingsFrom==='command')openHub();
  else{S.mode='menu';showScreen('menu');}
}
setReplayIntro.onclick=onboardReplay;
