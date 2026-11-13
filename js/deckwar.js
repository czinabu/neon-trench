"use strict";
/* HALCYON follows the campaign (data in js/data/deck.js, the deck itself in js/deck.js):
     the war aboard   the hull HALCYON carries between fleet battles (sectorHull, js/sector.js) shows on the deck: scorch,
                      dead and flickering lamps, sparking conduits, welders, smoke, a patched bridge window and, worst of
                      all, emergency light. Repairs at damage control in engineering (or the Fleet station) clear it and Chief Oda says so. When the next op
                      puts HALCYON in the fight the deck goes to battle stations: red beacons, a red wash and a banner
     the fleet        the destroyers out the windows are the ones that have joined (dockFleet, js/dock.js), named, burning
                      when hurt, and their captains stand as holograms round the bridge's holo table with a report
     the ready room   off the spine: the briefing screen, the Contracts board (open once Acts I to III are clear), the side
                      bets board, and the reserve pilots
     side bets        crew offer a bet on the next op (DECK_BETS); take it by using them again. It shows in the briefing,
                      settles at that op's debrief and pays in credits or parts. Saved as PROG.bet, PROG.betsWon and
                      PROG.betLast (old saves have none) */

/* ---- the war aboard ---- */
const dkHurt=()=>1-sectorHull('HALCYON');   // 0 is a whole ship
const dkAlert=()=>{const nm=nextMission();return !!nm&&!!nm.carrier;};
const dkWarTier=()=>DECK_WAR.tiers.filter(t=>dkHurt()>=t).length;
const dkScorchTex=()=>holoTex(256,256,(g,W,H)=>{
  const r=g.createRadialGradient(W/2,H/2,4,W/2,H/2,W/2);r.addColorStop(0,'rgba(6,4,3,.95)');r.addColorStop(.45,'rgba(20,12,8,.7)');r.addColorStop(1,'rgba(20,12,8,0)');
  g.fillStyle=r;g.fillRect(0,0,W,H);g.strokeStyle='rgba(4,3,2,.8)';g.lineWidth=3;
  for(let i=0;i<9;i++){const a=i*.7+Math.sin(i*3.1),l=W*(.25+.2*Math.abs(Math.sin(i*1.7)));g.beginPath();g.moveTo(W/2,H/2);g.lineTo(W/2+Math.cos(a)*l,H/2+Math.sin(a)*l);g.stroke();}
});
/* the heat in a scorch: glowing cracks and embers, drawn additive over the char so it reads on the dark deck */
const dkEmberTex=()=>holoTex(256,256,(g,W,H)=>{
  g.strokeStyle='rgba(255,110,30,.9)';g.lineCap='round';
  for(let i=0;i<7;i++){let x=W/2,y=H/2,a=i*.9+Math.sin(i*2.3);g.lineWidth=3;g.beginPath();g.moveTo(x,y);
    for(let k=0;k<7;k++){a+=Math.sin(i*5+k*1.7)*.6;x+=Math.cos(a)*W*.065;y+=Math.sin(a)*H*.065;g.lineTo(x,y);g.lineWidth=2;}g.stroke();}
  const r=g.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.2);r.addColorStop(0,'rgba(255,90,20,.55)');r.addColorStop(1,'rgba(255,90,20,0)');g.fillStyle=r;g.fillRect(0,0,W,H);
  g.fillStyle='rgba(255,170,70,.9)';for(let i=0;i<30;i++){const a=i*2.4,l=W*.04+W*.2*Math.abs(Math.sin(i*1.3));g.fillRect(W/2+Math.cos(a)*l,H/2+Math.sin(a)*l,3,3);}
});
function dkWarBuild(M){
  const sc=DK.scene,X=DK_SPINE.x,h=DK_SPINE.h;
  DK.war=[0,1,2,3].map(()=>{const g=new THREE.Group();g.visible=false;sc.add(g);return g;});
  DK.sparkSrc=[];DK.flick=[];DK.smoke=[];DK.burn=[];
  const scorch=new THREE.MeshBasicMaterial({map:dkScorchTex(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  DK.emberM=new THREE.MeshBasicMaterial({map:dkEmberTex(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-3});
  const dec=(t,x,y,z,ry,w,hh,floor)=>{for(const mat of [scorch,DK.emberM]){const m=new THREE.Mesh(sharedGeo('dkDecal',()=>new THREE.PlaneGeometry(1,1)),mat);
    m.scale.set(w,hh,1);m.position.set(x,y,z);if(floor)m.rotation.x=-Math.PI/2;else m.rotation.y=ry;m.renderOrder=mat===scorch?1:2;DK.war[t].add(m);}};
  const spark=(t,x,y,z,every,n)=>DK.sparkSrc.push({t,x,y,z,every:every||DECK_WAR.spark[t?1:0],n:n||14,k:Math.random()*2});
  const P=Math.PI/2,sx=X-.16;   // a wall decal sits just proud of the spine's inner face
  // tier 0: the first scorch, one sparking conduit
  dec(0,-sx,2.3,0,P,3,2.6);dec(0,sx,2,8,-P,2.8,2.4);dec(0,0,.03,30,0,2.6,2.2,true);
  spark(0,X-.5,DK_SPINE.h-1.05,-10);
  {const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(X-.5,h-1.05,-10),new THREE.Vector3(X-.7,h-2,-10.2),new THREE.Vector3(X-1.1,h-2.6,-10.6)]);   // a cut cable hangs from the conduit
    const m=new THREE.Mesh(new THREE.TubeGeometry(cable,12,.035,6,false),M.dark);DK.war[0].add(m);}
  // tier 1: dead and flickering lamps, a patch over the worst of it, a welder at work, more sparks
  dec(1,sx,2.8,-32,-P,3,2.6);dec(1,0,.03,-56,0,3,2.4,true);dec(1,-8,.03,80,0,4.5,4,true);dec(1,-DK_HANGAR.x+.2,4,96,P,5.5,4.5);
  for(const k of [5,12,20])dkBox(M.dark,-.84,h-.09,DK_SPINE.z0+2+4*k+1.16,.84,h-.06,DK_SPINE.z0+2+4*k+2.84);
  for(const k of [3,22]){const m=new THREE.Mesh(new THREE.BoxGeometry(1.64,.03,1.64),new THREE.MeshBasicMaterial({color:0xd6ecff}));
    m.position.set(0,h-.08,DK_SPINE.z0+2+4*k+2);DK.war[1].add(m);DK.flick.push({m,k:Math.random()});}
  dkBox(M.metal,-X+.15,2.9,-16.8,-X+.24,3.9,-15.2);dkBox(M.amber,-X+.24,2.88,-16.82,-X+.26,3.92,-16.78);dkBox(M.amber,-X+.24,2.88,-15.22,-X+.26,3.92,-15.18);
  spark(1,-X+.5,DK_SPINE.h-1.4,24);spark(1,6,DK_HANGAR.h-.7,96);
  dkFlush(DK.war[1]);
  const welder=(t,x,z,ry)=>{const W=dkPerson(M,{suit:0x5a3414,trim:0xffa22c,hair:0x101010,style:'shaved'});W.g.position.set(x,0,z);W.g.rotation.y=ry;DK.war[t].add(W.g);
    DK.crew.push({P:W,work:true,ph:Math.random()*6});dkBlock({x,z,r:.45,on:()=>DK.war[t].visible});
    spark(t,x-Math.sin(ry)*.55,1.45,z-Math.cos(ry)*.55,.22,4);};
  welder(1,-2.2,-30,P);
  // tier 2: smoke under the ceilings, a patched bridge window, a second welder, sparks on the bridge
  dec(2,-sx,3,-12,P,3,2.4);dec(2,0,.03,-30,0,2.4,2.4,true);dec(2,10,.03,-74,0,3,3,true);dec(2,DK_HANGAR.x-.2,5,112,-P,6,4.5);
  const bz=DK_BRIDGE.z0+.2;dkBox(M.metal,6,3,bz-.08,10.5,6.2,bz+.08);dkBox(M.amber,6,3,bz+.08,10.5,3.06,bz+.1);dkBox(M.amber,6,6.14,bz+.08,10.5,6.2,bz+.1);
  dkBox(M.metal,-14,1.4,bz-.08,-11.5,3.8,bz+.08);
  dkSign([['HULL BREACH · SEALED',40]],'#ff3a4a',2.6,.36,8.25,6.6,bz+.12,0,DK.war[2]);
  dkFlush(DK.war[2]);
  welder(2,2.2,20,-P);
  {const m=new THREE.Mesh(new THREE.BoxGeometry(1.64,.06,1.64),M.metal);m.position.set(1.2,.2,-43.2);m.rotation.set(.12,.5,.28);DK.war[2].add(m);   // a ceiling panel down on the deck
    dkBlock({x:1.2,z:-43.2,r:.9,on:()=>DK.war[2].visible});dkBox(M.dark,-.84,h-.09,DK_SPINE.z0+2+4*6+1.16,.84,h-.06,DK_SPINE.z0+2+4*6+2.84);dkFlush(DK.war[2]);}spark(2,14.2,1.25,-90);spark(2,X-.5,DK_SPINE.h-1.05,-46);
  for(const [x,y,z,s] of [[0,4.3,-36,7],[0,4.3,18,8],[-6,10.6,72,14],[8,10.8,104,16]]){
    const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x2c3038,transparent:true,opacity:.5,depthWrite:false}));
    m.scale.set(s,s*.45,1);m.position.set(x,y,z);DK.war[2].add(m);DK.smoke.push({m,x,ph:Math.random()*6});}
  // tier 3: emergency light (dkWarApply), fires at the back of the bay, sparks everywhere
  for(const [x,y,z] of [[-18,1.4,132],[-16.5,.9,133.5],[18.4,1.2,62]]){const f=stageGlow(0xff6a20,3,.8);f.position.set(x,y,z);DK.war[3].add(f);DK.burn.push(f);}
  spark(3,X-.5,DK_SPINE.h-1.4,40);spark(3,-12,DK_HANGAR.h-.7,70);spark(3,-X+.5,DK_SPINE.h-1.05,-60);
  dkSign([['DAMAGE CONTROL · DECK 4',40]],'#ff8a4a',3,.4,0,DK_SPINE.h-.85,-35,0,DK.war[3]);
  const emer=new THREE.MeshBasicMaterial({color:0xff8a3a});   // emergency lamps low on the walls
  for(let z=DK_SPINE.z0+6;z<DK_SPINE.z1-2;z+=8)for(const s of [-1,1])if(!dkSpineDoor(s,z-.4,z+.4,.5))dkBox(emer,s*(X-.2)-.05,.5,z-.35,s*(X-.2)+.05,.62,z+.35);
  dkFlush(DK.war[3]);
  // the spark pool, shared by every emitter
  const N=260,pos=new Float32Array(N*3).fill(-999),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  DK.sparks={pts:new THREE.Points(geo,new THREE.PointsMaterial({color:0xffc070,size:.06,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending})),
    vel:new Float32Array(N*3),life:new Float32Array(N),next:0,N};
  DK.sparks.pts.frustumCulled=false;sc.add(DK.sparks.pts);
  // battle stations: red beacons down the spine, the bay and the bridge, a red wash, the banners
  const G=DK.alertG=new THREE.Group();G.visible=false;sc.add(G);
  DK.alertM=new THREE.MeshBasicMaterial({color:0xff2a3a,transparent:true,opacity:1});
  for(let z=DK_SPINE.z0+10;z<DK_SPINE.z1-4;z+=16)for(const s of [-1,1])dkBox(DK.alertM,s*(X-.45)-.2,h-.85,z-.45,s*(X-.45)+.2,h-.5,z+.45);
  for(const s of [-1,1])dkBox(DK.alertM,s*(X-.25)-.02,h-.6,DK_SPINE.z0,s*(X-.25)+.02,h-.56,DK_SPINE.z1);
  for(let z=DK_HANGAR.z0+12;z<DK_HANGAR.z1-6;z+=16)for(const s of [-1,1])dkBox(DK.alertM,s*(DK_HANGAR.x-.75)-.3,7.8,z-.7,s*(DK_HANGAR.x-.75)+.3,8.6,z+.7);
  for(const s of [-1,1])dkBox(DK.alertM,s*(DK_BRIDGE.x-.35)-.15,7,-74,s*(DK_BRIDGE.x-.35)+.15,7.5,-73);
  dkFlush(G);
  for(const [z,ry] of [[73.5,Math.PI],[74.5,0]])dkSign([['BATTLE STATIONS',60],['all hands · flight crews to the bay',24]],'#ff3a4a',5,.92,0,DK_HANGAR.h-1.15,z,ry,G);   // on the gantry over pad one
  for(const [z,ry] of [[-35.05,Math.PI],[9.95,Math.PI],[-34.95,0],[10.05,0]])dkSign([['⚠ BATTLE STATIONS',44]],'#ff3a4a',3.6,.5,0,h-.85,z,ry,G);
  DK.alertLights=[[0,4.2,-20,40],[0,9.5,92,60],[0,8,-84,36]].map(([x,y,z,d])=>{const l=new THREE.PointLight(0xff2030,0,d,1.6);l.position.set(x,y,z);sc.add(l);return l;});
  DK.spineCol=DK.spineLights[0].color.getHex();DK.spineI=DK.spineLights[0].intensity;
}
/* what the deck shows this visit: called from openDeck */
function dkWarApply(){
  const t=dkWarTier(),h=sectorHull('HALCYON');
  DK.war.forEach((g,i)=>g.visible=i<t);
  for(const l of DK.spineLights)l.color.setHex(t>=4?0xff9a5a:DK.spineCol);   // emergency light
  DK.alertG.visible=dkAlert();
  DK.repaired=DK.lastHull!==undefined&&h>DK.lastHull+.005;DK.lastHull=h;
  DK.said={};DK.locAlert=null;
  dkFleet();dkCapAssign();dkReadyDraw();dkEngDraw();dkCmdDraw();   // js/deckeng.js: engineering's boards and reactor, the bridge's command report
}
function dkWarTick(dt){
  const D=DK,t=dkWarTier(),SP=D.sparks,pos=SP.pts.geometry.attributes.position.array;
  // sparks: each visible emitter bursts now and then; the pool falls under gravity and fades out
  for(const E of D.sparkSrc){if(E.t>=t)continue;E.k-=dt;if(E.k>0)continue;E.k=E.every*(.5+Math.random());
    for(let i=0;i<E.n;i++){const j=SP.next;SP.next=(SP.next+1)%SP.N;
      pos[j*3]=E.x;pos[j*3+1]=E.y;pos[j*3+2]=E.z;SP.vel[j*3]=(Math.random()-.5)*3;SP.vel[j*3+1]=Math.random()*1.6-.4;SP.vel[j*3+2]=(Math.random()-.5)*3;SP.life[j]=.4+Math.random()*.6;}}
  for(let j=0;j<SP.N;j++){if(SP.life[j]<=0)continue;SP.life[j]-=dt;
    if(SP.life[j]<=0||pos[j*3+1]<.02){SP.life[j]=0;pos[j*3+1]=-999;continue;}
    SP.vel[j*3+1]-=9.8*dt;pos[j*3]+=SP.vel[j*3]*dt;pos[j*3+1]+=SP.vel[j*3+1]*dt;pos[j*3+2]+=SP.vel[j*3+2]*dt;}
  SP.pts.geometry.attributes.position.needsUpdate=true;
  // lamps flicker once the deck is hurt; emergency light is dimmer; smoke drifts; fires lick
  for(const F of D.flick){F.k-=dt;if(F.k<0){F.k=Math.random()*.4;F.m.material.color.setHex(Math.random()<.45?0x1a2030:0xd6ecff);}}
  if(!D.dip||D.dip<=0){if(t>=2&&Math.random()<dt*2.5)D.dip=.06+Math.random()*.16;}else D.dip-=dt;
  const base=D.spineI*(t>=4?1.3:1)*(D.dip>0?1-DECK_WAR.flicker:1);
  for(const l of D.spineLights)l.intensity=base;
  for(const s of D.smoke){s.m.position.x=s.x+Math.sin(D.t*.12+s.ph)*1.5;s.m.material.opacity=.4+Math.sin(D.t*.3+s.ph)*.1;}
  D.emberM.opacity=.6+Math.sin(D.t*1.7)*.2+Math.sin(D.t*7.3)*.08;
  for(let i=0;i<D.burn.length;i++)D.burn[i].material.opacity=.55+Math.sin(D.t*9+i*2)*.2+Math.random()*.15;
  for(const e of D.fleet)for(let i=0;i<e.fires.length;i++)e.fires[i].material.opacity=e.fires[i].visible?.6+Math.sin(D.t*6+i)*.25:0;
  // battle stations: the beacons and the wash pulse together
  const on=D.alertG.visible,p=.5+.5*Math.sin(D.t*Math.PI*2*DECK_WAR.alertPulse);
  D.alertM.opacity=.25+.75*p;
  D.alertLights.forEach((l,i)=>l.intensity=on?(i===1?2.6:1.8)*p:0);
  dkEngTick();   // the reactor's pulse (js/deckeng.js)
}

