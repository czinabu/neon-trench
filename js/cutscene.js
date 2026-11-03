"use strict";
/* Story cutscenes: short letterboxed scenes in their own 3D scene, with subtitles from the cast, at the campaign's turning
   points. The text and timing are in js/data/cutscenes.js; CUT_BUILD below builds each scene from the game's own models
   (your hull and the wing from js/stage.js, capital ships from js/capital.js, fighters from js/enemies.js) and moves
   everything as a pure function of the scene's clock, so a scene can start, skip or replay from any moment.
   cutPlay(id,then) starts one and calls `then` when it ends or is skipped; renderCut() draws it in place of the game or
   the menus while it runs. The run state is left as it was: a scene after an op plays with S.mode still 'win'. */
const cutScene=new THREE.Scene();
const cutCam=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.5,14000);
cutScene.fog=new THREE.FogExp2(0x04050d,.00002);
let CUT=null;   // the playing scene: {def,set,t,then,line,padHeld}
const CUT_SETS={}, CUT_BUILD={};
{ // fixed lights: the game's own, so the capitals look as they do in a fight, plus a soft rim
  cutScene.add(new THREE.AmbientLight(0x33405f,.9));
  cutScene.add(new THREE.HemisphereLight(0x2c4a6e,0x0c0a14,.4));
  const key=new THREE.DirectionalLight(0x9fc4ff,.7);key.position.set(.3,1,.4);cutScene.add(key);
  const rim=new THREE.DirectionalLight(0xff2d78,.35);rim.position.set(-4,1,-3);cutScene.add(rim);
}
cutScene.add(stageStars(3000,9000));

/* ---- timing and camera helpers ---- */
const cutEase=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const cutSeg=(t,a,b)=>cutEase((t-a)/(b-a));
const cutV1=new THREE.Vector3(),cutV2=new THREE.Vector3(),cutV3=new THREE.Vector3();
/* camera from p0 to p1 looking from l0 to l1 over [a,b] */
function cutShot(t,a,b,p0,p1,l0,l1,fov){
  const k=cutSeg(t,a,b);
  cutCam.position.set(p0[0]+(p1[0]-p0[0])*k,p0[1]+(p1[1]-p0[1])*k,p0[2]+(p1[2]-p0[2])*k);
  cutCam.lookAt(l0[0]+(l1[0]-l0[0])*k,l0[1]+(l1[1]-l0[1])*k,l0[2]+(l1[2]-l0[2])*k);
  cutFov(fov);
}
function cutFov(f){if(cutCam.fov!==f){cutCam.fov=f;cutCam.updateProjectionMatrix();}}
/* point obj's nose (-z) from p toward q, banked by `bank` radians */
function cutFace(obj,p,q,bank){
  obj.position.copy(p);cutV3.copy(p).multiplyScalar(2).sub(q);obj.lookAt(cutV3);obj.rotateZ(bank||0);
}
/* a fighter flying path(t): placed at t, facing where it is at t+.05 */
function cutFly(obj,path,t,bank){path(t,cutV1);path(t+.05,cutV2);cutFace(obj,cutV1,cutV2,bank);}
/* one of your hulls (js/stage.js), sized to about `size` metres across, in a holder group */
function cutHull(g,id,slot,size){
  const holder=new THREE.Group();g.add(holder);
  const h=stageHull(shipById(id)?id:'s1','cut-'+slot);
  h.pivot.scale.setScalar((size||7)/h.radius);holder.add(h.pivot);
  holder.userData.hull=h;return holder;
}
function cutEnemy(g,kind,leader,scale){
  enemyMats();const e=new THREE.Group();ENEMY_BUILD[kind](e,leader);e.scale.setScalar(scale||1.5);g.add(e);return e;
}
/* a capital ship from js/capital.js, out of play: no shield bubble, nose (-z) turned by yaw */
function cutCap(g,kind,T,friendly,pal,x,y,z,yaw,scale){
  const C=capNew(kind,T,friendly,pal);
  if(C.shield)C.shield.visible=false;
  C.g.position.set(x,y,z);C.g.rotation.y=yaw||0;if(scale)C.g.scale.setScalar(scale);
  C.home=C.g.position.clone();C.base=C.g.scale.clone();g.add(C.g);return C;
}
/* a capital dropping out of the jump: it slides in along its nose, stretched, and lands at home at time `at` */
function cutWarp(C,t,at){
  const k=cutSeg(t,at-1.1,at),fwd=cutV1.set(0,0,-1).applyQuaternion(C.g.quaternion);
  C.g.visible=t>=at-1.1;
  C.g.position.copy(C.home).addScaledVector(fwd,-(1-k)*1600);
  C.g.scale.set(C.base.x,C.base.y,C.base.z*(1+(1-k)*5));
}
/* fireballs: [t0, x,y,z, colour, size, seconds]; each a glow sprite that swells and fades on its own clock */
function cutBooms(g,list){
  const S0=list.map(([t0,x,y,z,col,size,dur])=>{
    const s=stageGlow(col,1,0);s.position.set(x,y,z);s.userData={t0,size,dur:dur||1.2};s.visible=false;g.add(s);return s;});
  const tick=(t)=>{for(const s of S0){const u=s.userData,k=(t-u.t0)/u.dur;
    s.visible=k>=0&&k<=1;if(!s.visible)continue;
    s.scale.setScalar(u.size*(.35+k*.9));s.material.opacity=Math.pow(1-k,1.4);}};
  tick.sprites=S0;return tick;
}
/* booms scattered over a capital's hull, in its local frame (hull box, see C.hull), from t0 to t1, getting closer together */
function cutHullBooms(C,n,t0,t1,seed,col){
  const r=capRng(seed),H=C.hull,out=[],s=C.g.scale.x;
  for(let i=0;i<n;i++){const u=Math.pow(i/n,.7);
    cutV1.set((r()-.5)*H.w*.9,(r()-.3)*H.h,H.z0+r()*(H.z1-H.z0)).multiplyScalar(s).applyQuaternion(C.g.quaternion).add(C.g.position);
    out.push([t0+u*(t1-t0),cutV1.x,cutV1.y,cutV1.z,col||(r()<.5?0xffb060:0xff5a2a),(18+r()*30)*s,.9+r()*.6]);}
  return out;
}
/* laser bolts: [t0, from(t), to(t), material]; each flies for .22 s from where the shooter was to where the target was */
function cutBolts(g,list){
  const geo=sharedGeo('cutBolt',()=>new THREE.BoxGeometry(.3,.3,7));
  const B=list.map(([t0,from,to,mat])=>{const m=new THREE.Mesh(geo,mat);m.visible=false;m.userData={t0,from,to};g.add(m);return m;});
  const a=new THREE.Vector3(),b=new THREE.Vector3();
  return (t)=>{for(const m of B){const u=m.userData,k=(t-u.t0)/.22;m.visible=k>=0&&k<=1;if(!m.visible)continue;
    u.from(u.t0,a);u.to(u.t0+.22,b);m.position.lerpVectors(a,b,k);m.lookAt(b);}};
}
/* the capital's light materials dimmed (k 0) or lit (k 1) */
function cutCapLights(C,k){
  const P=C.mats.P;
  C.mats.neon.color.setHex(P.neon).multiplyScalar(k);C.mats.window.color.setHex(P.window).multiplyScalar(k);
  C.mats.eye.color.setHex(P.eye).multiplyScalar(k);C.mats.eng.opacity=.95*k;
}
/* a capital breaking in two from time t0: the halves part, tumble and darken */
function cutBreak(C,t,t0){
  const k=Math.max(0,t-t0);
  C.fore.position.set(0,-k*3,-k*14);C.fore.rotation.set(-k*.06,k*.015,k*.03);
  C.aft.position.set(0,k*2.5,k*10);C.aft.rotation.set(k*.05,-k*.012,-k*.025);
  if(k>0)cutCapLights(C,Math.max(.12,1-k*.5)*(.8+.2*Math.sin(t*23)));
}
const cutSpace=(g,warm)=>{
  g.add(stageNebula('255,45,120',-1600,500,-5200,5200,.5),stageNebula(warm?'255,150,60':'0,140,255',1500,800,-5600,4800,.45));
  const sun=stageGlow(0xffd9a0,1300,.55);sun.position.set(-4200,1800,-7200);g.add(sun);
  const core=stageGlow(0xffffff,220,.9);core.position.copy(sun.position);g.add(core);
  return sun;
};

