"use strict";
/* Player ship meshes: hull exterior, cockpit interior, hangar thumbnails. */

/* ============================ PLAYER SHIP ============================ */
let canopy=null, cockpit=null, stickPivot=null, throttleLever=null, muzzleLight=null;
const muzzles=[];       // player's live muzzle-flash meshes, index-aligned with curGunPositions
let curGunPositions=[]; // {x,y,z} tip offsets for the equipped hull — bolt spawn points
let engineLights=[];    // pulses with throttle/boost — the thrusters actually light up nearby geometry
/* Exterior-only hull builder — shared by the live player ship AND the hangar thumbnails.
   Takes a ship's `visual` config and returns the group plus the bits a caller may need
   (canopy for FP/TP toggling, gun tip points + muzzle meshes for the firing system).
   Deliberately has NO side effects on module state — callers decide what to do with it,
   so building a disposable thumbnail can never clobber the real player ship's references. */
function buildShipExterior(cfg){
  const g=new THREE.Group();
  const shape=cfg.hullShape||'diamond';
  const edgeMat1=new THREE.MeshBasicMaterial({color:cfg.edgeColor});
  const edgeMat2=new THREE.MeshBasicMaterial({color:cfg.edgeColor2});
  /* ---- fuselage: shape-specific silhouette (this is the main "these look different now" lever) ---- */
  let wingZ=1.2;
  if(shape==='needle'){
    // slender interceptor: long thin hull, a forward spike, swept canard fins
    const hull=new THREE.Mesh(new THREE.ConeGeometry(cfg.hullR,cfg.hullLen,4),M.dark2);
    hull.rotation.x=-Math.PI/2; hull.rotation.y=Math.PI/4; g.add(hull);
    const spike=new THREE.Mesh(new THREE.ConeGeometry(cfg.hullR*.3,1.7,4),M.dark);
    spike.rotation.x=-Math.PI/2; spike.rotation.y=Math.PI/4; spike.position.z=-(cfg.hullLen*.5+.75); g.add(spike);
    for(const sx of [-1,1]){ // forward canard fins
      const canard=new THREE.Mesh(new THREE.BoxGeometry(1.0,.05,.46),M.dark2);
      canard.position.set(sx*.82,-.05,-cfg.hullLen*.2); canard.rotation.z=sx*-.14; g.add(canard);
      const cEdge=new THREE.Mesh(new THREE.BoxGeometry(1.05,.03,.09),edgeMat1);
      cEdge.position.set(sx*.82,-.03,-cfg.hullLen*.2-.2); canard.rotation.z=sx*-.14; g.add(cEdge);
    }
    wingZ=1.5;
  }else if(shape==='block'){
    // armored gunship: boxy fuselage, angled flank plates, dorsal spine, blunt nose
    const hull=new THREE.Mesh(new THREE.BoxGeometry(cfg.hullR*1.5,cfg.hullR*1.25,cfg.hullLen),M.dark2);
    hull.position.z=.4; g.add(hull);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(cfg.hullR*.82,1.7,4),M.dark2);
    nose.rotation.x=-Math.PI/2; nose.rotation.y=Math.PI/4; nose.position.z=-(cfg.hullLen*.5+.45); g.add(nose);
    for(const sx of [-1,1]){ // angled flank armor plates
      const plate=new THREE.Mesh(new THREE.BoxGeometry(.16,cfg.hullR*1.05,cfg.hullLen*.7),M.dark);
      plate.position.set(sx*cfg.hullR*.86,0,.4); plate.rotation.y=sx*.17; g.add(plate);
      const plateEdge=new THREE.Mesh(new THREE.BoxGeometry(.05,.09,cfg.hullLen*.66),edgeMat1);
      plateEdge.position.set(sx*(cfg.hullR*.86+.1),cfg.hullR*.36,.4); plateEdge.rotation.y=sx*.17; g.add(plateEdge);
    }
    // spine sits over the AFT half of the hull only — the forward half is where the FP camera
    // eye-point lives (~z .5), and a spine spanning that far forward clips straight through it
    const spineZ=cfg.hullLen*.32;
    const spine=new THREE.Mesh(new THREE.BoxGeometry(.32,.75,cfg.hullLen*.24),M.dark);
    spine.position.set(0,cfg.hullR*.82,spineZ); g.add(spine);
    const spineLit=new THREE.Mesh(new THREE.BoxGeometry(.09,.55,cfg.hullLen*.2),edgeMat2);
    spineLit.position.set(0,cfg.hullR*.82+.03,spineZ); g.add(spineLit);
  }else{
    // diamond (baseline): the original cone-hull silhouette, unchanged
    const hull=new THREE.Mesh(new THREE.ConeGeometry(cfg.hullR,cfg.hullLen,4),M.dark2);
    hull.rotation.x=-Math.PI/2; hull.rotation.y=Math.PI/4; g.add(hull);
  }
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(.55,8,8),M.cyan);
  canopy.position.set(cfg.canopyPos[0],cfg.canopyPos[1],cfg.canopyPos[2]);
  canopy.scale.set(cfg.canopyScale[0],cfg.canopyScale[1],cfg.canopyScale[2]); g.add(canopy);
  /* ---- wings: needle gets a swept delta pair, diamond/block keep the straight full-span panel ---- */
  if(shape==='needle'){
    for(const sx of [-1,1]){
      const hw=new THREE.Mesh(new THREE.BoxGeometry(cfg.wingSpan*.52,cfg.wingThick,1.7),M.dark2);
      hw.position.set(sx*cfg.wingSpan*.26,-.1,wingZ+.35); hw.rotation.y=sx*.36; g.add(hw);
      const e=new THREE.Mesh(new THREE.BoxGeometry(cfg.wingSpan*.55,.045,.14),edgeMat1);
      e.position.set(sx*cfg.wingSpan*.26,0,wingZ+1.1); e.rotation.y=sx*.36; g.add(e);
    }
  }else{
    const wing=new THREE.Mesh(new THREE.BoxGeometry(cfg.wingSpan,cfg.wingThick,1.9),M.dark2);
    wing.position.set(0,-.1,wingZ); g.add(wing);
    const edge=new THREE.Mesh(new THREE.BoxGeometry(cfg.wingSpan+.1,.05,.18),edgeMat1);
    edge.position.set(0,0,wingZ+.7); g.add(edge);
    if(cfg.doubleEdge){const edge2=edge.clone(); edge2.position.z=wingZ+1.15; edge2.material=edgeMat2; g.add(edge2);}
  }
  const flames=[];
  const engZ=wingZ+.7, flameZ=engZ+.95;
  for(const sx of [-1,1]){
    const eng=new THREE.Mesh(new THREE.CylinderGeometry(cfg.engineR1,cfg.engineR2,cfg.engineLen,8),M.dark);
    eng.rotation.x=Math.PI/2; eng.position.set(sx*cfg.engineX,-.1,engZ); g.add(eng);
    // bigger base flame sphere — punchier default "thrusters firing" look, before throttle scaling
    const fl=new THREE.Mesh(new THREE.SphereGeometry(.36*(cfg.engineR2/.42),8,8),M.flame.clone());
    fl.position.set(sx*cfg.engineX,-.1,flameZ); fl.userData.flame=true; g.add(fl); flames.push(fl);
  }
  const gunTips=[],muzzleMeshes=[];
  cfg.guns.forEach(gp=>{
    const gun=new THREE.Mesh(new THREE.CylinderGeometry(cfg.gunR,cfg.gunR,cfg.gunLen,6),M.dark);
    gun.rotation.x=Math.PI/2; gun.position.set(gp.x,gp.y,cfg.gunZ); g.add(gun);
    const tip=new THREE.Mesh(new THREE.CylinderGeometry(cfg.gunR*1.3,cfg.gunR*.78,.3,6),edgeMat1);
    tip.rotation.x=Math.PI/2; tip.position.set(gp.x,gp.y,cfg.gunTipZ); g.add(tip);
    // muzzle flash (additive, pulsed on fire)
    const mz=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),
      new THREE.MeshBasicMaterial({color:0x9ff7ff,blending:THREE.AdditiveBlending,transparent:true,opacity:0}));
    mz.position.set(gp.x,gp.y,cfg.gunTipZ-.15); mz.scale.set(1,1,2.6); g.add(mz);
    gunTips.push({x:gp.x,y:gp.y,z:cfg.gunTipZ}); muzzleMeshes.push(mz);
  });
  if(cfg.pod){ // heavy-hull ordnance pod (flavor — reads as "more missiles")
    const pod=new THREE.Mesh(new THREE.BoxGeometry(1.0,.6,2.2),M.dark2); pod.position.set(0,-.7,1.0); g.add(pod);
    const podLit=new THREE.Mesh(new THREE.BoxGeometry(1.02,.06,2.0),edgeMat1); podLit.position.set(0,-.42,1.0); g.add(podLit);
  }
  const light=new THREE.PointLight(0x00f0ff,1.0,36); light.position.set(0,1.5,2); g.add(light);
  return {group:g,canopy,flames,gunTips,muzzleMeshes};
}
function buildShip(shipCfg){
  const ext=buildShipExterior(shipCfg.visual);
  const s=ext.group;
  canopy=ext.canopy;
  muzzles.length=0; ext.muzzleMeshes.forEach(m=>muzzles.push(m));
  curGunPositions=ext.gunTips;
  engineLights.length=0;
  ext.flames.forEach(fl=>{const el=new THREE.PointLight(0x35e8ff,0,11); el.position.copy(fl.position); s.add(el); engineLights.push(el);});
  muzzleLight=new THREE.PointLight(0x6ff2ff,0,22); muzzleLight.position.set(0,-.1,-1.4); s.add(muzzleLight);
  /* ---- 2.0 cockpit interior (first-person only) — shared across all hulls ---- */
  cockpit=new THREE.Group(); s.add(cockpit);
  const frameMat=new THREE.MeshBasicMaterial({color:0x020309});
  const dash=new THREE.Mesh(new THREE.BoxGeometry(2.2,.35,.7),frameMat);
  dash.position.set(0,.42,-.25); dash.rotation.x=.3; cockpit.add(dash);
  const dashGlow=new THREE.Mesh(new THREE.BoxGeometry(1.6,.02,.03),M.amber);
  dashGlow.position.set(0,.705,-.545); dashGlow.rotation.x=.3; cockpit.add(dashGlow);
  for(let i=0;i<6;i++){ // instrument cluster
    const inst=new THREE.Mesh(new THREE.BoxGeometry(.07,.015,.035),[M.cyan,M.mag,M.amber][i%3]);
    inst.position.set(-.55+i*.22,.625,-.30); inst.rotation.x=.3; cockpit.add(inst);
  }
  for(const sx of [-1,1]){ // MFD panes
    const mfd=new THREE.Mesh(new THREE.PlaneGeometry(.34,.22),
      new THREE.MeshBasicMaterial({color:0x07313a}));
    mfd.position.set(sx*.62,.56,-.13); mfd.rotation.x=-.95; cockpit.add(mfd);
  }
  for(const sx of [-1,1]){ // A-pillars + sills
    const pil=new THREE.Mesh(new THREE.BoxGeometry(.10,1.5,.10),frameMat);
    pil.position.set(sx*.98,1.0,-.05); pil.rotation.z=sx*.42; pil.rotation.x=-.25; cockpit.add(pil);
    const sill=new THREE.Mesh(new THREE.BoxGeometry(.16,.5,1.6),frameMat);
    sill.position.set(sx*1.08,.72,.55); cockpit.add(sill);
  }
  const bow=new THREE.Mesh(new THREE.BoxGeometry(2.3,.10,.12),frameMat);
  bow.position.set(0,1.5,-.35); cockpit.add(bow);
  /* ---- 2.6 lit canopy frame: dark struts with bright thin accent strips (SC-style) ----
     tinted to the equipped hull's own colors so the cockpit reads as "this ship", not a
     shared interior — Viper's cabin runs cold mono-cyan, Bulwark's runs hot amber/red. */
  const accent =new THREE.MeshBasicMaterial({color:shipCfg.visual.edgeColor,blending:THREE.AdditiveBlending,transparent:true,opacity:.9});
  const accentA=new THREE.MeshBasicMaterial({color:shipCfg.visual.edgeColor2,blending:THREE.AdditiveBlending,transparent:true,opacity:.8});
  for(const sx of [-1,1]){
    // glow strip running up each A-pillar (matches the pillar transform)
    const pg=new THREE.Mesh(new THREE.BoxGeometry(.04,1.5,.04),accent);
    pg.position.set(sx*.93,1.0,-.02); pg.rotation.z=sx*.42; pg.rotation.x=-.25; cockpit.add(pg);
    // upper canopy split — twin diagonals meeting near top-centre (the SC signature)
    const sp=new THREE.Mesh(new THREE.BoxGeometry(.085,1.2,.085),frameMat);
    sp.position.set(sx*.32,1.36,-.52); sp.rotation.z=sx*.52; sp.rotation.x=-.12; cockpit.add(sp);
    const spg=new THREE.Mesh(new THREE.BoxGeometry(.03,1.16,.03),accent);
    spg.position.set(sx*.32,1.36,-.47); spg.rotation.z=sx*.52; spg.rotation.x=-.12; cockpit.add(spg);
    // window-corner brace tying pillar to dash
    const br=new THREE.Mesh(new THREE.BoxGeometry(.07,.5,.07),frameMat);
    br.position.set(sx*.86,.7,-.5); br.rotation.z=sx*.7; cockpit.add(br);
  }
  // top bow accent + a lit lower windshield rail framing the view
  const bowG=new THREE.Mesh(new THREE.BoxGeometry(2.0,.035,.035),accent); bowG.position.set(0,1.47,-.31); cockpit.add(bowG);
  const lrail=new THREE.Mesh(new THREE.BoxGeometry(2.15,.09,.10),frameMat); lrail.position.set(0,.62,-.64); lrail.rotation.x=.16; cockpit.add(lrail);
  const lrailG=new THREE.Mesh(new THREE.BoxGeometry(1.95,.03,.03),accentA); lrailG.position.set(0,.67,-.665); lrailG.rotation.x=.16; cockpit.add(lrailG);
  const stickMat=new THREE.MeshBasicMaterial({color:0x10131f});
  /* ---- flight stick (lower-right, raked toward the pilot, tilts with steering input) ---- */
  const stick=new THREE.Group(); stick.position.set(.34,.12,-.26); stick.rotation.x=.32; cockpit.add(stick);
  const stBase=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,.12,10),frameMat); stick.add(stBase);
  const stGimbal=new THREE.Mesh(new THREE.SphereGeometry(.09,8,8),frameMat); stGimbal.position.y=.06; stick.add(stGimbal);
  stickPivot=new THREE.Group(); stickPivot.position.y=.06; stick.add(stickPivot);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.5,8),stickMat); shaft.position.y=.25; stickPivot.add(shaft);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,.26,8),frameMat); grip.position.y=.55; stickPivot.add(grip);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.11,.06,.02),M.mag); trig.position.set(0,.54,.085); stickPivot.add(trig);
  const topBtn=new THREE.Mesh(new THREE.SphereGeometry(.032,6,6),M.amber); topBtn.position.set(0,.69,0); stickPivot.add(topBtn);
  /* ---- throttle lever (lower-left, slides with throttle) ---- */
  const thr=new THREE.Group(); thr.position.set(-.46,.2,-.3); thr.rotation.x=.22; cockpit.add(thr);
  const thrRail=new THREE.Mesh(new THREE.BoxGeometry(.12,.05,.5),frameMat); thr.add(thrRail);
  const thrGuide=new THREE.Mesh(new THREE.BoxGeometry(.02,.04,.48),M.cyan); thrGuide.position.y=.02; thr.add(thrGuide);
  throttleLever=new THREE.Group(); thr.add(throttleLever);
  const thrStem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.26,6),stickMat); thrStem.position.y=.13; thrStem.rotation.x=-.35; throttleLever.add(thrStem);
  const thrKnob=new THREE.Mesh(new THREE.BoxGeometry(.16,.09,.12),frameMat); thrKnob.position.set(0,.26,-.05); throttleLever.add(thrKnob);
  const thrLit=new THREE.Mesh(new THREE.BoxGeometry(.17,.016,.02),M.amber); thrLit.position.set(0,.31,-.05); throttleLever.add(thrLit);
  const cab=new THREE.PointLight(0x00f0ff,.25,4); cab.position.set(0,1.2,.4); s.add(cab);
  return s;
}
/* the actual hull depends on curShip (progression data defined further below), so the first
   build is deferred to rebuildShip() once that's available — see the call after SHIPS/curShip. */
