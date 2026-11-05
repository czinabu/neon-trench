"use strict";
/* Co-op aboard HALCYON: the walkable deck (js/deck.js) as the co-op lobby (the room and its messages are js/net.js, the battle
   js/coop.js).
     the console    the co-op console on the sim deck (and Co-op on the datapad) opens the room panel over the deck: host a
                    room, or join one by its code. It is the Co-op screen's own panel, moved over the deck while it is open
     on deck        everyone in the room walks the same deck in their own game and sends where they are about DKC.hz times a
                    second (dkp). Guests only talk to the host, so the host passes each guest's pose on to the others (dkr).
                    The other pilots are drawn as people in their own locker look, with their callsign over their heads. They
                    don't block you: you ease apart instead
     launching      the host picks the battle and seat in the panel, then calls Pilots to the hangar (muster). Each pilot has
                    a pad (the host pad one, TALON pad two and so on, their own ship on it), walks to it and climbs in, and
                    the battle starts once everyone is aboard (or at once, from the host's Launch now). A pilot who isn't on
                    the deck when the call comes (the menu hub, the Co-op screen) counts as aboard. In the admiral seat the
                    host doesn't board: they are aboard from the start
     after          the end screens offer Back aboard HALCYON, which keeps the room: you climb out of your ship on your pad,
                    and the next battle is one muster away. Leave room leaves it */

const DKC={hz:10,sendT:0,stale:2.5,push:.9,others:new Map()};   // others: id -> {P, tag, name, slot, x, y, z, ry, sp, t, inside}
const dkcPadO=slot=>{   // a pad's boarding origin: where it is, the scale of its hull to pad one's, and which side the ladder is on
  const [x,z,r]=DK_BAY_PADS[slot]||DK_BAY_PADS[0];return {x,z,k:r/DK_BAY_PADS[0][2],s:x<0?-1:1};};
const DKC_PAD_ONE={x:0,z:66,k:1,s:1};
const dkcPt=(o,p)=>[o.x+o.s*p[0]*o.k,p[1]*o.k,o.z+(p[2]-66)*o.k];   // a point of DECK_LIFE's walk to pad one, moved to another pad
const dkcMe=()=>NET.players.find(p=>p.id===NET.id)||null;
const dkcIn=()=>netOnline()&&NET.players.length>0&&(netHost()||NET.status==='in');   // in a room (a guest once the host has answered)

/* ---- built with the deck (dkBuild): the co-op console on the sim deck, and Board on the pads the other pilots use ---- */
const DKC_CONSOLE=[16,-28.8];
function dkCoopBuild(M){
  const [x,z]=DKC_CONSOLE;dkConsole(M,x,z,Math.PI,'#ffb300');
  dkSign([['CO-OP',56],['up to '+COOP.max+' pilots',24]],'#ffb300',2.2,.7,x,3,DK_SIM.z1-.17,Math.PI);
  DK.acts.push({x,z:z-.6,r:1,room:'sim',name:'Co-op',get sub(){return dkcIn()?'Room '+NET.room+' · '+NET.players.length+'/'+COOP.max+' pilots':'Host a room or join one by its code';},go:dkCoopOpen});
  for(let i=1;i<4;i++){const [px,pz]=DK_BAY_PADS[i];
    DK.acts.push({x:px,z:pz,r:4.6,room:'hangar',on:()=>!!DK.muster,get name(){return dkMusterName(i);},get sub(){return dkMusterSub(i);},go:()=>dkMusterUse(i)});}
}
DK_GOAL_SPOT.coopc=[DKC_CONSOLE[0],DKC_CONSOLE[1]-1.4,'sim'];

