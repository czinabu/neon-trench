"use strict";
/* Player ship meshes: hull exterior, cockpit interior, hangar thumbnails. */

/* ============================ PLAYER SHIP ============================ */
let canopy=null, cockpit=null, stickPivot=null, throttleLever=null, muzzleLight=null;
const muzzles=[];       // player's live muzzle-flash meshes, index-aligned with curGunPositions
let curGunPositions=[]; // {x,y,z} tip offsets for the equipped hull — bolt spawn points
let engineLights=[];
let shipStrobes=[];
let cabLight=null;     // white anti-collision strobes on the fin tips, blinked in updateCamera    // pulses with throttle/boost — the thrusters actually light up nearby geometry
/* ---------- shared ship surfacing: reflection map, panel texture, geometry helpers ---------- */
/* A tiny neon-city backdrop rendered once into a reflection map, so the metal hulls pick up
   cyan/magenta highlights the way they would flying through the arcology. */
let shipEnvMap=null;
function getShipEnvMap(){
  if(shipEnvMap)return shipEnvMap;
  const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#05081a');gr.addColorStop(.38,'#18224c');gr.addColorStop(.47,'#3a2a6a');
  gr.addColorStop(.5,'#ff5aa8');gr.addColorStop(.53,'#221a40');gr.addColorStop(.6,'#0b6d8a');
  gr.addColorStop(.63,'#00e0ff');gr.addColorStop(.67,'#0b0f22');gr.addColorStop(1,'#020308');
  g.fillStyle=gr;g.fillRect(0,0,512,256);
  const cols=['#00f0ff','#ff2d78','#ffd18a','#ffffff'];
  for(let i=0;i<70;i++){g.globalAlpha=.4+Math.random()*.6;g.fillStyle=cols[(Math.random()*cols.length)|0];
    g.fillRect(Math.random()*512,92+Math.random()*60,2+Math.random()*12,2+Math.random()*10);}
  g.globalAlpha=1;g.fillStyle='#cfe8ff';g.fillRect(0,10,512,6);   // overhead strip light
  const es=new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10,48,24),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.BackSide})));
  const pm=new THREE.PMREMGenerator(renderer);
  shipEnvMap=pm.fromScene(es,0).texture;pm.dispose();
  return shipEnvMap;
}
/* Greyscale hull plating (tinted per ship by the material colour): panel seams, inset plates,
   rivet rows and a few service hatches. */
