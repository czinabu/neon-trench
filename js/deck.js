"use strict";
/* HALCYON's walkable deck: the campaign hub as a first-person walk through the carrier, Normandy-style. A long
   spine corridor runs from the bridge at the bow to the hangar at the stern, with the sim deck and your quarters
   off it, and gallery windows onto the hull and space. Every room stands in for a menu: walk up to a station,
   ship or crew member and press E. Nobody has to walk: Tab opens the datapad, which starts the next op, opens
   every hub screen and fast travels between rooms. The command center (js/command.js) stays as the menu view,
   and is the hub on touch screens or when Settings picks it (hubWalk). Built the first time it opens; drawn by
   renderDeck() in place of the menu backdrop. Units are metres, -z is the bow, y = 0 is the deck. Tuning,
   rooms and crew lines are in js/data/deck.js. */

let DK=null;   // the deck, built on first use (dkBuild)
const hubWalk=()=>!isTouch&&SETTINGS.hub!=='menu';
/* where "back to the hub" goes: the walkable deck, or the command center */
function openHub(){if(hubWalk())openDeck();else openCommand();}
const deckOn=()=>!!DK&&S.mode==='menu'&&!$('deck').classList.contains('hidden');
const dkOverlayUp=()=>[ccIntro,ccAcademy,ccPromo].some(o=>o.parentNode===deck&&!o.classList.contains('hidden'));
const dkBusy=()=>!DK||DK.pad||DK.fadeT>0||dkOverlayUp();

/* ---- textures and materials ---- */
const dkPlateTex=()=>holoTex(512,512,(g,W)=>{   // 4 m of deck plating: 2 m plates, seams, bolts and wear
  g.fillStyle='#262c3a';g.fillRect(0,0,W,W);
  for(let i=0;i<900;i++){g.fillStyle='rgba('+(Math.random()<.5?'255,255,255':'0,0,0')+','+Math.random()*.05+')';g.fillRect(Math.random()*W,Math.random()*W,3+Math.random()*20,2+Math.random()*8);}
  g.strokeStyle='#12151e';g.lineWidth=5;for(const p of [0,W/2]){g.strokeRect(p+2,2,W/2-4,W/2-4);g.strokeRect(p+2,W/2+2,W/2-4,W/2-4);}
  g.fillStyle='#3a4254';for(const x of [14,W/2-14,W/2+14,W-14])for(const y of [14,W/2-14,W/2+14,W-14])g.fillRect(x-3,y-3,6,6);
  g.strokeStyle='#1c2130';g.lineWidth=2;for(let y=W/2+60;y<W-40;y+=14){g.beginPath();g.moveTo(W/2+40,y);g.lineTo(W-40,y);g.stroke();}   // a grille plate
});
const dkWallTex=()=>holoTex(512,512,(g,W)=>{   // 4 m of wall: tall panels with a seam band
  g.fillStyle='#2c3446';g.fillRect(0,0,W,W);
  for(let i=0;i<500;i++){g.fillStyle='rgba(255,255,255,'+Math.random()*.035+')';g.fillRect(Math.random()*W,Math.random()*W,2+Math.random()*30,1+Math.random()*4);}
  g.strokeStyle='#161b26';g.lineWidth=4;for(let x=0;x<=W;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x,W);g.stroke();}
  for(const y of [0,180,330]){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  g.fillStyle='#232a39';g.fillRect(0,190,W,130);
  g.fillStyle='#3a4458';for(let x=20;x<W;x+=128){g.fillRect(x,200,40,6);g.fillRect(x+70,300,24,10);}
});
const dkTextTex=(lines,col,w,h)=>holoTex(w,h,(g,W,H)=>{   // a sign: lines of [text, size] on a dark plate with a lit edge
  g.fillStyle='#070b14';g.fillRect(0,0,W,H);g.strokeStyle=col;g.lineWidth=Math.max(3,H/40);g.strokeRect(4,4,W-8,H-8);
  g.fillStyle=col;g.textAlign='center';g.textBaseline='middle';
  const tot=lines.reduce((n,l)=>n+l[1]*1.25,0);let y=H/2-tot/2;
  for(const [t,s] of lines){g.font='bold '+s+'px monospace';y+=s*.625;g.fillText(t,W/2,y);y+=s*.625;}
});
function dkMats(){
  const env=getShipEnvMap(),std=o=>new THREE.MeshStandardMaterial(Object.assign({metalness:.4,roughness:.65,envMap:env,envMapIntensity:.16},o));
  const rep=t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
  const plate=rep(dkPlateTex()),panel=rep(dkWallTex());
  const bas=c=>new THREE.MeshBasicMaterial({color:c});
  return {floor:std({map:plate,color:0xc8d0e0,metalness:.25,roughness:.72,envMapIntensity:.12}),wall:std({map:panel,color:0xdce4f4}),ceil:std({map:panel,color:0x4c566c}),
    metal:std({color:0x1e2430,metalness:.6,roughness:.5,envMapIntensity:.22}),dark:std({color:0x0c0f16,metalness:.5,roughness:.7}),
    cloth:new THREE.MeshLambertMaterial({color:0x2a3346}),bunk:std({color:0x1a1f2a}),
    cyan:bas(0x29d6ee),cyanDim:bas(0x0d5664),amber:bas(0xffa22c),amberDim:bas(0x5c3a0c),mag:bas(0xff2d78),lamp:bas(0xd6ecff),green:bas(0x3cf08a),red:bas(0xff3a4a),
    glass:new THREE.MeshBasicMaterial({color:0x6ab8ff,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),
    field:new THREE.MeshBasicMaterial({color:0x29c8ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),
    holo:new THREE.MeshBasicMaterial({color:0x29d6ee,blending:THREE.AdditiveBlending,transparent:true,opacity:.16,depthWrite:false,wireframe:true})};
}

/* ---- building blocks: boxes by their corners, merged into a mesh per material (capBatch, js/capkit.js) ---- */
const dkBats=new Map();
const dkBat=mat=>{let B=dkBats.get(mat);if(!B)dkBats.set(mat,B=capBatch());return B;};
function dkBox(mat,x0,y0,z0,x1,y1,z1){dkBat(mat).box(x1-x0,y1-y0,z1-z0,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2);}
function dkFlush(parent){for(const [mat,B] of dkBats){const m=B.mesh(parent,mat);if(m)capWorldUV(m.geometry,4);}dkBats.clear();}
const DK_T=.3;   // wall thickness
/* a wall at `at` on one axis, running a0..a1 along the other ('x': along x at z = at), with holes [a,b,y0,y1] */
function dkWall(mat,axis,at,a0,a1,h,holes,y0){
  y0=y0||0;
  const B=(p,q,ya,yb)=>axis==='x'?dkBox(mat,p,ya,at-DK_T/2,q,yb,at+DK_T/2):dkBox(mat,at-DK_T/2,ya,p,at+DK_T/2,yb,q);
  let cur=a0;
  for(const [a,b,ha,hb] of (holes||[]).slice().sort((p,q)=>p[0]-q[0])){
    if(a>cur)B(cur,a,y0,h);if(ha>y0)B(a,b,y0,ha);if(hb<h)B(a,b,hb,h);cur=b;}
  if(a1>cur)B(cur,a1,y0,h);
}
/* glass in a wall hole, with mullions every `step` metres, a lit sill and a frame */
function dkWindow(M,axis,at,a,b,ya,yb,step,parent){
  const L=b-a,g=new THREE.Mesh(new THREE.PlaneGeometry(L,yb-ya),M.glass);
  if(axis==='x')g.position.set((a+b)/2,(ya+yb)/2,at);else{g.position.set(at,(ya+yb)/2,(a+b)/2);g.rotation.y=Math.PI/2;}
  (parent||DK.scene).add(g);
  const P=(p,q,y1,y2,m,t)=>axis==='x'?dkBox(m,p,y1,at-t,q,y2,at+t):dkBox(m,at-t,y1,p,at+t,y2,q);
  const n=Math.max(1,Math.round(L/(step||3)));
  for(let i=0;i<=n;i++){const c=a+L*i/n;P(c-.09,c+.09,ya,yb,M.metal,.12);}
  P(a,b,ya-.12,ya,M.metal,.2);P(a,b,yb,yb+.12,M.metal,.2);
  P(a,b,ya-.16,ya-.1,M.cyanDim,.24);
}
/* a sliding door in a wall hole: two leaves that part when you come near, a lit frame, and a walkable threshold */
function dkDoor(M,axis,at,a,b,h,col){
  const w=b-a,c=(a+b)/2,mk=()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?w/2:.14,h,axis==='x'?.14:w/2),M.dark);DK.scene.add(m);return m;};
  const D={axis,at,c,w,h,L:mk(),R:mk(),k:0,x:axis==='x'?c:at,z:axis==='x'?at:c};
  const P=(p,q,y1,y2,m,t)=>axis==='x'?dkBox(m,p,y1,at-t,q,y2,at+t):dkBox(m,at-t,y1,p,at+t,y2,q);
  P(a-.25,a,0,h+.25,M.metal,.3);P(b,b+.25,0,h+.25,M.metal,.3);P(a-.25,b+.25,h,h+.25,M.metal,.3);
  P(a-.05,a,.1,h,col||M.cyan,.32);P(b,b+.05,.1,h,col||M.cyan,.32);P(a,b,h-.05,h,col||M.cyan,.32);
  DK.doors.push(D);dkDoorPose(D);
  const r=1.8;   // the threshold: overlaps both rooms so the walk is continuous through the gap
  if(axis==='x')dkRect(a+.05,at-r,b-.05,at+r,null);else dkRect(at-r,a+.05,at+r,b-.05,null);
  return D;
}
function dkDoorPose(D){
  const o=D.w/4+D.k*D.w*.47;
  if(D.axis==='x'){D.L.position.set(D.c-o,D.h/2,D.at);D.R.position.set(D.c+o,D.h/2,D.at);}
  else{D.L.position.set(D.at,D.h/2,D.c-o);D.R.position.set(D.at,D.h/2,D.c+o);}
}
/* walkable floor (a rectangle, tagged with its room) and things in the way (circles, or boxes by corners) */
function dkRect(x0,z0,x1,z1,room,tag){DK.rects.push({x0,z0,x1,z1,room,tag});}
function dkBlock(o){DK.blocks.push(o);return o;}
/* a flat sign facing yaw ry */
function dkSign(lines,col,w,h,x,y,z,ry,parent){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:dkTextTex(lines,col,512,Math.round(512*h/w)),color:0xc8d4e0}));
  m.position.set(x,y,z);m.rotation.y=ry||0;(parent||DK.scene).add(m);return m;
}
/* a console desk at x, z with a scrolling screen; whoever works it stands 1 m out along (sin ry, cos ry), facing it with yaw ry */
function dkConsole(M,x,z,ry,hue,parent){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;(parent||DK.scene).add(g);
  const base=new THREE.Mesh(sharedGeo('dkDesk',()=>new THREE.BoxGeometry(1.8,1,.8)),M.dark);base.position.y=.5;g.add(base);
  const top=new THREE.Mesh(sharedGeo('dkDeskTop',()=>new THREE.BoxGeometry(1.9,.08,.95)),M.metal);top.position.y=1.04;g.add(top);
  const tex=holoScreenTex(hue||'#00f0ff');tex.wrapS=THREE.RepeatWrapping;
  const scr=new THREE.Mesh(sharedGeo('dkScr',()=>new THREE.PlaneGeometry(1.6,.8)),new THREE.MeshBasicMaterial({map:tex,color:0xa8c0d0}));
  scr.position.set(0,1.5,-.25);scr.rotation.x=-.35;g.add(scr);DK.screens.push(tex);
  const edge=new THREE.Mesh(sharedGeo('dkDeskEdge',()=>new THREE.BoxGeometry(1.8,.03,.03)),M.cyanDim);edge.position.set(0,1.09,.47);g.add(edge);
  dkBlock({x,z,r:1.05});
  return g;
}
/* a person: you and the crew. Every part hangs off a joint (hips, shoulders, neck) so the walk can swing it, and the
   colours are their own materials in `mats`, so a look (DECK_LOOK in js/data/deck.js) can be swapped part by part
   later for character customization. dkSetLook(P, look) recolours an existing person. */
