"use strict";
/* Flight school: the academy range and the graded drills (lesson data is in js/data/school.js, the controls
   tour is in js/tutorial.js). A drill is timed from "go", penalties add to the clock, and the time sets a
   grade (par = A, B, C; slower is a fail). Best grades are saved in PROG.school. */

const SCHOOL_R=2300, SCHOOL_GROUND=-160;   // range radius, and the airfield deck far below the course
const GATE_COL={norm:0x0030c8,fast:0xa00058,slow:0x007a34,cur:0xe04800,cur2:0xff7000};   // dark inputs on purpose: the renderer lifts basic colours a lot, so light ones wash out to white
let SCH=null;   // {L, ready, t, pen, i, gates[], drones[], msg, msgT, endT, result, last}
let schoolEnv=null,schoolSky=null;
const schoolLesson=()=>SCHOOL_LESSONS.find(l=>l.id===S.school)||SCHOOL_LESSONS[0];
const GRADE_RANK={'✓':1,C:1,B:2,A:3};

/* ---------- the academy range (built once, shown only in flight school) ---------- */
function schoolSignTex(text,sub){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');
  g.fillStyle='#07101c';g.fillRect(0,0,1024,256);g.strokeStyle='#00f0ff';g.lineWidth=8;g.strokeRect(10,10,1004,236);
  g.fillStyle='#00f0ff';g.font='bold 120px sans-serif';g.textAlign='center';g.fillText(text,512,150);
  g.fillStyle='#ffb300';g.font='44px sans-serif';g.fillText(sub,512,215);
  return new THREE.CanvasTexture(c);
}
function buildSchoolEnv(){
  if(schoolEnv)return;
  schoolEnv=new THREE.Group();
  const G=SCHOOL_GROUND,lam=c=>new THREE.MeshLambertMaterial({color:c}),add=(m,x,y,z)=>{m.position.set(x,y,z);schoolEnv.add(m);return m;};
  // sky: a vertex-colour gradient from a deep blue zenith to a warm horizon, re-centred on the camera each frame
  const sg=new THREE.SphereGeometry(3000,32,16),pos=sg.attributes.position,col=[],top=new THREE.Color(0x0c1830),hor=new THREE.Color(0xff9a5a),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){const k=Math.pow(Math.max(0,Math.min(1,pos.getY(i)/3000+.1)),.55);col.push(...c.copy(hor).lerp(top,k).toArray());}
  sg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  schoolSky=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
  schoolSky.renderOrder=-2;schoolEnv.add(schoolSky);
  // the setting sun, low over the far end of the course
  add(new THREE.Mesh(new THREE.CircleGeometry(150,32),new THREE.MeshBasicMaterial({color:0xffd9a0,fog:false})),-500,260,-2800).lookAt(0,0,0);
  // distant ridge line all the way round, and a few drifting clouds
  const ridge=lam(0x1a2233);
  for(let i=0;i<48;i++){
    const a=i/48*6.283+Math.sin(i*7.3)*.05,h=140+Math.abs(Math.sin(i*2.1))*260+Math.abs(Math.sin(i*5.7))*120;
    const m=new THREE.Mesh(new THREE.ConeGeometry(120+Math.abs(Math.sin(i*3.3))*140,h,5),ridge);
    add(m,Math.cos(a)*2400,G+h/2,Math.sin(a)*2400);m.rotation.y=i;
  }
  const cloudMat=new THREE.MeshBasicMaterial({color:0xffc89a,transparent:true,opacity:.16,depthWrite:false,fog:false});
  for(let i=0;i<16;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),cloudMat);m.scale.set(220+i*14%160,18,120+i*23%90);
    add(m,Math.cos(i*2.4)*1700,280+(i%4)*55,Math.sin(i*2.4)*1700);
  }
  // airfield deck with a faint guide grid
  const deck=add(new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),lam(0x16212e)),0,G,0);deck.rotation.x=-Math.PI/2;
  const grid=add(new THREE.GridHelper(3000,60,0x00f0ff,0x0a3a48),0,G+.2,0);grid.material.transparent=true;grid.material.opacity=.28;
  // main runway under the course, with edge lights, a lit centre line and distance boards every 200 m
  add(new THREE.Mesh(new THREE.BoxGeometry(60,.4,1500),lam(0x0b0f16)),0,G+.2,-550);
  add(new THREE.Mesh(new THREE.BoxGeometry(24,.4,1500),lam(0x0b0f16)),170,G+.2,-550);   // parallel taxiway
  for(let z=-1280;z<=180;z+=40){
    add(new THREE.Mesh(new THREE.BoxGeometry(1.4,.5,16),M.white),0,G+.5,z);
    for(const sx of[-1,1])add(new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,1.2),(z/40)%5===0?M.mag:M.amber),sx*31,G+.8,z);
    if(z%160===0)add(new THREE.Mesh(new THREE.BoxGeometry(1.2,.5,10),M.amber),170,G+.5,z);   // taxiway centre dashes
  }
  for(let z=-1200;z<=0;z+=200){
    const b=add(new THREE.Mesh(new THREE.BoxGeometry(.8,10,14),M.cyan),-38,G+5,z);b.rotation.y=.2;   // distance boards
  }
  // hangar row with parked trainers, and a control tower
  for(const [x,z] of [[-140,-40],[-140,-150],[-140,-260],[-140,-370]]){
    add(new THREE.Mesh(new THREE.BoxGeometry(64,26,76),lam(0x2a3446)),x,G+13,z);
    add(new THREE.Mesh(new THREE.BoxGeometry(.6,18,46),M.cyan),x+32.1,G+10,z);
    add(new THREE.Mesh(new THREE.BoxGeometry(66,2,78),lam(0x1b2433)),x,G+27,z);   // roof lip
    const ship=new THREE.Group();   // a parked trainer: wedge hull, wings, lit nose
    ship.add(new THREE.Mesh(new THREE.ConeGeometry(4,16,4).rotateX(-Math.PI/2),lam(0x56627a)));
    const w=new THREE.Mesh(new THREE.BoxGeometry(18,.6,6),lam(0x3b4660));w.position.z=3;ship.add(w);
    const nose=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),M.cyan);nose.position.set(0,.4,-7);ship.add(nose);
    ship.position.set(x+60,G+3,z);ship.rotation.y=Math.PI/2;schoolEnv.add(ship);
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(10,70,10),lam(0x2a3446)),90,G+35,-40);
  add(new THREE.Mesh(new THREE.BoxGeometry(26,11,26),M.cyan),90,G+75,-40);
  add(new THREE.Mesh(new THREE.ConeGeometry(2,24,6),lam(0x3b4660)),90,G+98,-40);
  add(new THREE.Mesh(new THREE.SphereGeometry(2.4,8,6),M.mag),90,G+112,-40);   // beacon on the mast
  // fuel tanks and floodlight masts around the field
  for(const [x,z] of [[260,-120],[260,-190],[260,-260]]){
    add(new THREE.Mesh(new THREE.CylinderGeometry(22,22,30,16),lam(0x34405a)),x,G+15,z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(22.4,22.4,3,16),M.amber),x,G+22,z);
  }
  for(const [x,z] of [[-60,-100],[60,-100],[-60,-500],[60,-500],[-60,-900],[60,-900]]){
    add(new THREE.Mesh(new THREE.BoxGeometry(1.4,44,1.4),M.dark2),x,G+22,z);
    add(new THREE.Mesh(new THREE.BoxGeometry(9,3,3),M.white),x,G+45,z);
  }
  // signs: the academy name beside the runway start, and the lesson board at the far end of the course
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(120,30),new THREE.MeshBasicMaterial({map:schoolSignTex('FLIGHT ACADEMY','HELIOS TRAINING WING')}));
  add(sign,-140,G+62,-40).rotation.y=Math.PI/2;
  add(new THREE.Mesh(new THREE.PlaneGeometry(120,30),new THREE.MeshBasicMaterial({map:schoolSignTex('KEEP IT SMOOTH','SPEED IS NOT SKILL')})),0,G+50,-1330);
  scene.add(schoolEnv);
}
/* dusk lighting for the academy; arenaAtmosphere() puts the arena/trench values back on the next run */
function schoolAtmosphere(){
  scene.fog.color.setHex(0x7a6270);scene.fog.density=.00045;scene.background.setHex(0x7a6270);
  ambLight.color.setHex(0x8090b8);ambLight.intensity=.8;hemiLight.intensity=.5;
  dust.material.opacity=.15;
  dir.color.setHex(0xffb27a);dir.intensity=1.1;dir.position.set(-.6,.25,-.5);
}
/* called every frame while flight school is up: sky follows the camera, the deck stops you */
function schoolFrame(){
  if(!S.school||!schoolSky)return;
  schoolSky.position.copy(camera.position);schoolMarker();
  if(ship.position.y<SCHOOL_GROUND+12){ship.position.y=SCHOOL_GROUND+12;if(S.vel.y<0)S.vel.y=0;}
}

