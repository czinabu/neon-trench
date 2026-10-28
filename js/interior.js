"use strict";
/* Capital ship interior: the reactor trench that runs down the inside of the dreadnought THRONE. It is a trench
   run (S.sector stays 'trench'; missions with `interior` set S.interior and S.runLen), with its own
   corridor: a solid ceiling, a red-lit hull in the syndicate's colours, a breach in the outer hull you fly in through, plasma
   vents that fire across the trench on a cycle, and the ship's reactor at the far end instead of the
   intake port. Lengths and vent timings are in js/config.js. */

const intSegs=[];   // the corridor's recycled segment pool (built on first use)
const vents=[];     // {mesh,mat,slotMat,z,t,hitT,passed}
let intBreach=null, intMats=null;
const INT_FOG_A=new THREE.Color(0x0d0509), INT_FOG_B=new THREE.Color(0x2a0711);   // breach → reactor glow
const ceilY=()=>S.interior?INT_CEIL-5:TOP_Y;   // highest the ship can fly in the trench sector

function interiorMats(){
  if(intMats)return intMats;
  const wall=wallMat.clone();wall.color.setHex(0x1c0b13);wall.emissive.setHex(0xff7a8a);
  const floor=floorMat.clone();floor.color.setHex(0x1e0e15);floor.emissive.setHex(0xff4a5a);
  const ceil=floorMat.clone();ceil.color.setHex(0x140910);ceil.emissive.setHex(0x803040);
  intMats={wall,floor,ceil,rib:new THREE.MeshLambertMaterial({color:0x3a1822}),pipe:new THREE.MeshLambertMaterial({color:0x26121a}),
    lamp:new THREE.MeshBasicMaterial({color:0x9a5a34}),   // warm window light, kept under the bloom threshold
    slot:new THREE.MeshBasicMaterial({color:0x401018}),
    vent:new THREE.MeshBasicMaterial({color:0xff6a2a,blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})};
  return intMats;
}
/* one corridor segment: walls, floor and ceiling, structural ribs that read speed, conduits and light strips */
function buildInteriorSegment(){
  const mt=interiorMats(),g=new THREE.Group(),H=INT_CEIL-FLOOR_Y,cy=(INT_CEIL+FLOOR_Y)/2;
  const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
  box(HALF_W*2+4,2,SEG_LEN,mt.floor,0,FLOOR_Y-1,-SEG_LEN/2);
  box(HALF_W*2+4,2,SEG_LEN,mt.ceil,0,INT_CEIL+1,-SEG_LEN/2);
  box(.6,.2,SEG_LEN,M.mag,0,FLOOR_Y+.15,-SEG_LEN/2);   // centre line
  for(const side of [-1,1]){
    box(4,H+4,SEG_LEN,mt.wall,side*(HALF_W+2),cy,-SEG_LEN/2);
    box(.3,.5,SEG_LEN,M.mag,side*HALF_W,FLOOR_Y+7,-SEG_LEN/2);
    box(.3,.5,SEG_LEN,mt.lamp,side*HALF_W,INT_CEIL-9,-SEG_LEN/2);
    // conduits along the upper and lower corners
    for(const y of [INT_CEIL-3,FLOOR_Y+3]){const c=box(1.6,1.6,SEG_LEN,mt.pipe,side*(HALF_W-.8),y,-SEG_LEN/2);c.scale.x=.9;}
    for(let k=0;k<8;k++)   // greeble panels and the odd lit window
      box(1.2,2+Math.random()*6,3+Math.random()*12,Math.random()<.12?mt.lamp:mt.rib,side*(HALF_W-.4),FLOOR_Y+6+Math.random()*(H-14),-Math.random()*SEG_LEN);
    for(let k=0;k<6;k++)box(1.2,.2,10,mt.lamp,side*9,INT_CEIL-.1,-(k+.5)*SEG_LEN/6);   // ceiling light strips
  }
  // ribs: a frame round the corridor every quarter segment, every other one trimmed in neon
  for(let k=0;k<4;k++){
    const z=-(k+.5)*SEG_LEN/4;
    for(const side of [-1,1]){
      box(1.6,H,3,mt.rib,side*(HALF_W-.8),cy,z);
      if(k%2===0)box(.3,H-8,.5,M.mag,side*(HALF_W-1.7),cy,z);
    }
    box(HALF_W*2,1.6,2.4,mt.rib,0,INT_CEIL-.8,z);
    box(HALF_W*2,.8,2.4,mt.rib,0,FLOOR_Y+.4,z);
    box(1,.3,1,M.amber,0,INT_CEIL-1.7,z);
  }
  return g;
}
/* the outside of the dreadnought where the strike wing blew it open: a wall of hull at z 0, far wider than
   the view, with a burning hole the size of the corridor, which is where the run starts. Round the hole the
   hull is layered armour, ribbed and lit, with gun decks above and below; it is all merged into a mesh per material. */
