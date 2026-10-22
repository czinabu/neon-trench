"use strict";
/* Capital ships: tunable numbers for the enemy capitals and the friendly carrier (the models and AI are in
   js/capital.js and js/update/capital.js). Missions opt in with `capital:'cruiser'|'frigate'|true` (true picks
   one) and `carrier:true`; free arena gets a random enemy capital and the carrier.
     name/cls   callsign and class shown on the HUD      worth   score for destroying it
     spawnKills the enemy warps in after this many kills (or spawnTime seconds)
     yaw        turn rate on station (rad/s)             range   gun reach
     gun        turret: hp, fire [base, random] seconds between bursts, shots per burst, boltSpd, worth
     flak       flak turret: shells that burst near the target; burst radius and damage at the centre
     lance      spinal cannon: charge seconds (telegraphed), fire seconds, cooldown [base, random],
                damage per hit, beam half-width, reach, turn rate while aiming (rad/s); hp to knock it out
     core       reactor, exposed once every gun is down; a single hit takes at most maxHit */
const CAPITAL_TYPES={
  cruiser:{name:'MAW',cls:'CRUISER',worth:5000,spawnKills:3,spawnTime:45,yaw:.012,range:700,
    gun:{name:'TURRET',hp:16,r:5,fire:[2.4,1.8],shots:2,gap:.13,boltSpd:260,worth:300},
    core:{name:'REACTOR',hp:60,r:7,maxHit:20}},
  frigate:{name:'VESPER',cls:'LANCE FRIGATE',worth:4500,spawnKills:3,spawnTime:45,yaw:0,range:760,
    flak:{name:'FLAK',hp:12,r:4.5,fire:[2.6,1.4],shellSpd:210,radius:22,dmg:14,worth:250},
    lance:{name:'LANCE',hp:30,r:6,charge:2.6,fire:.7,cooldown:[6,3],dmg:40,width:7,reach:1100,turn:.09,worth:600},
    core:{name:'REACTOR',hp:50,r:7,maxHit:20}},
};
/* the friendly carrier: wingmen launch from its bay, and lost ones are replaced from a small reserve */
const CARRIER_TYPE={name:'HALCYON',cls:'CARRIER',hp:400,reserve:2,relaunch:10,boltDmg:8};
