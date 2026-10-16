"use strict";
/* Saved pilot progression: credits, parts, owned ships, mission clears. */

/* ============================ PROGRESSION + MISSIONS ============================ */
/* Persisted pilot progression — the credits/parts economy + mission clears the
   eventual RPG hub will read from and write to. */
const PROG_KEY='neonTrench.prog';
const PROG_DEFAULT={credits:0,parts:0,completed:{},shipsOwned:['s1'],ship:'s1'};
const PROG=loadProg();
function loadProg(){try{const p=JSON.parse(localStorage.getItem(PROG_KEY));
    if(p&&p.completed)return Object.assign({},PROG_DEFAULT,p);}catch(e){}     // merge so old saves gain ship fields
  return Object.assign({},PROG_DEFAULT);}
function saveProg(){try{localStorage.setItem(PROG_KEY,JSON.stringify(PROG));}catch(e){}}

let curShip=shipById(PROG.ship);
rebuildShip();   // build the actual player mesh now that curShip is known
function setShip(id){if(!PROG.shipsOwned.includes(id))return;PROG.ship=id;curShip=shipById(id);saveProg();rebuildShip();}
function unlockShip(s){if(PROG.shipsOwned.includes(s.id)||PROG.parts<s.cost)return false;
  PROG.parts-=s.cost;PROG.shipsOwned.push(s.id);saveProg();return true;}

function evalBonus(b){
  if(b.type==='hull')return S.hull>=b.val;
  if(b.type==='kills')return S.kills>=b.val;
  if(b.type==='time')return S.time<=b.val;
  if(b.type==='flawless')return S.hull>=100;
  if(b.type==='noboost')return !S.boostUsed;
  return false;
}