let hullPanelTex=null;
function getHullPanelTex(){
  if(hullPanelTex)return hullPanelTex;
  const N=512,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  g.fillStyle='#c4c8d2';g.fillRect(0,0,N,N);
  for(let i=0;i<60;i++){const v=170+Math.random()*60|0;g.fillStyle='rgb('+v+','+(v+3)+','+(v+10)+')';
    g.fillRect(Math.random()*N,Math.random()*N,20+Math.random()*120,14+Math.random()*80);}
  g.strokeStyle='#6a6f7c';g.lineWidth=2;
  let y=0;while(y<N){g.beginPath();g.moveTo(0,y);g.lineTo(N,y);g.stroke();y+=40+Math.random()*70;}
  for(let k=0;k<26;k++){const x=Math.random()*N,y0=Math.random()*N;g.beginPath();g.moveTo(x,y0);g.lineTo(x,y0+40+Math.random()*120);g.stroke();}
  g.fillStyle='#7b8090';
  for(let k=0;k<14;k++){const x=Math.random()*N,y0=Math.random()*N;for(let r=0;r<8;r++)g.fillRect(x+r*7,y0,2,2);}
  g.strokeStyle='#585d6a';g.lineWidth=1.5;
  for(let k=0;k<8;k++)g.strokeRect(Math.random()*N,Math.random()*N,18+Math.random()*30,12+Math.random()*20);
  hullPanelTex=new THREE.CanvasTexture(c);hullPanelTex.wrapS=hullPanelTex.wrapT=THREE.RepeatWrapping;
  hullPanelTex.encoding=THREE.sRGBEncoding;hullPanelTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return hullPanelTex;
}
function shipMaterials(cfg){
  const env=getShipEnvMap(),panel=getHullPanelTex();
  return {
    hull :new THREE.MeshStandardMaterial({color:cfg.hullColor,map:panel,metalness:.55,roughness:.36,envMap:env,envMapIntensity:.5}),
    hull2:new THREE.MeshStandardMaterial({color:cfg.hullColor2,map:panel,metalness:.6,roughness:.42,envMap:env,envMapIntensity:.4}),
    trim :new THREE.MeshStandardMaterial({color:0x141824,metalness:.7,roughness:.5,envMap:env,envMapIntensity:.4}),
    metal:new THREE.MeshStandardMaterial({color:0x9aa3b8,metalness:.95,roughness:.22,envMap:env,envMapIntensity:.7}),
    glass:new THREE.MeshStandardMaterial({color:0x03080e,metalness:1,roughness:.05,envMap:env,envMapIntensity:1.2,
      emissive:0x06323c}),
    edge1:new THREE.MeshBasicMaterial({color:cfg.edgeColor}),
    edge2:new THREE.MeshBasicMaterial({color:cfg.edgeColor2}),
    intake:new THREE.MeshBasicMaterial({color:0x020306}),
    nozzle:new THREE.MeshBasicMaterial({color:0x3ad8ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.45}),
  };
}
/* Lofted hull: a smooth body swept through cross-sections from nose to tail. Each section
   {z,w,h,y} is a rounded rectangle (superellipse) of half-width w and half-height h centred at
   height y; `round` sets the corners (2 = ellipse, higher = boxier). A zero-size first section
   makes a pointed nose; otherwise the nose and tail are both capped. */
function loftGeometry(sections,round,seg){
  seg=seg||20;const pos=[],uv=[],idx=[],e=2/round,R=seg+1;
  const sp=(v)=>Math.sign(v)*Math.pow(Math.abs(v),e);
  sections.forEach((s,i)=>{for(let j=0;j<=seg;j++){const a=j/seg*Math.PI*2;
    pos.push(sp(Math.cos(a))*s.w,s.y+sp(Math.sin(a))*s.h,s.z);uv.push(j/seg*2,(s.z-sections[0].z)/4);}});
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<seg;j++){
    const a=i*R+j,b=a+R;idx.push(a,a+1,b, b,a+1,b+1);}
  const cap=(si,dir)=>{const s=sections[si],c=pos.length/3;pos.push(0,s.y,s.z);uv.push(.5,.5);
    for(let j=0;j<seg;j++){const a=si*R+j;if(dir>0)idx.push(c,a,a+1);else idx.push(c,a+1,a);}};
  cap(sections.length-1,1);
  if(sections[0].w>0)cap(0,-1);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);geo.computeVertexNormals();
  // the ring's first and last columns are the same seam: average their normals so it doesn't show
  const n=geo.attributes.normal;
  for(let i=0;i<sections.length;i++){const a=i*R,b=a+seg;
    for(let k=0;k<3;k++){const v=(n.array[a*3+k]+n.array[b*3+k])/2;n.array[a*3+k]=n.array[b*3+k]=v;}}
  return geo;
}
/* A flat wing or fin panel from its planform (root at x=0, tip at x=span; z values are leading
   and trailing edges), bevelled so it catches light along the edges. Lies in the XZ plane. */
