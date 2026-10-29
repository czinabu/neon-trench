"use strict";
/* The Ink look (from POWER TRIP's model styles): flat cel bands, a dark inverted-hull outline (INK_LINE), skinned bodies
   that bend at the joints, and a colour grade over the bloom. js/deck.js draws HALCYON's interior and crew with it.
     inkMat(o)          a cel-banded material: o.color, o.map, o.metal (0 matte .. 1 chrome), o.rough, o.skinning, o.cap (the
                        brightest the lit band may go, times the colour; 0 is no limit)
     inkLine(g, w)      a back-face hull w thick round geometry g (its welded, smoothed copy), as a child mesh to add
     inkLoft(...)       a closed prism lofted through cross-sections (limbs, torsos, heads); profiles below
     inkChain(...)      one skinned surface along a run of joints (a sleeve over shoulder and elbow)
     inkGrade(on)       switches the colour grade pass on the shared composer (only the deck uses it) */
const INK_LINE=0x07060a;
const INK_SKY=new THREE.Color(0x7a96c8),INK_GROUND=new THREE.Color(0x141218);   // what metal reflects: the deck's hemisphere light

let inkRampT=null;
function inkRamp(){   // three hard bands and a highlight
  if(inkRampT)return inkRampT;
  const v=[64,140,205,228],d=new Uint8Array(16);v.forEach((x,i)=>{d[i*4]=d[i*4+1]=d[i*4+2]=x;d[i*4+3]=255;});
  inkRampT=new THREE.DataTexture(d,4,1,THREE.RGBAFormat);
  inkRampT.minFilter=inkRampT.magFilter=THREE.NearestFilter;inkRampT.generateMipmaps=false;inkRampT.needsUpdate=true;
  return inkRampT;
}
/* metal gets a stylised chrome reflection (sky over a dark horizon line), a hard glint and a bright rim; cloth stays
   matte with a faint soft rim, so the two read apart at a glance */
const INK_SURF=`
  vec3 inkV=normalize(vViewPosition),inkN=normalize(normal);
  float inkRim=pow(1.0-clamp(dot(inkN,inkV),0.0,1.0),3.0);
  if(uMetal>0.0){
    vec3 r=inverseTransformDirection(reflect(-inkV,inkN),viewMatrix);
    float w=mix(0.015,0.2,uRough),sky=smoothstep(-w,w,r.y),hz=1.0-smoothstep(0.0,w*1.5+0.03,abs(r.y));
    vec3 env=mix(uGround*0.5,uSky*(0.75+0.6*smoothstep(0.35,0.9,r.y)),sky)*(1.0-0.55*hz);
    outgoingLight=mix(outgoingLight,outgoingLight*0.45+env*diffuseColor.rgb*1.5,uMetal);
    #if NUM_DIR_LIGHTS > 0
      float lit=dot(reflectedLight.directDiffuse,vec3(0.333))/max(dot(diffuseColor.rgb,vec3(0.333)),1e-3);
      float gl=pow(max(dot(inkN,normalize(directionalLights[0].direction+inkV)),0.0),mix(90.0,18.0,uRough));
      outgoingLight+=directionalLights[0].color*smoothstep(0.45,0.6,gl)*step(0.6,lit)*uMetal*0.7;
    #endif
    outgoingLight+=uSky*smoothstep(0.45,0.55,inkRim)*uMetal*0.45;
  } else outgoingLight+=uSky*inkRim*(1.0-uRough)*0.35*diffuseColor.rgb;
  if(uCap>0.0)outgoingLight=min(outgoingLight,diffuseColor.rgb*uCap+0.02);   // o.cap: the lit band stops near the surface's own colour, so skin keeps its hue under a lamp
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`;
function inkMat(o){
  const m=new THREE.MeshToonMaterial({color:o.color===undefined?0xffffff:o.color,gradientMap:inkRamp()});
  if(o.map)m.map=o.map;if(o.skinning)m.skinning=true;
  const metal=o.metal||0,rough=o.rough===undefined?.8:o.rough;
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,{uSky:{value:INK_SKY},uGround:{value:INK_GROUND},uMetal:{value:metal},uRough:{value:rough},uCap:{value:o.cap||0}});
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uSky,uGround;\nuniform float uMetal,uRough,uCap;')
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',INK_SURF);
  };
  m.customProgramCacheKey=()=>'ink';
  return m;
}

