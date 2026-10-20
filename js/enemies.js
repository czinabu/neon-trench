"use strict";
/* Hazards + enemies: beams, spawn director, roll gates, turrets, pickups, fighters, bombers, mines, reactor port. */

/* ============================ HAZARDS / ENEMIES ============================ */
const beams=[];    // {mesh,min,max,move?}
const gates=[];    // {group,z,angle,L,H,passed,cy}
const turrets=[];  // {mesh,head,hp,t,z,dead}
const fighters=[]; // {mesh,head,kind,T,hp,...} every enemy ship class (see spawnFighter)
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
/* ---- enemy ship models (nose toward -z, like the player's). One shared set of materials and one
   geometry per part, built on first use, so spawning stays allocation-free after the first of each class. ---- */
let EMAT=null;
function enemyMats(){
  if(EMAT)return EMAT;
  const env=getShipEnvMap(),panel=getHullPanelTex();
  const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,map:panel,metalness:.6,roughness:.45,envMap:env,envMapIntensity:.35},o||{}));
  const add=c=>new THREE.MeshBasicMaterial({color:c,blending:THREE.AdditiveBlending,transparent:true,opacity:.95});
  EMAT={
    hull:std(0x2f3542), hull2:std(0x1b1f28,{roughness:.6}),
    dartHull:std(0x4a3528,{metalness:.5}), hunterHull:std(0x2a2d24,{roughness:.55}),
    aceHull:std(0x101014,{metalness:.8,roughness:.3,envMapIntensity:.6}),
    leaderHull:std(0x3a0a12,{metalness:.75,roughness:.32,envMapIntensity:.55}),
    gold:new THREE.MeshStandardMaterial({color:0xd8a22a,metalness:1,roughness:.28,envMap:env,envMapIntensity:.9,emissive:0x3a2600}),
    glass:new THREE.MeshStandardMaterial({color:0x05070a,metalness:1,roughness:.08,envMap:env,envMapIntensity:1.1,emissive:0x2a0610}),
    mag:M.mag, amber:M.amber, orange:new THREE.MeshBasicMaterial({color:0xff7a1a}), red:new THREE.MeshBasicMaterial({color:0xff2a2a}),
    engMag:add(0xff2d78), engOrange:add(0xff8a2a), engWhite:add(0xffe2b0), engRed:add(0xff3030),
    shield:new THREE.MeshBasicMaterial({color:0xff4a6a,blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false}),
  };
  return EMAT;
}
/* visibility beacon: a warm glow that keeps the same size on screen at any range, so a hostile reads
   against the stars and dust long before its hull does (red fighters, amber heavies, gold aces) */
