"use strict";
/* Capital ships: tunable numbers for the enemy capitals and the friendly carrier (the models and AI are in
   js/capital.js and js/update/capital.js). Missions opt in with `capital:'cruiser'|'frigate'|true` (true picks
   one) and `carrier:true`; free arena gets a random enemy capital and the carrier.
     name/cls   callsign and class shown on the HUD      worth   score for destroying it
     spawnKills the enemy warps in after this many kills (or spawnTime seconds)
     yaw        turn rate on station (rad/s)             range   gun reach
     scatter    aim scatter in metres on gun bolts       wingChance  chance a retarget (every 3-6 s) goes for a wingman
     gun        turret: hp, fire [base, random] seconds between bursts, shots per burst, boltSpd, worth
     flak       flak turret: shells that burst near the target; burst radius and damage at the centre
     lance      spinal cannon: charge seconds (telegraphed), fire seconds, cooldown [base, random],
                damage per hit, beam half-width, reach, turn rate while aiming (rad/s); hp to knock it out
     core       reactor, exposed once every gun is down; a single hit takes at most maxHit */
const CAPITAL_TYPES={
  cruiser:{name:'MAW',cls:'CRUISER',worth:5000,spawnKills:3,spawnTime:45,yaw:.012,range:700,scatter:7,wingChance:.35,
    gun:{name:'TURRET',hp:16,r:5,fire:[2.4,1.8],shots:2,gap:.13,boltSpd:260,worth:300},
    core:{name:'REACTOR',hp:60,r:7,maxHit:20}},
  frigate:{name:'VESPER',cls:'LANCE FRIGATE',worth:4500,spawnKills:3,spawnTime:45,yaw:0,range:760,scatter:7,wingChance:.35,
    flak:{name:'FLAK',hp:12,r:4.5,fire:[2.6,1.4],shellSpd:210,radius:22,dmg:14,worth:250},
    lance:{name:'LANCE',hp:30,r:6,charge:2.6,fire:.7,cooldown:[6,3],dmg:40,width:7,reach:1100,turn:.09,worth:600},
    core:{name:'REACTOR',hp:50,r:7,maxHit:20}},
};
/* ships big enough to fly a run down the inside of (missions with `interior`, js/interior.js). They are
   kilometres long, far too big for the arena, so they never warp into a dogfight. */
const INTERIOR_SHIPS={
  dreadnought:{name:'THRONE',cls:'DREADNOUGHT'},   // the syndicate flagship that MAW cruisers escort
};
/* the friendly carrier: wingmen launch from its bay, and lost ones are replaced from a small reserve, and `squads` extra squadrons can be launched from the bridge */
const CARRIER_TYPE={name:'HALCYON',cls:'CARRIER',hp:400,reserve:2,squads:2,relaunch:10,boltDmg:8};
/* HALCYON's point-defence turrets (js/carrierpd.js): they shoot hostile fighters, bombers and missiles in reach.
     mounts   where each sits, [half, x, y, z] on the deck in the ship's frame (-z is the bow); the first `base` are
              fitted from the start and the refit's EXTRA MOUNTS bring in the rest
     range    metres of reach        fire  seconds between a mount's shots      dmg  hull damage per bolt
     boltSpd  m/s                    scatter  aim scatter in metres */
const CARRIER_PD={
  mounts:[['fore',-20,18,-70],['fore',20,18,-70],['aft',-24,18,60],['aft',-24,18,120],['aft',24,18,120],['aft',0,18,90]],
  base:4,range:380,fire:.32,dmg:1,boltSpd:700,scatter:3,
};
/* the escort that holds the line beside HALCYON in fleet battles (it has no bay and no reserve) */
const ESCORT_TYPE={name:'SOLACE',cls:'DESTROYER',hp:650,boltDmg:8};
/* Fleet battles (missions with `fleet:true`, js/fleet.js): HALCYON and SOLACE hold a line while MAW and VESPER
   warp in across from them, and the two lines trade broadsides. Enemy capitals in a fleet battle carry three
   subsystems you can shoot off, and their hulls wear down under the fleet's guns:
     shieldgen  the reactor shield hangs off it (not off the guns, as in a normal capital fight), and while it
                runs the hull soaks most of a broadside (shieldSoak)
     engines    while they run the ship closes on HALCYON (and the frigate can swing its lance round)
     bridge     fire control: with it gone turrets fire slower and scatter more, and broadsides miss more
   An enemy capital goes up when its reactor is destroyed or its hull runs out.
     enemies    who warps in and when (seconds into the run); at[] is roughly where each takes station
     hp         enemy hull vs broadsides                   carrierHp  HALCYON's hull in a fleet battle
     salvo      [base, random] seconds between broadsides  shots      shells per broadside (at most)
     shellSpd/shellDmg  broadside shells (m/s, damage per hit); playerDmg if one hits you
     hit        hit chance [far, near] between farRange and nearRange; blindHit multiplies it once the bridge is gone
     advance    m/s an enemy closes while its engines run, until closeTo metres from HALCYON
   Orders from the command bridge (js/bridge.js) to HALCYON and SOLACE:
     sysHit/sysDmg  a broadside aimed at a subsystem: hit chance multiplier (a small mark) and the share of shell
                    damage the subsystem takes (the hull takes none of it)
     closeSpd   m/s a friendly capital moves under a move order, CLOSE IN or RETURN TO STATION; CLOSE IN stops at nearRange from its target */
