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