function dkPerson(M,look){
  look=Object.assign({},DECK_LOOK,look);
  const mats={suit:new THREE.MeshLambertMaterial(),trim:new THREE.MeshBasicMaterial(),skin:new THREE.MeshLambertMaterial(),
    hair:new THREE.MeshLambertMaterial(),boots:new THREE.MeshLambertMaterial()};
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const part=(par,geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,mats[m]);o.position.set(x,y,z);par.add(o);return o;};
  const joint=(par,x,y,z)=>{const j=new THREE.Group();j.position.set(x,y,z);par.add(j);return j;};
  const legs=[],arms=[];
  for(const s of [-1,1]){
    const hip=joint(body,s*.11,.92,0);legs.push(hip);
    part(hip,sharedGeo('dkThigh',()=>new THREE.CylinderGeometry(.095,.08,.46,8)),'suit',0,-.23,0);
    part(hip,sharedGeo('dkShin',()=>new THREE.CylinderGeometry(.078,.068,.44,8)),'suit',0,-.64,0);
    part(hip,sharedGeo('dkBoot',()=>new THREE.BoxGeometry(.15,.12,.3)),'boots',0,-.86,-.05);
    const sh=joint(body,s*.28,1.5,0);arms.push(sh);
    part(sh,sharedGeo('dkUpper',()=>new THREE.CylinderGeometry(.065,.058,.34,8)),'suit',0,-.17,0);
    part(sh,sharedGeo('dkFore',()=>new THREE.CylinderGeometry(.056,.048,.32,8)),'suit',0,-.5,0);
    part(sh,sharedGeo('dkHand',()=>new THREE.SphereGeometry(.052,8,6)),'skin',0,-.69,0);
    part(sh,sharedGeo('dkCuff',()=>new THREE.CylinderGeometry(.06,.06,.04,8)),'trim',0,-.63,0);
  }
  part(body,sharedGeo('dkHip',()=>new THREE.CylinderGeometry(.19,.17,.2,10)),'suit',0,.95,0);
  part(body,sharedGeo('dkTorso',()=>new THREE.CylinderGeometry(.23,.18,.56,10)),'suit',0,1.28,0);
  part(body,sharedGeo('dkShoulder',()=>new THREE.BoxGeometry(.56,.12,.26)),'suit',0,1.52,0);
  part(body,sharedGeo('dkBelt',()=>new THREE.CylinderGeometry(.195,.195,.05,10)),'boots',0,1.04,0);
  part(body,sharedGeo('dkStripe',()=>new THREE.BoxGeometry(.04,.5,.02)),'trim',-.09,1.3,-.215);
  part(body,sharedGeo('dkPatch',()=>new THREE.BoxGeometry(.1,.08,.02)),'trim',.26,1.42,-.05).rotation.y=Math.PI/2;
  part(body,sharedGeo('dkCollar',()=>new THREE.TorusGeometry(.12,.022,6,16)),'trim',0,1.6,0).rotation.x=Math.PI/2;
  const head=joint(body,0,1.72,0);
  part(head,sharedGeo('dkHead',()=>new THREE.SphereGeometry(.12,14,12)),'skin',0,0,0).scale.set(.92,1.12,1);
  const hair=part(head,sharedGeo('dkHair',()=>new THREE.SphereGeometry(.126,14,8,0,Math.PI*2,0,1.5)),'hair',0,.02,.012);
  const sh=new THREE.Mesh(sharedGeo('dkShadowG',()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)),dkShadowMat());sh.scale.set(.9,1,.9);sh.position.y=.012;g.add(sh);   // a soft contact shadow
  const P={g,body,head,legs,arms,mats,hair,walk:0};
  dkSetLook(P,look);
  return P;
}
function dkSetLook(P,look){
  for(const k of ['suit','trim','skin','hair','boots'])if(look[k]!==undefined)P.mats[k].color.setHex(look[k]);
  P.look=look;
}
/* swing the limbs: k is how fast the person is going (0 standing, 1 walking, 2 running) */
function dkStride(P,dt,k){
  P.walk+=dt*(5.5+k*2.2)*Math.min(1,k);
  const a=Math.sin(P.walk)*.55*Math.min(1.3,k);
  P.legs[0].rotation.x=a;P.legs[1].rotation.x=-a;P.arms[0].rotation.x=-a*.8;P.arms[1].rotation.x=a*.8;
  P.body.position.y=k>.05?Math.abs(Math.cos(P.walk))*.035*Math.min(1,k):0;
  P.body.rotation.x=-.06*Math.min(1.5,k);
}
/* a soft round shadow, laid on the deck under people and ships so they sit on it rather than float */
let dkShadowM=null;
function dkShadowMat(){
  return dkShadowM||(dkShadowM=new THREE.MeshBasicMaterial({map:holoTex(64,64,(g,W)=>{const r=g.createRadialGradient(W/2,W/2,0,W/2,W/2,W/2);
    r.addColorStop(0,'rgba(0,0,0,.6)');r.addColorStop(.6,'rgba(0,0,0,.28)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,W,W);}),
    transparent:true,depthWrite:false}));
}
function dkShadow(parent,x,z,w,d){const m=new THREE.Mesh(sharedGeo('dkShadowG',()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)),dkShadowMat());m.scale.set(w,1,d||w);m.position.set(x,.014,z);parent.add(m);return m;}
/* a name tag that floats over a crew member's head */
function dkTag(name,col){
  const t=holoTex(256,48,(g,W,H)=>{g.font='bold 26px monospace';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='rgba(4,8,16,.7)';g.fillRect(0,0,W,H);g.fillStyle=col;g.fillText(name,W/2,H/2+1);});
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(1.1,.21,1);s.position.y=2.12;return s;
}

/* ---- the ship ---- */
const DK_SPINE={x:3,z0:-68,z1:48,h:5};
const DK_BRIDGE={x:20,z0:-100,z1:-68,h:10};
const DK_SIM={x0:3,x1:25,z0:-48,z1:-28,h:6};
const DK_HANGAR={x:45,z0:48,z1:130,h:26};
const DK_QUARTERS=[{w:9,d:12,h:4.4},{w:12,d:14,h:5},{w:16,d:18,h:6},{w:22,d:22,h:8}];   // grows with rank, like STAGE_ROOMS
const DK_QZ=-8;   // the quarters door's z on the spine
function dkBuild(){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x02030a);
  const cam=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,9000);
  DK={scene,cam,x:0,z:-72.5,yaw:0,pitch:-.18,face:0,dist:3.6,vx:0,vz:0,t:0,rects:[],blocks:[],doors:[],acts:[],crew:[],screens:[],spin:[],
    room:null,focus:null,barkT:0,heard:{},said:{},pad:false,fadeT:0,fadeTo:null,qL:-1,Q:null,drag:false,placed:false,fleet:[],hulls:[],shipBlocks:[]};
  const M=DK.M=dkMats();
  scene.add(new THREE.AmbientLight(0x50607e,.22));
  scene.add(new THREE.HemisphereLight(0x7a96c8,0x141218,.2));
  const sun=new THREE.DirectionalLight(0xffe0c0,.55);sun.position.set(-.5,.6,-.6);scene.add(sun);
  const pl=(c,i,d,x,y,z)=>{const l=new THREE.PointLight(c,i*.6,d,1.6);l.position.set(x,y,z);scene.add(l);return l;};
  pl(0x9ad8ff,1.1,40,0,4.4,-40);pl(0x9ad8ff,1.1,40,0,4.4,10);   // spine
  pl(0x29d6ee,1.6,26,0,4,-84);pl(0xffc890,1,40,0,9,-90);          // bridge: the holo table and the overhead
  pl(0x7af0c0,1.1,26,14,5,-38);                                     // sim deck
  pl(0xffe2b8,1.6,110,0,22,80);pl(0xbfe0ff,1.2,90,0,20,118);        // hangar
  DK.qLight=pl(0xffc890,.7,24,-10,3.4,DK_QZ);                         // quarters (moved when the room changes size)
  dkOutside(M);
  dkSpine(M);dkBridge(M);dkSim(M);dkHangar(M);dkDetail(M);
  dkFlush(scene);
  dkCrew(M);
  DK.me=dkPerson(M,PROG.look);scene.add(DK.me.g);   // you
}
/* outside: stars, two planets, a nebula, the sun, HALCYON's own hull under the windows and the fleet around her */
function dkOutside(M){
  const sc=DK.scene;
  sc.add(stageStars(3200,5200));
  const p=stagePlanet(900,'warm');p.position.set(1500,-1000,-4400);p.rotation.set(.25,0,-.2);sc.add(p);
  const moon=stagePlanet(380,'cool');moon.position.set(-900,-420,3000);sc.add(moon);
  const sunG=stageGlow(0xffd9a0,800,.6);sunG.position.set(-2400,1500,-3600);sc.add(sunG);
  sc.add(stageNebula('0,140,255',-1400,500,-3400,3200,.5),stageNebula('255,45,120',1600,250,-3600,2800,.4),stageNebula('120,60,255',400,900,3200,3000,.35));
  // the hull: a faceted body under the decks from the prow, out ahead of the bridge window, to the stern under the hangar
  const mt=capHullMaterials(),B=capBatch(),G=capBatch(),L=capBatch(),hw=z=>z<-230?5+29*(z+330)/100:z<-115?34+24*(z+230)/115:z<150?58+4*(z+115)/265:62-14*(z-150)/25;
  B.loft([[0,1],[.85,.92],[1,.35],[1,-.5],[.55,-1],[0,-1]],[[-330,5,3,-3.6],[-230,34,6,-6.6],[-115,58,8.4,-9],[150,62,8.4,-9],[175,48,7,-9]]);
  B.mesh(sc,mt.cHull);
  const rng=capRng(77),inRoom=(x,z)=>z>-103&&z<-65&&Math.abs(x)<23||z>-70&&z<50&&Math.abs(x)<6||z>45&&z<135&&Math.abs(x)<48   // keep clear of the rooms
    ||x>0&&x<28&&z>-51&&z<-25||x<0&&x>-29&&z>DK_QZ-14&&z<DK_QZ+14;
  for(let i=0;i<900;i++){
    const z=-320+rng()*490,w=hw(z)-3,x=(rng()*2-1)*w;if(inRoom(x,z))continue;
    const bw=1+rng()*5,bd=1+rng()*9,bh=.3+rng()*(rng()<.1?5:1.6);
    G.box(bw,bh+.7,bd,x,-1.3+(bh+.7)/2,z);
  }
  for(let k=0;k<6;k++){const z=-280+k*60,x=(k%2?1:-1)*(hw(z)*.55);   // point-defence turrets and an antenna mast or two
    G.add(new THREE.CylinderGeometry(2.4,3.2,1.6,12),x,.2,z);G.box(.5,.5,5,x-.7,1.4,z-2.4);G.box(.5,.5,5,x+.7,1.4,z-2.4);}
  for(const [x,z,h] of [[-34,-30,22],[38,10,16],[-54,110,12]]){G.box(.6,h,.6,x,h/2-.6,z);G.box(6,.3,.3,x,h-2,z);L.box(.5,.5,.5,x,h,z);}
  for(let z=-320;z<170;z+=14)for(const s of [-1,1])L.box(.6,.3,1.6,s*(hw(z)-1),-1.1,z);   // running lights down both edges
  G.mesh(sc,mt.cHull2);L.mesh(sc,M.cyan);
}
function dkSpine(M){
  const {x:X,z0,z1,h}=DK_SPINE;
  dkBox(M.floor,-X,-.2,z0,X,0,z1);dkBox(M.ceil,-X,h,z0,X,h+.3,z1);
  const winL=[[z0+4,-24,1.1,h-.9],[6,z1-4,1.1,h-.9]],winR=[[z0+4,-52,1.1,h-.9],[-24,z1-4,1.1,h-.9]];
  dkWall(M.wall,'z',-X,z0,z1,h,[[DK_QZ-2,DK_QZ+2,0,3.2]].concat(winL));
  dkWall(M.wall,'z',X,z0,z1,h,[[-40,-36,0,3.2]].concat(winR));
  for(const [a,b,ya,yb] of winL)dkWindow(M,'z',-X,a,b,ya,yb,3);
  for(const [a,b,ya,yb] of winR)dkWindow(M,'z',X,a,b,ya,yb,3);
  dkDoor(M,'z',-X,DK_QZ-2,DK_QZ+2,3.2,M.amber);dkDoor(M,'z',X,-40,-36,3.2,M.green);
  // ribs every 4 m, a light panel between each pair, strips along the floor edges, and the chevrons on the deck
  for(let z=z0+2;z<z1;z+=4){
    for(const s of [-1,1]){dkBox(M.metal,s*X-.32*s-.16,0,z-.3,s*X-.32*s+.16,h,z+.3);}
    dkBox(M.metal,-X,h-.45,z-.3,X,h,z+.3);
    dkBox(M.lamp,-.8,h-.06,z+1.2,.8,h-.02,z+2.8);
  }
  for(const s of [-1,1])dkBox(M.cyanDim,s*(X-.06)-.04,.05,z0,s*(X-.06)+.04,.12,z1);
  for(const s of [-1,1])dkBox(M.cyan,s*(X-.2)-.03,h-.7,z0,s*(X-.2)+.03,h-.62,z1);
  for(let z=z0+8;z<z1-6;z+=16)for(const k of [0,1])dkBat(M.amberDim).box(.9,.02,.18,0,.01,z+k*.8,0,0,0);   // a dashed centre line
  dkRect(-X,z0,X,z1,'spine');
  // signs: the rooms off the spine, and which way the bridge and hangar are
  dkSign([['SIM DECK',58],['flight school · practice',26]],'#7af0c0',3.2,.8,X-.17,3.75,-38,-Math.PI/2);
  dkSign([['QUARTERS',58],['officers',26]],'#ffb300',3.2,.8,-X+.17,3.75,DK_QZ,Math.PI/2);
  for(const z of [-50,-20,25]){
    dkSign([['▲ BRIDGE · HANGAR ▼',44]],'#9fe8ff',3.6,.5,0,h-.85,z+.05,0);
    dkSign([['▲ HANGAR · BRIDGE ▼',44]],'#9fe8ff',3.6,.5,0,h-.85,z-.05,Math.PI);
  }
}
function dkBridge(M){
  const {x:X,z0,z1,h}=DK_BRIDGE,sc=DK.scene;
  dkBox(M.floor,-X,-.2,z0,X,0,z1);dkBox(M.ceil,-X,h,z0,X,h+.4,z1);
  dkWall(M.wall,'x',z1,-X,X,h,[[-2,2,0,3.4]]);
  dkWall(M.wall,'x',z0,-X,X,h,[[-18,18,1,h-.8]]);
  for(const s of [-1,1])dkWall(M.wall,'z',s*X,z0,z1,h,[[-96,-72,2,h-1.6]]);
  dkWindow(M,'x',z0,-18,18,1,h-.8,4);dkBox(M.metal,-18,5,z0-.14,18,5.18,z0+.14);
  for(const s of [-1,1])dkWindow(M,'z',s*X,-96,-72,2,h-1.6,4);
  dkDoor(M,'x',z1,-2,2,3.4,M.cyan);
  dkSign([['BRIDGE',64],['HALCYON · command deck',24]],'#9fe8ff',3.4,.85,0,4.3,DK_SPINE.z0+.17,0);
  // the forward rail and the step down to it, beams overhead with light panels, strips round the room
  dkBox(M.metal,-17.5,1.05,-97.1,17.5,1.15,-96.9);for(let x=-17;x<=17;x+=2.5)dkBox(M.metal,x-.05,0,-97.05,x+.05,1.1,-96.95);
  dkBox(M.dark,-18,0,-99.8,18,.06,-97);dkBox(M.cyanDim,-18,.06,-97.05,18,.1,-96.95);
  for(let z=z0+4;z<z1;z+=6){dkBox(M.metal,-X,h-.7,z-.35,X,h,z+.35);dkBox(M.lamp,-6,h-.75,z-.15,6,h-.7,z+.15);}
  for(const s of [-1,1]){dkBox(M.cyan,s*(X-.2)-.03,1.05,z0,s*(X-.2)+.03,1.12,z1);dkBox(M.amberDim,s*(X-.2)-.03,h-1.3,z0,s*(X-.2)+.03,h-1.24,z1);}
  // the holo table: a pedestal ringed in light, the sector as a hologram over it, a ring hung from the ceiling
  const T={x:0,z:-84};
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(3,3.4,1,40),M.metal);ped.position.set(T.x,.5,T.z);sc.add(ped);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(3.05,3.05,.1,40),M.dark);top.position.set(T.x,1.05,T.z);sc.add(top);
  for(const r of [3.1,6.2]){const m=new THREE.Mesh(new THREE.RingGeometry(r-.06,r,72),M.cyanDim);m.rotation.x=-Math.PI/2;m.position.set(T.x,.02,T.z);sc.add(m);}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.4,.16,8,64),M.metal);ring.rotation.x=Math.PI/2;ring.position.set(T.x,h-2,T.z);sc.add(ring);
  const lit=new THREE.Mesh(new THREE.TorusGeometry(3.4,.04,6,64),M.cyan);lit.rotation.x=Math.PI/2;lit.position.set(T.x,h-2.2,T.z);sc.add(lit);
  const holo=new THREE.Group();holo.position.set(T.x,3.1,T.z);sc.add(holo);
  holo.add(new THREE.Mesh(new THREE.SphereGeometry(1.9,16,10),M.holo));
  const planet=new THREE.Mesh(new THREE.SphereGeometry(.5,20,14),new THREE.MeshBasicMaterial({color:0xff5a8a,blending:THREE.AdditiveBlending,transparent:true,opacity:.45,depthWrite:false}));holo.add(planet);
  const orbit=new THREE.Mesh(new THREE.TorusGeometry(1.25,.012,4,80),new THREE.MeshBasicMaterial({color:0xffb300,blending:THREE.AdditiveBlending,transparent:true,opacity:.7,depthWrite:false}));orbit.rotation.x=Math.PI/2;holo.add(orbit);
  const fleet=new THREE.Group();holo.add(fleet);
  for(let i=0;i<5;i++){const c=new THREE.Mesh(sharedGeo('dkIcon',()=>new THREE.ConeGeometry(.07,.24,4).rotateX(-Math.PI/2)),i<3?M.cyan:M.mag);
    const a=i*.5+(i<3?0:Math.PI);c.position.set(Math.cos(a)*1.25,(i%2)*.08,Math.sin(a)*1.25);c.lookAt(Math.cos(a+.3)*1.25,0,Math.sin(a+.3)*1.25);fleet.add(c);}
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.6,1.6,40,1,true),new THREE.MeshBasicMaterial({color:0x29d6ee,blending:THREE.AdditiveBlending,transparent:true,opacity:.05,depthWrite:false,side:THREE.DoubleSide}));
  beam.position.set(T.x,1.9,T.z);sc.add(beam);
  DK.spin.push({o:holo,r:.12},{o:fleet,r:.35});
  dkBlock({x:T.x,z:T.z,r:3.4});
  DK.acts.push({x:T.x,z:T.z,r:3.4,room:'bridge',get name(){return sectorOpen()?'Sector map':'Sortie board';},
    get sub(){const L=sectorChoice();return L?'Targets up for '+L.name:sectorOpen()?'The Kiru road':'Pick an op';},go:()=>sectorOpen()?openSector():openMissions()});
  // consoles down both sides: the sortie board and fleet desks on the left, CIC on the right, crew at the rest
  dkConsole(M,-14.2,-88,Math.PI/2,'#ffb300');dkConsole(M,-14.2,-78,Math.PI/2,'#00f0ff');
  DK.acts.push({x:-14.2,z:-88,r:1,room:'bridge',name:'Sortie board',sub:'Every op, briefings',go:openMissions},
    {x:-14.2,z:-78,r:1,room:'bridge',name:'Fleet',get sub(){return sectorOpen()?'Ships, pilots, upgrades':'Wing and upgrades';},go:()=>{openCommand();selectStation('fleet');}});
  dkSign([['SORTIE BOARD',48]],'#ffb300',2,.32,-15.4,2.6,-88,Math.PI/2);dkSign([['FLEET',48]],'#9fe8ff',2,.32,-15.4,2.6,-78,Math.PI/2);
  for(const [x,z,ry,hue,crew] of [[14.2,-82,-Math.PI/2,'#9fe8ff',0],[14.2,-90,-Math.PI/2,'#ff2d78',1],[14.2,-74,-Math.PI/2,'#00f0ff',1],[-14.2,-94,Math.PI/2,'#00f0ff',1],[8,-95,0,'#ffb300',1],[-8,-95,0,'#00f0ff',0]]){
    dkConsole(M,x,z,ry,hue);
    if(crew){const P=dkPerson(M,{trim:x<0?0x00f0ff:0xffb300,hair:[0x1a1410,0x3a2a1a,0x0c0c10][(Math.random()*3)|0]});P.g.position.set(x+Math.sin(ry)*1.05,0,z+Math.cos(ry)*1.05);P.g.rotation.y=ry;sc.add(P.g);DK.crew.push({P,idle:true,ph:Math.random()*6});}
  }
  dkRect(-X+.2,-96.9,X-.2,z1,'bridge');
}
function dkSim(M){
  const {x0,x1,z0,z1,h}=DK_SIM,sc=DK.scene;
  dkBox(M.floor,x0,-.2,z0,x1,0,z1);dkBox(M.ceil,x0,h,z0,x1,h+.3,z1);
  dkWall(M.wall,'x',z0,x0,x1,h);dkWall(M.wall,'x',z1,x0,x1,h);dkWall(M.wall,'z',x1,z0,z1,h);
  dkBox(M.wall,x0-DK_T/2,DK_SPINE.h,z0,x0+DK_T/2,h,z1);   // the spine wall is lower: close the gap over it
  for(const s of [z0+.2,z1-.2])dkBox(M.green,x0,.06,s-.03,x1,.12,s+.03);
  const ringM=new THREE.Mesh(new THREE.TorusGeometry(5,.06,6,64),M.cyanDim);ringM.rotation.x=Math.PI/2;ringM.position.set(14,h-.2,-38);sc.add(ringM);
  // four sim pods down the far wall: an open shell on a pedestal, its seat lit, a status lamp and a label
  const PODS=[
    {name:'Flight school',sub:'Lessons and graded drills',open:()=>true,go:()=>openSchool('deck')},
    {name:'Fleet sim',sub:'Skirmish: a fleet battle vs AI',open:skirmishOpen,locked:'Opens after your first fleet battle',go:openSkirmish},
    {name:'Free trench',sub:'Score attack',open:campaignDone,locked:'Opens once Acts I to III are clear',go:()=>{S.mission=null;startGame('trench');}},
    {name:'Free dogfight',sub:'Score attack',open:campaignDone,locked:'Opens once Acts I to III are clear',go:()=>{S.mission=null;startGame('arena');}},
  ];
  DK.pods=[];
  PODS.forEach((P,i)=>{
    const z=-44.5+i*4.4,x=21.6,g=new THREE.Group();g.position.set(x,0,z);sc.add(g);
    const base=new THREE.Mesh(sharedGeo('dkPodBase',()=>new THREE.CylinderGeometry(1.3,1.5,.5,24)),M.metal);base.position.y=.25;g.add(base);
    const shell=new THREE.Mesh(sharedGeo('dkPodShell',()=>new THREE.SphereGeometry(1.45,28,18,Math.PI*.25,Math.PI*1.5)),new THREE.MeshStandardMaterial({color:0x8a94a6,metalness:.3,roughness:.5,side:THREE.DoubleSide,envMap:getShipEnvMap(),envMapIntensity:.15}));
    shell.position.y=1.85;g.add(shell);
    const seat=new THREE.Mesh(sharedGeo('dkPodSeat',()=>new THREE.BoxGeometry(.7,.9,.7)),M.dark);seat.position.set(.25,1.05,0);g.add(seat);
    const glow=new THREE.Mesh(sharedGeo('dkPodGlow',()=>new THREE.TorusGeometry(1.42,.04,6,48)),M.green.clone());glow.rotation.y=Math.PI/2;glow.position.y=1.85;g.add(glow);
    dkSign([['0'+(i+1)+' '+P.name.toUpperCase(),40]],'#7af0c0',2.6,.36,x+1.5,3.9,z,-Math.PI/2);
    dkBlock({x,z,r:1.55});DK.pods.push({P,glow});
    DK.acts.push({x,z,r:1.55,room:'sim',get name(){return P.name;},get sub(){return P.open()?P.sub:'Locked · '+P.locked;},go:()=>{if(P.open())P.go();else dkSay('hale','Not cleared for that one yet. '+P.locked+'.');}});
  });
  // the grades board: one row per lesson (redrawn on every visit)
  DK.board=new THREE.Mesh(new THREE.PlaneGeometry(9,3.4),new THREE.MeshBasicMaterial({color:0xc8d4e0}));DK.board.position.set(13,3,z0+.17);sc.add(DK.board);
  dkRect(x0,z0,x1,z1,'sim');
}
function dkBoardDraw(){
  const old=DK.board.material.map;
  DK.board.material.map=holoTex(1024,384,(g,W,H)=>{
    g.fillStyle='#04100c';g.fillRect(0,0,W,H);g.strokeStyle='#3cf08a';g.lineWidth=5;g.strokeRect(4,4,W-8,H-8);
    g.fillStyle='#7af0c0';g.font='bold 34px monospace';g.fillText('SIM DECK // FLIGHT SCHOOL GRADES',28,52);
    g.font='24px monospace';
    SCHOOL_LESSONS.forEach((L,i)=>{const b=PROG.school&&PROG.school[L.id],x=28+(i%2)*500,y=104+Math.floor(i/2)*44;
      g.fillStyle='#9fd8c0';g.fillText(L.name,x,y);g.fillStyle=b?'#ffd23c':'#3a6a58';g.fillText(b?(b.grade==='✓'?'DONE':'GRADE '+b.grade):'—',x+330,y);});
  });
  DK.board.material.needsUpdate=true;if(old)old.dispose();
}
function dkHangar(M){
  const {x:X,z0,z1,h}=DK_HANGAR,sc=DK.scene;
  dkBox(M.floor,-X,-.2,z0,X,0,z1+4);dkBox(M.ceil,-X,h,z0,X,h+.6,z1);
  dkWall(M.wall,'x',z0,-X,X,h,[[-2.5,2.5,0,3.6],[-16,16,10.5,14]]);
  for(const s of [-1,1])dkWall(M.wall,'z',s*X,z0,z1,h);
  dkDoor(M,'x',z0,-2.5,2.5,3.6,M.amber);
  dkSign([['HANGAR',64],['flight deck · bay 1',24]],'#ffb300',3.4,.85,0,4.3,DK_SPINE.z1-.17,Math.PI);
  dkSign([['HANGAR BAY 1',60],['HALCYON',30]],'#ffb300',8,1.6,0,7,z0+.17,0);
  // the flight control gallery high on the front wall, lit from inside
  dkWindow(M,'x',z0,-16,16,10.5,14,4);dkBox(M.amberDim,-16,10.5,z0-3,16,14,z0-2.8);dkBox(M.metal,-17,10.2,z0,17,10.5,z0+1.4);
  // pillars down the walls, trusses across the roof, a gantry crane over pad one, light bars
  for(let z=z0+6;z<z1;z+=10)for(const s of [-1,1]){
    dkBox(M.metal,s*X-s*.9-.6,0,z-.6,s*X-s*.9+.6,h,z+.6);
    dkBox(M.cyanDim,s*X-s*1.55-.04,.4,z-.2,s*X-s*1.55+.04,h-2,z+.2);
  }
  for(let z=z0+6;z<z1;z+=10){dkBox(M.metal,-X,h-1.6,z-.5,X,h,z+.5);dkBox(M.lamp,-20,h-1.7,z-.2,20,h-1.6,z+.2);
    for(let x=-X;x<X;x+=10){dkBat(M.metal).bar(new THREE.Vector3(x,h-1.6,z),new THREE.Vector3(x+10,h,z+5),.35);}}
  for(const s of [-1,1])dkBox(M.metal,s*11-.4,19.6,z0+8,s*11+.4,20.4,z1-6);
  dkBox(M.metal,-11.5,19.4,88,11.5,20.6,90);dkBox(M.dark,-1.2,16.5,88.2,1.2,19.4,89.8);dkBox(M.amber,-1.3,16.4,88.1,1.3,16.5,89.9);
  // the bay mouth: a heavy frame, warning lights along the lip, and the shimmer of the atmosphere field
  dkBox(M.metal,-X,h-3,z1-.5,X,h,z1+.5);for(const s of [-1,1])dkBox(M.metal,s*X-s*1.5-1.5,0,z1-.5,s*X-s*1.5+1.5,h,z1+.5);
  for(let x=-X+4;x<X-3;x+=3)dkBox(M.amber,x-.5,.02,z1+2.6,x+.5,.08,z1+3);
  dkBox(M.cyan,-X+3,h-3.1,z1+.4,X-3,h-3,z1+.5);
  DK.field=new THREE.Mesh(new THREE.PlaneGeometry(X*2-6,h-3),M.field);DK.field.position.set(0,(h-3)/2,z1+.6);sc.add(DK.field);
  dkSign([['ATMOSPHERE FIELD · KEEP CLEAR',40]],'#ff3a4a',6,.5,0,1.6,z1-1.4,Math.PI);
  dkBox(M.metal,-X+3,1,z1-1.25,X-3,1.1,z1-1.1);
  // deck markings: pads with rings, stripes down the taxiway
  const pads=[[0,92,9],[-22,70,6.5],[22,70,6.5],[-22,112,6.5],[22,112,6.5]];
  for(const [x,z,r] of pads){
    const m=new THREE.Mesh(new THREE.RingGeometry(r-.25,r,64),r>8?M.cyan:M.amberDim);m.rotation.x=-Math.PI/2;m.position.set(x,.02,z);sc.add(m);
    const d=new THREE.Mesh(new THREE.CircleGeometry(r-.25,64),M.dark);d.rotation.x=-Math.PI/2;d.position.set(x,.012,z);sc.add(d);}
  for(const s of [-1,1])for(let z=z0+4;z<z1;z+=3)dkBox(M.amberDim,s*5-.12,.005,z,s*5+.12,.02,z+1.6);
  // crates, carts and fuel tanks along the walls
  const rng=capRng(9);
  for(const [cx,cz,n] of [[-38,58,5],[38,58,4],[-38,122,4],[38,120,6],[-32,104,3],[34,100,3]]){
    let x0=1e9,z0b=1e9,x1=-1e9,z1b=-1e9;
    for(let i=0;i<n;i++){const w=1.6+rng()*1.6,d=1.6+rng()*1.6,hh=1.2+rng()*1.4,x=cx+(rng()-.5)*4,z=cz+(rng()-.5)*5,st=rng()<.35?hh:0;
      dkBox(rng()<.5?M.metal:M.dark,x-w/2,st,z-d/2,x+w/2,st+hh,z+d/2);x0=Math.min(x0,x-w/2);x1=Math.max(x1,x+w/2);z0b=Math.min(z0b,z-d/2);z1b=Math.max(z1b,z+d/2);}
    dkBlock({x0,z0:z0b,x1,z1:z1b});
  }
  for(const s of [-1,1]){const t=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,6,16),M.metal);t.rotation.x=Math.PI/2;t.position.set(s*40,1.3,80);sc.add(t);dkBlock({x0:s*40-1.3,z0:77,x1:s*40+1.3,z1:83});}
  // the hangar terminal and the wing's two fighters
  dkConsole(M,-15.5,60,Math.PI/2,'#ffb300');dkSign([['HULLS AND REFITS',44]],'#ffb300',2.4,.34,-16.7,2.6,60,Math.PI/2);
  DK.acts.push({x:-15.5,z:60,r:1,room:'hangar',name:'Hangar',sub:'Hulls and refits',go:()=>openHangar('deck')});
  for(const s of [-1,1]){const w=buildWingman();w.scale.setScalar(2.6);w.position.set(s*36,1.6,84);w.rotation.y=Math.PI;sc.add(w);dkBlock({x:s*36,z:84,r:5.5});
    const m=new THREE.Mesh(new THREE.RingGeometry(5.6,5.85,48),M.amberDim);m.rotation.x=-Math.PI/2;m.position.set(s*36,.02,84);sc.add(m);}
  DK.hullHold=pads.map(([x,z],i)=>{const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=Math.PI;sc.add(g);return g;});
  DK.acts.push({x:0,z:92,r:6.2,room:'hangar',get name(){return sectorChoice()?'Sector map':nextMission()?'Launch':'Sortie board';},
    get sub(){const nm=nextMission();return sectorChoice()?'Pick a target before the jump':nm?nm.name+' · '+curShip.name:'All ops clear';},go:dkNextOp});
  dkRect(-X+1.6,z0,X-1.6,z1-1.4,'hangar');
}
/* the second pass of detail over the rooms: conduits and wall screens in the spine, the captain's chair, and the
   hangar's light shafts, fuel lines, deck crew at work and dust in the air */
