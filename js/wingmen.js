"use strict";
/* Friendly wingmen: two AI fighters that fly with you in the arena modes. Number keys give the whole wing
   an order (setWingOrder); the command bridge (js/bridge.js) can also give one wingman its own order, set it
   on a hostile or have it guard a friendly capital (setWingmanOrder). The flight AI is in js/update/wingmen.js.

   Squadrons: squadron 0 is your own wing (Pike and Lark, formed on you, number keys). Squadrons 1 and 2 (TALON,
   WRAITH) are launched from HALCYON's bay on the command bridge (launchSquadron, one of the carrier's `squads`). Each is two pilots under a leader (its first living pilot) with its own order: FORM UP means hold
   station off HALCYON instead of off you. Every wingman carries `sq`, its squadron's index. Squadron orders go
   through setSquadOrder(q,o), so any front end (the bridge today) can drive them. */

const WING_CALLSIGNS=['PIKE','LARK','DRIFT','CINDER'];
const WING_ORDERS={form:{key:'1',name:'FORM UP'},target:{key:'2',name:'ATTACK MY TARGET'},free:{key:'3',name:'FREE ENGAGE'},
  cover:{key:'4',name:'COVER ME'},defend:{key:'5',name:'DEFEND HALCYON'},strike:{key:'6',name:'STRIKE CAPITAL'}};
/* formation slot in the player's frame (-z is ahead): off each wing and out in front, so they sit in view */
const WING_SLOT=new THREE.Vector3(30,-3,-55);
const WING_HP=90, WING_HIT_R=5;
const WING_SCALE=1.3;   // the real hulls, a little over life size so they read at formation range
const WING_BOLT_DMG=8;   // hull lost per enemy bolt (90 / 8 = twelve hits to down a wingman)
const SQUAD_DEFS=[{name:'WING'},
  {name:'TALON',col:0xffb300,mat:'amber',calls:['TALON-1','TALON-2']},
  {name:'WRAITH',col:0xff2bd6,mat:'mag',calls:['WRAITH-1','WRAITH-2']},
  {name:'SABRE',col:0x5dff8a,mat:'green',calls:['SABRE-1','SABRE-2']}];   // SABRE only flies in co-op, led by the fourth pilot (js/coop.js)
const squadrons=SQUAD_DEFS.map(()=>({order:'form',up:false,idx:[]}));   // order: the squadron's (0 uses S.wingOrder); up: launched; idx: its two slots in wingmen
const sqMembers=q=>wingmen.filter(w=>(w.sq||0)===q);
const sqAlive=q=>wingmen.filter(w=>!w.dead&&(w.sq||0)===q);
const sqOrder=q=>q?squadrons[q].order:S.wingOrder;
const wingmen=[];   // {mesh,callsign,slot,spd,wvel,up,fireT,trailT,hp,dead,tgt,tgtT,order,focus,guard}

/* The hull a wingman flies: one of the hulls you own. The ones you are not flying come first, so the wing reads as
   different ships from yours; with only one hull, they fly it too. n: the pilot's place (0 PIKE, 1 LARK, ...). */
function wingShipId(n){
  const spare=PROG.shipsOwned.filter(id=>id!==PROG.ship),pool=spare.length?spare:[PROG.ship];
  return shipById(pool[(n||0)%pool.length]).id;
}
/* a wingman's hull: the real ship model (js/ship.js) in its factory finish, with a squadron's colour on the edge lines
   (q: 0 your wing keeps the hull's own). Built once per hull and colour, then cloned, so the clones share geometry and
   materials. No point light: the live ship's fill light would cost a shader rebuild for every wingman launched. */
