"use strict";
/* Co-op networking: the lobby, the room and the connection it runs over.

   One player hosts and runs the battle; up to three others join with the room's code (COOP.max players in all).
   Everything goes through netSend / netOn, so the connection underneath can be swapped:
     local   BroadcastChannel between tabs of the same browser on one computer (for testing, no server)
     relay   a WebSocket room server (NET_RELAY in js/config.js, empty until it is set up on Cloudflare): every message
             sent to wss://<relay>/<room code> goes to everyone else in that room, as JSON text
   Every message carries `from` (the sender's id) and may carry `to` (one player's id; otherwise it is for everyone).

   Lobby messages: hello (a joiner: id, name, ship), lobby (host: the player list), start (host: seed and players),
   bye (anyone leaving). The flight messages are in js/coop.js. */

const NET={role:'',room:'',id:'',name:'',ship:'',tx:null,players:[],handlers:{},kind:'local',status:''};
const netId=()=>Math.random().toString(36).slice(2,8);
const netCode=()=>{let s='';for(let i=0;i<5;i++)s+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random()*32)|0];return s;};

/* the connections: each returns {send(msg), close()} and calls onMsg(msg) for every message from someone else */
const NET_TRANSPORTS={
  local(room,onMsg){
    const bc=new BroadcastChannel('neonTrench.coop.'+room);
    bc.onmessage=e=>onMsg(e.data);
    return {send:m=>bc.postMessage(m),close:()=>bc.close()};
  },
  relay(room,onMsg,onUp){
    const ws=new WebSocket(NET_RELAY.replace(/\/$/,'')+'/'+room);
    const q=[];
    ws.onopen=()=>{while(q.length)ws.send(q.shift());if(onUp)onUp();};
    ws.onmessage=e=>{try{onMsg(JSON.parse(e.data));}catch(err){}};
    ws.onclose=()=>netDropped();
    return {send:m=>{const t=JSON.stringify(m);if(ws.readyState===1)ws.send(t);else if(ws.readyState===0)q.push(t);},close:()=>ws.close()};
  },
};
const netKind=()=>NET_RELAY?'relay':'local';

function netOpen(role,room){
  netClose(true);
  NET.role=role;NET.room=room;NET.id=role==='host'?'h':netId();NET.kind=netKind();
  NET.name=role==='host'?'LEAD':'PILOT';NET.ship=curShip.id;
  NET.players=[{id:NET.id,name:NET.name,ship:NET.ship,slot:0}];
  NET.tx=NET_TRANSPORTS[NET.kind](room,netRecv);
}
function netClose(quiet){
  if(NET.tx){if(!quiet||NET.role)netSend({t:'bye'});NET.tx.close();}
  NET.tx=null;NET.role='';NET.room='';NET.players=[];
}
function netSend(m){if(!NET.tx)return;m.from=NET.id;NET.tx.send(m);}
function netOn(t,f){NET.handlers[t]=f;}
function netRecv(m){
  if(!m||m.from===NET.id||(m.to&&m.to!==NET.id))return;
  const f=NET.handlers[m.t];if(f)f(m);
}
function netDropped(){
  if(!NET.role)return;
  const was=NET.role;NET.tx=null;NET.role='';
  coopLost(was==='guest'?'Lost the connection to the host.':'Lost the connection to the room server.');
}
const netHost=()=>NET.role==='host',netGuest=()=>NET.role==='guest',netOnline=()=>!!NET.role;

/* ---- lobby ---- */
/* the host keeps the list: a hello gets you a slot (1, 2 or 3), and everyone gets the new list */
netOn('hello',m=>{
  if(!netHost())return;
  if(COOP.live){netSend({t:'full',to:m.from,why:'That game has already launched.'});return;}
  let P=NET.players.find(p=>p.id===m.from);
  if(!P){
    if(NET.players.length>=COOP.max){netSend({t:'full',to:m.from,why:'That game is full.'});return;}
    const used=NET.players.map(p=>p.slot);let slot=1;while(used.includes(slot))slot++;
    P={id:m.from,name:COOP_CALLS[slot-1],ship:SHIPS.find(s=>s.id===m.ship)?m.ship:SHIPS[0].id,slot};NET.players.push(P);
    sfx('acquire');
  }
  netSend({t:'lobby',players:NET.players});renderCoop();
});
netOn('lobby',m=>{if(!netGuest())return;NET.players=m.players;const me=m.players.find(p=>p.id===NET.id);if(me)NET.name=me.name;NET.status='in';renderCoop();});
netOn('full',m=>{if(!netGuest())return;NET.status='';coopNote=m.why;netClose(true);renderCoop();});
netOn('bye',m=>{
  if(netGuest()&&m.from==='h'){coopLost('The host left the game.');return;}
  if(netHost()){const i=NET.players.findIndex(p=>p.id===m.from);if(i>0){NET.players.splice(i,1);coopPilotLeft(m.from);netSend({t:'lobby',players:NET.players});renderCoop();}}
});
netOn('start',m=>{if(netGuest())coopStart(m.seed,m.players);});

/* ---- the Co-op screen (Free Play) ---- */
let coopNote='';
function openCoop(){
  S.mode='menu';document.exitPointerLock&&document.exitPointerLock();stagePick('arena');
  coopNote='';renderCoop();showScreen('coop');
}
function renderCoop(){
  const on=netOnline(),host=netHost(),joined=netGuest()&&NET.status==='in';
  coHost.hidden=on;coJoinRow.hidden=on;coLeave.hidden=!on;coLaunch.hidden=!host;
  coLaunch.disabled=host&&NET.players.length<2;
  coCode.textContent=on?NET.room:'';coCodeBox.hidden=!on;
  coStatus.textContent=coopNote||(!on?'Host a game and share its code, or type a code to join one.'
    :host?(NET.players.length<2?'Waiting for pilots. Share the code.':'Launch when everyone is in.')
    :joined?'In the room. The host launches when everyone is in.':'Looking for the room…');
  coPlayers.innerHTML=on?NET.players.map(p=>'<div class="coP" style="--c:'+ORD_COL[p.slot%3]+'"><i></i><b>'+p.name+'</b><span>'
    +(p.slot?SQUAD_DEFS[p.slot%3].name+' lead':'Wing lead · commander')+(p.id===NET.id?' · you':'')+'</span></div>').join(''):'';
  coLink.textContent=NET_RELAY?'Online room server':'Same computer: open the game in a second tab and join from there';
}
coHost.onclick=()=>{netOpen('host',netCode());coopNote='';renderCoop();};
coJoin.onclick=()=>{
  const code=coCodeIn.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length<4){coopNote='Type the host\'s code first.';renderCoop();return;}
  netOpen('guest',code);NET.status='';coopNote='';renderCoop();
  let tries=0;   // say hello until the host answers (a busy host tab can be slow to), then give up
  const knock=()=>{if(!netGuest()||NET.status==='in')return;
    if(++tries>12){coopNote='No game found with that code.';netClose(true);renderCoop();return;}
    netSend({t:'hello',name:NET.name,ship:NET.ship});setTimeout(knock,500);};
  knock();
};
coLeave.onclick=()=>{netClose();coopNote='';renderCoop();};
coLaunch.onclick=()=>{if(netHost()&&NET.players.length>1)coopLaunch();};
coBack.onclick=()=>{netClose();showScreen('menu');};
coCodeIn.addEventListener('keydown',e=>{e.stopPropagation();if(e.code==='Enter')coJoin.click();});
