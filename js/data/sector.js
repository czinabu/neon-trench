"use strict";
/* Sector map (js/sector.js): the road from Broadside to the Kiru Gate. Before each fleet battle after Broadside you may
   strike one of two side targets; the other slips away once you pick. Damage the fleet takes carries forward
   (SECTOR_CARRY in js/config.js).
     SECTOR_ROUTE    the story ops on the map, in order, with their spot on the map (x, y in a 1000 x 420 box)
     SECTOR_KINDS    what a target is: the op it flies (a mission's fields), what striking it does, and its lines
                     gives  short effect shown on the map and the briefing
     SECTOR_TARGETS  the side targets: id, kind, name, leg (the story op they come before), at
     SECTOR_FLEET    the friendly capitals whose hull carries forward, and the op each first flies in */
const SECTOR_ROUTE=[
  {id:'m10',at:[70,220]},{id:'m11',at:[193,180]},{id:'m12',at:[316,230]},{id:'m13',at:[439,190]},
  {id:'m14',at:[562,215]},{id:'m15',at:[685,175]},{id:'m16',at:[808,225]},{id:'m17',at:[931,200]},
];
const SECTOR_KINDS={
  depot:{name:'Supply depot',gives:'Full repairs for the fleet',sub:'// supply raid',
    op:{sector:'arena',count:8,roster:{grunt:1,dart:.6,hunter:.2}},objective:'Clear the depot guard: 8 hostiles',
    brief:'A syndicate fuel and parts depot. Clear its guard and the yard crews patch up every ship in the fleet.',
    bonus:{type:'hull',val:50,credits:150,label:'Finish with hull > 50%'},reward:{credits:400,parts:0},
    open:['reyes','Depot guard is light. Clear it and the crews can patch the fleet.'],
    radio:[[5,'reyes','Depot guard closing. Eight of them.']],
    win:['vale','Depot is ours. Every ship gets a patch before the next fight.'],lose:['reyes','Depot guard held. The fleet flies as it is.']},
  yard:{name:'Shipyard',gives:'Enemy capitals next op: 20% less hull',sub:'// capital strike',capName:'YARD GUARD',
    op:{sector:'arena',count:4,capital:'cruiser',roster:{grunt:1,dart:.5}},objective:'Destroy the yard\'s guard cruiser',
    brief:'A refit yard is plating the syndicate line. Kill its guard cruiser and their next line flies thin-skinned.',
    bonus:{type:'hull',val:50,credits:200,label:'Finish with hull > 50%'},reward:{credits:600,parts:1},
    open:['lark','A cruiser guarding a yard. Turrets first, same as always.'],
    radio:[[6,'reyes','Guard cruiser is warping in over the slips.']],
    win:['reyes','Yard is burning. Their next line goes out half plated.'],lose:['reyes','The yard holds. Their plating ships on time.']},
  base:{name:'Fighter base',gives:'Half the enemy fighters next op',sub:'// trench strike',
    op:{sector:'trench'},objective:'Breach the base reactor',
    brief:'The fighters that cover their line launch from here. Run its service trench and put a torpedo in the reactor.',
    bonus:{type:'hull',val:60,credits:200,label:'Exfil with hull > 60%'},reward:{credits:500,parts:1},
    open:['reyes','Their fighter cover launches from this base. Trench run, like the old days.'],
    radio:[[4,'reyes','Service trench ahead. The reactor is at the far end.']],
    win:['pike','Base is dark. Fewer of them to shoot at next time. Shame.'],lose:['reyes','Base is still launching. Expect a full screen.']},
  salvage:{name:'Salvage field',gives:'+3 parts for HALCYON refits',sub:'// hold the field',
    op:{sector:'arena',survive:60,roster:{grunt:1,dart:.5,hunter:.3}},objective:'Hold the field for 60 seconds',
    brief:'A wrecked convoy drifts here. Hold off the scavenger fighters while HALCYON\'s tugs strip it for parts.',
    bonus:{type:'kills',val:8,credits:200,label:'8+ kills while holding'},reward:{credits:400,parts:3},
    open:['reyes','Tugs need sixty seconds on the wrecks. Keep the scavengers off them.'],
    radio:[[30,'reyes','Halfway. Tugs are loaded heavy.']],
    win:['reyes','Tugs are home and full. The deck crew will put it to use.'],lose:['reyes','Tugs pulled out empty.']},
};
const SECTOR_TARGETS=[
  {id:'x11a',kind:'depot',  name:'TARN DEPOT',  leg:'m11',at:[131,85]}, {id:'x11b',kind:'yard',   name:'VEY YARDS',   leg:'m11',at:[131,330]},
  {id:'x12a',kind:'base',   name:'OSK BASE',    leg:'m12',at:[254,90]}, {id:'x12b',kind:'salvage',name:'CALLOW DRIFT',leg:'m12',at:[254,335]},
  {id:'x13a',kind:'depot',  name:'HESP DEPOT',  leg:'m13',at:[377,85]}, {id:'x13b',kind:'base',   name:'MIRE BASE',   leg:'m13',at:[377,330]},
  {id:'x14a',kind:'yard',   name:'KOTH YARDS',  leg:'m14',at:[500,90]}, {id:'x14b',kind:'salvage',name:'ASH FIELD',   leg:'m14',at:[500,335]},
  {id:'x15a',kind:'depot',  name:'RILL DEPOT',  leg:'m15',at:[623,80]}, {id:'x15b',kind:'base',   name:'SABLE BASE',  leg:'m15',at:[623,330]},
  {id:'x16a',kind:'yard',   name:'IRON YARDS',  leg:'m16',at:[746,85]}, {id:'x16b',kind:'depot',  name:'DUST DEPOT',  leg:'m16',at:[746,335]},
  {id:'x17a',kind:'base',   name:'VANT BASE',   leg:'m17',at:[870,85]}, {id:'x17b',kind:'depot',  name:'GALE DEPOT',  leg:'m17',at:[870,330]},
];
const SECTOR_FLEET=[{name:'HALCYON',joins:'m10'},{name:'SOLACE',joins:'m10'},{name:'BASTION',joins:'m15'},{name:'MERIDIAN',joins:'m16'}];
/* each target as a launchable op (the hub, briefing and debrief take it like any mission), and its lines in STORY */
const SECTOR_OPS=SECTOR_TARGETS.map(t=>{const K=SECTOR_KINDS[t.kind];
  STORY[t.id]={open:[K.open],radio:K.radio,win:[K.win],lose:K.lose};
  return Object.assign({id:t.id,name:t.name,sub:K.sub,side:true,leg:t.leg,kind:t.kind,carrier:false,capital:false,capName:K.capName,
    objective:K.objective,brief:[K.brief,'Strike it: '+K.gives.toLowerCase()+'.'],bonuses:[K.bonus],reward:K.reward},K.op);});