/* ---- Prologue: HALCYON sits dark over the planet, and a lone fighter brings the new Flight Officer into the bay ---- */
CUT_BUILD.arrival=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x04050d};
  cutSpace(g);
  const planet=stagePlanet(1500);planet.position.set(1300,-2100,-4800);planet.rotation.set(-1.1,0,.2);g.add(planet);
  const K=cutCap(g,'carrier',fleetCarrierType(),true,null,0,0,0,0);
  const me=cutHull(g,'s1','me',8);
  // in from the far side toward the bay mouth (the way your hull leaves it in Cold start), slowing as it nears
  const A=[260,70,-1500],B=[0,2,-70];
  const path=(t,o)=>{const k=cutEase(Math.min(1,t/19)),j=1-k;
    return o.set(A[0]*j+B[0]*k,A[1]*j+B[1]*k,A[2]*j+B[2]*k+Math.max(0,t-19)*6);};
  set.tick=(dt,t)=>{
    planet.rotation.y=t*.006;
    cutCapLights(K,.35+.1*Math.sin(t*1.7));   // running lights only: the deck is still dark
    cutFly(me,path,t,Math.sin(t*.4)*.12);stageEngines(me.userData.hull,t,t<15?1.6:.7);
    if(t<7.5)cutShot(t,0,7.5,[-900,260,-200],[-640,170,-360],[0,0,-100],[0,0,-60],38);   // the carrier, dark against the planet
    else if(t<15){path(t,cutV2);cutCam.position.set(cutV2.x-30,cutV2.y+12,cutV2.z-60);cutCam.lookAt(0,0,-40);cutFov(44);}   // over the fighter's shoulder at HALCYON
    else{path(t,cutV2);cutCam.position.set(40,22,-150);cutCam.lookAt(cutV2);cutFov(40);}   // from the bay mouth as it comes in
  };
  return set;
};

/* ---- Act I opens: HALCYON lights up after six weeks dark, and your hull leaves the bay ---- */
CUT_BUILD.coldstart=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x04050d};
  cutSpace(g);
  const planet=stagePlanet(1500);planet.position.set(1300,-2100,-4800);planet.rotation.set(-1.1,0,.2);g.add(planet);
  const K=cutCap(g,'carrier',fleetCarrierType(),true,null,0,0,0,0);
  const me=cutHull(g,PROG.ship,'me',8);
  const out=(t,o)=>{const u=Math.max(0,t-7.4);o.set(Math.max(0,t-11)*Math.max(0,t-11)*2.2,2+u*u*.15,-60-u*u*20);return o;};   // out of the bay, then a lazy bank toward the planet
  set.tick=(dt,t)=>{
    planet.rotation.y=t*.006;
    const lit=cutSeg(t,.8,5.5)*(t<5.5?.75+.25*Math.sin(t*31)*Math.sin(t*7):1);   // the deck flickers as it comes up
    cutCapLights(K,lit);
    cutFly(me,out,t,-Math.min(.5,Math.max(0,t-11)*.12));stageEngines(me.userData.hull,t,t>7.4?2.4:.6);
    if(t<6.2)cutShot(t,0,6.2,[-520,130,-480],[-380,90,-330],[0,0,0],[0,0,-20],40);
    else if(t<11.2){me.getWorldPosition(cutV2);cutCam.position.set(26,10,-190);cutCam.lookAt(cutV2);cutFov(42);}   // the hull leaves the bay and passes the camera
    else{out(t,cutV2);const back=24+cutSeg(t,15,19)*40;
      cutCam.position.set(cutV2.x-8,cutV2.y+6,cutV2.z+back);cutCam.lookAt(cutV2.x+10,cutV2.y-12,cutV2.z-80);cutFov(48);}
  };
  return set;
};

