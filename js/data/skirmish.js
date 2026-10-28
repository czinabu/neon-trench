"use strict";
/* Skirmish (title screen, js/skirmish.js): a fleet battle against the AI outside the campaign. The setup screen picks
   your destroyers (in the line, held as the reserve, or left home) and their roles, the enemy line ship by ship, the
   enemy admiral, the Kiru Gate, fighter cover and difficulty; skirmishMission turns that into a fleet op.
     allies     your destroyers, in order: name and where each takes station
     foeAt      enemy stations, in arrival order; arrive [first, gap]: seconds before the first ship, then between ships
     foeNames   enemy names by kind, handed out in order (gate ships take the next ones)
     maxFoes    most ships in the enemy line
     gate       the Kiru Gate when it is on: where it stands, and what it sends through (as a mission's `gate`)
     fighters   hostile fighters to shoot down as well, by setting (none: the capital ships are the whole fight)
     difficulty HALCYON's hull, and a multiplier on every enemy hull
     start      the setup the screen opens on */
const SKIRMISH={
  allies:[{name:'SOLACE',at:[170,-15,240]},{name:'BASTION',at:[-330,-20,250]},{name:'MERIDIAN',at:[420,-30,330]}],
  foeAt:[[0,20,-470],[-320,-10,-380],[320,-10,-380],[-160,30,-560],[170,25,-560],[-460,0,-520]],
  arrive:[4,6],
  foeNames:{cruiser:['WARDEN','RAMPART','CITADEL','TYRANT','BULWARK','PALADIN','BASTILLE','HALBERD'],
            frigate:['LASH','BARB','SPITE','WRATH','SCORN','DIRGE','VIGIL','THORN']},
  maxFoes:6,
  gate:{at:[0,40,-760],first:25,every:40,ships:[{kind:'cruiser',hp:900},{kind:'frigate'},{kind:'cruiser',hp:900},{kind:'frigate'}]},
  fighters:{none:{name:'None',n:0},light:{name:'Light',n:6},heavy:{name:'Heavy',n:12}},
  difficulty:{easy:{name:'Easy',carrierHp:2400,foeHp:.8},normal:{name:'Normal',carrierHp:1800,foeHp:1},hard:{name:'Hard',carrierHp:1400,foeHp:1.25}},
  roster:{grunt:1,dart:.6,hunter:.4,ace:.2},
  start:{allies:[{state:'line',role:'line'},{state:'line',role:'screen'},{state:'reserve',role:'artillery'}],
         foes:[{kind:'cruiser',role:'line'},{kind:'frigate',role:'screen'},{kind:'frigate',role:'artillery'}],
         admiral:true,gate:false,fighters:'light',difficulty:'normal'},
};
