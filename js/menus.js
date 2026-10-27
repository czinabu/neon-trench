"use strict";
/* Full-screen menus: mission select, hangar, briefing, debrief. */

/* one place to flip between the full-screen menus (hud always off while shown) */
const SCR=['menu','command','missionSelect','school','briefing','debrief','hangar','roadmap','saves','endWin','endDead','pause','settings','controls'];
function showScreen(id){for(const s of SCR)$(s).classList.toggle('hidden',s!==id);
  if(id==='menu')renderMenu();
  $('hud').classList.remove('on');$('cockHud').classList.remove('on');
  $('mslLock').style.display='none';$('tgtBox').style.display='none';$('speed').style.opacity=0;}
function openMissions(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  renderMissions();showScreen('missionSelect');}
/* the first unlocked mission not yet cleared: what the campaign button and the sortie board point you at */
const nextMission=()=>MISSIONS.find(m=>isUnlocked(m)&&!PROG.completed[m.id])||null;
/* ---- title screen: the modes down the left; the highlighted one picks the 3D backdrop (js/stage.js)
   and fills the info panel. Free Trench and Free Dogfight open once the whole campaign is cleared. ---- */
const MENU_MODES=['campaign','school','trench','arena','hangar'];
const MENU_BTN={campaign:campaignBtn,trench:launchBtn,arena:arenaBtn,hangar:hangarBtn,school:schoolBtn};
let menuSel='campaign';
const freeLocked=m=>(m==='trench'||m==='arena')&&!campaignDone();
const MODE_INFO={
  campaign:(c,nm)=>({tag:'// story operations',title:'Campaign',
    desc:'Operations against the Helios-Kiru syndicate, run from the command center aboard the carrier HALCYON: trench strikes, dogfights, capital ship kills, a run inside their flagship, fleet battles and the push on the Kiru Gate. Every clear pays credits and parts.',
    facts:[[c+' / '+MISSIONS.length,'Ops cleared'],[nm?nm.name:'All clear','Next op']]}),
  trench:c=>({tag:'// score attack',title:'Free Trench',
    desc:'The reactor trench with no mission wrapper. Thread the beam gates, gun down turrets and fighters, and put a torpedo in the core for a best score.',
    facts:campaignDone()?[[BEST.score.toLocaleString(),'Best score'],['Trench','Sector']]:[[c+' / '+MISSIONS.length,'Campaign ops'],['Locked','Clear Acts I to III to fly']]}),
  arena:c=>({tag:'// open space',title:'Free Dogfight',
    desc:'Open space above the arcology. Waves of line fighters, darts and missile hunters. Clear the zone and keep your combo alive.',
    facts:campaignDone()?[[BEST.score.toLocaleString(),'Best score'],['Open space','Sector']]:[[c+' / '+MISSIONS.length,'Campaign ops'],['Locked','Clear Acts I to III to fly']]}),
  hangar:()=>({tag:'// ships and upgrades',title:'Hangar',
    desc:'Unlock new hulls with parts, upgrade your systems with credits, and choose the ship you fly into every sortie.',
    facts:[[curShip.name,'Flying'],[PROG.shipsOwned.length+' / '+SHIPS.length,'Hulls owned'],[PROG.credits.toLocaleString(),'Credits'],[PROG.parts,'Parts']]}),
  school:()=>({tag:'// academy range',title:'Flight school',
    desc:'A controls tour and graded drills in the academy range. Learn the ship before you fly it into a trench.',
    facts:[[SCHOOL_LESSONS.length,'Lessons'],[SCHOOL_LESSONS.filter(L=>PROG.school&&PROG.school[L.id]).length+' / '+SCHOOL_LESSONS.length,'Done']]}),
};
function renderMenu(){
  const cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length,nm=nextMission();
  campaignNext.textContent=nm?RANKS[rankLevel()].abbr+' · '+(cleared?'Next op · ':'Start · ')+nm.name:'All ops cleared · replay any';
  for(const m of ['trench','arena']){const lock=freeLocked(m);MENU_BTN[m].classList.toggle('locked',lock);
    (m==='trench'?launchNote:arenaNote).textContent=lock?'Locked · finish Act III':BEST.score?'Best '+BEST.score.toLocaleString():'Score attack';}
  hangarNote.textContent='Flying '+curShip.name;
  schoolNote.textContent='Controls tour · graded drills';
  pilotLine.innerHTML='<span><b>'+cleared+' / '+MISSIONS.length+'</b> ops cleared</span><span><b>'+PROG.credits.toLocaleString()
    +'</b> cr</span><span>◆ <b>'+PROG.parts+'</b> parts</span><span>Flying <b>'+curShip.name+'</b></span>';
  stageShowHull(PROG.ship);
  selectMode(menuSel);
  syncFullscreenUI();
}
function selectMode(m){
  menuSel=m;stagePick(m);
  for(const k of MENU_MODES)MENU_BTN[k].classList.toggle('sel',k===m);
  const cleared=MISSIONS.filter(x=>PROG.completed[x.id]).length,I=MODE_INFO[m](cleared,nextMission());
  menuInfo.dataset.mode=m;menuInfo.classList.toggle('locked',freeLocked(m));
  miTag.textContent=I.tag;miTitle.textContent=I.title;miDesc.textContent=I.desc;
  miFacts.innerHTML=I.facts.map(([v,l])=>'<div><b>'+v+'</b>'+l+'</div>').join('');
}
function activateMode(m){
  selectMode(m);
  if(freeLocked(m)){const b=MENU_BTN[m];b.classList.remove('deny');void b.offsetWidth;b.classList.add('deny');return;}
  if(m==='campaign')openCommand();
  else if(m==='hangar')openHangar('menu');
  else if(m==='school')openSchool();
  else{S.mission=null;startGame(m);}   // free flight: no mission wrapper
}
for(const m of MENU_MODES){const b=MENU_BTN[m];
  b.onmouseenter=b.onfocus=()=>selectMode(m);b.onclick=()=>activateMode(m);}