/* ---------- cues near the reticle (the corner panel is the full reference; these are for eyes on the centre) ---------- */
function cueFlash(text,bad){
  cueMsg.textContent=text;cueMsg.classList.toggle('bad',!!bad);
  cueMsg.classList.remove('show');void cueMsg.offsetWidth;cueMsg.classList.add('show');
}
const _cw=new THREE.Vector3(),_cv=new THREE.Vector3();
/* marker on the next gate or nearest drone; an arrow on the screen edge when it is off to the side or behind */
function schoolMarker(){
  let tgt=null;
  if(SCH&&!SCH.result){
    const G=SCH.gates[SCH.i];
    if(G)tgt=G.mesh.position;
    else if(SCH.L.kind==='evade'){let d=1e9;eMsls.forEach(e=>{const k=e.m.position.distanceToSquared(ship.position);if(k<d){d=k;tgt=e.m.position;}});}
    else{let d=1e9;fighters.forEach(f=>{if(!f.drone)return;const k=f.mesh.position.distanceToSquared(ship.position);if(k<d){d=k;tgt=f.mesh.position;}});}
  }
  if(!tgt){wp.classList.remove('on');return;}
  _cv.copy(tgt).applyMatrix4(camera.matrixWorldInverse);
  const behind=_cv.z>0;
  _cw.copy(tgt).project(camera);
  let x=_cw.x,y=_cw.y;if(behind){x=-x;y=-y;}
  const BX=.9,BY=.84,k=Math.max(Math.abs(x)/BX,Math.abs(y)/BY);
  const edge=behind||k>1;
  if(edge){
    if(k<1e-4){x=0;y=-BY;}else{x/=k;y/=k;}
    wpMark.style.transform='rotate('+(-Math.atan2(y*innerHeight,x*innerWidth)*180/Math.PI)+'deg)';
  }else wpMark.style.transform='';
  wp.style.left=((x*.5+.5)*100)+'%';wp.style.top=((.5-y*.5)*100)+'%';
  wp.classList.toggle('edge',edge);wp.classList.add('on');
  wpDist.textContent=Math.round(tgt.distanceTo(ship.position))+' m';
}

