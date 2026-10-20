"use strict";
/* Open-space dogfight arena: deep-space environment, solid obstacles, spawning.
   The sky (nebula, stars, sun, ringed planet) is shared with the trench, which looks up into it. */

/* ---- open-space dogfight arena: a bounded volume of deep space ---- */
const ARENA_R=620; let arenaEnv=null, arenaDomeMat=null, arenaSky=null; const arenaDebris=[];
const ARENA_SUN=new THREE.Vector3(.55,.32,-.77).normalize();   // sun direction: lights rocks, hulls and the planet alike
const skySun=ARENA_SUN.clone();   // the same direction as tipped with the sky in the trench (lights the planet)
/* Solid obstacles. Each collider is a signed-distance shape in its own local frame
   (sphere, box, capsule along x, ring around x); the ship, enemies, bolts and missiles all test against these. */
const arenaCols=[];   // {kind,inv:Matrix4,a,b,c,c0:Vector3 (bounding centre),br (bounding radius),name}

/* ---------- procedural textures ---------- */
function nebulaTexture(){
  const W=2048,H=1024,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  g.fillStyle='#020309';g.fillRect(0,0,W,H);
  // soft gas clouds along a winding galactic band; each blob is drawn three times so the seam wraps cleanly
  const blob=(x,y,r,col,a)=>{for(const ox of [-W,0,W]){
    const gr=g.createRadialGradient(x+ox,y,0,x+ox,y,r);gr.addColorStop(0,col.replace('A',a));gr.addColorStop(1,col.replace('A',0));
    g.fillStyle=gr;g.fillRect(x+ox-r,y-r,r*2,r*2);}};
  g.globalCompositeOperation='lighter';
  const cols=['rgba(110,40,170,A)','rgba(190,40,110,A)','rgba(30,120,170,A)','rgba(40,60,170,A)','rgba(210,90,60,A)'];
  for(let i=0;i<140;i++){
    const x=Math.random()*W, band=H*.5+Math.sin(x/W*6.283*2+.7)*H*.09;
    const y=band+(Math.random()-.5)*H*.22*(Math.random()<.3?2.2:1);
    blob(x,y,40+Math.random()*190,cols[(Math.random()*cols.length)|0],(.02+Math.random()*.05).toFixed(3));   // kept dim so ships stand out
  }
  // dark dust lanes through the brightest part of the band
  g.globalCompositeOperation='source-over';
  for(let i=0;i<60;i++){const x=Math.random()*W,y=H*.5+Math.sin(x/W*6.283*2+.7)*H*.09+(Math.random()-.5)*50;
    blob(x,y,30+Math.random()*80,'rgba(2,3,9,A)',(.25+Math.random()*.3).toFixed(2));}
  // faint background stars baked in (the bright ones are real points, see buildArena)
  for(let i=0;i<4200;i++){const y=Math.random()*H,near=Math.exp(-Math.pow((y-H*.5)/(H*.16),2));
    g.globalAlpha=Math.min(1,.08+Math.random()*.3+near*.2);g.fillStyle=Math.random()<.2?'#ffd9b0':Math.random()<.4?'#b8d4ff':'#ffffff';
    const s=Math.random()<.04?2:1;g.fillRect(Math.random()*W,y,s,s);}
  g.globalAlpha=1;
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
}
function planetTexture(){
  const W=1024,H=512,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const pal=[[24,38,86],[52,36,104],[34,98,132],[96,52,118],[20,64,104],[150,92,140]];
  const ph=[Math.random()*9,Math.random()*9,Math.random()*9];
  for(let y=0;y<H;y++){   // banded gas giant: layered sines pick a blend between palette stops
    const t=y/H, v=(Math.sin(t*38+ph[0]+Math.sin(t*9+ph[1])*2.2)*.5+.5)*.7+(Math.sin(t*120+ph[2])*.5+.5)*.3;
    const k=v*(pal.length-1),i=Math.min(pal.length-2,k|0),f=k-i,A=pal[i],B=pal[i+1];
    g.fillStyle='rgb('+((A[0]+(B[0]-A[0])*f)|0)+','+((A[1]+(B[1]-A[1])*f)|0)+','+((A[2]+(B[2]-A[2])*f)|0)+')';
    g.fillRect(0,y,W,1);
  }
  for(let i=0;i<26;i++){   // storms and swirls
    g.globalAlpha=.12+Math.random()*.2;g.fillStyle=Math.random()<.5?'#d8a8e8':'#1a2450';
    g.beginPath();g.ellipse(Math.random()*W,H*.2+Math.random()*H*.6,10+Math.random()*60,3+Math.random()*10,0,0,6.283);g.fill();
  }
  g.globalAlpha=1;
  return new THREE.CanvasTexture(c);
}

