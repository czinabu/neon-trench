"use strict";
/* Command center: the campaign hub aboard the carrier HALCYON, between the title screen and the sortie
   board. Stations down the left (sortie board, fleet, hangar, campaign log) in the hangar layout: hover or
   focus previews a station in the panel, a click locks it in, and the panel button opens it. Next op goes
   straight to the next uncleared op's briefing. The fleet record it shows is written by recordFleet(). */

const CC_STATIONS=[
  {id:'ops',name:'Sortie board',sub:'Pick an op'},
  {id:'fleet',name:'Fleet',sub:'HALCYON and the wing'},
  {id:'refit',name:'Refit',sub:'Upgrade the wing and carrier'},
  {id:'hangar',name:'Hangar',sub:'Hulls and upgrades'},
  {id:'log',name:'Campaign log',sub:'Ops record'},
];
const CC_PILOTS=[   // callsigns from js/wingmen.js: the first two fly your wing, the rest wait in HALCYON's reserve
  {c:WING_CALLSIGNS[0],role:'Wing · left'},{c:WING_CALLSIGNS[1],role:'Wing · right'},
  {c:WING_CALLSIGNS[2],role:'Reserve'},{c:WING_CALLSIGNS[3],role:'Reserve'},
];
let ccSel='ops';    // station locked in by a click: the one the panel button opens
let ccPeek=null;    // station under the pointer or focus: previewed in the panel only
function openCommand(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  renderCommand();showScreen('command');}
const ccFleet=()=>Object.assign({pilots:{},halcyon:{ops:0,hull:100}},PROG.fleet);
/* does this op fly with Pike and Lark? */
const ccWingFlies=m=>m.sector==='arena'&&m.wingmen!==false;
function ccChip(id){
  const nm=nextMission(),cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
  if(id==='ops')return nm?'<span class="chip next">▸ '+nm.name+'</span>':'<span class="chip ok">✓ All clear</span>';
  if(id==='fleet')return '<span class="chip">'+(nm&&!ccWingFlies(nm)?'Wing on standby':'Wing ready')+'</span>';
  if(id==='refit'){const n=fleetBuyable();return '<span class="chip'+(n?' next':'')+'">'+(n?n+' to buy':'Refit')+'</span>';}
  if(id==='hangar')return '<span class="chip">'+curShip.name+'</span>';
  return '<span class="chip'+(cleared===MISSIONS.length?' ok':'')+'">'+cleared+' / '+MISSIONS.length+'</span>';
}
function renderCommand(){
  ccCredits.textContent=PROG.credits.toLocaleString();ccParts.textContent=PROG.parts;
  ccList.innerHTML='';ccPeek=null;
  CC_STATIONS.forEach((st,i)=>{
    const row=document.createElement('button');row.id='ccRow_'+st.id;
    row.className='hgrow'+(st.id===ccSel?' sel':'');
    row.innerHTML='<i>0'+(i+1)+'</i><div><b>'+st.name+'</b><span>'+st.sub+'</span></div>'+ccChip(st.id);
    row.onmouseenter=row.onfocus=()=>peekStation(st.id);row.onclick=()=>selectStation(st.id);
    ccList.appendChild(row);
  });
  const nm=nextMission();
  ccStart.textContent=nm?'Next op':'Sortie board';
  renderStationPanel();
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
/* Refit station: HALCYON and wing upgrades (js/data/fleet.js), bought right in the panel */
const fleetPrice=u=>{const l=fleetLevel(u.id);return l>=u.costs.length?null:u.costs[l];};
const fleetCanBuy=u=>{const c=fleetPrice(u);return c!==null&&PROG[u.cur]>=c;};
const fleetBuyable=()=>FLEET_UPGRADES.filter(fleetCanBuy).length;
const fleetCost=(u,c)=>c.toLocaleString()+(u.cur==='parts'?' ◆':' cr');
function ccRefitRow(u){
  const l=fleetLevel(u.id),max=u.costs.length,c=fleetPrice(u);
  return '<div class="ccup"><div><b>'+u.name+'</b><span>'+u.per+'</span><small>'+u.desc+'</small></div>'
    +'<div class="ccpips">'+'<i class="on"></i>'.repeat(l)+'<i></i>'.repeat(max-l)+'</div>'
    +(c===null?'<em class="ok">Maxed</em>':'<button class="btn alt ccbuy" data-up="'+u.id+'"'+(fleetCanBuy(u)?'':' disabled')+'>'+fleetCost(u,c)+'</button>')+'</div>';
}
function ccBuyFleet(id){
  const u=FLEET_UPGRADES.find(x=>x.id===id);
  if(!u||!buyFleetUpgrade(u))return;
  sfx('acquire');renderCommand();
}
const CC_PANEL={
  refit(){
    const lv=FLEET_UPGRADES.reduce((n,u)=>n+fleetLevel(u.id),0),max=FLEET_UPGRADES.reduce((n,u)=>n+u.costs.length,0);
    const grp=g=>FLEET_UPGRADES.filter(u=>u.group===g).map(ccRefitRow).join('');
    return {role:'// refit bay',name:'WING AND CARRIER',
      desc:'Spend campaign rewards on better wingmen and a tougher HALCYON. Upgrades carry into every arena op that flies the wing or the carrier.',
      body:'<div class="hgstats">'+ccBar('Refit progress',lv/max,lv+' / '+max)+'</div>'
        +'<div class="hgfacts">'+hgFacts([['Balance',PROG.credits.toLocaleString()+' cr · '+PROG.parts+' ◆','amber']])+'</div>'
        +'<div class="ccgrp">Wingmen · credits</div>'+grp('wing')+'<div class="ccgrp">HALCYON · parts</div>'+grp('carrier'),action:null};
  },
  ops(){
    const nm=nextMission(),cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
    return {role:'// sortie board',name:nm?nm.name:'ALL OPS CLEARED',
      desc:nm?nm.brief[0]+' '+nm.objective+'.':'Every op is down. Replay any of them from the sortie board for a better score and bonuses you missed.',
      body:'<div class="hgstats">'+ccBar('Campaign',cleared/MISSIONS.length,cleared+' / '+MISSIONS.length)+'</div>'
        +(nm?'<div class="hgfacts">'+hgFacts([['Op',nm.sub.replace('// ','')],
          ['Sector',nm.sector==='arena'?'Open space':nm.interior?'Capital interior':'Trench'],
          ['Wing',ccWingFlies(nm)?'Pike and Lark':'Solo'],
          ['Payout',nm.reward.credits+' cr'+(nm.reward.parts?' + '+nm.reward.parts+' ◆':''),'amber']])+'</div>':''),
      action:['Open sortie board',openMissions]};
  },
  fleet(){
    const F=ccFleet(),nm=nextMission(),H=F.halcyon;
    let html=ccUnit('HALCYON','Carrier · home','On station','ok',
      H.ops?H.ops+' defence'+(H.ops>1?'s':'')+' flown · hull '+H.hull+'% after the last':'Fleet reserve '+CARRIER_TYPE.reserve+' fighters');
    for(const P of CC_PILOTS){
      const R=F.pilots[P.c],wing=P.role!=='Reserve',flies=wing&&nm&&ccWingFlies(nm);
      const status=wing?(flies?'Next op':nm?'Standby':'Ready'):'Standby';
      const rec=!R?'No sorties yet':R.sorties+' sortie'+(R.sorties>1?'s':'')+' · shot down '+R.downs+'×'+(R.last==='down'?' · ejected last op, back on the roster':'');
      html+=ccUnit(P.c,P.role,status,flies?'next':'',rec);
    }
    return {role:'// fleet status',name:'HALCYON GROUP',
      desc:'Your carrier and the pilots it carries. '+(!nm?'The wing flies with you on any arena op you replay.'
        :ccWingFlies(nm)?'Pike and Lark fly '+nm.name+' with you; if one goes down, a reserve pilot launches from the bay.'
        :nm.name+' is a solo op: the wing stays aboard.'),
      body:'<div class="cclist">'+html+'</div>',action:null};
  },
  hangar(){
    const ups=UPGRADES.reduce((n,u)=>n+(PROG.upgrades[u.id]||0),0),upMax=UPGRADES.reduce((n,u)=>n+u.costs.length,0);
    const buy=UPGRADES.filter(u=>{const l=PROG.upgrades[u.id]||0;return l<u.costs.length&&PROG.credits>=u.costs[l];}).length
      +SHIPS.filter(s=>hullState(s).afford).length;
    return {role:'// hangar · '+curShip.role,name:curShip.name,desc:curShip.desc,
      body:'<div class="hgstats">'+ccBar('Hulls owned',PROG.shipsOwned.length/SHIPS.length,PROG.shipsOwned.length+' / '+SHIPS.length)
        +ccBar('Upgrades',ups/upMax,ups+' / '+upMax)+'</div>'
        +'<div class="hgfacts">'+hgFacts([['Balance',PROG.credits.toLocaleString()+' cr · '+PROG.parts+' ◆','amber'],
          ['Workshop',buy?buy+' upgrade'+(buy>1?'s':'')+' or hulls in reach':'Nothing affordable yet']])+'</div>',
      action:['Open hangar',()=>openHangar('command')]};
  },
  log(){
    const cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
    let bon=0,bonN=0;
    const rows=MISSIONS.map((m,i)=>{const d=PROG.completed[m.id],n=(m.bonuses||[]).length;bonN+=n;if(d)bon+=d.bonuses||0;
      return ['0'+(i+1)+' '+m.name,d?'✓ '+d.score.toLocaleString()+(n?' · '+(d.bonuses||0)+'/'+n+' bonus':''):isUnlocked(m)?'Open':'Classified',d?'amber':''];});
    return {role:'// campaign log',name:'OPS RECORD',
      desc:cleared+' of '+MISSIONS.length+' ops cleared, '+bon+' of '+bonN+' bonus objectives earned. Best scores per op.',
      body:'<div class="hgfacts cclog">'+hgFacts(rows)+'</div>',action:null};
  },
};
function renderStationPanel(){
  const P=CC_PANEL[ccPeek||ccSel]();
  ccRole.textContent=P.role;ccName.textContent=P.name;ccDesc.textContent=P.desc;ccBody.innerHTML=P.body;
  ccBody.querySelectorAll('.ccbuy').forEach(b=>b.onclick=()=>ccBuyFleet(b.dataset.up));
  const A=CC_PANEL[ccSel]().action;   // the button belongs to the locked-in station, not the previewed one
  ccAction.style.display=ccPeek||A?'':'none';
  ccAction.textContent=ccPeek?'Click to select':A?A[0]:'';ccAction.disabled=!!ccPeek;
}
ccAction.onclick=()=>{const A=CC_PANEL[ccSel]().action;if(A)A[1]();};
ccStart.onclick=()=>{const nm=nextMission();if(nm)openBriefing(nm,'command');else openMissions();};
ccBack.onclick=()=>{S.mode='menu';showScreen('menu');};
