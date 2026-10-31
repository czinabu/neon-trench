"use strict";
/* Contracts (Free Play, js/contracts.js): procedural ops built from a seed out of the campaign's own pieces. A board is a
   seed code; each of its CONTRACTS.board slots rolls its own op from that code, so the same code always deals the same board.
     board    contracts on a board (each a different kind)
     threat   per threat level: weight on a board, the DIFFICULTY level it flies at, payout multiplier, parts added, and
              the enemy capital hull multiplier in a fleet action (HALCYON's hull is divided by it)
     kinds    what an op can be. w: weight on a board; sector and the mission fields it sets are filled by contractBuild.
              credits: base payout before threat; parts: base parts. The ranges ([lo,hi]) are rolled per op.
     bonus    optional objectives each kind can draw two of (evalBonus types in js/progression.js), with their payout
     names    op names: one word from each list; places: where it happens
     brief    briefing text per kind: {place} {n} {t} {cap} {line} are filled in. The first sentence leads the briefing.
     vox      CIC Reyes on the briefing, and on the debrief (win, lose) */
const CONTRACTS={
  board:3,
  threat:{
    easy:  {name:'Low',   w:2,pay:.8, parts:0,foeHp:.85},
    normal:{name:'Medium',w:3,pay:1,  parts:0,foeHp:1},
    hard:  {name:'High',  w:2,pay:1.4,parts:1,foeHp:1.2},
  },
  kinds:{
    sweep:   {w:3,  sub:'Fighter sweep',   sector:'arena',count:[10,16],credits:700, parts:1,bonus:['hull','time','flawless','wing']},
    hold:    {w:2,  sub:'Defensive hold',  sector:'arena',survive:[60,120],credits:800,parts:1,bonus:['kills','hull','wing']},
    strike:  {w:2.5,sub:'Capital strike',  sector:'arena',count:[4,8],credits:1100,parts:2,bonus:['time','hull','wing','flawless']},
    hunt:    {w:1.5,sub:'Ace hunt',        sector:'arena',count:[8,12],credits:1200,parts:2,bonus:['time','hull','flawless']},
    defend:  {w:1.5,sub:'Carrier defence', sector:'arena',count:[6,10],credits:1300,parts:2,bonus:['carrier','wing','hull']},
    trench:  {w:2,  sub:'Trench strike',   sector:'trench',credits:900,parts:1,bonus:['noboost','hull','kills']},
    interior:{w:1,  sub:'Capital interior',sector:'trench',credits:1300,parts:2,bonus:['vents','hull']},
    fleet:   {w:1.2,sub:'Fleet action',    sector:'arena',count:[4,8],ships:[1,3],credits:1600,parts:3,bonus:['carrier','escort','admiral']},
  },
  bonus:{
    hull:    {val:[40,70],credits:[150,250],label:'Finish with hull > {v}%'},
    kills:   {val:[8,18], credits:[150,250],label:'Down {v}+ hostiles'},
    time:    {credits:[200,300],label:'Clear under {t}'},
    flawless:{credits:[350,450],label:'Flawless: no hull damage taken'},
    wing:    {credits:[200,300],label:'Bring both wingmen home'},
    noboost: {credits:[250,350],label:'Complete without boosting'},
    vents:   {credits:[250,350],label:'Never touch a plasma vent'},
    carrier: {val:[50,70],credits:[300,400],label:'HALCYON hull > {v}% at the end'},
    escort:  {credits:[250,350],label:'SOLACE survives'},
    admiral: {credits:[400,500],label:'Silence the enemy admiral'},
  },
  names:[['Cold','Iron','Silent','Broken','Hollow','Amber','Glass','Red','Last','Pale','Black','Bright','Long','Quiet','Sharp','Burning'],
         ['Lantern','Harbor','Spindle','Needle','Verdict','Tide','Ember','Meridian','Anvil','Orchard','Signal','Halo','Hammer','Wake','Crown','Furnace']],
  places:['the Varn Shoals','Helios Reach','the Kiru Approaches','Drift Station Oshu','the Cinder Belt','Marrow Lane','the Tessaly Ring',
    'the Glass Expanse','Port Calder','the Sable Deep','Arcology Nine','the Ostrava Relay'],
  brief:{
    sweep:['Syndicate fighters have taken {place} and are choking the shipping lanes.','Clear the zone: {n} confirmed kills.','No capital ships reported. Fly free and pick your passes.'],
    hold:['A relay crew at {place} needs {t} to finish its jump.','Hold the zone until they are clear. The fighters will not stop coming.','Stay alive. Kills are a bonus, not the contract.'],
    strike:['A syndicate {cap} is parked over {place}, covering a supply run.','Strip its turrets, break the shield and kill the reactor.','Clear its fighter screen too: {n} escorts are on station.'],
    hunt:['A Kestrel-trained ace has been raiding convoys near {place}.','Thin out the escort squadron and the ace will come for you.','Down {n} fighters, then finish the leader.'],
    defend:['HALCYON is resupplying at {place}, and a syndicate {cap} has found her.','Break the {cap} before it breaks the carrier. Lost wingmen relaunch from her bay.','If HALCYON goes down the contract is lost.'],
    trench:['A syndicate power station at {place} is feeding their shields.','Dive the service trench and put a torpedo in the reactor intake.','Thread the beam gates and gun whatever gets in your way.'],
    interior:['A damaged dreadnought is limping out of {place} with its flank breached.','Fly in through the breach and down the reactor trench to the core.','When the core goes, turn around and fly out before the ship breaks apart.'],
    fleet:['A syndicate battle line is moving on {place}: {line}.','HALCYON and SOLACE will hold the line. Shoot out shield generators so their broadsides bite.','Press B on station to command the fleet from the bridge. If HALCYON goes down the contract is lost.'],
  },
  vox:{
    brief:['Contract from fleet logistics. Payout on completion, no questions.','Off the books, Captain says. Fly it clean.','Paying work, pilot. Read the board and pick your fight.'],
    win:['Contract complete. Payment is on its way to your account.','Clean work. Logistics will be calling again.'],
    lose:['Contract failed. Logistics will want another pilot on the next one.'],
  },
};