function panelGeometry(span,rootLE,rootTE,tipLE,tipTE,thick){
  const sh=new THREE.Shape();
  sh.moveTo(0,rootLE);sh.lineTo(span,tipLE);sh.lineTo(span,tipTE);sh.lineTo(0,rootTE);sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:thick*.5,bevelEnabled:true,bevelThickness:thick*.25,
    bevelSize:Math.min(.07,thick*.45),bevelSegments:1});
  geo.rotateX(Math.PI/2);geo.translate(0,thick*.25,0);
  const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.22,uv.getY(i)*.22);
  return geo;
}
/* thin glowing strip between two points in the XZ plane at height y */
function stripMesh(x1,z1,x2,z2,y,mat,w){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);
  const m=new THREE.Mesh(new THREE.BoxGeometry(len,w||.04,.07),mat);
  m.position.set((x1+x2)/2,y,(z1+z2)/2);m.rotation.y=-Math.atan2(dz,dx);return m;
}
/* engine nacelle along +Z (intake at the front, nozzle bell at the back) */
function nacelle(r1,r2,len,mat){
  const L=len/2,g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(r1*.78,-L),new THREE.Vector2(r1,-L+.12),new THREE.Vector2(r2,-L*.35),
    new THREE.Vector2(r2,L*.45),new THREE.Vector2(r2*.84,L)],14),mat.hull2);
  body.geometry.rotateX(Math.PI/2);g.add(body);
  const bell=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(r2*.78,L-.05),
    new THREE.Vector2(r2*.9,L+.28)],14,0,Math.PI*2),mat.metal);
  bell.material=mat.metal;bell.geometry.rotateX(Math.PI/2);g.add(bell);
  const bellIn=new THREE.Mesh(bell.geometry,mat.trim);bellIn.scale.set(.96,.96,1);g.add(bellIn);
  const glow=new THREE.Mesh(new THREE.CircleGeometry(r2*.74,18),mat.nozzle);glow.position.z=L-.04;g.add(glow);
  const intake=new THREE.Mesh(new THREE.CircleGeometry(r1*.74,14),mat.intake);intake.position.z=-L+.02;intake.rotation.y=Math.PI;g.add(intake);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(r1*.8,.035,6,18),mat.metal);ring.position.z=-L;g.add(ring);
  const band=new THREE.Mesh(new THREE.TorusGeometry(r2*1.01,.03,6,20),mat.edge2);band.position.z=L*.2;g.add(band);
  return g;
}
/* hull-specific layout: fuselage sections, wing and fin planforms, extras */
const HULL_LAYOUTS={
  diamond:{round:3.2,sections:[[-3.3,0,0,-.05],[-3.0,.18,.11,-.05],[-2.3,.42,.25,0],[-1.3,.62,.36,.04],
      [-.2,.78,.44,.07],[1.0,.86,.47,.06],[2.0,.78,.41,.02],[2.7,.58,.32,0],[3.2,.4,.24,0]],
    wing:{rootLE:.1,rootTE:2.3,tipLE:1.0,tipTE:1.9},
    fins:[{x:.55,cant:.38,h:1.0,rootLE:1.7,rootTE:3.0,tipLE:2.6,tipTE:3.1}]},
  needle:{round:2.4,sections:[[-4.7,0,0,-.04],[-4.1,.07,.06,-.04],[-3.2,.2,.16,-.02],[-2.0,.38,.27,0],
      [-.8,.5,.35,.03],[.4,.56,.37,.03],[1.6,.55,.35,.02],[2.8,.45,.3,0],[3.6,.36,.25,0]],
    wing:{rootLE:-.2,rootTE:2.7,tipLE:2.1,tipTE:2.7},
    canard:{x:.4,span:.75,rootLE:-1.9,rootTE:-1.2,tipLE:-1.4,tipTE:-1.15,z:0},
    fins:[{x:0,cant:0,h:1.0,rootLE:1.6,rootTE:3.5,tipLE:3.0,tipTE:3.6}]},
  block:{round:5,sections:[[-3.25,.42,.28,-.12],[-3.0,.82,.5,-.06],[-2.0,1.0,.64,0],[0,1.08,.72,.02],
      [1.6,1.1,.72,.02],[2.6,.96,.62,0],[3.0,.86,.55,0]],
    wing:{rootLE:-.1,rootTE:2.4,tipLE:.6,tipTE:2.2},
    fins:[{x:1.05,cant:.12,h:.85,rootLE:1.6,rootTE:2.9,tipLE:2.3,tipTE:2.95}]},
};
/* Exterior-only hull builder — shared by the live player ship AND the hangar thumbnails.
   Takes a ship's `visual` config and returns the group plus the bits a caller may need
   (canopy for FP/TP toggling, gun tip points + muzzle meshes for the firing system, flames,
   and the blinking nav strobes). Deliberately has NO side effects on module state, so building
   a disposable thumbnail can never clobber the real player ship's references. */
