"use strict";
/* Update stage: the enemy capital ship (js/capital.js). Warp-in, slow station-keeping turn, turret fire
   at the player and wingmen, then the death sequence: chain explosions, the reactor blast, and the hull
   breaking in two. */

const capV=new THREE.Vector3(), capUp=new THREE.Vector3(), capAim=new THREE.Vector3(), capFv=new THREE.Vector3();
const CAP_WARP_T=2.4, CAP_DIE_T=3.4;
function updateCapital(fr){
  const {dt,p}=fr;
  if(fr.arena&&S.capMode&&!S.capSpawned&&!S.school&&(S.kills>=CAP_SPAWN_KILLS||S.time>45))spawnCapital();
  const C=CAP;if(!C)return;
  C.t+=dt;
  const g=C.g;
  if(C.state==='warp'){
    // drops out of warp: rushes in stretched along its heading and settles onto its station with a flash
    const k=Math.min(1,C.t/CAP_WARP_T),e=1-Math.pow(1-k,4);
    g.position.copy(C.station).addScaledVector(C.hdg,-1400*(1-e));
    g.scale.z=1+5*Math.pow(1-k,2);
    if(k>=1){
      C.state='fight';g.scale.z=1;
      g.updateMatrixWorld(true);capAddCols(C);capTargets.push(...C.turrets);
      tmp.copy(C.station).addScaledVector(C.hdg,140);   // at the bow
      burst(tmp,0x9fe8ff,5);spark(tmp,0x9fe8ff,40,70);sfx('boom',tmp);
      if(C.station.distanceTo(p)<500){S.shake=Math.min(1,S.shake+.3);}
    }
  }else if(C.state==='fight'){
    g.rotateY(C.yaw*dt);   // a slow turn on station, so its broadside swings round
  }else if(C.state==='dying'){
    g.rotateZ(.05*dt);g.position.y-=2.5*dt;   // lists and sinks as it burns
  }
  g.updateMatrixWorld(true);
  if(C.cols.length)capSyncCols(C);
  // turret and reactor positions for bolts, pips, targeting and wingmen
  for(const T of C.turrets)T.head.getWorldPosition(T.mesh.position);
  C.core.dome.getWorldPosition(C.core.mesh.position);
  capUp.set(0,1,0).applyQuaternion(g.quaternion);
  C.core.mesh.position.addScaledVector(capUp,3);
  if(C.state==='fight'){
    // the shield bubble shimmers; once it is down the reactor throbs red
    if(C.shield.visible)capMats.shield.opacity=.12+Math.sin(S.time*5)*.05+(Math.random()<.04?.15:0);
    else capMats.core.color.setHSL(.02,1,.45+Math.sin(S.time*9)*.15);
    for(const T of C.turrets){
      if(T.dead){T.smokeT-=dt;if(T.smokeT<=0){T.smokeT=.22;puff(T.mesh.position,1);if(Math.random()<.3)spark(T.mesh.position,0xff7733,2,8);}continue;}
      capTurret(T,dt,p);
    }
  }else if(C.state==='dying')capDying(C,dt,p);
  else if(C.state==='wreck')capWreck(C,dt,p);
  capHudUpdate(p);
}
/* one turret: pick who to shoot (mostly you, sometimes a wingman in reach), track, telegraph, fire a burst */
function capTurret(T,dt,p){
  T.foeT-=dt;
  if(T.foeT<=0||T.foe&&T.foe.dead){
    T.foeT=3+Math.random()*3;T.foe=null;
    if(Math.random()<.35){let bd=CAP_RANGE;
      for(const w of wingmen){if(w.dead)continue;const d=w.mesh.position.distanceTo(T.mesh.position);if(d<bd){bd=d;T.foe=w;}}}
  }
  const tp=T.foe?T.foe.mesh.position:p, tv=T.foe?T.foe.wvel:S.vel;
  const d=tp.distanceTo(T.mesh.position);
  capAim.copy(tp).addScaledVector(tv,d/260);
  T.head.lookAt(capAim);
  capUp.set(0,T.up,0).applyQuaternion(CAP.g.quaternion);
  capV.copy(capAim).sub(T.mesh.position).normalize();
  const canFire=d<CAP_RANGE&&capV.dot(capUp)>.06;   // only above its own deck (or below, for the keel guns)
  T.t-=dt;
  const warming=canFire&&T.t<.5?1:0;
  T.glow+=(warming-T.glow)*Math.min(1,8*dt);
  T.eye.scale.setScalar(1+T.glow);T.eyeMat.color.setHex(T.glow>.5?0xffd0a0:0xff2d78);
  if(T.burst>0){T.burstT-=dt;if(T.burstT<=0){T.burst--;T.burstT=.13;capShot(T);}return;}
  if(canFire&&T.t<=0){T.t=2.4+Math.random()*1.8;T.burst=1;T.burstT=.13;capShot(T);}
}
function capShot(T){
  capFv.copy(capAim).sub(T.mesh.position).normalize();
  sv0.copy(T.mesh.position).addScaledVector(capFv,5);
  capV.copy(capAim).sub(sv0);capV.x+=(Math.random()-.5)*7;capV.y+=(Math.random()-.5)*7;capV.z+=(Math.random()-.5)*7;
  fireBolt(eBolts,M.boltE,sv0,capV,260);sfx('ezap',sv0);
  spark(sv0,0xff2d78,2,20);
}
/* a random point on the hull, in world space (for chain explosions) */
function capHullPoint(C,out){
  out.set((Math.random()-.5)*34,(Math.random()-.5)*22+(Math.random()<.4?11:0),-130+Math.random()*215);
  return C.g.localToWorld(out);
}
function capDying(C,dt,p){
  C.boomT-=dt;
  const near=C.g.position.distanceTo(p)<450;
  if(C.boomT<=0){
    C.boomT=.12+Math.random()*.16*(1-C.t/CAP_DIE_T);   // the blasts come faster toward the end
    capHullPoint(C,sv1);
    burst(sv1,Math.random()<.5?0xff7733:0xffb300,2.5+Math.random()*2.5);spark(sv1,0xff5500,14,40);puff(sv1,3);
    if(Math.random()<.6)sfx('boom',sv1);
    if(near)S.shake=Math.min(1,S.shake+.07);
  }
  // the neon gutters out and the engines die
  capMats.neon.color.setHex(Math.random()<C.t/CAP_DIE_T?0x220810:0xff2d78);
  capMats.window.color.setHex(Math.random()<C.t/CAP_DIE_T?0x1a1008:0xffb36b);
  capMats.eng.opacity=Math.max(0,.95-C.t/CAP_DIE_T);
  capMats.core.color.setHex(0xfff4d0);
  if(C.t>=CAP_DIE_T)capBlast(C,p);
}
/* the reactor goes: white flash, an expanding shockwave ring, debris, and the hull snaps in two */
function capBlast(C,p){
  C.state='wreck';C.t=0;C.fireT=0;
  capDropCols(C);
  capMats.neon.color.setHex(0x220810);capMats.window.color.setHex(0x1a1008);capMats.eng.opacity=0;capMats.core.color.setHex(0x111111);
  const c=C.core.mesh.position.clone();
  for(let i=0;i<6;i++){capHullPoint(C,sv1);burst(sv1,0xff7733,5+Math.random()*4);}
  burst(c,0xffee88,12);spark(c,0xffee88,70,110);spark(c,0xff5500,60,80);spark(c,0x5fe8ff,30,90);
  shatter(c,30,3.2);
  sfx('bigboom',c);hitStop(.16);
  const d=c.distanceTo(p);
  S.shake=Math.min(1,S.shake+Math.max(.25,1-d/700));addKick(0,1.2*Math.max(.3,1-d/700),0);
  if(d<140)damage(30,'Caught in the blast when '+CAP_NAME+' went up.',c);
  // shockwave: a flat ring in the ship's plane racing outward, and a flash that blooms and fades
  const ring=new THREE.Mesh(new THREE.RingGeometry(.86,1,96),new THREE.MeshBasicMaterial({color:0xbff4ff,blending:THREE.AdditiveBlending,
    transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
  ring.position.copy(c);ring.quaternion.copy(C.g.quaternion);ring.rotateX(Math.PI/2);scene.add(ring);C.ring=ring;
  const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xfff2d8,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
  flash.position.copy(c);scene.add(flash);C.flash=flash;
  // the halves drift apart, tumbling
  C.foreV=new THREE.Vector3(0,3,-16);C.aftV=new THREE.Vector3(0,-4,12);   // in the ship's frame (the halves are its children)
  S.score+=5000;spawnPop(c,CAP_NAME+' DESTROYED +5000','crit');
  announce('CRUISER DESTROYED',CAP_NAME+' is down','ace');
}
function capWreck(C,dt,p){
  const t=C.t;
  C.fore.position.addScaledVector(C.foreV,dt);C.fore.rotation.x+=.06*dt;C.fore.rotation.z-=.03*dt;
  C.aft.position.addScaledVector(C.aftV,dt);C.aft.rotation.x-=.045*dt;C.aft.rotation.y+=.02*dt;
  if(C.ring){const s=20+Math.pow(Math.min(1,t/1.6),.6)*520;C.ring.scale.setScalar(s);C.ring.material.opacity=Math.max(0,.9*(1-t/1.6));
    if(t>1.6){scene.remove(C.ring);C.ring=null;}}
  if(C.flash){C.flash.scale.setScalar(60+t*500);C.flash.material.opacity=Math.max(0,.8*(1-t/.6));
    if(t>.6){scene.remove(C.flash);C.flash=null;}}
  // fires keep breaking out on the two halves for a while
  C.fireT-=dt;
  if(C.fireT<=0&&t<7){C.fireT=.3+Math.random()*.4;
    const half=Math.random()<.5?C.fore:C.aft;
    sv1.set((Math.random()-.5)*30,(Math.random()-.5)*18,half===C.fore?-60-Math.random()*60:20+Math.random()*60);half.localToWorld(sv1);
    burst(sv1,0xff7733,2+Math.random()*2);puff(sv1,2);}
  if(t>2.5&&!S.capDown)S.capDown=true;   // counted only once the player has seen it go
  if(t>14){scene.remove(C.g);CAP=null;}
}
/* one-line status strip under the progress rail: name, range, turret count and the reactor's state */
function capHudUpdate(p){
  const C=CAP;
  if(!C||C.state==='wreck'){capHud.style.display='none';return;}
  capHud.style.display='block';
  const d=C.g.position.distanceTo(p);
  const left=C.turrets.filter(t=>!t.dead).length,n=C.turrets.length;
  let h='<b>CRUISER // '+CAP_NAME+'</b> <span class="cd">'+(d<1000?Math.round(d/10)*10+'M':(d/1000).toFixed(1)+'KM')+'</span> · ';
  if(C.state==='warp')h+='<span class="cw">WARPING IN</span>';
  else if(C.state==='dying')h+='<span class="cx">REACTOR CRITICAL</span>';
  else if(C.shield.visible)h+='TURRETS <span class="ct">'+'▮'.repeat(left)+'<i>'+'▮'.repeat(n-left)+'</i></span> '+left+'/'+n+' · <span class="cs">REACTOR SHIELDED</span>';
  else{const k=Math.ceil(C.core.hp/C.core.T.hp*10);
    h+='<span class="cx">REACTOR EXPOSED</span> <span class="ct">'+'▮'.repeat(k)+'<i>'+'▮'.repeat(10-k)+'</i></span>';}
  if(h!==C.hudH){capHud.innerHTML=h;C.hudH=h;}
}
