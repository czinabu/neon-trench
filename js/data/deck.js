"use strict";
/* HALCYON's walkable deck (js/deck.js): tuning, the rooms you can fast travel to, and the crew's one-line barks.
     DECK         walking speeds, reach and feel, in metres and seconds: accel/brake m/s², turn rad/s, camDamp the share of the
                  gap the camera closes every 50 ms; saluteFrom is the rank (RANKS index) from which crew below you salute
     DECK_LOOK    how you look in third person by default: colours per part (character customization will save over this)
     DECK_ROOMS   fast-travel stops: where you arrive (x, z) and which way you face (yaw, 0 looks down -z, the bow)
     DECK_CREW    who stands where: speaker (a CAST id from js/data/story.js, or name and col), rank (as a RANKS index;
                  omitted is 0, the deck crew; Vale, a captain, sits between Commander and Admiral), position, facing,
                  the room, an optional look (as DECK_LOOK), and lines(): what they say this visit, picked in turn. Keep a line short. */
const DECK={walk:4.6,run:9,accel:22,brake:46,turn:10,runTurn:7,turnDamp:11,lean:.014,bank:.011,leanMax:.2,leanSmooth:9,camDamp:.5,saluteFrom:2,saluteR:4.5,saluteT:1.6,radius:.38,reach:3.2,barkR:4.2,barkT:4.6,doorR:5,fade:.22};
const DECK_LOOK={suit:0x232c40,trim:0x00f0ff,skin:0x9a7a68,hair:0x241a14,boots:0x0e1118};
const DECK_ROOMS=[
  {id:'bridge',name:'Bridge',sub:'Sector map and fleet',x:0,z:-72.5,yaw:0},
  {id:'hangar',name:'Hangar',sub:'Your ship and launch',x:0,z:55,yaw:Math.PI},
  {id:'sim',name:'Sim deck',sub:'Flight school and practice',x:6.5,z:-38,yaw:-Math.PI/2},
  {id:'quarters',name:'Quarters',sub:'Rank, saves and settings',x:-5.5,z:-8,yaw:Math.PI/2},
];
/* the next thing on the board, as a crew member would put it */
const dkNextLine=()=>{const nm=nextMission();return nm?nm.name+' is on the board.':'Every op is down. Replay any you like.';};
const DECK_CREW=[
  {id:'vale',who:'vale',rank:2.5,room:'bridge',look:{suit:0x2e2818,skin:0x7a5a48,hair:0x8a8a90},x:0,z:-95.2,yaw:Math.PI,lines:()=>[
    rankLevel()>=3?'Admiral. The fleet is waiting on your word.':rankLevel()>=2?'Commander. The line holds because you hold it.':'Flight Officer. Earn your place on this bridge.',
    dkNextLine()+' Do not keep it waiting.',
    'Six weeks dark, and now she flies again. Keep her that way.']},
  {id:'reyes',who:'reyes',rank:1,room:'bridge',x:11.5,z:-82,yaw:Math.PI/2,lines:()=>[
    sectorChoice()?'Targets are up on the sector map. Pick one before we jump.':'CIC is green. Brief when you are ready.',
    dkNextLine(),
    'Holo table runs the sector map once we are on the Kiru road.']},
  {id:'pike',who:'pike',rank:1,room:'hangar',look:{suit:0x2a1c2a,hair:0xc84a2a},x:-5,z:122,yaw:-Math.PI/2,lines:()=>[
    rankLevel()>=1?'Lead, say the word and we are in the tubes.':'Rookie. Bet you a round you clip a gate.',
    'Lark says I owe her credits. Lark is lying.',
    'Deck chief keeps polishing my canopy. I think it is love.']},
  {id:'lark',who:'lark',rank:1,room:'hangar',look:{suit:0x1c2a30,skin:0xc8a088,hair:0xe0d0a0},x:5,z:122,yaw:Math.PI/2,lines:()=>[
    rankLevel()>=1?'Wing is fuelled. Numbers look good.':'Watch your closure rate in the trench. Most pilots do not.',
    'Pike owes me forty credits. Write that down.',
    'Fly clean and we all come home.']},
  {id:'chief',name:'CHIEF ODA',col:'#ffd08a',room:'hangar',look:{suit:0x5a4a2a,skin:0x6a4a38,hair:0x101010},x:-11.2,z:56.5,yaw:-Math.PI/2,lines:()=>[
    'Your '+curShip.name+' is on the catapult, fuelled and armed.',
    'Terminal behind me does hulls and refits.',
    'Bring her back in one piece. Or at least most of the pieces.']},
  {id:'hale',name:'LT. HALE',rank:1,col:'#b8f0c0',room:'sim',x:9,z:-30.6,yaw:Math.PI/2,lines:()=>[
    'Pods are warm. Crash it in here first, not out there.',
    skirmishOpen()?'Pod two runs full fleet battles now. No one dies in the sim.':'Fleet sims come online once you have seen a real fleet battle.',
    'Your best grades are on the board.']},
];
