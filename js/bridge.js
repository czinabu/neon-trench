"use strict";
/* Command bridge (B, in an arena run with HALCYON on station): step onto the carrier's tactical view mid-battle.
   The game slows to BRIDGE.slow (js/config.js), the mouse is freed, and an orbiting camera looks down on the
   fight with a marker on every ship. Pick a unit in the panel (a squadron, one wingman, or HALCYON / SOLACE)
   and give it an order from its buttons, or click a marker: a hostile to attack it, a friendly capital for the
   wing to guard. Select YOU to give your own ship an order and fly it on autopilot (js/autopilot.js); otherwise it holds its course. B or Esc goes back to the cockpit.
   Squadrons: your wing plus up to two more (TALON, WRAITH) launched from HALCYON's bay with the squadron's Launch
   button; each takes its own orders. A squadron's leader marker carries its name: click it to select the squadron,
   click again for the single pilot. The squadron model is in js/wingmen.js (squadrons, setSquadOrder, launchSquadron).
   Move HALCYON or SOLACE: select it and click empty space on the map (a click, not a drag) to send it to a waypoint
   there; Fall back runs it away from the enemy line, Hold here stops it, and SOLACE can keep a formation off HALCYON.
   Those orders are fleetMoveTo, fleetFallBack, fleetHold, fleetFormation in js/fleet.js, for mission scripts as well.
   In campaign ops each tool opens one op at a time (CDR_TOOLS in js/data/ranks.js, toolOn in js/progression.js): the bridge, then squadrons,
   autopilot, fleet movement and formations. A locked tool is hidden from the panel. The orders themselves live in js/wingmen.js (setWingOrder, setWingmanOrder) and js/fleet.js (focus, stance);
   updateCamera (js/update/camera.js) hands the camera to bridgeCamera while the bridge is up.
   Admiral ops add a FLEET row at the top of the list (toolOn('groups')): its orders go to every friendly capital at once
   (fleetAll in js/fleet.js), a click on an enemy capital sends every group at it, and with a reserve to hand (toolOn('reserve'))
   Call in arms a map click that warps the reserve destroyer in there (fleetCallReserve).
   Two views: the live view (the default for now), the orbiting camera out over the fight itself,
   and the command room (js/holoroom.js), HALCYON's command deck with the battle on a holo-globe. V swaps them; both share the orbit, pan and zoom. */

let bdgSel='wing';   // selected unit: 'fleet' (every friendly capital), 'wing' (your squadron) or 'sq1' / 'sq2' (launched or in the bay), 'me' (your own ship), 'w0'.. (a wingman slot), or 'c:'+name (a friendly capital)
let bdgArm=null;     // 'reserve': the next click on open map calls the reserve in there
let bdgDrag=null;    // drag in progress {x,y,pan}: orbit, or pan (right / middle / shift-drag)
const bdgKeys={};    // pan keys held (W A S D / arrows), kept apart from S.keys so they never fly the ship
let bdgList=[];      // this frame's markers, by index (a marker's data-m)
let bdgPanelT=0;     // the panel's status refresh timer (real seconds)
let bdgView='live';  // 'live': the camera out over the fight (the default for now), or 'holo': the command room's holo-globe (js/holoroom.js)
const bdgCam={yaw:0,pitch:1,dist:540};
let bdgFollow=false;   // the view tracks the selected unit as it moves; any manual pan breaks it, selecting a unit resumes it
const bdgPan=new THREE.Vector3();   // how far the view has been panned off the middle of the fight (x, z)
const bdgC=new THREE.Vector3(), bdgT=new THREE.Vector3(), bdgP=new THREE.Vector3(), bdgV=new THREE.Vector3(), bdgV2=new THREE.Vector3();
const bdgPool=[];
const BDG_STANCES=[['hold','Hold position'],['close','Close in'],['back','Return to station']];

const bridgeAvailable=()=>S.mode==='play'&&S.sector==='arena'&&!S.school&&S.launchT<=0&&!!carrierShip()&&carrierShip().state==='fight';
function bridgeOpen(){
  if(S.bridge)return;
  if(S.mode==='play'&&S.mission&&!toolOn('bridge')){announce('BRIDGE LOCKED','Commander rank required','');return;}
  if(!bridgeAvailable()){announce('NO BRIDGE',S.launchT>0?'Clear the bay first':'HALCYON is not on station','');return;}
  S.bridge=S.bridgeUsed=true;
  for(const k in S.keys)S.keys[k]=false;
  S.fireHeld=S.zoomHeld=false;S.cursor.x=S.cursor.y=0;
  // the camera starts where it is and swings up over the fight from that side
  bridgeCentre(bdgC);bdgV.copy(camera.position).sub(bdgC);
  bdgCam.yaw=Math.atan2(bdgV.x,bdgV.z);bdgCam.pitch=1;bdgCam.dist=540;bdgPan.set(0,0,0);bdgFollow=false;
  if(S.cam==='fp'){cockpit.visible=false;for(const m of shipFpHide)m.visible=true;}   // seen from outside, the whole hull
  document.body.classList.add('bridge');bdgUI.style.display='block';
  if(!bdgUnit())bdgSel=wingmen.some(w=>!w.dead)?'wing':'c:'+carrierShip().T.name;
  holoSnap=true;bdgPanelT=0;renderBridgePanel();
  document.exitPointerLock&&document.exitPointerLock();
  sfx('acquire');
}
/* back to the cockpit (B or Esc) */
function bridgeClose(){
  if(!S.bridge)return;
  bridgeHide();setCam(S.cam);
  if(!isTouch&&S.mode==='play')renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();
}
/* take the bridge down without asking for the mouse back (the run ending or restarting) */
function bridgeHide(){
  S.bridge=false;bdgDrag=null;for(const k in bdgKeys)bdgKeys[k]=false;
  document.body.classList.remove('bridge');bdgUI.style.display='none';
}
/* the middle of the fight: every capital still afloat, and you */
function bridgeCentre(out){
  out.copy(ship.position);let n=1;
  for(const C of capitals)if(C.state!=='wreck'){out.add(C.g.position);n++;}
  return out.multiplyScalar(1/n);
}

