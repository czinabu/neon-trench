"use strict";
/* Story cutscenes: short in-engine scenes at the campaign's turning points, played once each (js/cutscene.js).
   Text only; the camera work and what moves in each scene live in CUT_BUILD in js/cutscene.js, keyed by id.
     op     the campaign op the scene belongs to
     when   'before': plays as the op's briefing opens, until the op is first cleared
            'after':  plays before the debrief of the op's first clear
            'intro':  no op; the prologue, played by the onboarding (js/onboard.js)
     card   [small line, title] shown over the opening seconds
     len    seconds; the scene ends on its own after this
     lines  [[seconds in, who (CAST in js/data/story.js), text]...] subtitles, one at a time, each up until the next
   Played scenes are kept in PROG.cuts and can be watched again from the command center's Campaign log. */
const CUTSCENES=[
  // the prologue: no op; plays the first time a new pilot reaches the hub (js/onboard.js), before the welcome card
  {id:'arrival',op:null,when:'intro',card:['Prologue','The last carrier'],len:22,lines:[
    [1.2,'reyes','Fighter inbound on the approach lane. One pilot aboard: the new Flight Officer, straight from the Rim academy.'],
    [6,'vale','The Helios-Kiru syndicate owns these lanes. HALCYON is the last carrier the Rim has left.'],
    [10.6,'vale','We have hulls on the deck and nobody to fly them. That is why you are here.'],
    [15,'reyes','Later you will fly from the holo table, by neural link. For now, hands on the stick.'],
    [18.6,'vale','Come up to the bridge, Flight Officer. We start with the trench.']]},
  {id:'coldstart',op:'m1',when:'before',card:['Act I','Cold start'],len:19,lines:[
    [1.2,'reyes','Reactor at forty percent. Deck lighting coming up, section by section.'],
    [6.2,'vale','Six weeks dark. The syndicate thinks this ship is a wreck. Let them.'],
    [11.4,'reyes','Flight Officer, you are clear of the bay. Trench mouth is on the far side of the arcology.'],
    [15.6,'vale','Bring her back in one piece. She is the only one we have.']]},
  {id:'kestrel',op:'m5',when:'after',card:['Ace Duel','Gold trim'],len:18,lines:[
    [.8,'kestrel','Smoke on my wing. That has not happened in a long time.'],
    [5.2,'kestrel','Not today, Flight Officer. Next time I finish it.'],
    [9.6,'pike','So you are the one who sent Kestrel running. Pike. Mind if I fly your left?'],
    [13.8,'lark','Lark, on your right. Try to leave a few for the rest of us.']]},
  {id:'throne',op:'m9',when:'after',card:['Heart of the Throne','The core goes'],len:18,lines:[
    [.8,'reyes','Core breach confirmed. THRONE is coming apart from the inside.'],
    [5.4,'reyes','I have your transponder! You are clear of the hull!'],
    [10.4,'vale','Their flagship, gone, with one pilot and a borrowed torpedo.'],
    [14.4,'vale','They will come for us with everything now. Come home, Commander.']]},
  {id:'gate',op:'m15',when:'before',card:['Act IV','The Kiru Gate'],len:20,lines:[
    [1,'reyes','Kiru Gate, dead ahead. The picket is on station, and the ring is lit.'],
    [6.4,'vale','All ships, this is HALCYON. Drop out of the jump on my mark. Mark.'],
    [11.6,'lark','SOLACE and BASTION are in the line. That is every hull the Rim has left.'],
    [15.8,'vale','Admiral. The fleet is yours.']]},
  {id:'sovereign',op:'m17',when:'after',card:['Sovereign','The last battle'],len:22,lines:[
    [.8,'reyes','SOVEREIGN\'s reactor is going critical. She is breaking up!'],
    [6,'kestrel','Drives are gone. Well flown, Admiral. Come and get me.'],
    [10.6,'pike','Lark, are you seeing this? They are cutting their engines. All of them.'],
    [14.6,'lark','I see it. We brought everyone home.'],
    [18.4,'vale','The Rim lanes are open. Take us home, Admiral.']]},
];
const cutById=id=>CUTSCENES.find(c=>c.id===id);

