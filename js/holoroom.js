"use strict";
/* Command room: the bridge's default view (B). HALCYON's command deck, with the battle drawn as a hologram inside a
   globe in the middle of the room: every capital as a translucent copy of its hull, fighters as arrowheads in their
   squadron's colour, and the arena's rocks as wireframes. js/bridge.js still owns the bridge itself (units, orders,
   markers, keys, and the orbit / pan / zoom in bdgCam and bdgPan); this file builds the room the first time it
   opens, keeps the hologram in step with the fight, and stands in for the outside camera: bdgProject maps a world
   point through holoMapPos, so the markers, order lines and clicks land on the globe. The camera circles the globe
   on the bridge's yaw and pitch, and the wheel zooms the map rather than the camera. V on the bridge swaps to the
   live view over the fight and back (bdgView). Sizes are in HOLO (js/config.js), in metres of the room. */

let holo=null;   // the room, built on first use (holoBuild)
let holoSnap=true;   // the next frame puts the camera straight in place (a fresh visit, or back from the live view)
const holoV=new THREE.Vector3(), holoO=new THREE.Vector3();

/* where a world point sits in the globe (room coordinates); false if it is off the edge of the map, unless `edge`
   pins it to the globe's shell instead (markers and fighters: what is out of range still shows, and can be clicked) */
function holoMapPos(pos,out,edge){
  const k=HOLO.r/(bdgCam.dist*HOLO.range);
  out.copy(pos).sub(bdgC).multiplyScalar(k);
  let inside=out.lengthSq()<=HOLO.r*HOLO.r;
  if(!inside&&edge){out.setLength(HOLO.r);inside=true;}
  out.y+=HOLO.y;return inside;
}
/* draws the room instead of the game while the bridge shows it; false otherwise */
function renderHolo(){
  if(!S.bridge||bdgView!=='holo'||!holo)return false;
  if(bloomOn()){const rp=composer.passes[0],s0=rp.scene,c0=rp.camera;
    rp.scene=holo.scene;rp.camera=holo.cam;composer.render();rp.scene=s0;rp.camera=c0;}
  else renderer.render(holo.scene,holo.cam);
  return true;
}