/* ---- units and orders ---- */
/* the selected unit {kind:'wing'|'me'|'wingman'|'cap', q, bay, w, C}, or null if it is gone. A squadron in the bay
   (not launched, or all lost) is {kind:'wing',q,bay:true}: all it takes is a Launch order. */
const bdgFleetOn=()=>toolOn('groups')&&S.fleet&&fleetShips().length>0;
function bdgUnit(){
  if(bdgSel==='fleet')return bdgFleetOn()?{kind:'fleet'}:null;
  if(bdgSel==='me')return toolOn('auto')?{kind:'me'}:null;
  if(bdgSel==='wing'||/^sq\d$/.test(bdgSel)){
    const q=bdgSel==='wing'?0:+bdgSel[2];
    if(q&&!toolOn('squads'))return null;
    if(sqAlive(q).length)return {kind:'wing',q};
    const K=carrierShip();
    return q&&squadrons[q]&&K&&K.state==='fight'?{kind:'wing',q,bay:true}:null;
  }
  if(bdgSel[0]==='w'){const w=wingmen[+bdgSel.slice(1)];return w&&!w.dead?{kind:'wingman',w}:null;}
  const C=capitals.find(o=>o.friendly&&o.state==='fight'&&o.T.name===bdgSel.slice(2));
  return C?{kind:'cap',C}:null;
}
const bdgWingOf=U=>U.kind==='wing'?sqAlive(U.q):U.kind==='me'||U.kind==='cap'||U.kind==='fleet'?[]:[U.w];
/* the camera swings to the selected unit (a squadron: the middle of its pilots); panning afterwards moves it off again */
function bdgFocus(){
  const U=bdgUnit();if(!U||U.kind==='fleet')return;
  if(U.kind==='me')bdgV.copy(ship.position);
  else if(U.kind==='cap')bdgV.copy(U.C.g.position);
  else if(U.kind==='wingman')bdgV.copy(U.w.mesh.position);
  else{const m=sqAlive(U.q);if(!m.length)return;bdgV.set(0,0,0);for(const w of m)bdgV.add(w.mesh.position);bdgV.multiplyScalar(1/m.length);}
  bdgPan.copy(bdgV).sub(bridgeCentre(bdgT));
}
function bdgSelect(id){bdgSel=id;bdgArm=null;bdgFollow=true;bdgFocus();sfx('tick');renderBridgePanel();}
/* swap between the command room's holo-globe and the live view over the fight (V, or the panel's button) */
function bdgSetView(v){bdgView=v;holoSnap=true;bdgZoom(1);sfx('tick');renderBridgePanel();}
/* an order button: a wing order, a wingman's own order ('' = back with the wing), or a capital's fire / stance */
function bdgOrder(o,kind){
  const U=bdgUnit();if(!U)return;
  if(U.kind==='wing'){
    if(kind==='launch'){if(launchSquadron(U.q)){bdgPanelT=0;renderBridgePanel();}return;}
    if(!U.bay)setSquadOrder(U.q,o);
  }
  else if(U.kind==='fleet'){
    if(kind==='reserve'){bdgArm=bdgArm||!reserveReady()?null:'reserve';sfx('tick');}
    else if(kind==='fleetform'){if(fleetAll('form',o))sfx('acquire');}
    else if(fleetAll(o))sfx('acquire');
  }
  else if(U.kind==='me'){if(setSelfOrder(o||null))sfx('acquire');}
  else if(U.kind==='wingman'){if(setWingmanOrder(U.w,o||null))sfx('acquire');}
  else if(kind==='fire'){U.C.focus=U.C.focusSys=null;sfx('acquire');}
  else if(kind==='retreat'){if(toolOn('move')&&fleetFallBack(U.C))sfx('acquire');}
  else if(kind==='stay'){if(toolOn('move')&&fleetHold(U.C))sfx('acquire');}
  else if(kind==='form'){if(toolOn('form')&&fleetFormation(o,U.C))sfx('acquire');}
  else if(kind==='role'){if(toolOn('groups')&&fleetSetRole(U.C,o))sfx('acquire');}
  else{if(fleetSetStance(U.C,o))sfx('acquire');}
  renderBridgePanel();
}
/* a marker click: select a wingman, have the wing guard a friendly capital, or set the selected unit on a hostile */
function bdgMark(M){
  const U=bdgUnit();
  if(M.kind==='w'){   // a squadron's pilot: the squadron first, then the single pilot on a second click
    const q=wingmen[M.i].sq||0,sid=q?'sq'+q:'wing';
    bdgSelect(bdgSel===sid&&sqAlive(q).length>1?'w'+M.i:sid);return;
  }
  if(M.kind==='y'){if(toolOn('auto'))bdgSelect('me');return;}
  if(M.kind==='g'){bdgSelect('c:'+M.C.T.name);return;}   // a waypoint: its ship
  if(M.kind==='ed')return;   // a capital still warping in or going up
  if(M.kind==='f'){
    if(!U||U.kind==='cap'||U.kind==='fleet'){bdgSelect('c:'+M.C.T.name);return;}
    if(U.kind==='me'){if(setSelfOrder('defend',M.C))sfx('acquire');renderBridgePanel();return;}
    for(const w of bdgWingOf(U))setWingmanOrder(w,'defend',M.C);
    sfx('acquire');renderBridgePanel();return;
  }
  if(!U)return;
  if(U.kind==='fleet'){   // every group at one enemy capital (or one of its parts)
    if(M.kind==='x'){announce('TOO FAST','Broadsides can\'t track fighters','');return;}
    if(!fleetAll('engage',M.C,M.E&&M.E.cap?M.E:null)){announce('OUT OF THE LINE',M.C.T.name+' is not in the battle line','');return;}
  }else if(U.kind==='cap'){
    if(!U.C.fleet){announce('NO BROADSIDES',U.C.T.name+' has no broadside guns','');return;}
    if(M.kind==='x'){announce('TOO FAST','Broadsides can\'t track fighters','');return;}
    if(!M.C.fleet){announce('OUT OF THE LINE',M.C.T.name+' is not in the battle line','');return;}
    U.C.focus=M.C;U.C.focusSys=M.E&&M.E.cap?M.E:null;
  }else if(U.kind==='me'){if(!setSelfOrder('focus',M.E||M.C))return;}
  else for(const w of bdgWingOf(U))setWingmanOrder(w,'focus',M.E||M.C);
  sfx('acquire');renderBridgePanel();
}
const BDG_PAN_KEYS=/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right))$/;
/* keys while on the bridge: B / Esc / P back to the cockpit, V the holo-globe or live view, W A S D / arrows pan, C or Home recentres, 1-6 order the selected wing unit, Q / E the previous / next squadron or ship, Tab the next unit including pilots */
function bridgeKey(e){
  const c=e.code;
  if(c==='KeyB'||c==='Escape'||c==='KeyP'){bridgeClose();return;}
  if(c==='KeyC'||c==='Home'){bdgFollow=false;bdgPan.set(0,0,0);return;}   // recentre on the fight
  if(BDG_PAN_KEYS.test(c)){bdgKeys[c]=true;return;}
  if(c==='KeyN'){setMuted(!S.muted);return;}
  if(c==='KeyV'){bdgSetView(bdgView==='holo'?'live':'holo');return;}
  if(c==='KeyQ'||c==='KeyE'){   // step through the squadrons and ships, skipping single pilots
    const ids=bdgUnitRows().filter(u=>!u.off&&!/^w\d+$/.test(u.id)).map(u=>u.id);
    let i=ids.indexOf(bdgSel);if(i<0){const w=wingmen[+bdgSel.slice(1)];i=ids.indexOf(w&&w.sq?'sq'+w.sq:'wing');}
    if(ids.length)bdgSelect(ids[(i+(c==='KeyE'?1:ids.length-1))%ids.length]);return;}
  if(c==='Tab'){const ids=bdgUnitRows().filter(u=>!u.off).map(u=>u.id);
    if(ids.length)bdgSelect(ids[(ids.indexOf(bdgSel)+1)%ids.length]);return;}
  const n=/^Digit([1-6])$/.exec(c);
  if(n){const o=Object.keys(WING_ORDERS).find(k=>WING_ORDERS[k].key===n[1]),U=bdgUnit();
    if(U&&U.kind==='me'){if(setSelfOrder(o))sfx('acquire');renderBridgePanel();}
    else if(U&&U.kind==='wingman'){if(setWingmanOrder(U.w,o))sfx('acquire');renderBridgePanel();}
    else if(!U||U.kind!=='wing')setSquadOrder(0,o);
    else if(!U.bay)setSquadOrder(U.q,o);}
}

