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

/* ---- the slab round the trench (TRENCH_INTROS deck in js/data/cutscenes.js) ----
   Built from the same seed for a trench intro's flyby (js/cutscene.js) and for the trench mouth in the game, so the
   handover from one to the other lands on the same towers. The slab's top is level with the trench walls' tops
   (DECK_Y); the trench is cut down its middle, x ±HALF_W. z0 > z1: the slab's length; the trench's own walls and floor
   are built over [w0, w1] (the game's segments take over from z 0). */
const DECK_Y=TOP_Y+18;
const deckMats={};
function trenchDeckMats(P){
  const k=P.neon.join()+P.glow;if(deckMats[k])return deckMats[k];
  return deckMats[k]={slab:new THREE.MeshLambertMaterial({color:0x050608}),dark:new THREE.MeshLambertMaterial({color:0x08090e}),
    wall:new THREE.MeshLambertMaterial({color:0x0b0d18}),n0:new THREE.MeshBasicMaterial({color:P.neon[0]}),
    n1:new THREE.MeshBasicMaterial({color:P.neon[1]}),glow:new THREE.MeshBasicMaterial({color:P.glow})};
}
function buildTrenchDeck(key,I,z0,z1,w0,w1){
  const P=I.pal,mt=trenchDeckMats(P),rng=capRng(key.length*7+3),g=new THREE.Group(),st=new THREE.Group(),kind=I.deck||'city';
  const X0=HALF_W+4,W=900,L=z0-z1,zc=(z0+z1)/2,Hd=DECK_Y-FLOOR_Y+2;
  const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);st.add(m);return m;};
  const glow=(c,size,op,x,y,z)=>{const s=stageGlow(c,size,op);s.position.set(x,y,z);g.add(s);return s;};
  for(const s of [-1,1]){
    box(W,Hd,L,mt.slab,s*(X0+W/2),DECK_Y-Hd/2,zc);
    box(.8,.8,L,s<0?mt.n0:mt.n1,s*(X0+.2),DECK_Y+.4,zc);   // the trench's lip
    if(w0>w1){const wl=w0-w1,wz=(w0+w1)/2;
      box(4,DECK_Y-FLOOR_Y,wl,mt.wall,s*(HALF_W+2),(DECK_Y+FLOOR_Y)/2,wz);
      for(let k=0;k<3;k++)box(.3,.5,wl,k%2?mt.n1:mt.n0,s*HALF_W,FLOOR_Y+6+k*14,wz);   // the game's neon strips, carried on
      for(let z=w0;z>w1;z-=50+rng()*50)box(1.2,2+rng()*7,3+rng()*10,rng()<.3?mt.dark:mt.slab,s*(HALF_W-.4),FLOOR_Y+4+rng()*38,z);}
    for(let z=z0-60;z>z1;z-=180)box(60,.4,1.2,s<0?mt.n0:mt.n1,s*(X0+100),DECK_Y+.3,z);   // deck markings across the slab
  }
  if(w0>w1){box(HALF_W*2,2,w0-w1,mt.wall,0,FLOOR_Y-1,(w0+w1)/2);box(.6,.2,w0-w1,mt.n0,0,FLOOR_Y+.15,(w0+w1)/2);}
  const tower=(x,z,w,d,h,trim)=>{box(w,h,d,mt.dark,x,DECK_Y+h/2,z);
    if(trim)box(.8,h*.8,.8,rng()<.5?mt.n0:mt.n1,x-Math.sign(x)*w/2,DECK_Y+h*.45,z+d*.3);};
  const side=()=>rng()<.5?-1:1, along=()=>z0-rng()*L, depth=z=>Math.max(0,Math.min(1,(z0-z)/L));
  if(kind==='city'){   // dense towers, taller toward the target, lit bands
    for(let i=0;i<110;i++){const s=side(),x=s*(X0+22+Math.pow(rng(),1.4)*780),z=along(),h=30+rng()*110+depth(z)*150,w=16+rng()*36;
      tower(x,z,w,w*(.6+rng()*.8),h,true);
      if(rng()<.35)for(let r=1;r<4;r++)box(w+.4,.5,1,rng()<.5?mt.n0:mt.n1,x,DECK_Y+h*r/4,z);}
  }else if(kind==='sink'){   // low, wide blocks under the scopes, and sensor masts with red beacons
    for(let i=0;i<46;i++){const s=side(),x=s*(X0+30+rng()*760),z=along();tower(x,z,40+rng()*80,30+rng()*60,6+rng()*22,rng()<.4);}
    for(let i=0;i<16;i++){const s=side(),x=s*(X0+20+rng()*500),z=along(),h=70+rng()*90;
      box(1.6,h,1.6,mt.dark,x,DECK_Y+h/2,z);glow(0xff2a3a,14,.85,x,DECK_Y+h+2,z);}
  }else if(kind==='pads'){   // hangar blocks with lit doors, and landing pads ringed in light
    for(let i=0;i<22;i++){const s=side(),x=s*(X0+60+rng()*700),z=along(),w=60+rng()*70,h=16+rng()*22;
      tower(x,z,w,40+rng()*40,h,false);box(w*.7,h*.6,.6,mt.n0,x,DECK_Y+h*.3,z+21);}
    for(let z=z0-120;z>z1;z-=240)for(const s of [-1,1]){const x=s*(X0+70);
      box(70,1.2,70,mt.slab,x,DECK_Y+.6,z);for(const e of [-1,1]){box(72,.5,1.2,mt.n1,x,DECK_Y+1.3,z+e*35);box(1.2,.5,72,mt.n1,x+e*35,DECK_Y+1.3,z);}
      glow(P.glow,22,.7,x,DECK_Y+4,z);}
  }else{   // a power plant: cooling towers by the trench, pylons carrying lit cable across it
    for(let i=0;i<8;i++){const s=i%2?1:-1,x=s*(X0+110+rng()*380),z=z0-120-i*(L/8)-rng()*60;
      const c=new THREE.Mesh(new THREE.CylinderGeometry(52,80,190,20),mt.slab);c.position.set(x,DECK_Y+95,z);st.add(c);
      const lip=new THREE.Mesh(new THREE.TorusGeometry(52,1.6,6,32),mt.n0);lip.rotation.x=Math.PI/2;lip.position.set(x,DECK_Y+190,z);st.add(lip);
      glow(P.glow,160,.35,x,DECK_Y+205,z);}
    for(let z=z0-150;z>z1;z-=300){for(const s of [-1,1])box(4,110,4,mt.dark,s*(X0+18),DECK_Y+55,z);
      box((X0+18)*2,.6,.6,mt.n1,0,DECK_Y+104,z);box((X0+18)*2,.6,.6,mt.n0,0,DECK_Y+96,z);}
    for(let i=0;i<30;i++){const s=side();tower(s*(X0+200+rng()*600),along(),20+rng()*30,20+rng()*30,20+rng()*60,true);}
  }
  g.add(mergeStatic(st));
  return g;
}
/* the trench mouth in the game: the slab and the first stretch of trench before the segments start (z 0) */
const trenchDecks={};
function trenchDeckShow(key){
  for(const k in trenchDecks)trenchDecks[k].visible=false;
  const I=key&&TRENCH_INTROS[key];if(!I||I.build!=='surface')return;
  if(!trenchDecks[key]){trenchDecks[key]=buildTrenchDeck(key,I,900,-900,900,0);scene.add(trenchDecks[key]);}
  trenchDecks[key].visible=true;
}

/* the trench's colours for a run: fog from the entry to the far end, the walls' and floor's window light, the stars
   (look in TRENCH_INTROS, js/data/cutscenes.js) */
function trenchLook(L){
  FOG_A.setHex(L?L.fog[0]:0x070a18);FOG_B.setHex(L?L.fog[1]:0x1c0a14);
  wallMat.emissive.setHex(L?L.wall:0xffffff);floorMat.emissive.setHex(L?L.floor:0xffffff);
  if(trenchStars)trenchStars.material.color.setHex(L?L.stars:0x9fd8ff);
}
/* stars (hidden in the arena, which has its own sky) */
let trenchStars=null;
{
  const starGeo=new THREE.BufferGeometry();const pts=[];
  for(let i=0;i<1100;i++)pts.push((Math.random()-.5)*3000,60+Math.random()*900,(Math.random()-.5)*3500);
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  trenchStars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fd8ff,size:1.6,sizeAttenuation:false}));
  scene.add(trenchStars);
}