/* ---- the room panel over the deck ---- */
const dkcHome={box:null,btns:null};
function dkCoopOpen(){
  if(!DK)return;dkPad(false);if(DK.coopUI){renderCoop();return;}
  const box=$('coop').querySelector('.coBox'),btns=$('coop').querySelector('.skbtns');
  dkcHome.box=box.parentNode;dkcHome.btns=btns.parentNode;dkCoopBody.append(box,btns);
  coBack.hidden=true;DK.coopUI=true;dkCoopBox.classList.remove('hidden');
  document.exitPointerLock&&document.exitPointerLock();
  coopNote='';renderCoop();
}
function dkCoopClose(){
  if(!DK||!DK.coopUI)return;DK.coopUI=false;dkCoopBox.classList.add('hidden');
  const box=dkCoopBody.querySelector('.coBox'),btns=dkCoopBody.querySelector('.skbtns');
  if(box)dkcHome.box.appendChild(box);if(btns)dkcHome.btns.appendChild(btns);
  coBack.hidden=false;renderCoop();dkLockMouse();
}
dkCoopX.onclick=dkCoopClose;
const dkCoopHere=()=>!!DK&&!!DK.coopUI;   // the panel is over the deck (renderCoop words its buttons for it)
/* the Launch button: on the deck it calls the pilots to the hangar first; once they are called, it launches at once */
function dkCoopLaunchBtn(){
  if(!netHost()||NET.players.length<2)return;
  if(!deckOn()&&!dkCoopHere()){coopLaunch();return;}
  if(DK.muster){dkCoopGo();return;}
  dkCoopClose();dkMuster(true);netSend({t:'muster',on:true});
}
const dkCoopLaunchLabel=()=>dkCoopHere()?(DK.muster?'Launch now':'Pilots to the hangar'):'Launch';

/* ---- the other pilots on the deck ---- */
function dkcOther(id){
  let o=DKC.others.get(id);if(o)return o;
  const P=NET.players.find(p=>p.id===id);if(!P)return null;
  const person=dkPerson(DK.M,{});DK.scene.add(person.g);
  const tag=dkTag(P.name,ORD_COL[P.slot]||'#fff');person.g.add(tag);
  o={P:person,tag,name:P.name,slot:P.slot,x:0,y:0,z:0,ry:0,sp:0,t:-1e9,inside:false,look:''};
  DKC.others.set(id,o);dkInk(person.g);return o;
}
function dkcDrop(id){const o=DKC.others.get(id);if(!o)return;DK.scene.remove(o.P.g);DKC.others.delete(id);}
function dkcPose(id,a,lk){
  if(!DK||id===NET.id)return;const o=dkcOther(id);if(!o)return;
  const fresh=o.t<DK.t-DKC.stale;
  o.tx=a[0];o.ty=a[1];o.tz=a[2];o.try=a[3];o.sp=a[4];o.inside=!!a[5];o.t=DK.t;
  if(fresh){o.x=o.tx;o.y=o.ty;o.z=o.tz;o.ry=o.try;}
  if(lk){const k=JSON.stringify(lk);if(k!==o.look){o.look=k;dkSetLook(o.P,Object.assign({},DECK_LOOK,lk));}}
}
/* everyone: your pose, to the host (a guest) or to everyone (the host) */
function dkcSend(dt){
  DKC.sendT-=dt;if(DKC.sendT>0)return;DKC.sendT=1/DKC.hz;
  const g=DK.me.g,r=v=>Math.round(v*100)/100,p=g.position;
  const sp=DKC.lx===undefined?0:Math.hypot(p.x-DKC.lx,p.z-DKC.lz)*DKC.hz/DECK.walk;DKC.lx=p.x;DKC.lz=p.z;   // from how far you went (walking, or a scene)
  netSend({t:'dkp',a:[r(p.x),r(p.y),r(p.z),r(g.rotation.y),r(Math.min(2,sp)),DK.seq&&DK.seq.kind==='aboard'?1:0],lk:dkMyLook()});
}
netOn('dkp',m=>{
  if(netHost()){dkcPose(m.from,m.a,m.lk);netSend({t:'dkr',id:m.from,a:m.a,lk:m.lk});return;}   // pass it on to the other guests
  if(netGuest()&&m.from==='h')dkcPose('h',m.a,m.lk);   // on the same-computer link guests hear each other too: only the host's counts
});
netOn('dkr',m=>{if(netGuest()&&m.id!==NET.id)dkcPose(m.id,m.a,m.lk);});
/* once a frame from dkTick */
function dkCoopTick(dt){
  const on=dkcIn();
  if(!on){if(DKC.others.size)for(const id of [...DKC.others.keys()])dkcDrop(id);if(DK.muster)dkMuster(false);return;}
  dkcSend(dt);
  for(const [id,o] of DKC.others){
    const P=NET.players.find(p=>p.id===id);if(!P){dkcDrop(id);continue;}
    if(P.name!==o.name||P.slot!==o.slot){o.P.g.remove(o.tag);o.tag=dkTag(P.name,ORD_COL[P.slot]||'#fff');o.P.g.add(o.tag);o.name=P.name;o.slot=P.slot;}
    const show=o.t>DK.t-DKC.stale&&!o.inside;o.P.g.visible=show;if(!show)continue;
    const k=Math.min(1,dt*10);o.x+=(o.tx-o.x)*k;o.y+=(o.ty-o.y)*k;o.z+=(o.tz-o.z)*k;
    let d=o.try-o.ry;d=Math.atan2(Math.sin(d),Math.cos(d));o.ry+=d*k;
    o.P.g.position.set(o.x,o.y,o.z);o.P.g.rotation.y=o.ry;dkStride(o.P,dt,o.sp);
    o.tag.visible=Math.hypot(o.x-DK.x,o.z-DK.z)<30;
    // you and they ease apart rather than stand in each other
    if(!DK.seq&&o.y<.1){const dx=DK.x-o.x,dz=DK.z-o.z,l=Math.hypot(dx,dz),R=DKC.push;
      if(l<R&&l>1e-3){const s=(R-l)*Math.min(1,dt*8),nx=DK.x+dx/l*s,nz=DK.z+dz/l*s;if(dkFree(nx,nz)){DK.x=nx;DK.z=nz;}}}
  }
  if(DK.muster&&DK.seq&&DK.seq.kind==='aboard'&&DK.barkT<1){DK.barkT=DECK.barkT;dkcWaitLine();}
}

