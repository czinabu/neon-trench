"use strict";
/* Countermeasures: decoy flares the player drops (G) to pull enemy homing missiles off. */

const flares=[];   // {m,v,life,light,dead}
const flarePool=meshPool(new THREE.SphereGeometry(.6,8,6),{color:0xffd890,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});
/* a salvo of six flares kicked out behind and to the sides; every missile tracking you goes for one */
function deployFlares(){
  S.cm--;S.cmCD=.8;
  const salvo=[];
  for(let i=0;i<6;i++){
    const m=flarePool.get();m.material.opacity=1;m.position.copy(ship.position);
    tmp.set((i%2?1:-1)*(10+Math.random()*12),(Math.random()-.35)*14,16+Math.random()*12).applyQuaternion(ship.quaternion);
    const F={m,v:S.vel.clone().multiplyScalar(.3).add(tmp),life:2.6+Math.random()*.6,light:i<2?takeLight(0xffc070,2.4,45):null,dead:false};
    flares.push(F);salvo.push(F);
  }
  let pulled=0;
  for(const E of eMsls)if(!E.decoy){E.decoy=salvo[(Math.random()*salvo.length)|0];pulled++;}
  if(pulled)spawnPop(tmp.copy(ship.position).addScaledVector(fwd,30),pulled>1?pulled+' MISSILES DECOYED':'MISSILE DECOYED','');
  sfx('flare',ship.position);
}
/* a missile launched while a salvo is still burning bright takes the bait too */
function flareDecoy(){
  const live=flares.filter(F=>F.life>.9);
  return live.length?live[(Math.random()*live.length)|0]:null;
}
function updateFlares(dt){
  for(let i=flares.length-1;i>=0;i--){const F=flares[i];
    F.life-=dt;F.v.multiplyScalar(Math.exp(-1.3*dt));F.v.y-=4*dt;
    F.m.position.addScaledVector(F.v,dt);
    const k=Math.min(1,F.life);F.m.material.opacity=k*(.75+Math.random()*.25);F.m.scale.setScalar(.8+Math.random()*.5);
    if(F.light){F.light.position.copy(F.m.position);F.light.intensity=2.4*k;}
    if(Math.random()<.35)spark(F.m.position,0xffb347,1,6);
    if(F.life<=0){F.dead=true;flarePool.put(F.m);freeLight(F.light);flares.splice(i,1);}
  }
}
function clearFlares(){for(const F of flares){F.dead=true;flarePool.put(F.m);freeLight(F.light);}flares.length=0;}
