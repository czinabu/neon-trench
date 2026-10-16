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
// expanding shockwave ring + flash core for a punchier explosion
const rings=[];
function burst(pos,color,scale){
  scale=scale||1;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.6,1.1,24),
    new THREE.MeshBasicMaterial({color,blending:THREE.AdditiveBlending,transparent:true,opacity:.9,side:THREE.DoubleSide}));
  ring.position.copy(pos);ring.lookAt(camera.position);scene.add(ring);
  rings.push({m:ring,life:.5,scale});
  const core=new THREE.Mesh(new THREE.SphereGeometry(1.1*scale,10,10),
    new THREE.MeshBasicMaterial({color:0xfff0cc,blending:THREE.AdditiveBlending,transparent:true,opacity:.95}));
  core.position.copy(pos);scene.add(core);
  rings.push({m:core,life:.32,scale:scale*1.4,core:true});
}
// dark drifting smoke puff (player damage / low-hull trail)
function puff(pos,n){
  for(let i=0;i<(n||1);i++){
    const s=new THREE.Mesh(new THREE.SphereGeometry(.5+Math.random()*.4,5,5),
      new THREE.MeshBasicMaterial({color:0x20242e,transparent:true,opacity:.7}));
    s.position.copy(pos);s.position.x+=(Math.random()-.5)*1.2;s.position.y+=(Math.random()-.5)*1.2;
    scene.add(s);
    smoke.push({m:s,v:new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.5)*4+1,18+Math.random()*10),life:.7+Math.random()*.6,gr:1+Math.random()});
  }
}
// engine trail (chase view) — thin, short-lived streaks off the nacelles (subtle, not blown out)
const trail=[], trailGeo=new THREE.SphereGeometry(.32,6,6);
/* minor wake trail — the flame meshes at the engines do the real "intense thruster" work now
   (see the per-frame flame-scale block); this is just a faint drift, not the main effect */
function emitTrail(){
  const col=S.boost?0xffb300:0x35e8ff;
  const ex=curShip.visual.engineX;   // match the equipped hull's actual engine spacing
  for(const sx of [-1,1]){
    tmp.set(sx*ex,-.1,3.0).applyQuaternion(ship.quaternion).add(ship.position);
    const m=new THREE.Mesh(trailGeo,new THREE.MeshBasicMaterial({color:col,blending:THREE.AdditiveBlending,transparent:true,opacity:.15}));
    m.position.copy(tmp);m.quaternion.copy(ship.quaternion);m.scale.set(.34,.34,.85+(S.boost?.5:0));
    scene.add(m);trail.push({m,life:.2});
  }
}
function launchMissile(target){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.ConeGeometry(.30,2.0,8),M.amber);g.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.3,8),M.mag);band.position.y=.1;g.add(band);
  for(let f=0;f<3;f++){const fin=new THREE.Mesh(new THREE.BoxGeometry(.05,.5,.5),M.dark2);
    fin.position.y=-.8;fin.rotation.y=f*2.09;fin.position.x=Math.cos(f*2.09)*.3;fin.position.z=Math.sin(f*2.09)*.3;g.add(fin);}
  const tail=new THREE.Mesh(new THREE.SphereGeometry(.26,8,8),M.glow.clone());tail.position.y=-1.1;g.add(tail);
  const halo=new THREE.PointLight(0xffb300,1.4,18);halo.position.y=-1.1;g.add(halo);
  g.position.copy(ship.position);
  g.position.add(new THREE.Vector3(0,-.6,0).applyQuaternion(ship.quaternion));
  scene.add(g);
  const v=new THREE.Vector3(0,0,-1).applyQuaternion(ship.quaternion).multiplyScalar(300);
  msls.push({m:g,v,target,life:5});
  sfx('msl');
}