function buildShipExterior(cfg){
  const g=new THREE.Group();
  const shape=cfg.hullShape||'diamond',L=HULL_LAYOUTS[shape]||HULL_LAYOUTS.diamond;
  const mat=shipMaterials(cfg);
  // the layouts are drawn for each hull's stock size; scale them to the config's length and width
  const zs=cfg.hullLen/({diamond:5.8,needle:7.6,block:5.0}[shape]||5.8);
  const ws=cfg.hullR/({diamond:1,needle:.6,block:1.35}[shape]||1);
  /* ---- fuselage ---- */
  const secs=L.sections.map(([z,w,h,y])=>({z:z*zs,w:w*ws,h,y}));
  const body=new THREE.Mesh(loftGeometry(secs,L.round),mat.hull);g.add(body);
  // belly keel + side accent lines + a dark spine stripe
  const keel=new THREE.Mesh(loftGeometry(secs.map(s=>({z:s.z,w:s.w*.45,h:s.h*.5,y:s.y-s.h*.62})),L.round),mat.hull2);
  keel.scale.set(1,1,.92);g.add(keel);
  const mid=secs[Math.floor(secs.length/2)];
  for(const sx of [-1,1]){
    // accent line traced along the flank, following the hull's taper section by section
    for(let i=2;i<secs.length-2;i++){const a=secs[i],b=secs[i+1];
      g.add(stripMesh(sx*a.w*1.01,a.z,sx*b.w*1.01,b.z,(a.y+b.y)/2+.02,mat.edge1,.035));}
    // side intake ahead of the wing root
    const intake=new THREE.Mesh(new THREE.BoxGeometry(.22,mid.h*.55,.9),mat.trim);
    intake.position.set(sx*mid.w*.92,mid.y-.05,secs[3].z+.5);g.add(intake);
    const lip=new THREE.Mesh(new THREE.BoxGeometry(.24,mid.h*.6,.06),mat.metal);
    lip.position.set(sx*mid.w*.93,mid.y-.05,secs[3].z+.05);g.add(lip);
  }
  /* ---- canopy: glossy tinted glass bubble with a centre frame ---- */
  const canopy=new THREE.Group();
  const glass=new THREE.Mesh(new THREE.SphereGeometry(.55,20,12,0,Math.PI*2,0,Math.PI/2),mat.glass);canopy.add(glass);
  const frame=new THREE.Mesh(new THREE.TorusGeometry(.55,.03,6,24,Math.PI),mat.trim);frame.rotation.y=Math.PI/2;canopy.add(frame);
  const sill=new THREE.Mesh(new THREE.TorusGeometry(.55,.035,6,28),mat.trim);sill.rotation.x=Math.PI/2;canopy.add(sill);
  canopy.position.set(cfg.canopyPos[0],cfg.canopyPos[1]-.12,cfg.canopyPos[2]);
  canopy.scale.set(cfg.canopyScale[0],cfg.canopyScale[1]*1.5,cfg.canopyScale[2]);g.add(canopy);
  /* ---- wings ---- */
  const W=L.wing,half=cfg.wingSpan/2,wingY=-.1;
  const wingGeo=panelGeometry(half,W.rootLE,W.rootTE,W.tipLE,W.tipTE,cfg.wingThick*1.4);
  const navs=[];
  for(const sx of [-1,1]){
    const w=new THREE.Mesh(wingGeo,mat.hull);w.position.y=wingY;w.scale.x=sx;g.add(w);
    // leading-edge light strip, plus a second trailing strip on two-tone hulls
    g.add(stripMesh(sx*mid.w*.9,W.rootLE+(W.tipLE-W.rootLE)*mid.w*.9/half,sx*half,W.tipLE,wingY+cfg.wingThick*.7+.01,mat.edge1,.035));
    if(cfg.doubleEdge)g.add(stripMesh(sx*mid.w*.9,W.rootTE,sx*half,W.tipTE,wingY+cfg.wingThick*.7+.01,mat.edge2,.03));
    // dark panel inlay on the upper surface
    const inlay=new THREE.Mesh(panelGeometry(half*.55,W.rootLE+.5,W.rootTE-.35,W.tipLE*.6+.4,W.tipTE*.8,.02),mat.trim);
    inlay.position.set(sx*mid.w*.95,wingY+cfg.wingThick*.7,0);inlay.scale.x=sx;g.add(inlay);
    // wingtip nav light: red to port, green to starboard
    const nav=new THREE.Mesh(sharedGeo('navLight',()=>new THREE.SphereGeometry(.07,8,8)),
      new THREE.MeshBasicMaterial({color:sx<0?0xff3040:0x30ff80}));
    nav.position.set(sx*(half+.02),wingY,(W.tipLE+W.tipTE)/2);g.add(nav);navs.push(nav);
  }
  if(L.canard)for(const sx of [-1,1]){
    const C=L.canard,cn=new THREE.Mesh(panelGeometry(C.span,C.rootLE,C.rootTE,C.tipLE,C.tipTE,.07),mat.hull);
    cn.position.set(sx*C.x,-.02,0);cn.scale.x=sx;cn.rotation.z=sx*-.1;g.add(cn);
    g.add(stripMesh(sx*C.x,C.rootLE+.05,sx*(C.x+C.span),C.tipLE,.03,mat.edge1,.025));
  }
  /* ---- tail fins (vertical panels, optionally canted outward) ---- */
  const strobes=[];
  for(const F of L.fins)for(const sx of (F.x?[-1,1]:[0])){
    const fin=new THREE.Mesh(panelGeometry(F.h*.8,F.rootLE*zs,F.rootTE*zs,F.tipLE*zs,F.tipTE*zs,.08),mat.hull2);
    fin.rotation.z=Math.PI/2-(sx||0)*F.cant;fin.position.set(sx*F.x*cfg.hullR,mid.y+mid.h*.6,0);
    g.add(fin);
    const tipX=sx*F.x*cfg.hullR+Math.cos(fin.rotation.z)*F.h*.8, tipY=mid.y+mid.h*.6+Math.sin(fin.rotation.z)*F.h*.8;
    const st=new THREE.Mesh(sharedGeo('navLight',()=>new THREE.SphereGeometry(.07,8,8)),new THREE.MeshBasicMaterial({color:0xffffff}));
    st.position.set(tipX,tipY,F.tipTE*zs-.1);g.add(st);strobes.push(st);
    const fs=new THREE.Mesh(new THREE.BoxGeometry(.1,.04,(F.tipTE-F.tipLE)*zs*.9),mat.edge2);
    fs.position.set(tipX,tipY-.02,(F.tipLE+F.tipTE)/2*zs);fs.rotation.z=fin.rotation.z-Math.PI/2;g.add(fs);
  }
  /* ---- dorsal details: antenna mast, sensor blister ---- */
  const tail=secs[secs.length-3];
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.015,.025,.7,5),mat.metal);
  mast.position.set(.18,tail.y+tail.h+.3,tail.z-.4);mast.rotation.x=.5;g.add(mast);
  const blister=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8,0,Math.PI*2,0,Math.PI/2),mat.trim);
  blister.position.set(0,tail.y+tail.h*.95,tail.z+.2);blister.scale.set(1.2,.6,2);g.add(blister);
  /* ---- engines ---- */
  const flames=[];
  const wingZ=shape==='needle'?1.5:1.2, engZ=wingZ+.7;
  for(const sx of [-1,1]){
    const nc=nacelle(cfg.engineR1,cfg.engineR2,cfg.engineLen,mat);nc.position.set(sx*cfg.engineX,-.1,engZ);g.add(nc);
    // pylon tying an outboard nacelle to the wing
    if(cfg.engineX>mid.w+cfg.engineR2){const py=new THREE.Mesh(new THREE.BoxGeometry(.12,.25,cfg.engineLen*.6),mat.trim);
      py.position.set(sx*cfg.engineX,-.1+cfg.engineR2*.6,engZ);g.add(py);}
    const fl=new THREE.Mesh(new THREE.SphereGeometry(.36*(cfg.engineR2/.42),12,10),M.flame.clone());
    fl.position.set(sx*cfg.engineX,-.1,engZ+cfg.engineLen/2+.35);fl.userData.flame=true;g.add(fl);flames.push(fl);
  }
  /* ---- guns: barrel, heat shroud with cooling rings, glowing muzzle collar ---- */
  const gunTips=[],muzzleMeshes=[];
  cfg.guns.forEach(gp=>{
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(cfg.gunR*.8,cfg.gunR,cfg.gunLen,10),mat.metal);
    barrel.rotation.x=Math.PI/2;barrel.position.set(gp.x,gp.y,cfg.gunZ);g.add(barrel);
    const shroud=new THREE.Mesh(new THREE.CylinderGeometry(cfg.gunR*1.9,cfg.gunR*2.1,cfg.gunLen*.42,10),mat.hull2);
    shroud.rotation.x=Math.PI/2;shroud.position.set(gp.x,gp.y,cfg.gunZ+cfg.gunLen*.28);g.add(shroud);
    for(let r=0;r<3;r++){const ring=new THREE.Mesh(new THREE.TorusGeometry(cfg.gunR*1.35,cfg.gunR*.28,5,12),mat.trim);
      ring.position.set(gp.x,gp.y,cfg.gunZ-cfg.gunLen*.05-r*cfg.gunLen*.1);g.add(ring);}
    const tip=new THREE.Mesh(new THREE.CylinderGeometry(cfg.gunR*1.3,cfg.gunR*.78,.3,10),mat.edge1);
    tip.rotation.x=Math.PI/2;tip.position.set(gp.x,gp.y,cfg.gunTipZ);g.add(tip);
    // muzzle flash (additive, pulsed on fire)
    const mz=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),
      new THREE.MeshBasicMaterial({color:0x9ff7ff,blending:THREE.AdditiveBlending,transparent:true,opacity:0}));
    mz.position.set(gp.x,gp.y,cfg.gunTipZ-.15);mz.scale.set(1,1,2.6);g.add(mz);
    gunTips.push({x:gp.x,y:gp.y,z:cfg.gunTipZ});muzzleMeshes.push(mz);
  });
  /* ---- hull extras ---- */
  if(cfg.pod){ // heavy-hull ordnance pod with visible missile tubes
    const pod=new THREE.Mesh(new THREE.BoxGeometry(1.1,.55,2.4),mat.hull2);pod.position.set(0,-.78,1.0);g.add(pod);
    const podLit=new THREE.Mesh(new THREE.BoxGeometry(1.12,.05,2.2),mat.edge1);podLit.position.set(0,-.5,1.0);g.add(podLit);
    for(let i=0;i<4;i++){const tube=new THREE.Mesh(new THREE.CircleGeometry(.1,10),mat.intake);
      tube.position.set(-.39+i*.26,-.8,-.21);tube.rotation.y=Math.PI;g.add(tube);}
  }
  if(shape==='block'){ // armour plating on the flanks and a dorsal spine (aft only — the FP eye sits forward)
    for(const sx of [-1,1]){
      const plate=new THREE.Mesh(new THREE.BoxGeometry(.14,.75,2.8),mat.hull2);
      plate.position.set(sx*1.18*zs,.05,.6);plate.rotation.y=sx*.08;g.add(plate);
      g.add(stripMesh(sx*1.27,-.6,sx*1.27,1.8,.36,mat.edge1,.05));
    }
    const spine=new THREE.Mesh(new THREE.BoxGeometry(.34,.5,1.3),mat.hull2);spine.position.set(0,.88,1.7);g.add(spine);
    const spineLit=new THREE.Mesh(new THREE.BoxGeometry(.08,.4,1.1),mat.edge2);spineLit.position.set(0,.92,1.7);g.add(spineLit);
  }
  // trench fill light: raised well clear of the hull so it lights the walls, not the metal right under it
  const light=new THREE.PointLight(0x9fc4ff,.45,40);light.position.set(0,6,3);g.add(light);
  return {group:g,canopy,flames,gunTips,muzzleMeshes,strobes,navs};
}
function buildShip(shipCfg){
  const ext=buildShipExterior(shipCfg.visual);
  const s=ext.group;
  canopy=ext.canopy;
  muzzles.length=0; ext.muzzleMeshes.forEach(m=>muzzles.push(m));
  curGunPositions=ext.gunTips;
  shipStrobes=ext.strobes;
  engineLights.length=0;
  // engine glow lights sit behind the nozzles so they wash the trench floor, not the ship's own nacelles
  ext.flames.forEach(fl=>{const el=new THREE.PointLight(0x35e8ff,0,11); el.position.copy(fl.position); el.position.z+=6; el.position.y-=1.5; s.add(el); engineLights.push(el);});
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
  // cockpit fill light: dimmed to 0 in chase view by setCam (kept in the scene so the light count never changes)
  cabLight=new THREE.PointLight(0x00f0ff,S.cam==='fp'?.25:0,4); cabLight.position.set(0,1.2,.4); s.add(cabLight);
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
/* ---- hangar thumbnails: one offscreen render per hull through the main renderer (so the hull
   materials and their reflection map work), read back into an image and cached ---- */
const shipThumbCache={};
function renderShipThumb(shipCfg){
  if(shipThumbCache[shipCfg.id])return shipThumbCache[shipCfg.id];
  const W=1000,H=200;   // the card strip is about 5:1; rendered at 2x and scaled down, which smooths the edges
  const rt=new THREE.WebGLRenderTarget(W,H);rt.texture.encoding=THREE.sRGBEncoding;
  const ts=new THREE.Scene();
  ts.add(new THREE.AmbientLight(0x445577,.9));
  const dl=new THREE.DirectionalLight(0xcfe8ff,1.6);dl.position.set(2,3,2);ts.add(dl);
  const dl2=new THREE.DirectionalLight(0xff2d78,.7);dl2.position.set(-3,-1,-2);ts.add(dl2);
  const dl3=new THREE.DirectionalLight(0x00f0ff,.8);dl3.position.set(-2,1,3);ts.add(dl3);
  const ext=buildShipExterior(shipCfg.visual);
  // centre the hull on its bounding box and back the camera off to fit its bounding sphere,
  // so every ship frames whole whatever its length or span
  const box=new THREE.Box3().setFromObject(ext.group),ctr=box.getCenter(new THREE.Vector3());
  const piv=new THREE.Group();ext.group.position.sub(ctr);piv.add(ext.group);
  piv.rotation.set(.12,-.75,-.08);   // 3/4 hero angle from the front: nose, guns, canopy, one wing
  ts.add(piv);
  const r=box.getSize(new THREE.Vector3()).length()/2, fov=30;
  const dist=r/Math.sin(THREE.MathUtils.degToRad(fov/2))*.42;   // vertical fov is the tight axis; a 3/4 view fits inside the sphere
  const tc=new THREE.PerspectiveCamera(fov,W/H,.1,100);
  tc.position.set(0,dist*.32,-dist);tc.lookAt(0,0,0);
  const prevClear=renderer.getClearColor(new THREE.Color()),prevAlpha=renderer.getClearAlpha();
  renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.clear();
  renderer.render(ts,tc);
  const px=new Uint8Array(W*H*4);renderer.readRenderTargetPixels(rt,0,0,W,H,px);
  renderer.setRenderTarget(null);renderer.setClearColor(prevClear,prevAlpha);rt.dispose();
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const img=g.createImageData(W,H);
  for(let y=0;y<H;y++)img.data.set(px.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);   // GL rows run bottom-up
  g.putImageData(img,0,0);
  const url=c.toDataURL('image/png');
  shipThumbCache[shipCfg.id]=url;
  return url;
}
