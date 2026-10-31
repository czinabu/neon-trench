"use strict";
/* Contracts (Free Play, shown once Acts I to III are cleared): procedural ops built from a seed code out of the campaign's
   pieces (sweeps, holds, capital strikes, ace hunts, carrier defence, trench and interior runs, fleet actions; tuning in
   CONTRACTS, js/data/contracts.js). contractBoard turns a code into a board of ops shaped like MISSIONS entries, so they fly,
   brief and debrief on the campaign's code. A contract pays credits and parts like an op (a repeat pays half, no parts),
   but leaves the campaign, its fleet record and the sector map alone. The board's code is saved in PROG.contracts with the
   contracts paid out; type a code to fly someone else's board. */
const CT_ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',CT_KEEP=60;   // seed letters (no look-alikes); paid contracts remembered for the half-pay repeat rule
/* a small seeded generator: FNV-1a hash of the code into mulberry32 */
function ctRng(code){let a=2166136261;for(let i=0;i<code.length;i++){a^=code.charCodeAt(i);a=Math.imul(a,16777619);}
  return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const ctOne=(r,a)=>a[(r()*a.length)|0];
const ctInt=(r,[lo,hi])=>lo+((r()*(hi-lo+1))|0);
function ctPick(r,keys,w){let n=0;for(const k of keys)n+=w(k);let x=r()*n;for(const k of keys){x-=w(k);if(x<0)return k;}return keys[keys.length-1];}
const ctNewSeed=()=>Array.from({length:6},()=>CT_ABC[(Math.random()*CT_ABC.length)|0]).join('');
const ctCleanSeed=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const ctFmt=t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
function ctState(){if(!PROG.contracts)PROG.contracts={seed:'',cleared:0,paid:{}};return PROG.contracts;}   // old saves have none

/* a board: one contract per slot, each a different kind, each rolled from the code and its slot */
function contractBoard(seed){
  const used=[],out=[];
  for(let i=0;i<CONTRACTS.board;i++){
    const r=ctRng(seed+':'+i),kinds=Object.keys(CONTRACTS.kinds).filter(k=>!used.includes(k));
    const kind=ctPick(r,kinds,k=>CONTRACTS.kinds[k].w);used.push(kind);
    out.push(contractBuild(seed,i,kind,r));
  }
  return out;
}
/* one contract as a mission object (see the fields in js/data/missions.js) */
function contractBuild(seed,slot,kind,r){
  const K=CONTRACTS.kinds[kind],threat=ctPick(r,Object.keys(CONTRACTS.threat),t=>CONTRACTS.threat[t].w),T=CONTRACTS.threat[threat];
  const place=ctOne(r,CONTRACTS.places),name=ctOne(r,CONTRACTS.names[0])+' '+ctOne(r,CONTRACTS.names[1]);
  const m={id:'ct-'+seed+'-'+slot,contract:true,seed,slot,kind,threat,difficulty:threat,name,sub:K.sub,sector:K.sector,place,
    capital:false,carrier:false};   // set, so a contract never rolls a random capital ship event
  const fill={place,n:0,t:'',cap:'',line:''};
  const capOf=k=>CAPITAL_TYPES[k].cls.toLowerCase()+' '+CAPITAL_TYPES[k].name;
  if(K.sector==='arena'){
    m.roster={grunt:1,dart:+(.4+r()*.3).toFixed(2),hunter:+(.15+r()*.25).toFixed(2)};
    if(threat==='hard')m.roster.ace=.15;
  }
  if(K.count)m.count=fill.n=ctInt(r,K.count);
  const solo=(kind==='sweep'||kind==='strike'||kind==='hunt')&&r()<.25;
  if(solo)m.wingmen=false;
  if(kind==='sweep'){m.carrier=r()<.5;m.objective='Eliminate '+m.count+' hostiles';}
  else if(kind==='hold'){m.survive=Math.round(ctInt(r,K.survive)/15)*15;m.carrier=r()<.5;fill.t=m.survive+' seconds';m.objective='Survive '+m.survive+' seconds';}
  else if(kind==='strike'||kind==='defend'){m.capital=ctOne(r,Object.keys(CAPITAL_TYPES));fill.cap=capOf(m.capital);
    if(kind==='defend')m.carrier=true;
    m.objective='Destroy the '+fill.cap+(kind==='defend'?' and keep HALCYON afloat':'');}
  else if(kind==='hunt'){m.leader=true;m.roster={ace:1,grunt:.7,dart:.3};m.objective='Down the escort squadron and its ace';}
  else if(kind==='trench')m.objective='Breach the reactor intake';
  else if(kind==='interior'){m.interior='dreadnought';m.objective='Torpedo the dreadnought\'s core, then escape';}
  else if(kind==='fleet'){
    const n=ctInt(r,K.ships),names={cruiser:SKIRMISH.foeNames.cruiser.slice(),frigate:SKIRMISH.foeNames.frigate.slice()};
    m.fleet=true;m.carrier=true;m.carrierHp=Math.round(FLEET.carrierHp/T.foeHp);
    m.line=[];
    for(let i=0;i<n;i++){const k=i===0||r()<.4?'cruiser':'frigate',a=names[k],nm=a.splice((r()*a.length)|0,1)[0];
      m.line.push({kind:k,name:nm,hp:Math.round(FLEET.hp[k]*T.foeHp),t:4+i*8,at:SKIRMISH.foeAt[i].slice(),role:i?ctOne(r,['line','screen','artillery']):'line'});}
    if(threat==='hard'||(n>1&&r()<.5))Object.assign(m.line[0],{admiral:true,pal:'flag'});
    fill.line=m.line.map(e=>e.name).join(n>2?', ':' and ').replace(/, ([^,]*)$/,' and $1');
    m.objective='Destroy '+fill.line;
  }
  // two optional objectives the kind allows
  const pool=K.bonus.filter(b=>!(b==='wing'&&(solo||K.sector!=='arena'))&&!(b==='admiral'&&!(m.line&&m.line[0].admiral)));
  m.bonuses=[];
  while(m.bonuses.length<2&&pool.length){const b=pool.splice((r()*pool.length)|0,1)[0],B=CONTRACTS.bonus[b];
    const val=b==='time'?Math.round(((kind==='sweep'?30:kind==='hunt'?120:180)+m.count*12)/15)*15   // about Clear the Screen's and Ace Duel's pace
      :b==='kills'&&K.sector==='trench'?ctInt(r,[5,9]):B.val?Math.round(ctInt(r,B.val)/5)*5:0;
    m.bonuses.push({type:b,val,credits:Math.round(ctInt(r,B.credits)/50)*50,label:B.label.replace('{v}',val).replace('{t}',ctFmt(val))});}
  // payout: the kind's base, the threat, a bigger fight and flying solo all raise it
  const size=K.count?(m.count-K.count[0])/Math.max(1,K.count[1]-K.count[0])*.2:0;
  m.reward={credits:Math.round(K.credits*T.pay*(1+size)*(solo?1.15:1)/50)*50,parts:K.parts+T.parts};
  m.brief=CONTRACTS.brief[kind].map(l=>l.replace(/\{(\w+)\}/g,(_,k)=>fill[k]));
  if(solo)m.brief.push('Solo contract: no wingmen. It pays more for it.');
  m.vox=[['reyes',ctOne(r,CONTRACTS.vox.brief)]];
  return m;
}
/* the debrief's payout for a won contract: full the first time, half and no parts on a repeat */
function contractPay(m,bonuses){
  const C=ctState(),prev=C.paid[m.id];
  let credits=(m.reward.credits||0)+bonuses.reduce((n,b)=>n+(b.met?b.credits||0:0),0),parts=m.reward.parts||0;
  if(prev!==undefined){credits=Math.round(credits*.5);parts=0;}
  C.paid[m.id]=Math.max(prev||0,S.score);C.cleared++;
  const ids=Object.keys(C.paid);if(ids.length>CT_KEEP)delete C.paid[ids[0]];
  PROG.credits+=credits;PROG.parts+=parts;saveProg();
  return {credits,parts,first:prev===undefined};
}
const contractVox=(m,win)=>[['reyes',ctOne(Math.random,win?CONTRACTS.vox.win:CONTRACTS.vox.lose)]];

/* ---- the contracts board (#contracts): the board's ops on the left, the selected one on the right, its seed code below ---- */
let ctSel=0,ctCache=null;
function ctBoard(){
  const C=ctState();if(!C.seed){C.seed=ctNewSeed();saveProg();}
  if(!ctCache||ctCache.seed!==C.seed)ctCache={seed:C.seed,list:contractBoard(C.seed)};
  return ctCache.list;
}
function openContracts(){S.mode='menu';S.school=false;document.exitPointerLock&&document.exitPointerLock();renderContracts();showScreen('contracts');}
function renderContracts(){
  const list=ctBoard(),C=ctState();
  if(ctSel>=list.length)ctSel=0;
  ctCredits.textContent=PROG.credits.toLocaleString();ctParts.textContent=PROG.parts;
  ctSeed.value=C.seed;
  ctList.innerHTML='';
  list.forEach((m,i)=>{
    const row=document.createElement('button');row.id='ctRow_'+i;
    row.className='hgrow'+(i===ctSel?' sel':'')+(C.paid[m.id]!==undefined?' done':'');
    row.innerHTML='<div><b>'+m.name+'</b><span>'+m.sub+' · '+m.place+'</span></div>'
      +(C.paid[m.id]!==undefined?'<span class="chip ok">✓ Paid</span>':'<span class="chip ct'+m.threat+'">'+CONTRACTS.threat[m.threat].name+' threat</span>');
    row.onmouseenter=row.onfocus=()=>{ctSel=i;ctMark();};row.onclick=()=>{ctSel=i;ctMark();};
    ctList.appendChild(row);
  });
  ctMark();
}
function ctMark(){
  for(const r of ctList.children)r.classList.toggle('sel',r.id==='ctRow_'+ctSel);
  const m=ctBoard()[ctSel],C=ctState(),best=C.paid[m.id],caps=m.fleet?m.line.length:m.capital?1:0;
  ctRole.textContent=m.sub+' · '+m.place;ctName.textContent=m.name;ctDesc.textContent=m.objective+'.';
  ctFacts.innerHTML=hgFacts([
    ['Sector',m.sector==='arena'?'Open space':m.interior?'Capital interior':'Trench'],
    ['Threat',CONTRACTS.threat[m.threat].name+' · '+DIFFICULTY[m.threat].name+' enemies',m.threat==='hard'?'amber':''],
    m.sector==='arena'?['Wing',m.wingmen===false?'Solo':'Pike and Lark'+(m.carrier?' · from HALCYON':'')]:null,
    caps?['Capitals',m.fleet?m.line.map(e=>e.name+(e.admiral?' (admiral)':'')).join(' · '):CAPITAL_TYPES[m.capital].name]:null,
    ['Bonuses',m.bonuses.map(b=>b.label).join(' · ')||'None'],
    ['Payout',m.reward.credits+' cr'+(m.reward.parts?' + '+m.reward.parts+' ◆':''),'amber'],
    best!==undefined?['Best',best.toLocaleString()+' · replay pays half','amber']:null,
  ]);
  ctAction.textContent=best!==undefined?'Replay briefing':'Open briefing';
}
function ctNavRow(d){const n=ctBoard().length;ctSel=(ctSel+d+n)%n;ctMark();const r=$('ctRow_'+ctSel);if(r)r.focus();}
function ctSetSeed(code){const c=ctCleanSeed(code);if(!c)return;ctState().seed=c;ctSel=0;saveProg();sfx('tick');renderContracts();}
const ctBrief=()=>openBriefing(ctBoard()[ctSel],'contracts');
ctAction.onclick=ctBrief;
ctNew.onclick=()=>ctSetSeed(ctNewSeed());
ctLoad.onclick=()=>ctSetSeed(ctSeed.value);
ctSeed.onkeydown=e=>{e.stopPropagation();if(e.code==='Enter'){e.preventDefault();ctSetSeed(ctSeed.value);}};   // typing a code: keep N (mute) and Enter off the menu keys
ctBack.onclick=()=>showScreen('menu');
