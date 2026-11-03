"use strict";
/* HALCYON's walkable deck (js/deck.js): tuning, the rooms you can fast travel to, and the crew's one-line barks.
     DECK         walking speeds, reach and feel, in metres and seconds: accel/brake m/s², turn rad/s, camDamp the share of the
                  gap the camera closes every 50 ms; saluteFrom is the rank (RANKS index) from which crew below you salute;
                  mirrorD and mirrorOff place the camera in front of you (and you left of the panel) at the locker
     DECK_LOOK    how you look in third person by default: colours per part, a hair style (a DECK_WARDROBE.hair id), build
                  (width) and height as multipliers. What you pick at the locker saves over it in your progress (PROG.look)
     DECK_WARDROBE the locker in your quarters: ready-made looks, the swatches for each part, hair styles, builds and heights
     DECK_ROOMS   fast-travel stops: where you arrive (x, z) and which way you face (yaw, 0 looks down -z, the bow)
     DECK_CREW    who stands where: speaker (a CAST id from js/data/story.js, or name and col), rank (as a RANKS index;
                  omitted is 0, the deck crew; Vale, a captain, sits between Commander and Admiral), position, facing,
                  the room, an optional look (as DECK_LOOK), and lines(): what they say this visit, picked in turn. Keep a line short. */
const DECK={walk:4.6,run:9,accel:22,brake:46,turn:10,runTurn:7,turnDamp:11,lean:.014,bank:.011,leanMax:.2,leanSmooth:9,camDamp:.5,saluteFrom:2,saluteR:4.5,saluteT:1.6,mirrorD:2.4,mirrorOff:.55,radius:.38,reach:3.2,barkR:4.2,barkT:4.6,doorR:5,fade:.22};
const DECK_LOOK={suit:0x232c40,trim:0x00f0ff,skin:0x9a7a68,hair:0x241a14,boots:0x0e1118,style:'short',build:1,height:1};
const DECK_WARDROBE={
  presets:[
    {name:'Squadron',look:{}},
    {name:'Night ops',look:{suit:0x14161c,trim:0xff3a4a,boots:0x08090c,style:'crop'}},
    {name:'Ember',look:{suit:0x4a2414,trim:0xffa22c,hair:0x8a3a1a,style:'swept'}},
    {name:'Glacier',look:{suit:0x8a94a0,trim:0x3c8cff,boots:0x2a3444,hair:0xb0a488,style:'tail'}},
    {name:'Verdant',look:{suit:0x24342a,trim:0x3cf08a,boots:0x14181a,style:'short'}},
    {name:'Royal',look:{suit:0x2a1c40,trim:0xffc23c,boots:0x1a1424,style:'swept'}},
  ],
  colors:[
    {k:'suit',name:'Flight suit',sw:[0x232c40,0x14161c,0x2a1c2a,0x24342a,0x4a2414,0x5a4a2a,0x2a1c40,0x5a1c22,0x3a4048,0x8a94a0]},
    {k:'trim',name:'Accent',sw:[0x00f0ff,0x3c8cff,0x3cf08a,0xffc23c,0xffa22c,0xff3a4a,0xff4ad8,0xa070ff,0xe8f0ff]},
    {k:'skin',name:'Skin',sw:[0xe8c4a8,0xd8aa88,0xc8a088,0x9a7a68,0x8a6248,0x7a5a48,0x6a4a38,0x4a3428,0x3a281e]},
    {k:'hair',name:'Hair',sw:[0x101010,0x241a14,0x4a2e1c,0x8a3a1a,0xc84a2a,0xa07a4a,0xc8b888,0x8a8a90,0xb0b0b6,0x3c6cff]},
    {k:'boots',name:'Gear',sw:[0x0e1118,0x08090c,0x2a2018,0x3a3020,0x2a3444,0x3a3a3e,0x5a1c22]},
  ],
  hair:[{id:'short',name:'Short'},{id:'crop',name:'Crop'},{id:'swept',name:'Swept'},{id:'tail',name:'Tail'},{id:'shaved',name:'Shaved'}],
  build:[{v:.92,name:'Lean'},{v:1,name:'Standard'},{v:1.09,name:'Broad'}],
  height:[{v:.95,name:'Short'},{v:1,name:'Average'},{v:1.05,name:'Tall'}],
};
const DECK_ROOMS=[
  {id:'bridge',name:'Bridge',sub:'Sector map and fleet',x:0,z:-72.5,yaw:0},
  {id:'hangar',name:'Hangar',sub:'Your ship and launch',x:0,z:55,yaw:Math.PI},
  {id:'sim',name:'Sim deck',sub:'Flight school and practice',x:6.5,z:-38,yaw:-Math.PI/2},
  {id:'quarters',name:'Quarters',sub:'Rank, saves and settings',x:-5.5,z:-8,yaw:Math.PI/2},
  {id:'ready',name:'Ready room',sub:'Contracts, side bets, the reserve',x:5.5,z:14,yaw:-Math.PI/2},
];
/* the next thing on the board, as a crew member would put it */
const dkNextLine=()=>{const nm=nextMission();return nm?nm.name+' is on the board.':'Every op is down. Replay any you like.';};
/* Story beats: after you clear `after`, that crew member (a DECK_CREW id) has something new to say the next time you talk to
   them, once. Beats come in campaign order; if you clear several ops in a row only the newest from each person is said. Keep a line short. */