function buildBreach(){
  const mt=capHullMaterials(),it=interiorMats(),g=new THREE.Group(),rng=capRng(23);
  const HW=HALF_W+3, y0=FLOOR_Y-2, y1=INT_CEIL+2, W=1600, Y0=-520, Y1=480, D=10, cy=(y0+y1)/2;
  const bat={},B=mat=>(bat[mat.uuid]||(bat[mat.uuid]={mat,B:capBatch()})).B;
  const slab=(x0,x1,ya,yb,mat,z,d)=>B(mat||mt.hull).box(x1-x0,yb-ya,d||D,(x0+x1)/2,(ya+yb)/2,z!=null?z:-D/2+2);
  slab(-W,-HW,Y0,Y1);slab(HW,W,Y0,Y1);slab(-HW,HW,y1,Y1);slab(-HW,HW,Y0,y0);
  // deck bands, neon trim and window rows across the hull
  for(const [ya,yb] of [[60,84],[-110,-92],[190,230],[-260,-230]])slab(-W,W,ya,yb,mt.hull2,4,6);
  for(const y of [56,-88,186,-264])slab(-W,W,y,y+1.2,M.mag,7.2,.4);
  for(const y of [42,-60,-74,150,-200])for(let x=-W+20;x<W-40;x+=26)if(Math.abs(x)>HW+10&&rng()<.7)slab(x,x+14,y,y+1.6,it.lamp,2.4,.4);
  // armour plating round the breach: plates standing proud by different amounts, dark seams between them,
  // the odd lit slot; thinning out away from the hole
  for(let y=-250;y<250;y+=12)for(let x=-480;x<480;x+=18){
    const px=x+9+(rng()-.5)*2,py=y+6;
    if(Math.abs(px)<HW+16&&py>y0-16&&py<y1+16)continue;
    if(Math.hypot(px/2.4,py-cy)>150&&rng()<.5)continue;
    const w=17-rng()*4,h=11-rng()*3,d=.5+rng()*2.2;
    B(rng()<.7?mt.hull:mt.hull2).box(w,h,d,px,py,2+d/2);
    if(rng()<.1)B(it.lamp).box(w*.5,.8,.3,px,py-h*.3,2+d+.15);
  }
  // heavy ribs either side of the hole, running lights down them
  for(const x of[60,150,270,400])for(const sx of[-1,1]){
    const X=sx*(HW+x);slab(X-4,X+4,-300,300,mt.hull2,6,8);slab(X-.4,X+.4,-300,300,M.mag,10.1,.3);
    for(let y=-260;y<300;y+=70)capLight(g,X,y,10.6,0xff3a2a,.02);
  }
  // a gun deck overhead: a ledge across the hull with lit windows along its face and turrets on top
  slab(-W,W,112,128,mt.hull,9,14);slab(-W,W,110,112,mt.hull2,9,13);
  for(let x=-W+10;x<W-20;x+=9)if(rng()<.75)slab(x,x+5,118,119.4,it.lamp,16.1,.3);
  slab(-W,W,126.5,127.3,M.mag,16.2,.3);
  for(const x of[-300,-170,170,300]){
    const T=B(mt.hull2),H=B(mt.trim);
    T.add(new THREE.CylinderGeometry(9,11,4,18),x,130,9);
    H.add(capLoftGeo(CAP_PROF.deck,[[-9,8,4,0],[5,8,4,0],[9,5.5,2.6,-1]]),x,136,9);
    for(const bx of[-3,3])T.cylZ(1.2,1.5,22,10,x+bx,137,22).cylZ(1.8,1.8,3,10,x+bx,137,33);
  }
  // the same below the hole, a deck lower
  slab(-W,W,-168,-154,mt.hull,9,14);
  for(let x=-W+10;x<W-20;x+=9)if(rng()<.75)slab(x,x+5,-162,-160.6,it.lamp,16.1,.3);
  // the hole: a scorched, buckled rim and glowing torn metal
  for(let i=0;i<40;i++){
    const a=i/46*6.283, rx=Math.cos(a), ry=Math.sin(a);
    const x=Math.max(-1,Math.min(1,rx*1.5))*HW, y=cy+Math.max(-1,Math.min(1,ry*1.5))*(y1-y0)/2;
    B(mt.scorch).add(new THREE.BoxGeometry(8+rng()*12,6+rng()*10,1+rng()*2),x+rx*8,y+ry*8,2.8,rng()*.3,rng()*.3,rng()*3);
    if(i%3===0)B(mt.hull2).add(new THREE.BoxGeometry(4+rng()*6,3+rng()*4,.8),x+rx*14,y+ry*12,5,rng()-.5,rng()-.5,rng()*3);   // plating peeled outward
    if(i%2)continue;   // glowing torn metal on every other plate
    B(M.glow).add(new THREE.BoxGeometry(1+rng()*4,.4+rng()*1.2,1.4),x+rx*1.5,y+ry*1.5,2.8,rng(),rng(),rng()*3);
  }
  for(const k in bat)bat[k].B.mesh(g,bat[k].mat);
  for(const [x,y] of [[-HW-6,y1+6],[HW+6,y1+6],[-HW-6,y0-6],[HW+6,y0-6],[-140,96],[140,96]])capLight(g,x,y,4,0xff3a2a);
  // a few chunks of hull drifting off the breach
  for(let i=0;i<7;i++){
    const c=new THREE.Mesh(new THREE.BoxGeometry(2+Math.random()*5,1+Math.random()*3,2+Math.random()*5),mt.hull2);
    c.position.set((Math.random()*2-1)*60,(Math.random()*2-1)*35+4,12+Math.random()*50);
    if(Math.abs(c.position.x)<HALF_W&&Math.abs(c.position.y-4)<20)c.position.x+=Math.sign(c.position.x||1)*40;   // not in the way in
    c.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);g.add(c);
  }
  scene.add(g);intBreach=g;
}
/* the run's finale: the ship's reactor behind a bulkhead at the far end. Keeps buildPort's layout (wall, outer
   ring, inner ring, then the glowing core) so the trench objective drives it the same way. */
