"use strict";
/* First-flight training: on a pilot's first Reactor Run, a prompt walks through the basic controls
   one at a time. Each step clears when the pilot does the thing it asks; Enter skips the lot.
   Finishing or skipping sets PROG.tutDone so it never shows again. */

const TUT_STEPS=[
  {text:'Move the mouse to steer',               done:T=>T.steer>.5},
  {text:'W / S to raise and lower the throttle', done:T=>T.thr>.4},
  {text:'Hold left click to fire your lasers',   done:T=>T.fire>.6},
  {text:'Shift to boost. It recharges on its own',done:T=>T.boost>.4},
  {text:'Q / E to roll. Match a roll gate\'s slot for Overdrive', done:T=>T.roll>.5},
  {text:'Middle click for missiles, R to target an enemy, hold it in your sights, then left click', done:T=>T.msl, timeout:25},
  {text:'At the reactor, lock on and press F to fire the torpedo. Good hunting.', done:()=>false, timeout:6},
];
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
  {text:'V switches arcade (assisted) and realistic (inertia) flight', done:T=>T.model},
  {text:'Hold left click to fire your lasers',   done:T=>T.fire>.6},
  {text:'Middle click switches to missile mode. R targets, left click fires', done:T=>T.mmode},
  {text:'G drops flares. They pull enemy missiles off you', done:T=>T.flare},
  {text:'Controls tour complete. Back to the lessons.', done:()=>false, timeout:3},
];
let TUT=null;   // {i, t, ok, steps, steer, thr, fire, boost, roll, cam, model, flare, msl, msl0}
const tutActive=()=>!!TUT||!!SCH;
function tutStart(){
  TUT=null;tut.classList.remove('on');schoolReset();
  document.getElementById('tutSkip').textContent='Enter to skip training';
  if(S.school&&schoolLesson().kind!=='tour'){schoolBegin(schoolLesson());return;}
  if(!S.school&&(PROG.tutDone||!S.mission||S.mission.id!=='m1'))return;
  TUT={steps:S.school?TOUR_STEPS:TUT_STEPS,cam0:S.cam,model0:S.model,cam:false,model:false,flare:false,mmode:false,strafeX:0,strafeY:0,i:0,t:0,ok:0,steer:0,thr:0,fire:0,boost:0,roll:0,msl:false,msl0:S.missiles};
  tutShow();
}
function tutShow(){
  const st=TUT.steps[TUT.i];
  tutStep.textContent=S.school?'Controls tour':'Training';
  tutStat.textContent=TUT.steps.map((_,i)=>i<TUT.i?'●':i===TUT.i?'◉':'○').join(' ')+'\n'+(TUT.i+1)+' / '+TUT.steps.length;
  tutText.textContent=st.text;
  TUT.msl0=S.missiles;TUT.msl=false;
  tut.classList.remove('ok');tut.classList.add('on');
}
function tutFinish(){
  TUT=null;tut.classList.remove('on');
  if(S.school){schoolDone('tour','✓',0);schoolExit();return;}
  PROG.tutDone=true;saveProg();
}
function tutSkip(){if(TUT)tutFinish();else if(SCH)schoolExit();}
function tutUpdate(dt){
  if(!TUT)return;
  const T=TUT,st=T.steps[T.i];
  T.t+=dt;
  // accumulate what the pilot has actually done
  T.steer+=Math.min(1,Math.hypot(S.cursor.x,S.cursor.y))*dt;   // the cursor drifts back to centre, so count how far it's held off
  T.thr+=(S.keys.KeyW||S.keys.KeyS)?dt:0;
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