/* ---------- drills ---------- */
function schoolReset(){
  eMsls.forEach(e=>scene.remove(e.m));eMsls.length=0;
  cueLine.classList.remove('on');wp.classList.remove('on');cueMsg.classList.remove('show');schoolCount.classList.remove('on');
  if(!SCH)return;
  SCH.gates.forEach(g=>scene.remove(g.mesh));
  SCH=null;
}
function schoolBegin(L){
  SCH={L,ready:3,t:0,pen:0,mpen:0,i:0,wave:0,nextT:4,lockT:0,beepT:0,dr:false,gates:[],msg:'',msgT:0,endT:0,result:null,last:ship.position.clone(),hits:0,shots:0};
  S.shots=0;S.drillHits=0;
  const pts=[new THREE.Vector3(),...(L.gates||[]).map(g=>new THREE.Vector3(...g.p))];
  (L.gates||[]).forEach((g,i)=>{
    // saturated dark-toned colours: pale sky plus bloom washes light colours out to white blobs
    const col=g.spd==='fast'?GATE_COL.fast:g.spd==='slow'?GATE_COL.slow:GATE_COL.norm,tube=Math.max(2.2,g.r*.14);
    const m=new THREE.Mesh(new THREE.TorusGeometry(g.r,tube,10,40),new THREE.MeshBasicMaterial({color:col}));
    m.position.copy(pts[i+1]);m.lookAt(pts[i+1].clone().add(pts[i+1].clone().sub(pts[i])));
    scene.add(m);SCH.gates.push({g,mesh:m,col,done:false});
  });
  if(!L.gates)schoolSpawnDrones(L);
  cueFlash(L.desc.split('. ')[0].replace(/\.$/,''));
  S.throttle=.3;tut.classList.add('on');tut.classList.remove('ok');
  tutSkip_.textContent='Enter to leave the lesson';
}
function schoolSpawnDrones(L){
  SCH.dr=true;S.shots=0;S.drillHits=0;
  (L.drones||[]).forEach(d=>{
    const F=spawnFighter(0,'grunt');F.drone=d;F.hp=3;F.base=new THREE.Vector3(...d.p);F.mesh.position.copy(F.base);
    F.mesh.lookAt(ship.position);
  });
}
/* evasion: a training missile is launched at you every few seconds from a different bearing, after a lock warning.
   Missile hits are harmless here; they are counted (damage() in game.js) and set the grade */
