"use strict";
/* Flight school lessons. A lesson is a drill with a pass grade (js/school.js runs them).
     kind   'tour' guided controls walkthrough (js/tutorial.js), 'gates' fly the gates in order (a lesson with drones too spawns them once the gates are done), 'guns' destroy the drones,
            'evade' survive training missiles (waves, graded by hits instead of par)
     par    [A, B, C] times in seconds; slower than C is a fail. Gate and gun lessons add penalties to the clock.
     gates  [{p:[x,y,z], r, spd:'fast'|'slow'}]   spd gates only count at that speed (a miss costs SCHOOL_MISS_S)
     drones [{p:[x,y,z], mv:[ax,ay,az,w]}]        mv = sway amplitude on each axis (m) and speed (rad/s); omitted = hangs still
   The ship starts at the origin facing -z, above the academy runway. */
const SCHOOL_MISS_S=8;       // seconds added for a speed gate flown at the wrong speed
const SCHOOL_SHOT_S=.12;     // seconds added per laser shot that missed a drone
const SCHOOL_FAST=215, SCHOOL_SLOW=85;   // m/s: fast gates need at least this, slow gates at most this
const schoolSlalom=()=>Array.from({length:10},(_,i)=>({p:[(i%2?-1:1)*72,((i%3)-1)*24,-150-i*125],r:15}));
const schoolSpeed=()=>Array.from({length:6},(_,i)=>({p:[(i%2?-1:1)*38,((i%3)-1)*14,-220-i*210],r:20,spd:i%2?'slow':'fast'}));
const schoolStrafe=()=>Array.from({length:8},(_,i)=>({p:[[40,-40,40,-40,0,32,-32,0][i],[0,30,-30,0,34,-34,0,0][i],-130-i*105],r:10}));
const SCHOOL_RINGS=[[0,0,-380],[140,50,-660],[360,90,-860],[620,40,-900],[820,-60,-720],[800,-150,-420],[560,-90,-200],[260,0,-90]];
const SCHOOL_LESSONS=[
  {id:'tour',name:'CONTROLS TOUR',sub:'// ungraded',kind:'tour',
   desc:'Steer, throttle, boost, roll, strafe, camera, flight model, lasers, missile mode and flares, one at a time.'},
  {id:'rings',name:'RING RUN',sub:'// flight model',kind:'gates',par:[24,34,50],limit:120,
   desc:'Fly a loop of eight rings. Boost the straights and ease off in the turns.',
   gates:SCHOOL_RINGS.map(p=>({p,r:22}))},
  {id:'slalom',name:'SLALOM',sub:'// precision turning',kind:'gates',par:[30,42,60],limit:120,
   desc:'Ten tight gates, left and right in turn. Roll into each turn and keep your speed up.',
   gates:schoolSlalom()},
  {id:'strafe',name:'STRAFING',sub:'// sideways thrust',kind:'gates',par:[28,38,55],limit:120,
   desc:'Small off-centre gates in a straight line. Keep your heading and slide in: A / D left and right, Space / C up and down.',
   gates:schoolStrafe()},
  {id:'speed',name:'THROTTLE CONTROL',sub:'// boost and brake',kind:'gates',par:[38,52,75],limit:150,
   desc:'Magenta gates need '+SCHOOL_FAST+'+ m/s (boost). Green gates need '+SCHOOL_SLOW+' m/s or less (brake with S). Wrong speed costs '+SCHOOL_MISS_S+' s.',
   gates:schoolSpeed()},
  {id:'static',name:'GUNNERY',sub:'// stationary targets',kind:'guns',par:[18,28,45],limit:120,
   desc:'Six drones hang in the range. Lead nothing, aim true. Every missed shot adds time.',
   drones:[[-220,20,-300],[200,60,-380],[0,-60,-480],[-320,110,-560],[300,-40,-640],[0,130,-760]].map(p=>({p}))},
  {id:'moving',name:'MOVING TARGETS',sub:'// deflection shooting',kind:'guns',par:[28,42,68],limit:150,
   desc:'Five drones sway across the range. Aim where they are going, not where they are. Missed shots add time.',
   drones:[[-180,20,-320,80,24,0,.6],[180,60,-400,90,16,0,.5],[0,-60,-500,50,50,40,.8],[-280,100,-580,110,26,0,.45],[260,0,-680,80,40,50,.7]]
     .map(a=>({p:a.slice(0,3),mv:[a[3],a[4],a[5],a[6]]}))},
  {id:'missiles',name:'MISSILE LOCK',sub:'// missile mode',kind:'guns',par:[30,45,70],limit:120,noPenalty:true,
   desc:'Middle click for missile mode, R to target a drone, hold it in your sights, then left click. Ammo is unlimited here.',
   drones:[[-120,20,-380,50,15,0,.5],[110,-10,-420,50,20,0,.6],[0,50,-480,70,10,20,.45],[-60,-20,-560,60,30,0,.7]]
     .map(a=>({p:a.slice(0,3),mv:[a[3],a[4],a[5],a[6]]}))},
  {id:'evade',name:'EVASION',sub:'// flares and missile defence',kind:'evade',waves:5,limit:90,rule:'Grade by hits: A none · B one · C two',
   desc:'Five training missiles, one every few seconds, from different bearings. A lock tone sounds first. Drop flares with G or break hard. Hits are harmless here but count.'},
  {id:'exam',name:'CHECK RIDE',sub:'// final exam',kind:'gates',par:[42,60,85],limit:180,
   desc:'Gates, a boost gate and a brake gate, then three moving drones. Everything you have learned, on one clock.',
   gates:[[0,0,-300,22],[-110,40,-620,22],[90,-30,-940,16],[-70,30,-1260,12],[0,0,-1480,28,'fast'],[0,0,-1750,28,'slow']].map(a=>({p:a.slice(0,3),r:a[3],spd:a[4]})),
   drones:[[-100,10,-1880,60,18,0,.6],[100,30,-1940,70,10,0,.5],[0,-20,-2000,40,40,30,.8]].map(a=>({p:a.slice(0,3),mv:[a[3],a[4],a[5],a[6]]}))},
];