function buildCoreChamber(){
  const it=interiorMats();
  portGroup=new THREE.Group();
  const wall=new THREE.Mesh(sharedGeo('coreWall',()=>new THREE.BoxGeometry(HALF_W*2+8,INT_CEIL-FLOOR_Y+8,6)),capHullMaterials().hull2);
  wall.position.set(0,(INT_CEIL+FLOOR_Y)/2,0);portGroup.add(wall);
  const ringO=new THREE.Mesh(sharedGeo('coreRingO',()=>new THREE.TorusGeometry(10,.9,8,48)),M.mag);ringO.position.set(0,0,3.2);portGroup.add(ringO);
  const ringI=new THREE.Mesh(sharedGeo('coreRingI',()=>new THREE.TorusGeometry(6.5,.5,8,40)),it.lamp);ringI.position.set(0,0,3.4);portGroup.add(ringI);
  exhaustPort=new THREE.Mesh(sharedGeo('coreDisc',()=>new THREE.CircleGeometry(5.5,28)),
    new THREE.MeshBasicMaterial({color:0x5fe8ff,blending:THREE.AdditiveBlending,transparent:true}));
  exhaustPort.position.set(0,0,3.5);portGroup.add(exhaustPort);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x5fe8ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.7,depthWrite:false}));
  halo.scale.setScalar(46);halo.position.set(0,0,4);portGroup.add(halo);
  for(let k=0;k<4;k++){   // coolant feeds from the ring out to the corridor corners
    const a=k*Math.PI/2+Math.PI/4, s=new THREE.Mesh(sharedGeo('coreFeed',()=>new THREE.BoxGeometry(1.2,22,1.2)),M.mag);
    s.position.set(Math.cos(a)*21,Math.sin(a)*21,3.3);s.rotation.z=a-Math.PI/2;portGroup.add(s);
  }
  portGroup.position.set(0,0,-S.runLen);
  scene.add(portGroup);
}
/* the light inside: dim and red, after arenaAtmosphere(false) has set the trench's */
function interiorAtmosphere(){
  ambLight.color.setHex(0x5a2c38);ambLight.intensity=.7;hemiLight.intensity=.25;
  dir.color.setHex(0xff9a7a);dir.intensity=.4;
}
/* show or hide the interior for a run, building it the first time */
function setInterior(on){
  for(const V of vents)scene.remove(V.mesh);vents.length=0;
  if(on&&!intSegs.length){
    for(let i=0;i<SEG_POOL;i++){const s=buildInteriorSegment();scene.add(s);intSegs.push(s);}
    buildBreach();
  }
  intSegs.forEach((s,i)=>{s.position.z=-i*SEG_LEN;s.visible=on;});
  if(intBreach)intBreach.visible=on;
  objMark.querySelector('b').textContent=on?S.capName+' REACTOR':'REACTOR INTAKE';
}
/* a plasma vent: emitters in the floor and ceiling that fire a sheet across the whole trench. Quiet, then
   a flicker to warn, then a burn; slip through while it's quiet or throttle back and wait */
