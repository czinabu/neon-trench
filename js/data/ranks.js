"use strict";
/* Campaign rank ladder. A rank is earned by clearing its `after` op (the first has none) and is worked out
   from PROG.completed (rankLevel in js/progression.js), so old saves land on the right rank.
     gives  what the promotion unlocks (shown on the promotion screen and the sortie board) */
const RANKS=[
  {id:'fo',name:'Flight Officer',abbr:'FO',after:null,
   gives:'You fly solo sorties. Prove yourself over the trench and the open zone.'},
  {id:'lt',name:'Lieutenant',abbr:'LT',after:'m5',
   gives:'Pike and Lark now fly your wing, and the 1-6 keys give them orders.'},
  {id:'cdr',name:'Commander',abbr:'CDR',after:'m9',
   gives:'The command bridge opens: press B with HALCYON on station to run the battle with fleet orders, and launch extra squadrons from the bay.'},
];
