"use strict";
/* Friendly wingmen: two AI fighters that fly with you in the arena modes. Number keys give orders
   (see wingOrder); the flight AI is in js/update/wingmen.js. */

const WING_CALLSIGNS=['PIKE','LARK','DRIFT','CINDER'];
const WING_ORDERS={form:{key:'1',name:'FORM UP'},target:{key:'2',name:'ATTACK MY TARGET'},free:{key:'3',name:'FREE ENGAGE'}};
/* formation slot in the player's frame (-z is ahead): off each wing and out in front, so they sit in view */
const WING_SLOT=new THREE.Vector3(30,-3,-55);
const wingmen=[];   // {mesh,callsign,slot,spd,wvel,up,fireT,trailT}

function buildWingman(){
  const g=new THREE.Group();
  const hull=new THREE.Mesh(sharedGeo('wgBody',()=>new THREE.ConeGeometry(.9,5,8).rotateX(-Math.PI/2)),M.dark2);g.add(hull);
  for(const sx of[-1,1]){
    const wing=new THREE.Mesh(sharedGeo('wgWing',()=>new THREE.BoxGeometry(3.2,.12,2.2)),M.dark);wing.position.set(sx*1.9,0,.9);g.add(wing);
    const tip=new THREE.Mesh(sharedGeo('wgTip',()=>new THREE.BoxGeometry(.2,.3,2.3)),M.cyan);tip.position.set(sx*3.4,0,.9);g.add(tip);
  }
  const eng=new THREE.Mesh(sharedGeo('wgEng',()=>new THREE.SphereGeometry(.45,8,6)),M.flame);eng.position.set(0,0,2.5);g.add(eng);
  return g;
}
function spawnWingmen(){
  clearWingmen();
  for(let i=0;i<2;i++){
    const mesh=buildWingman();
    mesh.scale.setScalar(1.6);addBeacon(mesh,0x00f0ff);
    mesh.position.set((i?1:-1)*WING_SLOT.x,WING_SLOT.y,WING_SLOT.z).applyQuaternion(ship.quaternion).add(ship.position);scene.add(mesh);
    wingmen.push({mesh,callsign:WING_CALLSIGNS[i],slot:i?1:-1,spd:140,wvel:new THREE.Vector3(0,0,-60),up:new THREE.Vector3(0,1,0),fireT:.5+i*.25,trailT:0});
  }
  S.wingOrder='form';
  setWingOrderHud();
}
function clearWingmen(){
  wingmen.forEach(w=>scene.remove(w.mesh));wingmen.length=0;
  S.wingOrder='form';wingHud.style.display='none';
}
function setWingOrder(o){
  if(!wingmen.length||!WING_ORDERS[o])return;
  S.wingOrder=o;setWingOrderHud();sfx('acquire');
}
function setWingOrderHud(){
  const o=WING_ORDERS[S.wingOrder];
  wingHud.style.display=wingmen.length?'block':'none';
  wingHud.textContent='WING // '+o.name;
}