const WING_HULLS={};
function buildWingman(id,q){
  q=q||0;id=shipById(id||wingShipId(0)).id;
  const k=id+':'+q;
  if(!WING_HULLS[k]){
    const v=shipById(id).visual,c=q?SQUAD_DEFS[q].col:null;
    const ext=buildShipExterior(c?Object.assign({},v,{edgeColor:c,edgeColor2:c}):v,true);
    const lights=[];ext.group.traverse(o=>{if(o.isLight)lights.push(o);});lights.forEach(o=>o.parent.remove(o));
    ext.group.userData.r=new THREE.Box3().setFromObject(ext.group).getSize(new THREE.Vector3()).length()/2;
    ext.group.userData.shared=true;   // clearWingmen must not dispose geometry the template still uses
    WING_HULLS[k]=ext.group;
  }
  const g=WING_HULLS[k].clone();g.userData={r:WING_HULLS[k].userData.r,shared:true,id};
  return g;
}
function newWingman(i,callsign,q){
  q=q||0;
  const n=q?q*2+i:Math.max(0,WING_CALLSIGNS.indexOf(callsign)),hullId=wingShipId(n);   // PIKE and LARK first, then the bay's and squadrons' pilots
  const mesh=buildWingman(hullId,q);
  if(!q&&!S.wingFlown.includes(callsign))S.wingFlown.push(callsign);
  mesh.scale.setScalar(WING_SCALE);addBeacon(mesh,q?SQUAD_DEFS[q].col:0x00f0ff);
  mesh.position.set((i?1:-1)*WING_SLOT.x,WING_SLOT.y,WING_SLOT.z).applyQuaternion(ship.quaternion).add(ship.position);scene.add(mesh);
  return {mesh,hullId,callsign,slot:i?1:-1,spd:140,wvel:new THREE.Vector3(0,0,-60),up:new THREE.Vector3(0,1,0),fireT:.5+i*.25,trailT:0,hp:wingHullMax(),maxHp:wingHullMax(),dead:false,tgt:null,tgtT:0,launch:0,
    order:null,focus:null,guard:null,sq:q};   // order: this wingman's own (null follows the wing); focus: what 'focus' attacks; guard: what 'defend' guards
}
/* two wingmen: in formation already, or launching one after the other from the carrier's bay when there is one */
function spawnWingmen(){
  clearWingmen();
  const K=carrierShip();
  for(let i=0;i<2;i++){
    const W=newWingman(i,WING_CALLSIGNS[i]);wingmen.push(W);
    if(K){
      if(S.launchT>0)capLaunchWingman(K,W,1.7+i*1.1,i?9:-9);   // wait in the bay either side of you until you are clear
      else capLaunchWingman(K,W,.4+i*1.4);
    }
  }
  S.wingOrder='form';
  setWingOrderHud();
}
function clearWingmen(){
  wingmen.forEach(w=>{if(!w.dead)scene.remove(w.mesh);if(!w.mesh.userData.shared)freeGeo(w.mesh);});wingmen.length=0;
  for(const sq of squadrons){sq.order='form';sq.up=false;sq.idx.length=0;}
  S.wingOrder='form';wingHud.style.display='none';
}
/* can order o be given right now? (says why not if it can't) */
function wingOrderOk(o){
  if(o==='defend'&&!wingDefendAnchor()){announce('NO CARRIER','Nothing to defend','ace');return false;}
  if(o==='strike'&&!capTargets.length){announce('NO CAPITAL TARGETS','Nothing to strike','ace');return false;}
  return true;
}
/* a whole squadron (q: 0 is your wing): also clears any of its pilots' own orders */
function setSquadOrder(q,o){
  if(!q&&COOP.live&&netGuest()){if(WING_ORDERS[o]){netSend({t:'sqo',o});ORD.used=true;sfx('acquire');}return;}   // co-op: your squadron flies in the host's game
  if(!sqMembers(q).length||!WING_ORDERS[o]||!wingOrderOk(o))return;
  if(q)squadrons[q].order=o;else S.wingOrder=o;
  for(const w of sqMembers(q)){w.order=null;w.focus=w.guard=null;}
  setWingOrderHud();sfx('acquire');
}
/* your own wing (number keys) */
const setWingOrder=o=>setSquadOrder(0,o);
/* launch squadron q from HALCYON's bay (the bridge): two pilots from the carrier's hangar, holding at the carrier until ordered */
function launchSquadron(q){
  const K=carrierShip(),sq=squadrons[q];
  if(!q||!sq||!K||K.state!=='fight'||sqAlive(q).length||!toolOn('squads'))return false;
  if(K.squads<=0){announce('NO SQUADRONS','HALCYON has none left to launch','ace');return false;}
  K.squads--;S.sqLaunched++;sq.up=true;sq.order='form';
  for(let j=0;j<2;j++){
    const W=newWingman(j,SQUAD_DEFS[q].calls[j],q);
    if(sq.idx[j]!=null)wingmen[sq.idx[j]]=W;else{sq.idx[j]=wingmen.length;wingmen.push(W);}
    capLaunchWingman(K,W,.5+j*1.3,j?9:-9);
  }
  setWingOrderHud();sfx('acquire');
  announce(SQUAD_DEFS[q].name+' SQUADRON LAUNCHING','From '+K.T.name+' · '+K.squads+' left in the hangar','');
  return true;
}
/* one wingman's own order (the bridge): an order id, 'focus' on a hostile (ref: a fighter, a capital part or a
   whole capital), 'defend' a friendly capital (ref), or null to fall back in with the wing */
