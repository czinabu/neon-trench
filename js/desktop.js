"use strict";
/* The title screen's version label, and the Windows app's Exit buttons.
   In the Windows app (desktop/), the preload script (desktop/preload.js) adds `window.desktopApp`: the label
   shows the installed version, MAJOR.MINOR.<release build>, which goes up with every auto-update, and the
   Exit buttons on the title screen and the pause menu appear. Progress is saved as it happens, so exiting
   loses only an unfinished run, same as going back to the main menu.
   In a browser the label shows `version` from package.json when the page is served (not from a file:// open). */
function showGameVersion(v){if(v){gameVer.textContent='v'+v;gameVer.hidden=false;}}
if(window.desktopApp){
  showGameVersion(desktopApp.version);
  quitBtn.hidden=false;pauseQuitBtn.hidden=false;
  quitBtn.onclick=pauseQuitBtn.onclick=()=>desktopApp.quit();
}else if(location.protocol!=='file:'){
  fetch('package.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(p=>showGameVersion(p&&p.version)).catch(()=>{});
}
