"use strict";
/* Sector map: the campaign between Broadside and the Kiru Gate (data in js/data/sector.js). Before each fleet battle you
   may strike one of two side targets, or skip them; striking one lets the other slip away. Fleet damage carries forward:
   PROG.sector.hull holds each friendly capital's hull fraction for its next op (SECTOR_CARRY), and PROG.sector.pick the
   target struck before each op. Only the campaign's front line carries damage in and out; replays fly at full strength.
   Old saves have no PROG.sector: every ship starts whole. */

const sectorOpen=()=>!!PROG.completed.m10;   // the map opens once Broadside, the first fleet battle, is cleared
const sectorOpById=id=>SECTOR_OPS.find(o=>o.id===id);
function sectorState(){return PROG.sector=Object.assign({hull:{},pick:{}},PROG.sector);}
function sectorHull(name){const h=((PROG.sector||{}).hull||{})[name];return h===undefined?1:h;}
const sectorJoined=f=>isUnlocked(missionById(f.joins));
const sectorTargets=leg=>SECTOR_OPS.filter(o=>o.leg===leg);
function sectorPicked(leg){const p=(PROG.sector||{}).pick;return p&&p[leg]?sectorOpById(p[leg]):null;}
/* the campaign's next op when it is on the map: the leg whose targets are up */
function sectorLeg(){const nm=nextMission();return nm&&sectorOpen()&&SECTOR_ROUTE.some(r=>r.id===nm.id)?nm:null;}
/* the next op while its targets are still open: the hub's Next op goes through the map first */
function sectorChoice(){const L=sectorLeg();return L&&sectorTargets(L.id).length&&!sectorPicked(L.id)?L:null;}
/* does damage carry in and out of this run? Only for the story op on the front line */
const sectorLive=m=>!!m&&!m.side&&!m.skirmish&&SECTOR_ROUTE.some(r=>r.id===m.id)&&nextMission()===m;
/* the friendly capitals an op puts in the line (the reserve only once it is called in) */
function sectorShipsIn(m,withReserve){
  const n=[];if(m.carrier)n.push('HALCYON');if(m.fleet&&m.escort!==false)n.push(ESCORT_TYPE.name);
  for(const a of m.allies||[])n.push(a.name);if(m.reserve&&withReserve)n.push(m.reserve.name);
  for(const r of dockRecruitsFor(m))n.push(r.name);   // destroyers commissioned through fleet management (js/dock.js)
  return n;
}
/* what a run starts with (S.carry, set in startGame): ship hulls and the struck target's effect; null for full strength */
function sectorCarry(m){
  if(!sectorLive(m))return null;
  const P=sectorPicked(m.id);
  return {hull:Object.assign({},(PROG.sector||{}).hull),yard:!!P&&P.kind==='yard',base:!!P&&P.kind==='base'};
}
const carryHull=name=>S.carry&&S.carry.hull[name]!==undefined?S.carry.hull[name]:1;
/* a front-line op won: each ship that flew keeps its hull (plus field repairs, never under the floor), a sunk destroyer
   is patched back up, and the rest get field repairs. Returns a short line per ship for the debrief. */