/* ---- the outline: the mesh's own shape pushed out along smoothed normals, drawn back faces only ---- */
const inkLineMats=new Map();
function inkLineMat(w,skin){
  const k=w+(skin?'s':'');let m=inkLineMats.get(k);if(m)return m;
  m=new THREE.MeshBasicMaterial({color:INK_LINE,side:THREE.BackSide});m.skinning=!!skin;
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','vec3 transformed=position+normal*'+w.toFixed(4)+';');};
  m.customProgramCacheKey=()=>'inkLine'+w;
  inkLineMats.set(k,m);return m;
}
/* g welded by position with area-weighted normals, so the hull stays closed over hard edges */
function inkHullGeo(g){
  if(g.userData.hull)return g.userData.hull;
  const p=g.attributes.position,ix=g.index?g.index.array:null,n=ix?ix.length:p.count;
  const map=new Map(),pos=[],idx=[],remap=new Int32Array(p.count);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),key=Math.round(x*1e4)+','+Math.round(y*1e4)+','+Math.round(z*1e4);
    let j=map.get(key);if(j===undefined){j=pos.length/3;map.set(key,j);pos.push(x,y,z);}remap[i]=j;}
  for(let i=0;i<n;i++)idx.push(remap[ix?ix[i]:i]);
  const h=new THREE.BufferGeometry();h.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));h.setIndex(idx);h.computeVertexNormals();
  g.userData.hull=h;return h;
}
function inkLine(g,w){const m=new THREE.Mesh(inkHullGeo(g),inkLineMat(w));m.userData.inkLine=true;return m;}

/* hard edges: each corner averages only the faces within `ang` of its own (a chiselled look under cel bands) */
function inkCrease(g,ang){
  const src=g.index?g.toNonIndexed():g,p=src.attributes.position,n=p.count,fn=new Float32Array(n),
    a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),groups=new Map(),out=new Float32Array(n*3),cos=Math.cos(ang);
  const face=[];
  for(let t=0;t<n;t+=3){a.fromBufferAttribute(p,t);b.fromBufferAttribute(p,t+1);c.fromBufferAttribute(p,t+2);
    const f=c.clone().sub(b).cross(a.clone().sub(b));face.push(f);
    for(let k=t;k<t+3;k++){const key=Math.round(p.getX(k)*1e4)+','+Math.round(p.getY(k)*1e4)+','+Math.round(p.getZ(k)*1e4);
      let G=groups.get(key);if(!G)groups.set(key,G=[]);G.push(k);}}
  for(const G of groups.values())for(const k of G){const fk=face[(k/3)|0],u=fk.clone().normalize(),s=new THREE.Vector3();
    for(const j of G){const fj=face[(j/3)|0];if(fj.clone().normalize().dot(u)>=cos)s.add(fj);}
    if(s.lengthSq()<1e-12)s.set(0,1,0);s.normalize();out[k*3]=s.x;out[k*3+1]=s.y;out[k*3+2]=s.z;}
  src.setAttribute('normal',new THREE.BufferAttribute(out,3));
  return src;
}

