"use strict";
/* The debrief screen's payoff (openDebrief in js/menus.js fills it):
   - the ledger: every objective with its reward beside it, the base payout on the primary objective, any repeat cut, and a total that adds up
   - the rank: S / A / B / C from bonuses met, hull, best combo and time against the op's par (DEBRIEF in js/config.js)
   - the tally: score and credits count up, each objective checks off with a tone, then the rank stamps in (any click or key skips it)
   - the outro: behind the panel the live scene keeps going. A trench run climbs out over the station and off into the sky, then
     the view settles on the reactor burning below; a battle flies out to HALCYON, parked well clear of the fight, and lands in
     its bay; a lost run shows the wreck smouldering */

/* ---- rank ---- */
const RANK_ORDER=['C','B','A','S'];
/* the op's par time in seconds: its own `par`, else its time bonus, else a rough one from the run's length or kill count;
   a timed hold (survive) and a fleet battle have none */
function debriefPar(m){
  if(m.par)return m.par;
  const tb=(m.bonuses||[]).find(b=>b.type==='time');if(tb)return tb.val;
  if(m.sector==='trench')return Math.round((m.interior?INTERIOR_LEN:TRENCH_LEN)/DEBRIEF.parSpeed);
  if(m.count&&!m.fleet)return m.count*DEBRIEF.parKill+30;
  return 0;
}
/* parts of the grade, each 0..1, with their weights; time drops out when the op has no par */
function debriefRank(m,bonuses){
  const D=DEBRIEF,par=m.survive?0:debriefPar(m);
  const met=bonuses.filter(b=>b.met).length;
  const parts=[
    {k:'Bonuses',v:bonuses.length?met/bonuses.length:1,w:D.wBonus,t:met+'/'+bonuses.length},
    {k:'Hull',v:Math.max(0,Math.min(1,S.hull/100)),w:D.wHull,t:Math.max(0,Math.round(S.hull))+'%'},
    {k:'Combo',v:Math.min(1,(S.comboMax||0)/D.comboGoal),w:D.wCombo,t:'x'+(S.comboMax||0)},
  ];
  if(par)parts.push({k:'Time',v:S.time<=par?1:Math.max(0,1-(S.time-par)/(par*D.timeSlack)),w:D.wTime,t:'par '+fmtClock(par)});
  const W=parts.reduce((n,p)=>n+p.w,0),pts=parts.reduce((n,p)=>n+p.v*p.w,0)/W*100;
  const g=pts>=D.S?'S':pts>=D.A?'A':pts>=D.B?'B':'C';
  return {g,pts,parts};
}
const fmtClock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const crTxt=(cr,pt)=>[cr?'+'+cr.toLocaleString()+' cr':'',pt?'+'+plural(pt,'part'):''].filter(Boolean).join(' · ')||'—';

/* ---- the ledger: rows {ok, label, cr, pt, kind} that add up to the payout ---- */
function debriefLedger(m,win,bonuses,credits,parts,bet){
  const rows=[],base=win?m.reward.credits||0:0;
  rows.push({ok:win,label:m.objective,cr:base,pt:win?parts:0,kind:win?'met':'fail',
    note:win?'Payout':''});
  bonuses.forEach(b=>rows.push({ok:b.met,label:b.label,cr:b.met?b.credits||0:0,want:b.credits||0,kind:b.met?'met':'miss'}));
  if(win){
    const gross=base+bonuses.reduce((n,b)=>n+(b.met?b.credits||0:0),0),cut=gross-credits;
    if(cut>0)rows.push({ok:true,label:'Repeat clear · half pay, no parts',cr:-cut,kind:'cut'});
  }
  if(bet)rows.push({ok:bet.won,label:bet.who+'\'s bet · '+bet.b.label,cr:bet.won?bet.b.credits||0:0,pt:bet.won?bet.b.parts||0:0,
    want:bet.b.credits||0,kind:bet.won?'met':'miss',bet:true});
  return rows;
}
function ledgerRowHtml(r,i){
  const icon=r.kind==='fail'?'✕':r.kind==='cut'?'−':r.ok?'✓':'·';
  const val=r.kind==='cut'?'−'+(-r.cr).toLocaleString()+' cr':r.ok?crTxt(r.cr,r.pt):r.want?'+'+r.want.toLocaleString()+' cr':'';
  return '<div class="dbl '+r.kind+(r.bet?' bet':'')+'" data-i="'+i+'"><span class="ic">'+icon+'</span><span class="lb">'+r.label+'</span>'
    +'<span class="ld"></span><i>'+val+'</i></div>';
}

