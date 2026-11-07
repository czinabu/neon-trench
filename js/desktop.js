"use strict";
/* Windows app only (desktop/): the Exit buttons on the title screen and the pause menu. The app's
   preload script (desktop/preload.js) adds `window.desktopApp`; in a browser it isn't there and the
   buttons stay hidden. Progress is saved as it happens, so exiting loses only an unfinished run,
   same as going back to the main menu. */
if(window.desktopApp){
  quitBtn.hidden=false;pauseQuitBtn.hidden=false;
  quitBtn.onclick=pauseQuitBtn.onclick=()=>desktopApp.quit();
}