const DECK_BEATS=[
  {who:'pike',after:'m3',line:'Ninety seconds on the clock and I counted every one. Do not tell Lark I was nervous.'},
  {who:'lark',after:'m5',line:'Kestrel flew like she had read your file. Fly differently next time. She will have read this one too.'},
  {who:'vale',after:'m5',line:'Gold trim. Eleven kills on the Rim convoys before she met you. Now she knows your name.'},
  {who:'chief',after:'m6',line:'MAW left a scorch on your canopy. I am not buffing it out. Call it a trophy.'},
  {who:'pike',after:'m8',line:'HALCYON took a lance for us out there. I watched the whole deck shudder. Never again, hear me?'},
  {who:'reyes',after:'m9',line:'THRONE broke up and the Kiru grid flickered for a full minute. Whole sectors went dark. You did that.'},
  {who:'vale',after:'m9',line:'A dreadnought, from the inside. I read the report twice. Then I stopped pretending it was routine.'},
  {who:'hale',after:'m10',line:'You ran a fleet battle and the sim scores jumped. Half the pilots now want pod two. Thank you for that.'},
  {who:'lark',after:'m12',line:'GORGON lost its guns to a wing strike. I have the footage. Pike has watched it nine times.'},
  {who:'reyes',after:'m14',line:'Three capitals down, our own fleet in the line. Command is calling it the Rim\'s first real victory.'},
  {who:'vale',after:'m15',line:'WARDEN is gone and the Gate is next. If this ends badly, it ends with you on my bridge. I want that known.'},
  {who:'chief',after:'m16',line:'The Gate is dead and every tube is hot. Whatever you need, I have already loaded it.'},
  {who:'vale',after:'m17',line:'SOVEREIGN is gone. The Rim is free. I will say it once: it was an honour, Admiral.'},
  {who:'lark',after:'m18',line:'I logged every ore blast in the Drift. Pike set off four. Two of them on purpose.'},
  {who:'chief',after:'m19',line:'GRUDGE put rock dust in every vent on the deck. I will be cleaning this ship until I retire.'},
  {who:'reyes',after:'m20',line:'The foundry is cold. No more hulls coming out of the Drift. Whatever they have left is all they get.'},
  {who:'pike',after:'m21',line:'Broadsides bouncing off rocks. Lark says it is physics. I say it is rude.'},
  {who:'vale',after:'m22',line:'ECLIPSE is gone and the Directorate with it. There is no one left to fight. Get some sleep, Admiral.'},
];
/* the newest beat this crew member has not told you yet, or null */
const dkBeat=id=>{const done=PROG.completed,seen=PROG.beats||{};let b=null;
  for(const x of DECK_BEATS)if(x.who===id&&done[x.after]&&!seen[x.who+':'+x.after])b=x;return b;};
