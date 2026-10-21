"use strict";
/* Menu backdrops: a small 3D scene drawn instead of the game while the menus are up. Each mode on
   the title screen has its own set (campaign: the planet with your squadron; free trench: a run down
   the trench; free dogfight: a fight in open space; hangar: the bay with your hull on a turntable),
   and the hangar screen revolves whichever hull is selected. Sets are built the first time they
   show. renderStage() is called by the main loop in place of renderFrame() while in the menus. */
const stageScene=new THREE.Scene();
const stageCam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,9000);
stageScene.fog=new THREE.FogExp2(0x05060f,.00002);   // one fog object for every set, so switching never recompiles shaders
let stageCur=null, stageMode='campaign', stageHullId='s1', stageFadeT=0, stageT=0, stageWasOn=false;
const stageShift={x:0,y:0};   // eased view offset that moves the focus off-centre, as a fraction of the screen
const STAGE_BUILD={}, STAGE_SETS={};

{ // lights shared by every set (a fixed light count, for the same reason as the fog)
  stageScene.add(new THREE.AmbientLight(0x33405f,.8));
  stageScene.add(new THREE.HemisphereLight(0x4a6fa0,0x10081a,.5));
  const key=new THREE.DirectionalLight(0xdcecff,1.4);key.position.set(3,5,4);stageScene.add(key);
  const rim=new THREE.DirectionalLight(0xff2d78,1.1);rim.position.set(-4,1,-3);stageScene.add(rim);
  const fill=new THREE.DirectionalLight(0x00f0ff,.7);fill.position.set(-2,-1,4);stageScene.add(fill);
}
/* ---- shared pieces ---- */
function stageStars(n,r){
  const pos=[],col=[],c=new THREE.Color(),tints=[0xffffff,0xbfe4ff,0x9fd8ff,0xffc2dc,0xffe2b0];
  for(let i=0;i<n;i++){
    const u=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-u*u),d=r*(.8+Math.random()*.2);
    pos.push(Math.cos(a)*s*d,u*d,Math.sin(a)*s*d);
    c.setHex(tints[(Math.random()*tints.length)|0]).multiplyScalar(.35+Math.random()*.65);col.push(c.r,c.g,c.b);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return new THREE.Points(geo,new THREE.PointsMaterial({size:1.8,sizeAttenuation:false,vertexColors:true,fog:false}));
}
stageScene.add(stageStars(2600,5200));
/* soft nebula cloud: a sprite of overlapping glows in one colour */
function stageNebula(rgb,x,y,z,size,op){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  for(let i=0;i<16;i++){
    const px=60+Math.random()*136,py=60+Math.random()*136,r=Math.min(px,256-px,py,256-py,30+Math.random()*90);
    const gr=g.createRadialGradient(px,py,0,px,py,r);
    gr.addColorStop(0,'rgba('+rgb+',.26)');gr.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=gr;g.fillRect(0,0,256,256);
  }
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),blending:THREE.AdditiveBlending,
    transparent:true,opacity:op||.8,depthWrite:false,fog:false}));
  s.position.set(x,y,z);s.scale.setScalar(size);s.material.rotation=Math.random()*6.28;return s;
}
function stageGlow(color,size,op){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color,blending:THREE.AdditiveBlending,transparent:true,
    opacity:op,depthWrite:false,fog:false}));
  s.scale.setScalar(size);return s;
}
/* a lit planet: banded surface with city-light sprawl on an emissive map, plus an atmosphere rim */
function stagePlanet(R,hue){
  const W=1024,H=512,c=document.createElement('canvas'),l=document.createElement('canvas');
  c.width=l.width=W;c.height=l.height=H;const g=c.getContext('2d'),q=l.getContext('2d');
  g.fillStyle=hue==='warm'?'#2a1022':'#0c1634';g.fillRect(0,0,W,H);
  for(let i=0;i<110;i++){const y=Math.random()*H,h=3+Math.random()*24;
    g.fillStyle='rgba('+(Math.random()<.5?'50,90,170':'110,50,130')+','+(.12+Math.random()*.3)+')';g.fillRect(0,y,W,h);}
  for(let i=0;i<46;i++){g.fillStyle='rgba(14,20,40,.75)';g.beginPath();
    g.ellipse(Math.random()*W,H*.15+Math.random()*H*.7,20+Math.random()*110,8+Math.random()*44,Math.random()*3,0,7);g.fill();}
  q.fillStyle='#000';q.fillRect(0,0,W,H);
  const cols=['255,179,0','0,240,255','255,45,120','255,210,150'];
  for(let k=0;k<34;k++){const cx=Math.random()*W,cy=H*.2+Math.random()*H*.6,col=cols[(Math.random()*cols.length)|0],n=60+Math.random()*180;
    for(let i=0;i<n;i++){const a=Math.random()*6.28,r=Math.pow(Math.random(),2)*46;
      q.fillStyle='rgba('+col+','+(.25+Math.random()*.75)+')';q.fillRect(cx+Math.cos(a)*r*1.9,cy+Math.sin(a)*r,1.6,1.6);}}
  q.strokeStyle='rgba(0,240,255,.35)';q.lineWidth=1;   // arcology transit lines
  for(let i=0;i<12;i++){q.beginPath();q.moveTo(Math.random()*W,H*.25+Math.random()*H*.5);
    q.lineTo(Math.random()*W,H*.25+Math.random()*H*.5);q.stroke();}
  const p=new THREE.Group();
  p.add(new THREE.Mesh(new THREE.SphereGeometry(R,64,40),new THREE.MeshLambertMaterial({color:0x8a96b8,map:new THREE.CanvasTexture(c),
    emissive:0xffffff,emissiveMap:new THREE.CanvasTexture(l),fog:false})));
  p.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.035,48,32),new THREE.MeshBasicMaterial({color:hue==='warm'?0xff5a8a:0x3a9cff,
    transparent:true,opacity:.28,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})));
  const halo=stageGlow(hue==='warm'?0xff2d78:0x2a7cff,R*2.6,.45);p.add(halo);
  return p;
}
/* a player hull for the backdrops, without the gameplay lights the live ship carries */
const stageHulls={};
function stageHull(id,slot){
  const k=slot+':'+id;if(stageHulls[k])return stageHulls[k];
  const ext=buildShipExterior(shipById(id).visual);
  const lights=[];ext.group.traverse(o=>{if(o.isLight)lights.push(o);});lights.forEach(o=>o.parent.remove(o));
  const box=new THREE.Box3().setFromObject(ext.group),ctr=box.getCenter(new THREE.Vector3());
  ext.group.position.sub(ctr);
  const pivot=new THREE.Group();pivot.add(ext.group);
  return stageHulls[k]={pivot,flames:ext.flames,strobes:ext.strobes,radius:box.getSize(new THREE.Vector3()).length()/2};
}
/* keep `holder` showing hull `id`; returns the hull record */
function stageSetHull(holder,id,slot){
  if(holder.userData.id!==id){
    if(holder.userData.hull)holder.remove(holder.userData.hull.pivot);
    const h=stageHull(id,slot);holder.add(h.pivot);holder.userData.hull=h;holder.userData.id=id;
  }
  return holder.userData.hull;
}
function stageEngines(h,t,k){
  h.flames.forEach((f,i)=>{const fl=1+Math.sin(t*37+i*2.1)*.07+Math.sin(t*61+i)*.05;f.scale.set(fl,fl,(k||1.7)*fl);});
  h.strobes.forEach((s,i)=>{s.visible=((t*1.1+i*.15)%1)<.08;});
}
/* ship orientation along a path: nose (-z) toward where it is heading, banked into the turn */
const stageV1=new THREE.Vector3(),stageV2=new THREE.Vector3();
function stageFly(obj,pos,next,prevDir){
  obj.position.copy(pos);
  stageV1.subVectors(next,pos).normalize();
  const turn=prevDir.x*stageV1.z-prevDir.z*stageV1.x;   // yaw rate sign → bank
  obj.userData.bank=(obj.userData.bank||0)*.9+THREE.MathUtils.clamp(-turn*55,-1.1,1.1)*.1;
  stageV2.copy(pos).sub(stageV1);obj.lookAt(stageV2);obj.rotateZ(obj.userData.bank);
  prevDir.copy(stageV1);
}

