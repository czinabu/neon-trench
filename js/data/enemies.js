"use strict";
/* Enemy ship classes, ace callsigns and per-mission spawn mixes. */

/* Every enemy ship lives in `fighters` with a `kind` naming its class here, so targeting, pips,
   missiles and kill counting treat them all alike. Stats are tuned against the player's laser
   (1 damage per bolt on the Razorline):
     hp       hits to kill            speed    cruise speed in open space (m/s)
     turn     max turn rate (rad/s)   fire     [base, random] seconds between attacks
     shots    bolts per attack (a burst, `gap` s apart)   boltSpd  enemy bolt speed
     missile  attacks are homing missiles instead of bolts    jink  breaks hard when you line it up
     worth    base score              r        hit radius for player bolts */
const ENEMY_TYPES={
  grunt :{name:'FIGHTER',hp:4, speed:105,turn:1.9,fire:[1.3,.7],shots:1,boltSpd:240,worth:120,r:5},
  dart  :{name:'DART',   hp:2, speed:150,turn:2.6,fire:[1.0,.6],shots:2,gap:.09,boltSpd:290,worth:90,r:4},
  hunter:{name:'HUNTER', hp:7, speed:80, turn:1.2,fire:[4.6,1.6],missile:true,worth:220,r:6,standoff:340},
  ace   :{name:'ACE',    hp:10,speed:135,turn:2.9,fire:[1.5,.5],shots:3,gap:.11,boltSpd:310,worth:450,r:5,jink:true,ace:true},
  leader:{name:'LEADER', hp:26,speed:130,turn:2.6,fire:[1.2,.4],shots:4,gap:.1, boltSpd:320,worth:1500,r:6.5,jink:true,ace:true,
          missile2:true},   // also fires a homing missile every few attacks
};
const ACE_CALLSIGNS=['VANTA','RIOT','HALO','JACKAL','NOVA','SABLE','WRAITH','EMBER','GHOST','TALON'];
const LEADER_CALLSIGN='KESTREL';

/* Spawn mixes: relative weights per class. A mission's `roster` overrides these; a mission with
   `leader:true` sends the squadron leader as its final kill. */
const ROSTER_ARENA ={grunt:1,dart:.35,hunter:.15};
const ROSTER_TRENCH={grunt:1,dart:.3,hunter:.12};   // darts and hunters only show up past the first third
function pickEnemyKind(roster){
  let sum=0;for(const k in roster)sum+=roster[k];
  let r=Math.random()*sum;
  for(const k in roster){r-=roster[k];if(r<=0)return k;}
  return 'grunt';
}
