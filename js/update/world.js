"use strict";
/* Update stage: sector environment and spawning. */

/* environment + spawning per sector; returns true when the run is won */
function updateWorld(fr){
  const {dt,arena,p}=fr;
  /* ----- environment + spawning (per sector) ----- */
  arenaSky.position.copy(camera.position);   // sky, stars, sun and planet stay at infinity
  if(arena){
    if(!S.school)spawnArena(dt);
    for(const d of arenaDebris){d.m.rotation.y+=d.rs*dt;d.m.rotation.x+=d.rs*.5*dt;}   // asteroids tumble (their colliders are spheres)
    if(S.carrierLost&&S.mission&&S.mission.carrier){   // defence mission: the carrier is the objective; let its breakup play out first
      S.carrierLostT=(S.carrierLostT||0)+dt;
      if(S.carrierLostT>2.5){endGame(false,'HALCYON was lost.');return true;}
    }
    if(S.surviveTime>0){if(S.time>=S.surviveTime){endGame(true);return true;}}  // defensive hold — win on the clock
    else if(S.kills>=S.arenaTarget&&(!S.leaderMode||S.leaderDown)&&(!S.capMode||S.capDown)){endGame(true);return true;}                 // zone cleared
  }else{
    for(const seg of S.interior?intSegs:segments){
      if(seg.position.z>p.z+SEG_LEN*1.5) seg.position.z-=SEG_POOL*SEG_LEN;
    }
    const depthN=Math.max(0,Math.min(1,-p.z/S.runLen));
    if(S.interior){scene.fog.color.copy(INT_FOG_A).lerp(INT_FOG_B,depthN);updateInterior(fr);}
    else scene.fog.color.copy(FOG_A).lerp(FOG_B,depthN);
    scene.background.copy(scene.fog.color);
    spawnDirector(p.z);
    S.fighterT-=dt;
    if(S.fighterT<=0&&fighters.length<3&&p.z>-S.runLen+900){
      S.fighterT=10-Math.min(6,(-p.z/S.runLen)*7);
      spawnFighter(p.z-420,trenchKind(p));
      if(-p.z/S.runLen>.5&&fighters.length<3)spawnFighter(p.z-470,trenchKind(p));
    }
  }
  return false;
}
/* the first third of the trench is line fighters only; darts and missile boats join deeper in */
function trenchKind(p){
  if(-p.z/S.runLen<.33)return 'grunt';
  const k=pickEnemyKind(ROSTER_TRENCH);
  return k==='hunter'&&fighters.some(f=>f.kind==='hunter')?'grunt':k;
}