/* ---- after Ace Duel: Kestrel breaks off trailing smoke and jumps, and Pike and Lark form up on you ---- */
CUT_BUILD.kestrel=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x04040c};
  cutSpace(g,true);
  const kes=cutEnemy(g,'ace',true,1.7),me=cutHull(g,PROG.ship,'me',8);
  const pike=cutHull(g,'s2','pike',8),lark=cutHull(g,'s3','lark',8);
  const K=(t,o)=>{const j=Math.max(0,t-7.2);return o.set(Math.sin(t*.8)*14+j*j*6,Math.sin(t*1.1)*5+3,-70*t-j*j*j*120);};   // weaving, then the jump
  const P=(t,o)=>{const d=Math.min(t,7.2),c=1-cutSeg(t,7.2,9.4);o.set(Math.sin(d*.8-.4)*12*c,Math.sin(d*1.1-.5)*4*c,-70*t+34);return o;};   // eases onto the formation's line once Kestrel is gone
  const smoke=[];for(let i=0;i<60;i++){const s=stageGlow(i%4?0x8a8f9c:0xff7a2a,1,0);g.add(s);smoke.push(s);}
  const bolts=[];
  for(let t=1;t<4.2;t+=(t%1.4)<.7?.11:.4)bolts.push([t,(u,o)=>P(u,o).add(cutV3.set(0,0,-4)),(u,o)=>K(u-.05,o),M.boltP]);
  const tickBolts=cutBolts(g,bolts);
  const tickBooms=cutBooms(g,[[2.2,0,0,0,0xffb060,10,.4],[3.4,0,0,0,0xffb060,12,.4],[8.1,0,0,0,0xffffff,90,.7]]);
  const flashes=tickBooms.sprites;
  const hold=new THREE.Vector3();
  set.tick=(dt,t)=>{
    cutFly(kes,K,t,Math.sin(t*.8)*.5+(t>7?(t-7)*2:0));kes.visible=t<8.1;
    if(t<8.1)kes.scale.set(1.7,1.7,1.7*(1+Math.max(0,t-7.6)*8));
    cutFly(me,P,t,Math.sin(t*.8)*.4);stageEngines(me.userData.hull,t,2);
    for(let i=0;i<smoke.length;i++){const u=t-i*.025;K(u,cutV1);const s=smoke[i];
      s.visible=u>0&&t<7.4;s.position.copy(cutV1).add(cutV2.set(.5+Math.sin(i*2.7)*.4,.4+Math.cos(i*1.9)*.3,2.5));s.scale.setScalar(1.2+i*.12);s.material.opacity=.3*(1-i/smoke.length);}
    tickBolts(t);
    for(const [i,tt] of [[0,2.2],[1,3.4]]){K(tt,flashes[i].position);}
    K(8.1,flashes[2].position);tickBooms(t);
    // the wing joins: slides in to each side, all three flying on together
    const z=-70*t+34,ok=t>9;
    const form=(h,side,t0)=>{const k=cutSeg(t,t0,t0+2.6);h.visible=ok;
      h.position.set(side*(16+(1-k)*40),(1-k)*18-1,z+8+(1-k)*30);h.rotation.set(0,0,-side*(1-k)*.6);stageEngines(h.userData.hull,t+side,2);};
    form(pike,-1,9.4);form(lark,1,13.4);
    if(t<5){P(t,hold);K(t,cutV2);cutCam.position.set(hold.x-34,hold.y+7,hold.z+10);cutCam.lookAt(cutV2.add(hold).multiplyScalar(.5));cutFov(46);}   // alongside the chase
    else if(t<9.4){P(t,hold);cutCam.position.set(hold.x+5,hold.y+8,hold.z+34);cutCam.lookAt(hold.x,hold.y+3,hold.z-60);cutFov(44);}   // over your shoulder as Kestrel runs
    else{const a=-.65+cutSeg(t,9.4,18)*.4;cutCam.position.set(Math.sin(a)*62,14-cutSeg(t,9.4,18)*5,z+Math.cos(a)*62);cutCam.lookAt(0,0,z-8);cutFov(42);}   // behind and to the left: Pike, you, Lark
  };
  return set;
};

/* ---- after Heart of the Throne: THRONE comes apart and you fly out of the fire, home to HALCYON ---- */
CUT_BUILD.throne=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x05040a};
  cutSpace(g,true);
  const T=cutCap(g,'cruiser',Object.assign({},CAPITAL_TYPES.cruiser,{name:'THRONE'}),false,'flag',0,0,0,0,2.2);
  cutCap(g,'carrier',fleetCarrierType(),true,null,-160,-40,1700,0);   // HALCYON, bay toward the wreck
  const me=cutHull(g,PROG.ship,'me',8);me.add(stageGlow(0x35e8ff,14,.5));
  const tail=T.hull.z1*2.2+10;
  const F=(t,o)=>{const u=Math.max(0,t-5.4),e=1-Math.exp(-u*.18);return o.set(-160*e,Math.sin(u*.4)*30-30*e,tail+1250*e);};   // out of the stern and for home, easing off once clear
  const tickBooms=cutBooms(g,cutHullBooms(T,36,.2,7.4,9).concat(
    [[7.5,0,0,40,0xffd0a0,900,2.2],[7.7,0,0,-200,0xff5a2a,700,2.4],[7.9,0,0,240,0xffb060,600,2],[5.45,0,0,tail-10,0xffb060,120,.8]],
    cutHullBooms(T,10,7.6,10,21,0xff5a2a)));
  set.tick=(dt,t)=>{
    tickBooms(t);cutBreak(T,t,7.5);
    me.visible=t>=5.4;cutFly(me,F,t,Math.sin(t*1.5)*.2);stageEngines(me.userData.hull,t,2.6);
    if(t<5.4)cutShot(t,0,5.4,[780,260,-620],[640,190,-420],[0,0,0],[0,0,40],40);
    else if(t<10.4){F(t,cutV2);cutCam.position.set(50,24,tail+520);cutCam.lookAt(cutV2.multiplyScalar(.5));cutFov(50);}   // the hull flies at the camera with the fire behind it
    else cutShot(t,10.4,18,[950,160,800],[880,140,880],[-60,0,800],[-60,0,900],52);
  };
  return set;
};