/* ---- the panel: units down the top, the selected unit's orders below ---- */
const bdgPips=(k,n)=>'<span class="bp">'+'▮'.repeat(k)+'<i>'+'▮'.repeat(n-k)+'</i></span>';
const bdgSqOrderName=q=>q&&squadrons[q].order==='form'?'HOLD AT HALCYON':WING_ORDERS[sqOrder(q)].name;
const bdgRoleBusy=C=>C.kind==='escort'&&!C.held&&C.stance==='hold'&&C.role!=='line';   // nothing else moving it: its role is
const bdgMoveTxt=C=>(C.retreat?'FALLING BACK':C.goal?'MOVING':C.form!=='free'?FLEET_FORMS[C.form]:bdgRoleBusy(C)?(C.role==='screen'?'Screening HALCYON':'Standing off')
  :BDG_STANCES.find(s=>s[0]===C.stance)[1]).toUpperCase();
const bdgRoleTag=C=>C.fleet&&C.role&&C.role!=='line'?FLEET.roles[C.role].name.toUpperCase()+' · ':'';
const bdgDamaged=C=>C.hp<C.T.hp*.4;
const bdgFocusTxt=C=>C.focus?C.focus.T.name+(C.focusSys?' '+C.focusSys.T.short:''):'Free fire';
function bdgUnitRows(){
  const rows=[];
  if(bdgFleetOn()){const f=fleetMark();
    rows.push({id:'fleet',name:'FLEET',sub:fleetShips().length+' GROUPS · '+(f?'ENGAGING '+f.T.name:'FREE FIRE')+(reserveReady()?' · RESERVE READY':'')});}
  if(toolOn('auto'))rows.push({id:'me',name:'YOU',sub:S.auto?'AUTOPILOT · '+selfOrderName():'MANUAL',bar:bdgPips(Math.max(0,Math.min(5,Math.ceil(S.hull/100*5))),5)});
  for(let q=0;q<squadrons.length;q++){
    const mem=sqMembers(q),alive=sqAlive(q).length>0,K=carrierShip(),can=!!K&&K.state==='fight'&&K.squads>0;
    if(q&&(!alive&&!K||!toolOn('squads')))continue;
    if(!q&&!mem.length)continue;
    const lead=sqAlive(q)[0];
    rows.push({id:q?'sq'+q:'wing',name:q?SQUAD_DEFS[q].name:'WING',off:q?!alive&&!can:!alive,
      sub:alive?(q?'LEAD '+lead.callsign+' · ':'')+bdgSqOrderName(q):q?(mem.length?'LOST · ':'IN BAY · ')+(can?'LAUNCH':'HANGAR EMPTY'):'NONE LEFT'});
    const open=bdgSel===(q?'sq'+q:'wing')||/^w\d+$/.test(bdgSel)&&((wingmen[+bdgSel.slice(1)]||{}).sq||0)===q;   // a squadron's pilots show only while it, or one of them, is selected
    wingmen.forEach((w,i)=>{if(open&&(w.sq||0)===q)rows.push({id:'w'+i,name:w.callsign,off:w.dead,
      sub:w.dead?'LOST':w.launch>0?'LAUNCHING':wingOrderName(w)+(w.order?'':q?' · WITH SQUADRON':' · WITH WING'),bar:w.dead?'':bdgPips(Math.ceil(w.hp/w.maxHp*5),5)});});
  }
  for(const C of capitals)if(C.friendly&&C.state!=='wreck')rows.push({id:'c:'+C.T.name,name:C.T.name,off:C.state!=='fight',
    sub:C.state==='warp'?'WARPING IN':C.state!=='fight'?'LOST':C.fleet?bdgRoleTag(C)+bdgMoveTxt(C)+' · '+bdgFocusTxt(C).toUpperCase()
      :'POINT DEFENCE'+(C.kind==='carrier'?' · RSV '+C.reserve:''),bar:capBar(Math.ceil(C.hp/C.T.hp*10),10)});
  return rows;
}
const bdgBtn=(o,label,on,kind)=>'<button class="bdgo'+(on?' on':'')+'" data-o="'+o+'"'+(kind?' data-k="'+kind+'"':'')+'>'+label+'</button>';
function bdgOrdersHtml(U){
  if(!U)return '<div class="bdgTip">Nothing left to command.</div>';
  if(U.kind==='fleet'){
    const f=fleetMark(),res=S.reserveDef&&toolOn('reserve'),dds=fleetShips().filter(C=>C.kind==='escort'),adm=admTxt();
    return '<div class="bdgSub">Fleet // '+fleetShips().length+' battle groups</div><div class="bdgRow">'+bdgBtn('free','Free fire',false,'fleet')
      +bdgBtn('hold','Hold position',false,'fleet')+bdgBtn('back','Return to station',false,'fleet')
      +(toolOn('move')?bdgBtn('retreat','Fall back',false,'fleet'):'')
      +(f?'<span class="bdgOn">Engaging '+f.T.name+'</span>':'')+'</div>'
      +(toolOn('form')?'<div class="bdgSub">Destroyer formation off HALCYON</div><div class="bdgRow">'
        +Object.keys(FLEET_FORMS).filter(o=>o!=='free').map(o=>bdgBtn(o,FLEET_FORMS[o],dds.length>0&&dds.every(C=>C.form===o),'fleetform')).join('')+'</div>'
        +'<div class="bdgTip">Line abreast: every battery bears, more hits. Column: a narrow target, fewer hits taken. Screen: in front of HALCYON, catching shells meant for her.</div>':'')
      +(adm?'<div class="bdgSub bdgWarn">'+adm[0]+'</div><div class="bdgTip">'+adm[1]+'</div>':'')
      +(res?'<div class="bdgSub">Reserve</div><div class="bdgRow">'+(reserveReady()?bdgBtn('call',bdgArm==='reserve'?'Click the map to warp in':'Call in '+S.reserveDef.name,bdgArm==='reserve','reserve')
        :'<span class="bdgOn">'+S.reserveDef.name+' committed</span>')+'</div>':'')
      +'<div class="bdgTip">Orders here go to every ship at once. Click an enemy capital to send every group at it: the destroyers close to gun range and HALCYON fires from where she is; click one of its turrets or subsystems to aim the broadsides there. Select a single ship to order its group alone.'
      +(res&&reserveReady()?' Call in the reserve, then click open space on the map where it should drop out of warp.':'')+'</div>';
  }
  if(U.kind==='cap'){
    const C=U.C;
    if(!C.fleet)return '<div class="bdgSub">'+C.T.name+' // '+C.T.cls+'</div><div class="bdgTip">Point defence only: '+C.T.name
      +'\'s turrets pick their own targets'+(C.kind==='carrier'?', and the bay launches replacements while the reserve lasts.':'.')+'</div>';
    return '<div class="bdgSub">'+C.T.name+' // broadsides</div><div class="bdgRow">'+bdgBtn('free','Free fire',!C.focus,'fire')
      +(C.focus?'<span class="bdgOn">On '+bdgFocusTxt(C)+'</span>':'')+'</div>'
      +'<div class="bdgSub">Stance</div><div class="bdgRow">'+BDG_STANCES.map(([o,l])=>bdgBtn(o,l,!C.goal&&C.form==='free'&&C.stance===o&&!bdgRoleBusy(C),'stance')).join('')+'</div>'
      +(C.kind==='escort'&&toolOn('groups')?'<div class="bdgSub">Role</div><div class="bdgRow">'
        +Object.keys(FLEET.roles).map(o=>bdgBtn(o,FLEET.roles[o].name,C.role===o,'role')).join('')+'</div><div class="bdgTip">'+FLEET.roles[C.role].tip
        +(C.held&&C.role!=='line'?' Holding now: press its role again to send it back to that job.':'')+'</div>':'')
      +(!toolOn('move')?'':'<div class="bdgSub">Move'+(bdgDamaged(C)?' <span class="bdgWarn">hull '+Math.ceil(C.hp/C.T.hp*100)+'%, consider pulling back</span>':'')+'</div><div class="bdgRow">'
      +bdgBtn('retreat','Fall back',C.retreat,'retreat')+bdgBtn('stay','Hold here',false,'stay')
      +(C.goal&&!C.retreat?'<span class="bdgOn">Moving to waypoint</span>':'')+'</div>')
      +(C.kind==='escort'&&toolOn('form')?'<div class="bdgSub">Formation off HALCYON</div><div class="bdgRow">'
        +Object.keys(FLEET_FORMS).map(o=>bdgBtn(o,FLEET_FORMS[o],C.form===o,'form')).join('')+'</div>':'')
      +'<div class="bdgTip">'+(toolOn('move')?'Click open space on the map to send '+C.T.name+' there. ':'')+'Click an enemy capital to focus the broadsides on it, or one of its turrets or subsystems to shoot that out. '
      +'Closing in lands more shells, both ways.'+(toolOn('move')?' Fall back runs it clear of the enemy line.':'')+'</div>';
  }
  if(U.kind==='me')return '<div class="bdgSub">You // autopilot</div><div class="bdgRow">'+bdgBtn('','Take the stick',!S.auto)
    +Object.keys(SELF_ORDERS).map(o=>bdgBtn(o,WING_ORDERS[o].key+' '+SELF_ORDERS[o].toLowerCase(),S.auto===o)).join('')+'</div>'
    +(S.auto==='focus'||S.auto==='defend'?'<div class="bdgOn">On '+selfOrderName()+'</div>':'')
    +'<div class="bdgTip">Your ship flies the order itself, back in the cockpit too, until you touch the flight controls. '
    +'Click a hostile to attack it, or HALCYON or SOLACE to guard it.</div>';
  const wing=U.kind==='wing',q=wing?U.q:U.w.sq||0,sqn=q?SQUAD_DEFS[q].name+' squadron':'Wing';
  if(U.bay){
    const K=carrierShip(),can=K.squads>0;
    return '<div class="bdgSub">'+sqn+' // in the bay</div><div class="bdgRow">'+(can?bdgBtn('launch','Launch '+SQUAD_DEFS[q].name,false,'launch'):'<span class="bdgOn">Hangar empty</span>')+'</div>'
      +'<div class="bdgTip">Two fighters from HALCYON\'s hangar ('+K.squads+' squadron'+(K.squads===1?'':'s')+' left), led by '+SQUAD_DEFS[q].calls[0]
      +'. They hold station off HALCYON until you order them. Lost pilots are not replaced.</div>';
  }
  const cur=wing?sqOrder(q):U.w.order;
  return '<div class="bdgSub">'+(wing?sqn:U.w.callsign)+' // orders</div><div class="bdgRow">'
    +(wing?'':bdgBtn('','With '+(q?'squadron':'wing'),!cur))
    +Object.keys(WING_ORDERS).map(o=>bdgBtn(o,WING_ORDERS[o].key+' '+(o==='form'&&q?'hold at halcyon':WING_ORDERS[o].name.toLowerCase()),cur===o)).join('')+'</div>'
    +'<div class="bdgTip">Click a hostile (or a turret on a capital) to '+(wing?'send the '+(q?'squadron':'wing')+' at':'attack')+' it, or HALCYON or SOLACE to guard it.'
    +(q&&wing?' Squadron leaders fly the front; the 1-6 keys order whichever is selected.':'')+'</div>';
}
function renderBridgePanel(){
  if(!bdgUnit()){const r=bdgUnitRows().find(u=>!u.off);if(r)bdgSel=r.id;}
  const U=bdgUnit();
  const inRoom=bdgView==='holo';
  const h='<div class="bdgHead"><b>HALCYON BRIDGE</b><span>'+(inRoom?'Command room':'Live view')+' · time slowed · pan: right-drag or WASD · C centre · Q E squadrons</span></div>'
    +'<div class="bdgRow bdgView">'+bdgBtn('holo','Holo-globe',inRoom,'view')+bdgBtn('live','Live view',!inRoom,'view')+'<span class="bdgOn">V swaps</span></div><div class="bdgUnits">'
    +bdgUnitRows().map(u=>'<button class="bdgu'+(u.id===bdgSel?' sel':'')+(u.off?' off':'')+'" data-u="'+u.id+'"'+(u.off?' disabled':'')+'><b>'+u.name+'</b>'
      +(u.bar||'')+'<span>'+u.sub+'</span></button>').join('')+'</div>'+bdgOrdersHtml(U);
  if(h!==bdgPanel._h){bdgPanel.innerHTML=h;bdgPanel._h=h;}
}
// mousedown rather than click: the panel can redraw between press and release
bdgUI.addEventListener('mousedown',e=>{
  if(!S.bridge)return;
  const b=e.target.closest('[data-u],[data-o],[data-m]');if(!b)return;
  e.preventDefault();e.stopPropagation();
  if(b.dataset.u!==undefined){if(!b.disabled)bdgSelect(b.dataset.u);}
  else if(b.dataset.k==='view'){if(b.dataset.o!==bdgView)bdgSetView(b.dataset.o);}
  else if(b.dataset.o!==undefined)bdgOrder(b.dataset.o,b.dataset.k);
  else{const M=bdgList[+b.dataset.m];if(M)bdgMark(M);}
});

