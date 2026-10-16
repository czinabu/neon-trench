"use strict";
/* Keyboard, mouse and touch input. */

addEventListener('keydown',e=>{S.keys[e.code]=true;
  if(e.repeat)return;
  if(e.code==='KeyN')setMuted(!S.muted);   // mute toggle works on any screen
  if(e.code==='Escape'||e.code==='KeyP'){  // pause / resume
    if(S.mode==='play')pauseGame(); else if(S.mode==='paused')resumeGame();
  }
  if(S.mode==='play'){
    if(e.code==='KeyT')setCam(S.cam==='fp'?'tp':'fp');
    if(e.code==='KeyR'||e.code==='KeyM')setModel(S.model==='arcade'?'realistic':'arcade'); // R primary, M legacy
  }
  if(e.code==='Space'||e.code==='ControlLeft'||e.code==='ControlRight')e.preventDefault();});
addEventListener('keyup',e=>S.keys[e.code]=false);
addEventListener('mousemove',e=>{if(S.mode!=='play'||document.pointerLockElement!==renderer.domElement)return;
  const sens=560*(1+S.zoomK*.8); // steadier hand while zoomed
  S.cursor.x=Math.max(-1,Math.min(1,S.cursor.x+e.movementX/sens));
  S.cursor.y=Math.max(-1,Math.min(1,S.cursor.y+e.movementY/sens));});
addEventListener('mousedown',e=>{if(S.mode!=='play')return;
  if(S.awaitLock){renderer.domElement.requestPointerLock();return;}   // this click only takes control back
  if(e.button===0)S.fireHeld=true;
  if(e.button===2)S.zoomHeld=true;});
addEventListener('mouseup',e=>{if(e.button===0)S.fireHeld=false;
  if(e.button===2)S.zoomHeld=false;});
addEventListener('contextmenu',e=>e.preventDefault());

/* touch */
let touchSteer=null;
if(isTouch){
  $('touch').classList.add('on');
  renderer.domElement.addEventListener('touchstart',e=>{const t=e.changedTouches[0];
    if(t.clientX<innerWidth*.6)touchSteer={id:t.identifier,x:t.clientX,y:t.clientY};});
  renderer.domElement.addEventListener('touchmove',e=>{if(!touchSteer)return;
    for(const t of e.changedTouches)if(t.identifier===touchSteer.id){
      S.cursor.x=Math.max(-1,Math.min(1,(t.clientX-touchSteer.x)/110));
      S.cursor.y=Math.max(-1,Math.min(1,(t.clientY-touchSteer.y)/110));}});
  renderer.domElement.addEventListener('touchend',e=>{for(const t of e.changedTouches)
    if(touchSteer&&t.identifier===touchSteer.id){touchSteer=null;S.cursor.x=0;S.cursor.y=0;}});
  const hold=(id,on,off)=>{const b=$(id);
    b.addEventListener('touchstart',e=>{e.preventDefault();on();});
    b.addEventListener('touchend',e=>{e.preventDefault();off&&off();});};
  hold('tFire',()=>S.fireHeld=true,()=>S.fireHeld=false);
  hold('tBoost',()=>S.keys.ShiftLeft=true,()=>S.keys.ShiftLeft=false);
  hold('tTorp',()=>S.keys.KeyF=true,()=>S.keys.KeyF=false);
  hold('tMsl',()=>S.keys.KeyV=true,()=>S.keys.KeyV=false);
}