/* ---- Act IV opens: the fleet drops out of the jump in front of the Kiru Gate ---- */
CUT_BUILD.gate=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x05040c};
  cutSpace(g);
  const G=cutCap(g,'gate',GATE_TYPE,false,null,0,60,-1700,0);
  const maw=stageGlow(0xff3a6a,260,.5);maw.position.set(0,60,-1720);g.add(maw);
  const pk=[cutCap(g,'cruiser',CAPITAL_TYPES.cruiser,false,null,0,0,-1250,Math.PI),
    cutCap(g,'frigate',CAPITAL_TYPES.frigate,false,null,320,-20,-1180,Math.PI),
    cutCap(g,'frigate',CAPITAL_TYPES.frigate,false,null,-340,20,-1300,Math.PI)];
  const fleet=[cutCap(g,'carrier',fleetCarrierType(),true,null,0,-20,0,0),
    cutCap(g,'escort',ESCORT_TYPE,true,null,-280,10,90,0),cutCap(g,'escort',ESCORT_TYPE,true,'ally',300,-30,130,0)];
  const arrive=[7,7.7,8.3];
  const flashes=cutBooms(g,fleet.map((C,i)=>[arrive[i],C.home.x,C.home.y,C.home.z-120,0xbfe8ff,420,.8]));
  const wing=[cutHull(g,PROG.ship,'me',8),cutHull(g,'s2','pike',8),cutHull(g,'s3','lark',8)];
  set.tick=(dt,t)=>{
    if(G.spin)G.spin.rotation.z=t*.5;
    maw.material.opacity=.4+Math.sin(t*2.2)*.12;
    pk.forEach((C,i)=>C.g.rotation.z=Math.sin(t*.3+i)*.01);
    fleet.forEach((C,i)=>cutWarp(C,t,arrive[i]));flashes(t);
    wing.forEach((h,i)=>{const s=i?(i===1?-1:1):0;h.visible=t>11.6;
      h.position.set(s*16,84+Math.sin(t+i)*.6-(i?3:0),300-(t-11.6)*44+(i?12:0));h.rotation.set(0,0,Math.sin(t*.7+i)*.06);stageEngines(h.userData.hull,t+i,2);});
    if(t<6.2)cutShot(t,0,6.2,[150,30,-640],[110,45,-860],[0,60,-1700],[0,55,-1700],38);
    else if(t<11.6)cutShot(t,6.2,11.6,[-640,-30,360],[-570,-10,290],[0,0,40],[0,0,0],50);
    else cutShot(t,11.6,20,[50,110,400],[40,96,320],[0,40,-900],[0,50,-1200],46);
  };
  return set;
};

/* ---- after Sovereign: the flagship breaks up, Kestrel drifts with dead drives, and the fleet turns for home ---- */
CUT_BUILD.sovereign=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x05040c};
  const sun=cutSpace(g,true);
  const planet=stagePlanet(1400);planet.position.set(-1400,-2000,-5200);planet.rotation.set(-1.1,0,-.1);g.add(planet);
  const SV=cutCap(g,'cruiser',Object.assign({},CAPITAL_TYPES.cruiser,{name:'SOVEREIGN'}),false,'flag',0,20,-700,Math.PI*.82,1.6);
  const foes=[cutCap(g,'frigate',CAPITAL_TYPES.frigate,false,null,-700,-30,-1100,Math.PI*.9),cutCap(g,'frigate',CAPITAL_TYPES.frigate,false,null,600,10,-1250,Math.PI*1.1)];
  const fleet=[cutCap(g,'carrier',fleetCarrierType(),true,null,0,-20,600,-Math.PI*.5),
    cutCap(g,'escort',ESCORT_TYPE,true,null,-60,20,330,-Math.PI*.5),cutCap(g,'escort',ESCORT_TYPE,true,'ally',80,-50,880,-Math.PI*.5)];
  const kes=cutEnemy(g,'ace',true,1.7);
  const me=cutHull(g,PROG.ship,'me',8),pike=cutHull(g,'s2','pike',8),lark=cutHull(g,'s3','lark',8);
  const kesAt=new THREE.Vector3(260,60,-260);
  const sparks=cutBooms(g,[...Array(10)].map((_,i)=>[6.2+i*.42,kesAt.x+Math.sin(i*2.3)*2,kesAt.y+Math.cos(i*1.7)*1.4,kesAt.z+Math.sin(i)*2,0xffb060,4+(i%3)*2,.35]));
  const tickBooms=cutBooms(g,cutHullBooms(SV,30,.1,3.2,13).concat([[2.7,SV.home.x,SV.home.y,SV.home.z,0xffe0b0,1100,2.6]],cutHullBooms(SV,12,3,6,31,0xff5a2a)));
  kes.traverse(o=>{if(o.isMesh&&o.material&&o.material.blending===THREE.AdditiveBlending)o.visible=false;});   // drives dead: no engine glow
  set.tick=(dt,t)=>{
    tickBooms(t);sparks(t);cutBreak(SV,t,2.8);
    const fade=1-cutSeg(t,10.8,14);foes.forEach(C=>{C.mats.eng.opacity=.95*Math.max(.08,fade);});   // their drives cut, one after the other
    sun.material.opacity=.55+cutSeg(t,15.6,22)*.35;
    kes.position.copy(kesAt).add(cutV1.set(Math.sin(t*.3)*3,Math.sin(t*.5),t*1.5));kes.rotation.set(t*.05,t*.12,.4+t*.18);
    const join=cutSeg(t,7.6,10);me.visible=t>6&&t<10.6;
    me.position.copy(kes.position).add(cutV1.set(-16-(1-join)*30,5+(1-join)*10,-10-(1-join)*40));me.rotation.set(0,0,-.2*(1-join));stageEngines(me.userData.hull,t,1.4);
    // the wing pair runs past the beaten frigates, then the three of you head for HALCYON
    const pass=(h,dx,dy)=>{const u=t-10.6;h.visible=t>10.6;h.position.set(-200+dx+u*60,dy+Math.sin(t+dx)*.5,-820-u*12);h.rotation.set(0,-Math.PI*.5-.12,Math.sin(t*.8+dx)*.1);stageEngines(h.userData.hull,t+dx,2);};
    if(t<15.6){pass(pike,0,0);pass(lark,10,-4);}
    else{[me,pike,lark].forEach((h,i)=>{const u=t-15.6,s=i?(i===1?-1:1):0;h.visible=true;
      h.position.set(-700+u*55+Math.abs(s)*-14,40+s*6,470+s*16);h.rotation.set(0,-Math.PI*.5,Math.sin(t*.6+i)*.08);stageEngines(h.userData.hull,t+i,2);});}
    if(t<6)cutShot(t,0,6,[-430,130,-250],[-370,105,-330],[0,20,-700],[0,10,-700],44);
    else if(t<10.6){const a=t*.12;cutCam.position.set(kes.position.x+Math.sin(a)*34,kes.position.y+8,kes.position.z+Math.cos(a)*34);cutCam.lookAt(kes.position.x+6,kes.position.y,kes.position.z);cutFov(40);}
    else if(t<15.6){pike.getWorldPosition(cutV2);cutCam.position.set(cutV2.x-40,cutV2.y+10,cutV2.z+25);cutCam.lookAt(foes[1].g.position);cutFov(46);}   // behind the wing, the beaten frigate ahead
    else cutShot(t,15.6,22,[-760,110,1060],[-640,150,920],[-200,0,560],[-150,30,520],48);
  };
  return set;
};

