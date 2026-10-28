"use strict";
/* Trench set pieces: moments the run builds up to, laid by the spawn director instead of a plain crossbar.
   All three are entries in `beams`, so they hurt you like any crossbeam and every ship steers round them
   and is stopped by them (js/trenchnav.js).
     pipes     a run of fat pipes alternating high (thread under) and low (hop over)
     door      a blast door that slams shut as you close on it, then opens again: arrive on time
     collapse  girders that tear loose from the ceiling and drop across the trench as you close on them
   Tuning: the numbers at the top of each spawner. */

const doors=[];   // {top,bot,cy,z,t0}   top/bot are beams whose boxes move
const falls=[];   // beams with .fall={y0,yf,t0}
const DOOR_GAP=8, DOOR_TRIG=430, FALL_TRIG=330, FALL_T=.7;   // door half gap (m); metres out a door starts to close / a girder starts to drop; seconds a girder takes to fall

function pushBeam(mesh,min,max,extra){
  scene.add(mesh);const B=Object.assign({mesh,min,max,move:null,passed:false,horiz:true},extra);beams.push(B);return B;
}
/* lays one set piece at z; returns the metres to leave before the next hazard */
function spawnSetPiece(z){
  const r=Math.random();
  if(r<.34)return spawnPipes(z);
  if(r<.67)return spawnDoor(z);
  return spawnGirders(z);
}
function spawnPipes(z){
  const hi=TOP_Y-7, lo=FLOOR_Y+8;
  for(let i=0;i<4;i++){
    const y=i%2?lo:hi, zz=z-i*115;
    const g=new THREE.Group();
    g.add(new THREE.Mesh(sharedGeo('pipeBody',()=>new THREE.CylinderGeometry(2.6,2.6,HALF_W*2,10).rotateZ(Math.PI/2)),M.dark2));
    for(const x of [-12,12])g.add(new THREE.Mesh(sharedGeo('pipeBand',()=>new THREE.CylinderGeometry(2.8,2.8,1,10).rotateZ(Math.PI/2)),M.amber)).position.x=x;
    g.position.set(0,y,zz);
    pushBeam(g,new THREE.Vector3(-HALF_W,y-2.6,zz-2.6),new THREE.Vector3(HALF_W,y+2.6,zz+2.6));
  }
  return 4*115+120;
}
function spawnDoor(z){
  const cy=Math.max(FLOOR_Y+14,Math.min(TOP_Y-14,S.flowY)), H=40;
  const mk=top=>{
    const g=new THREE.Group();
    const slab=new THREE.Mesh(sharedGeo('doorSlab',()=>new THREE.BoxGeometry(HALF_W*2,H,3)),M.dark);slab.position.y=top?H/2:-H/2;g.add(slab);
    const edge=new THREE.Mesh(sharedGeo('doorEdge',()=>new THREE.BoxGeometry(HALF_W*2,.8,3.4)),M.mag);g.add(edge);
    g.position.set(0,cy+(top?DOOR_GAP:-DOOR_GAP),z);
    const y=g.position.y;
    return pushBeam(g,new THREE.Vector3(-HALF_W,top?y:y-H,z-1.5),new THREE.Vector3(HALF_W,top?y+H:y,z+1.5),{door:true});
  };
  doors.push({top:mk(true),bot:mk(false),cy,z,t0:-1,H});
  return 260;
}
function spawnGirders(z){
  for(let i=0;i<3;i++){
    spawnBeam(z-i*60,{horizontal:true,gapY:S.flowY,moving:false});
    const B=beams[beams.length-1], yf=B.mesh.position.y, y0=TOP_Y+9;
    B.fall={y0,yf,t0:-1};B.mesh.position.y=y0;B.min.y=y0-1.8;B.max.y=y0+1.8;falls.push(B);
  }
  return 2*60+250;
}
function clearSetPieces(){doors.length=falls.length=0;}
const setY=(B,y,h0,h1)=>{B.mesh.position.y=y;B.min.y=y-h0;B.max.y=y+h1;};
/* per frame: slide the doors, drop the girders you are closing on, forget what has gone by */
function updateSetPieces(fr){
  const p=fr.p;
  for(let i=doors.length-1;i>=0;i--){const D=doors[i];
    if(D.top.max.z>p.z+230){doors.splice(i,1);continue;}
    const d=p.z-D.z;
    if(D.t0<0&&d>0&&d<DOOR_TRIG){D.t0=S.time;sfx('boom',tmp.set(0,D.cy,D.z));}
    if(D.t0<0)continue;
    const t=S.time-D.t0, open=t<1?1-t:t<1.6?0:t<2.6?t-1.6:1, g=open*DOOR_GAP;
    setY(D.top,D.cy+g,0,D.H);setY(D.bot,D.cy-g,D.H,0);
    D.top.mesh.position.y=D.cy+g;D.bot.mesh.position.y=D.cy-g;
  }
  for(let i=falls.length-1;i>=0;i--){const B=falls[i],F=B.fall;
    if(B.max.z>p.z+230){falls.splice(i,1);continue;}
    const z=B.mesh.position.z;
    if(F.t0<0&&p.z-z>0&&p.z-z<FALL_TRIG){F.t0=S.time;sfx('boom',B.mesh.position);
      for(const x of [-HALF_W+2,HALF_W-2])spark(tmp.set(x,TOP_Y,z),0xffb300,12,30);}
    if(F.t0<0)continue;
    const u=Math.min(1,(S.time-F.t0)/FALL_T);
    setY(B,F.y0+(F.yf-F.y0)*u*u,1.8,1.8);
    if(u>=1){F.t0=-2;falls.splice(i,1);spark(tmp.set(B.mesh.position.x,F.yf,z),0xffb300,10,24);}
  }
}
