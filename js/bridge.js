"use strict";
/* Command bridge (B, in an arena run with HALCYON on station): step onto the carrier's tactical view mid-battle.
   The game slows to BRIDGE.slow (js/config.js), the mouse is freed, and an orbiting camera looks down on the
   fight with a marker on every ship. Pick a unit in the panel (a squadron, one wingman, or HALCYON / SOLACE)
   and give it an order from its buttons, or click a marker: a hostile to attack it, a friendly capital for the
   wing to guard. Select YOU to give your own ship an order and fly it on autopilot (js/autopilot.js); otherwise it holds its course. B or Esc goes back to the cockpit.
   Squadrons: your wing plus up to two more (TALON, WRAITH) launched from HALCYON's bay with the squadron's Launch
   button; each takes its own orders. A squadron's leader marker carries its name: click it to select the squadron,
   click again for the single pilot. The squadron model is in js/wingmen.js (squadrons, setSquadOrder, launchSquadron).
   The orders themselves live in js/wingmen.js (setWingOrder, setWingmanOrder) and js/fleet.js (focus, stance);
   updateCamera (js/update/camera.js) hands the camera to bridgeCamera while the bridge is up. */

let bdgSel='wing';   // selected unit: 'wing' (your squadron) or 'sq1' / 'sq2' (launched or in the bay), 'me' (your own ship), 'w0'.. (a wingman slot), or 'c:'+name (a friendly capital)
let bdgDrag=null;    // drag in progress {x,y,pan}: orbit, or pan (right / middle / shift-drag)
const bdgKeys={};    // pan keys held (W A S D / arrows), kept apart from S.keys so they never fly the ship
let bdgList=[];      // this frame's markers, by index (a marker's data-m)
let bdgPanelT=0;     // the panel's status refresh timer (real seconds)
const bdgCam={yaw:0,pitch:1,dist:540};
const bdgPan=new THREE.Vector3();   // how far the view has been panned off the middle of the fight (x, z)
const bdgC=new THREE.Vector3(), bdgT=new THREE.Vector3(), bdgP=new THREE.Vector3(), bdgV=new THREE.Vector3(), bdgV2=new THREE.Vector3();
const bdgPool=[];
const BDG_STANCES=[['hold','Hold position'],['close','Close in'],['back','Fall back']];