/* rock for the Drift's scenes: n tumbling asteroids scattered through a box round the origin, kept off the points in `keep` */
function cutRocks(g,n,box,keep,seed){
  const r=capRng(seed),mats=[new THREE.MeshPhongMaterial({color:0x3c3834,shininess:5,flatShading:true}),
    new THREE.MeshPhongMaterial({color:0x4a2e22,emissive:0x1a0802,shininess:8,flatShading:true})];
  const geos=[0,1,2].map(i=>rockGeo(i*5.3+2)),list=[];
  for(let i=0,tries=0;i<n&&tries<n*20;tries++){
    const p=new THREE.Vector3((r()-.5)*box[0],(r()-.5)*box[1],(r()-.5)*box[2]),s=8+Math.pow(r(),2.2)*90;
    if(keep.some(([k,kr])=>p.distanceTo(k)<kr+s))continue;
    const m=new THREE.Mesh(geos[i%3],mats[i%9===0?1:0]);m.position.copy(p);m.scale.set(s,s*(.7+r()*.3),s*(.8+r()*.3));
    m.rotation.set(r()*6,r()*6,r()*6);m.userData.rs=(r()-.5)*.2;g.add(m);list.push(m);i++;
  }
  return t=>{for(const m of list){m.rotation.y=m.userData.rs*t*2;m.rotation.x=m.userData.rs*t;}};
}

/* ---- Act V opens: the fleet eases into the Kiru Drift, and the wing threads the rock ahead of it ---- */
CUT_BUILD.drift=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x070504};
  cutSpace(g,true);
  const fleet=[cutCap(g,'carrier',fleetCarrierType(),true,null,0,-20,400,0),
    cutCap(g,'escort',ESCORT_TYPE,true,null,-300,10,520,0),cutCap(g,'escort',ESCORT_TYPE,true,'ally',320,-30,560,0)];
  const lane=t=>cutV1.set(0,0,-t*20);
  const tumble=cutRocks(g,90,[3200,700,3400],[[new THREE.Vector3(0,0,0),260],[new THREE.Vector3(0,-20,400),380],[new THREE.Vector3(-300,10,520),220],
    [new THREE.Vector3(320,-30,560),220],[new THREE.Vector3(0,60,-400),160]],71);
  const wing=[cutHull(g,PROG.ship,'me',8),cutHull(g,'s2','pike',8),cutHull(g,'s3','lark',8)];
  set.tick=(dt,t)=>{
    tumble(t);
    fleet.forEach((C,i)=>{C.g.position.copy(C.home).add(lane(t));});
    wing.forEach((h,i)=>{const s=i?(i===1?-1:1):0,u=t-9;h.visible=t>9;
      h.position.set(s*18+Math.sin(u*.8)*30,60+Math.sin(u*.6+i)*8-(i?4:0),200-u*70+(i?14:0));h.rotation.set(0,0,Math.sin(u*.8+i)*.35);stageEngines(h.userData.hull,t+i,2);});
    if(t<9)cutShot(t,0,9,[480,140,-700],[380,110,-520],[0,0,300],[0,0,240],42);   // the fleet, out of the haze between the rocks
    else if(t<15){wing[0].getWorldPosition(cutV2);cutCam.position.set(cutV2.x-36,cutV2.y+14,cutV2.z+60);cutCam.lookAt(cutV2.x,cutV2.y-4,cutV2.z-200);cutFov(50);}   // behind the wing, into the rock
    else cutShot(t,15,20,[-520,220,300],[-440,190,120],[0,40,-300],[0,40,-500],46);
  };
  return set;
};

/* ---- after The Directorate: ECLIPSE breaks up in the rock, and the fleet turns for home ---- */
CUT_BUILD.eclipse=()=>{
  const g=new THREE.Group(),set={group:g,bg:0x070504};
  cutSpace(g,true);
  const EC=cutCap(g,'cruiser',Object.assign({},CAPITAL_TYPES.cruiser,{name:'ECLIPSE'}),false,'flag',0,20,-700,Math.PI*.85,1.6);
  const fleet=[cutCap(g,'carrier',fleetCarrierType(),true,null,0,-20,600,-Math.PI*.5),
    cutCap(g,'escort',ESCORT_TYPE,true,null,-60,20,330,-Math.PI*.5),cutCap(g,'escort',ESCORT_TYPE,true,'ally',80,-50,880,-Math.PI*.5)];
  const tumble=cutRocks(g,80,[3400,800,3400],[[EC.home,420],[new THREE.Vector3(0,-20,600),520],[new THREE.Vector3(-400,60,-200),200]],29);
  const me=cutHull(g,PROG.ship,'me',8),pike=cutHull(g,'s2','pike',8),lark=cutHull(g,'s3','lark',8);
  const booms=cutBooms(g,cutHullBooms(EC,30,.1,3.2,17).concat([[2.7,EC.home.x,EC.home.y,EC.home.z,0xffe0b0,1100,2.6]],cutHullBooms(EC,12,3,6,37,0xff5a2a)));
  set.tick=(dt,t)=>{
    tumble(t);booms(t);cutBreak(EC,t,2.8);
    [me,pike,lark].forEach((h,i)=>{const u=t-6,s=i?(i===1?-1:1):0;h.visible=t>6;
      h.position.set(-500+u*60+Math.abs(s)*-14,60+s*6,-200+s*16);h.rotation.set(0,-Math.PI*.5,Math.sin(t*.6+i)*.08);stageEngines(h.userData.hull,t+i,2);});
    if(t<6)cutShot(t,0,6,[-430,130,-250],[-370,105,-330],[0,20,-700],[0,10,-700],44);
    else if(t<12){pike.getWorldPosition(cutV2);cutCam.position.set(cutV2.x-40,cutV2.y+10,cutV2.z+25);cutCam.lookAt(EC.home);cutFov(46);}   // behind the wing, the wreck in the rock
    else cutShot(t,12,20,[-760,110,1060],[-640,150,920],[-200,0,560],[-150,30,520],48);
  };
  return set;
};