menuFsBtn.onclick=pauseFsBtn.onclick=toggleFullscreen;
/* ---- sortie board and flight school: title rows on the left, the hovered or selected entry's details
   on the right, the same pattern as the hangar. Hover or focus previews, click selects, the panel button goes. ---- */
let msSel=null;    // mission id locked in by a click: the one Start and Enter act on
let msPeek=null;   // mission id under the pointer or focus: previewed in the panel only
const hgFacts=rows=>rows.filter(Boolean).map(([l,v,c])=>'<div class="hgfact">'+l+'<b'+(c?' class="'+c+'"':'')+'>'+v+'</b></div>').join('');
function renderMissions(){
  msCredits.textContent=PROG.credits.toLocaleString();msParts.textContent=PROG.parts;
  msList.innerHTML='';msPeek=null;
  const nm=nextMission();
  if(!msSel||!missionById(msSel))msSel=(nm||MISSIONS[0]).id;
  MISSIONS.forEach((m,i)=>{
    const un=isUnlocked(m),done=PROG.completed[m.id],isNext=m===nm;
    const row=document.createElement('button');row.id='msRow_'+m.id;
    row.className='hgrow'+(m.id===msSel?' sel':'')+(done?' done':'')+(un?'':' locked');
    const chip=done?'<span class="chip ok">✓ Cleared</span>':isNext?'<span class="chip next">▸ Next</span>':un?'<span class="chip">Open</span>':'<span class="chip">Locked</span>';
    row.innerHTML='<i>0'+(i+1)+'</i><div><b>'+m.name+'</b><span>'+m.sub+'</span></div>'+chip;
    row.onmouseenter=row.onfocus=()=>peekMission(m.id);row.onclick=()=>selectMission(m.id);
    msList.appendChild(row);
  });
  renderMissionPanel();
}
function selectMission(id){
  msSel=id;msPeek=null;
  for(const r of msList.children){r.classList.toggle('sel',r.id==='msRow_'+id);r.classList.remove('peek');}
  renderMissionPanel();
}
function peekMission(id){
  msPeek=id===msSel?null:id;
  for(const r of msList.children)r.classList.toggle('peek',r.id==='msRow_'+msPeek);
  renderMissionPanel();
}
msList.onmouseleave=()=>{if(msPeek)peekMission(null);};
function renderMissionPanel(){
  const m=missionById(msPeek||msSel),un=isUnlocked(m),done=PROG.completed[m.id],req=missionById(m.req);
  msRole.textContent=m.sub;msName.textContent=m.name;
  msDesc.textContent=un?m.objective:'Classified. Clear '+(req?req.name:'the previous op')+' to unlock.';
  const bonusN=(m.bonuses||[]).length;
  msFacts.innerHTML=un?hgFacts([
    ['Sector',m.sector==='arena'?'Open space':m.interior?'Capital interior':'Trench'],
    m.sector==='arena'?['Wing',m.wingmen===false?'Solo':'Pike and Lark']:null,
    ['Payout',m.reward.credits+' cr'+(m.reward.parts?' + '+m.reward.parts+' ◆':''),'amber'],
    ['Bonuses',bonusN?(done?(done.bonuses||0)+' / '+bonusN+' earned':bonusN+' available'):'None'],
    done?['Best',done.score.toLocaleString()+' · replay pays half','amber']:null,
  ]):'';
  const cur=missionById(msSel);
  msAction.textContent=msPeek?(un?'Click to select':'Locked'):!un?'Locked':done?'Replay briefing':'Open briefing';
  msAction.disabled=!!msPeek||!un;
  msStart.disabled=!isUnlocked(cur);
}
msStart.onclick=()=>{const m=missionById(msSel);if(m&&isUnlocked(m))launchMission(m);};   // straight in, skipping the briefing
msAction.onclick=()=>{const m=missionById(msSel);if(m&&isUnlocked(m))openBriefing(m,'missions');};
/* ---- hangar: the hull list on the left; the selected hull revolves on the right (js/stage.js) with
   its stats, and is unlocked or equipped from there ---- */