function dkDetail(M){
  const sc=DK.scene,{x:X,z0,z1,h}=DK_SPINE,pipe=new THREE.MeshStandardMaterial({color:0x2c3444,metalness:.7,roughness:.4,envMap:getShipEnvMap(),envMapIntensity:.25});
  // spine: two conduits high on each wall with amber bands, a grille down the middle, kick panels under the windows, screens on the solid wall
  for(const s of [-1,1])for(const [y,r] of [[h-1.05,.13],[h-1.4,.09]]){
    dkBat(pipe).cylZ(r,r,z1-z0,10,s*(X-.5),y,(z0+z1)/2);
    for(let z=z0+4;z<z1;z+=8)dkBat(M.amberDim).cylZ(r+.02,r+.02,.18,10,s*(X-.5),y,z);
  }
  dkBox(M.dark,-.75,0,z0,.75,.008,z1);
  const slat=new THREE.MeshLambertMaterial({color:0x1c222e});for(let z=z0+1;z<z1;z+=.5)dkBox(slat,-.72,.008,z,.72,.014,z+.08);
  for(const s of [-1,1])for(const [a,b] of s<0?[[z0+4,-24],[6,z1-4]]:[[z0+4,-52],[-24,z1-4]])
    for(let z=a+.3;z<b-.3;z+=2)dkBox(M.dark,s*X-s*.2-.04,.2,z,s*X-s*.2+.04,.9,z+1.6);
  for(const [x,z,ry,hue] of [[-X+.17,-18,Math.PI/2,'#00f0ff'],[-X+.17,1.5,Math.PI/2,'#ffb300'],[X-.17,-47,-Math.PI/2,'#7af0c0'],[X-.17,-29,-Math.PI/2,'#00f0ff'],[X-.17,-21,-Math.PI/2,'#ff2d78']]){
    const tex=holoScreenTex(hue);tex.wrapS=THREE.RepeatWrapping;DK.screens.push(tex);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.85),new THREE.MeshBasicMaterial({map:tex,color:0x9fb4c4}));m.position.set(x,1.75,z);m.rotation.y=ry;sc.add(m);
    dkBox(M.metal,x-Math.sign(x)*.03-.04,1.28,z-.82,x-Math.sign(x)*.03+.04,2.22,z+.82);
  }
  // bridge: the captain's chair behind the holo table, facing the window, and a shaft of light over the table
  const ch=new THREE.Group();ch.position.set(0,0,-77.5);sc.add(ch);
  const part=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);ch.add(o);return o;};
  part(new THREE.CylinderGeometry(.35,.55,.45,16),M.metal,0,.22,0);part(new THREE.BoxGeometry(.9,.18,.85),M.dark,0,.55,0);
  part(new THREE.BoxGeometry(.9,1.1,.18),M.dark,0,1.15,.42);part(new THREE.BoxGeometry(.12,.08,.7),M.amber,-.5,.82,0);part(new THREE.BoxGeometry(.12,.08,.7),M.amber,.5,.82,0);
  for(const s of [-1,1])part(new THREE.BoxGeometry(.14,.3,.8),M.metal,s*.5,.68,0);
  dkBlock({x:0,z:-77.5,r:.7});dkShadow(sc,0,-77.5,1.6);
  const cone=(r,hh,x,y,z,col,op)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.15,r,hh,32,1,true),new THREE.MeshBasicMaterial({color:col,blending:THREE.AdditiveBlending,transparent:true,opacity:op,depthWrite:false,side:THREE.DoubleSide}));
    m.position.set(x,y,z);sc.add(m);return m;};
  cone(3.2,DK_BRIDGE.h-2.4,0,1.2+(DK_BRIDGE.h-2.4)/2,-84,0x29d6ee,.03);
  // hangar: light shafts down onto the pads and the taxiway, fuel lines from the tanks to pad one, a crew at work, and dust
  const H=DK_HANGAR;
  for(const [x,z,r] of [[0,92,11],[-22,70,7],[22,70,7],[-22,112,7],[22,112,7],[0,64,6],[0,118,6]])cone(r,H.h-1.6,x,(H.h-1.6)/2,z,0xbfe0ff,.035);
  for(const s of [-1,1]){
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(s*38.6,1.1,82.5),new THREE.Vector3(s*36,.12,86),new THREE.Vector3(s*20,.12,96),new THREE.Vector3(s*9,.12,95),new THREE.Vector3(s*5.5,.5,93)]);
    dkBat(M.dark).add(new THREE.TubeGeometry(path,40,.11,8,false));
    for(let k=.1;k<.95;k+=.12){const p=path.getPointAt(k);dkBat(M.amberDim).box(.3,.26,.3,p.x,p.y,p.z);}
  }
  dkShadow(sc,-36,84,9,13);dkShadow(sc,36,84,9,13);
  dkSign([['PAD 1',90]],'#29d6ee',4,1,0,.03,79.5,0).rotation.set(-Math.PI/2,0,Math.PI);
  for(const [x,z,ry,look] of [[6.5,98,-2.2,{suit:0x5a3414,trim:0xffa22c}],[-7,86,2.4,{suit:0x5a3414,trim:0xffa22c,hair:0x101010}],[18.5,108,1.2,{suit:0x2a3a2a,trim:0x3cf08a}]]){
    const P=dkPerson(M,look);P.g.position.set(x,0,z);P.g.rotation.y=ry;sc.add(P.g);DK.crew.push({P,work:true,ph:Math.random()*6});dkBlock({x,z,r:.45});
  }
  const pos=[];for(let i=0;i<500;i++)pos.push((Math.random()*2-1)*(H.x-3),Math.random()*(H.h-2),H.z0+4+Math.random()*(H.z1-H.z0-6));
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  DK.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0xbfd8ff,size:.07,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));sc.add(DK.dust);
  // door leaves get a lit seam so you can read them as doors
  for(const d of DK.doors)for(const leaf of [d.L,d.R]){const strip=new THREE.Mesh(sharedGeo('dkSeam',()=>new THREE.BoxGeometry(.04,.5,.16)),M.cyanDim);strip.position.y=.2;leaf.add(strip);}
}
/* the hulls on the pads: the one you fly on pad one, the rest you own beside it (redone on each visit) */
function dkHulls(){
  const ids=[PROG.ship].concat(PROG.shipsOwned.filter(id=>id!==PROG.ship)).slice(0,DK.hullHold.length);
  DK.blocks=DK.blocks.filter(b=>!b.ship);DK.hulls.length=0;
  DK.hullHold.forEach((g,i)=>{
    const id=ids[i];g.visible=!!id;if(!id)return;
    const H=stageSetHull(g,id,'deck'+i);
    if(!H.box)H.box=new THREE.Box3().setFromObject(H.pivot).getSize(new THREE.Vector3());
    const k=(i?7.5:9.5)/Math.max(H.box.x,H.box.z)*2;
    H.pivot.scale.setScalar(k);H.pivot.position.y=H.box.y*k/2+1.1;
    H.flames.forEach(f=>f.visible=false);DK.hulls.push(H);
    if(!g.userData.gear){g.userData.gear=new THREE.Group();g.add(g.userData.gear);g.userData.shadow=dkShadow(g,0,0,1);}   // landing gear and a shadow, sized to the hull
    const gear=g.userData.gear;gear.clear();
    for(const [gx,gz] of [[0,-.32],[-.22,.25],[.22,.25]]){const st=new THREE.Mesh(sharedGeo('dkStrut',()=>new THREE.CylinderGeometry(.09,.12,1.2,8)),DK.M.metal);
      st.position.set(gx*H.box.x*k,.6,gz*H.box.z*k);gear.add(st);
      const ft=new THREE.Mesh(sharedGeo('dkFoot',()=>new THREE.CylinderGeometry(.35,.4,.08,12)),DK.M.dark);ft.position.set(st.position.x,.04,st.position.z);gear.add(ft);}
    g.userData.shadow.scale.set(H.box.x*k*1.05,1,H.box.z*k*1.05);
    dkBlock({x:g.position.x,z:g.position.z,r:i?5:6.2,ship:true});
  });
}
/* quarters: rebuilt whenever your rank (and so the room) changes */
function dkQuarters(L){
  const M=DK.M,R=DK_QUARTERS[L],sc=DK.scene;
  if(DK.Q){sc.remove(DK.Q.g);DK.Q.g.traverse(o=>{if(o.geometry)o.geometry.dispose();});
    DK.rects=DK.rects.filter(r=>r.tag!=='q');DK.blocks=DK.blocks.filter(b=>!b.q);DK.acts=DK.acts.filter(a=>!a.q);
    DK.spin=DK.spin.filter(s=>!s.q);DK.screens=DK.screens.filter(t=>!t.q);}
  const g=new THREE.Group();sc.add(g);
  const x1=-DK_SPINE.x,x0=x1-R.w,z0=DK_QZ-R.d/2,z1=DK_QZ+R.d/2,h=R.h,trimHex=STAGE_ROOMS[L].trim,trim=new THREE.MeshBasicMaterial({color:trimHex});
  const rug=new THREE.MeshLambertMaterial({color:STAGE_ROOMS[L].floor});
  dkBox(M.floor,x0,-.2,z0,x1,0,z1);dkBox(M.ceil,x0,h,z0,x1,h+.3,z1);
  const ww=Math.min(R.d-3,[3,6,10,16][L]),wy0=[1.3,1.1,1,.8][L],wy1=h-[1.4,1.2,1.2,1.2][L];
  dkWall(M.wall,'z',x0,z0,z1,h,[[DK_QZ-ww/2,DK_QZ+ww/2,wy0,wy1]]);
  dkWall(M.wall,'x',z0,x0,x1,h);dkWall(M.wall,'x',z1,x0,x1,h);
  if(h>DK_SPINE.h)dkBox(M.wall,x1-DK_T/2,DK_SPINE.h,z0,x1+DK_T/2,h,z1);
  dkBox(rug,x0+1,.005,z0+1.2,x1-1.2,.03,z1-1.2);
  for(const z of [z0+.2,z1-.2])dkBox(trim,x0,.06,z-.03,x1,.11,z+.03);
  dkBox(trim,x0+.2,h-.5,z0,x0+.26,h-.44,z1);
  dkFlush(g);
  dkWindow(M,'z',x0,DK_QZ-ww/2,DK_QZ+ww/2,wy0,wy1,L<2?1.5:3,g);
  // furnishings, richer with rank
  const put=(m,a,b,c,d,e,f)=>dkBox(m,a,b,c,d,e,f),blk=(a,b,c,d)=>dkBlock({x0:a,z0:b,x1:c,z1:d,q:true});
  if(L===0){   // racks either side: three bunks high
    for(const z of [z0+.2,z1-2.2]){put(M.bunk,x0+1.5,0,z,x0+5.5,2.6,z+.12);put(M.bunk,x0+1.5,0,z+1.9,x0+5.5,2.6,z+2);
      for(const y of [.4,1.25,2.1]){put(M.dark,x0+1.5,y,z,x0+5.5,y+.15,z+2);put(M.cloth,x0+1.6,y+.15,z+.1,x0+5.4,y+.3,z+1.9);}
      blk(x0+1.4,z,x0+5.6,z+2.1);}
  }else{
    const bw=[0,2,2.4,3][L],bz=z0+.3;
    put(M.dark,x0+1.2,0,bz,x0+1.2+bw+.6,.5,bz+2.4);put(M.cloth,x0+1.3,.5,bz+.1,x0+1.2+bw+.5,.72,bz+2.3);put(M.metal,x0+1.2,0,bz,x0+1.4,1.3,bz+2.4);
    blk(x0+1.1,bz,x0+1.9+bw,bz+2.5);
  }
  // desk with a terminal (saves), a locker (settings), the service record by the door
  const dz=z1-1.2,dx=x1-1.8;
  put(M.dark,dx-1,0,dz-.5,dx+1,.75,dz+.5);put(M.metal,dx-1.05,.75,dz-.55,dx+1.05,.82,dz+.55);
  const tex=holoScreenTex('#'+trimHex.toString(16).padStart(6,'0'));tex.wrapS=THREE.RepeatWrapping;tex.q=true;DK.screens.push(tex);
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.6),new THREE.MeshBasicMaterial({map:tex,color:0xa8c0d0}));scr.position.set(dx,1.25,dz+.3);scr.rotation.y=Math.PI;g.add(scr);
  blk(dx-1.05,dz-.55,dx+1.05,dz+.55);
  const lx=x0+.7,lz=z1-2.2;put(M.metal,lx-.5,0,lz-.6,lx+.5,2.2,lz+.6);put(trim,lx+.5,1,lz-.4,lx+.52,1.6,lz-.36);blk(lx-.55,lz-.65,lx+.55,lz+.65);
  if(L>=2){   // a holo-desk; at Admiral the fleet plot fills the end wall
    const hd=new THREE.Mesh(new THREE.CylinderGeometry(.8,.9,.9,24),M.metal);hd.position.set(x0+R.w*.55,.45,DK_QZ+1.5);g.add(hd);
    const hg=new THREE.Mesh(new THREE.SphereGeometry(.55,14,10),M.holo);hg.position.set(x0+R.w*.55,1.55,DK_QZ+1.5);g.add(hg);DK.spin.push({o:hg,r:.3,q:true});
    dkBlock({x:x0+R.w*.55,z:DK_QZ+1.5,r:1,q:true});
  }
  if(L>=3){const b=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.8),new THREE.MeshBasicMaterial({map:stageBanner()}));b.position.set(x0+.2,3.4,z0+3);b.rotation.y=Math.PI/2;g.add(b);
    const plot=new THREE.Mesh(new THREE.PlaneGeometry(10,4.4),new THREE.MeshBasicMaterial({map:holoScreenTex('#ffc23c'),color:0xc8b890}));plot.position.set(x0+R.w/2,4,z0+.17);g.add(plot);}
  dkFlush(g);
  const rec=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.9),new THREE.MeshBasicMaterial({color:0xc8d4e0}));rec.position.set(x1-.17,1.7,DK_QZ-3.4);rec.rotation.y=-Math.PI/2;g.add(rec);
  const Q=DK.Q={g,L,rec,x0,x1,z0,z1};dkRecordDraw();
  dkRect(x0+.2,z0+.2,x1,z1-.2,'quarters','q');
  DK.acts.push({x:dx,z:dz,r:1.05,q:true,room:'quarters',name:'Saves',sub:'Save, load or start over',go:()=>openSaves('deck')},
    {x:lx,z:lz,r:.65,q:true,room:'quarters',name:'Settings',sub:'Controls, sound, graphics',go:()=>openSettings('deck')},
    {x:x1-.3,z:DK_QZ-3.4,r:.3,q:true,room:'quarters',name:'Service record',sub:'Campaign log',go:()=>{openCommand();selectStation('log');}});
  DK.qLight.position.set(x0+R.w/2,h-.6,DK_QZ);DK.qLight.distance=Math.max(R.w,R.d)*1.4;
  DK.qL=L;
}
/* the service record by the quarters door: your rank and what it gave you */
function dkRecordDraw(){
  const Q=DK.Q,R=RANKS[rankLevel()],old=Q.rec.material.map,cleared=MISSIONS.filter(m=>PROG.completed[m.id]).length;
  Q.rec.material.map=dkTextTex([[R.abbr+' · '+R.name.toUpperCase(),44],[cleared+' / '+MISSIONS.length+' ops cleared',30],[PROG.credits.toLocaleString()+' cr · '+PROG.parts+' parts',26]],'#ffb300',512,288);
  Q.rec.material.needsUpdate=true;if(old)old.dispose();
}
/* the fleet out the windows: SOLACE from Commander, two more destroyers at Admiral */
function dkFleet(){
  const want=rankLevel()>=3?3:rankLevel()>=2?1:0;
  while(DK.fleet.length<want){const i=DK.fleet.length,e=capNew('escort',ESCORT_TYPE,true,'escort');
    e.g.position.set([-320,420,-760][i],[-60,10,40][i],[-900,-1500,-1900][i]);e.g.scale.setScalar(i?.8:1);DK.scene.add(e.g);DK.fleet.push(e);}
  DK.fleet.forEach((e,i)=>e.g.visible=i<want);
}
/* named crew at their posts (js/data/deck.js) */
function dkCrew(M){
  for(const C of DECK_CREW){
    const who=CAST[C.who]||{name:C.name,col:C.col},col=parseInt(who.col.slice(1),16);
    const P=dkPerson(M,Object.assign({trim:col},C.look));P.g.position.set(C.x,0,C.z);P.g.rotation.y=C.yaw;DK.scene.add(P.g);
    const tag=dkTag(who.name,who.col);P.g.add(tag);
    const c={P,C,who,tag,ph:Math.random()*6,n:0};DK.crew.push(c);
    dkBlock({x:C.x,z:C.z,r:.45});
    DK.acts.push({x:C.x,z:C.z,r:.45,room:C.room,name:'Talk',sub:who.name,go:()=>dkTalk(c)});
  }
}