const FLEET={
  enemies:[{kind:'cruiser',t:4,at:[-140,10,-380]},{kind:'frigate',t:11,at:[160,-10,-360]}],
  carrierAt:[-90,-40,310],escortAt:[170,-15,240],
  hp:{cruiser:700,frigate:560},carrierHp:1600,shieldSoak:.8,
  salvo:[3.4,1.6],shots:3,shellSpd:170,shellDmg:{friend:14,enemy:12},playerDmg:18,
  hit:[.5,.85],farRange:700,nearRange:420,blindHit:.45,blindFire:1.8,blindScatter:2.5,
  advance:6,closeTo:430,
  sysHit:.6,sysDmg:.25,closeSpd:9,
  goalTime:150,retreat:380,   // a waypoint is dropped after goalTime seconds if a hull or rock keeps the ship from it; FALL BACK runs this many metres from the enemy line
  form:{line:[[300,0],[-300,0],[600,0]],column:[[0,-330],[0,-620],[0,330]],screen:[[130,260],[-130,260],[0,430]]},   // destroyer slots off HALCYON, the first for SOLACE, then the allies and the reserve: [starboard, ahead] metres (a negative number trails)
  systems:{shieldgen:{name:'SHIELD GENERATOR',short:'SHIELD',hp:24,r:5,worth:400},
           engines:{name:'ENGINES',short:'ENGINES',hp:30,r:6,worth:400},
           bridge:{name:'BRIDGE',short:'BRIDGE',hp:26,r:6,worth:500}},
  /* capital ship roles (js/fleet.js), for both lines: what a ship does when nothing else moves it, and how it fights.
       line       holds where it is put and trades broadsides (every ship before roles)
       screen     guards a ward (HALCYON; for the enemy, the ship its admiral names): keeps `at` metres out from it toward the
                  enemy, and while within `guard` metres on the enemy's side of it catches `catch` of the shells aimed at the ward
                  (any other destroyer in that spot catches `catchAny`)
       artillery  stands off at least `keep` metres from the nearest enemy ship, hits as well at long range as at short
                  (`hit`), and fires heavier (`dmg`) but slower (`salvo`) broadsides */
  roles:{line:{name:'Line',tip:'Holds where you put it and trades broadsides.'},
         screen:{name:'Screen',tip:'Stays between HALCYON and the enemy and catches shells meant for her.',at:220,guard:300,catch:.5,catchAny:.12},
         artillery:{name:'Artillery',tip:'Stands off at long range with heavy, slower broadsides.',keep:640,hit:.8,dmg:1.6,salvo:1.4}},
  /* fleet-wide formations off HALCYON (the bridge's FLEET row; slots in `form`), for a destroyer within formNear metres of its slot:
     line abreast brings every battery to bear (`hit` multiplies its hit chance), a column is a narrow target (`foeHit`
     multiplies the enemy's), and a screen catches at least `catch` of the shells aimed at HALCYON */
  formFx:{line:{hit:1.25},column:{foeHit:.7},screen:{catch:.3}},formNear:90,
};
/* The enemy admiral (Admiral ops: the line entry with `admiral:true` is its flagship; js/enemyadm.js). Every `think` seconds
   it reads the friendly fleet's orders and picks a plan:
     cover    two or more of your ships are on one of its ships: its screens move to cover it, and below withdrawHp of its
              hull that ship pulls back for withdrawT seconds (once)
     pursue   your fleet is falling back or returning to station: its line closes `pursue` times as fast, down to pursueTo metres
     punish   your destroyers are closing in: its guns go onto the weakest of them
     break    two or more of your destroyers are screening HALCYON: its guns go onto the weakest screen
     exposed  no destroyer of yours within `exposed` metres of HALCYON: its guns go onto HALCYON
     press    otherwise: fire spread over your line, HALCYON first
   A plan's mark draws focusP of the enemy broadsides. Shooting out the flagship's bridge (or sinking it) silences the admiral. */
const ADMIRAL={think:3,focusP:.75,pursue:2.2,pursueTo:300,withdrawHp:.45,withdrawT:18,exposed:420,radioGap:9};
/* The Kiru Gate (Admiral ops with `gate`, js/fleet.js): a jump gate on the far side of the enemy line. Its aperture faces
   the friendly line and soaks broadsides like a capital's shield; three anchors on the ring hold it open, and with all
   three shot out it collapses. While it stands it sends the op's `gate.ships` through, one every `gate.every` seconds.
     r       ring radius (m)       mouth  how far in front of the ring a ship that comes through takes station
     hp      hull vs broadsides    anchor  the three anchors: shot like a capital's subsystems */
const GATE_TYPE={name:'KIRU GATE',cls:'JUMP GATE',worth:8000,hp:1600,r:110,mouth:230,
  anchor:{name:'ANCHOR',short:'ANCHOR',hp:40,r:9,worth:600}};