/* ---- Trench intros (TRENCH_INTROS in js/data/cutscenes.js): a flyby of the target, then your hull comes in for the
   trench. The scenes are built in the game's own frame (the trench mouth at z 0, js/trench.js buildTrenchDeck), and the
   last shot ends exactly where the game's dive starts (js/update/launch.js): the hull at the dive's first point and speed,
   the camera on diveCamPose. So the handover is a straight cut onto the same view, softened by a cross-fade (cutEnd).
   Every intro shares one timeline: the establishing shot to TRI_CUT seconds, then the approach. ---- */
const CUT_TRENCH={}, TRI_CUT=2.3;
const triPos=new THREE.Vector3(), triDir=new THREE.Vector3(), triQ=new THREE.Quaternion(), triSide=new THREE.Vector3();
/* the approach: along the line the game's dive starts on, arriving at its first point at the scene's end, with a sweep
   in from `sx` metres to the side that straightens out on arrival */
function triApproach(interior,sx){
  const v1=MAX_SPD*curShip.spdMul*.45,F=interior?DIVE_FROM_INT:DIVE_FROM;
  divePos(0,triPos,v1,F);divePos(.02,triDir,v1,F);triDir.sub(triPos).multiplyScalar(50);   // the dive's first velocity
  const B=triPos.clone(),V=triDir.clone();
  return (t,o)=>{const u=TRENCH_INTRO_LEN-t;o.copy(B).addScaledVector(V,-u);o.x+=sx*u*u*.5;o.y+=u*u*4;return o;};
}
/* the camera on the approach: from a sweep alongside, easing onto the dive camera's pose behind the hull */
function triChase(path,t,me,side){
  const k=cutSeg(t,TRI_CUT,TRENCH_INTRO_LEN-.3);
  path(t,cutV2);path(t+.02,triDir);triDir.sub(cutV2).normalize();
  diveCamPose(cutV2,triDir,triPos,triQ);
  triSide.copy(cutV2).add(cutV3.set(side*34,10,-6));   // alongside and a little ahead, looking back across at the hull
  cutCam.position.lerpVectors(triSide,triPos,k);
  cutCam.lookAt(cutV2);const q0=cutCam.quaternion.clone();cutCam.quaternion.copy(q0).slerp(triQ,k);
  cutFov(46+(DIVE_FOV-46)*k);me.visible=true;
}
/* the haze closes in to the game's over the last second, so the cut lands on the same light */
function triHaze(set,t,fog){
  const k=cutSeg(t,TRENCH_INTRO_LEN-1.2,TRENCH_INTRO_LEN);
  cutScene.fog.color.setHex(set.bg).lerp(triHazeC.setHex(fog[0]),k);cutScene.fog.density=set.fog[1]+(fog[2]-set.fog[1])*k;
  cutScene.background.copy(cutScene.fog.color);
}
const triHazeC=new THREE.Color();
const triMat=(c,o)=>new THREE.MeshBasicMaterial(Object.assign({color:c},o||{}));
const triGlowMat=c=>triMat(c,{blending:THREE.AdditiveBlending,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide});

/* the slab and trench (the game's own, carried on past z 0) with the target standing over the trench's far end */
CUT_TRENCH.surface=(key,I)=>{
  const P=I.pal,g=new THREE.Group(),set={group:g,bg:P.bg,fog:[P.bg,.00022]},rng=capRng(key.length*11+5),end=-1750,Y=DECK_Y;
  cutSpace(g,I.target==='base');
  g.add(new THREE.HemisphereLight(P.glow,P.neon[0],.9));   // the target's light over the slab, the trim's from below
  g.add(buildTrenchDeck(key,I,1500,-1650,1500,-1650));
  const mt=trenchDeckMats(P),n0=mt.n0,n1=mt.n1,glowC=mt.glow,slab=mt.slab,dark=mt.dark;
  const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
  const mouth=stageGlow(P.glow,120,.8);mouth.position.set(0,0,end+80);g.add(mouth);   // the intake, lit at the trench's end
  let shot;   // the establishing shot: [from, to, look from, look to, fov]
  if(I.target==='reactor'||I.target==='silent'){   // the core: a dome over the trench's end and a ringed stack
    const sil=I.target==='silent',sc=sil?.8:1,moving=[];
    const dome=new THREE.Mesh(new THREE.SphereGeometry(260*sc,32,16,0,Math.PI*2,0,Math.PI/2),slab);dome.position.set(0,Y,end);g.add(dome);
    const stack=new THREE.Mesh(new THREE.CylinderGeometry(44*sc,62*sc,760*sc,20),dark);stack.position.set(0,Y+380*sc,end);g.add(stack);
    for(let i=0;i<6;i++){const r=new THREE.Mesh(new THREE.TorusGeometry((70+i*5)*sc,3,8,48),i%2?n0:glowC);
      r.rotation.x=Math.PI/2;r.position.set(0,Y+(200+i*95)*sc,end);g.add(r);moving.push([r,i]);}
    const core=stageGlow(P.glow,sil?300:560,.75);core.position.set(0,Y+220*sc,end);g.add(core);
    set.pulse=t=>{core.material.opacity=.6+Math.sin(t*2.4)*.15;moving.forEach(([r,i])=>r.rotation.z=t*(i%2?.4:-.3));};
    shot=sil?[[-160,Y+70,-650],[-120,Y+60,-860],[0,Y+150,end],[0,Y+170,end],48]:[[-240,Y+190,-760],[-190,Y+170,-960],[0,Y+280,end],[0,Y+320,end],46];
    if(sil){   // searchlights sweep the high lanes, and the masts blink red
      const beams=[];
      for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.ConeGeometry(80,800,20,1,true),triGlowMat(0xbfe0ff));
        b.geometry.translate(0,-400,0);const piv=new THREE.Group();piv.position.set((i%2?1:-1)*(110+i*70),Y+30,-700-i*220);
        piv.add(b);g.add(piv);beams.push([piv,i]);}
      const blink=[];g.traverse(o=>{if(o.isSprite&&o.material.color.getHex()===0xff2a3a)blink.push(o);});
      const base=set.pulse;
      set.pulse=t=>{base(t);beams.forEach(([p,i])=>{p.rotation.set(Math.PI*.8+Math.sin(t*.6+i)*.22,0,Math.sin(t*.4+i*1.7)*.6);});
        blink.forEach((s,i)=>s.visible=((t*.9+i*.37)%1)<.3);};
    }
  }else if(I.target==='base'){   // the launch tower over the trench's end: rails climbing off its flanks, fighters lifting off
    box(200,460,170,dark,0,Y+230,end);
    for(let i=0;i<7;i++)box(206,3,176,i%2?n0:n1,0,Y+40+i*62,end);
    box(70,40,6,glowC,0,Y+20,end+86);   // the hangar mouth, lit
    for(const s of [-1,1]){const rail=box(12,8,620,slab,s*150,Y+130,end+190);rail.rotation.x=-.42;
      box(1.6,1.6,620,n0,s*150,Y+135,end+190).rotation.x=-.42;}
    const beacon=stageGlow(P.glow,360,.7);beacon.position.set(0,Y+480,end);g.add(beacon);
    const lift=[0,1,2,3,4].map(i=>[cutEnemy(g,i%2?'grunt':'dart',false,2.6),i]);
    set.pulse=t=>{beacon.material.opacity=.55+Math.sin(t*3)*.15;
      lift.forEach(([e,i])=>{const u=Math.max(0,t-i*.45),s=i%2?1:-1;
        e.position.set(s*(150+u*10),Y+20+u*u*12+u*55,end+60+u*120);e.rotation.set(.42+u*.05,0,s*.25);});};
    shot=[[-210,Y+90,-820],[-170,Y+80,-1000],[0,Y+170,end],[0,Y+210,end],48];
  }else{   // the station's main intake: a turbine hall over the trench's end, its vents venting light
    box(380,220,160,dark,0,Y+110,end);
    for(let i=0;i<5;i++)box(386,2.5,166,i%2?n0:n1,0,Y+30+i*44,end);
    const vents=[];for(let i=0;i<3;i++){const x=(i-1)*120;
      const c=new THREE.Mesh(new THREE.CylinderGeometry(34,40,90,16),slab);c.position.set(x,Y+265,end);g.add(c);
      const v=stageGlow(P.glow,200,.5);v.position.set(x,Y+320,end);g.add(v);vents.push([v,i]);}
    set.pulse=t=>vents.forEach(([v,i])=>{v.material.opacity=.4+Math.sin(t*1.6+i)*.15;v.position.y=Y+320+Math.sin(t*.8+i)*10;});
    shot=[[-230,Y+120,-760],[-180,Y+100,-960],[0,Y+150,end],[0,Y+170,end],48];
  }
  const me=cutHull(g,PROG.ship,'tri-'+key,8);let path=triApproach(false,90);
  set.onPlay=()=>{stageSetHull(me,PROG.ship,'tri-'+key);path=triApproach(false,90);};   // the hull you fly now, at its speed
  const fog=[I.look.fog[0],0,.0024];
  set.tick=(dt,t)=>{
    set.pulse(t);triHaze(set,t,fog);
    stageEngines(me.userData.hull,t,2.2);
    if(t<TRI_CUT){me.visible=false;cutShot(t,0,TRI_CUT,...shot);}   // close on the target
    else{cutFly(me,path,t,-Math.max(0,TRENCH_INTRO_LEN-t)*.25);triChase(path,t,me,1);}
  };
  return set;
};
/* a dreadnought with the strike wing's breach burning in its flank, turned so the breach sits where the game's does
   (the origin, facing +z) */