/* Trench intros (js/cutscene.js): a short flyby of the structure a trench run strikes, played as you launch into one, then
   a dive into the trench mouth in the game itself (js/update/launch.js). Unlike the story scenes they play every launch
   (Settings: Trench intros), except a straight retry of the op you just flew. Each kind also tints the trench to match.
   A mission picks its kind with `trench` (js/data/missions.js); a free trench run is 'free'.
     build  the scene: 'surface' (an arcology slab with the trench cut through it and `target` at the far end) or 'hull'
            (a capital ship with a burning breach in its flank, which you dive into)
     target 'reactor' | 'silent' | 'base' | 'station': the structure at the trench's end ('surface' only)
     pal    the scene's colours: neon [a, b] strips and tower trim, glow (the target's light), bg (sky and haze), flag (the
            hull build's gold-trimmed palette)
     look   the trench in the game (not the interior): fog [entry, far end], wall and floor window tint, stars
     deck   what stands on the slab round the trench (js/trench.js buildTrenchDeck), in the scene and round the trench
            mouth in the game: 'city' (dense towers rising toward the target), 'sink' (low blocks and sensor masts),
            'pads' (hangar blocks and lit landing pads), 'plant' (cooling towers and pylons with cable over the trench)
     mix    how the trench itself is built, as multipliers on js/enemies.js spawnDirector's odds (1 or absent: as usual):
            fork, piece (set pieces), gate (roll gates), turret, bomber, piston (moving beams), fighters (time between
            fighter waves)
     card   [small line, title]; lines as for the story scenes. {name} and {place} are filled from the mission. */
const TRENCH_INTRO_LEN=5.2;
const TRENCH_INTROS={
  reactor:{build:'surface',target:'reactor',card:['Trench strike','Helios-Kiru core'],
    pal:{neon:[0x00f0ff,0xff2d78],glow:0xff8866,bg:0x070a18},
    look:{fog:[0x070a18,0x1c0a14],wall:0xffffff,floor:0xffffff,stars:0x9fd8ff},deck:'city',
    lines:[[.4,'reyes','The Helios-Kiru core. Half the syndicate grid runs off that stack.'],
      [2.5,'reyes','Service trench below you. Take her down.']]},
  silent:{build:'surface',target:'silent',card:['Silent run','The north stack'],
    pal:{neon:[0x3a7cff,0x9ab8ff],glow:0x6ab0ff,bg:0x03060e},
    look:{fog:[0x03070f,0x08142a],wall:0x7f9fdf,floor:0x6f8fcf,stars:0xbfd4ff},deck:'sink',
    mix:{turret:2,piece:.5,fork:.6,piston:.4},   // a quieter, watched trench: more guns on the walls, less machinery
    lines:[[.4,'reyes','North stack. Their scopes are sweeping the high lanes. Stay low.'],
      [2.5,'vale','No boost on this one. Let them take you for a shadow.']]},
  base:{build:'surface',target:'base',card:['Fighter base','{name}'],
    pal:{neon:[0xffb300,0xff5a2a],glow:0xffa040,bg:0x0c0806},
    look:{fog:[0x0d0805,0x26110a],wall:0xffc890,floor:0xffb070,stars:0xffe2b0},deck:'pads',
    mix:{bomber:3,turret:1.4,fighters:.7},   // the base launches on you all the way down
    lines:[[.4,'reyes','{name}. Their fighter cover launches off those rails.'],
      [2.5,'reyes','The service trench runs right under the pads. In you go.']]},
  station:{build:'surface',target:'station',card:['Contract','Power station · {place}'],
    pal:{neon:[0x2affb0,0x00f0ff],glow:0x6affc8,bg:0x040c0b},
    look:{fog:[0x040d0b,0x0b2219],wall:0xa0ffe0,floor:0x80f0d0,stars:0xc0fff0},deck:'plant',
    mix:{piston:1.8,gate:1.8,piece:1.3},   // machinery: pistons, roll gates and set pieces
    lines:[[.4,'reyes','Power station at {place}. Those towers feed their shield grid.'],
      [2.5,'reyes','The trench runs to the main intake. In and out, pilot.']]},
  free:{build:'surface',target:'reactor',card:['Free trench','Helios-Kiru Arcology'],
    pal:{neon:[0x00f0ff,0xff2d78],glow:0xff8866,bg:0x070a18},
    look:{fog:[0x070a18,0x1c0a14],wall:0xffffff,floor:0xffffff,stars:0x9fd8ff},deck:'city',
    lines:[[.4,'reyes','Arcology trench, open run. No objective but the scoreboard.'],
      [2.5,'reyes','Trench mouth below. Make it count.']]},
  throne:{build:'hull',card:['Capital interior','THRONE'],pal:{neon:[0xffc04a,0xff2d78],glow:0xff6a2a,bg:0x05040a,flag:true},
    lines:[[.4,'reyes','THRONE. Seven kilometres of dreadnought, and her flank is open.'],
      [2.5,'vale','Into the breach. The core is at the far end of that trench.']]},
  hulk:{build:'hull',card:['Contract','Breached dreadnought'],pal:{neon:[0xff2d78,0x00f0ff],glow:0xff6a2a,bg:0x05040a},
    lines:[[.4,'reyes','There is your dreadnought, limping out of {place} with her flank open.'],
      [2.5,'reyes','The breach is still burning. Fly in and follow the trench to the core.']]},
};
/* the intro kind for a mission (null: free trench) */
const trenchKey=m=>m&&TRENCH_INTROS[m.trench]?m.trench:!m?'free':m.interior?'throne':'reactor';