function setWingmanOrder(w,o,ref){
  if(w.dead)return false;
  if(o&&o!=='focus'&&(!WING_ORDERS[o]||!(o==='defend'&&ref)&&!wingOrderOk(o)))return false;
  w.order=o;w.focus=o==='focus'?ref:null;w.guard=o==='defend'?ref||null:null;w.tgt=null;w.tgtT=0;
  setWingOrderHud();return true;
}
const wingOrderOf=w=>w.order||sqOrder(w.sq||0);
const wingFocusName=F=>F.g?F.T.name:targetName(F);
/* what a wingman is doing, for the HUD and the bridge */
function wingOrderName(w){
  const o=wingOrderOf(w);
  if(o==='focus')return 'ATTACK '+wingFocusName(w.focus);
  if(o==='defend'&&w.guard)return 'DEFEND '+w.guard.T.name;
  if(o==='form'&&w.sq)return 'HOLD AT HALCYON';
  return WING_ORDERS[o].name;
}
/* a wingman takes a hit; at zero it blows up, the callout goes up and the HUD marks it lost */
function hitWingman(w,dmg){
  if(w.dead)return;
  if(w.human){coopHitPilot(w,dmg);return;}   // another player's ship: their game takes the hit (js/coop.js)
  w.hp-=dmg;spark(w.mesh.position,0x00f0ff,6);
  if(w.hp<=0){
    w.dead=true;w.hp=0;S.wingDowned.push(w.callsign);
    const q=w.mesh.position;
    spark(q,0xff5500,24,38);spark(q,0xffb300,12,28);burst(q,0xff7733,1.3);shatter(q,6,1);
    sfx('boom',q);scene.remove(w.mesh);
    announce(w.callsign+' DOWN','Wingman lost','ace');
    if(!w.sq&&sqMembers(0).every(x=>x.dead)&&S.wingOrder!=='form')S.wingOrder='form';
  }
  setWingOrderHud();
}
/* the squadron board, bottom left: a row per squadron with its colour, name and order, then its pilots' hull.
   A squadron just given an order flashes (js/orders.js). */
function setWingOrderHud(){
  wingHud.style.display=wingmen.length?'block':'none';
  if(bl.offsetHeight)wingHud.style.bottom=(bl.offsetHeight+28)+'px';   // stack above the shield/hull panel, whatever its height (they overlapped)
  let h='';
  for(let q=0;q<squadrons.length;q++){
    const mem=sqMembers(q);if(!mem.length)continue;
    const name=sqOrderName(q),alive=mem.some(w=>!w.dead);
    h+='<div class="sqb'+(alive?'':' gone')+ordFlashStyle(q)+'"><div class="sqh" style="--c:'+ORD_COL[q]+'"><i></i><b>'+SQUAD_DEFS[q].name+'</b><span>'+name+'</span></div>';
    for(const w of mem){
      const n=Math.ceil(w.hp/w.maxHp*5);
      h+='<div class="sqp">'+w.callsign+' '+(w.dead?'<span class="wlost">LOST</span>':'<span class="wbar">'+'▮'.repeat(n)+'<i>'+'▮'.repeat(5-n)+'</i></span>'
        +(w.order&&wingOrderName(w)!==name?' <span class="wown">'+wingOrderName(w)+'</span>':''))+'</div>';
    }
    h+='</div>';
  }
  if(!ORD.used&&wingmen.some(w=>!w.dead))h+='<div class="sqk">'+(padActive()?'Hold <b>LB</b>':'Hold <b>'+keyLabel(ordKey())+'</b>')+' for orders</div>';
  wingHud.innerHTML=h;
}