/* ---- open, place, move ---- */
function openDeck(at){
  const landed=!$('debrief').classList.contains('hidden');   // straight off a sortie: you climb out in the hangar
  S.mode='menu';if(!DK)dkBuild();
  for(const o of [ccIntro,ccAcademy,ccPromo])deck.appendChild(o);   // the command center's first-visit and promotion cards show over the deck too
  showScreen('deck');
  for(const k in S.keys)S.keys[k]=false;
  dkPad(false);
  if(at||landed||!DK.placed)dkPlace(at||(landed?'hangar':'bridge'));
  DK.heard={};DK.barkT=0;dkBark.classList.remove('on');
  if(DK.qL!==ccQuartersLevel())dkQuarters(ccQuartersLevel());
  dkHulls();dkFleet();dkBoardDraw();dkRecordDraw();
  ccIntroShow();ccAcademyShow();ccPromoShow();
}
/* the command center takes its cards back when it opens */
function dkCardsHome(){for(const o of [ccIntro,ccAcademy,ccPromo])if(o.parentNode!==command)command.appendChild(o);}
function dkPlace(id){
  const R=DECK_ROOMS.find(r=>r.id===id)||DECK_ROOMS[0];
  DK.x=R.x;DK.z=R.z;DK.yaw=DK.face=R.yaw;DK.pitch=-.18;DK.vx=DK.vz=0;DK.placed=true;DK.room=null;
}
/* fast travel: a short fade, and you are there */
function dkTravel(id){if(!DK||DK.fadeT>0)return;dkPad(false);DK.fadeT=DECK.fade*2;DK.fadeTo=id;dkFade.style.opacity=1;}
function dkFree(x,z){
  const r=DECK.radius;let ok=false;
  for(const R of DK.rects)if(x>R.x0+r&&x<R.x1-r&&z>R.z0+r&&z<R.z1-r){ok=true;break;}
  if(!ok)return false;
  for(const b of DK.blocks){
    if(b.r!==undefined){const dx=x-b.x,dz=z-b.z,rr=b.r+r;if(dx*dx+dz*dz<rr*rr)return false;}
    else if(x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r)return false;
  }
  return true;
}
const dkRoomAt=(x,z)=>{for(const R of DK.rects)if(R.room&&x>R.x0&&x<R.x1&&z>R.z0&&z<R.z1)return R.room;return null;};
const DK_ROOM_H={spine:DK_SPINE.h,bridge:DK_BRIDGE.h,hangar:DK_HANGAR.h,sim:DK_SIM.h};
const DK_ROOM_NAME={spine:'Main spine',bridge:'Bridge',hangar:'Hangar bay 1',sim:'Sim deck',quarters:'Quarters'};
function dkTick(dt){
  const D=DK,K=S.keys;D.t+=dt;
  if(D.fadeT>0){const was=D.fadeT;D.fadeT-=dt;
    if(was>DECK.fade&&D.fadeT<=DECK.fade){dkPlace(D.fadeTo);dkFade.style.opacity=0;}
    if(D.fadeT<=0)D.fadeT=0;}
  // walking: WASD or the arrows, Shift to run, eased so it starts and stops softly
  let fx=0,fz=0;
  if(!dkBusy()){
    const f=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0),s=(K.KeyD||K.ArrowRight?1:0)-(K.KeyA||K.ArrowLeft?1:0);
    const sy=Math.sin(D.yaw),cy=Math.cos(D.yaw);
    fx=-sy*f+cy*s;fz=-cy*f-sy*s;const l=Math.hypot(fx,fz);
    if(l>0){const v=(K.ShiftLeft||K.ShiftRight?DECK.run:DECK.walk)/l;fx*=v;fz*=v;}
  }
  const k=Math.min(1,dt*DECK.accel);D.vx+=(fx-D.vx)*k;D.vz+=(fz-D.vz)*k;
  const nx=D.x+D.vx*dt,nz=D.z+D.vz*dt;
  if(dkFree(nx,D.z))D.x=nx;else D.vx=0;
  if(dkFree(D.x,nz))D.z=nz;else D.vz=0;
  // you: turn toward where you are going, stride with the speed
  const sp=Math.hypot(D.vx,D.vz),me=D.me;
  if(sp>.3){const want=Math.atan2(-D.vx,-D.vz);let d=want-D.face;d=Math.atan2(Math.sin(d),Math.cos(d));D.face+=d*Math.min(1,dt*10);}
  me.g.position.set(D.x,0,D.z);me.g.rotation.y=D.face;dkStride(me,dt,sp/DECK.walk);
  dkCamera(dt);
  const cam=D.cam;
  cam.fov=72+SETTINGS.fov;cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();
  // where you are
  const room=dkRoomAt(D.x,D.z);
  if(room&&room!==D.room){D.room=room;dkLoc.textContent='HALCYON · '+DK_ROOM_NAME[room];}
  // doors part as you come near; screens scroll; holograms turn; the pods breathe; the field shimmers
  for(const d of D.doors){const n=Math.hypot(D.x-d.x,D.z-d.z)<DECK.doorR?1:0;if(d.k!==n){d.k+=Math.sign(n-d.k)*Math.min(Math.abs(n-d.k),dt*4);dkDoorPose(d);}}
  for(const t of D.screens)t.offset.x=(t.offset.x+dt*.05)%1;
  for(const s of D.spin)s.o.rotation.y+=s.r*dt;
  D.pods.forEach(({P,glow},i)=>{glow.material.color.setHex(P.open()?0x3cf08a:0xff3a4a);glow.material.opacity=1;glow.scale.setScalar(1+Math.sin(D.t*2+i)*.01);});
  D.field.material.opacity=.06+Math.sin(D.t*1.3)*.02;
  if(D.dust){D.dust.position.y=Math.sin(D.t*.11)*.6;D.dust.rotation.y=D.t*.006;}
  for(const e of D.fleet)e.g.position.y+=Math.sin(D.t*.3+e.g.position.x)*dt*.4;
  for(const H of D.hulls)H.strobes.forEach((s,i)=>{s.visible=((D.t*1.1+i*.15)%1)<.08;});
  // crew: shift their weight; the named ones look at you when you are close, say a line once a visit, and show their name
  for(const c of D.crew){
    c.P.g.rotation.z=Math.sin(D.t*.7+c.ph)*.012;
    if(c.work){c.P.arms[1].rotation.x=-1.2+Math.sin(D.t*2.4+c.ph)*.35;c.P.arms[0].rotation.x=-.5+Math.sin(D.t*1.7+c.ph)*.2;c.P.body.rotation.x=.18;}
    if(!c.C)continue;
    const dx=D.x-c.C.x,dz=D.z-c.C.z,d=Math.hypot(dx,dz);
    let want=0;if(d<6){want=Math.atan2(-dx,-dz)-c.C.yaw;want=Math.atan2(Math.sin(want),Math.cos(want));want=Math.max(-1.1,Math.min(1.1,want));}
    c.P.head.rotation.y+=(want-c.P.head.rotation.y)*Math.min(1,dt*4);
    c.tag.visible=d<9;
    dkStride(c.P,dt,0);
    if(c.talkT>0){c.talkT-=dt;const k=Math.min(1,c.talkT*2);c.P.arms[0].rotation.x=(-.45+Math.sin(D.t*4.2)*.22)*k;c.P.head.rotation.x=Math.sin(D.t*3.1)*.06*k;}   // they gesture while they talk
    if(d<DECK.barkR&&!D.heard[c.C.id]&&D.barkT<=0&&!dkBusy()){D.heard[c.C.id]=true;dkTalk(c);}
  }
  if(D.barkT>0){D.barkT-=dt;if(D.barkT<=0)dkBark.classList.remove('on');}
  // what you are looking at, within reach
  let best=null,bd=1e9;
  if(!dkBusy()){const lx=-Math.sin(D.yaw),lz=-Math.cos(D.yaw);
    for(const a of D.acts){const dx=a.x-D.x,dz=a.z-D.z,c=Math.hypot(dx,dz),d=c-a.r;
      if(d>DECK.reach)continue;const dot=c>.01?(dx*lx+dz*lz)/c:1;
      if(dot<(d<.8?.2:.6))continue;const score=d-dot*1.2;if(score<bd){bd=score;best=a;}}}
  if(best!==D.focus){D.focus=best;
    if(best){dkPrompt.innerHTML='<kbd>E</kbd><b>'+best.name+'</b><span>'+best.sub+'</span>';dkPrompt.classList.add('on');}
    else dkPrompt.classList.remove('on');}
  else if(best)dkPrompt.querySelector('span').textContent=best.sub;
  dkLook.classList.toggle('on',!dkBusy()&&document.pointerLockElement!==renderer.domElement);
  if(D.qL!==ccQuartersLevel())dkQuarters(ccQuartersLevel());   // a promotion acknowledged while you are aboard
}
/* the third-person camera: on a boom behind your shoulder, on the mouse's yaw and pitch. The boom shortens rather than
   pass through a wall or a ceiling (the walkable rectangles and their room heights stand in for the walls). */
