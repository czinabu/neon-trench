"use strict";
/* Capital ship model kit: the shapes the capital hulls (js/capital.js, js/fleet.js) and THRONE's breach
   (js/interior.js) are built from. Hulls are faceted lofts, swept along the ship through cross-sections, with
   plating mapped in metres so the panel lines stay in scale on a 300 m hull. The small detail (greebles,
   window rows, trim, engine bells) is merged into one mesh per material and per half, so a ship stays a few
   dozen draw calls however busy it looks. Units are metres; -z is the bow and +y is up. */

const CAP_UV=26;   // metres of hull per repeat of the panel texture
/* a repeatable random sequence, so a ship's greebles land in the same places every time it is built */
function capRng(seed){let s=seed>>>0;return()=>(s=(s*1664525+1013904223)>>>0)/4294967296;}

/* box-projected UVs in metres: each face takes the two axes it doesn't face along */
function capWorldUV(geo,scale){
  const p=geo.attributes.position,n=geo.attributes.normal,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
    let u,v;
    if(ax>=ay&&ax>=az){u=p.getZ(i);v=p.getY(i);}else if(ay>=az){u=p.getX(i);v=p.getZ(i);}else{u=p.getX(i);v=p.getY(i);}
    uv[i*2]=u/scale;uv[i*2+1]=v/scale;
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}
/* merge placed geometries into one (they are disposed) */
function capMergeGeo(list){
  let nv=0,ni=0;
  for(const g of list){const c=g.attributes.position.count;nv+=c;ni+=g.index?g.index.count:c;}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),idx=new Uint32Array(ni);
  let ov=0,oi=0;
  for(const g of list){
    const c=g.attributes.position.count;
    pos.set(g.attributes.position.array,ov*3);nor.set(g.attributes.normal.array,ov*3);
    if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++)idx[oi+i]=a[i]+ov;oi+=a.length;}
    else{for(let i=0;i<c;i++)idx[oi+i]=ov+i;oi+=c;}
    ov+=c;g.dispose();
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  geo.setIndex(new THREE.BufferAttribute(idx,1));
  return geo;
}
/* a faceted hull swept along z through sections [z, half width, half height, centre y]. prof is half the
   cross-section, [x,y] points in -1..1 from the top centre round the +x side to the bottom centre; the -x side
   mirrors it. A section with zero width makes a point; otherwise the ends are capped. Flat shaded. dx moves
   it off the centre line. */
function capLoftGeo(prof,secs,dx){
  dx=dx||0;
  const ring=prof.concat(prof.slice(1,-1).reverse().map(([x,y])=>[-x,y])),R=ring.length,pos=[];
  const pt=(s,k)=>[dx+ring[k%R][0]*s[1],s[3]+ring[k%R][1]*s[2],s[0]];
  const tri=(a,b,c)=>pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
  for(let i=0;i<secs.length-1;i++)for(let k=0;k<R;k++){
    const a=pt(secs[i],k),b=pt(secs[i],k+1),c=pt(secs[i+1],k),d=pt(secs[i+1],k+1);
    tri(a,c,b);tri(b,c,d);
  }
  const cap=(s,back)=>{if(s[1]<=0)return;const c=[dx,s[3],s[0]];
    for(let k=0;k<R;k++)back?tri(c,pt(s,k+1),pt(s,k)):tri(c,pt(s,k),pt(s,k+1));};
  cap(secs[0],false);cap(secs[secs.length-1],true);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
  return geo;
}
/* the sections either side of z = 0, with a section interpolated on the cut, so a hull splits into the halves */
function capSplitSecs(secs){
  if(secs[secs.length-1][0]<=0)return [secs,null];
  if(secs[0][0]>=0)return [null,secs];
  const i=secs.findIndex(s=>s[0]>0),a=secs[i-1],b=secs[i],t=-a[0]/(b[0]-a[0]);
  const cut=[0,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];
  return [secs.slice(0,i).filter(s=>s[0]<0).concat([cut]),[cut].concat(secs.slice(i))];
}
const _kM=new THREE.Matrix4(),_kQ=new THREE.Quaternion(),_kE=new THREE.Euler(),_kP=new THREE.Vector3(),_kS=new THREE.Vector3(),
  _kD=new THREE.Vector3(),_kZ=new THREE.Vector3(0,0,1);