/* ---- the tally: counts the numbers up and ticks the rows off, then stamps the rank ---- */
let DBT=null;   // {raf, done, finish()} while the debrief is counting
function debriefTally(o){
  debriefTallyStop();
  const quick=reduceMotion;
  const rows=[...dbObj.querySelectorAll('.dbl')],score=dbStats.querySelector('b'),sumCr=dbReward.querySelector('.sumcr'),sumPt=dbReward.querySelector('.sumpt');
  const T={t:0,done:false,ri:-1,cr:0,pt:0,lastTick:0};DBT=T;
  const SCORE_T=.9,ROW_T=.32,row0=SCORE_T+.15;
  const end=row0+rows.length*ROW_T+.2;
  rows.forEach(r=>r.classList.add('pend'));
  if(o.rank){dbRank.classList.add('pend');dbBars.classList.add('pend');}
  const setSum=()=>{if(sumCr)sumCr.textContent=(T.cr<0?'−':'+')+Math.abs(Math.round(T.cr)).toLocaleString()+' cr';
    if(sumPt)sumPt.textContent='+'+plural(Math.round(T.pt),'part');};
  const showRow=i=>{const r=rows[i],L=o.rows[+r.dataset.i];r.classList.remove('pend');r.classList.add('in');
    if(L){T.cr+=L.ok?L.cr||0:0;T.pt+=L.ok?L.pt||0:0;}
    sfx(L&&L.ok&&L.kind!=='cut'?'dbcheck':'dbmiss',null,i);};
  T.finish=()=>{if(T.done)return;T.done=true;cancelAnimationFrame(T.raf);
    if(score)score.textContent=o.score.toLocaleString();
    rows.forEach(r=>{r.classList.remove('pend');r.classList.add('in');});
    T.cr=o.credits;T.pt=o.parts;setSum();
    if(o.rank){for(const e of [dbRank,dbBars]){e.classList.remove('pend');e.classList.add('in');}if(!quick)sfx('dbrank');}
    debriefSkipOff();
  };
  if(quick||!o.win){T.finish();return;}
  if(score)score.textContent='0';T.cr=0;T.pt=0;setSum();
  let last=performance.now();
  const step=now=>{
    T.t+=Math.max(0,(now-last)/1000);last=now;   // real time, so a slow frame rate doesn't drag the tally out
    if(score){const k=Math.min(1,T.t/SCORE_T),e=1-Math.pow(1-k,3);score.textContent=Math.round(o.score*e).toLocaleString();
      if(k<1&&T.t-T.lastTick>.055){T.lastTick=T.t;sfx('dbtally');}}
    const ri=Math.floor((T.t-row0)/ROW_T);
    while(T.ri<Math.min(ri,rows.length-1)){T.ri++;showRow(T.ri);}
    setSum();
    if(T.t>=end){T.finish();return;}
    T.raf=requestAnimationFrame(step);
  };
  T.raf=requestAnimationFrame(step);
  setTimeout(debriefSkipOn,120);   // the click that ended the run doesn't skip it
}
function debriefTallyStop(){if(DBT){cancelAnimationFrame(DBT.raf);DBT.done=true;DBT=null;}debriefSkipOff();}
const debriefSkip=e=>{if(DBT&&!DBT.done&&!$('debrief').classList.contains('hidden')){DBT.finish();if(e&&e.type==='keydown')e.stopPropagation();}};
function debriefSkipOn(){addEventListener('pointerdown',debriefSkip,true);addEventListener('keydown',debriefSkip,true);}
function debriefSkipOff(){removeEventListener('pointerdown',debriefSkip,true);removeEventListener('keydown',debriefSkip,true);}