function sectorAfterBattle(m){
  const st=sectorState(),C=SECTOR_CARRY,flew=sectorShipsIn(m,S.reserveUsed),out=[];
  for(const n of dockAllShips()){
    const h0=st.hull[n]===undefined?1:st.hull[n];
    if(flew.includes(n)){
      const K=n==='HALCYON'?carrierShip():capitals.find(o=>o.kind==='escort'&&o.T.name===n),sunk=!K||K.dead;
      st.hull[n]=sunk?C.sunk:Math.max(C.floor,Math.min(1,K.hp/K.T.hp+C.field));
      out.push(n+' '+Math.round(st.hull[n]*100)+'%'+(sunk?' (patched)':''));
    }else st.hull[n]=Math.min(1,h0+C.field);
  }
  saveProg();
  return out;
}
/* repairs: `k` of full hull back to one ship, or to all of them with no name. The depot and fleet management (js/dock.js) use it */
function sectorRepair(k,name){
  const st=sectorState();
  for(const n of dockAllShips())if(!name||n===name)st.hull[n]=Math.min(1,(st.hull[n]===undefined?1:st.hull[n])+k);
  saveProg();
}
/* a side target won: it is the leg's pick, and a depot repairs the fleet on the spot */
function sectorStrike(m){
  sectorState().pick[m.leg]=m.id;
  if(m.kind==='depot')sectorRepair(1);
  saveProg();
}
/* briefing chips for a front-line op: hulls under full, and the struck target's effect */
function sectorBriefChips(m){
  if(m.side)return '<span class="bfchip carry">'+SECTOR_KINDS[m.kind].gives+'</span>';
  if(!sectorLive(m))return '';
  const P=sectorPicked(m.id);
  let h=sectorShipsIn(m,true).filter(n=>sectorHull(n)<1).map(n=>'<span class="bfchip hurt">'+n+' '+Math.round(sectorHull(n)*100)+'%</span>').join('');
  if(P&&P.kind!=='depot'&&P.kind!=='salvage')h+='<span class="bfchip carry">'+P.name+' · '+SECTOR_KINDS[P.kind].gives.replace(' next op','')+'</span>';
  return h;
}

/* ---- the map screen: the route across the top right, the leg's choices down the left ---- */
let smSel=null;    // row locked in by a click
let smPeek=null;   // row under the pointer or focus
function openSector(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();
  smSel=null;renderSector();showScreen('sector');}
