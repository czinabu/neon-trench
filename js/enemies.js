"use strict";
/* Hazards + enemies: beams, spawn director, roll gates, turrets, pickups, fighters, bombers, mines, reactor port. */

/* ============================ HAZARDS / ENEMIES ============================ */
const beams=[];    // {mesh,min,max,move?}
const gates=[];    // {group,z,angle,L,H,passed,cy}
const turrets=[];  // {mesh,head,hp,t,z,dead}
const fighters=[]; // {mesh,head,hp,t,seed,fireT,dead}
const bombers=[];  // {mesh,glow,hp,t,seed,mineT,dead}  heavy mine-layer
const mines=[];    // {mesh,t,life}  floating proximity hazards
const pickups=[];  // {mesh,core,ring,kind,t,life}  drops you fly through to collect
const pBolts=[], eBolts=[], sparks=[], smoke=[], msls=[];
let exhaustPort=null, portGroup=null, torpedo=null;

/* A single beam. opts let the spawn director guarantee a viable flight path:
   - horizontal: orientation; opts.band = 'low'|'mid'|'high' biases to a trench third
   - opts.x      : explicit lane for vertical beams (leaves the rest of the width clear)
   - opts.moving : oscillation; amplitude is capped so a clear corridor always survives */
function spawnBeam(z,opts){
  opts=opts||{};
  const horizontal=opts.horizontal!=null?opts.horizontal:Math.random()<.6;
  const moving=opts.moving!=null?opts.moving:Math.random()<.4;
  let mesh,min,max,move=null;
  if(horizontal){
    const lo=FLOOR_Y+5, hi=TOP_Y-4, C=9;            // C = guaranteed vertical clearance from the flow line
    const gapY=opts.gapY!=null?opts.gapY:0;
    let y;
    if(opts.yc!=null){ y=opts.yc; }                 // explicit centre (squeeze-gate halves)
    else{ // sit the beam on the roomier side of the gap so the open band always holds the flow line
      const roomA=hi-(gapY+C), roomB=(gapY-C)-lo;
      y=(roomA>=roomB&&roomA>1)? gapY+C+Math.random()*roomA : gapY-C-Math.random()*Math.max(0,roomB);
    }
    y=Math.max(lo,Math.min(hi,y));
    mesh=new THREE.Group();
    const core=new THREE.Mesh(sharedGeo('beamH',()=>new THREE.BoxGeometry(HALF_W*2,3.5,3.5)),M.dark2);mesh.add(core);
    const lit=new THREE.Mesh(sharedGeo('beamHLit',()=>new THREE.BoxGeometry(HALF_W*2+.2,.6,3.7)),moving?M.mag:M.amber);lit.position.y=1.6;mesh.add(lit);
    const lit2=lit.clone();lit2.position.y=-1.6;mesh.add(lit2);
    mesh.position.set(0,y,z);
    min=new THREE.Vector3(-HALF_W,y-1.8,z-1.8);max=new THREE.Vector3(HALF_W,y+1.8,z+1.8);
    if(moving){const amp=Math.min(4,Math.abs(y-gapY)-6); // keep the piston from ever closing the corridor
      if(amp>1.5)move={axis:'y',base:y,amp,sp:.7+Math.random()*.9,ph:Math.random()*6.28};}
  }else{
    const lim=HALF_W-6, Cx=11;                       // Cx = guaranteed horizontal clearance from the flow line
    const gapX=opts.gapX!=null?opts.gapX:0;
    let x;
    if(opts.x!=null){ x=opts.x; }
    else{ const roomR=lim-(gapX+Cx), roomL=(gapX-Cx)-(-lim);
      x=(roomR>=roomL&&roomR>1)? gapX+Cx+Math.random()*roomR : gapX-Cx-Math.random()*Math.max(0,roomL);}
    x=Math.max(-lim,Math.min(lim,x));
    mesh=new THREE.Group();
    const core=new THREE.Mesh(sharedGeo('beamV',()=>new THREE.BoxGeometry(4,TOP_Y-FLOOR_Y+6,4)),M.dark2);mesh.add(core);
    const lit=new THREE.Mesh(sharedGeo('beamVLit',()=>new THREE.BoxGeometry(.6,TOP_Y-FLOOR_Y+6,4.2)),moving?M.mag:M.amber);lit.position.x=1.8;mesh.add(lit);
    const lit2=lit.clone();lit2.position.x=-1.8;mesh.add(lit2);
    mesh.position.set(x,(TOP_Y+FLOOR_Y)/2,z);
    min=new THREE.Vector3(x-2.1,FLOOR_Y,z-2.1);max=new THREE.Vector3(x+2.1,TOP_Y,z+2.1);
    if(moving){const amp=Math.min(5,Math.abs(x-gapX)-7);
      if(amp>1.5)move={axis:'x',base:x,amp,sp:.7+Math.random()*.9,ph:Math.random()*6.28,limit:lim};}
  }
  scene.add(mesh);beams.push({mesh,min,max,move,passed:false});
}
/* Spawn director: lays out coordinated patterns with guaranteed spacing and a viable
   line through every hazard, instead of scattering beams that can box the player in. */
