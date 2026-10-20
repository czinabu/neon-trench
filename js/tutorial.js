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
let TUT=null;   // {i, t, ok, steer, thr, fire, boost, roll, msl, msl0}
const tutActive=()=>!!TUT;
function tutStart(){
  TUT=null;tut.classList.remove('on');
  if(PROG.tutDone||!S.mission||S.mission.id!=='m1')return;
  TUT={i:0,t:0,ok:0,steer:0,thr:0,fire:0,boost:0,roll:0,msl:false,msl0:S.missiles};
  tutShow();
}
function tutShow(){
  tutStep.textContent='Training '+(TUT.i+1)+' / '+TUT_STEPS.length;
  tutText.textContent=TUT_STEPS[TUT.i].text;
  tut.classList.remove('ok');tut.classList.add('on');
}
function tutFinish(){TUT=null;tut.classList.remove('on');PROG.tutDone=true;saveProg();}
function tutSkip(){if(TUT)tutFinish();}
function tutUpdate(dt){
  if(!TUT)return;
  const T=TUT,st=TUT_STEPS[T.i];
  T.t+=dt;
  // accumulate what the pilot has actually done
  T.steer+=Math.min(1,Math.hypot(S.cursor.x,S.cursor.y))*dt;   // the cursor drifts back to centre, so count how far it's held off
  T.thr+=(S.keys.KeyW||S.keys.KeyS)?dt:0;
  T.fire+=S.fireHeld?dt:0;
  T.boost+=S.boost?dt:0;
  T.roll+=(S.keys.KeyQ||S.keys.KeyE)?dt:0;
  if(S.missiles<T.msl0||msls.length)T.msl=true;
  if(T.ok>0){   // brief green tick before moving on
    T.ok-=dt;
    if(T.ok<=0){T.i++;T.t=0;if(T.i>=TUT_STEPS.length){tutFinish();return;}tutShow();}
    return;
  }
  if(st.done(T)||(st.timeout&&T.t>st.timeout)){T.ok=.7;tut.classList.add('ok');}
}