/* ---------- planet, ring and atmosphere shaders (lit from ARENA_SUN, not the scene lights) ---------- */
const PLANET_VS='varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);'+
  'vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';
const PLANET_FS='uniform sampler2D map;uniform vec3 sun;uniform vec3 atmo;varying vec2 vUv;varying vec3 vN;varying vec3 vW;'+
  'void main(){vec3 n=normalize(vN);vec3 v=normalize(cameraPosition-vW);float l=dot(n,sun);float lit=smoothstep(-.12,.55,l);'+
  'vec3 col=texture2D(map,vUv).rgb*(.025+lit*1.15);float rim=pow(1.-max(dot(n,v),0.),2.6);'+
  'col+=atmo*rim*(.08+smoothstep(-.35,.5,l)*1.2);gl_FragColor=vec4(col,1.);}';
const HALO_FS='uniform vec3 sun;uniform vec3 atmo;varying vec2 vUv;varying vec3 vN;varying vec3 vW;'+
  'void main(){vec3 n=normalize(vN);vec3 v=normalize(cameraPosition-vW);float z=-dot(n,v);'+
  'float i=smoothstep(0.,.3,z)*(1.-smoothstep(.3,.75,z));i*=.15+smoothstep(-.4,.6,dot(n,sun))*.95;gl_FragColor=vec4(atmo*i,i);}';
/* combat-zone edge: grid lines drawn only in a soft patch around the player's nearest point on the dome */
const DOME_FS='uniform vec3 pp;uniform float k;varying vec2 vUv;varying vec3 vW;void main(){'+
  'vec2 g=vUv*vec2(72.,36.);vec2 f=abs(fract(g-.5)-.5)/fwidth(g);float l=1.-min(min(f.x,f.y),1.);'+
  'float a=k*(1.-smoothstep(30.,220.,distance(vW,pp)))*(.05+l*.3);gl_FragColor=vec4(vec3(.25,.75,1.)*a,a);}';
const RING_VS='varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const RING_FS='uniform float r0;uniform float r1;varying vec3 vP;void main(){float t=(length(vP.xy)-r0)/(r1-r0);'+
  'float b=.5+.5*sin(t*70.)*sin(t*23.+1.3);float gap=smoothstep(.52,.55,t)*(1.-smoothstep(.58,.61,t));'+
  'float a=smoothstep(0.,.06,t)*(1.-smoothstep(.9,1.,t))*(.18+.5*b)*(1.-gap*.85)*.55;'+
  'vec3 c=mix(vec3(.62,.5,.85),vec3(.4,.78,.92),t);gl_FragColor=vec4(c*a*1.3,a);}';

/* ---------- colliders ---------- */
const _cp=new THREE.Vector3(), _cq=new THREE.Quaternion(), _cs=new THREE.Vector3();
function addCol(kind,obj,a,b,c,name){   // obj: a mesh/group already placed in arenaEnv (world matrix current)
  obj.matrixWorld.decompose(_cp,_cq,_cs);
  const inv=new THREE.Matrix4().compose(_cp,_cq,new THREE.Vector3(1,1,1)).invert();
  const br=kind==='sphere'?a:kind==='box'?Math.hypot(a,b,c):kind==='cap'?a+b:a+b;
  arenaCols.push({kind,inv,a,b,c,c0:_cp.clone(),br,name});
}
const _lp=new THREE.Vector3();
function colSdf(C,wp){
  _lp.copy(wp).applyMatrix4(C.inv);const x=_lp.x,y=_lp.y,z=_lp.z;
  if(C.kind==='sphere')return _lp.length()-C.a;
  if(C.kind==='box'){const qx=Math.abs(x)-C.a,qy=Math.abs(y)-C.b,qz=Math.abs(z)-C.c;
    return Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0);}
  if(C.kind==='cap'){const dx=x-Math.max(-C.b,Math.min(C.b,x));return Math.hypot(dx,y,z)-C.a;}   // a=radius, b=half length (x axis)
  const q=Math.hypot(y,z)-C.a;return Math.hypot(q,x)-C.b;                                       // ring: a=major radius, b=tube
}
/* distance from wp to the nearest obstacle surface (negative inside); colliders further than `reach` are skipped */
let arenaHitName='';
function arenaSdf(wp,reach){
  let d=1e9;
  for(const C of arenaCols){
    if(wp.distanceTo(C.c0)-C.br>Math.min(d,reach))continue;
    const s=colSdf(C,wp);if(s<d){d=s;arenaHitName=C.name;}
  }
  return d;
}
const _gp=new THREE.Vector3();
function arenaNormal(wp,out){   // outward surface normal at wp (gradient of the distance field)
  const e=.6,r=60;
  _gp.copy(wp);_gp.x+=e;let dx=arenaSdf(_gp,r);_gp.x-=2*e;dx-=arenaSdf(_gp,r);_gp.x+=e;
  _gp.y+=e;let dy=arenaSdf(_gp,r);_gp.y-=2*e;dy-=arenaSdf(_gp,r);_gp.y+=e;
  _gp.z+=e;let dz=arenaSdf(_gp,r);_gp.z-=2*e;dz-=arenaSdf(_gp,r);
  out.set(dx,dy,dz);if(out.lengthSq()<1e-9)out.copy(wp).normalize();return out.normalize();
}
/* does the segment a→b pass into an obstacle? (bolts, missiles) */
const _sp=new THREE.Vector3();
function arenaSegHit(a,b){
  const len=a.distanceTo(b);
  for(const C of arenaCols){
    if(!segSphere(a,b,C.c0,C.br+1))continue;
    const n=Math.max(1,Math.min(16,Math.ceil(len/2.5)));
    for(let k=1;k<=n;k++){_sp.lerpVectors(a,b,k/n);if(colSdf(C,_sp)<.4)return true;}
  }
  return false;
}
/* shove a point that ended up inside an obstacle back out to its surface plus radius r */
const _pn=new THREE.Vector3();
function arenaPushOut(pos,r){
  const d=arenaSdf(pos,r+2);if(d>=r)return false;
  arenaNormal(pos,_pn);pos.addScaledVector(_pn,r-d+.05);return true;
}