const beaconMats={};
function addBeacon(g,col){
  const m=beaconMats[col]||(beaconMats[col]=new THREE.SpriteMaterial({map:glowTex,color:col,blending:THREE.AdditiveBlending,
    transparent:true,opacity:.85,depthWrite:false,sizeAttenuation:false,fog:false}));
  const sp=new THREE.Sprite(m);sp.scale.setScalar(.03/g.scale.x);g.add(sp);return sp;
}
const eGeo=(k,f)=>sharedGeo('e_'+k,f);
function eMesh(g,geo,mat,x,y,z,sx){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);if(sx)m.scale.x=sx;g.add(m);return m;}
function eWings(g,key,span,rootLE,rootTE,tipLE,tipTE,thick,mat,y,x0,edgeMat,edgeW){
  const geo=eGeo(key,()=>panelGeometry(span,rootLE,rootTE,tipLE,tipTE,thick));
  for(const sx of[-1,1]){
    eMesh(g,geo,mat,sx*x0,y,0,sx);
    if(edgeMat)g.add(stripMesh(sx*x0,rootLE,sx*(x0+span),tipLE,y+thick*.75,edgeMat,edgeW||.05));
  }
}
function eEngine(g,key,r,z,x,mat){   // glowing nozzle disc + bell
  eMesh(g,eGeo(key+'Bell',()=>new THREE.CylinderGeometry(r*1.1,r*.9,.5,12,1,true).rotateX(Math.PI/2)),EMAT.hull2,x,0,z-.2);
  return eMesh(g,eGeo(key+'Glow',()=>new THREE.SphereGeometry(r,10,8).scale(1,1,.6)),mat,x,0,z);
}
const ENEMY_BUILD={
  grunt(g){   // syndicate line fighter: wedge fuselage, swept wings, twin canted fins
    const E=EMAT;
    eMesh(g,eGeo('gBody',()=>loftGeometry([{z:-2.5,w:0,h:0,y:0},{z:-1.8,w:.24,h:.16,y:0},{z:-.6,w:.5,h:.32,y:.04},
      {z:.8,w:.6,h:.36,y:.04},{z:1.8,w:.48,h:.3,y:0},{z:2.2,w:.36,h:.22,y:0}],3.4,14)),E.hull);
    eMesh(g,eGeo('gCan',()=>new THREE.SphereGeometry(.3,12,8,0,Math.PI*2,0,Math.PI/2).scale(1,.8,2.2)),E.glass,0,.28,-.7);
    eWings(g,'gWing',2.1,-.1,1.5,1.0,1.7,.12,E.hull2,-.05,.4,E.mag,.06);
    for(const sx of[-1,1]){const f=eMesh(g,eGeo('gFin',()=>panelGeometry(.8,1.0,2.1,1.7,2.15,.07)),E.hull2,sx*.32,.25,0);f.rotation.z=Math.PI/2-sx*.4;}
    eEngine(g,'gEng',.3,2.25,0,E.engMag);
  },
  dart(g){    // light interceptor: needle body, small delta, twin hot engines
    const E=EMAT;
    eMesh(g,eGeo('dBody',()=>loftGeometry([{z:-2.2,w:0,h:0,y:0},{z:-1.4,w:.16,h:.12,y:0},{z:-.2,w:.3,h:.2,y:.02},
      {z:1.0,w:.34,h:.2,y:.02},{z:1.6,w:.26,h:.16,y:0}],2.6,12)),E.dartHull);
    eMesh(g,eGeo('dCan',()=>new THREE.SphereGeometry(.18,10,6,0,Math.PI*2,0,Math.PI/2).scale(1,.9,2.4)),E.glass,0,.16,-.4);
    eWings(g,'dWing',1.3,-.5,1.3,1.0,1.4,.07,E.dartHull,0,.25,E.orange,.04);
    for(const sx of[-1,1])eEngine(g,'dEng',.15,1.7,sx*.17,E.engOrange);
  },
  hunter(g){  // missile boat: boxy hull, stub wings carrying launch pods, red sensor eye
    const E=EMAT;
    eMesh(g,eGeo('hBody',()=>loftGeometry([{z:-2.3,w:.5,h:.34,y:-.05},{z:-1.8,w:.9,h:.55,y:0},{z:.6,w:1.0,h:.62,y:.02},
      {z:2.2,w:.85,h:.52,y:0},{z:2.6,w:.7,h:.42,y:0}],5,16)),E.hunterHull);
    eMesh(g,eGeo('hEye',()=>new THREE.SphereGeometry(.26,10,8)),E.red,0,-.05,-2.3);
    eWings(g,'hWing',1.3,-.2,1.5,.4,1.3,.16,E.hull2,-.1,.85,E.amber,.06);
    for(const sx of[-1,1]){
      eMesh(g,eGeo('hPod',()=>new THREE.CylinderGeometry(.34,.34,2.4,10).rotateX(Math.PI/2)),E.hull2,sx*1.7,-.1,.4);
      for(const dx of[-.13,.13])eMesh(g,eGeo('hTip',()=>new THREE.ConeGeometry(.09,.3,6).rotateX(-Math.PI/2)),E.red,sx*1.7+dx,-.1,-.9);
      eEngine(g,'hEng',.26,2.7,sx*.45,E.engMag);
    }
    eMesh(g,eGeo('hDish',()=>new THREE.CylinderGeometry(.35,.12,.12,12)),E.hull2,0,.68,.6);
  },
  ace(g,leader){   // elite: black (crimson for the leader) gloss hull, gold trim, forward-swept wings
    const E=EMAT,hull=leader?E.leaderHull:E.aceHull;
    eMesh(g,eGeo('aBody',()=>loftGeometry([{z:-2.8,w:0,h:0,y:0},{z:-2.1,w:.2,h:.14,y:0},{z:-.8,w:.44,h:.3,y:.04},
      {z:.6,w:.56,h:.34,y:.04},{z:1.7,w:.5,h:.3,y:0},{z:2.3,w:.36,h:.22,y:0}],2.8,16)),hull);
    eMesh(g,eGeo('aCan',()=>new THREE.SphereGeometry(.28,12,8,0,Math.PI*2,0,Math.PI/2).scale(1,.8,2.6)),E.glass,0,.28,-.9);
    eMesh(g,eGeo('aSpine',()=>new THREE.BoxGeometry(.06,.05,2.6)),E.gold,0,.36,.6);
    eWings(g,'aWing',2.3,.5,1.8,-.3,.5,.1,hull,-.04,.45,E.gold,.06);    // forward sweep: tip ahead of root
    eWings(g,'aCanard',.7,-1.7,-1.2,-1.3,-1.1,.06,hull,.02,.3,E.gold,.035);
    for(const sx of[-1,1]){
      const f=eMesh(g,eGeo('aFin',()=>panelGeometry(.95,1.1,2.3,1.9,2.35,.07)),hull,sx*.34,.25,0);f.rotation.z=Math.PI/2-sx*.32;
      eEngine(g,'aEng',.24,2.35,sx*.2,leader?E.engRed:E.engWhite);
    }
  },
};
/* enemy ship of a class from ENEMY_TYPES (js/data/enemies.js); trench ships weave ahead of the
   player, arena ships fly attack runs (see js/update/enemies.js) */
