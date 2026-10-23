"use strict";
/* Command center refit: upgrades for HALCYON and the wing, bought on the Fleet station's Upgrades subtab (js/command.js) with
   campaign rewards. `cur` is the currency (credits or parts), `costs` the price of each level in turn, and
   `per` what one level adds. How each one is read in flight: fleetLevel() in js/progression.js. */
const FLEET_UPGRADES=[
  {id:'wingHull', group:'wing',    name:'REINFORCED AIRFRAMES', desc:'Heavier plating on every wingman, so they last longer under fire.',
   per:'+20% wingman hull',      cur:'credits', costs:[400,900,1500]},
  {id:'wingGuns', group:'wing',    name:'LINKED CANNON',        desc:'Wingmen cycle their lasers faster.',
   per:'+15% wingman fire rate', cur:'credits', costs:[400,900,1500]},
  {id:'wingSkill',group:'wing',    name:'GUNNERY DRILLS',       desc:'Sharper pilots: tighter turns and a longer reach before they open fire.',
   per:'+10% turn rate, +12% range', cur:'credits', costs:[350,800,1300]},
  {id:'carHull',  group:'carrier', name:'ARMOUR BELTS',         desc:'More hull on HALCYON, so it stays afloat through a longer fight.',
   per:'+25% carrier hull',      cur:'parts',   costs:[2,3,4]},
  {id:'carBay',   group:'carrier', name:'BAY CREWS',            desc:'Deck crews turn replacements around faster.',
   per:'-20% relaunch wait',     cur:'parts',   costs:[2,3]},
  {id:'carRes',   group:'carrier', name:'RESERVE PILOTS',       desc:'More pilots waiting in the bay to replace losses.',
   per:'+1 reserve pilot',       cur:'parts',   costs:[3,5]},
  {id:'carPdMount',group:'carrier',name:'EXTRA MOUNTS',        desc:'Fits more point-defence turrets to HALCYON\'s decks.',
   per:'+1 point-defence turret', cur:'parts',   costs:[3,5]},
  {id:'carPdRof', group:'carrier', name:'AUTOLOADERS',          desc:'Point-defence turrets cycle faster.',
   per:'+25% turret fire rate',   cur:'parts',   costs:[2,3]},
  {id:'carPdRange',group:'carrier',name:'TRACKING ARRAYS',      desc:'Turrets engage targets from further out.',
   per:'+15% turret range',       cur:'parts',   costs:[2,3]},
];