const dkBoomV=new THREE.Vector3(),dkAimV=new THREE.Vector3();
function dkCamOk(x,y,z){
  const m=.4;
  for(const R of DK.rects)if(x>R.x0+m&&x<R.x1-m&&z>R.z0+m&&z<R.z1-m&&y<dkRoomH(R)-.25)return true;
  return false;
}
const dkRoomH=R=>R.room==='quarters'?DK_QUARTERS[DK.qL].h:R.room?DK_ROOM_H[R.room]:3.2;   // a doorway is a door high
function dkCamera(dt){
  const D=DK,cp=Math.cos(D.pitch),sy=Math.sin(D.yaw),cy=Math.cos(D.yaw);
  dkAimV.set(D.x+cy*.42,1.55,D.z-sy*.42);   // the point over your right shoulder the camera looks past
  dkBoomV.set(sy*cp,-Math.sin(D.pitch),cy*cp);   // from the aim point back toward the camera
  let L=.4;while(L<D.dist&&dkCamOk(dkAimV.x+dkBoomV.x*(L+.1),dkAimV.y+dkBoomV.y*(L+.1),dkAimV.z+dkBoomV.z*(L+.1)))L+=.1;
  D.boom=D.boom===undefined||D.boom>L?L:D.boom+(L-D.boom)*Math.min(1,dt*5);   // snap in at once, ease back out
  const cam=D.cam;cam.position.copy(dkAimV).addScaledVector(dkBoomV,D.boom);
  cam.rotation.set(D.pitch,D.yaw,0,'YXZ');
  D.me.g.visible=D.boom>.75;   // pressed right up against a wall, the camera would be inside your head
}
/* draws the deck instead of the menu backdrop while it is up (or while Settings is open over it) */
function renderDeck(dt){
  if(!DK||S.mode!=='menu'||!(deckOn()||settingsOpen()&&settingsFrom==='deck'))return false;
  dkTick(dt);
  if(bloomOn()){const rp=composer.passes[0],s0=rp.scene,c0=rp.camera;
    rp.scene=DK.scene;rp.camera=DK.cam;composer.render();rp.scene=s0;rp.camera=c0;}
  else renderer.render(DK.scene,DK.cam);
  return true;
}

