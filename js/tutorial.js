"use strict";
/* First-flight training: on a pilot's first Reactor Run, a prompt walks through the basic controls
   one at a time. Each step clears when the pilot does the thing it asks; Enter skips the lot.
   Finishing or skipping sets PROG.tutDone so it never shows again. */

const TUT_STEPS=[
  {text:'Move the mouse to steer',               done:T=>T.steer>.5},
  {text:'W / S to raise and lower the throttle', done:T=>T.thr>.4},
  {text:'Hold left click to fire your lasers',   done:T=>T.fire>.6},
  {text:'Shift to boost. It recharges on its own',done:T=>T.boost>.4},
  {text:'Q / E to roll. Match a roll gate\'s slot for Overdrive', done:T=>T.roll>.5},
  {text:'Middle click for missiles, R to target an enemy, hold it in your sights, then left click', done:T=>T.msl, timeout:25},
  {text:'At the reactor, lock on and press F to fire the torpedo. Good hunting.', done:()=>false, timeout:6},
];
/* Flight school (title screen button): its own clear range (the arena sky without the arena's rocks and wrecks), just drones to practise on. It walks
   through every control, repeatable, and leaves PROG.tutDone alone. */
const SCHOOL_STEPS=[
  {text:'Move the mouse to steer',               done:T=>T.steer>.5},
  {text:'W / S to raise and lower the throttle', done:T=>T.thr>.4},
  {text:'Shift to boost. It recharges on its own',done:T=>T.boost>.4},
  {text:'Q / E to roll',                         done:T=>T.roll>.5},
  {text:'Alt switches between cockpit and chase camera', done:T=>T.cam},
  {text:'V switches arcade (assisted) and realistic (inertia) flight', done:T=>T.model},
  {text:'Fly through the glowing rings. Boost the straights, ease off in the turns',enter:()=>schoolRings(),done:T=>T.rings&&T.rings.n>=SCHOOL_RINGS.length,timeout:150},
  {text:'Hold left click to fire lasers. Destroy the drone ahead', enter:()=>schoolDrone(),done:()=>!fighters.some(f=>f.drone),timeout:60},
  {text:'Middle click for missile mode, R to target the drone, hold it in your sights, then left click', enter:()=>schoolDrone(),done:T=>T.msl&&!fighters.some(f=>f.drone),timeout:60},
  {text:'G drops flares. They pull enemy missiles off you', done:T=>T.flare},
  {text:'Flight school complete. Heading back to the title.', done:()=>false, timeout:4},
];
/* ring course: a loose loop through the flight school range, every ring facing along the route */
const SCHOOL_RINGS=[[0,0,-200],[70,25,-340],[180,45,-430],[300,20,-440],[380,-30,-340],[350,-70,-200],[240,-40,-110],[120,0,-60]];
let schoolRingMeshes=[],schoolEnv=null;
/* the range: a flight academy at dusk. A gradient sky (no space, no arena wreckage), an airfield deck far below
   with a runway, hangars and a control tower, and a pylon under every ring. Only the arena's edge dome is kept
   as the boundary. Built once, shown only in flight school. */
