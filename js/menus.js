"use strict";
/* Full-screen menus: mission select, hangar, briefing, debrief. */

/* one place to flip between the full-screen menus (hud always off while shown) */
const SCR=['menu','missionSelect','briefing','debrief','hangar','endWin','endDead','pause','settings','controls'];
function showScreen(id){for(const s of SCR)$(s).classList.toggle('hidden',s!==id);
  if(id==='menu')renderMenu();
  $('hud').classList.remove('on');$('cockHud').classList.remove('on');
  $('mslLock').style.display='none';$('speed').style.opacity=0;}
function openMissions(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  renderMissions();showScreen('missionSelect');}
/* the first unlocked mission not yet cleared: what the campaign button and the sortie board point you at */
const nextMission=()=>MISSIONS.find(m=>isUnlocked(m)&&!PROG.completed[m.id])||null;
/* title screen: campaign progress under the buttons, next op on the campaign button */
function renderMenu(){
  const cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length,nm=nextMission();
  campaignNext.textContent=nm?(cleared?'Next op · ':'Start · ')+nm.name:'All ops cleared · replay any';
  pilotLine.innerHTML='<span><b>'+cleared+' / '+MISSIONS.length+'</b> ops cleared</span><span><b>'+PROG.credits.toLocaleString()
    +'</b> cr</span><span>◆ <b>'+PROG.parts+'</b> parts</span><span>Flying <b>'+curShip.name+'</b></span>';
}
function renderMissions(){
  msCredits.textContent=PROG.credits.toLocaleString();msParts.textContent=PROG.parts;
  msList.innerHTML='';
  const nm=nextMission();
  MISSIONS.forEach((m,i)=>{
    const un=isUnlocked(m),done=PROG.completed[m.id],isNext=m===nm;
    const card=document.createElement('div');
    card.className='mcard'+(un?'':' locked')+(done?' done':'')+(isNext?' next':'');
    const chip=done?'<span class="chip ok">✓ Cleared</span>':isNext?'<span class="chip next">▸ Next</span>':un?'':'<span class="chip">Locked</span>';
    const bonusN=(m.bonuses||[]).length;
    const foot=done?'Best '+done.score.toLocaleString()+' · bonuses '+(done.bonuses||0)+' / '+bonusN+' · replay pays half'
      :un?'Payout '+m.reward.credits+' cr'+(m.reward.parts?' + '+m.reward.parts+' ◆':'')
      :'Clear '+(missionById(m.req)?missionById(m.req).name:'the previous op')+' to unlock';
    card.innerHTML='<div class="mname"><span class="mnum">0'+(i+1)+'</span>'+m.name+chip+'</div>'
      +'<div class="msub">'+m.sub+' · '+(m.sector==='arena'?'open space':'trench')+'</div>'
      +'<div class="mobj">'+(un?m.objective:'Classified')+'</div><div class="mrew">'+foot+'</div>';
    if(un)card.onclick=()=>openBriefing(m);
    msList.appendChild(card);
  });
}
/* ---- hangar: spend parts to unlock hulls, equip the one you fly with ---- */
let hangarFrom='menu';   // the briefing's "Change hull" comes back to the briefing
function openHangar(from){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  hangarFrom=from==='briefing'?'briefing':'menu';renderHangar();showScreen('hangar');}
function closeHangar(){if(hangarFrom==='briefing')openBriefing(S.briefM);else{S.mode='menu';showScreen('menu');}}
/* ---- controls reference: opened from the title or the pause screen, returns to whichever ---- */
let controlsFrom='menu';
function openControls(from){controlsFrom=from;$(from).classList.add('hidden');$('controls').classList.remove('hidden');}
function closeControls(){$('controls').classList.add('hidden');$(controlsFrom).classList.remove('hidden');}
const controlsOpen=()=>!$('controls').classList.contains('hidden');
function fmtMul(label,mul){const p=Math.round((mul-1)*100);return p===0?'':label+' '+(p>0?'+':'')+p+'%';}
function fmtArmor(mul){const p=Math.round((1-mul)*100);return p===0?'':'ARMOR '+(p>0?'+':'')+p+'%';}  // inverted: lower mul = tankier
function fmtRof(mul){const p=Math.round((1/mul-1)*100);return p===0?'':'RPM '+(p>0?'+':'')+p+'%';}  // inverted: lower mul = faster fire
function fmtMsl(b){return !b?'':'MSL '+(b>0?'+':'')+b;}
let hgTab='hulls';
function setHangarTab(t){hgTab=t;hgTabHulls.classList.toggle('on',t==='hulls');hgTabUp.classList.toggle('on',t==='up');
  hgList.style.display=t==='hulls'?'':'none';upList.style.display=t==='up'?'':'none';
  hgSub.textContent=t==='hulls'?'// select hull':'// workshop: upgrades apply to every hull';renderHangar();}