let hangarFrom='menu';   // the briefing's "Change hull" comes back to the briefing, the command center's hangar to it
let hgSel='s1';          // the hull shown on the right
function openHangar(from){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  hangarFrom=from==='briefing'||from==='command'?from:'menu';hgSel=PROG.ship;renderHangar();showScreen('hangar');}
function closeHangar(){if(hangarFrom==='briefing')openBriefing(S.briefM);else if(hangarFrom==='command')openCommand();else{S.mode='menu';showScreen('menu');}}
/* ---- roadmap: the groups in js/data/roadmap.js, one card each ---- */
function openRoadmap(){
  rmList.innerHTML=ROADMAP.map(g=>'<div class="rmarea rm-'+g.key+'"><div class="rmhead">'+g.name+'</div>'+(g.note?'<div class="rmnote">'+g.note+'</div>':'')
    +g.items.map(i=>'<div class="rmitem'+(i.d?' tip':'')+'"'+(i.d?' tabindex="0"':'')+'><b>'+i.t+'</b>'+(i.d?'<div class="rmd">'+i.d+'</div>':'')+'</div>').join('')+'</div>').join('');
  showScreen('roadmap');rmList.scrollTop=0;
}
rmList.onclick=e=>{const it=e.target.closest('.rmitem.tip');if(!it)return;const o=it.classList.contains('open');rmList.querySelectorAll('.rmitem.open').forEach(x=>x.classList.remove('open'));if(!o)it.classList.add('open');};
rmBack.onclick=()=>showScreen('menu');
roadmapBtn.onclick=openRoadmap;
/* ---- controls reference: opened from the title or the pause screen, returns to whichever. A card per section from
   js/data/controls.js; hover, focus or click a row for its tip in a floating box ---- */