/* ---- talking, using things, the datapad ---- */
function dkSay(id,line){
  const c=DK.crew.find(x=>x.C&&x.C.id===id),who=c?c.who:{name:'',col:'#fff'};
  dkBark.innerHTML='<b style="color:'+who.col+'">'+who.name+'</b>'+line;dkBark.classList.add('on');DK.barkT=DECK.barkT;
}
function dkTalk(c){const L=c.C.lines();dkSay(c.C.id,L[c.n%L.length]);c.n++;c.talkT=DECK.barkT;}
function dkUse(){const a=DK.focus;if(!a||dkBusy())return;if(!a.name.startsWith('Talk'))sfx('lock');a.go();
  if(!deckOn()&&S.mode!=='play')document.exitPointerLock&&document.exitPointerLock();}   // off to a screen: free the mouse for it
/* the next op, as the command center's Next op button does it */
function dkNextOp(){const nm=nextMission();sfx('lock');if(sectorChoice())openSector();else if(nm)openBriefing(nm,'command');else openMissions();}
/* the datapad's hub screens, in groups; `open` false shows the entry locked with `lock` as the reason */
const DK_PAD=[
  {name:'Operations',items:[
    {name:'Sortie board',sub:'Every op and its briefing',chip:'ops',go:openMissions},
    {name:'Sector map',sub:'Strike targets, fleet damage',chip:'map',open:()=>sectorOpen(),lock:'Opens after Broadside',go:openSector}]},
  {name:'Fleet and ship',items:[
    {name:'Fleet',get sub(){return sectorOpen()?'Ships, pilots, upgrades':'Wing and upgrades';},chip:'fleet',go:()=>{openCommand();selectStation('fleet');}},
    {name:'Hangar',sub:'Hulls and refits',chip:'hangar',go:()=>openHangar('deck')}]},
  {name:'Training',items:[
    {name:'Flight school',sub:'Lessons and graded drills',go:()=>openSchool('deck')},
    {name:'Skirmish',sub:'Fleet battle vs AI',open:()=>skirmishOpen(),lock:'Opens after Broadside',go:openSkirmish}]},
  {name:'Pilot',left:true,items:[
    {name:'Campaign log',sub:'Ops record and bonuses',chip:'log',go:()=>{openCommand();selectStation('log');}},
    {name:'Saves',sub:'Save, load, new game',go:()=>openSaves('deck')},
    {name:'Settings',sub:'Controls, sound, display',go:()=>openSettings('deck')}]},
];
function dkPad(on){
  if(!DK)return;DK.pad=on;dkPadBox.classList.toggle('hidden',!on);
  if(!on)return;
  document.exitPointerLock&&document.exitPointerLock();
  const nm=nextMission(),R=RANKS[rankLevel()],L=sectorChoice();
  dkPadId.innerHTML=R.abbr+' · '+R.name+'<span>'+PROG.credits.toLocaleString()+' cr · ◆ '+PROG.parts+' parts · flying '+curShip.name+'</span>';
  dkPadNextTag.textContent=L?'Before the next op':nm?'Next op':'All ops clear';
  dkPadNextName.textContent=L?'Sector map':nm?nm.name:'Sortie board';
  dkPadNextObj.textContent=L?'Pick a target for '+L.name+', or skip it':nm?nm.objective:'Replay any op for a better score';
  dkPadGroups.innerHTML=dkPadGroupsL.innerHTML='';
  for(const G of DK_PAD){
    const box=document.createElement('div');box.className='dkgrp';box.innerHTML='<div class="dkpadh">'+G.name+'</div>';
    for(const A of G.items){const open=!A.open||A.open(),b=document.createElement('button');b.className='dkbtn'+(open?'':' locked');b.disabled=!open;
      b.innerHTML='<div><b>'+A.name+'</b><span>'+(open?A.sub:A.lock)+'</span></div>'+(open&&A.chip?ccChip(A.chip):open?'':'<span class="chip">Locked</span>');
      b.onclick=()=>{dkPad(false);A.go();};box.appendChild(b);}
    (G.left?dkPadGroupsL:dkPadGroups).appendChild(box);
  }
  dkMapDraw();syncFullscreenUI();
}
/* the deck map: HALCYON from above, bow to the left, the rooms you can fast travel to, and you */
function dkMapDraw(){
  const Q=DK_QUARTERS[DK.qL]||DK_QUARTERS[0],X=z=>(z+106).toFixed(1),Y=x=>(52-x).toFixed(1);
  const rect=(x0,x1,z0,z1)=>'x="'+X(z0)+'" y="'+Y(x1)+'" width="'+(z1-z0)+'" height="'+(x1-x0)+'"';
  const rooms={bridge:[-DK_BRIDGE.x,DK_BRIDGE.x,DK_BRIDGE.z0,DK_BRIDGE.z1],hangar:[-DK_HANGAR.x,DK_HANGAR.x,DK_HANGAR.z0,DK_HANGAR.z1],
    sim:[DK_SIM.x0,DK_SIM.x1,DK_SIM.z0,DK_SIM.z1],quarters:[-DK_SPINE.x-Q.w,-DK_SPINE.x,DK_QZ-Q.d/2,DK_QZ+Q.d/2]};
  let svg='<svg viewBox="0 0 250 106" role="img" aria-label="Deck map"><path class="hull" d="M2 53 L'+X(-100)+' 26 L'+X(40)+' 2 L'+X(136)+' 2 L'+X(136)+' 104 L'+X(40)+' 104 L'+X(-100)+' 80 Z"/>'
    +'<rect class="spine" '+rect(-DK_SPINE.x,DK_SPINE.x,DK_SPINE.z0,DK_SPINE.z1)+'/>';
  DECK_ROOMS.forEach((R,i)=>{const [x0,x1,z0,z1]=rooms[R.id],cx=X((z0+z1)/2),small=x1-x0<30,   // small rooms are labelled beside the box
      ty=small?(x0>0?+Y(x1)-3:+Y(x0)+7):+Y((x0+x1)/2)-1,ky=small?+Y((x0+x1)/2)+2:ty+8;
    svg+='<g class="dkroom'+(DK.room===R.id?' here':'')+'" data-room="'+R.id+'" tabindex="0"><rect '+rect(x0,x1,z0,z1)+' rx="2"/>'
      +'<text x="'+cx+'" y="'+ty+'">'+R.name.toUpperCase()+'</text><text class="k" x="'+cx+'" y="'+ky+'">'+(i+1)+'</text></g>';});
  const a=DK.face;
  svg+='<g class="you" transform="translate('+X(DK.z)+' '+Y(DK.x)+') rotate('+(180-a*180/Math.PI).toFixed(0)+')"><circle r="3.2"/><path d="M5 0 L-1.5 -2.6 L-1.5 2.6 Z"/></g></svg>';
  dkPadMap.innerHTML=svg;
  dkPadMap.querySelectorAll('.dkroom').forEach(g=>{g.onclick=()=>dkTravel(g.dataset.room);g.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();dkTravel(g.dataset.room);}};});
}
dkPadNext.onclick=()=>{dkPad(false);dkNextOp();};
dkPadMenu.onclick=()=>{dkPad(false);openCommand();};
dkPadTitle.onclick=()=>{dkPad(false);S.mode='menu';showScreen('menu');};
dkFsBtn.onclick=toggleFullscreen;
dkPadClose.onclick=()=>{dkPad(false);dkLockMouse();};
function dkLockMouse(){if(!isTouch&&deckOn()&&!dkBusy())renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();}
/* keys on the deck (input.js asks first): Tab or Esc for the datapad, E to use, 1-4 to fast travel from the datapad */
function deckKey(e){
  if(!deckOn())return false;
  const c=e.code;
  if(dkOverlayUp())return false;
  if(c==='Tab'||c==='Escape'){if(!e.repeat){if(DK.pad){dkPad(false);dkLockMouse();}else dkPad(true);}return true;}
  if(DK.pad){
    const n=/^Digit([1-9])$/.exec(c);if(n&&DECK_ROOMS[n[1]-1]){dkTravel(DECK_ROOMS[n[1]-1].id);return true;}
    if(c==='Enter'){dkPad(false);dkNextOp();return true;}
    return false;
  }
  if((c==='KeyE'||c==='KeyF'||c==='Enter')&&!e.repeat){dkUse();return true;}
  return false;
}
addEventListener('mousemove',e=>{
  if(!deckOn()||dkBusy())return;
  if(document.pointerLockElement!==renderer.domElement&&!DK.drag)return;
  const k=.0022*SETTINGS.sens;
  DK.yaw-=e.movementX*k;DK.pitch=Math.max(-.9,Math.min(.45,DK.pitch-e.movementY*k*(SETTINGS.invertY?-1:1)));
});
renderer.domElement.addEventListener('mousedown',e=>{
  if(!deckOn()||dkBusy())return;
  if(document.pointerLockElement===renderer.domElement){if(e.button===0)dkUse();return;}
  DK.drag=true;dkLockMouse();   // the click captures the mouse; until it does (or if it is refused), dragging looks around
});
addEventListener('mouseup',()=>{if(DK)DK.drag=false;});
addEventListener('wheel',e=>{if(deckOn()&&!dkBusy())DK.dist=Math.max(1.8,Math.min(7,DK.dist*(e.deltaY>0?1.12:.9)));},{passive:true});   // the wheel pulls the camera in or out
/* letting go of the mouse while walking (Esc in the browser, alt-tab) brings up the datapad, like a pause */
document.addEventListener('pointerlockchange',()=>{if(deckOn()&&!dkBusy()&&document.pointerLockElement!==renderer.domElement)dkPad(true);});