/* ---- camera, markers and order lines (each frame, on real time) ---- */
function bridgeCamera(fr){
  const dt=fr.rdt||fr.dt;
  if(!bridgeAvailable()){bridgeClose();if(S.mode==='play'&&!carrierShip())announce('BRIDGE LOST','HALCYON is gone','ace');return;}
  const {yaw,pitch,dist}=bdgCam;
  const kx=Math.max(-1,Math.min(1,(bdgKeys.KeyD||bdgKeys.ArrowRight?1:0)-(bdgKeys.KeyA||bdgKeys.ArrowLeft?1:0)+padBdg.x));
  const kz=Math.max(-1,Math.min(1,(bdgKeys.KeyW||bdgKeys.ArrowUp?1:0)-(bdgKeys.KeyS||bdgKeys.ArrowDown?1:0)+padBdg.z));
  if(kx||kz){bdgFollow=false;const sp=dist*1.1*dt;   // across the ground, relative to the way the camera faces
    bdgPan.x+=(Math.cos(yaw)*kx-Math.sin(yaw)*kz)*sp;bdgPan.z+=(-Math.sin(yaw)*kx-Math.cos(yaw)*kz)*sp;}
  if(bdgFollow)bdgFocus();
  if(bdgPan.length()>ARENA_R*.8)bdgPan.setLength(ARENA_R*.8);   // (selecting a unit sets bdgPan to it, see bdgFocus)
  bdgC.lerp(bridgeCentre(bdgT).add(bdgPan),1-Math.exp(-3*dt));
  bdgP.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(dist).add(bdgC);
  if(bdgP.length()>ARENA_R-25)bdgP.setLength(ARENA_R-25);   // stay inside the arena's dome
  camera.position.lerp(bdgP,1-Math.exp(-5*dt));
  camera.up.set(0,1,0);camera.lookAt(bdgC);
  camera.fov+=(62-camera.fov)*Math.min(1,6*dt);camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  if(bdgView==='holo')holoUpdate(dt);   // the command room: its camera round the globe, and the hologram
  bridgeMarks();
  bdgPanelT-=dt;if(bdgPanelT<=0){bdgPanelT=.25;renderBridgePanel();}
}
/* where a world point lands on screen (false if it is behind the camera); in the command room, where it shows on the globe */
function bdgProject(pos,out){
  let cam=camera;
  if(bdgView==='holo'&&holo){holoMapPos(pos,out,true);pos=out;cam=holo.cam;}
  out.copy(pos).project(cam);if(out.z>1)return false;
  out.x=(out.x*.5+.5)*innerWidth;out.y=(-out.y*.5+.5)*innerHeight;return true;}
