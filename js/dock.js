"use strict";
/* Drydock: fleet management between campaign battles (data in js/data/dock.js), a command center station once the
   sector map opens. Saved in PROG.dock: refit levels per ship ({SOLACE:{armour:1}}), the recruits commissioned and each
   captain's battles survived (xp). Repairs pay credits into the hull the sector map carries (PROG.sector.hull). Refits
   and captain ranks apply in every campaign run, never in Skirmish. Old saves have no PROG.dock: no refits, green captains. */

function dockState(){const d=PROG.dock=Object.assign({refit:{},recruits:[],xp:{}},PROG.dock);d.recruits=d.recruits.slice();return d;}
const dockD=()=>PROG.dock||{};
const dockRecruited=()=>RECRUITS.filter(r=>(dockD().recruits||[]).includes(r.name));
/* the campaign fleet now, by name: the sector map's ships that have joined, then the recruits */
const dockFleet=()=>[...SECTOR_FLEET.filter(sectorJoined).map(f=>f.name),...dockRecruited().map(r=>r.name)];
/* every ship whose hull the sector map tracks, joined yet or not */
const dockAllShips=()=>[...SECTOR_FLEET.map(f=>f.name),...dockRecruited().map(r=>r.name)];
/* recruits fly in campaign fleet battles that SOLACE flies in */
const dockRecruitsFor=m=>m&&m.fleet&&!m.skirmish&&!m.side&&m.escort!==false?dockRecruited():[];
const dockOn=()=>!!S.mission&&!S.mission.skirmish;
const dockRefitLv=(name,id)=>((dockD().refit||{})[name]||{})[id]||0;
const dockFx=id=>DOCK.refits.find(r=>r.id===id).fx;
const dockHullMul=name=>dockOn()?1+dockFx('armour')*dockRefitLv(name,'armour'):1;
const dockXp=name=>(dockD().xp||{})[name]||0;
function dockRank(name){const x=dockXp(name);let l=0;DOCK.ranks.forEach((r,i)=>{if(x>=r.xp)l=i;});return l;}
/* a friendly capital's refit guns and its captain's rank, read by fleetSalvo */
function dockArm(C){
  const n=C.T.name,l=dockOn()?dockRank(n):0;
  C.gunMul=1+(dockOn()?dockFx('guns')*dockRefitLv(n,'guns'):0);
  C.capHit=1+DOCK.rankFx.hit*l;C.capSalvo=1-DOCK.rankFx.salvo*l;
}
/* a front-line op won: every ship that flew and is still afloat survives one more battle. Returns promotions for the debrief */
function dockAfterBattle(m){
  const st=dockState(),out=[];
  for(const n of sectorShipsIn(m,S.reserveUsed)){
    const K=capitals.find(o=>o.friendly&&o.T.name===n);if(!K||K.dead)continue;
    const l=dockRank(n);st.xp[n]=dockXp(n)+1;
    if(dockRank(n)>l)out.push(n+': Capt. '+CAPTAINS[n]+' made '+DOCK.ranks[dockRank(n)].name);
  }
  saveProg();return out;
}
const dockRepairCost=n=>Math.ceil((1-sectorHull(n))*100-1e-6)*DOCK.repairCr;
function dockRepair(names){
  const c=names.reduce((s,n)=>s+dockRepairCost(n),0);
  if(!c||PROG.credits<c)return false;
  PROG.credits-=c;names.forEach(n=>sectorRepair(1,n));return true;
}
function dockRefit(n,id){
  const R=DOCK.refits.find(r=>r.id===id),l=dockRefitLv(n,id),c=R&&R.costs[l];
  if(c===undefined||PROG.parts<c)return false;
  const st=dockState();PROG.parts-=c;st.refit[n]=Object.assign({},st.refit[n],{[id]:l+1});saveProg();return true;
}
function dockRecruit(n){
  const R=RECRUITS.find(r=>r.name===n);
  if(!R||dockRecruited().includes(R)||PROG.credits<R.credits||PROG.parts<R.parts)return false;
  const st=dockState();PROG.credits-=R.credits;PROG.parts-=R.parts;st.recruits.push(n);saveProg();return true;
}