/* ---- the geometry kit (POWER TRIP's model/shapes.js): profiles are [x, z] in unit space, front is +z ---- */
function inkChamfer(c){const a=1-c;return [[1,-a],[1,a],[a,1],[-a,1],[-1,a],[-1,-a],[-a,-1],[a,-1]];}
const INK_KEEL=[[0,1],[.72,.55],[1,-.15],[.62,-1],[-.62,-1],[-1,-.15],[-.72,.55]];   // a ridge down the front: shins, sleeves
const INK_SHIELD=[[.7,1],[1,.35],[1,-.45],[.6,-1],[-.6,-1],[-1,-.45],[-1,.35],[-.7,1]];   // flat front, angled flanks: chests
const INK_HEAD=[[0,1],[.55,.86],[.92,.35],[1,-.25],[.72,-.82],[0,-1],[-.72,-.82],[-1,-.25],[-.92,.35],[-.55,.86]];
const inkNgon=(n,rot)=>{const o=[];for(let i=0;i<n;i++){const a=(rot||0)+i/n*Math.PI*2;o.push([Math.cos(a),Math.sin(a)]);}return o;};
const inkRound=P=>{const o=[];P.forEach(([ax,az],i)=>{const [bx,bz]=P[(i+1)%P.length];o.push([ax*.75+bx*.25,az*.75+bz*.25],[ax*.25+bx*.75,az*.25+bz*.75]);});return o;};
/* sections bottom to top: {y, w, d, x?, z?} with w and d full width and depth */
function inkLoft(secs,prof,caps){
  const n=prof.length,pos=[],idx=[];
  for(const s of secs)for(const [px,pz] of prof)pos.push((s.x||0)+px*s.w*.5,s.y,(s.z||0)+pz*s.d*.5);
  for(let r=0;r<secs.length-1;r++)for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+i,d=(r+1)*n+(i+1)%n;idx.push(a,c,b,b,c,d);}
  const cap=(r,up)=>{const s=secs[r],ci=pos.length/3;pos.push(s.x||0,s.y,s.z||0);
    for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n;if(up)idx.push(ci,a,b);else idx.push(ci,b,a);}};
  if(caps!==false){cap(0,false);cap(secs.length-1,true);}
  // a profile may run either way round: flip the triangles if the first side face points inward
  const v=i=>new THREE.Vector3(pos[idx[i]*3],pos[idx[i]*3+1],pos[idx[i]*3+2]),A=v(0),B=v(1),C=v(2),s0=secs[0];
  if(B.clone().sub(A).cross(C.clone().sub(A)).dot(A.clone().sub(new THREE.Vector3(s0.x||0,A.y,s0.z||0)))<0)
    for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  return g;
}
/* a limb segment hanging down from its joint: rings [t, w, d, dz?] at fractions t of len */
const inkLimb=(len,rings,prof)=>inkLoft(rings.map(([t,w,d,dz])=>({y:-t*len,w,d,z:dz||0})).reverse(),prof||INK_KEEL);
/* a block that does not read as a box: a chamfered loft, tapered toward the top */
const inkBlock=(w,h,d,c,taper)=>inkLoft([{y:-h/2,w,d},{y:h/2,w:w*(taper||1),d:d*(taper||1)}],inkChamfer(c===undefined?.3:c));

/* ---- skinned chains (POWER TRIP's model/skin.js) ----
   rings [{t, w, d, z?}] at t metres along the chain (down a limb with dir -1, up a spine with dir 1), bending at the
   joint distances `at`; extra rings are packed round each joint so the bend has edges to curve with */
