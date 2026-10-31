"use strict";
/* Keyboard, mouse and touch input. */

addEventListener('keydown',e=>{
  if(S.mode==='play'&&S.bridge){   // on the command bridge the keys give orders, not fly (js/bridge.js)
    if(!e.repeat)bridgeKey(e);
    if(e.code==='Tab'||e.code==='Space'||e.key==='Alt')e.preventDefault();
    return;
  }
  S.keys[e.code]=true;
  if(S.auto&&AUTO_KEYS.test(e.code))autoTakeover();   // flying yourself takes the autopilot off
  if(e.repeat)return;
  if(e.code==='KeyN')setMuted(!S.muted);   // mute toggle works on any screen
  if(e.code==='Escape'&&keybindsOpen()){closeKeybinds();return;}
  if((e.code==='Escape'||e.code==='KeyP')&&settingsOpen()){if(e.code==='Escape')closeSettings();return;}   // Esc backs out of settings first
  if(e.code==='Escape'&&controlsOpen()){closeControls();return;}
  if(S.mode==='menu'&&!settingsOpen()&&!keybindsOpen()&&deckKey(e)){e.preventDefault();return;}   // walking HALCYON's deck (js/deck.js)
  if(S.mode==='play'&&e.code==='Enter'&&tutActive()){tutSkip();return;}
  if(S.mode==='play'&&e.code==='Enter'&&S.launchT>0){launchEnd(true);return;}
  if(S.mode!=='play'&&S.mode!=='paused'&&/^(Escape|Enter|ArrowUp|ArrowDown)$/.test(e.code)&&menuKey(e.code)){e.preventDefault();return;}
  if(e.code==='Tab'&&!settingsOpen()&&!keybindsOpen()&&!controlsOpen()&&(S.mode==='play'||S.mode==='paused')){e.preventDefault();   // Tab pauses too (on the bridge it still steps units)
    if(S.mode==='play')pauseGame(); else if(performance.now()-pausedAt>250)resumeGame();
  }
  if(e.code==='Escape'||e.code==='KeyP'){  // pause / resume (in fullscreen, js/fullscreen.js keeps Esc from leaving it)
    if(S.mode==='play')pauseGame(); else if(S.mode==='paused'&&performance.now()-pausedAt>250)resumeGame();
  }
  if(S.mode==='play'){
    if(e.code==='KeyR')cycleTarget();
    if(e.code==='KeyB')bridgeOpen();
    if(e.code==='Digit1')setWingOrder('form');
    if(e.code==='Digit2')setWingOrder('target');
    if(e.code==='Digit3')setWingOrder('free');
    if(e.code==='Digit4')setWingOrder('cover');
    if(e.code==='Digit5')setWingOrder('defend');
    if(e.code==='Digit6')setWingOrder('strike');
    if(e.code==='AltLeft'||e.code==='AltRight')setCam(S.cam==='fp'?'tp':'fp');
    if(e.code==='KeyT')setCruise(!S.cruise);
    if(e.code==='KeyV')setModel(S.model==='arcade'?'realistic':'arcade');
  }
  if(e.code==='Space'||e.code==='ControlLeft'||e.code==='ControlRight'||e.key==='Alt')e.preventDefault();});
addEventListener('keyup',e=>{S.keys[e.code]=false;if(e.key==='Alt')e.preventDefault();});   // keeps Alt from focusing the browser menu bar
addEventListener('mousemove',e=>{if(S.mode!=='play'||document.pointerLockElement!==renderer.domElement)return;
  if(S.auto&&Math.abs(e.movementX)+Math.abs(e.movementY)>4)autoTakeover();
  const sens=560*(1+S.zoomK*.8)/SETTINGS.sens; // steadier hand while zoomed
  S.cursor.x=Math.max(-1,Math.min(1,S.cursor.x+e.movementX/sens));
  S.cursor.y=Math.max(-1,Math.min(1,S.cursor.y+e.movementY*(SETTINGS.invertY?-1:1)/sens));});
addEventListener('mousedown',e=>{if(S.mode!=='play'||S.bridge)return;
  if(S.awaitLock){renderer.domElement.requestPointerLock();return;}   // this click only takes control back
  if(e.button===0){autoTakeover();S.fireHeld=true;}
  if(e.button===1){e.preventDefault();setMslMode(!S.mslMode);}   // middle click: lasers <-> missiles (no autoscroll)
  if(e.button===2)S.zoomHeld=true;});
addEventListener('mouseup',e=>{if(e.button===0)S.fireHeld=false;
  if(e.button===2)S.zoomHeld=false;});
addEventListener('contextmenu',e=>e.preventDefault());

/* touch: a floating steer stick on the left of the screen, a throttle strip at its edge, and buttons on the right.
   Everything feeds the same state the keyboard does (S.cursor, S.keys, S.fireHeld, S.throttle). The strip sets cruise
   so a set speed holds with the thumb off it. */