/* ---- the room ---- */
function holoTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;
}
/* deck plating: rings of panels round the projector, seams and the odd hatch */
const holoFloorTex=()=>holoTex(1024,1024,(g,W)=>{
  g.fillStyle='#0b0f1a';g.fillRect(0,0,W,W);const c=W/2;
  g.strokeStyle='#1a2236';g.lineWidth=3;
  for(let r=80;r<c;r+=70){g.beginPath();g.arc(c,c,r,0,Math.PI*2);g.stroke();}
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2;g.beginPath();g.moveTo(c+Math.cos(a)*80,c+Math.sin(a)*80);g.lineTo(c+Math.cos(a)*c,c+Math.sin(a)*c);g.stroke();}
  for(let i=0;i<220;i++){const a=Math.random()*Math.PI*2,r=90+Math.random()*(c-100);
    g.fillStyle=Math.random()<.5?'#0e1322':'#121a2c';g.fillRect(c+Math.cos(a)*r-6,c+Math.sin(a)*r-6,12,12);}
  g.strokeStyle='#22314d';g.lineWidth=2;for(let r=20;r<80;r+=12){g.beginPath();g.arc(c,c,r,0,Math.PI*2);g.stroke();}   // grating round the projector
});
/* one bay of the wall (the cylinder repeats it): plated panels, a window onto the stars, light strips */
const holoWallTex=()=>holoTex(1024,512,(g,W,H)=>{
  g.fillStyle='#080b15';g.fillRect(0,0,W,H);
  g.strokeStyle='#131a2b';g.lineWidth=3;for(let x=0;x<W;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}
  for(let y=0;y<H;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  const wx=170,wy=110,ww=684,wh=210;
  const sky=g.createLinearGradient(0,wy,0,wy+wh);sky.addColorStop(0,'#03040c');sky.addColorStop(.6,'#0a0618');sky.addColorStop(1,'#120a22');
  g.fillStyle=sky;g.fillRect(wx,wy,ww,wh);
  for(let i=0;i<260;i++){g.globalAlpha=.25+Math.random()*.75;g.fillStyle=Math.random()<.2?'#ffd9b0':Math.random()<.4?'#b8d4ff':'#ffffff';
    g.fillRect(wx+Math.random()*ww,wy+Math.random()*wh,Math.random()<.08?2:1,Math.random()<.08?2:1);}
  g.globalAlpha=1;g.strokeStyle='#1d2740';g.lineWidth=10;g.strokeRect(wx,wy,ww,wh);
  g.lineWidth=7;for(let k=1;k<4;k++){g.beginPath();g.moveTo(wx+ww*k/4,wy);g.lineTo(wx+ww*k/4,wy+wh);g.stroke();}
  g.fillStyle='#0e6a7c';g.fillRect(0,400,W,5);   // the cyan strip at console height
  g.fillStyle='#5a3a10';g.fillRect(0,64,W,3);    // a dim amber strip up high
  g.fillStyle='#0a3a46';for(let x=40;x<W;x+=128)g.fillRect(x,440,48,8);
});
/* a console screen: a grid, traces and bars (drawn once; the room scrolls them) */
const holoScreenTex=hue=>holoTex(256,128,(g,W,H)=>{
  g.fillStyle='#020812';g.fillRect(0,0,W,H);
  g.strokeStyle=hue+'33';g.lineWidth=1;for(let x=0;x<W;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}
  for(let y=0;y<H;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  g.strokeStyle=hue;g.lineWidth=2;g.beginPath();
  for(let x=0;x<=W;x+=4)g.lineTo(x,H*.4+Math.sin(x*.07)*14+Math.sin(x*.21)*6);g.stroke();
  g.fillStyle=hue+'aa';for(let i=0;i<10;i++){const h=8+Math.random()*34;g.fillRect(12+i*23,H-8-h,14,h);}
  g.fillStyle=hue;g.font='bold 12px monospace';g.fillText('HALCYON // TAC',8,16);
});
const holoAdd=(col,o)=>new THREE.MeshBasicMaterial({color:col,blending:THREE.AdditiveBlending,transparent:true,opacity:o,depthWrite:false});
const holoLineMat=(col,o)=>new THREE.LineBasicMaterial({color:col,blending:THREE.AdditiveBlending,transparent:true,opacity:o,depthWrite:false});

function holoBuild(){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x03050b);scene.fog=new THREE.FogExp2(0x03050b,.028);
  const cam=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,200);
  const H=holo={scene,cam,map:new THREE.Group(),caps:new Map(),icons:[],rocks:[],screens:[],crew:[],t:0};
  scene.add(new THREE.AmbientLight(0x2a3858,.45));
  scene.add(new THREE.HemisphereLight(0x3a5a8a,0x0a0812,.3));
  const glow=new THREE.PointLight(0x00e0ff,1.1,22,1.6);glow.position.set(0,HOLO.y,0);scene.add(glow);
  for(const a of [0,2.1,4.2]){const l=new THREE.PointLight(0xffa040,.8,18,2);l.position.set(Math.sin(a)*11,9,Math.cos(a)*11);scene.add(l);}
  const metal=new THREE.MeshStandardMaterial({color:0x2a3346,metalness:.7,roughness:.45});
  const dark=new THREE.MeshStandardMaterial({color:0x0c1019,metalness:.5,roughness:.7});
  const R=15,TOP=13;
  // deck, wall and ceiling
  const floor=new THREE.Mesh(new THREE.CircleGeometry(R,64),new THREE.MeshStandardMaterial({map:holoFloorTex(),metalness:.6,roughness:.5}));
  floor.rotation.x=-Math.PI/2;scene.add(floor);
  const wt=holoWallTex();wt.wrapS=THREE.RepeatWrapping;wt.repeat.set(6,1);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(R,R,TOP,72,1,true),new THREE.MeshBasicMaterial({map:wt,side:THREE.BackSide}));
  wall.position.y=TOP/2;scene.add(wall);
  const ceil=new THREE.Mesh(new THREE.CircleGeometry(R,48),dark);ceil.rotation.x=Math.PI/2;ceil.position.y=TOP;scene.add(ceil);
  for(const [r,w,c] of [[3,.06,0x083c48],[8.6,.05,0x062a34],[13.6,.06,0x2a1e0a]]){   // light rings in the deck
    const m=new THREE.Mesh(new THREE.RingGeometry(r-w,r,96),new THREE.MeshBasicMaterial({color:c}));m.rotation.x=-Math.PI/2;m.position.y=.01;scene.add(m);}
  for(const r of [6,11]){const m=new THREE.Mesh(new THREE.RingGeometry(r-.15,r,96),new THREE.MeshBasicMaterial({color:0x123a48,side:THREE.DoubleSide}));
    m.rotation.x=Math.PI/2;m.position.y=TOP-.02;scene.add(m);}
  // ribs up the wall between the bays, each with a lit strip
  const ribG=new THREE.BoxGeometry(.9,TOP,.9),stripG=new THREE.BoxGeometry(.12,TOP*.7,.05),stripM=new THREE.MeshBasicMaterial({color:0x14707f});
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2+Math.PI/12,rib=new THREE.Mesh(ribG,metal);
    rib.position.set(Math.sin(a)*(R-.5),TOP/2,Math.cos(a)*(R-.5));rib.rotation.y=a;scene.add(rib);
    const s=new THREE.Mesh(stripG,stripM);s.position.set(0,0,-.48);rib.add(s);}
  // the overhead ring the hologram hangs under
  const halo=new THREE.Mesh(new THREE.TorusGeometry(4.2,.22,8,72),metal);halo.rotation.x=Math.PI/2;halo.position.y=TOP-2.4;scene.add(halo);
  const haloLit=new THREE.Mesh(new THREE.TorusGeometry(4.2,.05,6,72),new THREE.MeshBasicMaterial({color:0x1a8fa0}));
  haloLit.rotation.x=Math.PI/2;haloLit.position.y=TOP-2.62;scene.add(haloLit);
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2,s=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.4,6),metal);
    s.position.set(Math.sin(a)*4.2,TOP-1.2,Math.cos(a)*4.2);scene.add(s);}
  // the projector: a pedestal, its lens, and a beam of light up into the globe
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2.2,1.1,40),metal);ped.position.y=.55;scene.add(ped);
  const lip=new THREE.Mesh(new THREE.CylinderGeometry(1.65,1.65,.14,40),dark);lip.position.y=1.15;scene.add(lip);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,.06,40),new THREE.MeshStandardMaterial({color:0x061820,metalness:.9,roughness:.15}));lens.position.y=1.23;scene.add(lens);
  for(const r of [.5,1.1]){const m=new THREE.Mesh(new THREE.RingGeometry(r-.04,r,48),new THREE.MeshBasicMaterial({color:0x1a8fa0}));m.rotation.x=-Math.PI/2;m.position.y=1.27;scene.add(m);}
  const beamTex=holoTex(16,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,240,255,0)');gr.addColorStop(1,'rgba(0,240,255,1)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const beamH=HOLO.y-1.25;
  H.beam=new THREE.Mesh(new THREE.CylinderGeometry(HOLO.r*.8,1.1,beamH,40,1,true),
    new THREE.MeshBasicMaterial({map:beamTex,color:0x00c8e0,blending:THREE.AdditiveBlending,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide}));
  H.beam.position.y=1.25+beamH/2;scene.add(H.beam);
  // the globe: latitude and longitude lines, a brighter equator with a range grid, a faint shell, and a scan ring
  const pts=[],seg=72;
  for(let la=-60;la<=60;la+=30){const y=Math.sin(la*Math.PI/180)*HOLO.r,r=Math.cos(la*Math.PI/180)*HOLO.r;
    for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;pts.push(Math.cos(a)*r,y,Math.sin(a)*r,Math.cos(b)*r,y,Math.sin(b)*r);}}
  for(let m=0;m<6;m++){const a=m/6*Math.PI;
    for(let i=0;i<seg;i++){const t=i/seg*Math.PI*2,u=(i+1)/seg*Math.PI*2;
      pts.push(Math.cos(a)*Math.cos(t)*HOLO.r,Math.sin(t)*HOLO.r,Math.sin(a)*Math.cos(t)*HOLO.r,Math.cos(a)*Math.cos(u)*HOLO.r,Math.sin(u)*HOLO.r,Math.sin(a)*Math.cos(u)*HOLO.r);}}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  const globe=new THREE.Group();globe.position.y=HOLO.y;scene.add(globe);
  globe.add(new THREE.LineSegments(lg,holoLineMat(0x00d8ff,.06)));
  const grid=new THREE.PolarGridHelper(HOLO.r,12,3,72,0x00d8ff,0x00d8ff);
  grid.material=holoLineMat(0x00d8ff,.12);globe.add(grid);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(HOLO.r,40,24),
    new THREE.MeshBasicMaterial({color:0x0090b0,blending:THREE.AdditiveBlending,transparent:true,opacity:.05,depthWrite:false,side:THREE.BackSide})));
  H.scan=new THREE.Mesh(new THREE.TorusGeometry(1,.01,4,96),holoAdd(0x40f0ff,.5));H.scan.rotation.x=Math.PI/2;globe.add(H.scan);
  // the same planet and amber orbit as the holo table on the walkable HALCYON bridge (js/deck.js), so this is that table
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(HOLO.r*.12,20,14),holoAdd(0xff5a8a,.3)));
  const orbit=new THREE.Mesh(new THREE.TorusGeometry(HOLO.r*.65,HOLO.r*.004,4,80),holoAdd(0xffb300,.45));orbit.rotation.x=Math.PI/2;globe.add(orbit);
  H.globe=globe;
  // a ring of consoles round the projector, screens facing out to the crew who stand at them
  const deskG=new THREE.BoxGeometry(1.7,1,.8),scrG=new THREE.PlaneGeometry(1.5,.75);
  const screenTex=['#00f0ff','#ffb300','#ff2d78'].map(holoScreenTex);
  for(let i=0;i<10;i++){
    if(i===3||i===8)continue;   // two gaps to walk through
    const a=i/10*Math.PI*2,desk=new THREE.Group();desk.position.set(Math.sin(a)*5.2,0,Math.cos(a)*5.2);desk.rotation.y=a;scene.add(desk);
    const base=new THREE.Mesh(deskG,dark);base.position.y=.5;desk.add(base);
    const top=new THREE.Mesh(new THREE.BoxGeometry(1.8,.08,.95),metal);top.position.y=1.03;desk.add(top);
    const tex=screenTex[i%3].clone();tex.needsUpdate=true;tex.wrapS=THREE.RepeatWrapping;
    const scr=new THREE.Mesh(scrG,new THREE.MeshBasicMaterial({map:tex,color:0x9fb8c8}));
    scr.position.set(0,1.42,.25);scr.rotation.x=-.5;desk.add(scr);H.screens.push(tex);
    const edge=new THREE.Mesh(new THREE.BoxGeometry(1.7,.03,.03),new THREE.MeshBasicMaterial({color:0x0e6a7c}));edge.position.set(0,1.08,.47);desk.add(edge);
    if(i%2===0){   // a crew member at the console: a plain silhouette with a lit collar
      const p=new THREE.Group();p.position.set(0,0,1.15);desk.add(p);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.24,.2,1.05,10),dark);body.position.y=1.18;p.add(body);
      const legs=new THREE.Mesh(new THREE.CylinderGeometry(.18,.14,.7,8),dark);legs.position.y=.35;p.add(legs);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),dark);head.position.y=1.9;p.add(head);
      const col=new THREE.Mesh(new THREE.TorusGeometry(.17,.025,6,16),new THREE.MeshBasicMaterial({color:i%4?0xffb300:0x00f0ff}));
      col.rotation.x=Math.PI/2;col.position.y=1.72;p.add(col);
      H.crew.push({p,ph:Math.random()*6});
    }
  }
  // the hologram: a group in room coordinates, filled each frame (holoSync)
  scene.add(H.map);
  H.mats={you:holoAdd(0xffffff,.95),foe:holoAdd(0xff3a6a,.85),sq:[holoAdd(0x7fe9ff,.9),holoAdd(0xffb300,.9),holoAdd(0xff2bd6,.9)],
    rock:new THREE.MeshBasicMaterial({color:0x2b6f86,wireframe:true,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false})};
  H.iconG=new THREE.ConeGeometry(.45,1.5,4);H.iconG.rotateX(-Math.PI/2);   // an arrowhead pointing down -z, the way ships fly
  H.rockG=new THREE.IcosahedronGeometry(1,0);
  H.sel=new THREE.Mesh(new THREE.RingGeometry(.85,1,40),new THREE.MeshBasicMaterial({color:0x00f0ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}));
  H.sel.rotation.x=-Math.PI/2;scene.add(H.sel);
  return H;
}