const inkSeg=(len,rings,from)=>rings.map(([t,w,d,dz])=>({t:(from||0)+t*len,w,d,z:dz||0}));
const inkSmooth=(a,b,x)=>{const u=Math.min(1,Math.max(0,(x-a)/(b-a)));return u*u*(3-2*u);};
function inkWeights(t,at,blend){
  const out=[];let prev=1;
  for(let i=0;i<=at.length;i++){const s=i<at.length?inkSmooth(at[i]-blend,at[i]+blend,t):0;if(prev-s>1e-4)out.push([i,prev-s]);prev=s;}
  const sum=out.reduce((a,o)=>a+o[1],0);for(const o of out)o[1]/=sum;
  return out;
}
function inkChainGeo(rings,at,blend,prof,dir){
  const src=rings.slice().sort((a,b)=>a.t-b.t),ts=src.map(r=>r.t);
  for(const j of at)for(let k=-3;k<=3;k++)ts.push(j+k*blend/2);
  ts.sort((a,b)=>a-b);
  const lo=src[0].t,hi=src[src.length-1].t,keep=[];
  for(const t of ts){if(t<lo-1e-6||t>hi+1e-6)continue;if(keep.length&&t-keep[keep.length-1]<.008)continue;keep.push(t);}
  const secs=keep.map(t=>{let i=0;while(i<src.length-2&&src[i+1].t<t)i++;
    const a=src[i],b=src[i+1]||a,u=b.t>a.t?Math.min(1,Math.max(0,(t-a.t)/(b.t-a.t))):0,l=(p,q)=>(p||0)+((q||0)-(p||0))*u;
    return {y:dir*t,w:l(a.w,b.w),d:l(a.d,b.d),z:l(a.z,b.z)};});
  if(dir<0)secs.reverse();
  return inkLoft(secs,prof);
}
/* skin geometry built in `frame`'s space (the first joint, rig at rest) onto `root`'s space with weights from weigh(y) */
function inkSkinGeo(g,root,frame,weigh){
  root.updateMatrixWorld(true);
  const toRoot=new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(frame.matrixWorld);
  const out=g.clone(),p=out.attributes.position,n=p.count,ix=new Uint16Array(n*4),wt=new Float32Array(n*4);
  for(let i=0;i<n;i++){const ws=weigh(p.getY(i));for(let j=0;j<ws.length&&j<4;j++){ix[i*4+j]=ws[j][0];wt[i*4+j]=ws[j][1];}}
  out.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ix,4));out.setAttribute('skinWeight',new THREE.Float32BufferAttribute(wt,4));
  return out.applyMatrix4(toRoot);
}
/* a skinned surface (and its skinned outline) on `root`, bending with `bones`. geos: {body, hull}, shareable between
   people built on the same rig */
function inkSkinned(geos,mat,root,bones,w){
  root.updateMatrixWorld(true);   // the rest pose: bind against it
  const sk=new THREE.Skeleton(bones),bind=(m,par)=>{m.frustumCulled=false;par.add(m);m.updateMatrixWorld(true);m.bind(sk,m.matrixWorld);return m;};
  const m=bind(new THREE.SkinnedMesh(geos.body,mat),root);
  if(w)bind(new THREE.SkinnedMesh(geos.hull,inkLineMat(w,true)),m);
  return m;
}
function inkChainGeos(rings,o,root){
  const dir=o.dir||-1,blend=o.blend||.06,body=inkChainGeo(rings,o.at,blend,inkRound(o.prof||INK_KEEL),dir),weigh=y=>inkWeights(dir*y,o.at,blend);
  return {body:inkSkinGeo(body,root,o.bones[0],weigh),hull:inkSkinGeo(inkHullGeo(body),root,o.bones[0],weigh)};
}

/* ---- the grade: a little more colour and contrast, shadows leaning cool and highlights warm (after the bloom) ---- */
let inkGradeP=null;
function inkGrade(on){
  if(!composer||!THREE.ShaderPass)return;
  if(!inkGradeP){
    inkGradeP=new THREE.ShaderPass({
      uniforms:{tDiffuse:{value:null},sat:{value:1.04},contrast:{value:1.1},shadow:{value:new THREE.Color(.95,.98,1.05)},high:{value:new THREE.Color(1.06,1,.92)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform float sat,contrast;uniform vec3 shadow,high;varying vec2 vUv;
        const vec3 LUM=vec3(.2126,.7152,.0722);
        void main(){vec4 s=texture2D(tDiffuse,vUv);vec3 c=s.rgb;float l=dot(c,LUM);
          c=mix(vec3(l),c,sat);c=(c-.5)*contrast+.5;vec3 t=mix(shadow,high,smoothstep(.12,.75,l));c*=t/max(dot(t,LUM),1e-3);
          gl_FragColor=vec4(clamp(c,0.,1.),s.a);}`});
    composer.addPass(inkGradeP);
  }
  inkGradeP.enabled=on;
}