let touchSteer=null,touchThr=null,touchRunFlag=false;
const THR_MAX=1;
function touchPoll(){   // once a frame from js/loop.js: a fresh run starts at 60% cruise so a phone pilot is never stranded at 0
  if(!isTouch)return;
  if(S.mode!=='play'){touchRunFlag=false;return;}
  if(!touchRunFlag){touchRunFlag=true;if(!S.cruise)setCruise(true);S.throttle=.6;}
  if(!touchThr)$('tThrFill').style.height=Math.max(0,S.throttle/THR_MAX*100)+'%';
}
let touchWired=false;
function touchEnable(){   // shows the touch controls and wires them; runs at load on a touch screen, or on the first touch
  isTouch=true;$('touch').classList.add('on');document.body.classList.add('touch');
  if(touchWired)return;touchWired=true;
  if(document.pointerLockElement)document.exitPointerLock();
  if(S.mode==='play'&&S.awaitLock)setAwaitLock(false);
  const stick=$('tStick'),knob=$('tKnob');
  const stickShow=(on,x,y)=>{stick.style.display=on?'block':'none';if(on){stick.style.left=x+'px';stick.style.top=y+'px';}};
  const stickKnob=(dx,dy)=>{knob.style.transform='translate('+dx+'px,'+dy+'px)';};
  renderer.domElement.addEventListener('touchstart',e=>{
    if(S.mode==='play'&&S.launchT>0)launchEnd(true);
    autoTakeover();
    for(const t of e.changedTouches)if(!touchSteer&&t.clientX<innerWidth*.6){
      touchSteer={id:t.identifier,x:t.clientX,y:t.clientY};stickShow(true,t.clientX,t.clientY);stickKnob(0,0);}});
  renderer.domElement.addEventListener('touchmove',e=>{if(!touchSteer)return;
    for(const t of e.changedTouches)if(t.identifier===touchSteer.id){
      const k=SETTINGS.sens/110,dx=t.clientX-touchSteer.x,dy=t.clientY-touchSteer.y;
      S.cursor.x=Math.max(-1,Math.min(1,dx*k));
      S.cursor.y=Math.max(-1,Math.min(1,dy*k*(SETTINGS.invertY?-1:1)));
      stickKnob(Math.max(-1,Math.min(1,dx*k))*42,Math.max(-1,Math.min(1,dy*k))*42);}});
  const steerEnd=e=>{for(const t of e.changedTouches)
    if(touchSteer&&t.identifier===touchSteer.id){touchSteer=null;S.cursor.x=0;S.cursor.y=0;stickShow(false);}};
  renderer.domElement.addEventListener('touchend',steerEnd);
  renderer.domElement.addEventListener('touchcancel',steerEnd);
  const hold=(id,on,off)=>{const b=$(id);
    b.addEventListener('touchstart',e=>{e.preventDefault();b.classList.add('down');autoTakeover();on();});
    const up=e=>{e.preventDefault();b.classList.remove('down');off&&off();};
    b.addEventListener('touchend',up);b.addEventListener('touchcancel',up);};
  hold('tFire',()=>S.fireHeld=true,()=>S.fireHeld=false);
  hold('tBoost',()=>S.keys.ShiftLeft=true,()=>S.keys.ShiftLeft=false);
  hold('tTorp',()=>S.keys.KeyF=true,()=>S.keys.KeyF=false);
  hold('tMsl',()=>setMslMode(!S.mslMode));
  hold('tFlare',()=>S.keys.KeyG=true,()=>S.keys.KeyG=false);
  hold('tBridge',()=>S.bridge?bridgeClose():bridgeOpen());
  hold('tRollL',()=>S.keys.KeyQ=true,()=>S.keys.KeyQ=false);
  hold('tRollR',()=>S.keys.KeyE=true,()=>S.keys.KeyE=false);
  hold('tBrake',()=>{S.keys.KeyX=true;},()=>{S.keys.KeyX=false;});
  hold('tTgt',()=>{if(S.mode==='play')cycleTarget();});
  hold('tView',()=>{if(S.mode==='play')setCam(S.cam==='fp'?'tp':'fp');});
  hold('tPause',()=>{if(S.mode==='play')pauseGame();});
  /* throttle strip: drag up for more, down for less; the speed holds when you let go */
  const thr=$('tThr'),thrSet=t=>{const r=thr.getBoundingClientRect();
    const v=Math.max(0,Math.min(1,1-(t.clientY-r.top)/r.height))*THR_MAX;
    if(!S.cruise)setCruise(true);S.throttle=v<.04?0:v;$('tThrFill').style.height=v*100+'%';};
  thr.addEventListener('touchstart',e=>{e.preventDefault();autoTakeover();const t=e.changedTouches[0];touchThr=t.identifier;thrSet(t);});
  thr.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===touchThr)thrSet(t);});
  const thrEnd=e=>{for(const t of e.changedTouches)if(t.identifier===touchThr)touchThr=null;};
  thr.addEventListener('touchend',thrEnd);thr.addEventListener('touchcancel',thrEnd);
}
if(isTouch)touchEnable();
/* the load-time check missed a touch screen (an odd browser, or a touchscreen laptop someone is now tapping): the first
   real touch turns the touch controls on */
addEventListener('touchstart',()=>{if(!isTouch)touchEnable();},{capture:true,passive:true});
