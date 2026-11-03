"use strict";
/* Asteroid field: a second open-space battlefield for arena ops that set `field:'drift'` (Act V in the Kiru Drift, some
   contracts, the Skirmish battlefield option). It shares the arena's sky, edge and code, but swaps the derelict station,
   the wreck and the scattered rocks for a dense belt of solid rock (tuning in FIELD, js/config.js).
   Some rocks carry volatile ore (amber seams): shoot one FIELD.oreHp times, or put a missile in it, and it goes up, hurting
   every fighter in reach (and you, if you are close) and setting off other ore rocks nearby.
   arenaZone() picks the battlefield for a run: it puts that zone's colliders in arenaCols (so ships, bolts, missiles and the
   AI's avoidance all see it) and its rocks in arenaDebris (they tumble, and show on the holo table). Rocks are drawn as a few
   instanced meshes, so a field of 170 costs about as many draw calls as one rock. */

const ZONES={open:null,drift:null};   // open: the arena as buildArena makes it; drift: the asteroid field, built on first use
const _fm=new THREE.Matrix4(), _fz=new THREE.Matrix4().makeScale(0,0,0), _fv=new THREE.Vector3(), _fq=new THREE.Quaternion();

function buildField(){
  const g=new THREE.Group();g.visible=false;arenaEnv.add(g);
  const save=arenaCols.splice(0);   // build the field's colliders on their own, then hand the arena's back
  const mats=[new THREE.MeshPhongMaterial({color:0x5e5850,specular:0x141210,shininess:5,flatShading:true}),
              new THREE.MeshPhongMaterial({color:0x48403c,specular:0x101010,shininess:4,flatShading:true})];
  const oreMat=new THREE.MeshPhongMaterial({color:0x5a3220,specular:0x3a1a08,shininess:8,flatShading:true,emissive:0x2a0e02});
  const geos=[];for(let i=0;i<5;i++)geos.push(rockGeo(i*5.3+2));
  const rocks=[],rv=new THREE.Vector3(),F=FIELD;
  for(let tries=0;tries<4000&&rocks.length<F.rocks;tries++){
    const n=rocks.length,big=n<F.big,ore=!big&&n<F.big+F.ore;
    const [lo,hi]=big?F.bigSize:F.size,size=ore?12+Math.random()*9:lo+Math.random()*(hi-lo);
    rv.set(Math.random()*2-1,(Math.random()*2-1)*.55,Math.random()*2-1);if(rv.lengthSq()>1)continue;   // a thick belt, flatter than the arena
    rv.multiplyScalar(ARENA_R-50-size);
    if(rv.length()<110+size)continue;
    if(arenaCols.length&&arenaSdf(rv,size+40)<size+(big?36:14))continue;   // no overlaps, but tight lanes between them
    const m=new THREE.Object3D(),sx=.8+Math.random()*.4,sy=.65+Math.random()*.35,sz=.8+Math.random()*.4;
    m.position.copy(rv);m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);m.scale.set(size*sx,size*sy,size*sz);
    m.updateMatrixWorld(true);
    const r=size*.86*(sx+sy+sz)/3;
    addCol('sphere',m,r,0,0,ore?'an ore rock':'an asteroid');
    const R={m,r,size,big,ore,rs:(Math.random()-.5)*(big?.08:.3),geo:n%geos.length,col:arenaCols[arenaCols.length-1],hp:F.oreHp,dead:false,off:false};
    if(ore)R.col.ore=R;
    rocks.push(R);
  }
  // one instanced mesh per (shape, material), and the seams as two more
  const ims=[],slot=(geo,mat)=>{const k=geo+':'+mat.uuid;let I=ims.find(o=>o.k===k);if(!I)ims.push(I={k,geo,mat,list:[]});return I;};
  rocks.forEach((R,i)=>{const I=slot(R.geo,R.ore?oreMat:mats[i%2]);R.ii=I.list.length;I.list.push(R);});
  for(const I of ims){I.mesh=new THREE.InstancedMesh(geos[I.geo],I.mat,I.list.length);I.mesh.frustumCulled=false;g.add(I.mesh);
    for(const R of I.list)R.im=I.mesh;}
  const seams=[],crystal=sharedGeo('crystal',()=>new THREE.OctahedronGeometry(1,0));
  const local=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  for(const R of rocks){
    if(!R.big&&!R.ore)continue;
    for(let k=0;k<(R.ore?7:3+((Math.random()*3)|0));k++){
      rv.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();q.setFromUnitVectors(up,rv);
      local.compose(_fv.copy(rv).multiplyScalar(.84),q,new THREE.Vector3(R.ore?.13:.05,R.ore?.34:.16+Math.random()*.1,R.ore?.13:.05));
      seams.push({R,local:local.clone(),ore:R.ore});
    }
  }
  const seamMat=[M.cyan,new THREE.MeshBasicMaterial({color:0xffa030})],seamMeshes=[];
  for(const ore of [false,true]){
    const list=seams.filter(s=>s.ore===ore),mesh=new THREE.InstancedMesh(crystal,seamMat[ore?1:0],list.length);
    mesh.frustumCulled=false;g.add(mesh);seamMeshes.push(mesh);list.forEach((s,i)=>{s.im=mesh;s.ii=i;});
  }
  // the belt beyond the edge: thick and close, so the field reads as part of something bigger (scenery only, no collision)
  const beltN=520,belt=new THREE.InstancedMesh(geos[1],mats[0],beltN),be=new THREE.Euler();
  for(let i=0;i<beltN;i++){
    const a=Math.random()*6.283,r=1080+Math.pow(Math.random(),.7)*1300,s=4+Math.pow(Math.random(),2.2)*60;
    rv.set(Math.cos(a)*r,(Math.random()-.5)*(260+r*.12),Math.sin(a)*r);
    be.set(Math.random()*6,Math.random()*6,0);_fq.setFromEuler(be);
    _fm.compose(rv,_fq,_fv.set(s,s*.75,s));belt.setMatrixAt(i,_fm);
  }
  g.add(belt);
  ZONES.drift={group:g,cols:arenaCols.splice(0),rocks,seams,ims,seamMeshes};
  arenaCols.push(...save);
}
/* the run's battlefield: '' for the open arena, 'drift' for the asteroid field. Called by startGame after buildArena */
function arenaZone(field){
  if(!ZONES.open)ZONES.open={objs:arenaEnv.children.slice(1),cols:arenaCols.slice(),debris:arenaDebris.slice()};   // [0] is the edge dome
  if(field&&!ZONES.drift)buildField();
  arenaEnv.children[0].visible=!S.school;
  for(const o of ZONES.open.objs)o.visible=!S.school&&!field;
  if(ZONES.drift)ZONES.drift.group.visible=!S.school&&!!field;
  arenaCols.length=0;arenaDebris.length=0;
  if(field)fieldPrepare();
  else{arenaCols.push(...ZONES.open.cols);arenaDebris.push(...ZONES.open.debris);}
}
/* every rock back in place, minus any in the way of where this run's capital ships take station */
function fieldPrepare(){
  const Z=ZONES.drift,m=S.mission,keep=[];
  keep.push([ORIGIN,S.carrierMode&&!S.fleet?400:FIELD.keep]);   // the start point (and the carrier and capital that come in round it)
  if(S.fleet){
    keep.push([new THREE.Vector3().fromArray(FLEET.carrierAt),FIELD.keep+60],[new THREE.Vector3().fromArray(FLEET.escortAt),FIELD.keep]);
    for(const e of S.fleetLine)if(e.at)keep.push([new THREE.Vector3().fromArray(e.at),FIELD.keep+40]);
    for(const a of (m&&m.allies)||[])keep.push([new THREE.Vector3().fromArray(a.at),FIELD.keep]);
    for(const a of (m?dockRecruitsFor(m):[]))if(a.at)keep.push([new THREE.Vector3().fromArray(a.at),FIELD.keep]);
    if(m&&m.gate)keep.push([new THREE.Vector3().fromArray(m.gate.at),FIELD.keep+120]);
  }
  for(const R of Z.rocks){
    R.dead=false;R.hp=FIELD.oreHp;
    R.off=keep.some(([p,r])=>R.m.position.distanceTo(p)<r+R.size);
    if(R.off)continue;
    arenaCols.push(R.col);arenaDebris.push(R);
  }
  S.oreChain=[];
  fieldSync();
}
/* per frame while a field is up: chained ore blasts go off, and the instances follow their rocks' tumble */
function fieldTick(dt){
  for(let i=S.oreChain.length-1;i>=0;i--){const c=S.oreChain[i];c.t-=dt;if(c.t<=0){S.oreChain.splice(i,1);fieldOreBlast(c.R);}}
  fieldSync();
}
function fieldSync(){
  const Z=ZONES.drift;if(!Z)return;
  for(const R of Z.rocks){
    if(R.dead||R.off){R.im.setMatrixAt(R.ii,_fz);continue;}
    R.m.updateMatrix();R.im.setMatrixAt(R.ii,R.m.matrix);
  }
  for(const s of Z.seams){
    if(s.R.dead||s.R.off)s.im.setMatrixAt(s.ii,_fz);
    else s.im.setMatrixAt(s.ii,_fm.multiplyMatrices(s.R.m.matrix,s.local));
  }
  for(const I of Z.ims)I.mesh.instanceMatrix.needsUpdate=true;
  for(const mesh of Z.seamMeshes)mesh.instanceMatrix.needsUpdate=true;
}
/* a capital's shell flying a→b: the big rock or ore rock it runs into, if any. Only those stop broadsides, so a line of fire
   is blocked by real cover, not by every pebble (js/fleet.js fleetShellsFrame) */