CUT_TRENCH.hull=(key,I)=>{
  const P=I.pal,g=new THREE.Group(),set={group:g,bg:P.bg,fog:[P.bg,.00002]};
  cutSpace(g,true);
  const planet=stagePlanet(1500,'warm');planet.position.set(-1600,-2200,-5200);planet.rotation.set(-1.1,0,.2);g.add(planet);
  const T=cutCap(g,'cruiser',Object.assign({},CAPITAL_TYPES.cruiser,{name:key==='throne'?'THRONE':'HULK'}),false,P.flag?'flag':null,0,0,0,-Math.PI/2,5.5);   // big: the game's breach is a wall of hull
  const H=T.hull,bx=H.w*.5*5.5+2,bz=(H.z0+H.z1)*.5*5.5;   // the breach, on the starboard flank amidships
  T.g.position.set(bz,-50,-bx);   // the breach a little above the keel line, where the dive comes in
  const fire=[stageGlow(P.glow,80,.85),stageGlow(0xffd0a0,36,.9),stageGlow(P.neon[1],140,.35)];
  fire.forEach(f=>{f.position.set(0,0,2);g.add(f);});
  const embers=cutBooms(g,[...Array(12)].map((_,i)=>[i*.42,Math.cos(i*1.3)*22,Math.sin(i*2.1)*14,4,i%3?0xff8a3a:0xffd0a0,14+(i%4)*6,.8]));
  const me=cutHull(g,PROG.ship,'tri-'+key,8);let path=triApproach(true,-120);
  set.onPlay=()=>{stageSetHull(me,PROG.ship,'tri-'+key);path=triApproach(true,-120);};
  set.tick=(dt,t)=>{
    fire[0].material.opacity=.7+Math.sin(t*9)*.12+Math.sin(t*23)*.06;fire[2].material.opacity=.3+Math.sin(t*2)*.08;embers(t);
    stageEngines(me.userData.hull,t,2.2);
    if(t<TRI_CUT){me.visible=false;cutShot(t,0,TRI_CUT,[-900,260,900],[-620,180,980],[300,0,-60],[0,0,0],44);}   // along the flank to the burning breach
    else{cutFly(me,path,t,Math.max(0,TRENCH_INTRO_LEN-t)*.3);triChase(path,t,me,-1);}
  };
  return set;
};

