"use strict";
/* Flight school lessons. A lesson is a drill with a pass grade (js/school.js runs them).
     kind   'tour' guided controls walkthrough (js/tutorial.js), 'gates' fly the gates in order, 'guns' destroy the drones
     par    [A, B, C] times in seconds; slower than C is a fail. Gate and gun lessons add penalties to the clock.
     gates  [{p:[x,y,z], r, spd:'fast'|'slow'}]   spd gates only count at that speed (a miss costs SCHOOL_MISS_S)
     drones [{p:[x,y,z], mv:[ax,ay,az,w]}]        mv = sway amplitude on each axis (m) and speed (rad/s); omitted = hangs still
   The ship starts at the origin facing -z, above the academy runway. */
const SCHOOL_MISS_S=4;       // seconds added for a speed gate flown at the wrong speed
const SCHOOL_SHOT_S=.12;     // seconds added per laser shot that missed a drone
const SCHOOL_FAST=215, SCHOOL_SLOW=85;   // m/s: fast gates need at least this, slow gates at most this
const schoolSlalom=()=>Array.from({length:10},(_,i)=>({p:[(i%2?-1:1)*52,((i%3)-1)*16,-140-i*115],r:16}));
const schoolSpeed=()=>Array.from({length:6},(_,i)=>({p:[(i%2?-1:1)*28,((i%3)-1)*10,-220-i*210],r:28,spd:i%2?'slow':'fast'}));
const SCHOOL_RINGS=[[0,0,-200],[70,25,-340],[180,45,-430],[300,20,-440],[380,-30,-340],[350,-70,-200],[240,-40,-110],[120,0,-60]];
const SCHOOL_LESSONS=[
  {id:'tour',name:'CONTROLS TOUR',sub:'// ungraded',kind:'tour',
   desc:'Steer, throttle, boost, roll, camera, flight model, lasers, missile mode and flares, one at a time.'},
  {id:'rings',name:'RING RUN',sub:'// flight model',kind:'gates',par:[30,42,60],limit:120,
   desc:'Fly a loop of eight rings. Boost the straights and ease off in the turns.',
   gates:SCHOOL_RINGS.map(p=>({p,r:22}))},
  {id:'slalom',name:'SLALOM',sub:'// precision turning',kind:'gates',par:[30,42,60],limit:120,
   desc:'Ten tight gates, left and right in turn. Roll into each turn and keep your speed up.',
   gates:schoolSlalom()},
  {id:'speed',name:'THROTTLE CONTROL',sub:'// boost and brake',kind:'gates',par:[38,52,75],limit:150,
   desc:'Magenta gates need '+SCHOOL_FAST+'+ m/s (boost). Green gates need '+SCHOOL_SLOW+' m/s or less (brake with S). Wrong speed costs '+SCHOOL_MISS_S+' s.',
   gates:schoolSpeed()},
  {id:'static',name:'GUNNERY',sub:'// stationary targets',kind:'guns',par:[22,34,55],limit:120,
   desc:'Six drones hang in the range. Lead nothing, aim true. Every missed shot adds time.',
   drones:[[-110,10,-300],[100,30,-330],[0,-30,-380],[-150,60,-420],[140,-20,-450],[0,70,-500]].map(p=>({p}))},
  {id:'moving',name:'MOVING TARGETS',sub:'// deflection shooting',kind:'guns',par:[34,50,80],limit:150,
   desc:'Five drones sway across the range. Aim where they are going, not where they are. Missed shots add time.',
   drones:[[-90,10,-320,60,18,0,.6],[90,30,-360,70,10,0,.5],[0,-30,-420,40,40,30,.8],[-140,50,-460,90,20,0,.45],[130,0,-520,60,30,40,.7]]
     .map(a=>({p:a.slice(0,3),mv:[a[3],a[4],a[5],a[6]]}))},
  {id:'missiles',name:'MISSILE LOCK',sub:'// missile mode',kind:'guns',par:[30,45,70],limit:120,noPenalty:true,
   desc:'Middle click for missile mode, R to target a drone, hold it in your sights, then left click. Ammo is unlimited here.',
   drones:[[-120,20,-380,50,15,0,.5],[110,-10,-420,50,20,0,.6],[0,50,-480,70,10,20,.45],[-60,-20,-560,60,30,0,.7]]
     .map(a=>({p:a.slice(0,3),mv:[a[3],a[4],a[5],a[6]]}))},
];