const DECK_CREW=[
  {id:'vale',who:'vale',rank:2.5,room:'bridge',look:{suit:0x2e2818,skin:0x7a5a48,hair:0x8a8a90,style:'crop',build:1.04},x:0,z:-95.2,yaw:Math.PI,lines:()=>[
    rankLevel()>=3?'Admiral. The fleet is waiting on your word.':rankLevel()>=2?'Commander. The line holds because you hold it.':'Flight Officer. Earn your place on this bridge.',
    dkNextLine()+' Do not keep it waiting.',
    'Six weeks dark, and now she flies again. Keep her that way.']},
  {id:'reyes',who:'reyes',rank:1,room:'bridge',x:11.5,z:-82,yaw:Math.PI/2,lines:()=>[
    sectorChoice()?'Targets are up on the sector map. Pick one before we jump.':'CIC is green. Brief when you are ready.',
    dkNextLine(),
    'Holo table runs the sector map once we are on the Kiru road.',
    'Same table drives your neural link in a fight. You stand here; the fighter is a drone out there.']},
  {id:'pike',who:'pike',rank:1,room:'hangar',look:{suit:0x2a1c2a,hair:0xc84a2a,style:'swept'},x:-3.2,z:124,yaw:Math.PI/2,lines:()=>[
    rankLevel()>=1?'Lead, say the word and we are in the tubes.':'Rookie. Bet you a round you clip a gate.',
    dkWingLine('PIKE','on your wing and I have not clipped a gate since. Mostly.'),
    'Lark says I owe her credits. Lark is lying.',
    'Deck chief keeps polishing my canopy. I think it is love.']},
  {id:'lark',who:'lark',rank:1,room:'hangar',look:{suit:0x1c2a30,skin:0xc8a088,hair:0xe0d0a0,style:'tail',height:.96},x:3.2,z:124,yaw:-Math.PI/2,lines:()=>[
    rankLevel()>=1?'Wing is fuelled. Numbers look good.':'Watch your closure rate in the trench. Most pilots do not.',
    dkWingLine('LARK','flown together. I log every one.'),
    'Pike owes me forty credits. Write that down.',
    'Fly clean and we all come home.']},
  {id:'chief',name:'CHIEF ODA',col:'#ffd08a',room:'hangar',look:{suit:0x5a4a2a,skin:0x6a4a38,hair:0x101010,style:'shaved',build:1.09},x:-15.2,z:56.5,yaw:-Math.PI/2,lines:()=>[
    'Your '+curShip.name+' is on the catapult, fuelled and armed.',
    'Terminal behind me does hulls and refits.',
    'Bring her back in one piece. Or at least most of the pieces.']},
  {id:'hale',name:'LT. HALE',rank:1,col:'#b8f0c0',room:'sim',x:9,z:-30.6,yaw:Math.PI/2,lines:()=>[
    'Pods are warm. Crash it in here first, not out there.',
    skirmishOpen()?'Pod two runs full fleet battles now. No one dies in the sim.':'Fleet sims come online once you have seen a real fleet battle.',
    'Your best grades are on the board.']},
  // the reserve: in the ready room once you have a wing, waiting for a seat on it
  {id:'drift',name:'DRIFT',rank:1,col:'#c8a0ff',room:'ready',when:()=>rankLevel()>=1,look:{suit:0x2a2440,trim:0xa070ff,skin:0xd8aa88,hair:0x4a2e1c,style:'crop'},x:15.5,z:19.5,yaw:Math.PI*.75,lines:()=>[
    dkWingLine('DRIFT','in the reserve. Every one of them counted.'),
    'Reserve again. Pike gets the glory, I get the coffee.',
    'Contracts board pays better than the line. Ask Reyes.']},
  {id:'cinder',name:'CINDER',rank:1,col:'#ff8a5a',room:'ready',when:()=>rankLevel()>=1,look:{suit:0x3a1c14,trim:0xff8a5a,skin:0x6a4a38,hair:0x101010,style:'short',build:1.04},x:16.5,z:8.5,yaw:Math.PI*.25,lines:()=>[
    dkWingLine('CINDER','off the reserve list. I want more.'),
    'Pike keeps a book on every op. The house always loses to you, apparently.',
    sectorHull('HALCYON')<1?'Felt the last hit through the bunk. Get her patched.':'Quiet deck. I hate a quiet deck.']},
];
/* a wing pilot's record, from the command center's fleet record (recordFleet, js/progression.js) */
const dkWingLine=(c,tail)=>{const R=ccFleet().pilots[c];
  return R&&R.sorties?R.sorties+' sortie'+(R.sorties>1?'s':'')+', '+R.downs+' down'+(R.downs===1?'':'s')+' '+tail:'No sorties on my record yet. Change that.';};

