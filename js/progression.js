"use strict";
/* Saved pilot progression: credits, parts, owned ships, mission clears. */

/* ============================ PROGRESSION + MISSIONS ============================ */
/* Persisted pilot progression — the credits/parts economy + mission clears the
   eventual RPG hub will read from and write to. */
const PROG_KEY='neonTrench.prog';
const PROG_DEFAULT={credits:0,parts:0,completed:{},shipsOwned:['s1'],ship:'s1',upgrades:{},tutDone:false,school:{},fleet:{},fleetUp:{},rankSeen:0};   // rankSeen: the highest rank whose promotion screen was shown
const PROG=loadProg();
function loadProg(){try{const p=JSON.parse(localStorage.getItem(PROG_KEY));
    if(p&&p.completed){const q=Object.assign({},PROG_DEFAULT,p);
      if(p.rankSeen===undefined)q.rankSeen=rankOf(q.completed);   // an old save keeps its rank without a ceremony
      return q;}}catch(e){}     // merge so old saves gain ship fields
  return Object.assign({},PROG_DEFAULT);}
/* rank index into RANKS from the cleared ops: the highest rank whose `after` op is done */
function rankOf(done){let l=0;RANKS.forEach((r,i)=>{if(!r.after||done[r.after])l=i;});return l;}
const rankLevel=()=>rankOf(PROG.completed);
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
/* Command center refit (js/data/fleet.js): the level bought in an upgrade, the carrier's stats with them applied,
   and a multiplier for the wing's. Saved in PROG.fleetUp; old saves have none. */
const fleetLevel=id=>(PROG.fleetUp&&PROG.fleetUp[id])||0;
function buyFleetUpgrade(u){
  const l=fleetLevel(u.id);
  if(l>=u.costs.length||PROG[u.cur]<u.costs[l])return false;
  PROG[u.cur]-=u.costs[l];PROG.fleetUp=Object.assign({},PROG.fleetUp,{[u.id]:l+1});saveProg();
  return true;
}
function fleetCarrierType(){
  const T=Object.assign({},CARRIER_TYPE);
  T.hp=Math.round(T.hp*(1+.25*fleetLevel('carHull')));
  T.relaunch*=1-.2*fleetLevel('carBay');
  T.reserve+=fleetLevel('carRes');
  return T;
}
const wingHullMax=()=>Math.round(WING_HP*(1+.2*fleetLevel('wingHull')));
const wingRofMul=()=>1/(1+.15*fleetLevel('wingGuns'));
const wingTurnMul=()=>1+.1*fleetLevel('wingSkill');
const wingRangeMul=()=>1+.12*fleetLevel('wingSkill');
/* every campaign op cleared: opens Free Trench and Free Dogfight on the title screen */
const campaignDone=()=>MISSIONS.every(m=>PROG.completed[m.id]);
function unlockShip(s){if(PROG.shipsOwned.includes(s.id)||PROG.parts<s.cost)return false;
  PROG.parts-=s.cost;PROG.shipsOwned.push(s.id);saveProg();return true;}

/* the fleet's service record, shown in the command center: per pilot {sorties,downs,last:'home'|'down'}, and
   HALCYON's ops defended with its hull at the end of the last one. Written at every campaign debrief. */
function recordFleet(m,win){
  const F=PROG.fleet=Object.assign({pilots:{},halcyon:{ops:0,hull:100}},PROG.fleet);
  for(const c of S.wingFlown){const P=F.pilots[c]=Object.assign({sorties:0,downs:0},F.pilots[c]);
    P.sorties++;const down=S.wingDowned.includes(c);if(down)P.downs++;P.last=down?'down':'home';}
  if(m.carrier){const K=carrierShip();F.halcyon.ops++;F.halcyon.hull=K?Math.round(K.hp/K.T.hp*100):0;F.halcyon.won=win;}
  saveProg();
}
function evalBonus(b){
  if(b.type==='hull')return S.hull>=b.val;
  if(b.type==='kills')return S.kills>=b.val;
  if(b.type==='time')return S.time<=b.val;
  if(b.type==='flawless')return S.hull>=100;
  if(b.type==='noboost')return !S.boostUsed;
  if(b.type==='carrier'){const K=carrierShip();return !!K&&K.hp/K.T.hp*100>=b.val;}
  if(b.type==='vents')return !S.ventHits;
  if(b.type==='escort'){const E=capitals.find(C=>C.kind==='escort'&&!C.dead);return !!E&&E.hp/E.T.hp*100>=b.val;}
  if(b.type==='systems')return S.sysDown>=b.val;
  if(b.type==='moved')return S.carMoved>=b.val;   // commander ops: HALCYON repositioned that many metres by orders
  if(b.type==='formation')return S.formT>=b.val;   // SOLACE held a formation for that many seconds
  if(b.type==='squads')return S.sqLaunched>=b.val;   // squadrons launched from the hangar
  if(b.type==='wing'){const own=sqMembers(0);return own.length>0&&own.every(w=>!w.dead);}
  return false;
}
