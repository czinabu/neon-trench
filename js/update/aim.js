"use strict";
/* Update stage: gunnery aids and world-space HUD markers. */

/* impact point, enemy pips, objective marker, lead indicator, score popups, speed lines */
function updateAimAids(fr){
  const {dt,arena,p,distPort}=fr;
  /* ----- gunnery aids: projected impact point, enemy pips, lead indicator ----- */
  // projected impact point: where the gun bore meets the trench shell (capped at range).
  // arena has no trench walls — the old calc still solved against those invisible bounds
  // there, snapping the pip to a nonsense point. Project onto the arena boundary sphere instead.
  let impactDist;
  if(arena){
    const pDotF=p.dot(fwd), pLen2=p.lengthSq();
    impactDist=-pDotF+Math.sqrt(Math.max(0,pDotF*pDotF-(pLen2-ARENA_R*ARENA_R)));
    impactDist=Math.max(20,Math.min(1600,impactDist));
  }else{
    impactDist=1600;
    if(fwd.y<-1e-3)impactDist=Math.min(impactDist,(FLOOR_Y+2.2-p.y)/fwd.y);
    if(fwd.y>1e-3)impactDist=Math.min(impactDist,(TOP_Y-p.y)/fwd.y);
    if(fwd.x<-1e-3)impactDist=Math.min(impactDist,(-(HALF_W-2.2)-p.x)/fwd.x);
    if(fwd.x>1e-3)impactDist=Math.min(impactDist,(HALF_W-2.2-p.x)/fwd.x);
    if(fwd.z<-1e-3)impactDist=Math.min(impactDist,(-TRENCH_LEN-p.z)/fwd.z);
    impactDist=Math.max(20,impactDist);
  }
  if(S.cam==='fp'){
    sv1.copy(p).addScaledVector(fwd,impactDist).project(camera);
    if(sv1.z<1){pip0.style.display='block';
      pip0.style.left=((sv1.x*.5+.5)*innerWidth)+'px';pip0.style.top=((-sv1.y*.5+.5)*innerHeight)+'px';
    }else pip0.style.display='none';
  }else pip0.style.display='none';
  // enemy pips + world-space contact labels; also pick the nearest forward ship as lead-aim target
  const fmtD=d=>d<1000?Math.round(d)+'M':(d/1000).toFixed(1)+'KM';
  let pi=0,leadT=null,leadD=1e9;
  // pips only — the single text label lives on the locked target (via mslLock), keeping the centre clean
  const projPip=(E,type)=>{
    sv0.copy(E.mesh.position).project(camera);
    const el=getPip(pi);pi++;
    // the locked target wears the lock bracket instead of a pip — no doubled markers on it
    if(sv0.z<1&&Math.abs(sv0.x)<1.15&&Math.abs(sv0.y)<1.15&&E!==S.mslTarget){
      el.style.display='block';el.className='pip '+type;
      el.style.left=((sv0.x*.5+.5)*innerWidth)+'px';el.style.top=((-sv0.y*.5+.5)*innerHeight)+'px';
    }else el.style.display='none';
    if(type!=='turret'){tmp.copy(E.mesh.position).sub(p);const d=tmp.length();
      if(d<leadD&&tmp.normalize().dot(fwd)>.5){leadD=d;leadT=E;}}
  };
  fighters.forEach(E=>projPip(E,'ship'));
  bombers.forEach(E=>projPip(E,'heavy'));   // wall turrets get no pip — they're ambient, not targets
  for(;pi<pipPool.length;pi++)pipPool[pi].style.display='none';
  for(let li=0;li<labelPool.length;li++)labelPool[li].style.display='none'; // contact labels retired (decluttered)
  // reactor objective marker — trench only; small + dim, floated above the vanishing point
  const objZ=Math.max(-TRENCH_LEN,p.z-1500);
  sv0.set(0,(TOP_Y+FLOOR_Y)/2,objZ).project(camera);
  if(!arena&&S.mode==='play'&&sv0.z<1&&Math.abs(sv0.x)<1.2&&Math.abs(sv0.y)<1.2){
    objMark.style.display='block';
    objMark.style.left=((sv0.x*.5+.5)*innerWidth)+'px';objMark.style.top=((-sv0.y*.5+.5)*innerHeight-46)+'px';
    objDist.textContent=fmtD(distPort);
  }else objMark.style.display='none';
  // lead indicator: predicted intercept point so the pilot knows where to put the pipper
  S.leadTarget=leadT;
  let onTarget=false;
  if(leadT){
    const BS=720;let t=leadD/BS;                  // iterate the time-to-hit twice (matches bolt speed)
    sv1.copy(leadT.mesh.position).addScaledVector(leadT.wvel,t);t=sv1.distanceTo(p)/BS;
    sv1.copy(leadT.mesh.position).addScaledVector(leadT.wvel,t).project(camera);
    if(sv1.z<1){lead.style.display='block';
      lead.style.left=((sv1.x*.5+.5)*innerWidth)+'px';lead.style.top=((-sv1.y*.5+.5)*innerHeight)+'px';
      onTarget=Math.abs(sv1.x)<.05&&Math.abs(sv1.y)<.07; // bore lined up with the lead point
    }else lead.style.display='none';
  }else lead.style.display='none';
  cross.classList.toggle('hot',onTarget&&S.cam==='fp');
  lead.classList.toggle('hot',onTarget);

  /* ----- floating score popups (project world pos, rise + fade) ----- */
  for(let i=popups.length-1;i>=0;i--){const P=popups[i];
    P.life-=dt*1.1;
    const el=getPopEl(i);
    if(P.life<=0){el.style.display='none';popups.splice(i,1);continue;}
    sv0.copy(P.p).project(camera);
    if(sv0.z<1&&Math.abs(sv0.x)<1.1&&Math.abs(sv0.y)<1.1){
      el.style.display='block';el.className='pop '+P.cls;el.textContent=P.txt;
      el.style.left=((sv0.x*.5+.5)*innerWidth)+'px';
      el.style.top=((-sv0.y*.5+.5)*innerHeight-(1-P.life)*46)+'px'; // drift upward as it fades
      el.style.opacity=Math.min(1,P.life*1.6);
    }else el.style.display='none';
  }
  for(let i=popups.length;i<popPool.length;i++)popPool[i].style.display='none';
  /* ----- boost speed-lines (ramp with velocity, surge on boost) ----- */
  const spd=S.vel.length();
  const streak=Math.min(1,Math.max(0,(spd/MAX_SPD-0.55)/0.45))*(S.boost?1:.4);
  S.streakK=(S.streakK||0)+((streak-(S.streakK||0))*Math.min(1,8*dt));
  $('speed').style.opacity=(S.streakK*0.7).toFixed(3);
  fr.impactDist=impactDist;
}