/* HALCYON shows the war (js/deckwar.js).
     DECK_WAR     tiers: how much of HALCYON's hull (1 - sectorHull) must be gone before each tier of damage shows aboard
                  (scorch, then dead lamps and a repair crew, then smoke and a patched window, then emergency light);
                  spark: seconds between bursts at a sparking conduit; flicker: how far a lamp dims as it flickers;
                  alertPulse: red alert lamps per second. Red alert is on when the next op puts HALCYON in the fight
     DECK_STATUS  a line a crew member says first, once a visit, while `when` holds (damage, repairs, red alert)
     DECK_BETS    crew side bets on the next op: `ok(m)` the ops it can be offered on, a check as a mission bonus (`type`,
                  `val`, see evalBonus; 'combo' is the best combo), the pay, and the pitch. One bet at a time, offered
                  when you talk to them; it settles at that op's debrief. A bet won on an op is never offered on it again,
                  and losing one costs nothing. Keep a line short. */
const DECK_WAR={tiers:[.04,.18,.32,.48],spark:[2.6,.8],flicker:.55,alertPulse:1.4};
const dkPct=()=>Math.round(sectorHull('HALCYON')*100);
const DECK_STATUS=[
  {who:'chief',when:()=>DK.repaired,line:()=>'Repair crews are done. HALCYON is back to '+dkPct()+'%, and the deck stopped sparking.'},
  {who:'chief',when:()=>dkHurt()>=DECK_WAR.tiers[0],line:()=>'HALCYON is at '+dkPct()+'%. Pay the crews at the Fleet desk and I will have her patched before the jump.'},
  {who:'vale',when:()=>dkAlert(),line:()=>'Battle stations. '+nextMission().name+' puts HALCYON in the line. Nobody on this deck sleeps until it is done.'},
  {who:'reyes',when:()=>dkHurt()>=DECK_WAR.tiers[2],line:()=>'Sensor mast two is still dark from the last fight. I am running CIC on spares.'},
  {who:'pike',when:()=>dkAlert(),line:()=>'Red lights again. Good. I fly better angry.'},
];
const DECK_BETS=[
  {id:'noboost',who:'pike',ok:m=>m.sector==='trench',type:'noboost',credits:250,label:'No boost',
    line:m=>'Bet you 250 you cannot run '+m.name+' without touching the boost.'},
  {id:'combo',who:'pike',ok:m=>m.sector==='arena',type:'combo',val:6,credits:250,label:'A x6 combo',
    line:m=>'250 says you do not chain six kills in '+m.name+'. Prove me wrong.'},
  {id:'hull',who:'lark',ok:m=>!m.carrier,type:'hull',val:70,credits:200,label:'Home with 70% hull',
    line:m=>'Bring your ship back from '+m.name+' above 70% and I will pay 200. Most do not.'},
  {id:'carrier',who:'reyes',ok:m=>m.carrier,type:'carrier',val:60,credits:300,label:'HALCYON above 60%',
    line:m=>'Keep HALCYON above 60% through '+m.name+' and CIC buys. 300 credits.'},
  {id:'clean',who:'chief',ok:m=>m.sector==='trench'||!m.fleet,type:'hull',val:90,parts:1,label:'Home with 90% hull',
    line:m=>'Bring her back from '+m.name+' with nine tenths of the paint and I find you a spare part.'},
  {id:'kills',who:'cinder',ok:m=>m.sector==='arena'&&!!m.count,type:'kills',val:m=>m.count+4,credits:300,label:'Four kills over the count',
    line:m=>'Reserve pool says you cannot go four over the count in '+m.name+'. 300 credits.'},
];
const DECK_BET_LINES={won:['Fine. You win. Credits are in your account.','I hate this. Paid in full.','Do not tell the others I paid.'],
  lost:['Ha. Pay up next time. I will think of a new one.','The house wins one. Try again.']};