let controlsFrom='menu';
function openControls(from){controlsFrom=from;$(from).classList.add('hidden');$('controls').classList.remove('hidden');renderControls();}
function closeControls(){hideControlTip();$('controls').classList.add('hidden');$(controlsFrom).classList.remove('hidden');}
const controlsOpen=()=>!$('controls').classList.contains('hidden');
function renderControls(){
  ctlGrid.innerHTML='';
  for(const g of CONTROLS){
    const card=document.createElement('div');card.className='ctlcard';
    card.innerHTML='<div class="ctlhead">'+g.name+'</div>';
    for(const it of g.items){
      const row=document.createElement('div');row.className='ctlrow'+(it.k?'':' tiponly');row.tabIndex=0;
      const keys=it.k?'<div class="ctlkeys">'+it.k.split(' · ').map(k=>'<kbd>'+k+'</kbd>').join('<i>/</i>')+'</div>':'';
      row.innerHTML=keys+'<div class="ctlact">'+it.a+(it.t?'<u>i</u>':'')+'</div>';
      row.onmouseenter=row.onfocus=()=>showControlTip(row,it);
      row.onmouseleave=row.onblur=hideControlTip;
      row.onclick=()=>{row.classList.contains('open')?hideControlTip():showControlTip(row,it);};   // touch has no hover
      card.appendChild(row);
    }
    ctlGrid.appendChild(card);
  }
  ctlGrid.scrollTop=0;
}
function showControlTip(row,it){
  hideControlTip();row.classList.add('open');
  ctlTipBox.textContent=it.t||'';
  const r=row.getBoundingClientRect(),w=Math.min(320,innerWidth*.86);
  ctlTipBox.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
  ctlTipBox.style.top=Math.min(r.bottom+4,innerHeight-90)+'px';
  ctlTipBox.classList.add('on');
}
function hideControlTip(){ctlTipBox.classList.remove('on');for(const r of ctlGrid.querySelectorAll('.open'))r.classList.remove('open');}
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
function hullState(s){const owned=PROG.shipsOwned.includes(s.id);
  return {owned,equipped:PROG.ship===s.id,afford:!owned&&PROG.parts>=s.cost};}
