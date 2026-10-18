"use strict";
/* Fullscreen: on by default, toggled from the title and pause screens (the choice is saved).
   Browsers only allow fullscreen from a click or key press, so it is entered on the first one,
   and again when a run starts or resumes. While fullscreen, Chrome and Edge let the page keep
   the Esc key (Keyboard Lock), so Esc opens and closes the pause menu and the player holds Esc
   to leave fullscreen. Firefox and Safari always leave fullscreen on Esc; the run then pauses as
   usual and resuming goes back to fullscreen. */
const fsSupported=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
const isFullscreen=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
const fsQuiet=p=>{if(p&&p.catch)p.catch(()=>{});};   // a refused request is fine: we just stay windowed
function enterFullscreen(){
  if(!fsSupported||isFullscreen())return;
  const el=document.documentElement;
  try{fsQuiet((el.requestFullscreen||el.webkitRequestFullscreen).call(el,{navigationUI:'hide'}));}catch(e){}
}
function exitFullscreen(){
  if(!isFullscreen())return;
  try{fsQuiet((document.exitFullscreen||document.webkitExitFullscreen).call(document));}catch(e){}
}
/* the toggles: change the saved preference and apply it now */
function setFullscreen(on){SETTINGS.fullscreen=on;saveSettings();if(on)enterFullscreen();else exitFullscreen();syncFullscreenUI();}
function toggleFullscreen(){setFullscreen(!isFullscreen());}
/* call from a click or key handler: go fullscreen if the player wants it */
function syncFullscreen(){if(SETTINGS.fullscreen)enterFullscreen();}
function syncFullscreenUI(){
  const on=isFullscreen();
  for(const b of document.querySelectorAll('.fsToggle')){
    b.textContent='Fullscreen · '+(on?'On':'Off');b.classList.toggle('on',on);b.style.display=fsSupported?'':'none';}
  fsHint.style.display=on&&navigator.keyboard&&navigator.keyboard.lock?'':'none';   // only Keyboard Lock makes Esc a hold
}
function onFullscreenChange(){
  const kb=navigator.keyboard;
  if(isFullscreen()){if(kb&&kb.lock)fsQuiet(kb.lock(['Escape']));}
  else{
    if(kb&&kb.unlock)kb.unlock();
    // left outside a run (holding Esc on the pause menu, or the browser's own controls): the player
    // chose windowed, so stop going back. Leaving mid-run is the browser's forced Esc, which pauses
    // the run in the same moment; resuming then returns to fullscreen.
    if(S.mode!=='play'&&performance.now()-pausedAt>600&&SETTINGS.fullscreen){SETTINGS.fullscreen=false;saveSettings();}
  }
  syncFullscreenUI();
}
document.addEventListener('fullscreenchange',onFullscreenChange);
document.addEventListener('webkitfullscreenchange',onFullscreenChange);
/* the first click or key of the session takes the game fullscreen (the default) */
{
  const first=()=>{removeEventListener('pointerdown',first,true);removeEventListener('keydown',first,true);syncFullscreen();};
  addEventListener('pointerdown',first,true);addEventListener('keydown',first,true);
}