function spawnVent(z){
  const mt=interiorMats(),g=new THREE.Group(),H=INT_CEIL-FLOOR_Y,cy=(INT_CEIL+FLOOR_Y)/2;
  const mat=mt.vent.clone(),slotMat=mt.slot.clone();
  const sheet=new THREE.Mesh(sharedGeo('ventSheet',()=>new THREE.PlaneGeometry(HALF_W*2,H)),mat);sheet.position.y=cy;g.add(sheet);
  for(const y of [FLOOR_Y+.6,INT_CEIL-.6]){
    const b=new THREE.Mesh(sharedGeo('ventBase',()=>new THREE.BoxGeometry(HALF_W*2,1.2,4)),M.dark2);b.position.y=y;g.add(b);
    const s=new THREE.Mesh(sharedGeo('ventSlot',()=>new THREE.BoxGeometry(HALF_W*2,.3,1.2)),slotMat);s.position.y=y+(y<cy?.7:-.7);g.add(s);
  }
  for(const sx of [-1,1]){const n=new THREE.Mesh(sharedGeo('ventSide',()=>new THREE.BoxGeometry(1.4,H,4)),M.dark2);n.position.set(sx*(HALF_W-.7),cy,0);g.add(n);}
  g.position.set(0,0,z);scene.add(g);
  vents.push({mesh:g,mat,slotMat,z,t:Math.random()*VENT_CYCLE,hitT:-9,passed:false});
}
/* per frame inside the ship (called from the world stage): vents cycle, burn whatever is in them, and
   pay a close call for slipping through just before or after a burn */
