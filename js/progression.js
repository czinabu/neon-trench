"use strict";
/* Saved pilot progression: credits, parts, owned ships, mission clears. */

/* ============================ PROGRESSION + MISSIONS ============================ */
/* Persisted pilot progression — the credits/parts economy + mission clears the
   eventual RPG hub will read from and write to. */
const PROG_KEY='neonTrench.prog';
const PROG_DEFAULT={credits:0,parts:0,completed:{},shipsOwned:['s1'],ship:'s1',upgrades:{},beats:{},paint:'std',paints:[],tutDone:false,school:{},fleet:{},fleetUp:{},rankSeen:0,introSeen:false,academy:false,sector:{},dock:{},look:null,cuts:{}};   // look: your third-person look from the locker (null is DECK_LOOK); cuts: story cutscenes already played (js/cutscene.js); rankSeen: the highest rank whose promotion screen was shown
const PROG=loadProg();
function loadProg(){try{const p=JSON.parse(localStorage.getItem(PROG_KEY));
    if(p&&p.completed){const q=Object.assign({},PROG_DEFAULT,p);
      if(p.rankSeen===undefined)q.rankSeen=rankOf(q.completed);
      if(p.introSeen===undefined)q.introSeen=true;   // an old save has met HALCYON already   // an old save keeps its rank without a ceremony
      if(p.academy===undefined)q.academy=Object.keys(p.completed).length>0;   // a pilot already mid-campaign has been through the academy
      return q;}}catch(e){}     // merge so old saves gain ship fields
  return Object.assign({},PROG_DEFAULT);}
/* rank index into RANKS from the cleared ops: the highest rank whose `after` op is done */
function rankOf(done){let l=0;RANKS.forEach((r,i)=>{if(!r.after||done[r.after])l=i;});return l;}
const rankLevel=()=>rankOf(PROG.completed);
const toolOn=id=>!S.mission||!!S.mission.skirmish||!!PROG.completed[CDR_TOOLS[id].after];   // a Commander tool (CDR_TOOLS); campaign ops open them one at a time, free runs and skirmish have them all
function saveProg(){try{localStorage.setItem(PROG_KEY,JSON.stringify(PROG));}catch(e){}}
/* Save codes: the live progress as one line of text ("NT1:" plus base64 of the JSON), to keep as a backup or carry to another
   device by hand. parseSave returns the progress inside a code, or null if the text is not a usable one. */
function exportSave(){return 'NT1:'+btoa(unescape(encodeURIComponent(JSON.stringify({v:1,at:Date.now(),prog:PROG}))));}
function parseSave(text){
  try{
    const t=String(text||'').trim();if(!t.startsWith('NT1:'))return null;
    const o=JSON.parse(decodeURIComponent(escape(atob(t.slice(4)))));
    const p=o&&o.prog;
    if(!p||typeof p!=='object'||!p.completed||typeof p.completed!=='object'||!Array.isArray(p.shipsOwned||['s1']))return null;
    return p;
  }catch(e){return null;}
}
/* swap the live progress for another set (a loaded slot, or null for a fresh pilot) and re-equip the hull */
function replaceProg(data){
  const fresh=Object.assign({},PROG_DEFAULT,JSON.parse(JSON.stringify(data||{})));
  fresh.shipsOwned=fresh.shipsOwned.length?fresh.shipsOwned:['s1'];
  for(const k of Object.keys(PROG))delete PROG[k];
  Object.assign(PROG,JSON.parse(JSON.stringify(PROG_DEFAULT)),fresh);
  if(data&&data.rankSeen===undefined)PROG.rankSeen=rankOf(PROG.completed);
  if(data&&data.introSeen===undefined)PROG.introSeen=true;
  if(data&&data.academy===undefined)PROG.academy=Object.keys(PROG.completed).length>0;
  saveProg();curShip=effectiveShip(shipById(PROG.ship));rebuildShip();
}

/* the equipped hull's stats with the workshop upgrades applied; everything in flight reads curShip */
function effectiveShip(base){
  const s=Object.assign({shieldRegenMul:1},base);
  for(const u of UPGRADES){const l=PROG.upgrades[u.id]||0;if(l)u.apply(s,l);}
  return s;
}
let curShip=effectiveShip(shipById(PROG.ship));
rebuildShip();   // build the actual player mesh now that curShip is known
function setShip(id){if(!PROG.shipsOwned.includes(id))return;PROG.ship=id;curShip=effectiveShip(shipById(id));saveProg();rebuildShip();}
/* equip a paint, buying it first if it is a locked credit paint you can afford; every hull is rebuilt in the new finish */
function buyOrEquipPaint(p){
  if(!paintOwned(p)){if(!p.cost||PROG.credits<p.cost)return false;PROG.credits-=p.cost;PROG.paints=(PROG.paints||[]).concat(p.id);}
  PROG.paint=p.id;saveProg();
  for(const k in shipThumbCache)delete shipThumbCache[k];
  for(const k in stageHulls)delete stageHulls[k];
  rebuildShip();
  return true;
}
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
/* every campaign op before the Admiral finale cleared: opens Free Trench and Free Dogfight on the title screen */
const campaignDone=()=>MISSIONS.every(m=>m.finale||PROG.completed[m.id]);
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
  if(b.type==='bridge')return S.bridgeUsed;   // the command bridge was opened
  if(b.type==='autopilot')return S.autoT>=b.val;   // seconds your ship flew itself on an order
  if(b.type==='squads')return S.sqLaunched>=b.val;   // squadrons launched from the hangar
  if(b.type==='fleetorder')return S.fleetOrders>=b.val;   // Admiral ops: orders given to the whole fleet from the bridge's FLEET row
  if(b.type==='allies')return S.alliesLost<=b.val;   // destroyers lost (SOLACE, the allies and the reserve)
  if(b.type==='reserve')return S.reserveUsed;   // the reserve was called in
  if(b.type==='screen')return S.screenCatch>=b.val;   // enemy shells your destroyers caught for HALCYON (screen role or formation)
  if(b.type==='admiral')return !!S.adm&&S.adm.silenced;   // the enemy admiral silenced: its flagship's bridge shot out, or the flagship sunk
  if(b.type==='gate')return S.gateSent<=b.val;   // ships the Kiru Gate sent through before it fell (a win means it fell)
  if(b.type==='wing'){const own=sqMembers(0);return own.length>0&&own.every(w=>!w.dead);}
  return false;
}
