"use strict";
/* Update stage: live audio mix. */

let audBoostWas=false;
/* engine pitch, music intensity, low-hull klaxon (runs each frame while playing) */
function updateAudio(fr){
  const {dt,p,distPort}=fr;
  /* ----- audio ----- */
  if(AC){const spd=S.vel.length();
    engGain.gain.value=.03+spd/MAX_SPD*.06+(S.boost?.04:0);
    engFilt.frequency.value=180+spd*3.2+(S.boost?500:0);
    const sp=spd/MAX_SPD;
    engWhine.frequency.value=320+sp*520+(S.boost?260:0);engWhineG.gain.value=.05+sp*.12+(S.boost?.1:0);
    engNoiseF.frequency.value=500+sp*1800;engNoiseG.gain.value=sp*.5+(S.boost?.35:0);
    engSub.frequency.value=26+sp*14;
    engOsc1.frequency.value=36+spd*.16;engOsc2.frequency.value=36.8+spd*.165;
    // pick the music for the situation: danger beats a capital fight, which beats the sector's own theme
    const hostileCap=capitals.some(C=>!C.friendly&&C.state==='fight');
    musicMood=(S.hull<35||eMsls.length>0)?'danger':hostileCap?'capital':fr.arena?'arena':'trench';
    // music intensity ramps with nearby ships, danger and the reactor approach
    let near=0;
    for(const F of fighters)if(F.mesh.position.distanceTo(p)<540)near++;
    for(const B of bombers)if(B.mesh.position.distanceTo(p)<540)near++;
    const target=Math.min(1,near*.34+(S.hull<35?.3:0)+(hostileCap?.35:0)+(distPort<1400?.35:0)+(fr.arena?0:Math.max(0,1-distPort/(S.interior?S.runLen:TRENCH_SWELL))*.5)+(S.boost?.1:0));   // the trench score swells over the last TRENCH_SWELL metres to the intake
    musicIntent+=(target-musicIntent)*Math.min(1,2*dt);
    if(musicGain)musicGain.gain.value=.2+.12*musicIntent;
    if(S.boost&&!audBoostWas)sfx('boost');audBoostWas=S.boost;
    // low-hull klaxon
    if(S.hull>0&&S.hull<25){S.alarmT-=dt;if(S.alarmT<=0){S.alarmT=.85;sfx('alarm');}}
  }
}
