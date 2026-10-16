"use strict";
/* Campaign mission roster, unlock chain and bonus objectives. */

/* Mission roster — serializable data the hub can launch into. `sector` reuses the
   trench/arena gameplay; the primary objective maps to a win condition; `bonuses`
   are optional secondary goals scored at debrief; `req` gates the unlock chain. */
const MISSIONS=[
  {id:'m1',name:'REACTOR RUN',sub:'// trench strike',sector:'trench',
   objective:'Breach the reactor intake',
   brief:['The Helios-Kiru core powers the syndicate grid.',
     'Dive the service trench and put a torpedo in the reactor intake.',
     'Thread the beam gates. Gun whatever gets in your way.'],
   bonuses:[{type:'hull',val:40,credits:200,label:'Exfil with hull > 40%'},
            {type:'kills',val:8,credits:150,label:'Down 8+ hostiles'}],
   reward:{credits:500,parts:1}},
  {id:'m2',name:'CLEAR THE SCREEN',sub:'// open-space sweep',sector:'arena',count:12,req:'m1',
   objective:'Eliminate 12 hostiles',
   brief:['Syndicate fighters are massing above the arcology.',
     'Hold the open zone and break the fighter screen — 12 confirmed.',
     'No trench to hide in. Fly free and pick your passes.'],
   bonuses:[{type:'time',val:150,credits:200,label:'Clear under 2:30'},
            {type:'hull',val:50,credits:200,label:'Finish with hull > 50%'}],
   reward:{credits:450,parts:1}},
  {id:'m3',name:'HOLD THE LINE',sub:'// defensive stand',sector:'arena',survive:90,req:'m2',
   objective:'Survive 90 seconds',
   brief:['Cover the evac convoy while it spins up its jump drive.',
     'Survive the assault — 90 seconds. The waves will not stop coming.',
     'Stay alive. Kills are a bonus, not the mission.'],
   bonuses:[{type:'kills',val:15,credits:250,label:'15+ kills while holding'}],
   reward:{credits:600,parts:2}},
  {id:'m4',name:'SILENT RUN',sub:'// stealth strike',sector:'trench',req:'m3',
   objective:'Breach the reactor intake',
   brief:['Syndicate sensors flag boosted IFF trails over long range.',
     'Run the trench cold — no boost — and put a torpedo in the intake.',
     'Throttle discipline keeps you off their scopes. Fly clean.'],
   bonuses:[{type:'noboost',val:0,credits:300,label:'Complete without boosting'},
            {type:'hull',val:70,credits:200,label:'Exfil with hull > 70%'}],
   reward:{credits:650,parts:2}},
  {id:'m5',name:'ACE DUEL',sub:'// elite interception',sector:'arena',count:18,req:'m4',
   objective:'Eliminate 18 hostiles',
   brief:['An elite syndicate squadron has entered the zone.',
     'Break the formation — 18 confirmed kills, no quarter.',
     'They fly sharper than the screen ships. Expect a real fight.'],
   bonuses:[{type:'time',val:240,credits:300,label:'Clear under 4:00'},
            {type:'flawless',val:0,credits:350,label:'Flawless — no hull damage taken'}],
   reward:{credits:900,parts:3}},
];
const missionById=id=>MISSIONS.find(m=>m.id===id);
const isUnlocked=m=>!m.req||!!PROG.completed[m.req];