/* ---- campaign: the arcology world below, your squadron on approach ---- */
STAGE_BUILD.campaign=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x04050d,fog:[0x04050d,.00002]};
  const planet=stagePlanet(560);planet.position.set(170,-610,-1180);planet.rotation.set(.3,0,.22);g.add(planet);
  const moon=stagePlanet(70,'warm');moon.position.set(-620,230,-1900);g.add(moon);
  const sun=stageGlow(0xffd9a0,700,.6);sun.position.set(-2100,900,-3600);g.add(sun);
  const core=stageGlow(0xffffff,110,.9);core.position.copy(sun.position);g.add(core);
  g.add(stageNebula('255,45,120',-900,300,-2600,2600,.55),stageNebula('0,140,255',700,500,-2900,2400,.5));
  const wing=[];
  for(const [x,y,z] of [[0,0,-20],[-8,-1.6,-28],[8,-1.6,-28]]){const h=new THREE.Group();h.position.set(x,y,z);
    h.userData.home=new THREE.Vector3(x,y,z);g.add(h);wing.push(h);}
  const dust=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x9fd8ff,size:.22,transparent:true,opacity:.7}));
  const dp=[];for(let i=0;i<500;i++)dp.push((Math.random()-.5)*120,(Math.random()-.5)*60,-140+Math.random()*160);
  dust.geometry.setAttribute('position',new THREE.Float32BufferAttribute(dp,3));g.add(dust);
  set.cam=(t)=>{stageCam.position.set(11+Math.sin(t*.07)*3,5+Math.sin(t*.11),8);stageCam.lookAt(0,-2,-26);};
  set.tick=(dt,t)=>{
    planet.rotation.y+=dt*.008;moon.rotation.y+=dt*.02;
    wing.forEach((h,i)=>{const hull=stageSetHull(h,PROG.ship,'wing'+i);
      h.position.copy(h.userData.home);h.position.y+=Math.sin(t*.8+i*1.7)*.5;h.position.x+=Math.sin(t*.5+i)*.6;
      h.rotation.set(Math.sin(t*.6+i)*.04,0,Math.sin(t*.5+i*1.3)*.12);stageEngines(hull,t+i);});
    const a=dust.geometry.attributes.position;
    for(let i=0;i<a.count;i++){let z=a.getZ(i)+dt*60;if(z>20)z-=160;a.setZ(i,z);}
    a.needsUpdate=true;
  };
  return set;
};
/* ---- flight school: a trainer low over the dusk academy runway ---- */
STAGE_BUILD.school=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x7a6270,fog:[0x7a6270,.0011]};
  const GY=-16,lam=c=>new THREE.MeshLambertMaterial({color:c});
  // sky: the same warm-horizon-to-deep-blue gradient the academy range uses
  const sg=new THREE.SphereGeometry(3000,32,16),pos=sg.attributes.position,col=[],top=new THREE.Color(0x0c1830),hor=new THREE.Color(0xff9a5a),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){const k=Math.pow(Math.max(0,Math.min(1,pos.getY(i)/3000+.1)),.55);col.push(...c.copy(hor).lerp(top,k).toArray());}
  sg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const sky=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));sky.renderOrder=-2;g.add(sky);
  const sun=stageGlow(0xffd9a0,900,.8);sun.position.set(-700,120,-2600);g.add(sun);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(150,32),new THREE.MeshBasicMaterial({color:0xffd9a0,fog:false}));
  disc.position.set(-700,120,-2800);g.add(disc);
  const put=(m,x,y,z)=>{m.position.set(x,y,z);g.add(m);return m;};
  for(let i=0;i<36;i++){const a=i/36*6.283,h=100+Math.abs(Math.sin(i*2.1))*220;   // ridge line all the way round
    const m=new THREE.Mesh(new THREE.ConeGeometry(110+Math.abs(Math.sin(i*3.3))*120,h,5),lam(0x1a2233));
    put(m,Math.cos(a)*2200,GY+h/2,Math.sin(a)*2200).rotation.y=i;}
  put(new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),lam(0x16212e)),0,GY,0).rotation.x=-Math.PI/2;
  const grid=put(new THREE.GridHelper(1500,50,0x00f0ff,0x0a3a48),0,GY+.2,0);grid.material.transparent=true;grid.material.opacity=.3;
  put(new THREE.Mesh(new THREE.BoxGeometry(60,.4,2400),lam(0x0b0f16)),0,GY+.2,-900);
  const stripes=[];
  for(let z=-1500;z<=300;z+=40){
    stripes.push(put(new THREE.Mesh(new THREE.BoxGeometry(1.4,.5,16),M.white),0,GY+.5,z));
    for(const sx of[-1,1])put(new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,1.2),(z/40)%5===0?M.mag:M.amber),sx*31,GY+.8,z);
  }
  for(const [x,z] of [[-110,-60],[-110,-170],[-110,-280],[-110,-390],[120,-130],[120,-260]]){   // hangars either side
    put(new THREE.Mesh(new THREE.BoxGeometry(64,26,76),lam(0x2a3446)),x,GY+13,z);
    put(new THREE.Mesh(new THREE.BoxGeometry(.6,18,46),M.cyan),x+(x<0?32.1:-32.1),GY+10,z);
  }
  put(new THREE.Mesh(new THREE.BoxGeometry(10,70,10),lam(0x2a3446)),70,GY+35,-90);   // control tower
  put(new THREE.Mesh(new THREE.BoxGeometry(26,11,26),M.cyan),70,GY+75,-90);
  put(new THREE.Mesh(new THREE.SphereGeometry(2.4,8,6),M.mag),70,GY+98,-90);
  const h=new THREE.Group();g.add(h);
  set.cam=(t)=>{stageCam.position.set(13+Math.sin(t*.12)*3,GY+22+Math.sin(t*.17)*1.5,12);stageCam.lookAt(0,GY+14,-30);};
  set.tick=(dt,t)=>{
    const hull=stageSetHull(h,PROG.ship,'school');
    hull.pivot.scale.setScalar(7/hull.radius);
    h.position.set(Math.sin(t*.5)*1.2,GY+16+Math.sin(t*.9)*.6,-24);
    h.rotation.set(Math.sin(t*.6)*.03,0,Math.sin(t*.5)*.1);stageEngines(hull,t);
    stripes.forEach(m=>{m.position.z+=dt*90;if(m.position.z>300)m.position.z-=1800;});   // the runway slides under you
  };
  return set;
};
/* ---- free trench: flying the trench at speed ---- */
STAGE_BUILD.trench=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x05060f,fog:[0x070a18,.0034]};
  const N=7,segs=[];
  for(let i=0;i<N;i++){const s=buildSegment();s.position.z=20-i*SEG_LEN;g.add(s);segs.push(s);}
  const h=new THREE.Group();g.add(h);
  const cy=FLOOR_Y+16;
  set.cam=(t)=>{stageCam.position.set(h.position.x*.45,cy+4.5,2);stageCam.lookAt(h.position.x*.6,cy+1.5,-70);};
  set.tick=(dt,t)=>{
    for(const s of segs){s.position.z+=dt*120;if(s.position.z-SEG_LEN>20)s.position.z-=N*SEG_LEN;}
    const hull=stageSetHull(h,PROG.ship,'trench');
    h.position.set(Math.sin(t*.55)*7,cy+2.5+Math.sin(t*.9)*1.6,-13);
    h.rotation.set(Math.cos(t*.9)*.05,-Math.cos(t*.55)*.08,-Math.cos(t*.55)*.55);
    stageEngines(hull,t,2.4);
  };
  return set;
};
/* ---- free dogfight: your hull chasing syndicate fighters through open space ---- */
STAGE_BUILD.arena=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x04040c,fog:[0x04040c,.00002]};
  g.add(stageNebula('255,45,120',-700,150,-1900,3000,.5),stageNebula('150,70,255',900,-150,-2100,2800,.42),
    stageNebula('0,200,255',250,650,-2600,2600,.32));
  const planet=stagePlanet(300,'warm');planet.position.set(-1500,-420,-2800);g.add(planet);
  const C=new THREE.Vector3(0,0,-140);
  const rocks=[];
  for(let i=0;i<28;i++){
    const r=2+Math.random()*12,geo=new THREE.IcosahedronGeometry(r,0);
    const m=new THREE.Mesh(geo,M.dark2);m.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x2a4a6a,wireframe:true,transparent:true,opacity:.45})));
    m.position.set((Math.random()*2-1)*320,(Math.random()*2-1)*140,C.z-70-Math.random()*380);
    m.userData.spin=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(.4);
    g.add(m);rocks.push(m);
  }
  enemyMats();
  const foe=new THREE.Group(),foe2=new THREE.Group(),me=new THREE.Group();
  ENEMY_BUILD.grunt(foe);ENEMY_BUILD.dart(foe2);foe.scale.setScalar(1.5);foe2.scale.setScalar(1.5);g.add(foe,foe2,me);
  for(const o of [foe,foe2,me])o.userData.dir=new THREE.Vector3(0,0,-1);
  const path=(u,out)=>out.set(Math.sin(u)*52,Math.sin(u*2)*13+Math.sin(u*.5)*7,Math.cos(u)*34).add(C);
  const path2=(u,out)=>out.set(Math.cos(u*1.3)*66,Math.cos(u)*20,Math.sin(u*1.3)*42).add(C).add(stageV1.set(0,8,-30));
  const bolts=[],flashes=[];
  const boltGeoS=new THREE.BoxGeometry(.35,.35,8);
  for(let i=0;i<36;i++){const b=new THREE.Mesh(boltGeoS,M.boltP);b.visible=false;b.userData={v:new THREE.Vector3(),life:0};g.add(b);bolts.push(b);}
  for(let i=0;i<6;i++){const f=stageGlow(0xffb060,10,0);f.visible=false;g.add(f);flashes.push(f);}
  const fire=(from,to,mat,spread)=>{const b=bolts.find(x=>!x.visible);if(!b)return;
    b.material=mat;b.visible=true;b.position.copy(from);b.userData.life=.7;b.userData.mat=mat;
    b.userData.v.subVectors(to,from).normalize().add(stageV2.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(spread)).normalize().multiplyScalar(460);
    b.lookAt(stageV2.copy(b.position).add(b.userData.v));};
  const flash=p=>{const f=flashes.find(x=>!x.visible);if(!f)return;f.visible=true;f.position.copy(p);f.userData.life=.35;};
  const pa=new THREE.Vector3(),pb=new THREE.Vector3(),pc=new THREE.Vector3(),pn=new THREE.Vector3();
  let gunT=0,foeGunT=1;
  set.cam=(t)=>{const a=Math.sin(t*.05)*.6;stageCam.position.set(Math.sin(a)*105,20+Math.sin(t*.13)*6,Math.cos(a)*105+C.z);stageCam.lookAt(C.x,C.y,C.z);};
  set.tick=(dt,t)=>{
    const u=t*.42;
    path(u,pa);path(u+.02,pn);stageFly(foe,pa,pn,foe.userData.dir);
    path(u-.32,pb);path(u-.30,pn);stageFly(me,pb,pn,me.userData.dir);
    path2(u*.9,pc);path2(u*.9+.02,pn);stageFly(foe2,pc,pn,foe2.userData.dir);
    stageEngines(stageSetHull(me,PROG.ship,'arena'),t,2);
    gunT-=dt;if(gunT<=0){const burst=(t%2.2)<1.1;gunT=burst?.085:.2;if(burst)fire(pb,pa,M.boltP,.025);}
    foeGunT-=dt;if(foeGunT<=0){foeGunT=1.3+Math.random()*.6;fire(pc,pb,M.boltE,.05);setTimeout(()=>fire(pc,pb,M.boltE,.05),110);}
    for(const b of bolts)if(b.visible){
      b.userData.life-=dt;b.position.addScaledVector(b.userData.v,dt);
      const target=b.userData.mat===M.boltP?foe:me;
      if(b.position.distanceTo(target.position)<5){b.visible=false;flash(target.position);}
      else if(b.userData.life<=0)b.visible=false;
    }
    for(const f of flashes)if(f.visible){f.userData.life-=dt;const k=f.userData.life/.35;
      f.material.opacity=k;f.scale.setScalar(6+(1-k)*14);if(k<=0)f.visible=false;}
    for(const r of rocks){r.rotation.x+=r.userData.spin.x*dt;r.rotation.y+=r.userData.spin.y*dt;}
  };
  return set;
};
/* ---- hangar: the bay, open to space, with a hull revolving on the turntable ---- */
STAGE_BUILD.hangar=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x05060f,fog:[0x070a18,.006]};
  const env=getShipEnvMap();
  const floor=new THREE.Mesh(new THREE.CircleGeometry(220,64),new THREE.MeshStandardMaterial({color:0x0a0e1a,metalness:.75,roughness:.32,envMap:env,envMapIntensity:.6}));
  floor.rotation.x=-Math.PI/2;g.add(floor);
  const grid=new THREE.GridHelper(300,75,0x00f0ff,0x12304a);grid.position.y=.03;grid.material.transparent=true;grid.material.opacity=.3;g.add(grid);
  const table=new THREE.Mesh(new THREE.CylinderGeometry(11,12,.9,64),new THREE.MeshStandardMaterial({color:0x151a28,metalness:.8,roughness:.3,envMap:env,envMapIntensity:.7}));
  table.position.y=.45;g.add(table);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(11.4,.1,8,128),new THREE.MeshBasicMaterial({color:0x0a9fc0}));ring.rotation.x=Math.PI/2;ring.position.y=.92;g.add(ring);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(7.5,.07,8,96),M.mag);ring2.rotation.x=Math.PI/2;ring2.position.y=.93;g.add(ring2);
  const pool=new THREE.Mesh(new THREE.RingGeometry(11.8,15,96),new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.06,
    blending:THREE.AdditiveBlending,depthWrite:false}));pool.rotation.x=-Math.PI/2;pool.position.y=.05;g.add(pool);
  const beam=stageGlow(0x9fd8ff,60,.18);beam.position.set(0,26,0);g.add(beam);
  // a ring of bay pillars with light strips, ceiling gantries overhead
  for(let i=0;i<15;i++){
    const a=-Math.PI*.62+i/14*Math.PI*1.24,x=Math.sin(a)*70,z=-Math.cos(a)*70;
    const p=new THREE.Mesh(sharedGeo('stPillar',()=>new THREE.BoxGeometry(4,52,4)),M.dark2);p.position.set(x,26,z);p.rotation.y=-a;g.add(p);
    const s=new THREE.Mesh(sharedGeo('stStrip',()=>new THREE.BoxGeometry(.35,46,.35)),i%3===1?M.mag:M.cyan);
    s.position.set(x*.97,26,z*.97);g.add(s);
    if(i%2===0){const bar=new THREE.Mesh(sharedGeo('stBar',()=>new THREE.BoxGeometry(1,1,70)),M.dark);
      bar.position.set(x/2,48,z/2);bar.rotation.y=-a;g.add(bar);}
  }
  for(let i=0;i<3;i++){const l=new THREE.Mesh(sharedGeo('stLamp',()=>new THREE.BoxGeometry(26,.3,1.2)),M.white);
    l.position.set(0,40,-14+i*14);g.add(l);}
  const h=new THREE.Group();h.position.y=6;g.add(h);
  set.cam=(t)=>{stageCam.position.set(Math.sin(t*.1)*2,9.5+Math.sin(t*.17)*.6,27);stageCam.lookAt(0,4.6,0);};
  set.tick=(dt,t)=>{
    const hull=stageSetHull(h,stageHullId,'hangar');
    hull.pivot.scale.setScalar(8/hull.radius);
    h.rotation.y+=dt*(reduceMotion?.15:.45);h.position.y=6+Math.sin(t*1.1)*.25;
    table.rotation.y=h.rotation.y;
    stageEngines(hull,t,1.4);
  };
  return set;
};