/* ---- the fleet out the windows: the destroyers that have joined, named, and burning when hurt ---- */
const DK_FLEET_AT=[[-320,-60,-900],[420,10,-1500],[-760,40,-1900],[900,-40,-700],[-1100,-30,-520]];
const dkFleetNames=()=>dockFleet().filter(n=>n!=='HALCYON').slice(0,DK_FLEET_AT.length);
function dkFleet(){
  const names=dkFleetNames();
  while(DK.fleet.length<names.length){const i=DK.fleet.length,e=capNew('escort',ESCORT_TYPE,true,i?'ally':'escort');
    e.g.position.set(...DK_FLEET_AT[i]);e.g.scale.setScalar(i?.8:1);DK.scene.add(e.g);
    const sz=new THREE.Box3().setFromObject(e.g).getSize(new THREE.Vector3()).divideScalar(e.g.scale.x),d=Math.hypot(...DK_FLEET_AT[i])/e.g.scale.x;   // in the ship's own units
    e.tag=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false,fog:false}));e.tag.scale.set(d*.26,d*.049,1);   // the same size on screen near or far
    e.tag.position.set(0,sz.y*.6+d*.05,0);e.g.add(e.tag);
    e.fires=[0,1,2,3].map(k=>{const f=stageGlow(0xff6a20,sz.x*(.18+k*.04),.8);f.position.set((k%2?1:-1)*sz.x*.18,sz.y*.08*(k-1),(k/3-.5)*sz.z*.7);e.g.add(f);return f;});
    DK.fleet.push(e);}
  DK.fleet.forEach((e,i)=>{const n=names[i];e.g.visible=!!n;if(!n)return;
    const h=sectorHull(n),key=n+Math.round(h*100);
    if(e.key!==key){e.key=key;const old=e.tag.material.map;
      e.tag.material.map=holoTex(512,96,(g,W,H)=>{g.font='bold 44px monospace';g.textAlign='center';g.textBaseline='middle';
        g.fillStyle=h<.6?'#ff6a5a':h<1?'#ffc23c':'#9fe8ff';g.fillText(n+' · '+Math.round(h*100)+'%',W/2,H/2+2);});
      e.tag.material.needsUpdate=true;if(old)old.dispose();}
    const burning=h>=.95?0:Math.ceil((1-h)*6);e.fires.forEach((f,k)=>f.visible=k<burning);});
}