const bridgeAvailable=()=>S.mode==='play'&&S.sector==='arena'&&!S.school&&S.launchT<=0&&!!carrierShip()&&carrierShip().state==='fight';
function bridgeOpen(){
  if(S.bridge)return;
  if(S.mode==='play'&&S.mission&&rankLevel()<2){announce('BRIDGE LOCKED','Commander rank required','');return;}
  if(!bridgeAvailable()){announce('NO BRIDGE',S.launchT>0?'Clear the bay first':'HALCYON is not on station','');return;}
  S.bridge=true;
  for(const k in S.keys)S.keys[k]=false;
  S.fireHeld=S.zoomHeld=false;S.cursor.x=S.cursor.y=0;
  // the camera starts where it is and swings up over the fight from that side
  bridgeCentre(bdgC);bdgV.copy(camera.position).sub(bdgC);
  bdgCam.yaw=Math.atan2(bdgV.x,bdgV.z);bdgCam.pitch=1;bdgCam.dist=540;bdgPan.set(0,0,0);
  if(S.cam==='fp'){cockpit.visible=false;for(const m of shipFpHide)m.visible=true;}   // seen from outside, the whole hull
  document.body.classList.add('bridge');bdgUI.style.display='block';
  if(!bdgUnit())bdgSel=wingmen.some(w=>!w.dead)?'wing':'c:'+carrierShip().T.name;
  bdgPanelT=0;renderBridgePanel();
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
function bdgUnit(){
  if(bdgSel==='me')return {kind:'me'};
  if(bdgSel==='wing'||/^sq\d$/.test(bdgSel)){
    const q=bdgSel==='wing'?0:+bdgSel[2];
    if(sqAlive(q).length)return {kind:'wing',q};
    const K=carrierShip();
    return q&&squadrons[q]&&K&&K.state==='fight'?{kind:'wing',q,bay:true}:null;
  }
  if(bdgSel[0]==='w'){const w=wingmen[+bdgSel.slice(1)];return w&&!w.dead?{kind:'wingman',w}:null;}
  const C=capitals.find(o=>o.friendly&&o.state==='fight'&&o.T.name===bdgSel.slice(2));
  return C?{kind:'cap',C}:null;
}
const bdgWingOf=U=>U.kind==='wing'?sqAlive(U.q):U.kind==='me'?[]:[U.w];
function bdgSelect(id){bdgSel=id;sfx('tick');renderBridgePanel();}
/* an order button: a wing order, a wingman's own order ('' = back with the wing), or a capital's fire / stance */
function bdgOrder(o,kind){
  const U=bdgUnit();if(!U)return;
  if(U.kind==='wing'){
    if(kind==='launch'){if(launchSquadron(U.q)){bdgPanelT=0;renderBridgePanel();}return;}
    if(!U.bay)setSquadOrder(U.q,o);
  }
  else if(U.kind==='me'){if(setSelfOrder(o||null))sfx('acquire');}
  else if(U.kind==='wingman'){if(setWingmanOrder(U.w,o||null))sfx('acquire');}
  else if(kind==='fire'){U.C.focus=U.C.focusSys=null;sfx('acquire');}
  else{U.C.stance=o;sfx('acquire');}
  renderBridgePanel();
}
/* a marker click: select a wingman, have the wing guard a friendly capital, or set the selected unit on a hostile */
function bdgMark(M){
  const U=bdgUnit();
  if(M.kind==='w'){   // a squadron's pilot: the squadron first, then the single pilot on a second click
    const q=wingmen[M.i].sq||0,sid=q?'sq'+q:'wing';
    bdgSelect(bdgSel===sid&&sqAlive(q).length>1?'w'+M.i:sid);return;
  }
  if(M.kind==='y'){bdgSelect('me');return;}
  if(M.kind==='ed')return;   // a capital still warping in or going up
  if(M.kind==='f'){
    if(!U||U.kind==='cap'){bdgSelect('c:'+M.C.T.name);return;}
    if(U.kind==='me'){if(setSelfOrder('defend',M.C))sfx('acquire');renderBridgePanel();return;}
    for(const w of bdgWingOf(U))setWingmanOrder(w,'defend',M.C);
    sfx('acquire');renderBridgePanel();return;
  }
  if(!U)return;
  if(U.kind==='cap'){
    if(!U.C.fleet){announce('NO BROADSIDES',U.C.T.name+' has no broadside guns','');return;}
    if(M.kind==='x'){announce('TOO FAST','Broadsides can\'t track fighters','');return;}
    if(!M.C.fleet){announce('OUT OF THE LINE',M.C.T.name+' is not in the battle line','');return;}
    U.C.focus=M.C;U.C.focusSys=M.E&&M.E.sys?M.E:null;
  }else if(U.kind==='me'){if(!setSelfOrder('focus',M.E||M.C))return;}
  else for(const w of bdgWingOf(U))setWingmanOrder(w,'focus',M.E||M.C);
  sfx('acquire');renderBridgePanel();
}
const BDG_PAN_KEYS=/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right))$/;
/* keys while on the bridge: B / Esc / P back to the cockpit, W A S D / arrows pan, C or Home recentres, 1-6 order the selected wing unit, Tab the next unit */
function bridgeKey(e){
  const c=e.code;
  if(c==='KeyB'||c==='Escape'||c==='KeyP'){bridgeClose();return;}
  if(c==='KeyC'||c==='Home'){bdgPan.set(0,0,0);return;}   // recentre on the fight
  if(BDG_PAN_KEYS.test(c)){bdgKeys[c]=true;return;}
  if(c==='KeyN'){setMuted(!S.muted);return;}
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
const bdgFocusTxt=C=>C.focus?C.focus.T.name+(C.focusSys?' '+C.focusSys.T.short:''):'Free fire';
function bdgUnitRows(){
  const rows=[{id:'me',name:'YOU',sub:S.auto?'AUTOPILOT · '+selfOrderName():'MANUAL',bar:bdgPips(Math.max(0,Math.min(5,Math.ceil(S.hull/100*5))),5)}];
  for(let q=0;q<squadrons.length;q++){
    const mem=sqMembers(q),alive=sqAlive(q).length>0,K=carrierShip(),can=!!K&&K.state==='fight'&&K.squads>0;
    if(q&&!alive&&!K)continue;
    if(!q&&!mem.length)continue;
    const lead=sqAlive(q)[0];
    rows.push({id:q?'sq'+q:'wing',name:q?SQUAD_DEFS[q].name:'WING',off:q?!alive&&!can:!alive,
      sub:alive?(q?'LEAD '+lead.callsign+' · ':'')+bdgSqOrderName(q):q?(mem.length?'LOST · ':'IN BAY · ')+(can?'LAUNCH':'HANGAR EMPTY'):'NONE LEFT'});
    wingmen.forEach((w,i)=>{if((w.sq||0)===q)rows.push({id:'w'+i,name:w.callsign,off:w.dead,
      sub:w.dead?'LOST':w.launch>0?'LAUNCHING':wingOrderName(w)+(w.order?'':q?' · WITH SQUADRON':' · WITH WING'),bar:w.dead?'':bdgPips(Math.ceil(w.hp/w.maxHp*5),5)});});
  }
  for(const C of capitals)if(C.friendly&&C.state!=='wreck')rows.push({id:'c:'+C.T.name,name:C.T.name,off:C.state!=='fight',
    sub:C.state!=='fight'?'LOST':C.fleet?BDG_STANCES.find(s=>s[0]===C.stance)[1].toUpperCase()+' · '+bdgFocusTxt(C).toUpperCase()
      :'POINT DEFENCE'+(C.kind==='carrier'?' · RSV '+C.reserve:''),bar:capBar(Math.ceil(C.hp/C.T.hp*10),10)});
  return rows;
}
const bdgBtn=(o,label,on,kind)=>'<button class="bdgo'+(on?' on':'')+'" data-o="'+o+'"'+(kind?' data-k="'+kind+'"':'')+'>'+label+'</button>';
function bdgOrdersHtml(U){
  if(!U)return '<div class="bdgTip">Nothing left to command.</div>';
  if(U.kind==='cap'){
    const C=U.C;
    if(!C.fleet)return '<div class="bdgSub">'+C.T.name+' // '+C.T.cls+'</div><div class="bdgTip">Point defence only: '+C.T.name
      +'\'s turrets pick their own targets'+(C.kind==='carrier'?', and the bay launches replacements while the reserve lasts.':'.')+'</div>';
    return '<div class="bdgSub">'+C.T.name+' // broadsides</div><div class="bdgRow">'+bdgBtn('free','Free fire',!C.focus,'fire')
      +(C.focus?'<span class="bdgOn">On '+bdgFocusTxt(C)+'</span>':'')+'</div>'
      +'<div class="bdgSub">Stance</div><div class="bdgRow">'+BDG_STANCES.map(([o,l])=>bdgBtn(o,l,C.stance===o,'stance')).join('')+'</div>'
      +'<div class="bdgTip">Click an enemy capital to focus the broadsides on it, or one of its subsystems to shoot that out. '
      +'Closing in lands more shells, both ways.</div>';
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
    +'<div class="bdgTip">Click a hostile to '+(wing?'send the '+(q?'squadron':'wing')+' at':'attack')+' it, or HALCYON or SOLACE to guard it.'
    +(q&&wing?' Squadron leaders fly the front; the 1-6 keys order whichever is selected.':'')+'</div>';
}
function renderBridgePanel(){
  if(!bdgUnit()){const r=bdgUnitRows().find(u=>!u.off);if(r)bdgSel=r.id;}
  const U=bdgUnit();
  const h='<div class="bdgHead"><b>HALCYON BRIDGE</b><span>Tactical · time slowed · pan: right-drag or WASD · C centre</span></div><div class="bdgUnits">'
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
  else if(b.dataset.o!==undefined)bdgOrder(b.dataset.o,b.dataset.k);
  else{const M=bdgList[+b.dataset.m];if(M)bdgMark(M);}
});

/* ---- camera, markers and order lines (each frame, on real time) ---- */
function bridgeCamera(fr){
  const dt=fr.rdt||fr.dt;
  if(!bridgeAvailable()){bridgeClose();if(S.mode==='play'&&!carrierShip())announce('BRIDGE LOST','HALCYON is gone','ace');return;}
  const {yaw,pitch,dist}=bdgCam;
  const kx=(bdgKeys.KeyD||bdgKeys.ArrowRight?1:0)-(bdgKeys.KeyA||bdgKeys.ArrowLeft?1:0);
  const kz=(bdgKeys.KeyW||bdgKeys.ArrowUp?1:0)-(bdgKeys.KeyS||bdgKeys.ArrowDown?1:0);
  if(kx||kz){const sp=dist*1.1*dt;   // across the ground, relative to the way the camera faces
    bdgPan.x+=(Math.cos(yaw)*kx-Math.sin(yaw)*kz)*sp;bdgPan.z+=(-Math.sin(yaw)*kx-Math.cos(yaw)*kz)*sp;}
  if(bdgPan.length()>ARENA_R*.8)bdgPan.setLength(ARENA_R*.8);
  bdgC.lerp(bridgeCentre(bdgT).add(bdgPan),1-Math.exp(-3*dt));
  bdgP.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(dist).add(bdgC);
  if(bdgP.length()>ARENA_R-25)bdgP.setLength(ARENA_R-25);   // stay inside the arena's dome
  camera.position.lerp(bdgP,1-Math.exp(-5*dt));
  camera.up.set(0,1,0);camera.lookAt(bdgC);
  camera.fov+=(62-camera.fov)*Math.min(1,6*dt);camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  bridgeMarks();
  bdgPanelT-=dt;if(bdgPanelT<=0){bdgPanelT=.25;renderBridgePanel();}
}
/* where a world point lands on screen (false if it is behind the camera) */
function bdgProject(pos,out){out.copy(pos).project(camera);if(out.z>1)return false;
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
    if(C.friendly){list.push({kind:'f',C,pos:C.g.position,name:C.T.name,sub:C.state==='fight'?Math.ceil(C.hp/C.T.hp*100)+'%':'LOST',sel:C===cap,mk:marks.has(C)});continue;}
    const sub=C.state==='warp'?'WARPING IN':C.state==='dying'?'GOING UP':(C.fleet?Math.ceil(C.hp/C.T.hp*100)+'% · ':'')+(C.shield.visible?'SHIELDED':'REACTOR EXPOSED');
    list.push({kind:C.state==='fight'?'e':'ed',C,pos:C.g.position,name:C.T.name,sub,mk:marks.has(C)});
    if(C.state!=='fight')continue;
    for(const E of C.systems)if(!E.dead)list.push({kind:'s',C,E,pos:E.mesh.position,name:E.T.short,sub:'',mk:marks.has(E)});
    if(C.core&&capTargets.includes(C.core))list.push({kind:'s',C,E:C.core,pos:C.core.mesh.position,name:'REACTOR',sub:'',mk:marks.has(C.core)});
  }
  for(const E of fighters)if(!E.dead&&!E.drone)list.push({kind:'x',E,pos:E.mesh.position,name:E.T.ace?targetName(E):'',sub:'',mk:marks.has(E)});
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
  bdgDrag={x:e.clientX,y:e.clientY,pan:e.button!==0||e.shiftKey};});
addEventListener('mousemove',e=>{
  if(!S.bridge||!bdgDrag)return;
  const dx=e.clientX-bdgDrag.x,dy=e.clientY-bdgDrag.y;
  if(bdgDrag.pan){const k=bdgCam.dist*.0018,c=Math.cos(bdgCam.yaw),s=Math.sin(bdgCam.yaw);   // the map follows the cursor
    bdgPan.x+=(-c*dx-s*dy)*k;bdgPan.z+=(s*dx-c*dy)*k;}
  else{
  bdgCam.yaw-=dx*.006;
  bdgCam.pitch=Math.max(BRIDGE.pitch[0],Math.min(BRIDGE.pitch[1],bdgCam.pitch+dy*.005));}
  bdgDrag.x=e.clientX;bdgDrag.y=e.clientY;
});
addEventListener('mouseup',()=>{bdgDrag=null;});
addEventListener('keyup',e=>{bdgKeys[e.code]=false;});
addEventListener('wheel',e=>{if(S.bridge)bdgCam.dist=Math.max(BRIDGE.dist[0],Math.min(BRIDGE.dist[1],bdgCam.dist*(1+Math.sign(e.deltaY)*.1)));},{passive:true});