/* ---- calling the pilots to the hangar ---- */
const dkcAboard=new Set();   // host: who is in their cockpit
function dkMuster(on){
  if(!DK){if(on&&netGuest())netSend({t:'aboard',on:true});return;}   // never been on the deck this session: aboard already
  DK.muster=on?{t:DK.t}:null;dkcAboard.clear();
  if(!on){if(DK.seq&&DK.seq.kind==='aboard'){DK.seq=null;dkPlace('hangar');}renderCoop();return;}
  const me=dkcMe(),slot=me?me.slot:0;
  DK_GOAL_SPOT.coop=[dkcFoot(slot)[0],dkcFoot(slot)[1],'hangar'];
  if(deckOn()){dkHulls();dkInk(DK.scene);}
  if(netHost()&&COOP.seat==='admiral'){dkcOnAboard(NET.id);dkSay('vale','The pilots are on their way down. The holo table is yours, Admiral: we launch when they are aboard.');}
  else if(!deckOn())dkcAboardNow();   // not walking the deck: you are aboard already
  else{DK.heard.chief=true;dkSay('chief','Pilots to the hangar! Your '+curShip.name+' is on pad '+['one','two','three','four'][slot]+'. Climb in when you are ready.');}
  renderCoop();
}
netOn('muster',m=>{if(netGuest()&&m.from==='h')dkMuster(!!m.on);});
const dkcFoot=slot=>{const q=dkcPt(dkcPadO(slot),DECK_LIFE.path[0]);return [q[0],q[2]];};
/* the pad acts: Board on yours, whose ship it is on the others */
function dkMusterName(slot){const me=dkcMe();if(me&&me.slot===slot)return 'Board';const P=NET.players.find(p=>p.slot===slot);return P?P.name+'\'s ship':'Pad '+(slot+1);}
function dkMusterSub(slot){
  const me=dkcMe(),P=NET.players.find(p=>p.slot===slot),ship=P?shipById(P.ship):null;
  if(me&&me.slot===slot)return 'Co-op · climb into your '+curShip.name;
  return P?(ship?ship.name:'')+(dkcAboardOf(P.id)?' · aboard':' · not aboard yet'):'Nobody on this pad';
}
function dkMusterUse(slot){const me=dkcMe();if(me&&me.slot===slot)dkcBoard(slot);else dkSay('chief','Not your ship, pilot. Yours is on pad '+((me?me.slot:0)+1)+'.');}
let dkcSeen={};   // a guest's idea of who is aboard, from the host's word
const dkcAboardOf=id=>netHost()?dkcAboard.has(id):!!dkcSeen[id]||id===NET.id&&!!DK&&!!DK.seq&&DK.seq.kind==='aboard';
function dkcBoard(slot){if(DK.seq)return;sfx('lock');DK.seq={kind:'board',t:0,coop:true,o:dkcPadO(slot)};dkPrompt.classList.remove('on');DK.focus=null;}
/* the end of the boarding scene (js/decklife.js): you are in your cockpit, waiting on the others */
function dkcAboardNow(){
  if(DK&&deckOn()){DK.seq={kind:'aboard',t:0,o:(DK.seq&&DK.seq.o)||dkcPadO((dkcMe()||{slot:0}).slot)};dkcWaitLine();}
  if(netHost())dkcOnAboard(NET.id);else netSend({t:'aboard',on:true});
}
function dkcUnboard(){   // Esc while you wait: climb back out
  const Q=DK.seq,o=Q&&Q.o?Q.o:dkcPadO(0);DK.seq={kind:'land',t:0,o,L:null};
  if(netHost()){dkcAboard.delete(NET.id);netSend({t:'aboard',all:[...dkcAboard]});}else netSend({t:'aboard',on:false});
}
function dkcWaitLine(){
  const n=NET.players.length,a=NET.players.filter(p=>dkcAboardOf(p.id)).length,left=n-a;
  dkBark.innerHTML='<b style="color:#ffb300">FLIGHT CONTROL</b>'+(left>0?'Aboard. Waiting on '+left+' more pilot'+(left===1?'':'s')+' ('+a+'/'+n+' aboard).':'All pilots aboard. Launching.')
    +(netHost()?' <kbd>Enter</kbd> launch now':'')+' · <kbd>Esc</kbd> climb out';
  dkBark.classList.add('on');DK.barkT=DECK.barkT;
}
netOn('aboard',m=>{
  if(netHost()){if(!DK||!DK.muster)return;if(m.on)dkcOnAboard(m.from);else{dkcAboard.delete(m.from);dkcShare();}return;}
  if(m.from==='h'&&m.all){dkcSeen={};for(const id of m.all)dkcSeen[id]=1;}
});
function dkcShare(){netSend({t:'aboard',all:[...dkcAboard]});if(DK&&DK.seq&&DK.seq.kind==='aboard')dkcWaitLine();}
/* host: someone is in their cockpit; once everyone is, launch */
function dkcOnAboard(id){dkcAboard.add(id);dkcShare();dkcCheck();}
function dkcCheck(){
  if(!netHost()||!DK||!DK.muster||COOP.live)return;
  if(NET.players.length>1&&NET.players.every(p=>dkcAboard.has(p.id)))dkCoopGo();
}
function dkCoopGo(){
  if(!netHost()||COOP.live||NET.players.length<2)return;
  if(DK){DK.muster=null;DK.seq=null;dkcAboard.clear();if(DK.coopUI)dkCoopClose();}
  dkcSeen={};coopLaunch();
}
/* coopStart: the battle is on, the call is over */
function dkCoopStarted(){if(DK){DK.muster=null;DK.seq=null;DK.armed=null;dkcAboard.clear();dkcSeen={};if(DK.coopUI)dkCoopClose();dkPad(false);}}
/* lobby news: a new list (a pilot joined, left or changed), while you are aboard */
function dkCoopLobby(m){
  if(!DK)return;
  if(m&&netGuest()&&!!m.muster!==!!DK.muster)dkMuster(!!m.muster);
  for(const id of [...DKC.others.keys()])if(!NET.players.some(p=>p.id===id))dkcDrop(id);
  if(deckOn()){dkHulls();dkInk(DK.scene);}
  if(netHost())dkcCheck();
}
/* the ships on the pads while you are in a room: each pilot's on their own pad */
function dkCoopPadShips(ids){
  if(!dkcIn()||NET.players.length<2)return ids;
  const out=ids.slice();
  for(const P of NET.players)if(P.slot<DK_BAY_PADS.length)out[P.slot]=P.id===NET.id?curShip.id:P.ship;
  return out;
}