/* the rank badge (beside the title) and the bars for what earned it (under the stats) */
function debriefRankHtml(R,best){
  return '<div class="rk rk'+R.g+'"><small>Rank</small><b>'+R.g+'</b></div>'+(best?'<div class="rkbest">'+best+'</div>':'');
}
const debriefBarsHtml=R=>R.parts.map(p=>'<div><span>'+p.k+'<small>'+p.t+'</small></span><i><em style="width:'+Math.round(p.v*100)+'%"></em></i></div>').join('');
/* the line over the buttons that points you back aboard between ops */
function debriefNudge(win,spend){
  if(!win)return 'Regroup aboard HALCYON. The crew will patch you up.';
  const hurt=dockHurt().length,bits=[];
  if(spend)bits.push('upgrades in reach');
  if(hurt)bits.push(plural(hurt,'ship')+' to repair');
  return 'The deck crew want to hear how it went'+(bits.length?' · '+bits.join(' · '):'');
}
/* a clean reset of the extras, for screens that reuse the debrief (the skirmish result) */
function debriefPlain(){
  debriefTallyStop();dbRank.innerHTML='';dbRank.className='dbrank';dbBars.innerHTML='';dbBars.className='rkbars';dbNudge.textContent='';
  debrief.classList.remove('outro');
}

/* ---- the outro: the run's scene keeps playing behind the panel ---- */
let OUTRO=null;
const outroV=new THREE.Vector3(),outroV2=new THREE.Vector3(),outroV3=new THREE.Vector3(),outroM=new THREE.Matrix4(),outroQ=new THREE.Quaternion();
const outroBez=(t,a,b,c,d,out)=>{const u=1-t;return out.set(0,0,0).addScaledVector(a,u*u*u).addScaledVector(b,3*u*u*t).addScaledVector(c,3*u*t*t).addScaledVector(d,t*t*t);};
/* HALCYON for the homecoming, built for the outro and parked well clear of the fight: out past where you are, at least
   OUTRO_SAFE metres from the battle, its bow turned back toward you. The carrier from the fight (if any) is hidden meanwhile,
   so there is only one. It never joins the capitals list and outroStop takes it down again. */
const OUTRO_SAFE=1800;
function outroCarrier(O){
  const p=ship.position,K=carrierShip();
  if(K){K.g.visible=false;O.hidK=K;}
  // the middle of the fight: the wreck, else the enemy still about, else just behind you
  const c=new THREE.Vector3();let n=0;
  if(O.wreck){c.copy(O.wreck);n=1;}
  else{for(const C of capitals)if(!C.friendly){c.add(C.g.position);n++;}
    for(const F of fighters)if(F.mesh){c.add(F.mesh.position);n++;}
    if(n)c.multiplyScalar(1/n);}
  const f=outroV.set(0,0,-1).applyQuaternion(ship.quaternion);f.y=0;if(f.lengthSq()<.01)f.set(0,0,-1);f.normalize();
  if(!n)c.copy(p).addScaledVector(f,-400);
  const away=new THREE.Vector3().subVectors(p,c);away.y=0;
  if(away.lengthSq()<100)away.copy(f);away.normalize();
  const mouth=c.clone().addScaledVector(away,Math.max(OUTRO_SAFE,c.distanceTo(p)+900));mouth.y=p.y+40;
  const hdg=away.clone().negate();   // its bow (and bay mouth) turned back toward you
  const C=capNew('carrier',fleetCarrierType(),true);
  C.g.position.copy(mouth).addScaledVector(hdg,-130);C.g.lookAt(outroV2.copy(C.g.position).sub(hdg));
  scene.add(C.g);C.g.updateMatrixWorld(true);O.temp=C;
  return C;
}
const outroLen=path=>{let len=0;const a=new THREE.Vector3(),b=path[0].clone();
  for(let i=1;i<=24;i++){outroBez(i/24,...path,a);len+=a.distanceTo(b);b.copy(a);}return len;};