const EVADE_FROM=[[0,.1,-1],[-1,.2,-.5],[1,.15,-.5],[0,.7,-.7],[0,.1,1]];
function schoolEvade(dt){
  const L=SCH.L,p=ship.position;
  if(SCH.wave<L.waves&&SCH.t>=SCH.nextT){
    if(SCH.lockT<=0){SCH.lockT=1.8;cueFlash('Missile lock: drop flares [G] or break hard',true);}
    S.lockWarn=true;
    SCH.beepT-=dt;if(SCH.beepT<=0){SCH.beepT=.35;sfx('lockwarn');}
    SCH.lockT-=dt;
    if(SCH.lockT<=0){
      const d=_sa.set(...EVADE_FROM[SCH.wave%EVADE_FROM.length]).normalize().applyQuaternion(ship.quaternion);
      const from=p.clone().addScaledVector(d,650);from.y=Math.max(from.y,SCHOOL_GROUND+80);
      spawnEnemyMissile(from,p.clone().sub(from));
      SCH.wave++;SCH.nextT=SCH.t+9;if(S.cm<2)S.cm=2;
    }
  }
}
const tutSkip_=document.getElementById('tutSkip');   // the prompt's footer line
/* drones sway about their spot (called from the enemy update); a still drone just hangs */
function schoolDroneMove(F,dt){
  const m=F.drone.mv;
  if(m){const w=F.t*m[3];F.mesh.position.set(F.base.x+Math.sin(w)*m[0],F.base.y+Math.sin(w*1.3+1)*m[1],F.base.z+Math.sin(w*.8+2)*m[2]);}
  F.mesh.lookAt(ship.position);
}
const _sa=new THREE.Vector3(),_sb=new THREE.Vector3();
function segDist(a,b,p){   // distance from p to the segment a-b
  _sa.copy(b).sub(a);const l2=_sa.lengthSq();
  const k=l2>0?Math.max(0,Math.min(1,_sb.copy(p).sub(a).dot(_sa)/l2)):0;
  return _sb.copy(a).addScaledVector(_sa,k).distanceTo(p);
}
function schoolGrade(L,t){return t<=L.par[0]?'A':t<=L.par[1]?'B':t<=L.par[2]?'C':null;}
function schoolDone(id,grade,time){
  PROG.school=PROG.school||{};
  const b=PROG.school[id];
  if(!b||(GRADE_RANK[grade]||0)>(GRADE_RANK[b.grade]||0)||(grade===b.grade&&time&&time<b.time))PROG.school[id]={grade,time};
  saveProg();
}
function schoolEnd(grade,msg){
  const L=SCH.L,tot=SCH.t+SCH.pen+SCH.mpen;
  SCH.result=grade||'FAIL';SCH.endT=7;
  if(grade)schoolDone(L.id,grade,tot);
  tutStep.textContent=L.name;tutStat.textContent=grade?'GRADE '+grade:'NOT PASSED';
  tutText.textContent=msg;cueFlash((grade?'Grade '+grade:'Not passed'),!grade);cueLine.classList.remove('on');
  tut.classList.toggle('ok',!!grade);
  tutSkip_.textContent=ACADEMY!==null?'Enter to continue':'Enter to return to the lessons';
  if(grade)sfx('lock');
}
function schoolUpdate(dt){
  const L=SCH.L;
  if(SCH.result){SCH.endT-=dt;if(SCH.endT<=0)schoolExit();return;}
  if(SCH.ready>0){
    SCH.ready-=dt;SCH.last.copy(ship.position);
    tutStep.textContent=L.name;tutText.textContent=L.desc;tutStat.textContent='GET READY\n'+(SCH.ready>0?String(Math.ceil(SCH.ready)):'GO');
    schoolCount.textContent=SCH.ready>0?String(Math.ceil(SCH.ready)):'GO';schoolCount.classList.add('on');
    return;
  }
  SCH.t+=dt;if(SCH.msgT>0)SCH.msgT-=dt;
  if(SCH.t<.8){schoolCount.textContent='GO';schoolCount.classList.add('on');}else schoolCount.classList.remove('on');
  const p=ship.position;
  if(L.id==='missiles'&&S.missiles<2)S.missiles=MSL_MAX;
  let line,left=0;
  const inGates=SCH.i<SCH.gates.length;
  if(L.kind==='evade'){
    schoolEvade(dt);
    left=L.waves-SCH.wave+eMsls.length;
    line='Missile '+Math.min(SCH.wave,L.waves)+' / '+L.waves+'  ·  hits '+SCH.hits+'  ·  flares '+S.cm;
  }else if(inGates){
    const G=SCH.gates[SCH.i];
    if(G&&segDist(SCH.last,p,G.mesh.position)<G.g.r){
      const spd=S.vel.length(),want=G.g.spd,ok=!want||(want==='fast'?spd>=SCHOOL_FAST:spd<=SCHOOL_SLOW);
      if(!ok){SCH.pen+=SCHOOL_MISS_S;SCH.msg=(want==='fast'?'TOO SLOW ':'TOO FAST ')+Math.round(spd)+' m/s  +'+SCHOOL_MISS_S+'s';SCH.msgT=2.2;cueFlash(SCH.msg,true);sfx('hit');}
      else sfx('lock');
      G.done=true;G.mesh.visible=false;SCH.i++;
      const nx=SCH.gates[SCH.i];if(nx&&nx.g.spd&&nx.g.spd!==G.g.spd)cueFlash(nx.g.spd==='fast'?'Next gate: boost past '+SCHOOL_FAST+' m/s':'Next gate: slow below '+SCHOOL_SLOW+' m/s');
    }
    SCH.gates.forEach((g,i)=>{if(g.done)return;const cur=i===SCH.i;
      g.mesh.material.color.setHex(cur?(Math.sin(SCH.t*8)>0?GATE_COL.cur:GATE_COL.cur2):g.col);g.mesh.scale.setScalar(cur?1+Math.sin(SCH.t*8)*.05:1);});
    const nxt=SCH.gates[SCH.i];
    line='Gate '+Math.min(SCH.i+1,SCH.gates.length)+' / '+SCH.gates.length+(nxt&&nxt.g.spd?(nxt.g.spd==='fast'?'  ·  BOOST '+SCHOOL_FAST+'+':'  ·  BRAKE <'+SCHOOL_SLOW):'');
    left=SCH.gates.length-SCH.i+(L.drones&&!SCH.dr?L.drones.length:0);
    if(L.drones&&!SCH.dr&&SCH.i>=SCH.gates.length){schoolSpawnDrones(L);cueFlash('Gates done. Now the targets');}
  }else{
    left=fighters.filter(f=>f.drone).length;
    const n=L.drones.length;line='Drones '+(n-left)+' / '+n;
    if(!L.noPenalty){const miss=Math.max(0,S.shots-S.drillHits);SCH.mpen=miss*SCHOOL_SHOT_S;line+='  ·  misses '+miss;}
  }
  SCH.last.copy(p);
  const tot=SCH.t+SCH.pen+SCH.mpen;
  tutStep.textContent=L.name;
  tutStat.textContent=line+(L.id==='speed'?'  ·  '+Math.round(S.vel.length())+' m/s':'')+'\n'+tot.toFixed(1)+' s'+(L.par?'  ·  par A '+L.par[0]+' s':'');
  tutText.textContent=SCH.msgT>0?SCH.msg:L.desc;
  cueLine.textContent=(L.kind==='evade'?'Missile '+Math.min(SCH.wave,L.waves)+'/'+L.waves+' · hits '+SCH.hits:inGates?'Gate '+Math.min(SCH.i+1,SCH.gates.length)+'/'+SCH.gates.length:'Drones '+(L.drones.length-left)+'/'+L.drones.length)+(L.id==='speed'?' · '+Math.round(S.vel.length())+' m/s':'')+' · '+tot.toFixed(1)+'s';
  cueLine.classList.add('on');
  if(left<=0&&L.kind==='evade'){
    const g=['A','B','C'][SCH.hits]||null;
    schoolEnd(g,(g?'Grade '+g+' · ':'Too many hits · ')+SCH.hits+' of '+L.waves+' missiles hit you');
  }else if(left<=0){
    const g=schoolGrade(L,tot),acc=S.shots?Math.round(Math.min(100,S.drillHits/S.shots*100)):0;
    const best=PROG.school&&PROG.school[L.id];
    schoolEnd(g,(g?'Grade '+g+' · ':'Over the C par ('+L.par[2]+' s) · ')+tot.toFixed(1)+' s'+(SCH.pen+SCH.mpen?' (incl. '+(SCH.pen+SCH.mpen).toFixed(1)+' s penalty)':'')
      +(L.drones&&!L.noPenalty?' · accuracy '+acc+'%':'')+(best&&best.grade!=='✓'?' · best '+best.grade+' '+best.time.toFixed(1)+' s':''));
  }else if(tot>L.limit)schoolEnd(null,'Out of time. Take another run at it.');
}
/* leave a lesson back to the school screen (the title's Flight school button opens it too) */
function schoolExit(){
  const L=S.school&&schoolLesson(),res=SCH&&SCH.result;
  if(TUT){TUT=null;}
  tut.classList.remove('on');schoolReset();
  S.school=false;S.mode='menu';
  document.exitPointerLock&&document.exitPointerLock();silenceEngine();setAwaitLock(false);
  $('pause').classList.add('hidden');$('hud').classList.remove('on');$('cockHud').classList.remove('on');
  [...fighters.map(f=>f.mesh)].forEach(m=>scene.remove(m));fighters.length=0;
  if(ACADEMY!==null){academyAdvance(L,res);return;}
  openSchool();
}
/* ---------- the campaign's basic course: the controls tour, then the ring run, passed at any grade ---------- */
const ACADEMY_COURSE=['tour','rings'];
let ACADEMY=null;            // index into ACADEMY_COURSE while the course runs, else null
let academyJustDone=false;   // the command center shows its "cleared" card once
function academyStart(){ACADEMY=0;schoolLaunch(ACADEMY_COURSE[0]);}
/* a lesson just ended or was left: a pass (the tour counts when it was finished) moves on, a time-out repeats the drill,
   and leaving early drops back to the command center with the offer still open */