/* [label, stat from a hull's numbers, the value that fills the bar, readout] */
const relPct=v=>{const p=Math.round((v-1)*100);return p===0?'Base':(p>0?'+':'')+p+'%';};
const HULL_STATS=[
  ['Speed',s=>s.spdMul,1.4,relPct],['Acceleration',s=>s.accelMul,1.4,relPct],['Agility',s=>s.turnMul,1.4,relPct],
  ['Firepower',s=>s.dmgMul/s.rofMul,2.2,relPct],['Armor',s=>1/s.armorMul,2,relPct],
  ['Boost recharge',s=>s.boostRegenMul,2,relPct],['Missiles',s=>MSL_START+s.mslBonus,MSL_MAX+2,v=>v],
];
function renderHangar(){
  hgParts.textContent=PROG.parts;hgCredits.textContent=PROG.credits.toLocaleString();
  if(hgTab==='up')renderUpgrades();
  else{
    hgList.innerHTML='';
    SHIPS.forEach((s,i)=>{
      const st=hullState(s),row=document.createElement('button');
      row.className='hgrow'+(s.id===hgSel?' sel':'')+(st.equipped?' eq':'')+(!st.owned&&!st.afford?' locked':'');
      const chip=st.equipped?'<span class="chip ok">★ Flying</span>':st.owned?'<span class="chip">Owned</span>'
        :'<span class="chip'+(st.afford?' next':'')+'">'+s.cost+' ◆</span>';
      row.innerHTML='<i>0'+(i+1)+'</i><div><b>'+s.name+'</b><span>'+s.role+'</span></div>'+chip;
      row.onclick=()=>{hgSel=s.id;renderHangar();};
      hgList.appendChild(row);
    });
  }
  renderHullPanel();
}
function renderHullPanel(){
  const s=shipById(hgSel),e=effectiveShip(s),st=hullState(s);
  stageShowHull(s.id);
  hgRole.textContent=s.role;hgName.textContent=s.name;hgDesc.textContent=s.desc;
  let up=false;
  hgStats.innerHTML=HULL_STATS.map(([label,f,max,fmt])=>{
    const b=f(s),v=f(e),pb=Math.min(100,b/max*100),pv=Math.min(100,v/max*100);if(pv>pb+.5)up=true;
    return '<div class="hgstat"><span>'+label+'</span><div class="hgbar"><i style="width:'+pb+'%"></i>'
      +(pv>pb+.5?'<em style="left:'+pb+'%;width:'+(pv-pb)+'%"></em>':'')+'</div><b>'+fmt(v)+'</b></div>';
  }).join('')+(up?'<div class="hgkey"><em></em>Workshop upgrades</div>':'');
  hgAction.textContent=st.equipped?'★ Flying this hull':st.owned?'Equip':st.afford?'Unlock · '+s.cost+' ◆ parts'
    :'Need '+(s.cost-PROG.parts)+' more parts';
  hgAction.disabled=st.equipped||(!st.owned&&!st.afford);
}
function hangarAction(){
  const s=shipById(hgSel),st=hullState(s);
  if(st.equipped)return;
  if(st.owned)setShip(s.id);else if(st.afford&&unlockShip(s))setShip(s.id);else return;
  sfx('lock');renderHangar();
}
hgAction.onclick=hangarAction;
function hangarNav(d){
  if(hgTab!=='hulls')return;
  const i=SHIPS.findIndex(s=>s.id===hgSel);hgSel=SHIPS[(i+d+SHIPS.length)%SHIPS.length].id;renderHangar();
}
let briefFrom='missions';   // where the briefing's Back goes: the sortie board, or the command center it was opened from
function openBriefing(m,from){
  if(from)briefFrom=from;
  S.briefM=m;showScreen('briefing');
  bfThumb.style.backgroundImage='url('+renderShipThumb(shipById(PROG.ship))+')';
  bfShipName.textContent=curShip.name;bfShipRole.textContent=curShip.role;
  bfName.textContent=m.name;bfSub.textContent=m.sub;
  const act=actOf(m.id),st=STORY[m.id];
  bfAct.textContent=act?'Act '+act.n+' · '+act.name+(act.from===m.id?' · '+act.blurb:''):'';
  bfVox.innerHTML=voxHtml(st&&st.open);
  bfBrief.innerHTML=m.brief.map(l=>'<div>'+l+'</div>').join('');
  let html='<div class="objl primary">▸ '+m.objective+'</div>';
  if(m.sector==='arena')html+='<div class="objl">'+(m.wingmen===false?'Flying solo: no wingmen':'Wingmen: Pike and Lark')+'</div>';
  (m.bonuses||[]).forEach(b=>html+='<div class="objl bonus">+ '+b.label+' <i>+'+b.credits+'cr</i></div>');
  bfObj.innerHTML=html;
  bfReward.textContent='Mission payout · '+m.reward.credits+'cr'+(m.reward.parts?' + '+m.reward.parts+' parts':'');
}
function briefBack(){if(briefFrom==='command')openCommand();else openMissions();}
function launchMission(m){S.mission=m;startGame(m.sector);}
function openDebrief(win,cause){
  const m=S.mission;
  const bonuses=(m.bonuses||[]).map(b=>({label:b.label,credits:b.credits,met:win&&evalBonus(b)}));
  let credits=0,parts=0,firstClear=false;
  const prevBest=PROG.completed[m.id]?PROG.completed[m.id].score:0;
  recordFleet(m,win);
  const rankBefore=rankLevel();
  if(win){
    const prev=PROG.completed[m.id];firstClear=!prev;
    credits=m.reward.credits||0;bonuses.forEach(b=>{if(b.met)credits+=b.credits||0;});
    if(firstClear)parts=m.reward.parts||0; else credits=Math.round(credits*.5); // repeat clears pay less, no parts
    PROG.completed[m.id]={score:Math.max(prev?prev.score:0,S.score),
      time:Math.min(prev?prev.time:1e9,S.time),
      bonuses:Math.max(prev?prev.bonuses:0,bonuses.filter(b=>b.met).length)};
    PROG.credits+=credits;PROG.parts+=parts;saveProg();
  }
  const promoted=rankLevel()>rankBefore;
  showScreen('debrief');
  const fmtT=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
  const newBest=win&&prevBest>0&&S.score>prevBest;
  dbStats.innerHTML=[[S.score.toLocaleString(),newBest?'New best':'Score'],[S.kills,'Hostiles'],[fmtT(S.time),'Time'],
    ['x'+S.comboMax,'Best combo'],[Math.max(0,Math.min(100,Math.round(S.hull)))+'%','Hull']]
    .map(([v,l],i)=>'<div'+(i===0&&newBest?' class="best"':'')+'><b>'+v+'</b>'+l+'</div>').join('');
  dbVox.innerHTML=voxHtml(win?(STORY[m.id]||{}).win:[(STORY[m.id]||{}).lose]);
  dbTitle.textContent=win?'MISSION COMPLETE':'MISSION FAILED';
  dbTitle.style.color=win?'var(--cyan)':'var(--mag)';
  dbSub.textContent=win?'// '+m.name.toLowerCase():'// '+(cause||'airframe lost');
  let html='<div class="objl '+(win?'met':'fail')+'">'+(win?'✓':'✕')+' '+m.objective+'</div>';
  bonuses.forEach(b=>html+='<div class="objl '+(b.met?'met':'miss')+'">'+(b.met?'✓':'·')+' '+b.label+' <i>+'+b.credits+'cr</i></div>');
  dbObj.innerHTML=html;
  if(win)dbReward.innerHTML='<b>+'+credits.toLocaleString()+' cr</b>'+(parts?' · <b>+'+parts+' parts</b>':'')
      +(firstClear?'':' <span class="rep">(repeat payout)</span>');
  else dbReward.innerHTML='<span class="rep">No payout — mission incomplete</span>';
  if(promoted)dbReward.innerHTML+='<br><b>PROMOTED · '+RANKS[rankLevel()].name+'</b>';
  dbTotal.textContent='Balance · '+PROG.credits.toLocaleString()+' cr · '+PROG.parts+' parts';
  dbBtns.innerHTML='';
  const mk=(label,cls,fn)=>{const b=document.createElement('button');b.className='btn'+(cls||'');b.textContent=label;b.onclick=fn;dbBtns.appendChild(b);};
  const next=win&&!promoted?MISSIONS.find(x=>x.req===m.id&&isUnlocked(x)):null;   // a promotion goes through the command center first
  if(promoted)mk('Report to command',' alt',openCommand);
  if(next)mk('Next Op',' alt',()=>openBriefing(next,'command'));
  mk('Replay',next||promoted?' ghost':' alt',()=>launchMission(m));
  if(!promoted)mk('Command',' ghost',openCommand);
}
/* ---- saves: the live progress autosaves on its own; three slots hold manual copies to load later, and New game starts over ---- */
const SAVE_SLOTS=[1,2,3],slotKey=n=>'neonTrench.slot'+n;
function readSlot(n){try{const s=JSON.parse(localStorage.getItem(slotKey(n)));return s&&s.prog&&s.prog.completed?s:null;}catch(e){return null;}}
let savesArm=null;   // the destructive button waiting for a second click: 'new' or 'load1'..'del3'
function renderSaves(){
  const done=P=>MISSIONS.filter(m=>P.completed[m.id]).length+' / '+MISSIONS.length+' ops · '+P.credits.toLocaleString()+' cr · ◆ '+P.parts;
  saveList.innerHTML=SAVE_SLOTS.map(n=>{const s=readSlot(n);
    const btn=(a,t)=>'<button class="btn ghost" data-a="'+a+n+'">'+(savesArm===a+n?'Sure?':t)+'</button>';
    return '<div class="saverow"><div class="sinfo">Slot '+n+(s?' · '+new Date(s.at).toLocaleDateString():' · empty')+'<small>'+(s?done(s.prog):'nothing saved')+'</small></div>'
      +btn('save','Save')+(s?btn('load','Load')+btn('del','Delete'):'<span></span><span></span>')+'</div>';}).join('');
  newGameBtn.textContent=savesArm==='new'?'Erase progress? Click again':'New game';
}
function openSaves(){savesArm=null;renderSaves();showScreen('saves');}
saveList.onclick=e=>{const b=e.target.closest('button');if(!b)return;
  const a=b.dataset.a,n=+a.slice(-1),kind=a.slice(0,-1),s=readSlot(n);
  if(kind==='save'&&s&&savesArm!==a){savesArm=a;return renderSaves();}   // overwriting asks first
  if(kind!=='save'&&savesArm!==a){savesArm=a;return renderSaves();}
  savesArm=null;
  if(kind==='save'){try{localStorage.setItem(slotKey(n),JSON.stringify({at:Date.now(),prog:PROG}));}catch(err){}}
  else if(kind==='del'){try{localStorage.removeItem(slotKey(n));}catch(err){}}
  else if(kind==='load'&&s){replaceProg(s.prog);return showScreen('menu');}
  renderSaves();};
