"use strict";
/* Update stage: live audio mix. */

let audBoostWas=false;
/* engine pitch, music intensity, low-hull klaxon (runs each frame while playing) */
function updateAudio(fr){
  const {dt,p,distPort}=fr;
  /* ----- audio ----- */
  if(AC){const spd=S.vel.length();
    engGain.gain.value=.06+spd/MAX_SPD*.12+(S.boost?.08:0);
    engFilt.frequency.value=180+spd*3.2+(S.boost?500:0);
    engOsc1.frequency.value=36+spd*.16;engOsc2.frequency.value=36.8+spd*.165;
    // music intensity ramps with nearby ships, danger and the reactor approach
    let near=0;
    for(const F of fighters)if(F.mesh.position.distanceTo(p)<540)near++;
    for(const B of bombers)if(B.mesh.position.distanceTo(p)<540)near++;
    const target=Math.min(1,near*.34+(S.hull<35?.3:0)+(distPort<1400?.35:0)+(S.boost?.1:0));
    musicIntent+=(target-musicIntent)*Math.min(1,2*dt);
    if(musicGain)musicGain.gain.value=.16+.13*musicIntent;
    if(S.boost&&!audBoostWas)sfx('boost');audBoostWas=S.boost;
    // low-hull klaxon
    if(S.hull>0&&S.hull<25){S.alarmT-=dt;if(S.alarmT<=0){S.alarmT=.85;sfx('alarm');}}
  }
}
