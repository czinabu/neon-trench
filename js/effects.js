"use strict";
/* Projectiles and particles: bolts, sparks, explosions, smoke, engine trail, missiles. */

/* projectiles + particles */
const boltGeo=new THREE.BoxGeometry(.32,.32,8);
function fireBolt(arr,mat,pos,dirV,speed){
  const m=new THREE.Mesh(boltGeo,mat);m.position.copy(pos);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),dirV.clone().normalize());
  scene.add(m);arr.push({m,v:dirV.clone().normalize().multiplyScalar(speed),life:2.2});
}
// pooled additive sparks — shared geometry + reused meshes/materials (no per-particle GC churn)
const sparkGeo=new THREE.SphereGeometry(.28,4,4), sparkPool=[];
function getSparkMesh(){
  let m=sparkPool.pop();
  if(!m){m=new THREE.Mesh(sparkGeo,new THREE.MeshBasicMaterial({blending:THREE.AdditiveBlending,transparent:true}));scene.add(m);}
  m.visible=true;return m;
}
function freeSparkMesh(m){m.visible=false;sparkPool.push(m);}
function spark(pos,color,n=10,spd=26){
  for(let i=0;i<n;i++){
    const m=getSparkMesh();m.material.color.setHex(color);m.material.opacity=1;m.position.copy(pos);
    sparks.push({m,v:new THREE.Vector3((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)).multiplyScalar(spd),life:.6+Math.random()*.5});
  }
}
/* Pools of hidden meshes for short-lived effects. Each mesh keeps its own material (colour and
   opacity vary per particle) but nothing is allocated once the pool has warmed up. */
function meshPool(geo,matOpts){
  const free=[];
  return {
    get(){let m=free.pop();
      if(!m){m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial(matOpts));scene.add(m);}
      m.visible=true;m.scale.setScalar(1);return m;},
    put(m){m.visible=false;free.push(m);},
  };
}
/* Fixed set of point lights shared by pickups and missiles. three.js recompiles every lit material
   whenever the number of lights in the scene changes, which caused a hitch each time a pickup
   dropped or a missile launched; borrowing from a constant pool keeps the count fixed. */
const fxLights=[];
for(let i=0;i<8;i++){const l=new THREE.PointLight(0xffffff,0,16);l.userData.busy=false;scene.add(l);fxLights.push(l);}
function takeLight(color,intensity,distance){
  const l=fxLights.find(l=>!l.userData.busy);if(!l)return null;   // pool empty → just no glow
  l.userData.busy=true;l.color.setHex(color);l.intensity=intensity;l.distance=distance;return l;
}
function freeLight(l){if(l){l.userData.busy=false;l.intensity=0;}}
// expanding shockwave ring + flash core for a punchier explosion
const rings=[];
const ringPool=meshPool(new THREE.RingGeometry(.6,1.1,24),{blending:THREE.AdditiveBlending,transparent:true,side:THREE.DoubleSide});
const corePool=meshPool(new THREE.SphereGeometry(1.1,10,10),{color:0xfff0cc,blending:THREE.AdditiveBlending,transparent:true});
function burst(pos,color,scale){
  scale=scale||1;
  const ring=ringPool.get();ring.material.color.setHex(color);ring.material.opacity=.9;
  ring.position.copy(pos);ring.lookAt(camera.position);
  rings.push({m:ring,life:.5,scale,base:1});
  const core=corePool.get();core.material.opacity=.95;core.position.copy(pos);core.scale.setScalar(scale);
  rings.push({m:core,life:.32,scale:scale*1.4,base:scale,core:true});
}
function freeRing(R){(R.core?corePool:ringPool).put(R.m);}
// dark drifting smoke puff (player damage / low-hull trail)
const smokePool=meshPool(new THREE.SphereGeometry(.5,5,5),{color:0x20242e,transparent:true});
function puff(pos,n){
  for(let i=0;i<(n||1);i++){
    const s=smokePool.get();s.material.opacity=.7;
    const base=1+Math.random()*.8;s.scale.setScalar(base);
    s.position.copy(pos);s.position.x+=(Math.random()-.5)*1.2;s.position.y+=(Math.random()-.5)*1.2;
    smoke.push({m:s,v:new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.5)*4+1,18+Math.random()*10),life:.7+Math.random()*.6,gr:1+Math.random(),base});
  }
}
// engine trail (chase view) — thin, short-lived streaks off the nacelles (subtle, not blown out)
const trail=[], trailPool=meshPool(new THREE.SphereGeometry(.32,6,6),{blending:THREE.AdditiveBlending,transparent:true});
/* minor wake trail — the flame meshes at the engines do the real "intense thruster" work now
   (see the per-frame flame-scale block); this is just a faint drift, not the main effect */
function emitTrail(){
  const col=S.boost?0xffb300:0x35e8ff;
  const ex=curShip.visual.engineX;   // match the equipped hull's actual engine spacing
  for(const sx of [-1,1]){
    tmp.set(sx*ex,-.1,3.0).applyQuaternion(ship.quaternion).add(ship.position);
    const m=trailPool.get();m.material.color.setHex(col);m.material.opacity=.15;
    m.position.copy(tmp);m.quaternion.copy(ship.quaternion);m.scale.set(.34,.34,.85+(S.boost?.5:0));
    trail.push({m,life:.2});
  }
}
function launchMissile(target){
  const g=new THREE.Group();
  const body=new THREE.Mesh(sharedGeo('mslBody',()=>new THREE.ConeGeometry(.30,2.0,8)),M.amber);g.add(body);
  const band=new THREE.Mesh(sharedGeo('mslBand',()=>new THREE.CylinderGeometry(.31,.31,.3,8)),M.mag);band.position.y=.1;g.add(band);
  const finGeo=sharedGeo('mslFin',()=>new THREE.BoxGeometry(.05,.5,.5));
  for(let f=0;f<3;f++){const fin=new THREE.Mesh(finGeo,M.dark2);
    fin.position.y=-.8;fin.rotation.y=f*2.09;fin.position.x=Math.cos(f*2.09)*.3;fin.position.z=Math.sin(f*2.09)*.3;g.add(fin);}
  const tail=new THREE.Mesh(sharedGeo('mslTail',()=>new THREE.SphereGeometry(.26,8,8)),M.glow);tail.position.y=-1.1;g.add(tail);
  g.position.copy(ship.position);
  g.position.add(new THREE.Vector3(0,-.6,0).applyQuaternion(ship.quaternion));
  scene.add(g);
  const v=new THREE.Vector3(0,0,-1).applyQuaternion(ship.quaternion).multiplyScalar(300);
  msls.push({m:g,v,target,life:5,light:takeLight(0xffb300,1.4,18)});
  sfx('msl');
}