/* ---- the captains: holograms on the holo table's outer ring, one per destroyer in the fleet ---- */
function dkCaptains(M){
  DK.caps=[];
  const holo=new THREE.MeshBasicMaterial({color:0x5ae0ff,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false}),holoS=holo.clone();holoS.skinning=true;
  const ring=new THREE.MeshBasicMaterial({color:0x29d6ee,blending:THREE.AdditiveBlending,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide});
  [20,160,-25,-155,-90].forEach((deg,i)=>{
    const a=deg*Math.PI/180,x=Math.cos(a)*6.2,z=-84+Math.sin(a)*6.2,yaw=Math.atan2(x,z+84);   // facing the table
    const P=dkPerson(M,{});
    P.g.traverse(o=>{if(!o.isMesh)return;if(o.userData.inkLine||o.material.side===THREE.BackSide||o.material===dkShadowMat())o.visible=false;else o.material=o.isSkinnedMesh?holoS:holo;});
    const pad=new THREE.Mesh(sharedGeo('dkCapPad',()=>new THREE.RingGeometry(.42,.52,32).rotateX(-Math.PI/2)),ring);pad.position.y=.03;P.g.add(pad);
    const beam=new THREE.Mesh(sharedGeo('dkCapBeam',()=>new THREE.CylinderGeometry(.5,.5,2,24,1,true)),new THREE.MeshBasicMaterial({color:0x29d6ee,blending:THREE.AdditiveBlending,transparent:true,opacity:.06,depthWrite:false,side:THREE.DoubleSide}));
    beam.position.y=1;P.g.add(beam);
    P.g.position.set(x,0,z);P.g.rotation.y=yaw;DK.scene.add(P.g);
    const c={P,ph:Math.random()*6,n:0,ship:null,who:{name:'',col:'#9fe8ff'},holo:true};
    c.C={id:'cap'+i,rank:2.5,room:'bridge',x,z,yaw,when:()=>!!c.ship,lines:()=>dkCapLines(c.ship)};
    c.tag=dkTag(' ','#9fe8ff');P.g.add(c.tag);c.betTag=dkTag(' ','#000');c.betTag.visible=false;
    DK.crew.push(c);DK.caps.push(c);
    dkBlock({x,z,r:.45,on:c.C.when});
    DK.acts.push(dkTalkAct(c,c.C.when));
  });
}
function dkCapAssign(){
  const names=dkFleetNames();
  DK.caps.forEach((c,i)=>{const n=names[i]||null;if(c.ship===n)return;c.ship=n;c.n=0;if(!n)return;
    c.who={name:'CAPT. '+(CAPTAINS[n]||'').toUpperCase()+' · '+n,col:'#9fe8ff'};
    const old=c.tag.material.map;c.tag.material.map=holoTex(512,48,(g,W,H)=>{g.font='bold 26px monospace';g.textAlign='center';g.textBaseline='middle';
      g.fillStyle='rgba(4,8,16,.7)';g.fillRect(0,0,W,H);g.fillStyle='#9fe8ff';g.fillText(c.who.name,W/2,H/2+1);});
    c.tag.material.needsUpdate=true;c.tag.scale.set(2.2,.21,1);if(old)old.dispose();});
}
function dkCapLines(n){
  const h=Math.round(sectorHull(n)*100),rank=DOCK.ranks[dockRank(n)].name,
    refits=DOCK.refits.filter(R=>dockRefitLv(n,R.id)).map(R=>R.name.toLowerCase()+' '+dockRefitLv(n,R.id));
  return [h<100?n+' is at '+h+'%. Send the yard crews from the Fleet desk when you can spare the credits.':n+' is green across the board. Ready when you are.',
    rank+' crew on '+n+'. '+(refits.length?'Refits aboard: '+refits.join(', ')+'.':'No refits yet. The Fleet desk has the parts list.'),
    dkNextLine()+' '+n+' will hold your flank.'];
}

