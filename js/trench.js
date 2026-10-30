"use strict";
/* Trench segment geometry (recycled pool) and the starfield. */

/* ============================ TRENCH SEGMENTS ============================ */
/* Procedural surface textures. The base map adds panel seams; the emissive map adds rows of dimly
   lit windows and service lights, so the walls have depth and the eye can read speed off them. */
function trenchTextures(kind){
  const S_=256, base=document.createElement('canvas'), glow=document.createElement('canvas');
  base.width=base.height=glow.width=glow.height=S_;
  const b=base.getContext('2d'), g=glow.getContext('2d');
  b.fillStyle='#8a93b8';b.fillRect(0,0,S_,S_);            // tinted by the material colour
  g.fillStyle='#000';g.fillRect(0,0,S_,S_);
  if(kind==='wall'){
    b.fillStyle='#5d6588';
    for(let x=0;x<S_;x+=64)b.fillRect(x,0,3,S_);           // vertical panel seams
    for(let y=0;y<S_;y+=32+((y/32)%3)*16)b.fillRect(0,y,S_,2);
    for(let i=0;i<14;i++){b.fillStyle=i%2?'#a7b0d4':'#6f789c';
      b.fillRect(Math.random()*S_,Math.random()*S_,8+Math.random()*40,6+Math.random()*24);}
    const cols=['#3fd9ff','#ff4f95','#c8e8ff','#ffb84d'];
    for(let row=0;row<9;row++){                            // window bands
      if(Math.random()<.45)continue;
      const y=10+row*27,c=cols[(Math.random()*cols.length)|0];
      for(let x=4;x<S_;x+=10){if(Math.random()<.55)continue;
        g.globalAlpha=.18+Math.random()*.4;g.fillStyle=c;g.fillRect(x,y,6,4);}
    }
    g.globalAlpha=1;
  }else{
    b.fillStyle='#5d6588';
    for(let x=0;x<S_;x+=32)b.fillRect(x,0,2,S_);
    for(let y=0;y<S_;y+=32)b.fillRect(0,y,S_,2);
    g.fillStyle='#1d5f80';                                  // faint guide lights along the deck
    for(let y=8;y<S_;y+=32){g.fillRect(14,y,4,4);g.fillRect(S_-18,y,4,4);}
  }
  const mk=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.encoding=THREE.sRGBEncoding;return t;};
  return {map:mk(base),emissiveMap:mk(glow)};
}
const wallTex=trenchTextures('wall'), floorTex=trenchTextures('floor');
wallTex.map.repeat.set(3,1.3);wallTex.emissiveMap.repeat.set(3,1.3);
floorTex.map.repeat.set(2,5);floorTex.emissiveMap.repeat.set(2,5);
const wallMat=new THREE.MeshLambertMaterial({color:0x0e1226,map:wallTex.map,emissive:0xffffff,emissiveMap:wallTex.emissiveMap});
const floorMat=new THREE.MeshLambertMaterial({color:0x161d3a,map:floorTex.map,emissive:0xffffff,emissiveMap:floorTex.emissiveMap});
/* Fold a group's opaque meshes into one mesh per material (positions, normals and uvs baked into the group's frame, the
   originals disposed). A corridor segment is static, and looking down the trench every segment is in view, so this cuts
   its draw calls from about forty to a handful. Transparent meshes stay separate so their sorting is untouched. */