function spawnDirector(playerZ){
  const spd=S.vel.length();
  const spaceMul=0.95+Math.min(0.6,spd/MAX_SPD*0.5);   // faster flight → more reaction room
  while(S.nextSpawnZ>playerZ-1500 && S.nextSpawnZ>-TRENCH_LEN+250){
    const z=S.nextSpawnZ;
    const depth=-z/TRENCH_LEN;                 // 0 at entry → 1 at the intake
    const r=Math.random();
    const fx=S.flowX, fy=S.flowY;              // the continuous safe corridor every gap is built around
    let advance=BEAM_GAP_MIN+Math.random()*70;
    if(depth>.12 && r<.13){                     // roll-gate: rewards matching ship roll
      spawnGate(z); advance=250+Math.random()*40;
    }else if(r<.34){                            // single beam — gap held on the flow line
      spawnBeam(z,{horizontal:true,gapY:fy});
    }else if(r<.52){                            // lane pillar — open side held on the flow line
      spawnBeam(z,{horizontal:false,gapX:fx});
    }else if(r<.68 && depth>.18){               // squeeze gate: top + bottom leave a slot on the line
      const sh=7;
      spawnBeam(z,  {horizontal:true,yc:Math.min(TOP_Y-4,fy+sh+1.8),moving:false});
      spawnBeam(z-3,{horizontal:true,yc:Math.max(FLOOR_Y+5,fy-sh-1.8),moving:false});
      advance=185+Math.random()*55;
    }else if(r<.80 && depth>.22){               // chicane: pillar, line sweeps across, pillar (well spaced)
      spawnBeam(z,{horizontal:false,gapX:fx});
      const fx2=-Math.sign(fx||1)*(HALF_W-12);
      spawnBeam(z-165,{horizontal:false,gapX:fx2});
      S.flowX=fx2;                              // commit the corridor to the new side
      advance=250+Math.random()*60;
    }else if(r<.92){                            // piston run — moving beam, gap still on the line
      spawnBeam(z,{horizontal:Math.random()<.5,moving:true,gapY:fy,gapX:fx});
      advance=165+Math.random()*60;
    }else{                                      // breather: open air to breathe & build speed
      advance=120+Math.random()*70;
    }
    // drift the corridor smoothly within a safe interior — gentle slalom, never a wall to cross
    S.flowY=Math.max(FLOOR_Y+11,Math.min(TOP_Y-11,S.flowY+(Math.random()*2-1)*7));
    S.flowX=Math.max(-(HALF_W-10),Math.min(HALF_W-10,S.flowX+(Math.random()*2-1)*9));
    // sparse ambient wall emplacement — texture you fly past, optional to shoot (never required)
    if(Math.random()<.22)spawnTurret(z-40-Math.random()*80);
    if(depth>.35 && Math.random()<.10 && bombers.length<2)spawnBomber(z-120);
    S.nextSpawnZ-=advance*spaceMul;
  }
}
/* roll gate: bulkhead with one angled slot — match its roll for OVERDRIVE */
function spawnGate(z){
  const angle=(Math.random()*2-1)*Math.PI*.45;
  const L=12, H=4.5;
  const g=new THREE.Group();
  const slot=new THREE.Group(); slot.rotation.z=angle; g.add(slot);
  for(const s of [-1,1]){
    const p1=new THREE.Mesh(sharedGeo('gateSide',()=>new THREE.BoxGeometry(60,H*2,2)),M.dark2);
    p1.position.set(s*(L+30),0,0);slot.add(p1);
  }
  for(const s of [-1,1]){
    const p2=new THREE.Mesh(sharedGeo('gateTop',()=>new THREE.BoxGeometry(140,60,2)),M.dark2);
    p2.position.set(0,s*(H+30),0);slot.add(p2);
  }
  for(const s of [-1,1]){
    const eY=new THREE.Mesh(sharedGeo('gateEdgeY',()=>new THREE.BoxGeometry(L*2+1,.5,2.4)),M.cyan);
    eY.position.set(0,s*H,0);slot.add(eY);
    const eX=new THREE.Mesh(sharedGeo('gateEdgeX',()=>new THREE.BoxGeometry(.5,H*2,2.4)),M.mag);
    eX.position.set(s*L,0,0);slot.add(eX);
  }
  g.position.set(0,(TOP_Y+FLOOR_Y)/2+4,z);
  scene.add(g);gates.push({group:g,z,angle,L,H,passed:false,cy:(TOP_Y+FLOOR_Y)/2+4});
}
function spawnTurret(z,opt){
  opt=opt||{};
  const side=opt.side!=null?opt.side:(Math.random()<.5?-1:1);
  const y=opt.y!=null?opt.y:FLOOR_Y+5+Math.random()*26;
  const g=new THREE.Group();
  const base=new THREE.Mesh(sharedGeo('turBase',()=>new THREE.CylinderGeometry(1.6,2.2,2.4,8)),M.dark2);
  base.rotation.z=side>0?Math.PI/2:-Math.PI/2;g.add(base);
  const head=new THREE.Mesh(sharedGeo('turHead',()=>new THREE.SphereGeometry(1.5,10,10)),M.dark);g.add(head);
  // eye + barrel live on the head, which lookAt()s the player (so -Z faces you)
  const eyeMat=new THREE.MeshBasicMaterial({color:0xff2d78});
  const eye=new THREE.Mesh(sharedGeo('turEye',()=>new THREE.SphereGeometry(.55,8,8)),eyeMat);eye.position.z=-1.2;head.add(eye);
  const barrel=new THREE.Mesh(sharedGeo('turBarrel',()=>new THREE.CylinderGeometry(.16,.2,1.8,6)),M.dark);
  barrel.rotation.x=Math.PI/2;barrel.position.z=-1.4;head.add(barrel);
  g.position.set(side*(HALF_W-1.2),y,z);
  scene.add(g);
  // ambient emplacement: lazily lobs slow, telegraphed tracers you weave past — never required to kill
  turrets.push({mesh:g,head,eye,eyeMat,side,hp:2,t:1.5+Math.random()*2.5,fireGlow:0,dead:false});
}
/* ---- pickups: fly through to collect (shield / missile / score) ---- */
const PICKUP_COL={shield:0x00f0ff,missile:0xffb300,score:0xff2d78};
function rollPickup(){const r=Math.random();return r<.38?'shield':r<.66?'missile':'score';}
function dropPickup(pos,kind){
  const c=PICKUP_COL[kind],g=new THREE.Group();
  const core=new THREE.Mesh(sharedGeo('pickCore',()=>new THREE.OctahedronGeometry(.85,0)),
    new THREE.MeshBasicMaterial({color:c,blending:THREE.AdditiveBlending,transparent:true,opacity:.95}));g.add(core);
  const ring=new THREE.Mesh(sharedGeo('pickRing',()=>new THREE.TorusGeometry(1.25,.08,6,18)),
    new THREE.MeshBasicMaterial({color:c,blending:THREE.AdditiveBlending,transparent:true,opacity:.7}));g.add(ring);
  g.position.copy(pos);scene.add(g);
  const light=takeLight(c,1.3,16);if(light)light.position.copy(pos);
  pickups.push({mesh:g,core,ring,light,kind,t:Math.random()*6,life:11});
}
function collectPickup(K){
  const c=PICKUP_COL[K.kind];burst(K.mesh.position,c,1.1);sfx('lock');
  if(K.kind==='shield'){S.shield=Math.min(100,S.shield+30);spawnPop(K.mesh.position,'+SHIELD','');}
  else if(K.kind==='missile'){S.missiles=Math.min(MSL_MAX+curShip.mslBonus,S.missiles+1);spawnPop(K.mesh.position,'+MISSILE','big');}
  else{S.score+=75;spawnPop(K.mesh.position,'+75','');}
}
/* enemy fighter: dart airframe + rear turret, weaves ahead of the player */
function spawnFighter(zAhead){
  const g=new THREE.Group();
  const body=new THREE.Mesh(sharedGeo('ftrBody',()=>new THREE.ConeGeometry(.8,4.0,4)),M.dark2);
  body.rotation.x=-Math.PI/2; body.rotation.y=Math.PI/4; g.add(body);
  const wing=new THREE.Mesh(sharedGeo('ftrWing',()=>new THREE.BoxGeometry(4.6,.1,1.2)),M.dark2);
  wing.position.set(0,0,.8); g.add(wing);
  const edge=new THREE.Mesh(sharedGeo('ftrEdge',()=>new THREE.BoxGeometry(4.7,.05,.14)),M.mag);
  edge.position.set(0,.08,1.3); g.add(edge);
  const fin=new THREE.Mesh(sharedGeo('ftrFin',()=>new THREE.BoxGeometry(.08,1.1,1.0)),M.dark2);
  fin.position.set(0,.6,1.4); g.add(fin);
  const eng=new THREE.Mesh(sharedGeo('ftrEng',()=>new THREE.SphereGeometry(.3,8,8)),M.boltE);
  eng.position.set(0,0,2.1); g.add(eng);
  const tur=new THREE.Group(); tur.position.set(0,.35,1.5); g.add(tur);
  const head=new THREE.Mesh(sharedGeo('ftrHead',()=>new THREE.SphereGeometry(.38,8,8)),M.dark); tur.add(head);
  const eye=new THREE.Mesh(sharedGeo('ftrEye',()=>new THREE.SphereGeometry(.16,6,6)),M.mag); eye.position.z=.34; head.add(eye);
  g.position.set((Math.random()*2-1)*(HALF_W-9), FLOOR_Y+8+Math.random()*24, zAhead);
  scene.add(g);
  fighters.push({mesh:g,head,hp:4,t:Math.random()*9,seed:Math.random()*9,fireT:1+Math.random(),dead:false,wvel:new THREE.Vector3(),
    // reactive-AI state: per-pilot profile + evasion
    ampX:.8+Math.random()*.7, ampY:.9+Math.random()*.6, app:250+Math.random()*120,
    evadeT:0, evadeCD:0, jx:0, jy:0, bank:0,
    state:'approach', stateT:0, passOff:(Math.random()-.5)*.2});  // arena attack-run state (near dead-on run)
}
/* heavy bomber: slow, armoured, lays drifting mines that force the player to re-route */
function spawnBomber(zAhead){
  const g=new THREE.Group();
  const hull=new THREE.Mesh(sharedGeo('bmbHull',()=>new THREE.BoxGeometry(3.4,1.8,5.2)),M.dark);g.add(hull);
  const belly=new THREE.Mesh(sharedGeo('bmbBelly',()=>new THREE.BoxGeometry(2.4,1.0,4.0)),M.dark2);belly.position.y=-1.0;g.add(belly);
  for(const sx of [-1,1]){
    const pod=new THREE.Mesh(sharedGeo('bmbPod',()=>new THREE.CylinderGeometry(.7,.7,2.2,8)),M.dark2);
    pod.rotation.x=Math.PI/2;pod.position.set(sx*2.4,0,1.0);g.add(pod);
    const fin=new THREE.Mesh(sharedGeo('bmbFin',()=>new THREE.BoxGeometry(.12,1.6,1.6)),M.dark);
    fin.position.set(sx*1.7,1.1,1.8);g.add(fin);
  }
  const stripe=new THREE.Mesh(sharedGeo('bmbStripe',()=>new THREE.BoxGeometry(3.5,.18,5.3)),M.amber);stripe.position.y=.95;g.add(stripe);
  const glow=new THREE.Mesh(sharedGeo('bmbGlow',()=>new THREE.SphereGeometry(.5,8,8)),M.glow.clone());glow.position.set(0,0,2.7);g.add(glow);
  g.position.set((Math.random()*2-1)*(HALF_W-12), FLOOR_Y+10+Math.random()*16, zAhead);
  scene.add(g);
  bombers.push({mesh:g,glow,hp:14,t:Math.random()*9,seed:Math.random()*9,mineT:1.6+Math.random(),dead:false,wvel:new THREE.Vector3()});
}
function dropMine(pos){
  const g=new THREE.Group();
  const core=new THREE.Mesh(sharedGeo('mineCore',()=>new THREE.IcosahedronGeometry(.9,0)),M.dark2);g.add(core);
  const lit=new THREE.Mesh(sharedGeo('mineLit',()=>new THREE.IcosahedronGeometry(1.05,0)),
    new THREE.MeshBasicMaterial({color:0xff2d78,wireframe:true,transparent:true,opacity:.85}));g.add(lit);
  const eye=new THREE.Mesh(sharedGeo('mineEye',()=>new THREE.SphereGeometry(.32,8,8)),M.glow.clone());g.add(eye);
  g.position.copy(pos);scene.add(g);
  mines.push({mesh:g,eye,t:Math.random()*6,life:14});
}
function buildPort(){
  portGroup=new THREE.Group();
  const wall=new THREE.Mesh(sharedGeo('portWall',()=>new THREE.BoxGeometry(HALF_W*2+8,90,6)),M.dark);
  wall.position.set(0,(TOP_Y+FLOOR_Y)/2+14,0);portGroup.add(wall);
  const ringO=new THREE.Mesh(sharedGeo('portRingO',()=>new THREE.TorusGeometry(7,.7,8,40)),M.mag);ringO.position.set(0,0,3.2);portGroup.add(ringO);
  const ringI=new THREE.Mesh(sharedGeo('portRingI',()=>new THREE.TorusGeometry(4.5,.4,8,40)),M.cyan);ringI.position.set(0,0,3.4);portGroup.add(ringI);
  exhaustPort=new THREE.Mesh(sharedGeo('portCore',()=>new THREE.CircleGeometry(4,24)),
    new THREE.MeshBasicMaterial({color:0xff8866,blending:THREE.AdditiveBlending,transparent:true}));
  exhaustPort.position.set(0,0,3.5);portGroup.add(exhaustPort);
  portGroup.position.set(0,0,-TRENCH_LEN);
  scene.add(portGroup);
}
