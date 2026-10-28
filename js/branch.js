"use strict";
/* Trench forks: now and then a solid divider splits the trench in two for FORK_LEN metres. One lane is the
   main run with its usual crossbars. The other is a narrow side channel, riskier (tighter pillars and a
   squeeze) but faster (boost pads) and with a bonus stash: pickups on a long timer and two caches to shoot.
   The divider is solid for every ship (js/trenchnav.js). Sizes are FORK_* in js/config.js. */

const dividers=[];   // {mesh,min,max}  solid walls down the middle of a fork
const forkPads=[];   // {mesh,z,lo,hi,hit}  floor pads in a side channel: fly over one for a burst of speed
const caches=[];     // {mesh,hp}  bonus targets hidden in a side channel

function spawnFork(z){
  const side=Math.random()<.5?-1:1, z1=z-FORK_LEN;
  const dMin=Math.min(side*FORK_DIV[0],side*FORK_DIV[1]), dMax=Math.max(side*FORK_DIV[0],side*FORK_DIV[1]);
  const main=side>0?[-HALF_W,dMin]:[dMax,HALF_W], chan=side>0?[dMax,HALF_W]:[-HALF_W,dMin];
  const cx=(chan[0]+chan[1])/2, fy=S.flowY, yLo=FLOOR_Y-5, yHi=TOP_Y+14;
  /* the divider: a plain slab (what you see is what stops you), neon on the main-lane face, amber on the channel's */
  const g=new THREE.Group(), w=dMax-dMin, h=yHi-yLo;
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,FORK_LEN),wallMat);g.add(body);
  for(const f of [-1,1]){                                  // f: which face
    const toChan=f===side;
    for(let k=0;k<3;k++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,FORK_LEN),toChan?M.amber:M.cyan);
      s.position.set(f*(w/2+.1),FLOOR_Y+6+k*14-(yLo+h/2),0);g.add(s);
    }
  }
  const nose=new THREE.Mesh(new THREE.BoxGeometry(w+.4,h,.6),M.mag);nose.position.z=FORK_LEN/2+.1;g.add(nose);   // lit front face: you see the split coming
  g.position.set((dMin+dMax)/2,yLo+h/2,(z+z1)/2);
  scene.add(g);
  dividers.push({mesh:g,min:new THREE.Vector3(dMin,yLo,z1),max:new THREE.Vector3(dMax,yHi,z)});
  /* main lane: a bar and a pillar, as any stretch of trench */
  spawnBeam(z-130,{horizontal:true,gapY:fy,moving:false,lane:main});
  spawnBeam(z-290,{horizontal:false,x:(main[0]+main[1])/2+(Math.random()-.5)*8,moving:false});
  /* side channel: pillars to weave, a squeeze, pads to speed you along */
  spawnBeam(z-110,{horizontal:false,x:cx,moving:false});
  spawnBeam(z-195,{horizontal:true,yc:Math.min(TOP_Y-4,fy+8.8),moving:false,lane:chan});
  spawnBeam(z-198,{horizontal:true,yc:Math.max(FLOOR_Y+5,fy-8.8),moving:false,lane:chan});
  spawnBeam(z-285,{horizontal:false,x:cx+side*1.5,moving:false});
  for(const dz of [30,230,FORK_LEN-30])spawnPad(z-dz,chan);
  for(const [dz,kind] of [[150,'shield'],[240,'missile'],[330,'score']])
    dropPickup(tmp.set(cx,fy,z-dz),kind,40);
  spawnCache(cx+5,fy+8,z-235);spawnCache(cx-5,fy-7,z-340);
  S.flowX=0;
}
function spawnPad(z,chan){
  const m=new THREE.Mesh(sharedGeo('forkPad',()=>new THREE.BoxGeometry(1,.3,14)),M.amber);
  const lo=chan[0]+2, hi=chan[1]-2;
  m.scale.x=hi-lo;m.position.set((lo+hi)/2,FLOOR_Y+.2,z);
  scene.add(m);forkPads.push({mesh:m,z,lo,hi});
}
function spawnCache(x,y,z){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(sharedGeo('cacheBox',()=>new THREE.BoxGeometry(2.4,2.4,2.4)),M.dark2));
  g.add(new THREE.Mesh(sharedGeo('cacheLit',()=>new THREE.BoxGeometry(2.7,.5,2.7)),M.amber));
  g.position.set(x,y,z);scene.add(g);caches.push({mesh:g,hp:2});
}
/* a shot at a cache: true if it was used up */
function hitCache(i){
  const C=caches[i];if(--C.hp>0){spark(C.mesh.position,0xffb300,6);return false;}
  burst(C.mesh.position,0xffb300,1.2);sfx('boom',C.mesh.position);
  S.score+=150;spawnPop(C.mesh.position,'CACHE +150','big');
  dropPickup(C.mesh.position,'missile');dropPickup(C.mesh.position,'shield');
  scene.remove(C.mesh);caches.splice(i,1);return true;
}
function clearBranch(){
  for(const D of dividers)scene.remove(D.mesh);
  for(const P of forkPads)scene.remove(P.mesh);
  for(const C of caches)scene.remove(C.mesh);
  dividers.length=forkPads.length=caches.length=0;
  S.padT=0;
}
/* does a shot from a to b hit a divider? (it is solid cover) */
function dividerHit(a,b){for(const D of dividers)if(segBox(a,b,D.min,D.max,0))return true;return false;}
/* per frame: recycle what is behind you, boost pads, and the fork's solid divider for your own ship */
function updateBranch(fr){
  const {dt,p,prevP}=fr;
  S.padT=Math.max(0,S.padT-dt);
  for(let i=dividers.length-1;i>=0;i--){const D=dividers[i];
    if(D.max.z>p.z+260){scene.remove(D.mesh);dividers.splice(i,1);continue;}
    if(trenchBox(prevP,p,S.vel,D,2.2)){
      if(S.time-S.bumpT>.4){S.bumpT=S.time;damage(9,'Scraped the fork divider.');}
      spark(p,0xffb300,8);
    }
  }
  for(let i=forkPads.length-1;i>=0;i--){const P=forkPads[i];
    if(P.z>p.z+260){scene.remove(P.mesh);forkPads.splice(i,1);continue;}
    if(!P.hit&&Math.abs(p.z-P.z)<9&&p.x>P.lo-2&&p.x<P.hi+2&&p.y<FLOOR_Y+14){
      P.hit=true;S.padT=PAD_T;sfx('lock');spark(p,0xffb300,10,24);}
  }
  for(let i=caches.length-1;i>=0;i--){const C=caches[i];
    C.mesh.rotation.y+=dt*.8;
    if(C.mesh.position.z>p.z+260){scene.remove(C.mesh);caches.splice(i,1);}
  }
}