/* ---- the Drydock station in the command center: Ships (hull, repair, captain), Refit and Recruit subtabs ---- */
let ccDockTab='ships';
const dockChip=()=>{const n=dockFleet().filter(x=>sectorHull(x)<1).length;
  return n?'<span class="chip next">'+n+' to repair</span>':'<span class="chip">Fleet ready</span>';};
const dockPips=(l,max)=>'<div class="ccpips">'+'<i class="on"></i>'.repeat(l)+'<i></i>'.repeat(max-l)+'</div>';
const dockBtn=(act,txt,ok)=>'<button class="btn alt ccbuy" data-dock="'+act+'"'+(ok?'':' disabled')+'>'+txt+'</button>';
function dockShipRow(n){
  const h=sectorHull(n),c=dockRepairCost(n),l=dockRank(n),nx=DOCK.ranks[l+1];
  const more=nx?nx.xp-dockXp(n):0;
  return '<div class="ccup"><div><b>'+n+'</b><span>Hull '+Math.round(h*100)+'% · Capt. '+CAPTAINS[n]+', '+DOCK.ranks[l].name+'</span>'
    +'<small>'+(l?'+'+Math.round(DOCK.rankFx.hit*l*100)+'% gunnery. ':'')+(nx?more+' more battle'+(more>1?'s':'')+' to '+nx.name+'.':'Top rank.')+'</small></div>'
    +dockPips(l,DOCK.ranks.length-1)
    +(c?dockBtn('repair:'+n,'Repair · '+c+' cr',PROG.credits>=c):'<em class="ok">Ready</em>')+'</div>';
}
function dockRefitRows(n){
  return '<div class="ccgrp">'+n+' · Capt. '+CAPTAINS[n]+'</div>'+DOCK.refits.map(R=>{
    const l=dockRefitLv(n,R.id),c=R.costs[l];
    return '<div class="ccup'+(c===undefined?' maxed':'')+'"><div><b>'+R.name+'</b><span>'+R.per+'</span></div>'+dockPips(l,R.costs.length)
      +(c===undefined?'<em class="ok">Maxed</em>':dockBtn('refit:'+n+':'+R.id,c+' ◆',PROG.parts>=c))+'</div>';}).join('');
}
function dockRecruitRow(R){
  const own=dockRecruited().includes(R),ok=PROG.credits>=R.credits&&PROG.parts>=R.parts;
  return '<div class="ccup"><div><b>'+R.name+'</b><span>'+R.tip+'</span><small>Capt. '+CAPTAINS[R.name]+'</small></div><div></div>'
    +(own?'<em class="ok">In the line</em>':dockBtn('recruit:'+R.name,R.credits.toLocaleString()+' cr + '+R.parts+' ◆',ok))+'</div>';
}
CC_PANEL.dock=function(){
  const F=dockFleet(),hurt=F.filter(n=>sectorHull(n)<1),all=hurt.reduce((s,n)=>s+dockRepairCost(n),0);
  let body;
  if(ccDockTab==='refit')body=F.filter(n=>n!=='HALCYON').map(dockRefitRows).join('')+'<div class="cchint">HALCYON refits: Fleet › Upgrades.</div>';
  else if(ccDockTab==='recruit')body=RECRUITS.map(dockRecruitRow).join('')+'<div class="cchint">Recruits fly beside SOLACE in every fleet battle.</div>';
  else body=F.map(dockShipRow).join('')+(hurt.length>1?dockBtn('repair:*','Repair all · '+all+' cr',PROG.credits>=all):'');
  return {role:'// drydock',name:'FLEET YARD',
    desc:'Repair, refit and recruit. Captains rank up with every battle they survive.',
    body:ccTabs([['ships','Ships'],['refit','Refit'],['recruit','Recruit']],ccDockTab,'dtab')
      +'<div class="hgfacts">'+hgFacts([['Balance',PROG.credits.toLocaleString()+' cr · '+PROG.parts+' ◆','amber']])+'</div>'+body,
    action:null};
};
function dockAct(a){
  const [k,n,id]=a.split(':');
  const ok=k==='repair'?dockRepair(n==='*'?dockFleet().filter(x=>sectorHull(x)<1):[n]):k==='refit'?dockRefit(n,id):dockRecruit(n);
  if(ok){sfx('acquire');renderCommand();}
}