/* Life aboard (js/decklife.js).
     DECK_LIFE      walking out to launch and climbing out after landing: board and land are the scenes' lengths in seconds,
                    path the walk from the foot of pad one to the ladder and up into the cockpit (x, y, z), cam where the
                    camera watches from; armLine is Chief Oda's word when you arrive to board, landed(L) who greets you
                    after a sortie and what they say (L: the op m, win, hull %, first clear)
     DECK_TROPHIES  the service honours wall on the spine: one case per op that mattered, filled once it is cleared. shape is
                    ring, dial, bar, plate, shard, barrel, arc or crest; who (a DECK_CREW id) says the line when you look */
const DECK_LIFE={board:2.6,land:1.8,
  path:[[-8.4,0,60.2],[-5,0,64.7],[-2.5,2.3,65.2]],cam:[-13.5,3.8,55.5],
  armLine:m=>'She is on the catapult and the tubes are hot. Climb in when you are ready for '+m.name+'.',
  landed:L=>{const h=Math.max(0,Math.min(100,Math.round(L.hull)));
    if(!L.win)return ['chief','Rough one. Hull at '+h+'%. We will have her ready for another go.'];
    if(L.first&&L.m.sector==='arena'&&L.m.wingmen!==false&&rankLevel()>=1)return ['pike',L.m.name+' is down and we all came home. Drinks are on Lark.'];
    if(h>=90)return ['chief','Barely a scratch. Hull at '+h+'%. Show-off.'];
    if(h<40)return ['chief','You brought her back on fumes. '+h+'% hull. Leave her with me.'];
    return ['chief','Welcome back. Hull at '+h+'%. She did fine.'];}};
const DECK_TROPHIES=[
  {op:'m1',name:'Intake grille',shape:'ring',col:0x29d6ee,who:'reyes',line:'The first thing you broke for the Rim. Reactor Run, and the whole grid flickered.'},
  {op:'m3',name:'Ninety-second clock',shape:'dial',col:0xffb300,who:'pike',line:'Ninety seconds on that clock. I still count them some nights.'},
  {op:'m5',name:'Kestrel\'s gold trim',shape:'bar',col:0xffd23c,who:'lark',line:'Shot off her wing at Ace Duel. She will want it back.'},
  {op:'m6',name:'MAW\'s canopy scorch',shape:'plate',col:0xff6a20,who:'chief',line:'Told you I was not buffing it out. Now it has its own case.'},
  {op:'m8',name:'Lance shard',shape:'shard',col:0xff3a4a,who:'vale',line:'Cut out of HALCYON\'s hull after Hold Halcyon. She kept flying anyway.'},
  {op:'m9',name:'THRONE core fragment',shape:'shard',col:0xa070ff,who:'reyes',line:'A dreadnought\'s heart, fist sized. It still hums if you stand close.'},
  {op:'m12',name:'GORGON gun barrel',shape:'barrel',col:0x9aa8c4,who:'lark',line:'One of GORGON\'s guns, cut off clean at Spearhead. Pike wanted it for his bunk.'},
  {op:'m15',name:'Kiru Gate segment',shape:'arc',col:0x3cf08a,who:'vale',line:'A piece of the Gate. We went through it, not around.'},
  {op:'m17',name:'SOVEREIGN\'s crest',shape:'crest',col:0xffc23c,who:'vale',line:'The last crest the syndicate flew. It hangs here so nobody forgets the cost.'},
];
