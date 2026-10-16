"use strict";
/* Open-space dogfight arena: environment build + spawning. */

/* ---- open-space dogfight arena: bounded volume above the arcology ---- */
const ARENA_R=620; let arenaEnv=null, arenaDomeMat=null; const arenaDebris=[];
function buildArena(){
  if(arenaEnv)return;
  arenaEnv=new THREE.Group();
  // bright neon ground grid
  const grid=new THREE.GridHelper(2200,44,0x00f0ff,0x16365a);
  grid.position.y=-320;grid.material.transparent=true;grid.material.opacity=.55;arenaEnv.add(grid);
  // ---- energized boundary: a glowing 3-ring "cage" (always visible) + a dome that brightens as you approach ----
  arenaDomeMat=new THREE.MeshBasicMaterial({color:0x35d0ff,wireframe:true,transparent:true,opacity:.08,blending:THREE.AdditiveBlending});
  arenaEnv.add(new THREE.Mesh(new THREE.SphereGeometry(ARENA_R,32,20),arenaDomeMat));
  const ringMat=new THREE.MeshBasicMaterial({color:0x00e6ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.5,side:THREE.DoubleSide});
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(ARENA_R,2.5,8,90),ringMat);
    if(i===1)ring.rotation.x=Math.PI/2;                 // horizontal "horizon" ring
    else if(i===2)ring.rotation.y=Math.PI/2;            // orthogonal vertical ring
    arenaEnv.add(ring);
  }
  // ---- backdrop: distant planet (with rim glow) + sun ----
  const planet=new THREE.Mesh(new THREE.SphereGeometry(430,28,20),new THREE.MeshBasicMaterial({color:0x14223e}));
  planet.position.set(-1500,460,-2300);arenaEnv.add(planet);
  const pglow=new THREE.Mesh(new THREE.SphereGeometry(470,28,20),
    new THREE.MeshBasicMaterial({color:0x2c4e92,transparent:true,opacity:.22,side:THREE.BackSide,blending:THREE.AdditiveBlending}));
  pglow.position.copy(planet.position);arenaEnv.add(pglow);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(55,16,16),
    new THREE.MeshBasicMaterial({color:0xffd27a,blending:THREE.AdditiveBlending,transparent:true,opacity:.95}));
  sun.position.set(1700,760,-1900);arenaEnv.add(sun);
  // ---- central derelict station: a landmark to dogfight around (cover + sense of place) ----
  const der=new THREE.Group();
  const core=new THREE.Mesh(new THREE.CylinderGeometry(24,24,130,10),M.dark);core.rotation.z=Math.PI/2;der.add(core);
  for(const s of [-1,1]){
    const ringR=new THREE.Mesh(new THREE.TorusGeometry(58,6,8,28),M.dark2);ringR.position.x=s*34;ringR.rotation.y=Math.PI/2;der.add(ringR);
    const lit=new THREE.Mesh(new THREE.TorusGeometry(58,1.3,6,28),s>0?M.cyan:M.mag);lit.position.x=s*34;lit.rotation.y=Math.PI/2;der.add(lit);
  }
  const fin=new THREE.Mesh(new THREE.BoxGeometry(10,96,44),M.dark);fin.position.set(-78,0,0);der.add(fin);
  der.position.set(150,-30,-200);arenaEnv.add(der);
  // ---- skyline towers rising from the grid ----
  for(let i=0;i<16;i++){
    const h=90+Math.random()*220,a=Math.random()*6.28,r=240+Math.random()*440;
    const tw=new THREE.Mesh(new THREE.BoxGeometry(20+Math.random()*30,h,20+Math.random()*30),M.dark);
    tw.position.set(Math.cos(a)*r,-320+h/2,Math.sin(a)*r);arenaEnv.add(tw);
    const ed=new THREE.Mesh(new THREE.BoxGeometry(.8,h,.8),Math.random()<.5?M.cyan:M.mag);
    ed.position.copy(tw.position);ed.position.x+=11;arenaEnv.add(ed);
  }
  // ---- drifting debris (cover + parallax) ----
  for(let i=0;i<14;i++){
    const r=8+Math.random()*16;
    const dch=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),M.dark2);
    dch.position.set((Math.random()*2-1)*500,(Math.random()*2-1)*300,(Math.random()*2-1)*500);
    const wf=new THREE.Mesh(new THREE.IcosahedronGeometry(r+.5,0),
      new THREE.MeshBasicMaterial({color:0x2a4a6a,wireframe:true,transparent:true,opacity:.45}));
    wf.position.copy(dch.position);arenaEnv.add(dch);arenaEnv.add(wf);
    arenaDebris.push({m:dch,w:wf,rs:(Math.random()-.5)*.5});
  }
  scene.add(arenaEnv);
}
/* a spawn point ~480 from the player, random bearing, kept inside the zone */
function arenaSpawnPos(){
  const a=Math.random()*6.28,e=(Math.random()-.5)*1.1;
  tmp2.set(Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)).multiplyScalar(440+Math.random()*120).add(ship.position);
  const L=tmp2.length();if(L>ARENA_R-70)tmp2.multiplyScalar((ARENA_R-70)/L);
  return tmp2.clone();
}
function spawnArena(dt){
  const remaining=S.arenaTarget-S.kills-fighters.length-bombers.length;
  S.fighterT-=dt;
  if(S.fighterT<=0&&fighters.length<4&&remaining>0){
    S.fighterT=1.2+Math.random()*1.1;
    spawnFighter(0);const F=fighters[fighters.length-1];
    F.mesh.position.copy(arenaSpawnPos());
    F.wvel.copy(ship.position).sub(F.mesh.position).setLength(115); // head in toward the player
  }
  S.bomberT-=dt;
  if(S.bomberT<=0&&bombers.length<1&&S.kills>3&&remaining>2){
    S.bomberT=13+Math.random()*6;
    spawnBomber(0);bombers[bombers.length-1].mesh.position.copy(arenaSpawnPos());
  }
}
