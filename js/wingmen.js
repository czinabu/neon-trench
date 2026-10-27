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
const WING_BOLT_DMG=8;   // hull lost per enemy bolt (90 / 8 = twelve hits to down a wingman)
const SQUAD_DEFS=[{name:'WING'},
  {name:'TALON',col:0xffb300,mat:'amber',calls:['TALON-1','TALON-2']},
  {name:'WRAITH',col:0xff2bd6,mat:'mag',calls:['WRAITH-1','WRAITH-2']}];
const squadrons=SQUAD_DEFS.map(()=>({order:'form',up:false,idx:[]}));   // order: the squadron's (0 uses S.wingOrder); up: launched; idx: its two slots in wingmen
const sqMembers=q=>wingmen.filter(w=>(w.sq||0)===q);
const sqAlive=q=>wingmen.filter(w=>!w.dead&&(w.sq||0)===q);
const sqOrder=q=>q?squadrons[q].order:S.wingOrder;
const wingmen=[];   // {mesh,callsign,slot,spd,wvel,up,fireT,trailT,hp,dead,tgt,tgtT,order,focus,guard}

function buildWingman(){
  const g=new THREE.Group();
  const hull=new THREE.Mesh(sharedGeo('wgBody',()=>new THREE.ConeGeometry(.9,5,8).rotateX(-Math.PI/2)),M.dark2);g.add(hull);
  for(const sx of[-1,1]){
    const wing=new THREE.Mesh(sharedGeo('wgWing',()=>new THREE.BoxGeometry(3.2,.12,2.2)),M.dark);wing.position.set(sx*1.9,0,.9);g.add(wing);
    const tip=new THREE.Mesh(sharedGeo('wgTip',()=>new THREE.BoxGeometry(.2,.3,2.3)),M.cyan);tip.position.set(sx*3.4,0,.9);g.add(tip);
  }
  const eng=new THREE.Mesh(sharedGeo('wgEng',()=>new THREE.SphereGeometry(.45,8,6)),M.flame);eng.position.set(0,0,2.5);g.add(eng);
  return g;
}
function newWingman(i,callsign,q){
  q=q||0;
  const mesh=buildWingman();
  if(q)for(const m of mesh.children)if(m.material===M.cyan)m.material=M[SQUAD_DEFS[q].mat];   // squadron colours on the wingtips
  if(!q&&!S.wingFlown.includes(callsign))S.wingFlown.push(callsign);
  mesh.scale.setScalar(1.6);addBeacon(mesh,q?SQUAD_DEFS[q].col:0x00f0ff);
  mesh.position.set((i?1:-1)*WING_SLOT.x,WING_SLOT.y,WING_SLOT.z).applyQuaternion(ship.quaternion).add(ship.position);scene.add(mesh);
  return {mesh,callsign,slot:i?1:-1,spd:140,wvel:new THREE.Vector3(0,0,-60),up:new THREE.Vector3(0,1,0),fireT:.5+i*.25,trailT:0,hp:wingHullMax(),maxHp:wingHullMax(),dead:false,tgt:null,tgtT:0,launch:0,
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
  wingmen.forEach(w=>{if(!w.dead)scene.remove(w.mesh);});wingmen.length=0;
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
function setWingOrderHud(){
  const o=WING_ORDERS[S.wingOrder];
  wingHud.style.display=wingmen.length?'block':'none';
  const pilot=w=>{
    const n=Math.ceil(w.hp/w.maxHp*5);
    return '<br>'+w.callsign+' '+(w.dead?'<span class="wlost">LOST</span>':'<span class="wbar">'+'▮'.repeat(n)+'<i>'+'▮'.repeat(5-n)+'</i></span>'
      +(w.order?' <span class="wown">'+wingOrderName(w)+'</span>':''));
  };
  const own=sqMembers(0),alive=own.some(w=>!w.dead);
  let h=alive?'WING // '+o.name:'WING // NONE LEFT';
  if(alive&&S.wingOrder==='form')h+='<br><span class="wlost">4 COVER · 5 DEFEND · 6 STRIKE</span>';
  for(const w of own)h+=pilot(w);
  for(let q=1;q<squadrons.length;q++){   // launched squadrons, ordered from the bridge
    const mem=sqMembers(q);if(!mem.length)continue;
    h+='<br>'+SQUAD_DEFS[q].name+' // '+(mem.some(w=>!w.dead)?(squadrons[q].order==='form'?'HOLD AT HALCYON':WING_ORDERS[squadrons[q].order].name):'NONE LEFT');
    for(const w of mem)h+=pilot(w);
  }
  wingHud.innerHTML=h;
}
