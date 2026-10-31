"use strict";
/* Command center: the campaign hub aboard the carrier HALCYON, between the title screen and the sortie
   board. Stations down the left (sortie board, fleet, hangar, campaign log) in the hangar layout: hover or
   focus previews a station in the panel, a click locks it in, and the panel button opens it. Next op goes
   straight to the next uncleared op's briefing. The fleet record it shows is written by recordFleet(). */

const CC_STATIONS=[
  {id:'ops',name:'Sortie board',sub:'Pick an op',ico:'◎'},
  {id:'map',name:'Sector map',sub:'Strike a target first',ico:'⌖',when:()=>sectorOpen()},   // js/sector.js, once Broadside is cleared
  {id:'hangar',name:'Ship',sub:'Hull and ship upgrades',ico:'⌂'},   // the hangar: step 2 of the launch strip
  {id:'fleet',name:'Fleet',get sub(){return sectorOpen()?'Repairs, pilots, fleet upgrades':'Wing and carrier upgrades';},ico:'✦'},   // fleet management (js/dock.js) joins it with the sector map
  {id:'log',name:'Campaign log',sub:'Ops record',ico:'≡'},
];
const CC_PILOTS=[   // callsigns from js/wingmen.js: the first two fly your wing, the rest wait in HALCYON's reserve
  {c:WING_CALLSIGNS[0],role:'Wing · left'},{c:WING_CALLSIGNS[1],role:'Wing · right'},
  {c:WING_CALLSIGNS[2],role:'Reserve'},{c:WING_CALLSIGNS[3],role:'Reserve'},
];
const ccStations=()=>CC_STATIONS.filter(st=>!st.when||st.when());
let ccSel='ops';    // station locked in by a click: the one the panel button opens
let ccPeek=null;    // station under the pointer or focus: previewed in the panel only
function openCommand(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  renderCommand();showScreen('command');}
const ccFleet=()=>Object.assign({pilots:{},halcyon:{ops:0,hull:100}},PROG.fleet);
/* hull and ship upgrades in reach right now (the hangar's own count) */
const ccShipBuyable=()=>UPGRADES.filter(u=>{const l=PROG.upgrades[u.id]||0;return l<u.costs.length&&PROG.credits>=u.costs[l];}).length
  +SHIPS.filter(s=>hullState(s).afford).length;
/* does this op fly with Pike and Lark? */
const ccWingFlies=m=>m.sector==='arena'&&m.wingmen!==false&&rankLevel()>=1;
function ccChip(id){
  const nm=nextMission(),cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
  if(id==='ops')return nm?'<span class="chip next">▸ '+nm.name+'</span>':'<span class="chip ok">✓ All clear</span>';
  if(id==='fleet'){const h=dockHurt().length;if(h)return '<span class="chip next">'+h+' to repair</span>';const n=fleetBuyable()+dockRefitsBuyable();return n?'<span class="chip next">'+n+' upgrade'+(n>1?'s':'')+'</span>':'<span class="chip">'+(nm&&!ccWingFlies(nm)?'Wing on standby':'Wing ready')+'</span>';}
  if(id==='hangar')return '<span class="chip">'+curShip.name+'</span>';
  if(id==='map'){const L=sectorChoice();return L?'<span class="chip next">'+sectorTargets(L.id).length+' targets</span>':'<span class="chip">HALCYON '+Math.round(sectorHull('HALCYON')*100)+'%</span>';}
  return '<span class="chip'+(cleared===MISSIONS.length?' ok':'')+'">'+cleared+' / '+MISSIONS.length+'</span>';
}
function renderCommand(){
  dkCardsHome();ccBack.textContent=hubWalk()?'Deck':'Back';   // js/deck.js: its cards come home, and Back returns to the deck when that is the hub
  ccCredits.textContent=PROG.credits.toLocaleString();ccParts.textContent=PROG.parts;
  ccList.innerHTML='';ccPeek=null;
  if(!ccStations().some(st=>st.id===ccSel))ccSel='ops';
  ccStations().forEach((st,i)=>{
    const row=document.createElement('button');row.id='ccRow_'+st.id;
    row.className='hgrow'+(st.id===ccSel?' sel':'');
    row.style.setProperty('--i',i);
    row.innerHTML='<i>'+st.ico+'</i><div><b>'+st.name+'</b><span>'+st.sub+'</span></div>'+ccChip(st.id);
    row.onmouseenter=row.onfocus=()=>peekStation(st.id);row.onclick=()=>selectStation(st.id);
    ccList.appendChild(row);
  });
  const nm=nextMission();
  ccStartName.textContent=nm?nm.name:'Sortie board';ccStart.firstChild.textContent=sectorChoice()?'Pick a target':nm?'Brief and launch':'All ops clear';
  ccRoomApply();ccReadyDraw();
  renderStationPanel();
  command.classList.remove('play');void command.offsetWidth;command.classList.add('play');
  ccIntroShow();ccAcademyShow();ccPromoShow();
}
/* Quarters grow with rank (STAGE_ROOMS in js/stage.js). A fresh promotion keeps the old room behind the promotion
   screen and the new one is revealed when it is acknowledged. */