/* ---- the ready room: the briefing screen, the contracts board, the side bets board, the reserve ---- */
function dkReady(M){
  const {x0,x1,z0,z1,h}=DK_READY,sc=DK.scene;
  dkBox(M.floor,x0,-.2,z0,x1,0,z1);dkBox(M.ceil,x0,h,z0,x1,h+.3,z1);
  dkWall(M.wall,'x',z0,x0,x1,h);dkWall(M.wall,'x',z1,x0,x1,h);dkWall(M.wall,'z',x1,z0,z1,h);
  for(const s of [z0+.2,z1-.2])dkBox(M.mag,x0,.06,s-.03,x1,.12,s+.03);
  for(let x=x0+3;x<x1-1;x+=4)dkBox(M.lamp,x-.5,h-.06,z0+3,x+.5,h-.02,z1-3);
  dkBox(M.metal,x0,h-.5,z0,x1,h,z0+.4);dkBox(M.metal,x0,h-.5,z1-.4,x1,h,z1);
  // benches in two blocks either side of the aisle from the door, facing the briefing screen
  for(const bx of [8,11,14])for(const [za,zb] of [[7,12.2],[15.8,21]]){
    dkBox(M.dark,bx-.3,0,za,bx+.3,.45,zb);dkBox(M.cloth,bx-.32,.45,za,bx+.32,.56,zb);dkBox(M.metal,bx-.44,.45,za,bx-.32,1.05,zb);
    dkBlock({x0:bx-.46,z0:za,x1:bx+.34,z1:zb});}
  dkSign([['READY ROOM',58],['contracts · side bets',26]],'#ff2d78',3.2,.8,DK_SPINE.x-.17,3.75,14,-Math.PI/2);
  // the briefing screen on the far wall, the contracts board forward, the side bets board aft
  const scr=(w,hh,x,y,z,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,hh),new THREE.MeshBasicMaterial({color:0xc8d4e0}));m.position.set(x,y,z);m.rotation.y=ry;sc.add(m);
    dkBox(M.metal,x-Math.sin(ry)*.05-(ry?0:w/2+.1),y-hh/2-.1,z-Math.cos(ry)*.05-(ry?w/2+.1:0),x-Math.sin(ry)*.02+(ry?0:w/2+.1),y+hh/2+.1,z-Math.cos(ry)*.02+(ry?w/2+.1:0));return m;};
  DK.rdBrief=scr(7,2.6,x1-.2,2.6,14,-Math.PI/2);
  DK.rdCt=scr(6,2.4,11,2.5,z0+.2,0);
  DK.rdBets=scr(6,2.4,11,2.5,z1-.2,Math.PI);
  dkConsole(M,17.2,14,-Math.PI/2,'#ff2d78');dkConsole(M,11,5.6,0,'#ffc23c');
  DK.acts.push({x:17.2,z:14,r:1,room:'ready',get name(){return sectorChoice()?'Sector map':nextMission()?'Briefing':'Sortie board';},
      get sub(){const nm=nextMission();return sectorChoice()?'Pick a target before the jump':nm?nm.name:'All ops clear';},go:dkNextOp},
    {x:11,z:5.6,r:1,room:'ready',name:'Contracts',get sub(){return campaignDone()?'Procedural ops for credits and parts':'Locked · clear Acts I to III';},
      go:()=>{if(campaignDone())openContracts('deck');else dkSay('reyes','Contracts open once Acts I to III are clear. Until then the line comes first.');}});
  dkRect(x0,z0,x1,z1,'ready');
}
function dkReadyDraw(){
  const put=(mesh,w,h,draw)=>{const old=mesh.material.map;mesh.material.map=holoTex(w,h,draw);mesh.material.needsUpdate=true;if(old)old.dispose();};
  const frame=(g,W,H,col,bg,title)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.strokeStyle=col;g.lineWidth=5;g.strokeRect(4,4,W-8,H-8);g.fillStyle=col;g.font='bold 34px monospace';g.fillText(title,28,54);};
  const wrap=(g,text,x,y,w,lh)=>{let line='';for(const word of String(text).split(' ')){const t=line?line+' '+word:word;if(g.measureText(t).width>w&&line){g.fillText(line,x,y);y+=lh;line=word;}else line=t;}if(line)g.fillText(line,x,y);return y+lh;};
  const nm=nextMission(),L=sectorChoice(),bet=dkBetOn(nm);
  put(DK.rdBrief,1024,380,(g,W,H)=>{frame(g,W,H,'#ff2d78','#10040a','READY ROOM // NEXT OP');
    g.fillStyle='#ffe0ec';g.font='bold 46px monospace';g.fillText(L?'SECTOR MAP':nm?nm.name.toUpperCase():'ALL OPS CLEAR',28,118);
    g.fillStyle='#d8a0b8';g.font='26px monospace';let y=wrap(g,L?'Pick a target for '+L.name+', or skip it.':nm?nm.sub+' · '+nm.objective:'Replay any op for a better score.',28,164,W-56,34);
    if(dkAlert()){g.fillStyle='#ff3a4a';g.font='bold 28px monospace';g.fillText('⚠ BATTLE STATIONS · HALCYON IS IN THIS FIGHT',28,y+10);y+=44;}
    if(bet){g.fillStyle='#ffc23c';g.font='26px monospace';g.fillText('◆ '+bet.who+'\'s bet: '+bet.b.label+' · '+dkBetPay(bet.b),28,y+10);}});
  put(DK.rdCt,768,308,(g,W,H)=>{frame(g,W,H,'#ffc23c','#100a02','CONTRACTS');
    if(!campaignDone()){g.fillStyle='#8a6a30';g.font='26px monospace';wrap(g,'Locked. The board opens once Acts I to III are clear.',28,110,W-56,34);return;}
    const C=ctState();g.font='24px monospace';
    ctBoard().forEach((m,i)=>{const y=106+i*58,paid=C.paid[m.id]!==undefined;g.fillStyle=paid?'#6a8a5a':'#ffe0a0';g.fillText(m.name,28,y);
      g.fillStyle=paid?'#6a8a5a':'#c89a50';g.font='20px monospace';g.fillText((paid?'✓ PAID · ':'')+CONTRACTS.threat[m.threat].name.toUpperCase()+' THREAT · '+m.reward.credits+' CR',28,y+24);g.font='24px monospace';});
    g.fillStyle='#8a6a30';g.font='20px monospace';g.fillText('CODE '+C.seed,W-190,H-22);});
  put(DK.rdBets,768,308,(g,W,H)=>{frame(g,W,H,'#ffc23c','#0c0804','SIDE BETS');
    g.font='24px monospace';
    const act=PROG.bet&&DECK_BETS.find(b=>b.id===PROG.bet.id),op=PROG.bet&&missionById(PROG.bet.op);
    g.fillStyle='#ffe0a0';wrap(g,act&&op?'On the book: '+dkBetWho(act)+' · '+act.label+' on '+op.name+' · '+dkBetPay(act):'Nothing on the book. Talk to the crew: some of them will bet on your next op.',28,102,W-56,32);
    const won=Object.keys(PROG.betsWon||{}).length;
    g.fillStyle='#c89a50';g.font='22px monospace';g.fillText('Bets won: '+won,28,H-60);g.fillText('Settled at the debrief. Losing costs nothing.',28,H-28);});
}

