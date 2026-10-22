"use strict";
/* Update stage: trench objective (reactor + torpedo). */

/* reactor port + torpedo run (trench finale); returns true when the run is won */
function updateObjective(fr){
  const {dt,arena,p}=fr;
  /* ----- exhaust port / torpedo (trench finale only) ----- */
  const distPort=Math.max(0,p.z-(-S.runLen));fr.distPort=distPort;
  if(S.escape)return updateEscape(fr);   // the core is gone: the run back out (js/interior.js)
  if(!arena){
  if(exhaustPort){exhaustPort.material.opacity=.75+Math.sin(S.time*6)*.25;
    portGroup.children[1].rotation.z+=dt;portGroup.children[2].rotation.z-=1.5*dt;}
  if(!torpedo&&!S.fired&&distPort<950){
    tmp.set(0,0,-S.runLen).sub(p).normalize();
    const aligned=fwd.dot(tmp)>.965;
    lock.style.display='block';
    if(aligned){S.lock=Math.min(1,S.lock+dt/1.1);
      if(S.lock>=1&&!S.locked){S.locked=true;sfx('lock');}
    }else{S.lock=Math.max(0,S.lock-dt*1.5);S.locked=S.lock>=1;}
    lockTxt.textContent=S.locked?'Locked — fire torpedo [F]':
      aligned?('Acquiring lock '+Math.round(S.lock*100)+'%'):'Align with the intake';
    lockTxt.style.color=S.locked?'#00f0ff':'';
    if(S.locked&&(S.keys.KeyF)){
      S.fired=true;lock.style.display='none';sfx('laser');
      const m=new THREE.Mesh(sharedGeo('torpedo',()=>new THREE.ConeGeometry(.6,3.4,8)),M.amber);
      m.position.copy(p);scene.add(m);
      torpedo={m,t:0};
    }
  }else if(!torpedo)lock.style.display='none';
  if(torpedo){
    torpedo.t+=dt;
    tmp.set(0,0,-S.runLen+3).sub(torpedo.m.position);
    const d=tmp.length();
    torpedo.m.position.addScaledVector(tmp.normalize(),Math.min(d,320*dt));
    torpedo.m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tmp);
    spark(torpedo.m.position,0xffb300,1,4);
    if(d<6){
      if(S.interior){const q=torpedo.m.position;   // the reactor goes up around you
        burst(q,0x5fe8ff,9);burst(q,0xffee88,6);spark(q,0xffee88,60,90);shatter(q,24,2.6);S.shake=1;}
      spark(torpedo.m.position,0xff5500,80,70);spark(torpedo.m.position,0x00f0ff,40,50);
      scene.remove(torpedo.m);torpedo=null;
      if(S.interior){startEscape();return false;}   // the ship is coming apart: now get out
      endGame(true);return true;}
  }
  if(distPort<10&&!torpedo){damage(200,'Flew straight into the reactor housing.');}
  }
  return false;
}