const SCHOOL_GROUND=-160;
let schoolSky=null;
function buildSchoolEnv(){
  if(schoolEnv)return;
  schoolEnv=new THREE.Group();
  const lam=c=>new THREE.MeshLambertMaterial({color:c});
  // sky: vertex-colour gradient from a deep blue zenith to a warm horizon, re-centred on the camera each frame
  const sg=new THREE.SphereGeometry(3000,32,16),pos=sg.attributes.position,col=[],top=new THREE.Color(0x0c1830),hor=new THREE.Color(0xff9a5a),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){const k=Math.pow(Math.max(0,Math.min(1,pos.getY(i)/3000+.1)),.55);col.push(...c.copy(hor).lerp(top,k).toArray());}
  sg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  schoolSky=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
  schoolSky.renderOrder=-2;schoolEnv.add(schoolSky);
  // airfield deck with a faint guide grid
  const deck=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),lam(0x16212e));deck.rotation.x=-Math.PI/2;deck.position.y=SCHOOL_GROUND;schoolEnv.add(deck);
  const grid=new THREE.GridHelper(1400,28,0x00f0ff,0x0a3a48);grid.position.y=SCHOOL_GROUND+.2;
  grid.material.transparent=true;grid.material.opacity=.3;schoolEnv.add(grid);
  // runway straight under the course start, edge lights and a lit centre line
  const rw=new THREE.Mesh(new THREE.BoxGeometry(60,.4,700),lam(0x0b0f16));rw.position.set(0,SCHOOL_GROUND+.2,-150);schoolEnv.add(rw);
  for(let z=-480;z<=180;z+=40){
    const dash=new THREE.Mesh(new THREE.BoxGeometry(1.4,.5,16),M.white);dash.position.set(0,SCHOOL_GROUND+.5,z);schoolEnv.add(dash);
    for(const sx of[-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,1.2),M.amber);l.position.set(sx*31,SCHOOL_GROUND+.8,z);schoolEnv.add(l);}
  }
  // hangars and a control tower off to the side of the runway
  for(const [x,z,w] of [[-130,-60,60],[-130,-160,60],[-130,-260,60]]){
    const h=new THREE.Mesh(new THREE.BoxGeometry(w,24,70),lam(0x2a3446));h.position.set(x,SCHOOL_GROUND+12,z);schoolEnv.add(h);
    const door=new THREE.Mesh(new THREE.BoxGeometry(.6,16,44),M.cyan);door.position.set(x+w/2+.1,SCHOOL_GROUND+9,z);schoolEnv.add(door);
  }
  const tw=new THREE.Mesh(new THREE.BoxGeometry(10,60,10),lam(0x2a3446));tw.position.set(90,SCHOOL_GROUND+30,-40);schoolEnv.add(tw);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(24,10,24),M.cyan);cab.position.set(90,SCHOOL_GROUND+65,-40);schoolEnv.add(cab);
  for(const p of SCHOOL_RINGS){   // a lit pylon from the deck up to each ring, as a height cue
    const h=p[1]-SCHOOL_GROUND;
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.6,h,1.6),M.dark2);m.position.set(p[0],SCHOOL_GROUND+h/2,p[2]);schoolEnv.add(m);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.4,2.4),M.cyan);cap.position.set(p[0],SCHOOL_GROUND,p[2]);schoolEnv.add(cap);
  }
  scene.add(schoolEnv);
}
/* dusk lighting for the academy; arenaAtmosphere() puts the arena/trench values back on the next run */
function schoolAtmosphere(){
  scene.fog.color.setHex(0x7a6270);scene.fog.density=.00045;scene.background.setHex(0x7a6270);
  ambLight.color.setHex(0x8090b8);ambLight.intensity=.8;hemiLight.intensity=.5;
  dust.material.opacity=.15;
  dir.color.setHex(0xffb27a);dir.intensity=1.1;dir.position.set(-.6,.25,-.5);
}
function schoolRingsClear(){schoolRingMeshes.forEach(m=>scene.remove(m));schoolRingMeshes=[];}
function schoolRings(){
  schoolRingsClear();
  const pts=[new THREE.Vector3(0,0,0),...SCHOOL_RINGS.map(p=>new THREE.Vector3(...p))];
  SCHOOL_RINGS.forEach((_,i)=>{
    const m=new THREE.Mesh(new THREE.TorusGeometry(22,1.4,8,36),new THREE.MeshBasicMaterial({color:0x00f0ff}));
    m.position.copy(pts[i+1]);m.lookAt(pts[i+1].clone().add(pts[i+1].clone().sub(pts[i])));   // axis along the route
    scene.add(m);schoolRingMeshes.push(m);
  });
  TUT.rings={n:0};
}
function schoolRingsUpdate(T){
  const R=T.rings,m=schoolRingMeshes[R.n];
  schoolRingMeshes.forEach((r,i)=>{r.material.color.setHex(i<R.n?0x1a3a40:i===R.n?0xffb300:0x00f0ff);r.visible=i>=R.n;});
  if(m&&m.position.distanceTo(ship.position)<22){
    R.n++;sfx('lock');
    tutText.textContent='Fly through the glowing rings: '+R.n+' / '+SCHOOL_RINGS.length;
  }
}
function schoolDrone(){
  const F=spawnFighter(0,'grunt');F.drone=true;
  F.mesh.position.copy(ship.position).add(tmp.set((Math.random()-.5)*80,(Math.random()-.5)*40,-260).applyQuaternion(ship.quaternion));
  F.y0=F.mesh.position.y;F.mesh.lookAt(ship.position);
}
let TUT=null;   // {i, t, ok, steps, steer, thr, fire, boost, roll, cam, model, flare, msl, msl0}
const tutActive=()=>!!TUT;
function tutStart(){
  TUT=null;tut.classList.remove('on');schoolRingsClear();
  if(!S.school&&(PROG.tutDone||!S.mission||S.mission.id!=='m1'))return;
  TUT={steps:S.school?SCHOOL_STEPS:TUT_STEPS,cam0:S.cam,model0:S.model,cam:false,model:false,flare:false,i:0,t:0,ok:0,steer:0,thr:0,fire:0,boost:0,roll:0,msl:false,msl0:S.missiles};
  tutShow();
}
function tutShow(){
  const st=TUT.steps[TUT.i];
  tutStep.textContent=(S.school?'Flight school ':'Training ')+(TUT.i+1)+' / '+TUT.steps.length;
  tutText.textContent=st.text;
  schoolRingsClear();TUT.rings=null;
  if(st.enter)st.enter();
  TUT.msl0=S.missiles;TUT.msl=false;
  tut.classList.remove('ok');tut.classList.add('on');
}
function tutFinish(){
  TUT=null;tut.classList.remove('on');schoolRingsClear();
  if(S.school){toMenu();return;}
  PROG.tutDone=true;saveProg();
}
function tutSkip(){if(TUT)tutFinish();}
function tutUpdate(dt){
  if(!TUT)return;
  if(S.school&&schoolSky){   // sky follows the camera; the deck is solid enough to stop you
    schoolSky.position.copy(camera.position);
    if(ship.position.y<SCHOOL_GROUND+12){ship.position.y=SCHOOL_GROUND+12;if(S.vel.y<0)S.vel.y=0;}
  }
  const T=TUT,st=T.steps[T.i];
  T.t+=dt;
  if(T.rings)schoolRingsUpdate(T);
  // accumulate what the pilot has actually done
  T.steer+=Math.min(1,Math.hypot(S.cursor.x,S.cursor.y))*dt;   // the cursor drifts back to centre, so count how far it's held off
  T.thr+=(S.keys.KeyW||S.keys.KeyS)?dt:0;
  T.fire+=S.fireHeld?dt:0;
  T.boost+=S.boost?dt:0;
  T.roll+=(S.keys.KeyQ||S.keys.KeyE)?dt:0;
  if(S.cam!==T.cam0)T.cam=true;
  if(S.model!==T.model0)T.model=true;
  if(S.keys.KeyG)T.flare=true;
  if(S.missiles<T.msl0||msls.length)T.msl=true;
  if(T.ok>0){   // brief green tick before moving on
    T.ok-=dt;
    if(T.ok<=0){T.i++;T.t=0;if(T.i>=T.steps.length){tutFinish();return;}tutShow();}
    return;
  }
  if(st.done(T)||(st.timeout&&T.t>st.timeout)){T.ok=.7;tut.classList.add('ok');}
}