function mergeStatic(g){
  const by=new Map(),keep=[];
  for(const m of g.children){
    if(!m.isMesh||m.material.transparent||!m.geometry.attributes.uv){keep.push(m);continue;}
    m.updateMatrix();
    const geo=m.geometry.clone().applyMatrix4(m.matrix);
    if(!by.has(m.material))by.set(m.material,[]);by.get(m.material).push(geo);
    m.geometry.dispose();
  }
  g.clear();
  for(const m of keep)g.add(m);
  for(const [mat,list] of by){
    let nv=0,ni=0;
    for(const x of list){nv+=x.attributes.position.count;ni+=x.index.count;}
    const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=new Float32Array(nv*2),idx=new Uint32Array(ni);
    let ov=0,oi=0;
    for(const x of list){
      const c=x.attributes.position.count,a=x.index.array;
      pos.set(x.attributes.position.array,ov*3);nor.set(x.attributes.normal.array,ov*3);uv.set(x.attributes.uv.array,ov*2);
      for(let i=0;i<a.length;i++)idx[oi+i]=a[i]+ov;
      oi+=a.length;ov+=c;x.dispose();
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));
    g.add(new THREE.Mesh(geo,mat));
  }
  return g;
}
function buildSegment(){
  const g=new THREE.Group();
  for(const side of [-1,1]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(4,TOP_Y-FLOOR_Y+18,SEG_LEN),wallMat);
    wall.position.set(side*(HALF_W+2),(TOP_Y+FLOOR_Y)/2+9,-SEG_LEN/2); g.add(wall);
    for(let k=0;k<3;k++){ // neon strips
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,SEG_LEN),k%2?M.mag:M.cyan);
      strip.position.set(side*HALF_W, FLOOR_Y+6+k*14, -SEG_LEN/2); g.add(strip);
    }
    for(let k=0;k<9;k++){ // greeble panels + windows
      const p=new THREE.Mesh(new THREE.BoxGeometry(1.2,2+Math.random()*7,3+Math.random()*10),
        Math.random()<.3?M.white:M.dark2);
      p.position.set(side*(HALF_W-.4), FLOOR_Y+4+Math.random()*38, -Math.random()*SEG_LEN); g.add(p);
    }
    // conduit pipes
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,SEG_LEN,6),M.dark2);
    pipe.rotation.x=Math.PI/2;
    pipe.position.set(side*(HALF_W+.6), FLOOR_Y+10+Math.random()*24, -SEG_LEN/2); g.add(pipe);
    // glyph hologram boards
    if(Math.random()<.7){
      const b=new THREE.Mesh(new THREE.PlaneGeometry(5,10),glyphMats[(Math.random()*glyphMats.length)|0]);
      b.position.set(side*(HALF_W-1.2), 6+Math.random()*22, -20-Math.random()*(SEG_LEN-40));
      b.rotation.y=side>0?-Math.PI/2:Math.PI/2; g.add(b);
    }
    // skyline towers above the trench
    const tw=new THREE.Mesh(new THREE.BoxGeometry(14+Math.random()*20,60+Math.random()*120,18),M.dark);
    tw.position.set(side*(HALF_W+30+Math.random()*60), TOP_Y+30+Math.random()*40, -SEG_LEN/2);
    g.add(tw);
    const twl=new THREE.Mesh(new THREE.BoxGeometry(.8,40+Math.random()*60,.8),Math.random()<.5?M.cyan:M.mag);
    twl.position.copy(tw.position); twl.position.x+=side*-8; g.add(twl);
  }
  const floor=new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2+4,2,SEG_LEN),floorMat);
  floor.position.set(0,FLOOR_Y-1,-SEG_LEN/2); g.add(floor);
  const line=new THREE.Mesh(new THREE.BoxGeometry(.6,.2,SEG_LEN),M.cyan);
  line.position.set(0,FLOOR_Y+.15,-SEG_LEN/2); g.add(line);
  for(let k=0;k<4;k++){
    const cross=new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2,.2,.5),M.mag);
    cross.position.set(0,FLOOR_Y+.12,-(k+.5)*SEG_LEN/4); g.add(cross);
  }
  return mergeStatic(g);
}
const segments=[];
for(let i=0;i<SEG_POOL;i++){const s=buildSegment();s.position.z=-i*SEG_LEN;scene.add(s);segments.push(s);}

/* stars (hidden in the arena, which has its own sky) */
let trenchStars=null;
{
  const starGeo=new THREE.BufferGeometry();const pts=[];
  for(let i=0;i<1100;i++)pts.push((Math.random()-.5)*3000,60+Math.random()*900,(Math.random()-.5)*3500);
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  trenchStars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fd8ff,size:1.6,sizeAttenuation:false}));
  scene.add(trenchStars);
}