function stageEnter(name){
  if(!STAGE_SETS[name]){STAGE_SETS[name]=STAGE_BUILD[name]();STAGE_SETS[name].name=name;stageScene.add(STAGE_SETS[name].group);}
  for(const k in STAGE_SETS)STAGE_SETS[k].group.visible=k===name;
  stageCur=STAGE_SETS[name];
  stageScene.background=new THREE.Color(stageCur.bg);
  stageScene.fog.color.setHex(stageCur.fog[0]);stageScene.fog.density=stageCur.fog[1];
}
const screenOn=id=>!$(id).classList.contains('hidden');
/* which set the visible screen wants, and where its focus sits */
function stageWant(){
  if(screenOn('hangar'))return 'hangar';
  if(screenOn('menu')||screenOn('settings')||screenOn('controls'))return stageMode;
  return 'campaign';
}
function stageTick(dt){
  stageT+=dt*(reduceMotion?.4:1);
  const want=stageWant();
  if(!stageCur)stageEnter(want);
  else if(want!==stageCur.name&&stageFadeT<=0){stageFadeT=.34;stageFade.style.opacity=1;}
  if(stageFadeT>0){const was=stageFadeT;stageFadeT-=dt;
    if(was>.17&&stageFadeT<=.17){stageEnter(stageWant());stageFade.style.opacity=0;}}
  const wide=innerWidth>=900;
  const tx=!wide?0:screenOn('hangar')?.19:screenOn('menu')?.17:0, ty=wide&&screenOn('hangar')?.2:0;
  const k=Math.min(1,dt*4);stageShift.x+=(tx-stageShift.x)*k;stageShift.y+=(ty-stageShift.y)*k;
  stageCur.tick(dt,stageT);stageCur.cam(stageT);
  const w=innerWidth,h=innerHeight;stageCam.aspect=w/h;
  stageCam.setViewOffset(w,h,-stageShift.x*w,stageShift.y*h,w,h);
}
/* draws the menu backdrop instead of the game while the menus are up; false while a run is on */
function renderStage(dt){
  const on=S.mode==='menu';
  if(on!==stageWasOn){stageWasOn=on;document.body.classList.toggle('staged',on);
    if(!on){stageFadeT=0;stageFade.style.opacity=0;}}
  if(!on)return false;
  stageTick(dt);
  if(bloomOn()){const rp=composer.passes[0],s0=rp.scene,c0=rp.camera;
    rp.scene=stageScene;rp.camera=stageCam;composer.render();rp.scene=s0;rp.camera=c0;}
  else renderer.render(stageScene,stageCam);
  return true;
}
/* menus call these: which title-screen mode is highlighted, and which hull the hangar shows */
function stagePick(mode){if(STAGE_BUILD[mode])stageMode=mode;}
function stageShowHull(id){stageHullId=id;}
