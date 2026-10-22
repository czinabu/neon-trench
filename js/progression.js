"use strict";
/* Saved pilot progression: credits, parts, owned ships, mission clears. */

/* ============================ PROGRESSION + MISSIONS ============================ */
/* Persisted pilot progression — the credits/parts economy + mission clears the
   eventual RPG hub will read from and write to. */
const PROG_KEY='neonTrench.prog';
const PROG_DEFAULT={credits:0,parts:0,completed:{},shipsOwned:['s1'],ship:'s1',upgrades:{},tutDone:false,school:{}};
const PROG=loadProg();
function loadProg(){try{const p=JSON.parse(localStorage.getItem(PROG_KEY));
    if(p&&p.completed)return Object.assign({},PROG_DEFAULT,p);}catch(e){}     // merge so old saves gain ship fields
  return Object.assign({},PROG_DEFAULT);}
function saveProg(){try{localStorage.setItem(PROG_KEY,JSON.stringify(PROG));}catch(e){}}

/* the equipped hull's stats with the workshop upgrades applied; everything in flight reads curShip */
function effectiveShip(base){
  const s=Object.assign({shieldRegenMul:1},base);
  for(const u of UPGRADES){const l=PROG.upgrades[u.id]||0;if(l)u.apply(s,l);}
  return s;
}
let curShip=effectiveShip(shipById(PROG.ship));
rebuildShip();   // build the actual player mesh now that curShip is known
function setShip(id){if(!PROG.shipsOwned.includes(id))return;PROG.ship=id;curShip=effectiveShip(shipById(id));saveProg();rebuildShip();}
function buyUpgrade(u){
  const l=PROG.upgrades[u.id]||0;
  if(l>=u.costs.length||PROG.credits<u.costs[l])return false;
  PROG.credits-=u.costs[l];PROG.upgrades=Object.assign({},PROG.upgrades,{[u.id]:l+1});saveProg();
  curShip=effectiveShip(shipById(PROG.ship));
  return true;
}
/* every campaign op cleared: opens Free Trench and Free Dogfight on the title screen */
const campaignDone=()=>MISSIONS.every(m=>PROG.completed[m.id]);
function unlockShip(s){if(PROG.shipsOwned.includes(s.id)||PROG.parts<s.cost)return false;
  PROG.parts-=s.cost;PROG.shipsOwned.push(s.id);saveProg();return true;}

function evalBonus(b){
  if(b.type==='hull')return S.hull>=b.val;
  if(b.type==='kills')return S.kills>=b.val;
  if(b.type==='time')return S.time<=b.val;
  if(b.type==='flawless')return S.hull>=100;
  if(b.type==='noboost')return !S.boostUsed;
  if(b.type==='wing')return wingmen.length>0&&wingmen.every(w=>!w.dead);
  return false;
}
