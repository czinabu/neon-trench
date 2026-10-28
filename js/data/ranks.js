"use strict";
/* Campaign rank ladder. A rank is earned by clearing its `after` op (the first has none) and is worked out
   from PROG.completed (rankLevel in js/progression.js), so old saves land on the right rank.
     gives  what the promotion unlocks (shown on the promotion screen and the sortie board) */
const RANKS=[
  {id:'fo',name:'Flight Officer',abbr:'FO',after:null,
   gives:'You fly solo sorties. Prove yourself over the trench and the open zone.',
   quarters:'A rack in the pilots\' bunkroom, two decks below the hangar.',
   vox:['vale','Welcome aboard, Flight Officer. Earn the wing I give you.']},
  {id:'lt',name:'Lieutenant',abbr:'LT',after:'m5',
   gives:'Pike and Lark now fly your wing, and the 1-6 keys give them orders.',
   quarters:'A shared cabin with a window, one deck up.',
   vox:['vale','Pike and Lark are yours, Lieutenant. Try to bring them both home.']},
  {id:'cdr',name:'Commander',abbr:'CDR',after:'m9',
   gives:'Fleet command, one tool per op: the command bridge and holo-globe (Broadside), then squadrons (Ambush Lane), your own autopilot (Spearhead), fleet movement orders (Falling Back) and SOLACE formations (Wings of the Fleet).',
   quarters:'Your own cabin off the command deck, with a view of the whole fleet.',
   vox:['vale','The fleet is yours, Commander. Do not make me regret it.']},
  {id:'adm',name:'Admiral',abbr:'ADM',after:'m14',
   gives:'The combined fleet for the push on the Kiru Gate, one tool per op: battle groups, fleet-wide orders and ship roles (The Kiru Gate), then a reserve destroyer you call in where you want it (Breaking the Gate).',
   quarters:'The flag cabin behind HALCYON\'s bridge, with the fleet plot on the wall.',
   vox:['vale','Fleet Command made it official. HALCYON flies your flag now, Admiral. Take us to the Gate.']},
];
/* Commander and Admiral tools, unlocked one per op. A tool opens once its `after` op is cleared, so the next op is where it is taught;
   worked out from PROG.completed like rank, so old saves land on the right tools. Free arena runs (no mission) have them all. */
const CDR_TOOLS={
  bridge:{name:'Command bridge',after:'m9'},     // B, and the V holo-globe; taught in Broadside
  squads:{name:'Squadrons',after:'m10'},         // launch and order TALON and WRAITH; Ambush Lane
  auto:{name:'Autopilot',after:'m11'},           // YOU on the bridge; Spearhead
  move:{name:'Fleet movement',after:'m12'},      // waypoints, fall back, hold; Falling Back
  form:{name:'Formations',after:'m13'},          // SOLACE formations off HALCYON; Wings of the Fleet
  groups:{name:'Battle groups',after:'m14'},     // the bridge's FLEET row: orders to every capital at once, and destroyer roles; The Kiru Gate
  reserve:{name:'Reserve group',after:'m15'},    // call a reserve destroyer in where you mark the map; Breaking the Gate
};