function updateInterior(fr){
  const {dt,p,prevP}=fr;
  for(let i=vents.length-1;i>=0;i--){const V=vents[i];
    if(V.z>p.z+220){scene.remove(V.mesh);vents.splice(i,1);continue;}
    const was=V.t;V.t=(V.t+dt)%VENT_CYCLE;
    const warn=V.t>=VENT_WARN&&V.t<VENT_ON, on=V.t>=VENT_ON;
    V.mat.opacity=on?.32+Math.random()*.16:warn?(Math.random()<.5?.03:.1):0;
    V.mat.color.setHex(on?0xff7a30:0xff3a2a);
    V.slotMat.color.setHex(on?0xffe0a0:warn?(Math.random()<.5?0xff2d2d:0x601010):0x401018);
    if(on&&was<VENT_ON&&Math.abs(p.z-V.z)<500)sfx('ezap',tmp.set(0,(INT_CEIL+FLOOR_Y)/2,V.z));
    if(on&&Math.random()<.3)spark(tmp.set((Math.random()*2-1)*HALF_W,FLOOR_Y+1,V.z),0xffb060,2,18);
    const crossed=(prevP.z-V.z)*(p.z-V.z)<=0;
    if(on&&(crossed||Math.abs(p.z-V.z)<2.5)&&S.time-V.hitT>1){
      V.hitT=S.time;V.passed=true;S.ventHits++;
      damage(VENT_DMG,'Burned through by a plasma vent inside '+S.capName+'.');spark(p,0xffb060,16,26);
    }else if(crossed&&!on&&!V.passed){
      V.passed=true;
      if(warn||V.t<.3){S.score+=60;spawnPop(tmp.copy(p),'VENT DODGED +60','');sfx('near');}
    }
  }
}

/* ---- the escape run: after the core goes, THRONE comes apart round you and the way out is back down the
   trench to the breach, against a clock. Collapsing girders and pillars drop into the corridor ahead of you
   (now at +z), fires burn along the walls, and the fog heats up as the ship dies. ---- */