/* workshop: spend credits on upgrades that stack onto whichever hull you fly */
function renderUpgrades(){
  upList.innerHTML='';
  UPGRADES.forEach(u=>{
    const l=PROG.upgrades[u.id]||0,max=l>=u.costs.length,cost=max?0:u.costs[l],afford=!max&&PROG.credits>=cost;
    const card=document.createElement('div');
    card.className='mcard'+(max?' done':'')+(!max&&!afford?' locked':'');
    const pips=u.costs.map((c,i)=>'<span class="upip'+(i<l?' on':'')+'"></span>').join('');
    const foot=max?'★ MAXED':afford?'Upgrade · '+cost.toLocaleString()+' cr':'Need '+(cost-PROG.credits).toLocaleString()+' more cr';
    card.innerHTML='<div class="mname">'+u.name+'<span class="upips">'+pips+'</span></div>'
      +'<div class="mobj">'+u.desc+'</div><div class="mstats">Per level: '+u.per+'</div><div class="mrew">'+foot+'</div>';
    if(afford)card.onclick=()=>{if(buyUpgrade(u)){sfx('lock');renderHangar();}};
    upList.appendChild(card);
  });
}
function renderHangar(){
  hgParts.textContent=PROG.parts;hgCredits.textContent=PROG.credits.toLocaleString();
  if(hgTab==='up'){renderUpgrades();return;}
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
  bfThumb.style.backgroundImage='url('+renderShipThumb(shipById(PROG.ship))+')';
  bfShipName.textContent=curShip.name;bfShipRole.textContent=curShip.role;
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
  const prevBest=PROG.completed[m.id]?PROG.completed[m.id].score:0;
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
  const fmtT=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
  const newBest=win&&prevBest>0&&S.score>prevBest;
  dbStats.innerHTML=[[S.score.toLocaleString(),newBest?'New best':'Score'],[S.kills,'Hostiles'],[fmtT(S.time),'Time'],
    ['x'+S.comboMax,'Best combo'],[Math.max(0,Math.min(100,Math.round(S.hull)))+'%','Hull']]
    .map(([v,l],i)=>'<div'+(i===0&&newBest?' class="best"':'')+'><b>'+v+'</b>'+l+'</div>').join('');
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

/* ---- keyboard on menus: Esc goes back, Enter takes the screen's main action ---- */
const MENU_KEYS={
  missionSelect:{back:()=>{S.mode='menu';showScreen('menu');},go:()=>{const m=nextMission();if(m)openBriefing(m);}},
  briefing:{back:openMissions,go:()=>launchMission(S.briefM)},
  hangar:{back:()=>closeHangar()},
  debrief:{back:openMissions,go:()=>{const b=dbBtns.querySelector('button');if(b)b.click();}},
  menu:{go:openMissions},
  endWin:{back:()=>toMenu(),go:()=>startGame()},
  endDead:{back:()=>toMenu(),go:()=>startGame()},
};
function menuKey(code){
  if(controlsOpen()){if(code==='Escape')closeControls();return true;}
  const id=SCR.find(s=>s!=='pause'&&s!=='settings'&&!$(s).classList.contains('hidden'));
  const k=id&&MENU_KEYS[id];if(!k)return false;
  if(code==='Escape'&&k.back){k.back();return true;}
  if(code==='Enter'&&k.go){k.go();return true;}
  return false;
}
renderMenu();