function bridgeMarks(){
  const U=bdgUnit(),list=[];
  const cap=U&&U.kind==='cap'?U.C:null,wsel=U?bdgWingOf(U):[];
  // what the selected unit is on, so its mark lights up
  const marks=new Set();
  if(cap){if(cap.focusSys)marks.add(cap.focusSys);else if(cap.focus)marks.add(cap.focus);}
  for(const w of wsel){if(w.focus)marks.add(w.focus);if(w.guard)marks.add(w.guard);}
  if(U&&U.kind==='me'){if(selfPilot.focus)marks.add(selfPilot.focus);if(selfPilot.guard)marks.add(selfPilot.guard);}
  list.push({kind:'y',pos:ship.position,name:'YOU',sub:S.auto?'AUTOPILOT':'',sel:U&&U.kind==='me'});
  wingmen.forEach((w,i)=>{if(!w.dead&&w.launch<=0){const q=w.sq||0;
    list.push({kind:'w',i,q,pos:w.mesh.position,name:q&&sqAlive(q)[0]===w?SQUAD_DEFS[q].name:w.callsign,sub:wingOrderName(w),sel:wsel.includes(w)});}});
  for(const C of capitals){
    if(C.state==='wreck')continue;
    if(C.friendly){list.push({kind:'f',C,pos:C.g.position,name:C.T.name,sub:C.state==='warp'?'WARPING IN':C.state==='fight'?Math.ceil(C.hp/C.T.hp*100)+'%'+(C.goal?' · '+(C.retreat?'FALLING BACK':'MOVING'):''):'LOST',sel:C===cap,mk:marks.has(C)});
      if(C.goal&&C.state==='fight')list.push({kind:'g',C,pos:C.goal,name:C.retreat?'FALL BACK':'WAYPOINT',sub:C.T.name});
      continue;}
    const sub=(S.adm&&S.adm.C===C&&!S.adm.silenced&&C.state==='fight'?'FLAGSHIP · ':'')+(C.state==='fight'?bdgRoleTag(C):'')+(C.state==='warp'?'WARPING IN':C.state==='dying'?(C.gate?'COLLAPSING':'GOING UP'):C.gate?gateTxt(C):(C.fleet?Math.ceil(C.hp/C.T.hp*100)+'% · ':'')+(C.shield.visible?'SHIELDED':'REACTOR EXPOSED'));
    list.push({kind:C.state==='fight'?'e':'ed',C,pos:C.g.position,name:C.T.name,sub,mk:marks.has(C)});
    if(C.state!=='fight')continue;
    for(const E of C.parts)if(!E.dead)list.push({kind:'s',C,E,pos:E.mesh.position,name:E.T.name,sub:'',mk:marks.has(E)});   // guns, flak, lance
    for(const E of C.systems)if(!E.dead)list.push({kind:'s',C,E,pos:E.mesh.position,name:E.T.short,sub:'',mk:marks.has(E)});
    if(C.core&&capTargets.includes(C.core))list.push({kind:'s',C,E:C.core,pos:C.core.mesh.position,name:'REACTOR',sub:'',mk:marks.has(C.core)});
  }
  for(const E of fighters)if(!E.dead&&!E.drone)list.push({kind:'x',E,pos:E.mesh.position,name:E.T.ace?targetName(E):'',sub:'',mk:marks.has(E)});
  bdgMarks.classList.toggle('holo',bdgView==='holo');
  let n=0;
  for(const M of list){
    if(!bdgProject(M.pos,bdgV))continue;
    M.x=bdgV.x;M.y=bdgV.y;
    const el=bdgEl(n);bdgList[n]=M;n++;
    const cls='bm '+M.kind+(M.q?' q'+M.q:'')+(M.sel?' sel':'')+(M.mk?' mk':'');
    if(el.className!==cls)el.className=cls;
    if(el._n!==M.name){el.children[1].textContent=el._n=M.name;}
    if(el._s!==M.sub){el.children[2].textContent=el._s=M.sub;}
    el.style.display='';el.style.transform='translate('+M.x.toFixed(0)+'px,'+M.y.toFixed(0)+'px)';
  }
  for(let i=n;i<bdgPool.length;i++)bdgPool[i].style.display='none';
  bdgList.length=n;
  // order lines: each wingman to what it is attacking, each broadside ship to what it is firing on
  let dW='',dC='';
  const seg=(a,b)=>bdgProject(a,bdgV)&&bdgProject(b,bdgV2)?'M'+bdgV.x.toFixed(0)+' '+bdgV.y.toFixed(0)+'L'+bdgV2.x.toFixed(0)+' '+bdgV2.y.toFixed(0):'';
  for(const w of wingmen)if(!w.dead&&w.launch<=0&&w.mode==='attack'&&w.tgt)dW+=seg(w.mesh.position,w.tgt.mesh.position);
  if(S.auto&&selfPilot.tgt&&!selfPilot.tgt.dead)dW+=seg(ship.position,selfPilot.tgt.mesh.position);
  for(const C of capitals)if(C.friendly&&C.fleet&&C.state==='fight'&&C.bTgt)
    dC+=seg(C.g.position,C.focusSys&&C.focusSys.ship===C.bTgt?C.focusSys.mesh.position:C.bTgt.g.position);
  for(const C of capitals)if(C.friendly&&C.goal&&C.state==='fight')dC+=seg(C.g.position,C.goal);
  bdgLnW.setAttribute('d',dW);bdgLnC.setAttribute('d',dC);
}
function bdgEl(i){
  let el=bdgPool[i];
  if(!el){el=document.createElement('div');el.innerHTML='<i></i><b></b><span></span>';el.dataset.m=i;bdgMarks.appendChild(el);bdgPool[i]=el;}
  return el;
}
// orbit: drag anywhere off the panel and markers; pan: right / middle / shift-drag; zoom on the wheel
renderer.domElement.addEventListener('mousedown',e=>{if(!S.bridge)return;
  if(e.button===1)e.preventDefault();   // no middle-click autoscroll
  bdgDrag={x:e.clientX,y:e.clientY,pan:e.button!==0||e.shiftKey,moved:0};});