const ESC_FOG_A=new THREE.Color(0x6a2a10), ESC_FOG_B=new THREE.Color(0xb04818);
const escDebris=[];   // {mesh,min,max,y0,drop}
function clearEscape(){for(const D of escDebris)scene.remove(D.mesh);escDebris.length=0;}
function startEscape(){
  const p=ship.position;
  // the fight is over: strip the hostiles and hazards, and leave the dead core as the end wall
  [...beams.map(b=>b.mesh),...gates.map(g=>g.group),...turrets.map(t=>t.mesh),
   ...fighters.map(f=>f.mesh),...bombers.map(b=>b.mesh),...mines.map(m=>m.mesh),...eBolts.map(b=>b.m)].forEach(m=>scene.remove(m));
  eMsls.forEach(e=>scene.remove(e.m));eMsls.length=0;
  clearBranch();clearSetPieces();
  beams.length=gates.length=turrets.length=fighters.length=bombers.length=mines.length=eBolts.length=0;
  S.target=S.mslTarget=S.lockTarget=null;
  for(const V of vents)scene.remove(V.mesh);vents.length=0;
  if(portGroup){portGroup.children[3].visible=false;portGroup.children[4].visible=false;}   // the core's glow is gone
  // the corridor now has to extend ahead of you towards the breach
  intSegs.forEach((s,i)=>{s.position.z=p.z+(SEG_POOL-2-i)*SEG_LEN;});
  clearEscape();
  S.escape={t:ESCAPE_T,nextZ:p.z+450,fireT:0,rumbleT:0};
  objMark.querySelector('b').textContent='BREACH EXIT';
  objLbl.textContent='Objective // Escape '+S.capName;
  railA.textContent=S.capName+' core';railB.textContent='Hull breach';
  announce('CORE DESTROYED',S.capName+' is breaking up. Turn around and get out','ace');S.annT=4;
  scene.fog.color.copy(ESC_FOG_A);
}
/* one collapse: a girder across the floor (fly over), across the ceiling (fly under) or a pillar on one side */
function spawnCollapse(z){
  const mt=interiorMats(),r=Math.random();
  let x0=-HALF_W,x1=HALF_W,y0,y1,edge;   // the box that hurts, and the strip of glowing torn metal on its exposed side
  if(r<.35){y0=FLOOR_Y;y1=FLOOR_Y+14+Math.random()*10;edge='top';}
  else if(r<.7){y1=INT_CEIL;y0=INT_CEIL-14-Math.random()*10;edge='bottom';}
  else{const side=Math.random()<.5?-1:1,w=20+Math.random()*9;y0=FLOOR_Y;y1=INT_CEIL;
    if(side<0)x1=-HALF_W+w;else x0=HALF_W-w;edge=side<0?'right':'left';}
  const g=new THREE.Group(),W=x1-x0,H=y1-y0,cy=(y0+y1)/2;
  const m=new THREE.Mesh(new THREE.BoxGeometry(W,H,6),mt.rib);g.add(m);
  const hot=(w,h,x,y)=>{const e=new THREE.Mesh(new THREE.BoxGeometry(w,h,6.4),M.amber);e.position.set(x,y,0);g.add(e);};
  if(edge==='top')hot(W,.6,0,H/2-.3);else if(edge==='bottom')hot(W,.6,0,-H/2+.3);
  else hot(.6,H,edge==='right'?W/2-.3:-W/2+.3,0);
  g.position.set((x0+x1)/2,cy+60,z);scene.add(g);   // drops in as you close on it
  escDebris.push({mesh:g,min:new THREE.Vector3(x0,y0,z-3),max:new THREE.Vector3(x1,y1,z+3),y0:cy,passed:false});
}
/* per frame during the escape (called from the objective stage); returns true when the run just ended */
function updateEscape(fr){
  const {dt,p,prevP}=fr, E=S.escape;
  fr.distPort=Math.max(0,-p.z);   // metres left to the breach: the HUD distance and rail follow it
  E.t-=dt;
  if(p.z>-4){   // through the hole
    S.score+=Math.round(Math.max(0,E.t)*40);
    spawnPop(tmp.copy(p),'ESCAPED +'+Math.round(Math.max(0,E.t)*40),'big');
    S.escape=null;clearEscape();endGame(true);return true;
  }
  if(E.t<=0){S.escape=null;endGame(false,S.capName+' broke apart with you still inside.');return true;}
  if(p.z<-S.runLen+6){p.z=-S.runLen+6;if(S.vel.z<0)S.vel.z=0;}   // the dead core is still a wall
  // collapses ahead; stop laying them near the exit so the last stretch is clear
  while(E.nextZ<p.z+1600&&E.nextZ<-300){spawnCollapse(E.nextZ);E.nextZ+=ESC_GAP+Math.random()*80;}
  for(let i=escDebris.length-1;i>=0;i--){const D=escDebris[i];
    if(D.max.z<p.z-220){scene.remove(D.mesh);escDebris.splice(i,1);continue;}
    const d=D.min.z+3-p.z;   // metres ahead of you
    D.mesh.position.y=D.y0+60*Math.max(0,Math.min(1,(d-160)/200));   // falls into place as you close
    if(segBox(prevP,p,D.min,D.max,2)&&D.mesh.position.y-D.y0<4){
      damage(24,S.capName+' collapsed on you.');spark(p,0xffb300,16,30);
      S.vel.multiplyScalar(-.35);p.z=D.min.z-3;   // thrown back the way you came
    }else if(!D.passed&&p.z>D.max.z){D.passed=true;S.score+=30;}
  }
  // the ship tearing itself apart: rumble, fires along the walls, and the glow rising as the clock runs down
  const k=1-Math.max(0,E.t)/ESCAPE_T;
  E.rumbleT-=dt;if(E.rumbleT<=0){E.rumbleT=.5+Math.random()*.9;S.shake=Math.max(S.shake,.25+k*.3);sfx('boom',tmp.set(0,0,p.z+60+Math.random()*200));}
  E.fireT-=dt;if(E.fireT<=0){E.fireT=.12;
    const z=p.z+40+Math.random()*260,side=Math.random()<.5?-1:1;
    spark(tmp.set(side*(HALF_W-1),FLOOR_Y+Math.random()*(INT_CEIL-FLOOR_Y),z),Math.random()<.5?0xff7a30:0xffd070,3,24);
    if(Math.random()<.25)fireball(tmp.set(side*(HALF_W-3),FLOOR_Y+2+Math.random()*10,z),0xff6a20,1.2+Math.random());}
  scene.fog.color.copy(ESC_FOG_A).lerp(ESC_FOG_B,k);
  if(E.t<10&&Math.floor(E.t)!==Math.floor(E.t+dt))sfx('lockwarn');   // last ten seconds tick
  return false;
}