function outroStart(win){
  const p=ship.position,trench=S.sector==='trench'&&!S.interior;
  const O={t:0,win,trench,boomT:.5,wreck:null,cam:new THREE.Vector3(),look:new THREE.Vector3().copy(p)};
  // where it all went up: a capital breaking apart, the trench's reactor, or the ship you just flew out of
  const C=capitals.find(c=>!c.friendly&&(c.state==='dying'||c.dead))||capitals.find(c=>c.state==='dying');
  if(trench&&win)O.wreck=new THREE.Vector3(0,0,-S.runLen+3);
  else if(S.interior&&win)O.wreck=new THREE.Vector3(p.x,p.y,-60);
  else if(C)O.wreck=(C.core?C.core.mesh.position:C.g.position).clone();
  shipVis.quaternion.identity();
  O.side=Math.random()<.5?-1:1;
  const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(ship.quaternion),up=new THREE.Vector3(0,1,0);
  if(!win){O.wreck=p.clone();shipVis.visible=false;O.cam.set(18,8,22).applyQuaternion(ship.quaternion).add(p);}   // shot down: what's left of you burns where it fell
  else if(trench){
    /* out of the city: pull up out of the trench, bank round and head back over the slab, away from the reactor going up */
    const f=fwd.clone();f.y=0;f.normalize();const sd=new THREE.Vector3(-f.z,0,f.x).multiplyScalar(O.side);
    O.path=[p.clone(),p.clone().addScaledVector(f,240).addScaledVector(up,110),p.clone().addScaledVector(f,90).addScaledVector(sd,300).addScaledVector(up,210),
      p.clone().addScaledVector(f,-380).addScaledVector(sd,230).addScaledVector(up,250)];
    O.len=outroLen(O.path);O.dur=Math.max(5,Math.min(8,O.len/150));O.up=up;
    O.exit=f.clone().negate().addScaledVector(up,.45).normalize();   // and on, climbing up out of the sky and into the distance
    O.cam.copy(p).addScaledVector(fwd,-24).addScaledVector(up,7);
  }else{
    /* the homecoming: out of the fight on a curve to the line in front of HALCYON's bow, then down the bay to the deck */
    const K=outroCarrier(O);
    const hdg=new THREE.Vector3(0,0,-1).applyQuaternion(K.g.quaternion);up.set(0,1,0).applyQuaternion(K.g.quaternion);
    const mouth=K.g.localToWorld(new THREE.Vector3(0,2,-130)),deck=K.g.localToWorld(new THREE.Vector3(0,1,-92));
    const d=p.distanceTo(mouth);
    O.path=[p.clone(),p.clone().addScaledVector(fwd,Math.min(260,d*.25)),mouth.clone().addScaledVector(hdg,Math.min(520,d*.4)),mouth];
    O.len=outroLen(O.path);O.dur=Math.max(5,Math.min(9,O.len/170));O.deck=deck;O.mouth=mouth;O.hdg=hdg;O.up=up;O.land=true;
    O.cam.copy(p).addScaledVector(fwd,-26).addScaledVector(up,8);
    O.dock=mouth.clone().addScaledVector(hdg,34).add(new THREE.Vector3(O.side*24,0,0).applyQuaternion(K.g.quaternion)).addScaledVector(up,7);   // where the camera waits to watch it come in
  }
  OUTRO=O;debrief.classList.add('outro');
}
function outroStop(){if(!OUTRO)return;
  if(OUTRO.temp){scene.remove(OUTRO.temp.g);freeGeo(OUTRO.temp.g);}
  if(OUTRO.hidK)OUTRO.hidK.g.visible=true;
  OUTRO=null;camera.clearViewOffset();shipVis.visible=true;debrief.classList.remove('outro');}