/* a capital's hologram: a copy of its hull sharing the geometry, every surface in one translucent glow */
function holoCap(C){
  const g=C.g.clone(true),mat=holoAdd(C.friendly?0x00d0ff:0xff3a6a,.14),pairs=[];
  const src=[],dst=[];C.g.traverse(o=>src.push(o));g.traverse(o=>dst.push(o));
  for(let i=0;i<src.length;i++){const o=src[i],c=dst[i];
    if(c.isMesh)c.material=mat;
    else if(c.isSprite||c.isPoints||c.isLine||c.isLight){c.visible=false;continue;}
    if(i)pairs.push([o,c]);}
  const h={g,mat,pairs,seen:0};holo.caps.set(C,h);holo.map.add(g);return h;
}
function holoIcon(i){
  let m=holo.icons[i];
  if(!m){m=new THREE.Mesh(holo.iconG,holo.mats.you);holo.map.add(m);holo.icons[i]=m;}
  return m;
}

/* each frame on the bridge, after bridgeCamera has eased bdgC: the camera round the globe, the hologram, the room's motion */
function holoUpdate(dt){
  const H=holo||holoBuild();H.t+=dt;
  const {yaw}=bdgCam,cam=H.cam,pitch=bdgCam.pitch*HOLO.tilt;   // an officer's eye on the globe: never straight down
  // the globe sits clear of the orders panel: left of it on a wide screen, above it on a phone (stepping back to fit it in)
  const w=innerWidth,h=innerHeight,narrow=w<700;
  cam.aspect=w/h;cam.setViewOffset(w,h,narrow?0:Math.min(170,w*.1),narrow?h*.2:0,w,h);
  holoV.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(HOLO.eye*(narrow?Math.min(2,1/Math.pow(w/h,.6)):1));holoV.y+=HOLO.y;
  if(holoSnap){holoSnap=false;cam.position.copy(holoV);}   // a fresh visit starts in place, no swing across the room
  cam.position.lerp(holoV,1-Math.exp(-6*dt));cam.position.y+=Math.sin(H.t*.7)*.002;
  cam.lookAt(0,HOLO.y-.3,0);cam.updateMatrixWorld();
  holoSync();
  // the room: the scan ring sweeps the globe, the beam breathes, screens scroll, the crew shift their weight
  const s=Math.sin(H.t*.8)*HOLO.r*.96;H.scan.position.y=s;H.scan.scale.setScalar(Math.sqrt(HOLO.r*HOLO.r-s*s));
  H.beam.material.opacity=.07+Math.sin(H.t*3.1)*.015+Math.random()*.01;
  H.screens.forEach((t,i)=>{t.offset.x=(H.t*(.05+i*.01))%1;});
  for(const c of H.crew)c.p.rotation.z=Math.sin(H.t*.6+c.ph)*.02;
}
function holoSync(){
  const H=holo,k=HOLO.r/(bdgCam.dist*HOLO.range),U=bdgUnit();H.tick=(H.tick||0)+1;
  // capitals
  for(const C of capitals){
    let h=H.caps.get(C);
    if(C.state==='wreck'){if(h)h.g.visible=false;continue;}
    if(!h)h=holoCap(C);
    h.seen=H.tick;
    if(!holoMapPos(C.g.position,holoV)){h.g.visible=false;continue;}
    h.g.visible=true;h.g.position.copy(holoV);h.g.quaternion.copy(C.g.quaternion);h.g.scale.copy(C.g.scale).multiplyScalar(k);
    for(const [o,c] of h.pairs){c.visible=o.visible&&!(o.material&&o.material.transparent&&o.material.opacity<.05);c.quaternion.copy(o.quaternion);}
    h.mat.opacity=C.state==='warp'?.07:C.state==='dying'?.06+Math.random()*.25:U&&U.kind==='cap'&&U.C===C?.34:.2;
  }
  for(const [C,h] of H.caps)if(h.seen!==H.tick&&!capitals.includes(C)){H.map.remove(h.g);h.mat.dispose();H.caps.delete(C);}
  // fighters: you, the squadrons, the enemy
  let n=0;
  const wsel=U?bdgWingOf(U):[];
  const put=(mesh,mat,sc)=>{holoMapPos(mesh.position,holoV,true);
    const m=holoIcon(n++);m.material=mat;m.position.copy(holoV);m.quaternion.copy(mesh.quaternion);m.scale.setScalar(sc);m.visible=true;};
  put(ship,H.mats.you,U&&U.kind==='me'?.13:.1);
  for(const w of wingmen)if(!w.dead&&w.launch<=0)put(w.mesh,H.mats.sq[w.sq||0],wsel.includes(w)?.11:.075);
  for(const E of fighters)if(!E.dead)put(E.mesh,H.mats.foe,E.drone?.045:.065);
  for(let i=n;i<H.icons.length;i++)H.icons[i].visible=false;
  // the arena's rocks
  while(H.rocks.length<arenaDebris.length){const m=new THREE.Mesh(H.rockG,H.mats.rock);H.map.add(m);H.rocks.push(m);}
  H.rocks.forEach((m,i)=>{const d=arenaDebris[i];
    m.visible=!!d&&arenaEnv&&arenaEnv.visible&&!S.school&&holoMapPos(d.m.position,holoV);
    if(m.visible){m.position.copy(holoV);m.quaternion.copy(d.m.quaternion);m.scale.copy(d.m.scale).multiplyScalar(k*.9);}});
  // a ring under the selected unit
  const sel=H.sel;sel.visible=false;
  if(U){
    let r=.16;
    if(U.kind==='me')holoO.copy(ship.position);
    else if(U.kind==='cap'){holoO.copy(U.C.g.position);r=Math.max(.2,(U.C.hull?U.C.hull.len:200)*.55*k);}
    else if(U.kind==='wingman')holoO.copy(U.w.mesh.position);
    else{const m=sqAlive(U.q);if(m.length){holoO.set(0,0,0);for(const w of m)holoO.add(w.mesh.position);holoO.multiplyScalar(1/m.length);r=.24;}else r=0;}
    if(r&&holoMapPos(holoO,holoV)){sel.visible=true;sel.position.copy(holoV);sel.scale.setScalar(r*(1+Math.sin(holo.t*4)*.06));sel.rotation.z=holo.t*.5;}
  }
}
