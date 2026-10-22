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
/* the friendly carrier: wingmen launch from its bay, and lost ones are replaced from a small reserve */
const CARRIER_TYPE={name:'HALCYON',cls:'CARRIER',hp:400,reserve:2,relaunch:10,boltDmg:8};
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
     advance    m/s an enemy closes while its engines run, until closeTo metres from HALCYON */
const FLEET={
  enemies:[{kind:'cruiser',t:4,at:[-140,10,-380]},{kind:'frigate',t:11,at:[160,-10,-360]}],
  carrierAt:[-90,-40,310],escortAt:[170,-15,240],
  hp:{cruiser:700,frigate:560},carrierHp:1600,shieldSoak:.8,
  salvo:[3.4,1.6],shots:3,shellSpd:170,shellDmg:{friend:14,enemy:12},playerDmg:18,
  hit:[.5,.85],farRange:700,nearRange:420,blindHit:.45,blindFire:1.8,blindScatter:2.5,
  advance:6,closeTo:430,
  systems:{shieldgen:{name:'SHIELD GENERATOR',short:'SHIELD',hp:24,r:5,worth:400},
           engines:{name:'ENGINES',short:'ENGINES',hp:30,r:6,worth:400},
           bridge:{name:'BRIDGE',short:'BRIDGE',hp:26,r:6,worth:500}},
};