let ship=null;
let flameMeshes=[];
function rebuildShip(){
  if(ship)scene.remove(ship);
  ship=buildShip(curShip);
  scene.add(ship);
  flameMeshes.length=0; ship.traverse(o=>{if(o.userData.flame)flameMeshes.push(o);});
}
/* ---- hangar thumbnails: a tiny disposable offscreen render per hull, cached once (ships
   are static data so there's no reason to re-render on every hangar visit) ---- */
const shipThumbCache={};
function renderShipThumb(shipCfg){
  if(shipThumbCache[shipCfg.id])return shipThumbCache[shipCfg.id];
  const W=260,H=150;
  const tr=new THREE.WebGLRenderer({antialias:true,alpha:true});
  tr.setSize(W,H);
  const ts=new THREE.Scene();
  ts.add(new THREE.AmbientLight(0x445577,1.15));
  const dl=new THREE.DirectionalLight(0xcfe8ff,1.3); dl.position.set(2,3,2); ts.add(dl);
  const dl2=new THREE.DirectionalLight(0x3d7bff,.55); dl2.position.set(-2,-1,-3); ts.add(dl2);
  const ext=buildShipExterior(shipCfg.visual);
  ext.group.rotation.set(.26,-.6,0);   // 3/4 hero angle: shows nose/guns, canopy, one wing
  ts.add(ext.group);
  const dist=6.5+shipCfg.visual.wingSpan*.35;   // scale distance to hull size so all 3 frame similarly
  const tc=new THREE.PerspectiveCamera(34,W/H,.1,50);
  tc.position.set(-dist*.42,dist*.24,-dist*.82); tc.lookAt(0,.08,0);
  tr.render(ts,tc);
  const url=tr.domElement.toDataURL('image/png');
  tr.dispose();
  shipThumbCache[shipCfg.id]=url;
  return url;
}
