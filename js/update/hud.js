"use strict";
/* Update stage: HUD. */

/* HUD readouts, gauges, cockpit instruments, warnings */
function updateHud(fr){
  const {dt,arena,p,gateNear,distPort,impactDist}=fr;
  /* ----- HUD ----- */
  spdV.textContent=String(Math.round(S.vel.length())).padStart(3,'0')+' ';
  spdV.insertAdjacentHTML('beforeend','<span style="font-size:9px">m/s</span>');
  thrB.style.width=Math.round(Math.abs(S.throttle)*100)+'%';
  shB.style.width=S.shield+'%';huB.style.width=S.hull+'%';
  distV.textContent=S.school?'':arena?(S.surviveTime>0?Math.max(0,Math.ceil(S.surviveTime-S.time))+'s LEFT':(S.kills>=S.arenaTarget&&S.capMode&&!S.capDown?'DESTROY '+S.capName:S.kills+' / '+S.arenaTarget+' DOWN')):(Math.round(distPort)+' m');
  killV.textContent=S.kills;
  mslV.textContent=S.missiles;
  scoreV.textContent=S.score.toLocaleString();
  comboV.textContent='x'+Math.max(1,S.combo);
  railF.style.width=(arena?(S.surviveTime>0?Math.min(100,S.time/S.surviveTime*100):Math.min(100,S.kills/S.arenaTarget*100)):Math.min(100,(1-distPort/S.runLen)*100))+'%';
  /* ----- flight readouts (shown in BOTH cockpit and chase) ----- */
  cockSpdV.textContent=String(Math.round(S.vel.length())).padStart(3,'0');
  cockMslV.textContent=S.missiles+'/'+(MSL_MAX+curShip.mslBonus);
  cockMsl.classList.toggle('empty',S.missiles<=0);
  hudModeV.textContent=S.model==='arcade'?'ARCADE':'REALISTIC';
  hudMode.className=S.model==='arcade'?'':'real';
  // throttle gauge: fill up for forward, down (magenta) for reverse, from the centre tick
  const tF=thrGaugeF.style,tv=S.throttle;
  tF.height=(Math.abs(tv)*50)+'%';
  if(tv>=0){tF.bottom='50%';tF.background='var(--amber)';tF.boxShadow='0 0 8px var(--amber)';}
  else{tF.bottom=(50-Math.abs(tv)*50)+'%';tF.background='var(--mag)';tF.boxShadow='0 0 8px var(--mag)';}
  // boost energy gauge — fills bottom-up, reddens when nearly spent / recharging
  {const low=S.boostE<25;
   boostGF.style.height=S.boostE.toFixed(0)+'%';
   boostGF.style.background=S.boostLock?'#ff4d4d':low?'#ff9d3d':'var(--amber)';
   boostGF.style.boxShadow='0 0 8px '+(S.boostLock?'#ff4d4d':low?'#ff9d3d':'var(--amber)');}
  csBoost.textContent=S.boostLock?'RECHG':S.boost?'ON':Math.round(S.boostE)+'%';csBoost.className=S.boost?'hot':'';
  csZoom.textContent=S.zoomK>.5?'ON':'—';
  csMsl.textContent=S.missiles;
  csCm.textContent=S.cm>0?S.cm:'RECHG';csCm.className=(S.mslWarnD<650||S.lockWarn)&&S.cm>0?'hot':'';
  csImp.textContent=Math.round(impactDist)+'m';
  const tg=S.target||S.mslTarget;
  csTgt.textContent=tg?(isTurret(tg)?'TURRET':(S.target?targetName(tg):'SHIP')+' '+Math.round(tg.mesh.position.distanceTo(p))+'m'):'—';
  csTgt.className=tg&&!isTurret(tg)?'hot':'';
  csSnd.textContent=S.muted?'OFF':'ON';
  /* ----- cockpit flight HUD (thin bar gauges either side of the reticle) ----- */
  if(S.cam==='fp'){
    const vmax=MAX_SPD*curShip.spdMul*BOOST_MULT, spd=S.vel.length();
    fpSpd.textContent=Math.round(spd);
    fpSpdF.style.height=Math.min(100,spd/vmax*100).toFixed(1)+'%';
    fpThr.style.bottom=(Math.max(0,S.throttle)/BOOST_MULT*100).toFixed(1)+'%';   // throttle setting as a tick on the speed bar
    fpBstF.style.height=S.boostE.toFixed(0)+'%';fpBstF.parentNode.classList.toggle('low',S.boostLock||S.boostE<25);
    fpBst.textContent=S.boostLock?'RCHG':Math.round(S.boostE)+'%';
    fpWpn.textContent=hudWpnV.textContent;fpWpn.classList.toggle('msl',S.mslMode);
    fpMsl.textContent='MSL '+S.missiles+'/'+(MSL_MAX+curShip.mslBonus);fpMsl.classList.toggle('empty',S.missiles<=0);
    fpMode.textContent=S.model==='arcade'?'ARCADE':'REALISTIC';fpMode.classList.toggle('real',S.model!=='arcade');
    fpCm.textContent=csCm.textContent;fpCm.className=csCm.className;
    fpZoom.textContent=csZoom.textContent;
    fpTgt.textContent=S.target?targetName(S.target)+' '+Math.round(S.target.mesh.position.distanceTo(p))+'M':'—';fpTgt.className=S.target?'hot':'';
  }
  /* ----- physical cockpit instruments (FP only): ADI, hands, proximity, warning lights ----- */
  if(S.cam==='fp'){
    eul.setFromQuaternion(ship.quaternion,'YXZ');
    const pitchDeg=eul.x*57.2958, rollDeg=eul.z*57.2958;
    cockpitAnim(dt);
    adiBall.style.transform='rotate('+(-rollDeg).toFixed(1)+'deg) translateY('+(pitchDeg*2).toFixed(1)+'px)';
    if(stickPivot){
      stickPivot.rotation.x += (S.cursor.y*.55+S.fireKick*.18 - stickPivot.rotation.x)*Math.min(1,16*dt);
      stickPivot.rotation.z += (-S.cursor.x*.55 - stickPivot.rotation.z)*Math.min(1,16*dt);
    }
    if(throttleLever){
      const tz=.06-S.throttle*.20;
      throttleLever.position.z += (tz-throttleLever.position.z)*Math.min(1,12*dt);
      throttleLever.rotation.x = -S.throttle*.18;
    }
    const pv=(dist,thr)=>Math.max(0,Math.min(1,1-dist/thr));
    const setPx=(el,v)=>{el.style.width=(v*100).toFixed(0)+'%';
      el.style.background=v>.66?'#ff2d78':v>.4?'#ffb300':'#00f0ff';
      el.style.boxShadow='0 0 6px '+(v>.66?'#ff2d78':v>.4?'#ffb300':'#00f0ff');};
    const pCeil=pv(ceilY()-p.y,18), pFloor=pv(p.y-(FLOOR_Y+2.2),18),
          pWL=pv(p.x-(-(HALF_W-2.2)),16), pWR=pv((HALF_W-2.2)-p.x,16);
    setPx(pxCeil,pCeil);setPx(pxFloor,pFloor);setPx(pxWallL,pWL);setPx(pxWallR,pWR);
    wlShield.classList.toggle('on',S.shield<30);
    wlHull.classList.toggle('on',S.hull<35);
    wlProx.classList.toggle('on',pCeil>.78||pFloor>.78||pWL>.78||pWR>.78||(!S.interior&&p.y>TOP_Y-6));
  }
  tutUpdate(dt);
  schoolFrame();if(SCH)schoolUpdate(dt);
  if(S.annT>0){S.annT-=dt;ann.style.opacity=Math.min(1,S.annT/.5).toFixed(2);}
  clock.textContent='T+'+String(Math.floor(S.time/60)).padStart(2,'0')+':'+String(Math.floor(S.time%60)).padStart(2,'0');
  if(S.buffT>0){buff.style.display='block';buff.style.color='';
    buff.textContent='Overdrive +1 MSL '+S.buffT.toFixed(1)+'s';}
  else if(gateNear){buff.style.display='block';buff.style.color='#ff2d78';
    buff.textContent='Roll gate — match the slot';}
  else buff.style.display='none';
  cursor.style.transform=`translate(calc(-50% + ${S.cursor.x*120}px), calc(-50% + ${S.cursor.y*120}px))`;
}