/* ---- side bets ---- */
const dkBetWho=b=>{const c=DK&&DK.crew.find(x=>x.C&&x.C.id===b.who);return c?c.who.name:b.who.toUpperCase();};
const dkBetPay=b=>b.parts?'+'+b.parts+' part'+(b.parts>1?'s':''):'+'+b.credits+' cr';
const dkBetSub=b=>b.label+' · '+dkBetPay(b);
/* the bet this crew member would offer on the next op now: none with a bet already on the book */
function dkBetFor(c){
  if(!c.C||PROG.bet)return null;const nm=nextMission();if(!nm)return null;
  return DECK_BETS.find(b=>b.who===c.C.id&&b.ok(nm)&&!(PROG.betsWon||{})[b.id+':'+nm.id])||null;
}
function dkBetTake(c){
  const b=c.offer,nm=nextMission();c.offer=null;if(!b||!nm||PROG.bet)return;
  PROG.bet={id:b.id,op:nm.id};saveProg();sfx('lock');
  dkSay(c.C.id,'You are on. '+b.label+' on '+nm.name+'. '+dkBetPay(b)+' if you do it.');c.talkT=DECK.barkT;dkReadyDraw();
}
/* the bet on the book for op m, as {b, who}, or null */
function dkBetOn(m){
  if(!m||!PROG.bet||PROG.bet.op!==m.id)return null;const b=DECK_BETS.find(x=>x.id===PROG.bet.id);
  return b?{b,who:dkBetWho(b)}:null;
}
const dkBetCheck=(b,m)=>{const val=typeof b.val==='function'?b.val(m):b.val;return b.type==='combo'?S.comboMax>=val:evalBonus({type:b.type,val});};
/* settle the bet at op m's debrief: pays on a win that meets it. Returns the debrief line, or '' */
function dkBetSettle(m,win){
  const on=!m.contract&&!m.side&&dkBetOn(m);if(!on)return '';
  const {b,who}=on,met=win&&dkBetCheck(b,m);
  PROG.bet=null;PROG.betLast={who:b.who,won:met};
  if(met){PROG.betsWon=Object.assign({},PROG.betsWon,{[b.id+':'+m.id]:1});PROG.credits+=b.credits||0;PROG.parts+=b.parts||0;}
  saveProg();
  return met?'<b>'+who+'\'s bet won · '+b.label+' · '+dkBetPay(b)+'</b>':'<span class="rep">'+who+'\'s bet lost · '+b.label+'</span>';
}
/* the datapad's note under the next op */
const dkBetPadLine=()=>{const nm=nextMission(),on=dkBetOn(nm);return on?' · ◆ '+on.who+'\'s bet: '+on.b.label+' ('+dkBetPay(on.b)+')':'';};
/* what a crew member says first: how the last bet went, then the war aboard (DECK_STATUS), once a visit */
function dkStatus(c){
  const id=c.C.id,L=PROG.betLast;
  if(L&&L.who===id){PROG.betLast=null;saveProg();const pool=DECK_BET_LINES[L.won?'won':'lost'];return pool[(Math.random()*pool.length)|0];}
  for(let i=0;i<DECK_STATUS.length;i++){const st=DECK_STATUS[i];
    if(st.who===id&&!DK.said[i]&&st.when()){DK.said[i]=1;return st.line();}}
  return null;
}
