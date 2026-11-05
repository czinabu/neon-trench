"use strict";
/* Co-op networking: the lobby, the room and the connection it runs over.

   One player hosts and runs the battle; up to three others join with the room's code (COOP.max players in all).
   Everything goes through netSend / netOn, so the connection underneath can be swapped (netKind picks one):
     peer    the default: each guest's game links straight to the host's over WebRTC (PeerJS, vendor/peerjs.min.js). The
             free PeerJS broker only matches the room code to the host; guests talk only to the host, which runs the
             battle and sends it to all of them. Networks that block direct links go through a Cloudflare TURN relay (NET_PEER in js/config.js).
     local   BroadcastChannel between tabs of the same browser on one computer (offline testing: add ?net=local)
     relay   a WebSocket room server, for if we ever run one (NET_RELAY in js/config.js, empty): every message
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
NET_TRANSPORTS.peer=(room,onMsg)=>{
  const host=NET.role==='host',links=new Set(),byId=new Map();
  let peer=null,link=null,closed=false;
  netIce().then(ice=>{
    if(closed)return;
    // ?peerhost=host&peerport=9000 points at a self-hosted PeerServer instead of the free PeerJS one (how the tests run)
    const q=new URLSearchParams(location.search),own=q.get('peerhost');
    const where=own?{host:own,port:+q.get('peerport')||9000,path:'/',secure:q.get('peersecure')==='1'}:{};
    try{peer=new Peer(host?NET_PEER.prefix+room:undefined,{...where,config:{iceServers:ice},debug:0});}catch(e){netPeerError('browser-incompatible');return;}
    peer.on('error',e=>{if(!closed)netPeerError(e.type,host?links.size>0:!!link);});
    if(host)peer.on('connection',c=>{   // a guest dialled in: learn its id from its first message
      c.on('open',()=>links.add(c));
      c.on('data',m=>{
        if(!m||typeof m!=='object'||closed)return;
        if(!c.pid&&m.from){c.pid=m.from;byId.set(m.from,c);}
        onMsg(m);   // guests only ever talk to the host (it sends everyone the battle), so nothing is passed on
      });
      c.on('close',()=>{links.delete(c);if(c.pid&&byId.get(c.pid)===c){byId.delete(c.pid);if(!closed)onMsg({t:'bye',from:c.pid});}});
    });
    else peer.on('open',()=>{
      if(closed)return;
      const c=peer.connect(NET_PEER.prefix+room,{serialization:'json',reliable:true});
      c.on('open',()=>{link=c;});
      c.on('data',m=>{if(m&&typeof m==='object'&&!closed)onMsg(m);});
      c.on('close',()=>{if(!closed&&link)netDropped();});
    });
  });
  return {
    send:m=>{
      if(!host){if(link&&link.open)link.send(m);return;}   // a guest's hello repeats until the link is up
      if(m.to){const c=byId.get(m.to);if(c&&c.open)c.send(m);}else links.forEach(c=>{if(c.open)c.send(m);});
    },
    close:()=>{closed=true;const p=peer;setTimeout(()=>{if(p)p.destroy();},300);},   // let a last bye go out first
  };
};
/* the addresses WebRTC may use: Cloudflare TURN logins from our Vercel function (api/turn.js) when it is deployed,
   otherwise plain STUN, which is enough on most home networks */
async function netIce(){
  const stun=[{urls:NET_PEER.stun}];
  if(location.protocol==='file:'||!NET_PEER.turn)return stun;
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),NET_PEER.wait);
    const r=await fetch(NET_PEER.turn,{signal:ctl.signal});clearTimeout(t);
    if(!r.ok)return stun;
    const j=await r.json();
    return Array.isArray(j.iceServers)&&j.iceServers.length?j.iceServers:stun;
  }catch(e){return stun;}
}
/* PeerJS errors: a taken code draws a new one; anything else before the link is up ends the attempt. Once players are
   linked, losing the broker doesn't matter (the links are direct), so the game carries on. */
