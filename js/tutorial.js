"use strict";
/* First-flight training: on a pilot's first campaign op (Reactor Run, unless Settings > Replay intro reset it later),
   a prompt walks through the basic controls one at a time. Each step clears when the pilot does the thing it asks;
   Enter (or a tap on the prompt on a touch screen) skips the lot. Finishing or skipping sets PROG.tutDone so it never
   shows again. Each step has keyboard wording (text), gamepad wording (pad) and touch wording (touch; null leaves the
   step out on a touch screen); `trench` steps only show in a trench run. */

const tutTrench=()=>S.sector==='trench';
const TUT_STEPS=[
  {text:'Move the mouse to steer', pad:'Right stick to steer', touch:'Drag on the left of the screen to steer', done:T=>T.steer>.5},
  {text:'W / S to raise and lower the throttle', pad:'Left stick up and down for the throttle', touch:'Slide the THR strip to set your speed', done:T=>T.thr>.4},
  {text:'Hold left click to fire your lasers', pad:'Hold RT to fire your lasers', touch:'Hold Fire for your lasers', done:T=>T.fire>.6},
  {text:'Shift to boost. It recharges on its own', pad:'A to boost. It recharges on its own', touch:'Hold Boost for speed. It recharges on its own', done:T=>T.boost>.4},
  {text:()=>'Q / E to roll'+(tutTrench()?'. Match a roll gate\'s slot for Overdrive':''), pad:()=>'D-pad left and right to roll'+(tutTrench()?'. Match a roll gate\'s slot for Overdrive':''), touch:()=>'Hold ⟲ or ⟳ above Brake to roll'+(tutTrench()?'. Match a roll gate\'s slot for Overdrive':''), done:T=>T.roll>.5},
  {text:'Middle click for missiles, R to target an enemy, hold it in your sights, then left click', pad:'Y for missiles, LB to target an enemy, hold it in your sights, then RT', touch:'Msl for missiles, Tgt to pick an enemy, hold it in your sights, then Fire', done:T=>T.msl, timeout:25},
  {text:'At the reactor, lock on and press F to fire the torpedo. Good hunting.', pad:'At the reactor, lock on and press RB to fire the torpedo. Good hunting.', touch:'At the reactor, lock on and tap Torp to fire the torpedo. Good hunting.', trench:true, done:()=>false, timeout:6},
  {text:'Good hunting.', trench:false, done:()=>false, timeout:3},
];
/* the step's wording for whatever the pilot is holding */
const tutWords=st=>{const v=isTouch&&st.touch!==undefined?st.touch:padActive()&&st.pad?st.pad:st.text;return typeof v==='function'?v():v;};
const tutSkipLine=()=>isTouch?'Tap here to skip training':padActive()?'Each step clears as you do it':'Enter to skip training';
/* Flight school's controls tour (the first lesson on the school screen): the same step machinery, repeatable,
   and it leaves PROG.tutDone alone. The graded drills live in js/school.js. */
const TOUR_STEPS=[
  {text:'Move the mouse to steer',               done:T=>T.steer>.5},
  {text:'W / S to raise and lower the throttle', done:T=>T.thr>.4},
  {text:'Shift to boost. It recharges on its own',done:T=>T.boost>.4},
  {text:'Q / E to roll',                         done:T=>T.roll>.5},
  {text:'A / D strafe left and right without turning', done:T=>T.strafeX>.4},
  {text:'Space / C strafe up and down', done:T=>T.strafeY>.4},
  {text:'Alt switches between cockpit and chase camera', done:T=>T.cam},
  {text:'V switches arcade (assisted) and realistic (decoupled drift) flight. T toggles cruise control', done:T=>T.model},
  {text:'Hold left click to fire your lasers',   done:T=>T.fire>.6},
  {text:'Middle click switches to missile mode. R targets, left click fires', done:T=>T.mmode},
  {text:'G drops flares. They pull enemy missiles off you', done:T=>T.flare},
  {text:'Controls tour complete.', done:()=>false, timeout:3},
];
let TUT=null;   // {i, t, ok, steps, steer, thr, fire, boost, roll, cam, model, flare, msl, msl0}
const tutActive=()=>!!TUT||!!SCH;
function tutStart(){
  TUT=null;tut.classList.remove('on');schoolReset();
  document.getElementById('tutSkip').textContent=tutSkipLine();
  if(S.school&&schoolLesson().kind!=='tour'){schoolBegin(schoolLesson());return;}
  if(!S.school&&(PROG.tutDone||!S.mission||S.mission.contract||!MISSIONS.some(m=>m.id===S.mission.id)))return;   // the first campaign op flown
  const steps=S.school?TOUR_STEPS:TUT_STEPS.filter(st=>!(isTouch&&st.touch===null)&&(st.trench===undefined||st.trench===tutTrench()));
  TUT={steps,cam0:S.cam,model0:S.model,cam:false,model:false,flare:false,mmode:false,strafeX:0,strafeY:0,i:0,t:0,ok:0,steer:0,thr:0,fire:0,boost:0,roll:0,msl:false,msl0:S.missiles};
  tutShow();
}
function tutShow(){
  const st=TUT.steps[TUT.i];
  tutStep.textContent=S.school?'Controls tour':'Training';
  tutStat.textContent=TUT.steps.map((_,i)=>i<TUT.i?'●':i===TUT.i?'◉':'○').join(' ')+'\n'+(TUT.i+1)+' / '+TUT.steps.length;
  const w=tutWords(st);tutText.textContent=w;cueFlash(w);
  TUT.msl0=S.missiles;TUT.msl=false;
  tut.classList.remove('ok');tut.classList.add('on');
}
function tutFinish(){
  TUT=null;tut.classList.remove('on');
  if(S.school){schoolDone('tour','✓',0);schoolExit();return;}
  PROG.tutDone=true;saveProg();
}
function tutSkip(){if(TUT)tutFinish();else if(SCH)schoolExit();}
tut.addEventListener('click',()=>{if(isTouch&&tutActive())tutSkip();});   // on a touch screen the prompt itself is the skip button
function tutUpdate(dt){
  if(!TUT)return;
  const T=TUT,st=T.steps[T.i];
  T.t+=dt;
  // accumulate what the pilot has actually done
  T.steer+=Math.min(1,Math.hypot(S.cursor.x,S.cursor.y))*dt;   // the cursor drifts back to centre, so count how far it's held off
  T.thr+=(S.keys.KeyW||S.keys.KeyS||touchThr!==null)?dt:0;   // touchThr: a thumb on the touch throttle strip (js/input.js)
  T.fire+=S.fireHeld?dt:0;
  T.boost+=S.boost?dt:0;
  T.roll+=(S.keys.KeyQ||S.keys.KeyE)?dt:0;
  T.strafeX+=(S.keys.KeyA||S.keys.KeyD)?dt:0;
  T.strafeY+=(S.keys.Space||S.keys.KeyC)?dt:0;
  if(S.cam!==T.cam0)T.cam=true;
  if(S.model!==T.model0)T.model=true;
  if(S.keys.KeyG)T.flare=true;
  if(S.mslMode)T.mmode=true;
  if(S.missiles<T.msl0||msls.length)T.msl=true;
  if(T.ok>0){   // brief green tick before moving on
    T.ok-=dt;
    if(T.ok<=0){T.i++;T.t=0;if(T.i>=T.steps.length){tutFinish();return;}tutShow();}
    return;
  }
  if(st.done(T)||(st.timeout&&T.t>st.timeout)){T.ok=.7;tut.classList.add('ok');}
}