/* ---- playing ---- */
/* a scene waiting for op `id`: 'before' plays until the op is first cleared, 'after' on its first clear; each plays once */
function cutFor(id,when){
  const c=CUTSCENES.find(c=>c.op===id&&c.when===when);
  return c&&!PROG.cuts[c.id]&&!PROG.completed[id]?c:null;
}
function cutPlay(id,then){
  const def=cutById(id);if(!def){if(then)then();return;}
  PROG.cuts[id]=true;saveProg();   // seen once it starts: skipping counts
  cutStart(def,id,CUT_BUILD[id],then);
}
/* start scene `def` from the set cached under `key` (built by `build` the first time) */
function cutStart(def,key,build,then){
  if(!CUT_SETS[key]){CUT_SETS[key]=build();cutScene.add(CUT_SETS[key].group);}
  for(const k in CUT_SETS)CUT_SETS[k].group.visible=k===key;
  const set=CUT_SETS[key];cutScene.background=new THREE.Color(set.bg);
  const fog=set.fog||[0x04050d,.00002];cutScene.fog.color.setHex(fog[0]);cutScene.fog.density=fog[1];
  if(set.onPlay)set.onPlay();
  CUT={def,set,t:0,then,line:-1,padHeld:true,shown:SCR.filter(s=>!$(s).classList.contains('hidden'))};
  for(const s of SCR)$(s).classList.add('hidden');   // the screens come back if nothing replaces them (cutEnd)
  if(!def.intro||isTouch)document.exitPointerLock&&document.exitPointerLock();
  else renderer.domElement.requestPointerLock&&renderer.domElement.requestPointerLock();   // an intro hands straight to the run: capture the mouse while the Launch click still counts
  cut.classList.toggle('intro',!!def.intro);
  cutCardA.textContent=def.card[0];cutCardB.textContent=def.card[1];cutCard.classList.remove('on');
  cutSub.classList.remove('on');cutProg.style.width='0';
  cut.classList.remove('hidden');void cut.offsetWidth;cut.classList.add('on');
  set.tick(0,0);
}
/* Trench intro for the op in S.mission (null: free trench), then the run with its dive into the trench. A straight retry
   of the op just flown, or the setting off, goes in with the dive alone. */
let trenchIntroLast=null;
function trenchLaunch(){
  const m=S.mission,key=trenchKey(m),I=TRENCH_INTROS[key],go=()=>{S.diveNext=true;startGame('trench');};
  const tag=m?m.id:'free',again=trenchIntroLast===tag;trenchIntroLast=tag;
  if(!SETTINGS.trenchIntro||again){go();return;}
  const fill=t=>t.replace(/\{(\w+)\}/g,(_,k)=>(m&&m[k])||'');
  const def={id:'tr-'+key,intro:true,len:TRENCH_INTRO_LEN,card:I.card.map(fill),lines:I.lines.map(l=>[l[0],l[1],fill(l[2])])};
  cutStart(def,'tr-'+key,()=>CUT_TRENCH[I.build](key,I),go);
}
/* draw the scene as it stands into the cross-fade layer, which then fades out over whatever comes next */
function cutHoldFrame(){
  const w=innerWidth,h=innerHeight;
  if(cutHold.width!==w||cutHold.height!==h){cutHold.width=w;cutHold.height=h;}
  if(cutCam.aspect!==w/h){cutCam.aspect=w/h;cutCam.updateProjectionMatrix();}
  if(bloomOn()){const rp=composer.passes[0],s0=rp.scene,c0=rp.camera;rp.scene=cutScene;rp.camera=cutCam;composer.render();rp.scene=s0;rp.camera=c0;}
  else renderer.render(cutScene,cutCam);
  const x=cutHold.getContext('2d');x.clearRect(0,0,w,h);x.drawImage(renderer.domElement,0,0,w,h);   // same task as the draw: the buffer is still there
  cutHold.classList.remove('fade');cutHold.classList.add('on');void cutHold.offsetWidth;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{cutHold.classList.add('fade');cutHold.classList.remove('on');}));
}
function cutEnd(){
  if(!CUT)return;
  const C=CUT;
  if(C.def.intro)try{cutHoldFrame();}catch(e){}   // an intro hands over with a cross-fade, not a cut to black
  CUT=null;
  cut.classList.remove('on');
  if(C.def.intro)setTimeout(()=>{if(!CUT)cut.classList.add('hidden');},350);else cut.classList.add('hidden');
  if(C.then)C.then();
  if(S.mode!=='play'&&!SCR.some(s=>!$(s).classList.contains('hidden')))for(const s of C.shown)$(s).classList.remove('hidden');
}
const cutSkip=()=>{if(CUT&&CUT.t>.3)cutEnd();};
function cutTick(dt){
  const C=CUT,d=C.def;
  C.t+=dt;
  if(C.t>=d.len){cutEnd();return;}
  C.set.tick(dt,C.t);
  cutCard.classList.toggle('on',C.t>.5&&C.t<4);
  let li=-1;d.lines.forEach((l,i)=>{if(C.t>=l[0])li=i;});
  if(li!==C.line){C.line=li;
    if(li>=0){const [,w,txt]=d.lines[li];cutWho.textContent=CAST[w].name;cutWho.style.color=CAST[w].col;cutTxt.textContent=txt;}
    cutSub.classList.toggle('on',li>=0);}
  cutFade.style.opacity=Math.max(1-C.t/.6,d.intro?0:(C.t-(d.len-.7))/.7,0);   // an intro cuts into the run instead (cutEnd)
  cutProg.style.width=(C.t/d.len*100).toFixed(1)+'%';
  // any pad face button or Start skips, once everything held when the scene began has been let go
  const pads=navigator.getGamepads?navigator.getGamepads():[];let held=false;
  for(const p of pads)if(p)for(const i of [PAD_B.A,PAD_B.B,PAD_B.Start])if(p.buttons[i]&&p.buttons[i].pressed)held=true;
  if(held&&!C.padHeld)cutSkip();C.padHeld=held;
}
/* draws the scene in place of everything else while one plays; false otherwise */
function renderCut(dt){
  if(!CUT)return false;
  cutTick(dt);if(!CUT)return false;
  const w=innerWidth,h=innerHeight;if(cutCam.aspect!==w/h){cutCam.aspect=w/h;cutCam.updateProjectionMatrix();}
  if(bloomOn()){const rp=composer.passes[0],s0=rp.scene,c0=rp.camera;
    rp.scene=cutScene;rp.camera=cutCam;composer.render();rp.scene=s0;rp.camera=c0;}
  else renderer.render(cutScene,cutCam);
  return true;
}
/* keys: Esc, Enter or Space skip; nothing else reaches the game or the menus while a scene plays */
addEventListener('keydown',e=>{
  if(!CUT)return;
  e.stopImmediatePropagation();e.preventDefault();
  if(!e.repeat&&/^(Escape|Enter|Space|NumpadEnter)$/.test(e.code))cutSkip();
},true);
cutSkipBtn.onclick=cutSkip;
/* a trench intro also skips on a click or a tap anywhere (the mouse is captured by then, so the Skip button can't be reached) */
addEventListener('pointerdown',e=>{if(CUT&&CUT.def.intro&&e.target!==cutSkipBtn){e.preventDefault();cutSkip();}},true);
