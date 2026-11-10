"use strict";
/* The title screen's version label, and the Windows app's Exit buttons.
   In the Windows app (desktop/), the preload script (desktop/preload.js) adds `window.desktopApp`: the label
   shows the installed version, MAJOR.MINOR.<release build>, which goes up with every auto-update, and the
   Exit buttons on the title screen and the pause menu appear; each asks once before it quits. Progress is saved as it happens, so exiting
   loses only an unfinished run, same as going back to the main menu.
   In a browser the label shows `version` from package.json when the page is served (not from a file:// open). */
function showGameVersion(v){if(v){gameVer.textContent='v'+v;gameVer.hidden=false;}}
if(window.desktopApp){
  showGameVersion(desktopApp.version);
  quitBtn.hidden=false;pauseQuitBtn.hidden=false;
  /* a click arms the button ("Sure?"), a second click within a few seconds quits; any other click or Esc disarms it */
  const label=new Map([[quitBtn,quitBtn.textContent],[pauseQuitBtn,pauseQuitBtn.textContent]]);
  let armed=null,armT=0;
  const disarm=()=>{if(!armed)return;armed.textContent=label.get(armed);armed.classList.remove('arm');armed=null;clearTimeout(armT);};
  for(const b of label.keys())b.onclick=e=>{e.stopPropagation();
    if(armed===b){desktopApp.quit();return;}
    disarm();armed=b;b.textContent='Sure? Click again to exit';b.classList.add('arm');armT=setTimeout(disarm,4000);};
  document.addEventListener('click',disarm);
  addEventListener('keydown',e=>{if(e.code==='Escape')disarm();});
}else if(location.protocol!=='file:'){
  fetch('package.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(p=>showGameVersion(p&&p.version)).catch(()=>{});
}