function fieldShellRock(a,b){
  for(const R of arenaDebris)if((R.big||R.ore)&&!R.dead&&segSphere(a,b,R.m.position,R.r))return R;
  return null;
}
/* a player bolt struck an ore rock */
function fieldOreHit(R,pos){
  if(R.dead)return;
  R.hp--;spark(pos,0xff9a30,8,22);
  if(R.hp<=0)fieldOreBlast(R);
}
/* an ore rock goes up: fighters, bombers and wingmen in reach are hit, you are hit by distance, and nearby ore follows */
function fieldOreBlast(R){
  if(R.dead||R.off)return;
  R.dead=true;
  const i=arenaCols.indexOf(R.col);if(i>=0)arenaCols.splice(i,1);
  const j=arenaDebris.indexOf(R);if(j>=0)arenaDebris.splice(j,1);
  const p=R.m.position,reach=R.r+FIELD.blastR;
  burst(p,0xff9a30,2.4+R.size/12);spark(p,0xffb300,30,50);spark(p,0xff5a2a,22,40);shatter(p,9,1.4);puff(p,5);
  sfx('mslboom',p);
  const d=ship.position.distanceTo(p);
  S.shake=Math.min(1,S.shake+Math.max(0,.6-d/900));
  if(d<reach)damage(FIELD.blastDmg*Math.min(1,1-(d-R.r)/FIELD.blastR+.25),'Caught in an ore blast.',p);
  for(const E of fighters.slice())if(!E.dead&&E.mesh.position.distanceTo(p)<reach){hitEnemy(E,FIELD.blastFoe);if(E.dead)S.oreKills++;}
  for(const E of bombers.slice())if(!E.dead&&E.mesh.position.distanceTo(p)<reach){hitEnemy(E,FIELD.blastFoe);if(E.dead)S.oreKills++;}
  for(const w of wingmen)if(!w.dead&&w.mesh.position.distanceTo(p)<reach)hitWingman(w,WING_BOLT_DMG*2);
  for(const o of ZONES.drift.rocks)if(o.ore&&!o.dead&&!o.off&&o!==R&&!S.oreChain.some(c=>c.R===o)&&o.m.position.distanceTo(p)<reach+o.r)
    S.oreChain.push({R:o,t:.25+Math.random()*.2});
  S.oreBlasts++;
  if(S.oreBlasts===1&&S.annT<=0)announce('ORE BLAST','Volatile rock: shoot it when they fly close','ace');
}
/* the field's haze: warmer and thicker than open space, with the dust motes brighter so speed reads against the rock */
function fieldAtmosphere(){
  scene.fog.color.setHex(0x0b0907);scene.fog.density=FIELD.fog;scene.background.setHex(0x050403);
  ambLight.color.setHex(0x3a3448);dust.material.opacity=FIELD.dust;
}