/* the choices up now: the leg's targets, then the op itself */
function smRows(){const L=sectorLeg();return L?[...sectorTargets(L.id),L]:[];}
function smState(o){
  if(!o.side)return 'next';
  const P=sectorPicked(o.leg);
  return P?(P.id===o.id?'hit':'gone'):'open';
}
const SM_CHIP={open:'<span class="chip next">Strike</span>',hit:'<span class="chip ok">✓ Struck</span>',gone:'<span class="chip">Slipped away</span>',next:'<span class="chip next">▸ Next op</span>'};
function renderSector(){
  smFleet.innerHTML=dockFleet().map(n=>{const h=sectorHull(n);
    return ccBar(n,h,Math.round(h*100)+'%');}).join('');
  smList.innerHTML='';smPeek=null;
  const rows=smRows();
  if(!rows.some(o=>o.id===smSel))smSel=(rows.find(o=>smState(o)==='open')||rows[rows.length-1]||{}).id||null;
  rows.forEach((o,i)=>{
    const st=smState(o),row=document.createElement('button');row.id='smRow_'+o.id;
    row.className='hgrow'+(o.id===smSel?' sel':'')+(st==='hit'?' done':'')+(st==='gone'?' locked':'');
    row.innerHTML='<i>'+(o.side?'◇':'◎')+'</i><div><b>'+o.name+'</b><span>'+(o.side?SECTOR_KINDS[o.kind].name:o.sub.replace('',''))+'</span></div>'+SM_CHIP[st];
    row.onmouseenter=row.onfocus=()=>smPeekRow(o.id);row.onclick=()=>smSelect(o.id);
    smList.appendChild(row);
  });
  renderSectorMap();renderSectorPanel();
}
function smSelect(id){
  smSel=id;smPeek=null;
  for(const r of smList.children){r.classList.toggle('sel',r.id==='smRow_'+id);r.classList.remove('peek');}
  renderSectorMap();renderSectorPanel();
}
function smPeekRow(id){
  smPeek=id===smSel?null:id;
  for(const r of smList.children)r.classList.toggle('peek',r.id==='smRow_'+smPeek);
  renderSectorMap();renderSectorPanel();
}
smList.onmouseleave=()=>{if(smPeek)smPeekRow(null);};
const smOp=id=>sectorOpById(id)||missionById(id);
function renderSectorPanel(){
  const o=smOp(smPeek||smSel);
  if(!o){smRole.textContent='Sector map';smName.textContent='Route cleared';
    smDesc.textContent='Every system on the road to the Kiru Gate is behind you.';smFacts.innerHTML='';smAction.style.display='none';return;}
  const st=smState(o),K=o.side&&SECTOR_KINDS[o.kind],P=!o.side&&sectorPicked(o.id);
  smRole.textContent=o.side?''+K.name:o.sub;smName.textContent=o.name;
  smDesc.textContent=o.side?K.brief:o.objective;
  smFacts.innerHTML=hgFacts([
    o.side?['Strike',K.gives,'amber']:['Struck',P?P.name+' · '+SECTOR_KINDS[P.kind].gives:sectorTargets(o.id).length?'Nothing yet':'No targets on this leg',P?'amber':''],
    ['Fight',o.sector==='arena'?(o.survive?'Hold':'Open space')+(o.capital?' · capital':''):'Trench'],
    ['Payout',o.reward.credits+' cr'+(o.reward.parts?' + '+o.reward.parts+' ◆':''),'amber'],
    st==='open'?['Pick','One per leg; the other slips away']:null,
  ]);
  smAction.style.display='';
  smAction.textContent=smPeek?'Click to select':st==='hit'?'Struck':st==='gone'?'Slipped away':'Open briefing';
  smAction.disabled=!!smPeek||st==='hit'||st==='gone';
}
smAction.onclick=()=>{const o=smOp(smSel);if(o&&(smState(o)==='open'||smState(o)==='next'))openBriefing(o,'sector');};
smBack.onclick=()=>openHub();
/* the route as an SVG: story ops on the lane, the targets off it, the leg up now pulsing */
function renderSectorMap(){
  const L=sectorLeg(),cur=smPeek||smSel,at=id=>SECTOR_ROUTE.find(r=>r.id===id).at;
  let lanes='',nodes='';
  SECTOR_ROUTE.forEach((r,i)=>{
    const m=missionById(r.id),done=!!PROG.completed[r.id],next=L&&L.id===r.id;
    if(i){const p=SECTOR_ROUTE[i-1].at;lanes+='<line class="lane'+(done||next?' on':'')+'" x1="'+p[0]+'" y1="'+p[1]+'" x2="'+r.at[0]+'" y2="'+r.at[1]+'"/>';}
    nodes+='<g class="sys'+(done?' done':next?' next':'')+(cur===r.id?' sel':'')+'" data-id="'+r.id+'" transform="translate('+r.at[0]+','+r.at[1]+')">'
      +'<circle r="18" class="halo"/><circle r="10"/><text y="'+(r.at[1]<200?-24:34)+'">'+m.name+'</text></g>';
  });
  for(const o of SECTOR_OPS){
    const st=smState(o),a=o.at||SECTOR_TARGETS.find(t=>t.id===o.id).at,leg=SECTOR_ROUTE.findIndex(r=>r.id===o.leg),p=SECTOR_ROUTE[leg-1].at,q=at(o.leg);
    const live=L&&L.id===o.leg,past=!!PROG.completed[o.leg];
    if(!live&&!past)continue;   // targets further down the road stay off the map until their leg comes up
    const cls=st==='hit'?' hit':live&&st==='open'?' open':' gone';
    lanes+='<polyline class="spur'+cls+'" points="'+p.join(',')+' '+a.join(',')+' '+q.join(',')+'"/>';
    nodes+='<g class="tgt'+cls+(cur===o.id?' sel':'')+'" data-id="'+o.id+'" transform="translate('+a[0]+','+a[1]+')">'
      +'<rect x="-8" y="-8" width="16" height="16" transform="rotate(45)"/><text y="'+(a[1]<200?-18:28)+'">'+o.name+'</text></g>';
  }
  smMap.innerHTML='<svg viewBox="0 0 1000 420" role="img" aria-label="Sector map">'+lanes+nodes+'</svg>';
  smMap.querySelectorAll('[data-id]').forEach(g=>{const id=g.dataset.id;
    if(smRows().some(o=>o.id===id)){g.classList.add('pick');g.onclick=()=>smSelect(id);}});
}
