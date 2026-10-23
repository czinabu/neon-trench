"use strict";
/* Update stage: capital ships (js/capital.js). Enemy warp-in, the slow turn on station, gun and flak turrets,
   the frigate's lance, the carrier's wingman relaunches, and the death sequence: chain explosions, the
   reactor blast and the hull breaking in two. Fleet battles hook in here too (js/fleet.js). */

const capV=new THREE.Vector3(), capUp=new THREE.Vector3(), capAim=new THREE.Vector3(), capFv=new THREE.Vector3(),
      capNose=new THREE.Vector3(), capQ=new THREE.Quaternion(), capM=new THREE.Matrix4();
const CAP_WARP_T=2.4, CAP_DIE_T=3.4;
function updateCapital(fr){
  const {dt,p}=fr;
  if(fr.arena&&S.capMode==='fleet'&&!S.capSpawned)fleetSpawns();
  else if(fr.arena&&S.capMode&&!S.capSpawned&&!S.school){
    const T=CAPITAL_TYPES[S.capMode]||CAPITAL_TYPES.cruiser;
    if(S.kills>=T.spawnKills||S.time>T.spawnTime)spawnCapital(S.capMode);
  }
  for(let i=capitals.length-1;i>=0;i--)capShip(capitals[i],dt,p);
  capShellsFrame(dt,p);
  carrierPdBolts(dt);
  fleetFrame(dt,p);
  capHudUpdate(p);
}
function capShip(C,dt,p){
  C.t+=dt;
  const g=C.g;
  if(C.state==='warp'){
    // drops out of warp: rushes in stretched along its heading and settles onto its station with a flash
    const k=Math.min(1,C.t/CAP_WARP_T),e=1-Math.pow(1-k,4);
    g.position.copy(C.station).addScaledVector(C.hdg,-1400*(1-e));
    g.scale.z=1+5*Math.pow(1-k,2);
    if(k>=1){
      C.state='fight';g.scale.z=1;
      g.updateMatrixWorld(true);capAddCols(C);capTargets.push(...C.parts,...C.systems);
      tmp.copy(C.station).addScaledVector(C.hdg,C.hull.len*.55);   // at the bow
      burst(tmp,0x9fe8ff,5);spark(tmp,0x9fe8ff,40,70);sfx('boom',tmp);
      if(C.station.distanceTo(p)<500)S.shake=Math.min(1,S.shake+.3);
    }
  }else if(C.state==='fight'){
    if(C.fleet&&C.friendly)fleetStance(C,dt);   // its stance from the command bridge
    else if(C.fleet)fleetAdvance(C,dt);
    if(C.adrift){}   // engines shot out: it can't turn either
    else if(C.lance&&!C.lance.dead)capLanceSteer(C,dt,p);
    else if(C.yaw)g.rotateY(C.yaw*dt);   // a slow turn on station, so its broadside swings round
  }else if(C.state==='dying'){
    g.rotateZ(.05*dt);g.position.y-=2.5*dt;   // lists and sinks as it burns
  }
  g.updateMatrixWorld(true);
  if(C.cols.length)capSyncCols(C);
  // weapon and reactor positions for bolts, pips, targeting and wingmen
  for(const T of C.parts)T.head.getWorldPosition(T.mesh.position);
  if(C.core){C.core.dome.getWorldPosition(C.core.mesh.position);
    capUp.set(0,1,0).applyQuaternion(g.quaternion);C.core.mesh.position.addScaledVector(capUp,3);}
  if(C.systems.length&&C.state!=='wreck')fleetSystemsFrame(C,dt);
  if(C.state==='fight'){
    if(C.friendly){if(C.kind==='carrier')capCarrier(C,dt);return;}
    // the shield bubble shimmers; once it is down the reactor throbs red
    if(C.shield.visible)C.mats.shield.opacity=.12+Math.sin(S.time*5)*.05+(Math.random()<.04?.15:0);
    else C.mats.core.color.setHSL(.02,1,.45+Math.sin(S.time*9)*.15);
    for(const T of C.parts){
      if(T.dead){T.smokeT-=dt;if(T.smokeT<=0){T.smokeT=.22;puff(T.mesh.position,1);if(Math.random()<.3)spark(T.mesh.position,0xff7733,2,8);}continue;}
      if(T.kind==='lance')capLance(C,T,dt,p);else capGun(C,T,dt,p);
    }
  }else if(C.state==='dying')capDying(C,dt,p);
  else if(C.state==='wreck')capWreck(C,dt,p);
}
/* who a turret shoots: mostly you; sometimes the nearest wingman in reach, or the carrier */
function capPickFoe(C,T,dt){
  T.foeT-=dt;
  if(T.foeT>0&&!(T.foe&&T.foe.dead))return;
  T.foeT=3+Math.random()*3;T.foe=null;
  const r=Math.random();
  if(r<C.T.wingChance){let bd=C.T.range;
    for(const w of wingmen){if(w.dead||w.launch>0)continue;const d=w.mesh.position.distanceTo(T.mesh.position);if(d<bd){bd=d;T.foe=w;}}}
  else if(r<C.T.wingChance+(C.fleet?.35:.15)){   // the carrier (or, in a fleet battle, either ship in the friendly line)
    const fs=friendlyCaps().filter(K=>K.g.position.distanceTo(T.mesh.position)<C.T.range+100);
    if(fs.length)T.foe=fs[(Math.random()*fs.length)|0];}
}
/* one gun or flak turret: track, telegraph, fire */
function capGun(C,T,dt,p){
  capPickFoe(C,T,dt);
  const tp=T.foe?T.foe.mesh.position:p, tv=T.foe?T.foe.wvel:S.vel;
  const spd=T.kind==='flak'?T.T.shellSpd:T.T.boltSpd;
  const d=tp.distanceTo(T.mesh.position);
  capAim.copy(tp).addScaledVector(tv,d/spd);
  T.head.lookAt(capAim);
  capUp.set(0,T.up,0).applyQuaternion(C.g.quaternion);
  capV.copy(capAim).sub(T.mesh.position).normalize();
  const canFire=d<C.T.range&&capV.dot(capUp)>.06;   // only above its own deck (or below, for the keel guns)
  T.t-=dt;
  const warming=canFire&&T.t<.5?1:0;
  T.glow+=(warming-T.glow)*Math.min(1,8*dt);
  T.eye.scale.setScalar(1+T.glow);T.eyeMat.color.setHex(T.glow>.5?0xffd0a0:C.mats.P.eye);
  if(T.burst>0){T.burstT-=dt;if(T.burstT<=0){T.burst--;T.burstT=T.T.gap;capShot(T);}return;}
  if(!canFire||T.t>0)return;
  T.t=(T.T.fire[0]+Math.random()*T.T.fire[1])*(C.blind?FLEET.blindFire:1);   // bridge gone: no fire control
  if(T.kind==='flak'){capFlak(C,T,d);return;}
  T.burst=(T.T.shots||1)-1;T.burstT=T.T.gap;capShot(T);
}
function capShot(T){
  capFv.copy(capAim).sub(T.mesh.position).normalize();
  sv0.copy(T.mesh.position).addScaledVector(capFv,5);
  capV.copy(capAim).sub(sv0);const sc=T.ship.T.scatter*(T.ship.blind?FLEET.blindScatter:1);capV.x+=(Math.random()-.5)*sc;capV.y+=(Math.random()-.5)*sc;capV.z+=(Math.random()-.5)*sc;
  fireBolt(eBolts,M.boltE,sv0,capV,T.T.boltSpd);sfx('ezap',sv0);
  spark(sv0,T.ship.mats.P.eye,2,20);
}
/* flak: a glowing shell timed to burst where the target will be, a little short or long of it */
function capFlak(C,T,d){
  capFv.copy(capAim).sub(T.mesh.position).normalize();
  sv0.copy(T.mesh.position).addScaledVector(capFv,5);
  const m=new THREE.Mesh(sharedGeo('capShell',()=>new THREE.SphereGeometry(.8,6,5)),M.amber);m.position.copy(sv0);scene.add(m);
  capShells.push({m,v:capFv.clone().multiplyScalar(T.T.shellSpd),fuse:Math.max(.3,(d+(Math.random()-.5)*30)/T.T.shellSpd),T:T.T,C});
  sfx('ezap',sv0);spark(sv0,0xffb300,3,22);
}
function capShellsFrame(dt,p){
  for(let i=capShells.length-1;i>=0;i--){const F=capShells[i];
    F.m.position.addScaledVector(F.v,dt);F.fuse-=dt;
    if(F.fuse>0&&!(S.sector==='arena'&&arenaSdf(F.m.position,3)<1))continue;
    const q=F.m.position,R=F.T.radius;
    burst(q,0xffb300,1.2);spark(q,0xffb300,14,34);puff(q,2);
    if(q.distanceTo(p)<R*3)sfx('boom',q);
    const dp=q.distanceTo(p);if(dp<R)damage(Math.round(F.T.dmg*(1-dp/R*.6)),'Shredded by flak from '+F.C.T.name+'.',q);
    for(const w of wingmen)if(!w.dead&&w.mesh.position.distanceTo(q)<R)hitWingman(w,F.T.dmg*.6);
    for(const K of friendlyCaps())if(capSegHit(K,tmp.copy(q).addScaledVector(F.v,-dt),q))hitCarrier(K,F.T.dmg,q);
    scene.remove(F.m);capShells.splice(i,1);
  }
}
/* the frigate swings its whole hull to bring the lance to bear: fast while idle, slower while charging so
   a hard turn gets you out of the line, and not at all while it fires */