function spawnFighter(zAhead,kind){
  kind=kind||'grunt';const T=ENEMY_TYPES[kind]||ENEMY_TYPES.grunt;
  enemyMats();
  const g=new THREE.Group();
  if(kind==='leader')ENEMY_BUILD.ace(g,true);else (ENEMY_BUILD[kind]||ENEMY_BUILD.grunt)(g);
  // dorsal sensor head: aims at the player and is where trench shots come from
  const head=new THREE.Group();head.position.set(0,.45,1.0);g.add(head);
  let shield=null;
  if(kind==='leader'){g.scale.setScalar(1.35);
    shield=new THREE.Mesh(eGeo('lShield',()=>new THREE.SphereGeometry(4.2,20,14)),EMAT.shield.clone());g.add(shield);}
  addBeacon(g,T.ace?0xffc830:kind==='hunter'?0xff9a20:0xff3a2a);
  g.position.set((Math.random()*2-1)*(HALF_W-9), FLOOR_Y+8+Math.random()*24, zAhead);
  scene.add(g);
  const F={mesh:g,head,kind,T,hp:T.hp,t:Math.random()*9,seed:Math.random()*9,fireT:1+Math.random(),dead:false,wvel:new THREE.Vector3(),
    // reactive-AI state: per-pilot profile + evasion
    ampX:.8+Math.random()*.7, ampY:.9+Math.random()*.6,
    app:kind==='hunter'?480+Math.random()*80:kind==='dart'?190+Math.random()*90:250+Math.random()*120,
    evadeT:0, evadeCD:0, jx:0, jy:0, bank:0,
    state:'approach', stateT:0, passOff:(Math.random()-.5)*.2,   // arena attack-run state (near dead-on run)
    burst:0, burstT:0, jinkT:0, jinkCD:0, jinkDir:new THREE.Vector3(), attacks:0, shield,
    // arena pilot state (see arenaPilot): attack role, cruise speed, banking up-vector, break manoeuvre
    attacker:false, roleT:0, spd:T.speed, up:new THREE.Vector3(0,1,0), side:Math.random()<.5?-1:1, alt:(Math.random()-.5)*120,
    breakCD:0, breakDir:new THREE.Vector3(), reversed:false, trailT:0,
    callsign:kind==='leader'?LEADER_CALLSIGN:T.ace?ACE_CALLSIGNS[(Math.random()*ACE_CALLSIGNS.length)|0]:''};
  fighters.push(F);
  return F;
}
/* enemy homing missile: turn-rate-limited pursuit; outturn it, outrun it on boost, or shoot it down */
const eMsls=[];   // {m,v,life,decoy}
function spawnEnemyMissile(pos,dir){
  enemyMats();
  const g=new THREE.Group();
  eMesh(g,eGeo('emBody',()=>new THREE.CylinderGeometry(.14,.14,1.4,8).rotateX(Math.PI/2)),EMAT.hull2);
  eMesh(g,eGeo('emNose',()=>new THREE.ConeGeometry(.14,.4,8).rotateX(-Math.PI/2)),EMAT.red,0,0,-.9);
  eMesh(g,eGeo('emGlow',()=>new THREE.SphereGeometry(.32,8,6)),EMAT.engRed,0,0,.8);
  g.position.copy(pos);scene.add(g);
  eMsls.push({m:g,v:dir.clone().setLength(150),life:7,decoy:flareDecoy()});   // decoy: the flare it is chasing instead of you
  sfx('elaunch',pos);
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
  addBeacon(g,0xff9a20);
  g.position.set((Math.random()*2-1)*(HALF_W-12), FLOOR_Y+10+Math.random()*16, zAhead);
  scene.add(g);
  bombers.push({mesh:g,glow,hp:14,maxHp:14,t:Math.random()*9,seed:Math.random()*9,mineT:1.6+Math.random(),dead:false,wvel:new THREE.Vector3()});
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
