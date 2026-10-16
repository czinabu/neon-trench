"use strict";
/* Update stage: projectiles and obstacle collisions. */

/* Swept tests: everything that moves is checked along the path it covered this frame, not just
   where it ended up. At boost speed or a low frame rate a point test let the ship (or a bolt)
   jump clean over a thin beam or a hit sphere between two frames. */
const sweepD=new THREE.Vector3(), sweepC=new THREE.Vector3(), relA=new THREE.Vector3(), relB=new THREE.Vector3();
const ORIGIN=new THREE.Vector3();
function segSphere(a,b,c,r){        // segment a→b vs sphere (c,r)
  sweepD.subVectors(b,a);const len2=sweepD.lengthSq()||1e-6;
  sweepC.subVectors(c,a);
  const t=Math.max(0,Math.min(1,sweepC.dot(sweepD)/len2));
  sweepC.copy(a).addScaledVector(sweepD,t);
  return sweepC.distanceToSquared(c)<r*r;
}
function segBox(a,b,mn,mx,pad){     // segment a→b vs box [mn-pad, mx+pad] (slab test)
  let t0=0,t1=1;
  for(const k of ['x','y','z']){
    const d=b[k]-a[k], lo=mn[k]-pad, hi=mx[k]+pad;
    if(Math.abs(d)<1e-9){if(a[k]<=lo||a[k]>=hi)return false;continue;}
    let u=(lo-a[k])/d, v=(hi-a[k])/d;if(u>v){const s=u;u=v;v=s;}
    if(u>t0)t0=u;if(v<t1)t1=v;if(t0>t1)return false;
  }
  return true;
}

/* player/enemy bolts, crossbeams, roll gates */
function updateCollisions(fr){
  const {dt,p,prevP}=fr;
  /* ----- bolts ----- */
  for(let i=pBolts.length-1;i>=0;i--){const B=pBolts[i];
    sv0.copy(B.m.position);
    B.m.position.addScaledVector(B.v,dt);B.life-=dt;
    let dead=B.life<=0;
    for(let j=turrets.length-1;j>=0&&!dead;j--)
      if(segSphere(sv0,B.m.position,turrets[j].mesh.position,6)){dead=true;hitEnemy(turrets[j],curShip.dmgMul);}
    for(let j=fighters.length-1;j>=0&&!dead;j--)
      if(segSphere(sv0,B.m.position,fighters[j].mesh.position,fighters[j].T.r)){dead=true;hitEnemy(fighters[j],curShip.dmgMul);}
    for(let j=eMsls.length-1;j>=0&&!dead;j--)
      if(segSphere(sv0,B.m.position,eMsls[j].m.position,2.4)){   // shoot incoming missiles down
        dead=true;burst(eMsls[j].m.position,0xff4030,.8);S.score+=40;spawnPop(eMsls[j].m.position,'MISSILE DOWN +40','');
        scene.remove(eMsls[j].m);eMsls.splice(j,1);}
    for(let j=bombers.length-1;j>=0&&!dead;j--)
      if(segSphere(sv0,B.m.position,bombers[j].mesh.position,4.5)){dead=true;hitEnemy(bombers[j],curShip.dmgMul);}
    for(let j=mines.length-1;j>=0&&!dead;j--)
      if(segSphere(sv0,B.m.position,mines[j].mesh.position,1.6)){ // shoot mines for points
        dead=true;burst(mines[j].mesh.position,0xff2d78,1);S.score+=15;
        scene.remove(mines[j].mesh);mines.splice(j,1);}
    if(dead){scene.remove(B.m);pBolts.splice(i,1);}
  }
  for(let i=eBolts.length-1;i>=0;i--){const B=eBolts[i];
    relA.copy(B.m.position).sub(prevP);           // bolt path as seen from the ship (both are moving)
    B.m.position.addScaledVector(B.v,dt);B.life-=dt;
    relB.copy(B.m.position).sub(p);
    let dead=B.life<=0;
    if(segSphere(relA,relB,ORIGIN,3.6)){dead=true;
      damage(8,'Cut apart by hostile gunfire.',tmp.copy(B.v).setLength(-80).add(B.m.position));}   // back along its path
    if(dead){scene.remove(B.m);eBolts.splice(i,1);}
  }
  /* ----- beams collision (incl. moving pistons) ----- */
  for(let i=beams.length-1;i>=0;i--){const B=beams[i];
    if(B.move){
      const o=Math.sin(S.time*B.move.sp+B.move.ph)*B.move.amp;
      if(B.move.axis==='y'){const y=B.move.base+o;
        B.mesh.position.y=y;B.min.y=y-1.8;B.max.y=y+1.8;}
      else{let x=B.move.base+o;
        if(B.move.limit)x=Math.max(-B.move.limit,Math.min(B.move.limit,x));
        B.mesh.position.x=x;B.min.x=x-2.1;B.max.x=x+2.1;}
    }
    if(B.max.z>p.z+220){scene.remove(B.mesh);beams.splice(i,1);continue;}
    if(segBox(prevP,p,B.min,B.max,2)){
      damage(24,'Pancaked against a trench crossbeam.');spark(p,0xffb300,16,30);
      S.vel.multiplyScalar(-.35);p.z=B.max.z+3;
    }else if(!B.passed&&p.z<B.min.z){          // cleared the beam plane — score a tight thread
      B.passed=true;
      const horiz=(B.max.x-B.min.x)>HALF_W;
      const clr=horiz?(p.y>=(B.min.y+B.max.y)/2?p.y-B.max.y:B.min.y-p.y)
                     :(p.x>=(B.min.x+B.max.x)/2?p.x-B.max.x:B.min.x-p.x);
      if(clr>2&&clr<8){                         // tight but clean → CLOSE CALL
        S.score+=40;S.shield=Math.min(100,S.shield+3);
        spawnPop(tmp.copy(p),'CLOSE +40','');sfx('near');
      }
    }
  }
  /* ----- roll gates ----- */
  S.buffT=Math.max(0,S.buffT-dt);
  let gateNear=false;
  for(let i=gates.length-1;i>=0;i--){const G=gates[i];
    if(G.z>p.z+220){scene.remove(G.group);gates.splice(i,1);continue;}
    const dz=p.z-G.z;
    if(!G.passed&&dz<120&&dz>0)gateNear=true;
    if(!G.passed&&dz<=0){
      G.passed=true;
      const dx=p.x, dy=p.y-G.cy, ca=Math.cos(-G.angle), sa=Math.sin(-G.angle);
      const lx=dx*ca-dy*sa, ly=dx*sa+dy*ca;
      const inSlot=Math.abs(lx)<G.L-1&&Math.abs(ly)<G.H-1;
      if(!inSlot){
        damage(26,'Smashed through a bulkhead outside the slot.');
        spark(p,0xff5500,22,34);S.vel.multiplyScalar(.55);
      }else{
        eul.setFromQuaternion(ship.quaternion,'YXZ');
        let dAng=Math.abs(eul.z-G.angle)%Math.PI;
        if(dAng>Math.PI/2)dAng=Math.PI-dAng;
        if(dAng<.45){
          S.buffT=6;S.shield=Math.min(100,S.shield+20);
          S.missiles=Math.min(MSL_MAX+curShip.mslBonus,S.missiles+1);
          spark(p,0x00f0ff,16,22);sfx('lock');
        }else{
          damage(10,'Clipped a wingtip on a roll gate.');spark(p,0xffb300,10,24);
        }
      }
    }
  }
  fr.gateNear=gateNear;
}
