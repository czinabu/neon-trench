"use strict";
/* Full-screen menus: mission select, hangar, briefing, debrief. */

/* one place to flip between the full-screen menus (hud always off while shown) */
const SCR=['menu','missionSelect','briefing','debrief','hangar','endWin','endDead','pause','settings'];
function showScreen(id){for(const s of SCR)$(s).classList.toggle('hidden',s!==id);
  $('hud').classList.remove('on');$('cockHud').classList.remove('on');
  $('mslLock').style.display='none';$('speed').style.opacity=0;}
function openMissions(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  renderMissions();showScreen('missionSelect');}
function renderMissions(){
  msCredits.textContent=PROG.credits.toLocaleString();msParts.textContent=PROG.parts;
  msList.innerHTML='';
  MISSIONS.forEach(m=>{
    const un=isUnlocked(m),done=PROG.completed[m.id];
    const card=document.createElement('div');
    card.className='mcard'+(un?'':' locked')+(done?' done':'');
    const foot=done?'✓ CLEARED · best '+done.score.toLocaleString()
      :un?'Payout '+m.reward.credits+'cr'+(m.reward.parts?' + '+m.reward.parts+'◆':'')
      :'LOCKED — clear '+(missionById(m.req)?missionById(m.req).name:'prior op');
    card.innerHTML='<div class="mname">'+m.name+'</div><div class="msub">'+m.sub+'</div>'
      +'<div class="mobj">'+(un?m.objective:'· · ·')+'</div><div class="mrew">'+foot+'</div>';
    if(un)card.onclick=()=>openBriefing(m);
    msList.appendChild(card);
  });
}
/* ---- hangar: spend parts to unlock hulls, equip the one you fly with ---- */
function openHangar(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  renderHangar();showScreen('hangar');}
function fmtMul(label,mul){const p=Math.round((mul-1)*100);return p===0?'':label+' '+(p>0?'+':'')+p+'%';}
function fmtArmor(mul){const p=Math.round((1-mul)*100);return p===0?'':'ARMOR '+(p>0?'+':'')+p+'%';}  // inverted: lower mul = tankier
function fmtRof(mul){const p=Math.round((1/mul-1)*100);return p===0?'':'RPM '+(p>0?'+':'')+p+'%';}  // inverted: lower mul = faster fire
function fmtMsl(b){return !b?'':'MSL '+(b>0?'+':'')+b;}
function renderHangar(){
  hgParts.textContent=PROG.parts;hgCredits.textContent=PROG.credits.toLocaleString();
  hgList.innerHTML='';
  SHIPS.forEach(s=>{
    const owned=PROG.shipsOwned.includes(s.id),equipped=PROG.ship===s.id,afford=PROG.parts>=s.cost;
    const card=document.createElement('div');
    card.className='mcard'+(equipped?' done':'')+(!owned&&!afford?' locked':'');
    const stats=[fmtMul('SPD',s.spdMul),fmtMul('ACC',s.accelMul),fmtMul('TURN',s.turnMul),fmtMul('DMG',s.dmgMul),
      fmtRof(s.rofMul),fmtMul('BOOST',s.boostRegenMul),fmtArmor(s.armorMul),fmtMsl(s.mslBonus)].filter(Boolean).join(' · ')||'Baseline stats';
    const foot=equipped?'★ EQUIPPED':owned?'Click to equip':afford?'Unlock — '+s.cost+' ◆':'Need '+(s.cost-PROG.parts)+' more parts';
    card.innerHTML='<div class="mship" style="background-image:url('+renderShipThumb(s)+')"></div>'
      +'<div class="mname">'+s.name+'</div><div class="msub">'+s.role+'</div>'
      +'<div class="mobj">'+s.desc+'</div><div class="mstats">'+stats+'</div><div class="mrew">'+foot+'</div>';
    if(owned&&!equipped)card.onclick=()=>{setShip(s.id);renderHangar();};
    else if(!owned&&afford)card.onclick=()=>{if(unlockShip(s)){setShip(s.id);renderHangar();}};
    hgList.appendChild(card);
  });
}
function openBriefing(m){
  S.briefM=m;showScreen('briefing');
  bfName.textContent=m.name;bfSub.textContent=m.sub;
  bfBrief.innerHTML=m.brief.map(l=>'<div>'+l+'</div>').join('');
  let html='<div class="objl primary">▸ '+m.objective+'</div>';
  (m.bonuses||[]).forEach(b=>html+='<div class="objl bonus">+ '+b.label+' <i>+'+b.credits+'cr</i></div>');
  bfObj.innerHTML=html;
  bfReward.textContent='Mission payout · '+m.reward.credits+'cr'+(m.reward.parts?' + '+m.reward.parts+' parts':'');
}
function launchMission(m){S.mission=m;startGame(m.sector);}
function openDebrief(win,cause){
  const m=S.mission;
  const bonuses=(m.bonuses||[]).map(b=>({label:b.label,credits:b.credits,met:win&&evalBonus(b)}));
  let credits=0,parts=0,firstClear=false;
  if(win){
    const prev=PROG.completed[m.id];firstClear=!prev;
    credits=m.reward.credits||0;bonuses.forEach(b=>{if(b.met)credits+=b.credits||0;});
    if(firstClear)parts=m.reward.parts||0; else credits=Math.round(credits*.5); // repeat clears pay less, no parts
    PROG.completed[m.id]={score:Math.max(prev?prev.score:0,S.score),
      time:Math.min(prev?prev.time:1e9,S.time),
      bonuses:Math.max(prev?prev.bonuses:0,bonuses.filter(b=>b.met).length)};
    PROG.credits+=credits;PROG.parts+=parts;saveProg();
  }
  showScreen('debrief');
  dbTitle.textContent=win?'MISSION COMPLETE':'MISSION FAILED';
  dbTitle.style.color=win?'var(--cyan)':'var(--mag)';
  dbSub.textContent=win?'// '+m.name.toLowerCase():'// '+(cause||'airframe lost');
  let html='<div class="objl '+(win?'met':'fail')+'">'+(win?'✓':'✕')+' '+m.objective+'</div>';
  bonuses.forEach(b=>html+='<div class="objl '+(b.met?'met':'miss')+'">'+(b.met?'✓':'·')+' '+b.label+' <i>+'+b.credits+'cr</i></div>');
  dbObj.innerHTML=html;
  if(win)dbReward.innerHTML='<b>+'+credits.toLocaleString()+' cr</b>'+(parts?' · <b>+'+parts+' parts</b>':'')
      +(firstClear?'':' <span class="rep">(repeat payout)</span>');
  else dbReward.innerHTML='<span class="rep">No payout — mission incomplete</span>';
  dbTotal.textContent='Balance · '+PROG.credits.toLocaleString()+' cr · '+PROG.parts+' parts';
  dbBtns.innerHTML='';
  const mk=(label,cls,fn)=>{const b=document.createElement('button');b.className='btn'+(cls||'');b.textContent=label;b.onclick=fn;dbBtns.appendChild(b);};
  const next=win?MISSIONS.find(x=>x.req===m.id&&isUnlocked(x)):null;
  if(next)mk('Next Op',' alt',()=>openBriefing(next));
  mk('Replay',next?' ghost':' alt',()=>launchMission(m));
  mk('Mission Select',' ghost',openMissions);
}
/* ---- settings: opened from the main menu or the pause screen, and returns to whichever it came from
   (swapping just those two screens, so pausing mid-run keeps the run's HUD intact) ---- */
