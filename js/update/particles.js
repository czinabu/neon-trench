"use strict";
/* Update stage: particle effects and transient markers. */

/* sparks, explosion rings, smoke, engine trail, combo + hit-marker decay */
function updateParticles(fr){
  const {dt,p}=fr;
  /* ----- sparks ----- */
  for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];
    s.m.position.addScaledVector(s.v,dt);s.life-=dt;s.m.material.opacity=Math.max(0,s.life*1.6);
    if(s.life<=0){freeSparkMesh(s.m);sparks.splice(i,1);}}
  /* ----- explosion rings + flash cores ----- */
  for(let i=rings.length-1;i>=0;i--){const R=rings[i];
    R.life-=dt;const k=R.core?(1+(1-R.life/.32)*2.2*R.scale):(1+(1-R.life/.5)*10*R.scale);
    R.m.scale.setScalar(k*R.base);R.m.material.opacity=Math.max(0,R.life*(R.core?3:1.8));
    if(!R.core)R.m.lookAt(camera.position);
    if(R.life<=0){freeRing(R);rings.splice(i,1);}}
  /* ----- fireballs: white-hot flash cooling to the blast colour as it swells and fades ----- */
  for(let i=fireballs.length-1;i>=0;i--){const F=fireballs[i];
    F.life-=dt;const k=1-Math.max(0,F.life)/F.max;
    F.m.scale.setScalar(F.scale*(2.5+k*9));
    F.m.material.color.setHex(0xfff4d6).lerp(F.color,Math.min(1,k*2.2));
    F.m.material.opacity=Math.pow(1-k,1.6);
    if(F.life<=0){freeFireball(F);fireballs.splice(i,1);}}
  /* ----- hull debris ----- */
  for(let i=debris.length-1;i>=0;i--){const D=debris[i];
    D.life-=dt;D.m.position.addScaledVector(D.v,dt);D.v.multiplyScalar(Math.exp(-1.2*dt));
    D.m.rotation.x+=D.spin.x*dt;D.m.rotation.y+=D.spin.y*dt;D.m.rotation.z+=D.spin.z*dt;
    D.m.scale.setScalar(D.s*Math.min(1,D.life*2.5));
    if(D.life<=0){freeDebris(D);debris.splice(i,1);}}
  updateDust();
  updateDamageFx(dt);
  /* ----- drifting smoke (damage + low-hull trail) ----- */
  for(let i=smoke.length-1;i>=0;i--){const s=smoke[i];
    s.life-=dt;s.m.position.addScaledVector(s.v,dt);s.m.scale.setScalar(s.base*(1+(1-s.life)*s.gr*1.5));
    s.m.material.opacity=Math.max(0,s.life*.6);
    if(s.life<=0){smokePool.put(s.m);smoke.splice(i,1);}}
  if(S.hull<40&&Math.random()<(40-S.hull)/40*.5) // wounded ship smoulders
    puff(tmp.set(0,-.3,1.8).applyQuaternion(ship.quaternion).add(p),1);
  /* ----- engine trail (chase view only — you can't see it from the cockpit) ----- */
  if(S.cam==='tp'&&Math.abs(S.throttle)>0.05&&!reduceMotion){S.trailT=(S.trailT||0)-dt;
    if(S.trailT<=0){S.trailT=.055;emitTrail();}}   // sparse minor wake — the thruster glow itself carries the effect now
  for(let i=trail.length-1;i>=0;i--){const T=trail[i];
    T.life-=dt;T.m.material.opacity=Math.max(0,T.life*.9);
    T.m.scale.x+=dt*.6;T.m.scale.y+=dt*.6;        // barely grow — they fade rather than balloon
    if(T.life<=0){trailPool.put(T.m);trail.splice(i,1);}}
  /* ----- combo decay ----- */
  if(S.comboT>0){S.comboT-=dt;if(S.comboT<=0)S.combo=0;}
  comboPop.style.opacity=Math.max(0,(parseFloat(comboPop.style.opacity)||0)-dt*1.4);
  /* ----- hit confirmation marker: snap-in pop that settles and fades (kill = bigger, red) ----- */
  if(S.hitMarkT>0){
    S.hitMarkT-=dt;
    const total=S.hitMarkKind==='kill'?.35:.22, t=Math.max(0,S.hitMarkT/total);
    hitmark.classList.toggle('kill',S.hitMarkKind==='kill');
    hitmark.style.opacity=t;
    hitmark.style.transform='scale('+(1+.35*t)+')';   // pops outward on impact, settles as it fades
  }else hitmark.style.opacity=0;
}
