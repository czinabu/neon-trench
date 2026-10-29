"use strict";
/* Fleet management (js/dock.js) between campaign battles, on the command center's Fleet station once the
   sector map opens. Repair the hull a ship carries into the next op, refit the destroyers with parts, commission new
   destroyers, and watch the captains rank up.
     DOCK.repairCr   credits per 1% of hull repaired
     DOCK.refits     per-destroyer refit tracks, paid in parts: `costs` per level, `fx` what one level adds
     DOCK.ranks      captain ranks by battles survived on the front line (`xp`); each rank above the first adds rankFx:
                     `hit` to the ship's broadside hit chance and `salvo` off the time between broadsides
     CAPTAINS        who commands each ship
     RECRUITS        destroyers you can commission: they fly with the fleet line (in every campaign fleet battle SOLACE
                     flies in) from the next op on, at `at`, in their `role` (FLEET.roles) */
const DOCK={
  repairCr:8,
  refits:[
    {id:'armour',name:'Armour plate',per:'+15% hull',fx:.15,costs:[2,4]},
    {id:'guns',  name:'Gun decks',   per:'+15% broadside damage',fx:.15,costs:[2,4]},
  ],
  ranks:[{name:'Green',xp:0},{name:'Seasoned',xp:2},{name:'Veteran',xp:4},{name:'Ace',xp:7}],
  rankFx:{hit:.06,salvo:.05},
};
const CAPTAINS={HALCYON:'Vale',SOLACE:'Okafor',BASTION:'Teague',MERIDIAN:'Imre',WARDEN:'Halden',LANCER:'Sato'};
const RECRUITS=[
  {name:'WARDEN',role:'screen',   credits:1800,parts:3,at:[460,-25,280], tip:'Screen: guards HALCYON'},
  {name:'LANCER',role:'artillery',credits:2200,parts:4,at:[-600,-10,280],tip:'Artillery: heavy guns at range'},
];