function capLanceSteer(C,dt,p){
  const L=C.lance;if(L.phase==='fire')return;
  capV.copy(fleetLanceAim(C,p)).sub(C.g.position);capV.y=Math.max(-.35,Math.min(.35,capV.y/(capV.length()||1)))*capV.length();
  capM.lookAt(C.g.position,tmp.copy(C.g.position).add(capV),AP_UP);   // -z toward the player
  capQ.setFromRotationMatrix(capM);
  C.g.quaternion.rotateTowards(capQ,L.T.turn*(L.phase==='charge'?.45:1)*dt);
}
function capLance(C,L,dt,p){
  const T=L.T;
  L.eye.getWorldPosition(sv0);
  capNose.set(0,0,-1).applyQuaternion(C.g.quaternion);
  const aim=fleetLanceAim(C,p),onYou=aim===p;   // in a fleet battle it may be lining up on HALCYON instead
  capV.copy(aim).sub(sv0);const d=capV.length();
  L.cool-=dt;
  if(L.phase==='idle'){
    C.beam.visible=false;
    L.glow+=(0-L.glow)*Math.min(1,4*dt);
    if(L.cool<=0&&d<T.reach&&capV.dot(capNose)/d>.94){L.phase='charge';L.pt=0;L.beepT=0;
      if(S.annT<=0)announce('LANCE CHARGING',onYou?'Break out of its line':C.T.name+' is lining up on '+L.aimK.T.name,'ace');}
  }else if(L.phase==='charge'){
    L.pt+=dt;const k=L.pt/T.charge;
    L.glow=k;
    // telegraph: a thin flickering line down the bore that thickens as the charge builds
    C.beam.visible=true;C.beam.scale.set(.25+k*.5,T.reach,.25+k*.5);C.beam.position.set(0,0,-T.reach/2);
    C.mats.beam.color.setHex(0xff4a6a);C.mats.beam.opacity=(.12+k*.35)*(Math.random()<.15?.4:1);
    L.beepT-=dt;if(L.beepT<=0&&d<T.reach&&onYou){L.beepT=.45-k*.3;sfx('lockwarn');}
    if(L.pt>=T.charge){L.phase='fire';L.pt=0;L.hit=new Set();
      sfx('bigboom',sv0);burst(sv0,0xffd0e0,4);spark(sv0,0xffd0e0,30,80);
      if(d<500){S.shake=Math.min(1,S.shake+.25);}}
  }else{   // fire: a thick white-hot beam; anything inside its width takes one hit per shot
    L.pt+=dt;const k=1-L.pt/T.fire;
    C.beam.scale.set(T.width*.8*(.6+k*.4),T.reach,T.width*.8*(.6+k*.4));
    C.mats.beam.color.setHex(0xffe0ea);C.mats.beam.opacity=.55+k*.4;
    const inBeam=pos=>{capFv.copy(pos).sub(sv0);const a=capFv.dot(capNose);
      return a>0&&a<T.reach&&capFv.addScaledVector(capNose,-a).length()<T.width;};
    if(!L.hit.has('p')&&inBeam(p)){L.hit.add('p');damage(T.dmg,'Burned through by '+C.T.name+'\'s lance.',sv0);}
    for(const w of wingmen)if(!w.dead&&!L.hit.has(w)&&inBeam(w.mesh.position)){L.hit.add(w);hitWingman(w,T.dmg);}
    for(const K of friendlyCaps())
      if(!L.hit.has(K)&&capSegHit(K,sv0,tmp.copy(sv0).addScaledVector(capNose,T.reach))){L.hit.add(K);hitCarrier(K,T.dmg,K.g.position);}
    if(Math.random()<.5){tmp.copy(sv0).addScaledVector(capNose,Math.random()*T.reach);spark(tmp,0xffb0c8,2,20);}
    if(L.pt>=T.fire){L.phase='idle';L.cool=T.cooldown[0]+Math.random()*T.cooldown[1];C.beam.visible=false;}
  }
  L.eye.scale.setScalar(1+L.glow*1.2);
  L.eyeMat.color.setHex(L.phase==='idle'?C.mats.P.eye:0xfff0f4);
  C.mats.neon.color.setHex(L.phase==='idle'?C.mats.P.neon:(Math.random()<.5?0xffe0ea:C.mats.P.neon));
}
/* the carrier: bay lights pulse, and a lost wingman is replaced from the reserve after a short wait */
function capCarrier(C,dt){
  C.mats.window.color.setHSL(.55,.6,.78+Math.sin(S.time*2)*.06);
  carrierPdFrame(C,dt);
  for(let i=0;i<wingmen.length;i++){
    if(!wingmen[i].dead||C.reserve<=0){C.relT[i]=0;continue;}
    if(!C.relT[i]){C.relT[i]=C.T.relaunch;continue;}
    C.relT[i]-=dt;
    if(C.relT[i]<=0){C.relT[i]=0;C.reserve--;
      const W=newWingman(i,WING_CALLSIGNS[(2+C.launched++)%WING_CALLSIGNS.length]);
      wingmen[i]=W;capLaunchWingman(C,W,0);setWingOrderHud();
      announce(W.callsign+' LAUNCHING','Replacement from '+C.T.name,'');}
  }
}
/* put a wingman in the carrier's bay; after `wait` seconds it accelerates out of the mouth */
function capLaunchWingman(C,W,wait,bayX){
  W.carrier=C;W.launch=wait+2.2;W.bayX=bayX||0;
  W.mesh.position.copy(C.bay);W.mesh.position.x+=W.bayX;C.g.localToWorld(W.mesh.position);
  W.mesh.quaternion.copy(C.g.quaternion);W.spd=30;
}
/* a random point on the hull, in world space (for chain explosions) */
function capHullPoint(C,out){
  const H=C.hull;
  out.set((Math.random()-.5)*H.w,(Math.random()-.5)*H.h+(Math.random()<.4?H.h*.5:0),H.z0+Math.random()*(H.z1-H.z0));
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
  const k=C.t/CAP_DIE_T;
  C.mats.neon.color.setHex(Math.random()<k?0x220810:C.mats.P.neon);
  C.mats.window.color.setHex(Math.random()<k?0x1a1008:C.mats.P.window);
  C.mats.eng.opacity=Math.max(0,.95-k);
  C.mats.core.color.setHex(0xfff4d0);
  if(C.beam)C.beam.visible=false;
  if(C.t>=CAP_DIE_T)capBlast(C,p);
}
/* the reactor goes: white flash, an expanding shockwave ring, debris, and the hull snaps in two */
function capBlast(C,p){
  C.state='wreck';C.t=0;C.fireT=0;
  capDropCols(C);
  C.mats.neon.color.setHex(0x220810);C.mats.window.color.setHex(0x1a1008);C.mats.eng.opacity=0;C.mats.core.color.setHex(0x111111);
  const c=(C.core?C.core.mesh.position:C.g.position).clone();
  for(let i=0;i<6;i++){capHullPoint(C,sv1);burst(sv1,0xff7733,5+Math.random()*4);}
  burst(c,0xffee88,12);spark(c,0xffee88,70,110);spark(c,0xff5500,60,80);spark(c,0x5fe8ff,30,90);
  shatter(c,30,3.2);
  sfx('bigboom',c);hitStop(.16);
  const d=c.distanceTo(p);
  S.shake=Math.min(1,S.shake+Math.max(.25,1-d/700));addKick(0,1.2*Math.max(.3,1-d/700),0);
  if(d<140)damage(30,'Caught in the blast when '+C.T.name+' went up.',c);
  // shockwave: a flat ring in the ship's plane racing outward, and a flash that blooms and fades
  const ring=new THREE.Mesh(new THREE.RingGeometry(.86,1,96),new THREE.MeshBasicMaterial({color:0xbff4ff,blending:THREE.AdditiveBlending,
    transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
  ring.position.copy(c);ring.quaternion.copy(C.g.quaternion);ring.rotateX(Math.PI/2);scene.add(ring);C.ring=ring;
  const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xfff2d8,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
  flash.position.copy(c);scene.add(flash);C.flash=flash;
  // the halves drift apart, tumbling (in the ship's frame: they are its children)
  C.foreV=new THREE.Vector3(0,3,-16);C.aftV=new THREE.Vector3(0,-4,12);
  if(C.friendly){announce(C.T.name+' LOST',C.kind==='carrier'?'No more wingman launches':'The line has lost its escort','ace');return;}
  S.score+=C.T.worth;spawnPop(c,C.T.name+' DESTROYED +'+C.T.worth,'crit');
  announce(C.T.cls+' DESTROYED',C.T.name+' is down','ace');
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
    const H=C.hull,half=Math.random()<.5?C.fore:C.aft;
    sv1.set((Math.random()-.5)*H.w*.8,(Math.random()-.5)*H.h*.8,half===C.fore?H.z0*Math.random():H.z1*Math.random());half.localToWorld(sv1);
    burst(sv1,0xff7733,2+Math.random()*2);puff(sv1,2);}
  if(t>2.5&&!C.friendly&&!C.counted){C.counted=true;   // counted only once the player has seen it go
    const left=capitals.filter(o=>!o.friendly&&o.state!=='wreck');
    if(S.capSpawned&&!left.length)S.capDown=true;
    else if(S.fleet)S.capName=left.map(o=>o.T.name).join(' + ');}
  if(t>14){scene.remove(C.g);capitals.splice(capitals.indexOf(C),1);}
}
/* status, top left: one line per capital ship (name, range, hull), plus a dim detail line for enemies */
const capLanceTxt=C=>C.lance.dead?'<span class="cd">DOWN</span>':C.lance.phase==='idle'?'READY':'<span class="cx">'+(C.lance.phase==='charge'?'CHARGING':'FIRING')+'</span>';
const capBar=(k,n)=>'<span class="ct">'+'▮'.repeat(k)+'<i>'+'▮'.repeat(n-k)+'</i></span>';
function capHudUpdate(p){
  let h='';
  for(const C of capitals){
    if(C.state==='wreck'&&(!C.friendly||C.t>5))continue;
    const d=C.g.position.distanceTo(p);
    const hull=C.friendly||C.fleet?capBar(Math.ceil(C.hp/C.T.hp*10),10):'';
    h+='<div class="'+(C.friendly?'cf':'ce')+'"><b>'+C.T.name+'</b> <span class="cd">'+(d<1000?Math.round(d/10)*10+'M':(d/1000).toFixed(1)+'KM')+'</span> '+hull;
    if(C.friendly){
      if(C.state!=='fight')h+='<span class="cx">LOST</span>';
      else if(C.kind==='carrier')h+=' <span class="cd">RSV '+C.reserve+'</span>';
    }else if(C.fleet)h+=fleetHud(C);
    else if(C.state==='warp')h+=' <span class="cw">WARPING IN</span>';
    else if(C.state==='dying')h+=' <span class="cx">REACTOR CRITICAL</span>';
    else if(C.shield.visible){
      const guns=C.parts.filter(t=>t.kind!=='lance'),left=guns.filter(t=>!t.dead).length;
      h+='<br><span class="cd">'+(C.kind==='frigate'?'FLAK ':'TURRETS ')+left+'/'+guns.length+(C.lance?' · LANCE '+capLanceTxt(C):'')+'</span> <span class="cs">SHIELDED</span>';
    }else h+=' <span class="cx">REACTOR EXPOSED</span> '+capBar(Math.ceil(C.core.hp/C.core.T.hp*10),10);
    h+='</div>';
  }
  capHud.style.display=h?'block':'none';
  if(h!==capHud._h){capHud.innerHTML=h;capHud._h=h;}
}
