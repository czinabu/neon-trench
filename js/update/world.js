"use strict";
/* Update stage: sector environment and spawning. */

/* environment + spawning per sector; returns true when the run is won */
function updateWorld(fr){
  const {dt,arena,p}=fr;
  /* ----- environment + spawning (per sector) ----- */
  if(arena){
    spawnArena(dt);
    for(const d of arenaDebris){d.m.rotation.y+=d.rs*dt;d.m.rotation.x+=d.rs*.5*dt;}   // asteroids tumble (their colliders are spheres)
    arenaSky.position.copy(camera.position);   // sky, stars and sun stay at infinity
    if(S.surviveTime>0){if(S.time>=S.surviveTime){endGame(true);return true;}}  // defensive hold — win on the clock
    else if(S.kills>=S.arenaTarget&&(!S.leaderMode||S.leaderDown)){endGame(true);return true;}                 // zone cleared
  }else{
    for(const seg of segments){
      if(seg.position.z>p.z+SEG_LEN*1.5) seg.position.z-=SEG_POOL*SEG_LEN;
    }
    const depthN=Math.max(0,Math.min(1,-p.z/TRENCH_LEN));
    scene.fog.color.copy(FOG_A).lerp(FOG_B,depthN);
    scene.background.copy(scene.fog.color);
    spawnDirector(p.z);
    S.fighterT-=dt;
    if(S.fighterT<=0&&fighters.length<3&&p.z>-TRENCH_LEN+900){
      S.fighterT=10-Math.min(6,(-p.z/TRENCH_LEN)*7);
      spawnFighter(p.z-420,trenchKind(p));
      if(-p.z/TRENCH_LEN>.5&&fighters.length<3)spawnFighter(p.z-470,trenchKind(p));
    }
  }
  return false;
}
/* the first third of the trench is line fighters only; darts and missile boats join deeper in */
function trenchKind(p){
  if(-p.z/TRENCH_LEN<.33)return 'grunt';
  const k=pickEnemyKind(ROSTER_TRENCH);
  return k==='hunter'&&fighters.some(f=>f.kind==='hunter')?'grunt':k;
}