function netPeerError(type,linked){
  if(!NET.role)return;
  if(type==='unavailable-id'&&netHost()&&!linked){netOpen('host',netCode());renderCoop();return;}
  if(linked&&type!=='browser-incompatible')return;
  if(type==='peer-unavailable'&&netGuest()){coopNote='No game found with that code.';}
  else if(type==='browser-incompatible')coopNote='This browser can\'t run online co-op.';
  else if(type==='peer-unavailable')return;
  else coopNote='Could not reach the matchmaking service. Check the internet connection.';
  if(COOP.live){coopLost(coopNote);return;}
  netClose(true);renderCoop();
}
const netKind=()=>NET_RELAY?'relay':(typeof Peer==='function'&&!/[?&]net=local\b/.test(location.search))?'peer':'local';

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
const netLobby=()=>netSend({t:'lobby',players:NET.players,battle:COOP.battle,seat:COOP.seat});   // host: the player list and the chosen battle, to everyone
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
  netLobby();renderCoop();
});
netOn('lobby',m=>{if(!netGuest())return;NET.players=m.players;COOP.battle=m.battle==='fleet'?'fleet':'dogfight';COOP.seat=m.seat==='admiral'?'admiral':'fly';const me=m.players.find(p=>p.id===NET.id);if(me)NET.name=me.name;NET.status='in';renderCoop();});
netOn('full',m=>{if(!netGuest())return;NET.status='';coopNote=m.why;netClose(true);renderCoop();});
netOn('bye',m=>{
  if(netGuest()&&m.from==='h'){coopLost('The host left the game.');return;}
  if(netHost()){const i=NET.players.findIndex(p=>p.id===m.from);if(i>0){NET.players.splice(i,1);coopPilotLeft(m.from);netLobby();renderCoop();}}
});
netOn('start',m=>{if(netGuest())coopStart(m.seed,m.players,m.fleet||null,!!m.admiral);});

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
  coPlayers.innerHTML=on?NET.players.map(p=>'<div class="coP" style="--c:'+ORD_COL[p.slot]+'"><i></i><b>'+p.name+'</b><span>'
    +(p.slot?SQUAD_DEFS[p.slot].name+' lead':COOP.seat==='admiral'?'Admiral · at the holo table':'Wing lead · commander')+(p.id===NET.id?' · you':'')+'</span></div>').join(''):'';
  coBattle.hidden=!on;
  coBattle.innerHTML=Object.entries(COOP_BATTLES).map(([k,b])=>'<button class="tab'+(COOP.battle===k?' on':'')+'" data-b="'+k+'"'+(host?'':' disabled')+'>'+b.name+'</button>').join('')
    +'<div class="coBattleSub">'+COOP_BATTLES[COOP.battle].sub+'</div>'
    +Object.entries(COOP_SEATS).map(([k,b])=>'<button class="tab'+(COOP.seat===k?' on':'')+'" data-s="'+k+'"'+(host?'':' disabled')+'>'+b.name+'</button>').join('')
    +'<div class="coBattleSub">'+COOP_SEATS[COOP.seat].sub+'</div>';
  coLink.textContent=netKind()==='relay'?'Online room server':netKind()==='peer'?'Online: everyone links straight to the host\'s game'
    :'Same computer: open the game in a second tab and join from there';
}
coHost.onclick=()=>{netOpen('host',netCode());coopNote='';renderCoop();};
const COOP_BATTLES={
  dogfight:{name:'Dogfight',sub:'Open-space fight with HALCYON on station and an enemy capital warping in.'},
  fleet:{name:'Fleet battle',sub:'Line against line, from the host\'s Skirmish setup. The host commands the fleet from the bridge.'},
};
const COOP_SEATS={
  fly:{name:'Host flies',sub:'The host flies as wing lead and commands on the fly (order wheel, bridge on B).'},
  admiral:{name:'Admiral seat',sub:'The host doesn\'t fly: they command the whole battle from HALCYON\'s holo table.'},
};
coBattle.onclick=e=>{const b=e.target.closest('button[data-b],button[data-s]');if(!b||!netHost())return;
  if(COOP_BATTLES[b.dataset.b])COOP.battle=b.dataset.b;else if(COOP_SEATS[b.dataset.s])COOP.seat=b.dataset.s;else return;
  sfx('ui');netLobby();renderCoop();};
coJoin.onclick=()=>{
  const code=coCodeIn.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length<4){coopNote='Type the host\'s code first.';renderCoop();return;}
  netOpen('guest',code);NET.status='';coopNote='';renderCoop();
  let tries=0;   // say hello until the host answers (a busy host tab can be slow to), then give up
  const knock=()=>{if(!netGuest()||NET.status==='in')return;
    if(++tries>(NET.kind==='local'?12:30)){coopNote='No game found with that code.';netClose(true);renderCoop();return;}
    netSend({t:'hello',name:NET.name,ship:NET.ship});setTimeout(knock,500);};
  knock();
};
coLeave.onclick=()=>{netClose();coopNote='';renderCoop();};
coLaunch.onclick=()=>{if(netHost()&&NET.players.length>1)coopLaunch();};
coBack.onclick=()=>{netClose();showScreen('menu');};
coCodeIn.addEventListener('keydown',e=>{e.stopPropagation();if(e.code==='Enter')coJoin.click();});
