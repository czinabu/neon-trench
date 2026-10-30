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
    'Holo table runs the sector map once we are on the Kiru road.']},
  {id:'pike',who:'pike',rank:1,room:'hangar',look:{suit:0x2a1c2a,hair:0xc84a2a,style:'swept'},x:-5,z:122,yaw:-Math.PI/2,lines:()=>[
    rankLevel()>=1?'Lead, say the word and we are in the tubes.':'Rookie. Bet you a round you clip a gate.',
    'Lark says I owe her credits. Lark is lying.',
    'Deck chief keeps polishing my canopy. I think it is love.']},
  {id:'lark',who:'lark',rank:1,room:'hangar',look:{suit:0x1c2a30,skin:0xc8a088,hair:0xe0d0a0,style:'tail',height:.96},x:5,z:122,yaw:Math.PI/2,lines:()=>[
    rankLevel()>=1?'Wing is fuelled. Numbers look good.':'Watch your closure rate in the trench. Most pilots do not.',
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
];