const ccQuartersLevel=()=>Math.min(rankLevel(),PROG.rankSeen);
function ccRoomApply(){
  const l=ccQuartersLevel(),R=RANKS[l];
  ccRank.textContent=RANKS[rankLevel()].name;ccLabel.textContent='HALCYON · '+R.room+' · on station';
  command.className=command.className.replace(/\brk\d\b/g,'').trim()+' rk'+l;
}
/* The strip under the stations walks the loop: target, loadout (ship, then fleet), brief. Each step is a button and shows
   what is waiting there; the big button after it goes to the briefing, or to the target pick while one is open. */
function ccReadyDraw(){
  const L=sectorChoice(),hurt=dockHurt().length,fb=fleetBuyable()+dockRefitsBuyable(),sb=ccShipBuyable();
  const steps=[];
  if(sectorOpen()){const lg=sectorLeg(),P=lg&&sectorPicked(lg.id);
    steps.push(['Target',L?'Pick one':P?'✓ '+P.name:'Skipped',L?'todo':'done',openSector]);}
  steps.push(['Ship',curShip.name+(sb?' · '+sb+' to buy':''),sb?'todo':'done',()=>openHangar('command')]);
  steps.push(['Fleet',hurt?hurt+' to repair':fb?fb+' upgrade'+(fb>1?'s':''):'Ready',hurt||fb?'todo':'done',()=>selectStation('fleet')]);
  ccSteps.innerHTML='';
  steps.forEach(([k,v,st,fn],i)=>{const b=document.createElement('button');b.className='ccstep '+st;
    b.innerHTML='<small>'+(i+1)+' · '+k+'</small><span>'+v+'</span>';b.onclick=fn;ccSteps.appendChild(b);});
}
function selectStation(id){
  ccSel=id;ccPeek=null;
  for(const r of ccList.children){r.classList.toggle('sel',r.id==='ccRow_'+id);r.classList.remove('peek');}
  renderStationPanel();
}
function peekStation(id){
  ccPeek=id===ccSel?null:id;
  for(const r of ccList.children)r.classList.toggle('peek',r.id==='ccRow_'+ccPeek);
  renderStationPanel();
}
ccList.onmouseleave=()=>{if(ccPeek)peekStation(null);};
/* a progress bar line: label, filled fraction, readout */
const ccBar=(label,k,txt)=>'<div class="hgstat"><span>'+label+'</span><div class="hgbar"><i style="width:'+Math.round(k*100)+'%"></i></div><b>'+txt+'</b></div>';
/* one unit card in the fleet list: name, role, status chip and its record */
const ccUnit=(name,role,status,cls,rec)=>'<div class="ccunit"><div><b>'+name+'</b><span>'+role+'</span></div>'
  +'<em class="'+(cls||'')+'">'+status+'</em><small>'+rec+'</small></div>';
