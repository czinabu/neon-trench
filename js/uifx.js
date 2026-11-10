"use strict";
/* In-world UI feel: every menu screen is a console aboard HALCYON (look: css/theme.css).
   - The status strip along the top names the station you are at (the title's data-k code), the ship's
     clock and the comms link, so a screen reads as a terminal rather than a game menu.
   - A screen coming up plays a scan wipe and a soft power-up sound instead of a hard cut.
   - Radio and briefing transmissions type in, and console rows blip under the pointer.
   It only watches the DOM: no other file calls into it, and removing its <script> leaves the game working. */
const uiStripEl=document.createElement('div');uiStripEl.id='uiStrip';
uiStripEl.innerHTML='<span class="usL"><i></i><b>HALCYON</b><em id="uiStripSta"></em></span><span class="usR"><em id="uiStripCtx"></em><em>SHIP TIME <b id="uiStripClk">00:00:00</b></em><em class="usLink">COMMS LINKED</em></span>';
const uiWipeEl=document.createElement('div');uiWipeEl.id='uiWipe';
document.body.append(uiStripEl,uiWipeEl);
const uiQuiet=new Set(['menu','deck']);   // the title has its own masthead; the deck has its own HUD
let uiWipeAt=0;
/* the strip: shown over any open console screen, never in flight, on the deck or during a cutscene */
function uiStripDraw(){
  const id=SCR.find(s=>!$(s).classList.contains('hidden'));
  const cut=document.getElementById('cut'),inCut=cut&&!cut.classList.contains('hidden');
  const on=!!id&&!uiQuiet.has(id)&&!inCut;
  uiStripEl.classList.toggle('on',on);
  if(!on)return;
  const t=$(id).querySelector('[data-k]');
  uiStripSta.textContent=t?t.dataset.k:'';
  const nm=typeof nextMission==='function'&&nextMission();
  uiStripCtx.textContent=(nm?'NEXT OP '+nm.name:'ALL OPS CLEAR')+' · FLYING '+(typeof curShip!=='undefined'&&curShip?curShip.name:'');
  const d=new Date();uiStripClk.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
}
setInterval(uiStripDraw,1000);
/* a screen powering up: the scan line sweeps down, and the console hums once */
function uiScreenUp(id){
  uiStripDraw();
  if(uiQuiet.has(id)&&id==='deck')return;
  const now=performance.now();if(now-uiWipeAt<180)return;uiWipeAt=now;
  uiWipeEl.classList.remove('go');void uiWipeEl.offsetWidth;uiWipeEl.classList.add('go');
  if(typeof sfx==='function')sfx('panel');
}
const uiSeen=new Map();
const uiObs=new MutationObserver(list=>{for(const m of list){const el=m.target,open=!el.classList.contains('hidden');
  if(open&&!uiSeen.get(el))uiScreenUp(el.id);uiSeen.set(el,open);}});
for(const id of SCR){const el=$(id);uiSeen.set(el,!el.classList.contains('hidden'));uiObs.observe(el,{attributes:true,attributeFilter:['class']});}
/* transmissions: the line types in each time new text arrives */
const uiType=new MutationObserver(list=>{const done=new Set();for(const m of list){
  const el=m.target.nodeType===1?m.target.closest('.vox,#radioBox'):m.target.parentElement&&m.target.parentElement.closest('.vox,#radioBox');
  if(!el||done.has(el))continue;done.add(el);el.classList.remove('typein');void el.offsetWidth;el.classList.add('typein');}});
for(const el of document.querySelectorAll('.vox,#radioBox'))uiType.observe(el,{childList:true,characterData:true,subtree:true});
/* a faint blip as the pointer crosses onto a console row or button */
let uiHoverEl=null,uiHoverAt=0;
document.addEventListener('pointerover',e=>{
  const el=e.target.closest&&e.target.closest('.hgrow,.mmode,.pbtn,.btn,.tab,.mmini,.dkbtn,.dkroomb,.bftip,.ccstep');
  if(!el||el===uiHoverEl)return;uiHoverEl=el;
  if(e.pointerType==='touch'||el.disabled)return;
  const now=performance.now();if(now-uiHoverAt<45)return;uiHoverAt=now;
  if(typeof AC!=='undefined'&&AC)sfx('hover');
});