/* per frame (js/loop.js), only while the debrief is up after a run */
function outroTick(dt){
  const O=OUTRO;
  if(S.mode==='play'||S.mode==='menu'||$('debrief').classList.contains('hidden')){outroStop();return;}
  O.t+=dt;const p=ship.position;
  if(O.win){
    const k=Math.min(1,O.t/O.dur),dir=outroV;
    if(k<1){
      const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;   // ease in and out along the approach
      outroBez(e,...O.path,p);outroBez(Math.min(1,e+.01),...O.path,outroV2);dir.subVectors(outroV2,p);
      if(dir.lengthSq()<1e-6)dir.copy(O.exit||outroV2.copy(O.hdg).negate());
    }else if(O.land){
      // in through the mouth, slowing to a stop over the deck
      const t2=Math.min(1,(O.t-O.dur)/2),e2=1-Math.pow(1-t2,3);
      p.lerpVectors(O.mouth,O.deck,e2);dir.copy(O.hdg).negate();
      if(t2>=1&&!O.landed){O.landed=true;sfx('dbcheck',null,0);}
    }else{p.addScaledVector(O.exit,150*dt);dir.copy(O.exit);}   // out of the city: on into the distance
    outroM.lookAt(p,outroV2.copy(p).add(dir),O.up);ship.quaternion.slerp(outroQ.setFromRotationMatrix(outroM),1-Math.exp(-5*dt));
    // the camera rides behind until the approach line, then waits off the bow and watches you come in
    if(!O.cdir)O.cdir=dir.clone().normalize();
    O.cdir.lerp(dir.normalize(),1-Math.exp(-4*dt)).normalize();   // a smoothed heading, so the chase view doesn't snap through the turns
    if(O.land){O.chase=k<.62;
      if(O.chase)O.cam.copy(p).addScaledVector(O.cdir,-22).addScaledVector(O.up,6);
      else O.cam.lerp(O.dock,1-Math.exp(-1.4*dt));
    }else{
      // out of the city: the camera swings from behind round to the ship's flank and ahead, so the trench and the blasts
      // fall in behind it, then holds there while the ship climbs away into the distance
      O.chase=k<1;
      if(O.chase){const sm=k*k*(3-2*k),ang=sm*2.1,D=22+sm*26;
        outroV2.crossVectors(O.cdir,O.up).normalize().multiplyScalar(O.side*Math.sin(ang)*D);
        O.cam.copy(p).addScaledVector(O.cdir,-Math.cos(ang)*D).add(outroV2).addScaledVector(O.up,6+sm*6);}
    }
  }else{
    const a=dt*.12;outroV2.subVectors(O.cam,p);outroV2.applyAxisAngle(THREE.Object3D.DefaultUp,a);O.cam.copy(p).add(outroV2);
  }
  if(O.win&&O.chase)O.look.copy(p);
  else if(O.win&&!O.land&&O.wreck&&O.t>O.dur+2)O.look.lerp(O.wreck,1-Math.exp(-.8*dt));   // the ship gone, the view settles back on the city burning below
  else O.look.lerp(p,1-Math.exp(-6*dt));   // the chase view keeps the ship dead centre through the turns
  camera.position.copy(O.cam);camera.lookAt(O.look);
  // the target keeps burning
  if(O.wreck){O.boomT-=dt;
    if(O.boomT<=0){
      const far=Math.min(2.2,Math.max(1,O.wreck.distanceTo(camera.position)/160)),r=O.win?40*Math.min(far,3):6;   // far off, the blasts grow so they still read
      O.boomT=O.win?.35+Math.random()*.6:.8+Math.random()*1.2;
      const q=outroV2.copy(O.wreck).add(outroV.set((Math.random()-.5)*r,(Math.random()-.5)*r*.6,(Math.random()-.5)*r));
      const col=Math.random()<.5?0xff7733:0xffb300;
      if(O.win)burst(q,col,(1.4+Math.random()*1.6)*far);else fireball(q,col,.5+Math.random()*.5);   // your own wreck smoulders, it doesn't blast
      spark(q,0xffb300,O.win?10:5,O.win?30*far:12);puff(q,O.win?3:2);}}
  frame.dt=dt;frame.p=p;updateParticles(frame);
  const wide=innerWidth>=900,w=innerWidth,h=innerHeight;
  if(wide)camera.setViewOffset(w,h,-.2*w,0,w,h);else camera.clearViewOffset();
}
