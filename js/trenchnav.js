"use strict";
/* Trench navigation: the obstacles every ship in the trench shares. Crossbeams, fork dividers and roll
   gates are solid for the enemy fighters and bombers just as they are for you. A ship is steered round
   them (trenchSteer bends the point it is flying for) and, as a last resort, stopped at them
   (trenchMove) so it can never end a frame inside one. The arena has its own version in js/arena.js. */

const TN_R=2.4;                       // clearance a fighter keeps from a surface, metres
const tnPrev=new THREE.Vector3(), tnT={x:0,y:0};

/* lateral limits a ship may steer to, inside the walls, floor and ceiling */
const tnLimX=r=>HALF_W-r-.3, tnLimLo=r=>FLOOR_Y+r+2, tnLimHi=()=>ceilY()-3;

/* bend `t` (the x/y a ship is flying for) so it keeps clear of every solid it will meet in the next stretch of
   trench. A ship already clear of a bar stays on its side of it; one in the bar's path goes to the nearer way round. */
function trenchSteer(pos,vz,r,t){
  const dir=vz>1?1:-1, L=Math.abs(vz)*.9+70;
  for(const list of [beams,dividers]){
    for(const B of list){
      const mn=B.min,mx=B.max;
      const dist=dir<0?pos.z-mx.z:mn.z-pos.z;
      if(dist>L||(dir<0?pos.z<mn.z-r:pos.z>mx.z+r))continue;      // too far off, or already past it
      const tall=mx.x-mn.x<HALF_W*2-2&&mx.y-mn.y>30, m=r+1.6+(B.move||B.door||B.fall?2.5:0);              // a pillar or divider: go round sideways; a bar: over or under
      const k=tall?'x':'y', o=tall?'y':'x';
      if(pos[o]<mn[o]-m-r||pos[o]>mx[o]+m+r)continue;               // a short bar in another lane
      const lo=mn[k]-m, hi=mx[k]+m;
      const limLo=tall?-tnLimX(r):tnLimLo(r), limHi=tall?tnLimX(r):tnLimHi();
      const cur=pos[k];
      if(cur>lo&&cur<hi){                                            // in its path: take the nearer way round that has room
        const a=lo-.5, b=hi+.5, okA=a>=limLo, okB=b<=limHi;
        t[k]=okA&&okB?(cur-a<b-cur?a:b):okA?a:okB?b:(lo-limLo>limHi-hi?a:b);
      }else if(cur<=lo)t[k]=Math.min(t[k],lo-.5);                    // stay on this side
      else t[k]=Math.max(t[k],hi+.5);
    }
  }
  for(const G of gates){                                             // a roll gate: through the middle of its slot
    const dist=dir<0?pos.z-G.z:G.z-pos.z;
    if(dist>L||dist<-r)continue;
    t.x=0;t.y=G.cy;
  }
  t.x=Math.max(-tnLimX(r),Math.min(tnLimX(r),t.x));
  t.y=Math.max(tnLimLo(r),Math.min(tnLimHi(),t.y));
}

const TN_AX=['x','y','z'];
/* a ship moved prev→pos: if the path went into box B (grown by r), put it back on the face it came in by */
function trenchBox(prev,pos,vel,B,r){
  if(!segBox(prev,pos,B.min,B.max,r))return false;
  let ax='z',best=-1e9,sgn=1;
  for(const k of TN_AX){                                             // the face it entered by: the axis it was furthest outside on
    const dLo=B.min[k]-r-prev[k], dHi=prev[k]-B.max[k]-r, d=Math.max(dLo,dHi);
    if(d>best){best=d;ax=k;sgn=dLo>dHi?-1:1;}
  }
  pos[ax]=sgn<0?B.min[ax]-r-.05:B.max[ax]+r+.05;
  if(vel&&vel[ax]*sgn<0)vel[ax]=0;
  return true;
}
/* a roll gate is a bulkhead with one slot: crossing its plane anywhere else is blocked */
function trenchGate(prev,pos,vel,G,r){
  const a=prev.z-G.z, b=pos.z-G.z;
  if(a*b>0||a===b)return false;
  const t=a/(a-b), x=prev.x+(pos.x-prev.x)*t, y=prev.y+(pos.y-prev.y)*t-G.cy;
  const ca=Math.cos(-G.angle), sa=Math.sin(-G.angle), lx=x*ca-y*sa, ly=x*sa+y*ca, rr=r*.6;
  if(Math.abs(lx)<G.L-rr&&Math.abs(ly)<G.H-rr)return false;
  pos.z=G.z+(a>=0?1:-1)*(1.2+rr);
  if(vel)vel.z=0;
  return true;
}
/* after a ship has moved prev→pos: walls, floor and ceiling, then every solid. Returns true if anything stopped it. */
function trenchMove(pos,prev,vel,r){
  let hit=false;
  const lx=tnLimX(r)+.1;
  if(Math.abs(pos.x)>lx){pos.x=Math.sign(pos.x)*lx;if(vel&&vel.x*pos.x>0)vel.x=0;hit=true;}
  if(pos.y<FLOOR_Y+r){pos.y=FLOOR_Y+r;if(vel&&vel.y<0)vel.y=0;hit=true;}
  if(pos.y>tnLimHi()+1){pos.y=tnLimHi()+1;if(vel&&vel.y>0)vel.y=0;hit=true;}
  for(const B of beams)if(trenchBox(prev,pos,vel,B,r))hit=true;
  for(const D of dividers)if(trenchBox(prev,pos,vel,D,r))hit=true;
  for(const G of gates)if(trenchGate(prev,pos,vel,G,r))hit=true;
  return hit;
}
/* does the segment a→b run into a beam or divider? (homing missiles burst on them) */
function trenchSegHit(a,b,r){
  for(const B of beams)if(segBox(a,b,B.min,B.max,r))return true;
  for(const D of dividers)if(segBox(a,b,D.min,D.max,r))return true;
  return false;
}
