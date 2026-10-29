"use strict";
/* Player settings: controls, audio levels, graphics quality. Saved in localStorage. */

const SETTINGS_KEY='neonTrench.settings';
const SETTINGS_DEFAULT={sens:1,invertY:false,master:.8,music:.8,sfx:.9,fov:0,shake:true,quality:'high',fullscreen:true,capEvents:'sometimes',difficulty:'normal',hub:'walk'};
const SETTINGS=loadSettings();
function loadSettings(){
  try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if(s)return Object.assign({},SETTINGS_DEFAULT,s);}catch(e){}   // merge so new fields get defaults
  return Object.assign({},SETTINGS_DEFAULT);
}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(SETTINGS));}catch(e){}}
/* camera shake, recoil and impulse kicks: off when the OS asks for reduced motion or the player turns it off */
const shakeOn=()=>!reduceMotion&&SETTINGS.shake;

/* Graphics quality: high = bloom at up to 2x pixel density; medium = bloom at 1x; low = no bloom at 1x. */
function applyGraphics(){
  const pr=SETTINGS.quality==='high'?Math.min(devicePixelRatio,2):1;
  renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight);
  if(composer){composer.setPixelRatio(pr);composer.setSize(innerWidth,innerHeight);}
}
const bloomOn=()=>!!composer&&SETTINGS.quality!=='low';

/* Music and effects each feed their own bus (see audioInit), so the two volumes are independent. */
function applyAudioLevels(){
  if(masterGain)masterGain.gain.value=masterLevel();
  if(musicBus)musicBus.gain.value=SETTINGS.music;
  if(sfxBus)sfxBus.gain.value=SETTINGS.sfx;
}