addEventListener('mousemove',e=>{
  if(!S.bridge||!bdgDrag)return;
  const dx=e.clientX-bdgDrag.x,dy=e.clientY-bdgDrag.y;bdgDrag.moved+=Math.abs(dx)+Math.abs(dy);
  if(bdgDrag.pan){bdgFollow=false;const k=bdgCam.dist*.0018,c=Math.cos(bdgCam.yaw),s=Math.sin(bdgCam.yaw);   // the map follows the cursor
    bdgPan.x+=(-c*dx-s*dy)*k;bdgPan.z+=(s*dx-c*dy)*k;}
  else{
  bdgCam.yaw-=dx*.006;
  bdgCam.pitch=Math.max(BRIDGE.pitch[0],Math.min(BRIDGE.pitch[1],bdgCam.pitch+dy*.005));}
  bdgDrag.x=e.clientX;bdgDrag.y=e.clientY;
});
addEventListener('mouseup',e=>{
  const d=bdgDrag;bdgDrag=null;
  if(S.bridge&&d&&!d.pan&&d.moved<5)bdgGroundClick(e.clientX,e.clientY);   // a click on the open map, not a drag
});
/* where a screen point meets the horizontal plane through `y` in the world, as seen in the current view (false if it
   misses, or lies off the edge of the globe) */