let settingsFrom='menu';
function openSettings(from){
  settingsFrom=from;syncSettingsUI();
  $(from).classList.add('hidden');$('settings').classList.remove('hidden');
}
function closeSettings(){
  saveSettings();
  $('settings').classList.add('hidden');$(settingsFrom).classList.remove('hidden');
}
const settingsOpen=()=>!$('settings').classList.contains('hidden');
const pct=v=>Math.round(v*100)+'%';
const SET_RANGES=[   // [input, key, readout, format, apply on change]
  [setSens,'sens',setSensV,v=>v.toFixed(2)+'x'],
  [setMusic,'music',setMusicV,pct,applyAudioLevels],
  [setSfx,'sfx',setSfxV,pct,applyAudioLevels],
  [setFov,'fov',setFovV,v=>(v>0?'+':'')+v+'°'],
];
function syncSettingsUI(){
  for(const [el,key,out,fmt] of SET_RANGES){el.value=SETTINGS[key];out.textContent=fmt(SETTINGS[key]);}
  setInvert.checked=SETTINGS.invertY;setShake.checked=SETTINGS.shake;setQuality.value=SETTINGS.quality;
}
for(const [el,key,out,fmt,apply] of SET_RANGES)
  el.oninput=()=>{SETTINGS[key]=parseFloat(el.value);out.textContent=fmt(SETTINGS[key]);if(apply)apply();};
setInvert.onchange=()=>{SETTINGS.invertY=setInvert.checked;};
setShake.onchange=()=>{SETTINGS.shake=setShake.checked;};
setQuality.onchange=()=>{SETTINGS.quality=setQuality.value;applyGraphics();};
settingsBtn.onclick=()=>openSettings('menu');
pauseSetBtn.onclick=()=>openSettings('pause');
setBack.onclick=closeSettings;