function academyAdvance(L,res){
  const passed=L&&(L.kind==='tour'?!!(PROG.school&&PROG.school.tour):res&&res!=='FAIL');
  if(passed)ACADEMY++;
  if(ACADEMY!==null&&ACADEMY<ACADEMY_COURSE.length&&(passed||res==='FAIL')){schoolLaunch(ACADEMY_COURSE[ACADEMY]);return;}
  if(passed){PROG.academy='done';saveProg();academyJustDone=true;}
  ACADEMY=null;openCommand();
}
function schoolLaunch(id){S.mission=null;S.school=id;startGame('arena');}

/* ---------- the lesson list screen ---------- */
function openSchool(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();renderSchool();showScreen('school');}
let scSel=null;    // lesson id locked in by a click: the one Start and Enter act on
let scPeek=null;   // lesson id under the pointer or focus: previewed in the panel only
function renderSchool(){
  scList.innerHTML='';scPeek=null;
  if(!scSel||!SCHOOL_LESSONS.some(L=>L.id===scSel))scSel=SCHOOL_LESSONS[0].id;
  SCHOOL_LESSONS.forEach((L,i)=>{
    const b=PROG.school&&PROG.school[L.id];
    const row=document.createElement('button');row.id='scRow_'+L.id;
    row.className='hgrow'+(L.id===scSel?' sel':'')+(b?' done':'');
    const chip=b?'<span class="chip ok">'+(b.grade==='✓'?'✓ Done':'Grade '+b.grade)+'</span>':'';
    row.innerHTML='<i>0'+(i+1)+'</i><div><b>'+L.name+'</b><span>'+L.sub.replace(/^\/\/\s*/,'')+'</span></div>'+chip;
    row.onmouseenter=row.onfocus=()=>peekLesson(L.id);row.onclick=()=>selectLesson(L.id);
    scList.appendChild(row);
  });
  renderLessonPanel();
}
function selectLesson(id){
  scSel=id;scPeek=null;
  for(const r of scList.children){r.classList.toggle('sel',r.id==='scRow_'+id);r.classList.remove('peek');}
  renderLessonPanel();
}
function peekLesson(id){
  scPeek=id===scSel?null:id;
  for(const r of scList.children)r.classList.toggle('peek',r.id==='scRow_'+scPeek);
  renderLessonPanel();
}
scList.onmouseleave=()=>{if(scPeek)peekLesson(null);};
function renderLessonPanel(){
  const L=SCHOOL_LESSONS.find(x=>x.id===(scPeek||scSel)),b=PROG.school&&PROG.school[L.id];
  scRole.textContent=L.sub.replace(/^\/\/\s*/,'');scName.textContent=L.name;scDesc.textContent=L.desc;
  scFacts.innerHTML=hgFacts([
    ['Type',L.kind==='tour'?'Guided tour':L.kind==='gates'?'Gate course':L.kind==='guns'?'Gunnery':L.kind==='evade'?'Evasion':'Drill'],
    L.par?['Par','A '+L.par[0]+' s · B '+L.par[1]+' s · C '+L.par[2]+' s']:['Grading',L.rule||'Ungraded'],
    b?['Best',(b.grade==='\u2713'?'Done':'Grade '+b.grade)+(b.time?' · '+b.time.toFixed(1)+' s':''),'amber']:null,
  ]);
  scAction.textContent=scPeek?'Click to select':b?'Replay lesson':'Start lesson';
  scAction.disabled=!!scPeek;
}
scAction.onclick=scStart.onclick=()=>{if(!scPeek)schoolLaunch(scSel);};