const bdgRay=new THREE.Raycaster(), bdgPlane=new THREE.Plane(new THREE.Vector3(0,1,0)), bdgNdc=new THREE.Vector2();
function bdgGround(x,y,wy,out){
  bdgNdc.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);
  if(bdgView==='holo'&&holo){
    const k=HOLO.r/(bdgCam.dist*HOLO.range);
    bdgPlane.constant=-(HOLO.y+(wy-bdgC.y)*k);
    bdgRay.setFromCamera(bdgNdc,holo.cam);
    if(!bdgRay.ray.intersectPlane(bdgPlane,out))return false;
    out.y-=HOLO.y;if(out.length()>HOLO.r)return false;
    out.multiplyScalar(1/k).add(bdgC);out.y=wy;return true;
  }
  bdgPlane.constant=-wy;bdgRay.setFromCamera(bdgNdc,camera);
  return !!bdgRay.ray.intersectPlane(bdgPlane,out);
}
/* a click on empty map with HALCYON or SOLACE selected sends it there */
function bdgGroundClick(x,y){
  const U=bdgUnit();
  if(U&&U.kind==='fleet'&&bdgArm==='reserve'){   // the reserve warps in where you clicked, level with HALCYON
    const K=carrierShip();
    if(K&&bdgGround(x,y,K.g.position.y,bdgV)&&fleetCallReserve(bdgV)){bdgArm=null;bdgPanelT=0;renderBridgePanel();}
    return;
  }
  if(!U||U.kind!=='cap'||!toolOn('move')||!fleetMovable(U.C))return;
  if(!bdgGround(x,y,U.C.g.position.y,bdgV))return;
  if(fleetMoveTo(U.C,bdgV)){sfx('acquire');renderBridgePanel();}
}
addEventListener('keyup',e=>{bdgKeys[e.code]=false;});
/* zoom by a factor, within the view's range: the globe zooms in much closer than the live camera can (HOLO.dist) */
function bdgZoom(f){const r=bdgView==='holo'?HOLO.dist:BRIDGE.dist;bdgCam.dist=Math.max(r[0],Math.min(r[1],bdgCam.dist*f));}
addEventListener('wheel',e=>{if(S.bridge)bdgZoom(1+Math.sign(e.deltaY)*(bdgView==='holo'?.15:.1));},{passive:true});