/* a list of geometries placed in one frame, merged into a single mesh at the end */
function capBatch(){
  const list=[];
  const B={
    add(geo,x,y,z,rx,ry,rz,sx,sy,sz){
      _kE.set(rx||0,ry||0,rz||0);_kQ.setFromEuler(_kE);_kP.set(x||0,y||0,z||0);_kS.set(sx||1,sy||1,sz||1);
      geo.applyMatrix4(_kM.compose(_kP,_kQ,_kS));list.push(geo);return B;},
    box(w,h,d,x,y,z,rx,ry,rz){return B.add(new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);},
    cylZ(r1,r2,len,seg,x,y,z){return B.add(new THREE.CylinderGeometry(r1,r2,len,seg||12),x,y,z,Math.PI/2);},   // r1 at the +z end
    /* a bar of square section t between two points */
    bar(a,b,t){_kD.subVectors(b,a);const L=_kD.length();if(L<1e-4)return B;
      const g=new THREE.BoxGeometry(t,t,L);_kQ.setFromUnitVectors(_kZ,_kD.normalize());_kP.addVectors(a,b).multiplyScalar(.5);
      g.applyMatrix4(_kM.compose(_kP,_kQ,_kS.set(1,1,1)));list.push(g);return B;},
    loft(prof,secs,dx){list.push(capLoftGeo(prof,secs,dx));return B;},
    mesh(parent,mat){
      if(!list.length)return null;
      const geo=capMergeGeo(list);list.length=0;capWorldUV(geo,CAP_UV);
      const m=new THREE.Mesh(geo,mat);parent.add(m);return m;},
  };
  return B;
}
/* a ship's batches, one per material in each half; at(z) files a part in the half its centre is in */
function capKit(C){
  const sets={};
  const get=(half,mat)=>{const k=half+mat.uuid;return (sets[k]||(sets[k]={half,mat,B:capBatch()})).B;};
  const K={
    fore:mat=>get('fore',mat),aft:mat=>get('aft',mat),
    at:(z,mat)=>get(z<0?'fore':'aft',mat),
    /* a faceted hull section, split between the halves where it crosses z = 0 */
    loft(mat,prof,secs,dx){const [f,a]=capSplitSecs(secs);if(f)get('fore',mat).loft(prof,f,dx);if(a)get('aft',mat).loft(prof,a,dx);return K;},
    /* a trim strip traced along a loft at profile point pi (both sides), pushed out by off */
    strip(mat,prof,secs,pi,t,off,dx){
      const [px,py]=prof[pi];off=off||.15;dx=dx||0;
      for(const half of capSplitSecs(secs))if(half)for(let i=0;i<half.length-1;i++){
        const s0=half[i],s1=half[i+1],B=get(s1[0]<=0?'fore':'aft',mat);
        for(const sx of px?[-1,1]:[1]){
          sv0.set(dx+sx*(px*s0[1]+Math.sign(px)*off),s0[3]+py*s0[2]+Math.sign(py)*off*(px?0:1),s0[0]);
          sv1.set(dx+sx*(px*s1[1]+Math.sign(px)*off),s1[3]+py*s1[2]+Math.sign(py)*off*(px?0:1),s1[0]);
          B.bar(sv0,sv1,t);
        }
      }
      return K;},
    /* a row of lit windows down a flank at x (both sides), from z0 to z1, with gaps from rng */
    windows(mat,rng,x,y,z0,z1,gap,len){
      for(let z=z0;z<z1;z+=gap){if(rng()<.22)continue;
        const l=(len||1.6)*(.7+rng()*.6);
        for(const sx of[-1,1])K.at(z,mat).box(.3,.8,l,sx*x,y,z+l/2);}
      return K;},
    /* small boxes scattered over a rectangle of deck at height y, kept clear of avoid [[x,z,r],...] */
    greeble(mat,rng,x0,x1,y,z0,z1,n,avoid,size){
      size=size||1;
      for(let i=0;i<n;i++){
        const x=x0+rng()*(x1-x0),z=z0+rng()*(z1-z0);
        if(avoid&&avoid.some(([ax,az,r])=>Math.hypot(x-ax,z-az)<r))continue;
        const w=(1+rng()*4)*size,d=(1+rng()*6)*size,h=(.4+rng()*2)*size;
        K.at(z,mat).box(w,h,d,x,y+h/2,z);
      }
      return K;},
    done(){for(const k in sets){const s=sets[k];s.B.mesh(C[s.half],s.mat);}},
  };
  return K;
}
/* an invisible box collider for the arena (capSolid makes a visible one): centre and half extents */
function capCol(C,parent,x,y,z,hx,hy,hz,name){
  const o=new THREE.Object3D();o.position.set(x,y,z);parent.add(o);
  C.colDefs.push([o,hx,hy,hz,name]);
  return o;
}
/* a main drive pointing aft (+z) from (x,y,z): housing, a flared bell and the glowing throat */
function capEngine(C,K,x,y,z,r,len){
  const mt=capHullMaterials();len=len||r*1.6;
  const B=K.at(z,mt.hull2);
  B.add(new THREE.LatheGeometry([new THREE.Vector2(r*1.18,-len),new THREE.Vector2(r*1.3,-len*.6),new THREE.Vector2(r*1.3,-len*.1),
    new THREE.Vector2(r*1.12,0)],16),x,y,z,Math.PI/2);
  K.at(z,mt.bell).add(new THREE.LatheGeometry([new THREE.Vector2(r*.78,-.2),new THREE.Vector2(r*.86,r*.35),new THREE.Vector2(r*1.06,r*.9)],16),x,y,z,Math.PI/2);
  K.at(z,mt.metal).add(new THREE.TorusGeometry(r*1.06,r*.06,6,20),x,y,z+r*.9);
  K.at(z,C.mats.eng).add(new THREE.CircleGeometry(r*.8,16),x,y,z+.1);
}
