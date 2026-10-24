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
  if((e.code==='Escape'||e.code==='KeyP')&&settingsOpen()){if(e.code==='Escape')closeSettings();return;}   // Esc backs out of settings first
  if(e.code==='Escape'&&controlsOpen()){closeControls();return;}
  if(S.mode==='play'&&e.code==='Enter'&&tutActive()){tutSkip();return;}
  if(S.mode==='play'&&e.code==='Enter'&&S.launchT>0){launchEnd(true);return;}
  if(S.mode!=='play'&&S.mode!=='paused'&&/^(Escape|Enter|ArrowUp|ArrowDown)$/.test(e.code)&&menuKey(e.code)){e.preventDefault();return;}
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

/* touch */
let touchSteer=null;
if(isTouch){
  $('touch').classList.add('on');
  renderer.domElement.addEventListener('touchstart',e=>{const t=e.changedTouches[0];
    if(S.mode==='play'&&S.launchT>0)launchEnd(true);
    autoTakeover();
    if(t.clientX<innerWidth*.6)touchSteer={id:t.identifier,x:t.clientX,y:t.clientY};});
  renderer.domElement.addEventListener('touchmove',e=>{if(!touchSteer)return;
    for(const t of e.changedTouches)if(t.identifier===touchSteer.id){
      const k=SETTINGS.sens/110;
      S.cursor.x=Math.max(-1,Math.min(1,(t.clientX-touchSteer.x)*k));
      S.cursor.y=Math.max(-1,Math.min(1,(t.clientY-touchSteer.y)*k*(SETTINGS.invertY?-1:1)));}});
  renderer.domElement.addEventListener('touchend',e=>{for(const t of e.changedTouches)
    if(touchSteer&&t.identifier===touchSteer.id){touchSteer=null;S.cursor.x=0;S.cursor.y=0;}});
  const hold=(id,on,off)=>{const b=$(id);
    b.addEventListener('touchstart',e=>{e.preventDefault();on();});
    b.addEventListener('touchend',e=>{e.preventDefault();off&&off();});};
  hold('tFire',()=>S.fireHeld=true,()=>S.fireHeld=false);
  hold('tBoost',()=>S.keys.ShiftLeft=true,()=>S.keys.ShiftLeft=false);
  hold('tTorp',()=>S.keys.KeyF=true,()=>S.keys.KeyF=false);
  hold('tMsl',()=>setMslMode(!S.mslMode));
  hold('tFlare',()=>S.keys.KeyG=true,()=>S.keys.KeyG=false);
  hold('tBridge',()=>S.bridge?bridgeClose():bridgeOpen());
}