/* Fleet station, Upgrades subtab: HALCYON and wing upgrades (js/data/fleet.js), bought right in the panel */
let ccFleetTab='status';   // subtab of the Fleet station: 'status' or 'upgrades'
const fleetPrice=u=>{const l=fleetLevel(u.id);return l>=u.costs.length?null:u.costs[l];};
const fleetCanBuy=u=>{const c=fleetPrice(u);return c!==null&&PROG[u.cur]>=c;};
const fleetBuyable=()=>FLEET_UPGRADES.filter(fleetCanBuy).length;
const fleetCost=(u,c)=>c.toLocaleString()+(u.cur==='parts'?' ◆':' cr');
function ccRefitRow(u){
  const l=fleetLevel(u.id),max=u.costs.length,c=fleetPrice(u);
  return '<div class="ccup'+(c===null?' maxed':'')+'" title="'+u.desc.replace(/"/g,'&quot;')+'"><div><b>'+u.name+'</b><span>'+u.per+'</span><small>'+u.desc+'</small></div>'
    +'<div class="ccpips">'+'<i class="on"></i>'.repeat(l)+'<i></i>'.repeat(max-l)+'</div>'
    +(c===null?'<em class="ok">Maxed</em>':'<button class="btn alt ccbuy" data-up="'+u.id+'"'+(fleetCanBuy(u)?'':' disabled')+'>'+fleetCost(u,c)+'</button>')+'</div>';
}
function ccBuyFleet(id){
  const u=FLEET_UPGRADES.find(x=>x.id===id);
  if(!u||!buyFleetUpgrade(u))return;
  sfx('acquire');renderCommand();
}
const ccUpgradeRows=g=>FLEET_UPGRADES.filter(u=>u.group===g).sort((a,b)=>(fleetPrice(a)===null)-(fleetPrice(b)===null)).map(ccRefitRow).join('');   // maxed ones sink to the bottom
/* wing and HALCYON upgrades, then each destroyer's refits once the sector map opens (js/dock.js) */
function ccUpgradesBody(){
  const lv=FLEET_UPGRADES.reduce((n,u)=>n+fleetLevel(u.id),0),max=FLEET_UPGRADES.reduce((n,u)=>n+u.costs.length,0);
  return '<div class="hgstats">'+ccBar('Upgrades',lv/max,lv+' / '+max)+'</div>'
    +'<div class="hgfacts">'+hgFacts([['Balance',PROG.credits.toLocaleString()+' cr · '+PROG.parts+' ◆','amber']])+'</div>'
    +'<div class="ccgrp">Wingmen · credits</div>'+ccUpgradeRows('wing')+'<div class="ccgrp">HALCYON · parts</div>'+ccUpgradeRows('carrier')+dockRefitBody();
}
const ccTabs=()=>'<div class="cctabs">'+[['status','Status'],['upgrades','Upgrades']].map(([id,n])=>
  '<button class="cctab'+(ccFleetTab===id?' on':'')+'" data-tab="'+id+'">'+n+'</button>').join('')+'</div>';
const CC_PANEL={
  ops(){
    const nm=nextMission(),cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
    const nr=rankLevel()<RANKS.length-1?RANKS[rankLevel()+1]:null;
    const chip=(l,v,c)=>'<div class="ccchip'+(c?' '+c:'')+'"><small>'+l+'</small>'+v+'</div>';
    return {role:'Sortie board',name:nm?nm.name:'All Ops Cleared',
      desc:nm?nm.brief[0].split(/(?<=[.!?])\s+/)[0]:'Every op is down. Replay any of them from the sortie board for a better score and bonuses you missed.',
      body:'<div class="ccseg" title="'+cleared+' of '+MISSIONS.length+' ops cleared">'+MISSIONS.map(m=>'<i class="'+(PROG.completed[m.id]?'on':nm&&m.id===nm.id?'next':'')+'"></i>').join('')+'</div>'
        +(nm?'<div class="ccobj"><span class="tag">Objective</span>'+nm.objective+'</div><div class="ccchips">'
          +chip('Sector',nm.sector==='arena'?'Open space':nm.interior?'Capital interior':'Trench')
          +chip('Wing',ccWingFlies(nm)?'Pike · Lark':'Solo')
          +chip('Rank',RANKS[rankLevel()].name)
          +chip('Payout',nm.reward.credits+' cr'+(nm.reward.parts?' + '+nm.reward.parts+' ◆':''),'amber')+'</div>'
          +(nr?'<div class="cchint">Next rank: '+nr.name+' after '+missionById(nr.after).name+'</div>':''):''),
      action:['Open sortie board',openMissions]};
  },
  fleet(){
    const F=ccFleet(),nm=nextMission(),H=F.halcyon,open=sectorOpen();
    let html=open?'<div class="ccgrp">Pilots</div>':ccUnit('HALCYON','Carrier · home','On station','ok',   // with the sector map open, HALCYON has a ship row above
      H.ops?H.ops+' defence'+(H.ops>1?'s':'')+' flown · hull '+H.hull+'% after the last':'Fleet reserve '+CARRIER_TYPE.reserve+' fighters');
    for(const P of CC_PILOTS){
      const R=F.pilots[P.c],wing=P.role!=='Reserve',flies=wing&&nm&&ccWingFlies(nm);
      const status=wing?(flies?'Next op':nm?'Standby':'Ready'):'Standby';
      const rec=!R?'No sorties yet':R.sorties+' sortie'+(R.sorties>1?'s':'')+' · shot down '+R.downs+'×'+(R.last==='down'?' · ejected last op, back on the roster':'');
      html+=ccUnit(P.c,P.role,status,flies?'next':'',rec);
    }
    if(ccFleetTab==='upgrades')return {role:'Fleet upgrades',name:'Halcyon Group',
      desc:open?'Wing, HALCYON and destroyer upgrades. Hover a row for details.':'Better wingmen and a tougher HALCYON. Hover a row for details.',
      body:ccTabs()+ccUpgradesBody(),action:null};
    return {role:'Fleet status',name:'Halcyon Group',
      desc:open?'Repair your ships and recruit more. Captains rank up with every battle they survive.':'Your carrier and the pilots it carries. '+(!nm?'The wing flies with you on any arena op you replay.'
        :ccWingFlies(nm)?'Pike and Lark fly '+nm.name+' with you; if one goes down, a reserve pilot launches from the bay.'
        :nm.name+' is a solo op: the wing stays aboard.'),
      body:ccTabs()+(open?dockShipsBody():'')+'<div class="cclist">'+html+'</div>'+(open?dockRecruitBody():''),action:null};
  },
  hangar(){
    const ups=UPGRADES.reduce((n,u)=>n+(PROG.upgrades[u.id]||0),0),upMax=UPGRADES.reduce((n,u)=>n+u.costs.length,0);
    const buy=ccShipBuyable();
    return {role:'Hangar · '+curShip.role,name:curShip.name,desc:curShip.desc,
      body:'<div class="hgstats">'+ccBar('Hulls owned',PROG.shipsOwned.length/SHIPS.length,PROG.shipsOwned.length+' / '+SHIPS.length)
        +ccBar('Upgrades',ups/upMax,ups+' / '+upMax)+'</div>'
        +'<div class="hgfacts">'+hgFacts([['Balance',PROG.credits.toLocaleString()+' cr · '+PROG.parts+' ◆','amber'],
          ['Workshop',buy?buy+' upgrade'+(buy>1?'s':'')+' or hulls in reach':'Nothing affordable yet']])+'</div>',
      action:['Open hangar',()=>openHangar('command')]};
  },
  map(){
    const L=sectorLeg(),P=L&&sectorPicked(L.id);
    return {role:'Sector map',name:'The Kiru Road',
      desc:'Strike one target before each op, or skip it. Fleet damage carries into the next battle.',
      body:'<div class="hgstats">'+dockFleet().map(n=>ccBar(n,sectorHull(n),Math.round(sectorHull(n)*100)+'%')).join('')+'</div>'
        +(L?'<div class="hgfacts">'+hgFacts([['Next op',L.name],['Target',P?'✓ '+P.name:sectorTargets(L.id).map(o=>o.name).join(' or ')||'None',P?'amber':'']])+'</div>':''),
      action:['Open sector map',openSector]};
  },
  log(){
    const cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
    let bon=0,bonN=0;
    const rows=MISSIONS.map((m,i)=>{const d=PROG.completed[m.id],n=(m.bonuses||[]).length;bonN+=n;if(d)bon+=d.bonuses||0;
      return ['0'+(i+1)+' '+m.name,d?'✓ '+d.score.toLocaleString()+(n?' · '+(d.bonuses||0)+'/'+n+' bonus':''):isUnlocked(m)?'Open':'Classified',d?'amber':''];});
    return {role:'Campaign log',name:'Ops Record',
      desc:cleared+' of '+MISSIONS.length+' ops cleared, '+bon+' of '+bonN+' bonus objectives earned. Best scores per op.',
      body:'<div class="hgfacts cclog">'+hgFacts(rows)+'</div>'+ccCutsBody(),action:null};
  },
};
/* the story cutscenes you have seen, to watch again (js/cutscene.js) */
function ccCutsBody(){
  const seen=CUTSCENES.filter(c=>PROG.cuts[c.id]);
  return seen.length?'<div class="cccuts"><small>Cutscenes</small>'+seen.map(c=>'<button class="btn ghost" data-cut="'+c.id+'">'+c.card[1]+'</button>').join('')+'</div>':'';
}
function renderStationPanel(){
  const P=CC_PANEL[ccPeek||ccSel]();
  ccPanel.classList.remove('swap');void ccPanel.offsetWidth;ccPanel.classList.add('swap');
  ccRole.textContent=P.role;ccName.textContent=P.name;ccDesc.textContent=P.desc;ccBody.innerHTML=P.body;
  ccBody.querySelectorAll('.cctab').forEach(b=>b.onclick=()=>{ccFleetTab=b.dataset.tab;renderStationPanel();});
  ccBody.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>ccBuyFleet(b.dataset.up));
  ccBody.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>dockAct(b.dataset.dock));   // js/dock.js
  ccBody.querySelectorAll('[data-cut]').forEach(b=>b.onclick=()=>cutPlay(b.dataset.cut));
  const A=CC_PANEL[ccSel]().action;   // the button belongs to the locked-in station, not the previewed one
  ccAction.style.display=ccPeek||A?'':'none';
  ccAction.textContent=ccPeek?'Click to select':A?A[0]:'';ccAction.disabled=!!ccPeek;
}
ccAction.onclick=()=>{const A=CC_PANEL[ccSel]().action;if(A)A[1]();};
ccStart.onclick=()=>{const nm=nextMission();if(sectorChoice())openSector();else if(nm)openBriefing(nm,'command');else openMissions();};   // targets up on the sector map: pick or skip there first
function ccLeave(){if(hubWalk())openDeck();else{S.mode='menu';showScreen('menu');}}
ccBack.onclick=ccLeave;