newGameBtn.onclick=()=>{if(savesArm!=='new'){savesArm='new';return renderSaves();}
  savesArm=null;replaceProg(null);showScreen('menu');};
saveBack.onclick=()=>showScreen('menu');
savesBtn.onclick=openSaves;
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
  [setMaster,'master',setMasterV,pct,applyAudioLevels],
  [setMusic,'music',setMusicV,pct,applyAudioLevels],
  [setSfx,'sfx',setSfxV,pct,applyAudioLevels],
  [setFov,'fov',setFovV,v=>(v>0?'+':'')+v+'°'],
];
function syncSettingsUI(){
  for(const [el,key,out,fmt] of SET_RANGES){el.value=SETTINGS[key];out.textContent=fmt(SETTINGS[key]);}
  setInvert.checked=SETTINGS.invertY;setShake.checked=SETTINGS.shake;setQuality.value=SETTINGS.quality;setCapEvents.value=SETTINGS.capEvents;
}
for(const [el,key,out,fmt,apply] of SET_RANGES)
  el.oninput=()=>{SETTINGS[key]=parseFloat(el.value);out.textContent=fmt(SETTINGS[key]);if(apply)apply();};
setInvert.onchange=()=>{SETTINGS.invertY=setInvert.checked;};
setShake.onchange=()=>{SETTINGS.shake=setShake.checked;};
setQuality.onchange=()=>{SETTINGS.quality=setQuality.value;applyGraphics();};
setCapEvents.onchange=()=>{SETTINGS.capEvents=setCapEvents.value;};
settingsBtn.onclick=()=>openSettings('menu');
pauseSetBtn.onclick=()=>openSettings('pause');
setBack.onclick=closeSettings;

