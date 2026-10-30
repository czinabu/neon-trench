"use strict";
/* Gamepad (standard layout: Xbox, PlayStation, most USB pads). padPoll() runs once a frame from js/loop.js and
   feeds the same state the keyboard and mouse do (S.keys, S.cursor, S.fireHeld), so every system sees one input.
   Keys the pad has pressed are remembered, so a pad never clears a key the keyboard is holding.
     right stick  steer          left stick  throttle (up/down) and strafe (left/right)
     RT           lasers         LT          zoom
     A            boost          B           brake (X)         X  flares (G)       Y  lasers / missiles
     RB           torpedo (F)    LB          target hostile (R)
     d-pad        left/right roll (Q, E), up cruise (T), down flight model (V)
     R3           cockpit / chase view        Back  command bridge (B)      Start  pause / resume
   Any button also takes back a run that is waiting for the mouse (a pad has no pointer to capture). */
const PAD={dead:.16,curve:1.6,stickOn:.4};
const PAD_B={A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,Back:8,Start:9,L3:10,R3:11,Up:12,Down:13,Left:14,Right:15};
const padHeld={};      // key codes the pad is holding down
let padPrev=[];        // button states last frame, for press edges
let padSeen=false;     // a pad has been used, so its hints can show
/* a stick axis past its dead zone, rescaled to 0..1 and eased so small pushes stay fine */
function padAxis(v){const a=Math.abs(v);if(a<PAD.dead)return 0;return Math.sign(v)*Math.pow((a-PAD.dead)/(1-PAD.dead),PAD.curve);}
function padKey(code,on){   // hold or release a key as the pad's, leaving keyboard holds alone
  if(on){S.keys[code]=true;padHeld[code]=true;}
  else if(padHeld[code]){S.keys[code]=false;padHeld[code]=false;}
}
function padReleaseAll(){   // let go of everything the pad holds: keys, the guns, the zoom and the stick
  for(const k in padHeld)if(k[0]!=='_')padKey(k,false);
  if(padHeld._fire){S.fireHeld=false;padHeld._fire=false;}
  if(padHeld._zoom){S.zoomHeld=false;padHeld._zoom=false;}
  if(padHeld._steer){S.cursor.x=S.cursor.y=0;padHeld._steer=false;}
}
function padPoll(){
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  let g=null;for(const p of pads)if(p&&p.connected&&p.mapping==='standard'){g=p;break;}
  if(!g){if(padPrev.length){padReleaseAll();padPrev=[];}return;}
  const b=i=>!!(g.buttons[i]&&g.buttons[i].pressed), val=i=>g.buttons[i]?g.buttons[i].value:0;
  const now=g.buttons.map(x=>x.pressed), edge=i=>b(i)&&!padPrev[i];
  const any=now.some(Boolean)||Math.abs(g.axes[0])>.5||Math.abs(g.axes[1])>.5||Math.abs(g.axes[2])>.5||Math.abs(g.axes[3])>.5;
  if(any)padSeen=true;
  if(edge(PAD_B.Start)){
    if(S.mode==='play'&&!S.bridge)pauseGame(); else if(S.mode==='paused'&&performance.now()-pausedAt>250)resumeGame();
  }
  else if(S.mode==='play'&&S.awaitLock&&any)setAwaitLock(false);   // a pad press takes the run back
  if(S.mode!=='play'||S.awaitLock||S.bridge){padReleaseAll();padPrev=now;return;}
  if(S.launchT>0&&edge(PAD_B.A)){launchEnd(true);padPrev=now;return;}
  // steering: the right stick is the virtual stick, so letting go centres it
  const rx=padAxis(g.axes[2]),ry=padAxis(g.axes[3]);
  if(rx||ry){
    if(S.auto)autoTakeover();
    const k=SETTINGS.sens;
    S.cursor.x=Math.max(-1,Math.min(1,rx*k));
    S.cursor.y=Math.max(-1,Math.min(1,ry*k*(SETTINGS.invertY?-1:1)));
    padHeld._steer=true;
  }else if(padHeld._steer){S.cursor.x=S.cursor.y=0;padHeld._steer=false;}
  const lx=padAxis(g.axes[0]),ly=padAxis(g.axes[1]);
  padKey('KeyW',ly<-PAD.stickOn);padKey('KeyS',ly>PAD.stickOn);
  padKey('KeyA',lx<-PAD.stickOn);padKey('KeyD',lx>PAD.stickOn);
  padKey('KeyQ',b(PAD_B.Left));padKey('KeyE',b(PAD_B.Right));
  padKey('ShiftLeft',b(PAD_B.A));padKey('KeyX',b(PAD_B.B));padKey('KeyG',b(PAD_B.X));padKey('KeyF',b(PAD_B.RB));
  const fire=val(PAD_B.RT)>.3;
  if(fire){if(S.auto)autoTakeover();S.fireHeld=true;padHeld._fire=true;}
  else if(padHeld._fire){S.fireHeld=false;padHeld._fire=false;}
  if(val(PAD_B.LT)>.3){S.zoomHeld=true;padHeld._zoom=true;}else if(padHeld._zoom){S.zoomHeld=false;padHeld._zoom=false;}
  if(S.auto&&(lx||ly||b(PAD_B.A)||b(PAD_B.B)))autoTakeover();
  if(edge(PAD_B.Y))setMslMode(!S.mslMode);
  if(edge(PAD_B.LB))cycleTarget();
  if(edge(PAD_B.Up))setCruise(!S.cruise);
  if(edge(PAD_B.Down))setModel(S.model==='arcade'?'realistic':'arcade');
  if(edge(PAD_B.R3))setCam(S.cam==='fp'?'tp':'fp');
  if(edge(PAD_B.Back))bridgeOpen();
  padPrev=now;
}
/* a short rumble for a hit or a blast: `k` is 0..1 (damage taken, a big explosion nearby) */
function padRumble(k,ms){
  if(!padSeen||!navigator.getGamepads)return;
  for(const p of navigator.getGamepads()){
    const a=p&&p.vibrationActuator;
    if(a&&a.playEffect)try{a.playEffect('dual-rumble',{duration:ms||120,strongMagnitude:Math.min(1,k),weakMagnitude:Math.min(1,k*.7)});}catch(e){}
  }
}