/* Promotion screen: shown over the command center the first time a new rank is reached, then marked seen */
function ccPromoShow(){
  const l=rankLevel();
  if(PROG.rankSeen>=l){ccPromo.classList.add('hidden');return;}
  const R=RANKS[l];
  ccPromoRank.textContent=R.name;ccPromoAbbr.textContent=R.abbr;ccPromoGives.textContent=R.gives;ccPromoVox.innerHTML=voxHtml([R.vox]);ccPromoQ.textContent='Quarters: '+R.quarters;
  ccPromo.classList.remove('hidden');sfx('acquire');
}
ccPromoOk.onclick=()=>{PROG.rankSeen=rankLevel();saveProg();ccPromo.classList.add('hidden');ccRoomApply();};

/* First visit: who you are and why HALCYON matters (story.js INTRO), shown once over the command center */
function ccIntroShow(){
  if(PROG.introSeen){ccIntro.classList.add('hidden');return;}
  ccIntroTitle.textContent=INTRO.title;ccIntroText.innerHTML=INTRO.lines.map(l=>'<p>'+l+'</p>').join('');
  ccIntro.classList.remove('hidden');
}
ccIntroOk.onclick=()=>{PROG.introSeen=true;saveProg();ccIntro.classList.add('hidden');ccAcademyShow();ccPromoShow();};

/* Flight school as the campaign's first step: a new pilot is offered the two-drill basic course (js/school.js ACADEMY_COURSE)
   once, after the intro; skipping it, or finishing it, sets PROG.academy. A short "cleared" card follows the course. */
function ccAcademyShow(){
  const done=academyJustDone;
  if(!PROG.introSeen||(PROG.academy&&!done)){ccAcademy.classList.add('hidden');return;}
  ccAcTitle.textContent=done?'Cleared to fly':'Flight school';
  ccAcText.textContent=done?'You are cleared for operations. Your first op is on the board.':'Two short drills: a controls tour, then a ring run. Skip it if you know the ship.';
  ccAcGo.textContent=done?'Carry on':'Start flight school';
  ccAcSkip.style.display=done?'none':'';
  ccAcademy.classList.remove('hidden');
}
ccAcGo.onclick=()=>{if(academyJustDone){academyJustDone=false;ccAcademy.classList.add('hidden');ccPromoShow();}else academyStart();};
ccAcSkip.onclick=()=>{PROG.academy='skip';saveProg();ccAcademy.classList.add('hidden');ccPromoShow();};