/* ---------- environment ---------- */
/* lumpy asteroid: an icosphere with deterministic per-direction displacement (shared vertices stay welded) */
function rockGeo(seed){
  const g=new THREE.IcosahedronGeometry(1,1),pa=g.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<pa.count;i++){
    v.fromBufferAttribute(pa,i).normalize();
    const k=1+.24*Math.sin(v.x*2.9+seed)*Math.sin(v.y*3.3+seed*1.7)*Math.sin(v.z*2.6+seed*.6)
             +.1*Math.sin(v.x*7.1+v.y*5.3+seed*2.3)+.06*Math.sin(v.z*11.+seed);
    pa.setXYZ(i,v.x*k,v.y*k,v.z*k);
  }
  g.computeVertexNormals();return g;
}
/* the sky: nebula sphere, real star points, the sun and the ringed gas giant, all carried with the
   camera so they sit at infinity. Built once and shown in both sectors (see spaceSky()). */
function buildSky(){
  if(arenaSky)return;
  arenaSky=new THREE.Group();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(3600,48,24),
    new THREE.MeshBasicMaterial({map:nebulaTexture(),side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false}));
  sky.rotation.set(.5,0,.42);sky.renderOrder=-2;arenaSky.add(sky);   // tilt the galactic band across the view
  for(const [n,size] of [[1700,1.1],[120,2.1]]){   // few bright stars, so a far ship isn't lost among them
    const pos=[],col=[],c=new THREE.Color(),v=new THREE.Vector3();
    for(let i=0;i<n;i++){v.set(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1);if(v.lengthSq()>1||v.lengthSq()<.01){i--;continue;}
      v.setLength(3300);pos.push(v.x,v.y,v.z);
      c.setHSL(Math.random()<.6?.6:.13,.3,.65+Math.random()*.25);col.push(c.r,c.g,c.b);}   // cool whites: enemy beacons are the warm points
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));sg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const pts=new THREE.Points(sg,new THREE.PointsMaterial({size,sizeAttenuation:false,vertexColors:true,fog:false,depthWrite:false}));
    pts.renderOrder=-1;arenaSky.add(pts);
  }
  // the sun: white-hot core and two layers of glow, in the same direction the scene's key light comes from
  const sunPos=ARENA_SUN.clone().multiplyScalar(3400);
  const sunCore=new THREE.Mesh(new THREE.SphereGeometry(70,20,14),new THREE.MeshBasicMaterial({color:0xfff6e0,fog:false}));
  sunCore.position.copy(sunPos);arenaSky.add(sunCore);
  for(const [s,col,o] of [[900,0xffd49a,.85],[2600,0xff8a5a,.22]]){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,transparent:true,opacity:o,
      blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    sp.scale.setScalar(s);sp.position.copy(sunPos);arenaSky.add(sp);
  }
  /* ---- ringed gas giant ---- */
  const PR=560, pPos=new THREE.Vector3(-.62,.18,-.76).normalize().multiplyScalar(2600);
  const atmo=new THREE.Color(0x4f9cff);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(PR,64,40),new THREE.ShaderMaterial({vertexShader:PLANET_VS,fragmentShader:PLANET_FS,
    uniforms:{map:{value:planetTexture()},sun:{value:skySun},atmo:{value:atmo}}}));
  planet.position.copy(pPos);planet.rotation.set(.35,0,-.3);arenaSky.add(planet);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(PR*1.07,64,40),new THREE.ShaderMaterial({vertexShader:PLANET_VS,fragmentShader:HALO_FS,
    uniforms:{sun:{value:skySun},atmo:{value:atmo}},side:THREE.BackSide,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  halo.position.copy(pPos);arenaSky.add(halo);
  const ring=new THREE.Mesh(new THREE.RingGeometry(PR*1.35,PR*2.25,160,1),new THREE.ShaderMaterial({vertexShader:RING_VS,fragmentShader:RING_FS,
    uniforms:{r0:{value:PR*1.35},r1:{value:PR*2.25}},side:THREE.DoubleSide,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  ring.position.copy(pPos);ring.rotation.set(Math.PI/2-.32,.18,-.3);arenaSky.add(ring);
  scene.add(arenaSky);
}
/* show the sky for a sector. The trench sees it through the strip of sky above the walls, so there it
   is tipped back to lift the planet and sun overhead. */
function spaceSky(arena){
  buildSky();
  arenaSky.visible=true;
  const tip=arena?0:.62;arenaSky.rotation.set(tip,0,0);skySun.copy(ARENA_SUN).applyAxisAngle(_cs.set(1,0,0),tip);
  trenchStars.visible=false;   // the sky has its own stars
}
function buildArena(){
  if(arenaEnv)return;
  arenaEnv=new THREE.Group();
  /* ---- combat-zone edge: a grid that fades in only around you as you push toward it ---- */
  arenaDomeMat=new THREE.ShaderMaterial({vertexShader:PLANET_VS,fragmentShader:DOME_FS,uniforms:{pp:{value:new THREE.Vector3()},k:{value:0}},
    side:THREE.DoubleSide,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,extensions:{derivatives:true}});
  arenaDomeMat.visible=false;
  arenaEnv.add(new THREE.Mesh(new THREE.SphereGeometry(ARENA_R,96,48),arenaDomeMat));
  /* ---- derelict station: a landmark to fight around ---- */
  const der=new THREE.Group();der.position.set(150,-30,-200);arenaEnv.add(der);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(24,24,130,14),M.dark);core.rotation.z=Math.PI/2;der.add(core);
  for(const s of [-1,1]){
    const ringR=new THREE.Mesh(new THREE.TorusGeometry(58,6,10,40),M.dark2);ringR.position.x=s*34;ringR.rotation.y=Math.PI/2;der.add(ringR);
    const lit=new THREE.Mesh(new THREE.TorusGeometry(58,1.3,6,40),s>0?M.cyan:M.mag);lit.position.x=s*34;lit.rotation.y=Math.PI/2;der.add(lit);
    for(let k=0;k<4;k++){   // spokes from the hub to each ring
      const sp=new THREE.Mesh(new THREE.BoxGeometry(3,58-24,3),M.dark2);const a=k*Math.PI/2+.4;
      sp.position.set(s*34,Math.cos(a)*41,Math.sin(a)*41);sp.rotation.x=-a;der.add(sp);
    }
  }
  for(let k=0;k<10;k++){   // lit window band around the hub
    const w=new THREE.Mesh(new THREE.BoxGeometry(6,1.2,.6),k%3?M.white:M.amber);const a=k/10*6.283;
    w.position.set(-6+(k%2)*12,Math.cos(a)*24.2,Math.sin(a)*24.2);w.rotation.x=-a;der.add(w);
  }
  const fin=new THREE.Mesh(new THREE.BoxGeometry(10,96,44),M.dark);fin.position.set(-78,0,0);der.add(fin);
  const finLit=new THREE.Mesh(new THREE.BoxGeometry(10.4,2,44.4),M.mag);finLit.position.set(-78,40,0);der.add(finLit);
  /* ---- wrecked capital ship: a broken hull with real cover along it ---- */
  const wreck=new THREE.Group();wreck.position.set(-300,40,150);wreck.rotation.set(.08,.6,.25);arenaEnv.add(wreck);
  const hull=new THREE.Mesh(new THREE.BoxGeometry(46,34,170),M.dark);hull.position.z=30;wreck.add(hull);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(30,10,120),M.dark2);deck.position.set(0,22,40);wreck.add(deck);
  const bridge=new THREE.Mesh(new THREE.BoxGeometry(16,26,22),M.dark2);bridge.position.set(0,40,82);wreck.add(bridge);
  const bow=new THREE.Mesh(new THREE.BoxGeometry(38,28,70),M.dark);bow.position.set(8,-14,-110);bow.rotation.set(.32,.18,-.2);wreck.add(bow);
  for(const sx of [-1,1]){
    const eng=new THREE.Mesh(new THREE.CylinderGeometry(9,11,26,12),M.dark2);eng.rotation.x=Math.PI/2;eng.position.set(sx*14,-4,128);wreck.add(eng);
    const strip=new THREE.Mesh(new THREE.BoxGeometry(.6,1.4,150),sx>0?M.cyan:M.mag);strip.position.set(sx*23.3,6,30);wreck.add(strip);
  }
  const embers=new THREE.Mesh(new THREE.BoxGeometry(44,30,2),M.glow);embers.position.z=-55.5;wreck.add(embers);   // the torn-open break glows
  /* ---- asteroids ---- */
  const rockMats=[new THREE.MeshPhongMaterial({color:0x6c6872,specular:0x161616,shininess:6,flatShading:true}),
                  new THREE.MeshPhongMaterial({color:0x564a44,specular:0x111111,shininess:4,flatShading:true})];
  const rockGeos=[];for(let i=0;i<6;i++)rockGeos.push(rockGeo(i*3.7+1));
  arenaEnv.updateMatrixWorld(true);
  // the man-made colliders first, so the rock field can be placed around them
  addCol('cap',der,24,65,0,'the derelict station');   // the station group's x axis is the hub axis
  for(const s of [-1,1]){const o=new THREE.Object3D();o.position.set(s*34,0,0);der.add(o);o.updateMatrixWorld(true);addCol('ring',o,58,6,0,'the station ring');}
  addCol('box',fin,5,48,22,'the station fin');
  addCol('box',hull,23,17,85,'the wrecked cruiser');addCol('box',deck,15,5,60,'the wrecked cruiser');
  addCol('box',bridge,8,13,11,'the cruiser bridge');addCol('box',bow,19,14,35,'the cruiser bow');
  for(const sx of [-1,1]){const o=new THREE.Object3D();o.position.set(sx*14,-4,128);wreck.add(o);o.updateMatrixWorld(true);addCol('sphere',o,12,0,0,'the cruiser engines');}
  const rv=new THREE.Vector3();let placed=0;
  for(let tries=0;tries<600&&placed<40;tries++){
    const big=placed<7, size=big?30+Math.random()*26:7+Math.random()*18;
    rv.set(Math.random()*2-1,(Math.random()*2-1)*.7,Math.random()*2-1);if(rv.lengthSq()>1)continue;
    rv.multiplyScalar(ARENA_R-60-size);
    if(rv.length()<130+size)continue;                          // keep the start point open
    if(arenaCols.length&&arenaSdf(rv,size+40)<size+(big?40:18))continue;   // no overlaps, leave lanes between rocks
    const sx=.85+Math.random()*.3,sy=.7+Math.random()*.3,sz=.85+Math.random()*.3;
    const rock=new THREE.Mesh(rockGeos[placed%rockGeos.length],rockMats[placed%2]);
    rock.scale.set(size*sx,size*sy,size*sz);rock.position.copy(rv);rock.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    arenaEnv.add(rock);rock.updateMatrixWorld(true);
    if(big){   // neon crystal seams on the big rocks, so they read in the dark
      for(let k=0;k<3+((Math.random()*3)|0);k++){
        const cr=new THREE.Mesh(sharedGeo('crystal',()=>new THREE.OctahedronGeometry(1,0)),Math.random()<.6?M.cyan:M.mag);
        rv.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();
        cr.position.copy(rv).multiplyScalar(.82);cr.scale.set(.05,.16+Math.random()*.1,.05);cr.lookAt(rv.multiplyScalar(2));
        rock.add(cr);
      }
    }
    addCol('sphere',rock,size*.86*(sx+sy+sz)/3,0,0,'an asteroid');
    arenaDebris.push({m:rock,rs:(Math.random()-.5)*.25});
    placed++;
  }
  // a thin belt of distant rocks beyond the boundary for depth and parallax (scenery only, no collision)
  const beltN=240, belt=new THREE.InstancedMesh(rockGeos[0],rockMats[0],beltN), bm=new THREE.Matrix4(), bq=new THREE.Quaternion(), be=new THREE.Euler();
  for(let i=0;i<beltN;i++){
    const a=Math.random()*6.283, r=780+Math.random()*900, s=3+Math.pow(Math.random(),2)*34;
    rv.set(Math.cos(a)*r,(Math.random()-.5)*120+Math.sin(a*2)*60,Math.sin(a)*r).applyAxisAngle(_cs.set(1,0,.3).normalize(),.35);
    be.set(Math.random()*6,Math.random()*6,0);bq.setFromEuler(be);
    bm.compose(rv,bq,_cp.set(s,s*.8,s));belt.setMatrixAt(i,bm);
  }
  arenaEnv.add(belt);
  scene.add(arenaEnv);
}
/* Space lighting for the arena (a warm key light from the sun, less flat ambient, thin haze) vs the trench's neon city */
function arenaAtmosphere(on){
  if(on){
    scene.fog.color.setHex(0x04060e);scene.fog.density=.00032;scene.background.setHex(0x02030a);
    ambLight.color.setHex(0x2a3350);ambLight.intensity=.5;hemiLight.intensity=.2;
    dust.material.opacity=.2;   // faint motes: still show speed, but don't read as distant ships
    dir.color.setHex(0xfff0dc);dir.intensity=1.25;dir.position.copy(ARENA_SUN);
  }else{
    scene.fog.density=.0024;
    ambLight.color.setHex(0x33405f);ambLight.intensity=.9;hemiLight.intensity=.4;
    dust.material.opacity=.55;
    dir.color.setHex(0x7fb0ff);dir.intensity=.55;dir.position.set(.3,1,.4);
  }
}
/* a spawn point ~480 from the player, random bearing, kept inside the zone and out of the rocks */
function arenaSpawnPos(){
  for(let i=0;i<10;i++){
    const a=Math.random()*6.28,e=(Math.random()-.5)*1.1;
    tmp2.set(Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)).multiplyScalar(440+Math.random()*120).add(ship.position);
    const L=tmp2.length();if(L>ARENA_R-70)tmp2.multiplyScalar((ARENA_R-70)/L);
    if(arenaSdf(tmp2,30)>20)break;
  }
  return tmp2.clone();
}
function spawnArena(dt){
  const regular=S.arenaTarget-(S.leaderMode?1:0);
  const remaining=regular-S.kills-fighters.length-bombers.length;
  S.fighterT-=dt;
  if(S.fighterT<=0&&fighters.length<4&&remaining>0){
    S.fighterT=1.2+Math.random()*1.1;
    let kind=pickEnemyKind((S.mission&&S.mission.roster)||ROSTER_ARENA);
    const count=k=>fighters.filter(f=>f.kind===k).length;
    if((kind==='hunter'&&count('hunter')>=1)||(kind==='ace'&&count('ace')>=2))kind='grunt';   // cap the hard ones
    arenaFighter(kind);
  }
  // leader missions: once the squadron is down, its leader comes for you
  if(S.leaderMode&&!S.leaderSpawned&&S.kills>=regular){
    S.leaderSpawned=true;arenaFighter('leader');
    announce('SQUADRON LEADER',LEADER_CALLSIGN+' inbound','ace');
  }
  S.bomberT-=dt;
  if(S.bomberT<=0&&bombers.length<1&&S.kills>3&&remaining>2){
    S.bomberT=13+Math.random()*6;
    spawnBomber(0);bombers[bombers.length-1].mesh.position.copy(arenaSpawnPos());
  }
}
function arenaFighter(kind){
  const F=spawnFighter(0,kind);
  F.mesh.position.copy(arenaSpawnPos());
  F.wvel.copy(ship.position).sub(F.mesh.position).setLength(F.T.speed);   // head in toward the player
  if(F.T.ace&&kind!=='leader'&&S.annT<=0)announce('ACE INBOUND',F.callsign,'ace');
}
