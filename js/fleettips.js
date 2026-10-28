"use strict";
/* Fleet tips (FLEET_TIPS in js/data/tips.js): one card at a time in the corner of the fight (#tipCard), each the first time
   its mechanic comes up, and never again for this pilot (PROG.tips). Event code calls fleetTip(id, name); fleetTipsFrame
   (from the radio stage, on real time so the slowed bridge doesn't stretch them) watches for the ones that need no event
   and shows the queue. A click dismisses the card. */
const TIP_SHOW=8, TIP_GAP=3;   // seconds a card stays up, and between cards
const tipQ=[];
let tipT=0;
const tipSeen=id=>!!(PROG.tips&&PROG.tips[id]);
function fleetTip(id,n){
  if(!FLEET_TIPS[id]||tipSeen(id)||tipQ.some(q=>q[0]===id)||S.school)return;
  tipQ.push([id,n||'']);
}
function fleetTipsReset(){tipQ.length=0;tipT=0;tipCard.classList.remove('on');}
function fleetTipsFrame(fr){
  if(S.fleet&&S.mode==='play'&&S.launchT<=0)fleetTipsWatch();
  tipT-=fr.rdt||fr.dt;
  if(tipT>0)return;
  if(tipCard.classList.contains('on')){tipCard.classList.remove('on');tipT=TIP_GAP;return;}
  if(!tipQ.length)return;
  tipQ.sort((a,b)=>TIP_ORDER.indexOf(a[0])-TIP_ORDER.indexOf(b[0]));
  const [id,n]=tipQ.shift(),T=FLEET_TIPS[id];
  PROG.tips=Object.assign({},PROG.tips,{[id]:1});saveProg();
  tipTitle.textContent=T.t;tipText.textContent=T.d.replace(/\{n\}/g,n);
  tipCard.classList.add('on');tipT=TIP_SHOW;
}
const TIP_ORDER=Object.keys(FLEET_TIPS);
/* the tips that need no event: what is in the fight and which tools are open */
function fleetTipsWatch(){
  const foes=capitals.filter(C=>!C.friendly&&C.fleet&&C.state==='fight');
  if(foes.some(C=>!C.gate))fleetTip('subsys');
  if(S.time>12&&toolOn('bridge'))fleetTip('bridge');
  if(S.time>20&&toolOn('groups')&&fleetShips().length>1)fleetTip('groups');
  if(S.time>20&&toolOn('groups')&&fleetShips().some(C=>C.kind==='escort'))fleetTip('roles');
  if(S.time>30&&toolOn('form')&&fleetShips().some(C=>C.kind==='escort'))fleetTip('forms');
  if(S.adm&&S.adm.C&&!S.adm.silenced&&S.adm.C.state==='fight')fleetTip('admiral',S.adm.C.T.name);
  if(S.adm&&S.adm.plans>0)fleetTip('admPlan');
  const art=foes.find(C=>C.role==='artillery');if(art)fleetTip('artillery',art.T.name);
  if(reserveReady()&&S.time>25)fleetTip('reserve',S.reserveDef.name);
  if(fleetGate())fleetTip('gate');
}
tipCard.addEventListener('mousedown',e=>{e.stopPropagation();if(tipCard.classList.contains('on')){tipCard.classList.remove('on');tipT=TIP_GAP;}});