/* ---- keyboard on menus: Esc goes back, Enter takes the screen's main action, the arrows move the selection ---- */
const MENU_KEYS={
  command:{back:()=>{S.mode='menu';showScreen('menu');},go:()=>{if(ccAction.style.display!=='none')ccAction.click();},nav:d=>navList(CC_STATIONS,ccSel,d,selectStation,'ccRow_')},
  missionSelect:{back:()=>openCommand(),go:()=>msAction.click(),nav:d=>navList(MISSIONS,msSel,d,selectMission,'msRow_')},
  school:{back:()=>{S.mode='menu';showScreen('menu');},go:()=>scAction.click(),nav:d=>navList(SCHOOL_LESSONS,scSel,d,selectLesson,'scRow_')},
  briefing:{back:briefBack,go:()=>launchMission(S.briefM)},
  roadmap:{back:()=>showScreen('menu')},
  saves:{back:()=>showScreen('menu')},
  hangar:{back:()=>closeHangar(),go:()=>{if(hgTab==='hulls')hangarAction();},nav:hangarNav},
  debrief:{back:()=>openCommand(),go:()=>{const b=dbBtns.querySelector('button');if(b)b.click();}},
  menu:{go:()=>activateMode(menuSel),nav:d=>selectMode(MENU_MODES[(MENU_MODES.indexOf(menuSel)+d+MENU_MODES.length)%MENU_MODES.length])},
  endWin:{back:()=>toMenu(),go:()=>startGame()},
  endDead:{back:()=>toMenu(),go:()=>startGame()},
};
/* arrow keys step the selection in a list screen (rows are buttons: the focused one is moved with it) */
function navList(list,cur,d,pick,rowPrefix){
  const i=list.findIndex(x=>x.id===cur),n=list[(i+d+list.length)%list.length];pick(n.id);
  const r=document.getElementById(rowPrefix+n.id);if(r)r.scrollIntoView({block:'nearest'});
}
function menuKey(code){
  if(controlsOpen()){if(code==='Escape')closeControls();return true;}
  const id=SCR.find(s=>s!=='pause'&&s!=='settings'&&!$(s).classList.contains('hidden'));
  const k=id&&MENU_KEYS[id];if(!k)return false;
  if(code==='Escape'&&k.back){k.back();return true;}
  if(code==='Enter'&&k.go){k.go();return true;}
  if((code==='ArrowUp'||code==='ArrowDown')&&k.nav){k.nav(code==='ArrowUp'?-1:1);return true;}
  return false;
}
renderMenu();