/* ---- the datapad: Co-op, and the next-op card while the pilots are called ---- */
DK_PAD.push({name:'Co-op',items:[
  {name:'Co-op room',get sub(){return dkcIn()?'Room '+NET.room+' · '+NET.players.length+' pilot'+(NET.players.length===1?'':'s'):'Host or join · up to '+COOP.max+' pilots';},go:dkCoopOpen}]});
function dkCoopPad(){
  if(!DK.muster)return false;
  dkPadNextTag.textContent='Co-op launch';dkPadNextName.textContent=COOP_BATTLES[COOP.battle].name;
  dkPadNextObj.textContent=netHost()?'Launch now, without waiting for everyone to board':'Board your '+curShip.name+' on pad '+((dkcMe()||{slot:0}).slot+1)+', or climb in from here';
  return true;
}
function dkCoopPadNext(){
  if(!DK.muster)return false;
  dkPad(false);if(netHost())dkCoopGo();else dkcAboardNow();
  return true;
}
/* the objective tracker (js/deckgoal.js) */
function dkCoopGoal(){
  if(!dkcIn())return null;
  const me=dkcMe(),n=NET.players.length;
  if(DK.muster){const a=NET.players.filter(p=>dkcAboardOf(p.id)).length;
    if(netHost()&&COOP.seat==='admiral')return {tag:'Co-op launch',t:'Pilots boarding',s:a+'/'+n+' aboard · Enter on the datapad launches now',at:null};
    return {tag:'Co-op launch',t:'Board your '+curShip.name,s:'Pad '+((me?me.slot:0)+1)+', hangar bay · '+a+'/'+n+' aboard',at:'coop'};}
  return {tag:'Co-op room '+NET.room,t:n<2?'Waiting for pilots':netHost()?'Call the pilots to the hangar':'Waiting for the host',
    s:n<2?'Share the code · co-op console, sim deck':netHost()?'Co-op console on the sim deck, or Co-op on the datapad':n+' pilots aboard · the host launches',at:n<2||netHost()?'coopc':null};
}

/* ---- after the fight: back aboard, still in the room ---- */
function dkCoopEndUI(on){
  againBtn.hidden=retryBtn.hidden=on;winDeckBtn.hidden=deadDeckBtn.hidden=!on;
  winDeckBtn.textContent=deadDeckBtn.textContent=hubWalk()?'Back aboard HALCYON':'Back to the room';
  winMenuBtn.textContent=deadMenuBtn.textContent=on?'Leave room':'Main Menu';
}
function dkCoopHome(win){
  $('endWin').classList.add('hidden');$('endDead').classList.add('hidden');
  if(!netOnline()){toMenu();return;}
  if(!hubWalk()){S.mode='menu';openCoop();return;}
  const me=dkcMe(),o=dkcPadO(me?me.slot:0),hull=S.hull;
  dkLanded=null;openDeck('hangar');
  DK.seq={kind:'land',t:0,o,L:{m:{name:'the fight',sector:'arena',wingmen:false},win,hull,first:false}};
  dkHulls();dkInk(DK.scene);
}
winDeckBtn.onclick=()=>dkCoopHome(true);
deadDeckBtn.onclick=()=>dkCoopHome(false);
