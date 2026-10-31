"use strict";
/* First-person cockpit interiors. Each hull type gets its own layout (visual.cockpit in
   js/data/ships.js):
     fighter     (Razorline) balanced canopy frame, three-screen dash, HUD combiner glass
     interceptor (Viper-9)   frameless bubble canopy, narrow tub, one wide display, side stick
     gunship     (Bulwark)   armoured frame, overhead switch panel, four screens + radar scope,
                             caution lights, twin throttles
     duelist     (Stiletto)  no forward bow: two struts meet in a V over the pilot's head; low centre
                             dash flanked by two angled wing displays (turn gauge, radar), gunsight glass
   The eye point is (0,1.05,.55) in ship space looking down -z (see js/update/camera.js); the
   DOM attitude ball (#adi) sits over the dash centre, so every dash keeps a bezel there. */

let cockpitSweeps=[], cockpitBlinks=[];   // animated by cockpitAnim() while in first person

/* ---------- display textures, drawn once per hull and cached ---------- */
const COCKPIT_TEX={};
const cpHex=n=>'#'+n.toString(16).padStart(6,'0');
function cockpitTex(key,w,h,draw){
  if(COCKPIT_TEX[key])return COCKPIT_TEX[key];
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  draw(g,w,h);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
  return COCKPIT_TEX[key]=t;
}
function cpScreenBase(g,w,h,col){
  g.fillStyle='#02060a';g.fillRect(0,0,w,h);
  g.globalAlpha=.07;g.fillStyle=col;for(let y=0;y<h;y+=4)g.fillRect(0,y,w,1);g.globalAlpha=1;   // scanlines
  g.strokeStyle=col;g.globalAlpha=.5;g.lineWidth=2;g.strokeRect(6,6,w-12,h-12);g.globalAlpha=1;
  g.fillStyle=col;for(let i=1;i<5;i++){g.fillRect(i*w/5-6,0,12,4);g.fillRect(i*w/5-6,h-4,12,4);}   // bezel button ticks
  g.font='bold 15px monospace';g.textBaseline='top';
}
const CP_DRAW={
  radar(g,w,h,col,col2){
    cpScreenBase(g,w,h,col);const cx=w/2,cy=h/2,r=Math.min(w,h)*.42;
    g.strokeStyle=col;g.lineWidth=1.5;
    for(let k=1;k<=3;k++){g.globalAlpha=.25+k*.1;g.beginPath();g.arc(cx,cy,r*k/3,0,Math.PI*2);g.stroke();}
    g.globalAlpha=.3;g.beginPath();g.moveTo(cx-r,cy);g.lineTo(cx+r,cy);g.moveTo(cx,cy-r);g.lineTo(cx,cy+r);g.stroke();
    g.globalAlpha=1;g.fillStyle=col2;
    for(const [a,d] of [[.6,.5],[2.2,.8],[4,.35],[5.3,.7]]){g.fillRect(cx+Math.cos(a)*r*d-4,cy+Math.sin(a)*r*d-4,8,8);}
    g.fillStyle=col;g.fillText('RNG 2K',14,14);
  },
  status(g,w,h,col,col2){
    cpScreenBase(g,w,h,col);g.fillStyle=col;g.fillText('SYS // NOMINAL',14,14);
    // top-down airframe schematic
    g.strokeStyle=col;g.lineWidth=2;g.globalAlpha=.8;const cx=w*.32,cy=h*.58;
    g.beginPath();g.moveTo(cx,cy-60);g.lineTo(cx+14,cy-10);g.lineTo(cx+62,cy+22);g.lineTo(cx+14,cy+26);
    g.lineTo(cx+10,cy+44);g.lineTo(cx-10,cy+44);g.lineTo(cx-14,cy+26);g.lineTo(cx-62,cy+22);g.lineTo(cx-14,cy-10);g.closePath();g.stroke();
    g.globalAlpha=1;
    const labs=['SHLD','HULL','PWR','THR'];
    labs.forEach((l,i)=>{const y=h*.3+i*34;g.fillStyle=col;g.fillText(l,w*.6,y);
      g.globalAlpha=.25;g.fillRect(w*.6,y+18,w*.34,8);g.globalAlpha=1;
      g.fillStyle=i===3?col2:col;g.fillRect(w*.6,y+18,w*.34*(.55+((i*37)%40)/100),8);});
  },
  weapons(g,w,h,col,col2){
    cpScreenBase(g,w,h,col);g.fillStyle=col;g.fillText('WPN // ARMED',14,14);
    const rows=[['LSR','RDY'],['MSL','LOCK'],['TRP','SAFE'],['CM','24']];
    rows.forEach(([a,b],i)=>{const y=52+i*38;g.globalAlpha=.18;g.fillStyle=col;g.fillRect(14,y-4,w-28,30);g.globalAlpha=1;
      g.fillStyle=col;g.fillText(a,24,y+2);g.fillStyle=i===1?col2:col;g.fillText(b,w-24-g.measureText(b).width,y+2);});
  },
  nav(g,w,h,col,col2){
    cpScreenBase(g,w,h,col);g.fillStyle=col;g.fillText('NAV // TRENCH',14,14);
    g.strokeStyle=col;g.globalAlpha=.18;g.lineWidth=1;
    for(let x=0;x<w;x+=24){g.beginPath();g.moveTo(x,36);g.lineTo(x,h);g.stroke();}
    for(let y=36;y<h;y+=24){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    g.globalAlpha=1;g.strokeStyle=col2;g.lineWidth=3;g.beginPath();g.moveTo(w*.15,h*.9);
    g.lineTo(w*.35,h*.6);g.lineTo(w*.5,h*.65);g.lineTo(w*.7,h*.35);g.lineTo(w*.85,h*.22);g.stroke();
    g.fillStyle=col2;g.beginPath();g.arc(w*.85,h*.22,6,0,Math.PI*2);g.fill();
  },
  strip(g,w,h,col,col2){   // the interceptor's one ultrawide display: speed tape, pitch ladder, heading
    g.fillStyle='#02060a';g.fillRect(0,0,w,h);g.strokeStyle=col;g.globalAlpha=.55;g.lineWidth=2;g.strokeRect(4,4,w-8,h-8);
    g.globalAlpha=1;g.font='bold 18px monospace';g.textBaseline='middle';g.fillStyle=col;
    g.fillText('VIPER-9  INTERCEPT',18,h/2);
    for(let i=0;i<40;i++){const x=w*.3+i*(w*.4/40);g.globalAlpha=i%5?.35:.9;g.fillRect(x,h*.3,2,i%5?h*.18:h*.34);}
    g.globalAlpha=1;g.fillStyle=col2;g.beginPath();g.moveTo(w*.5,h*.7);g.lineTo(w*.5-8,h*.86);g.lineTo(w*.5+8,h*.86);g.fill();
    for(let i=0;i<12;i++){g.globalAlpha=i<8?.9:.25;g.fillStyle=i<8?col:col2;g.fillRect(w*.74+i*16,h*.3,11,h*.4);}
    g.globalAlpha=1;
  },
  turn(g,w,h,col,col2){   // the duelist's G / turn-rate gauge: an arc with a redline, rate bars below
    cpScreenBase(g,w,h,col);g.fillStyle=col;g.fillText('G // TURN',14,14);
    const cx=w/2,cy=h*.56,r=Math.min(w,h)*.3,a0=Math.PI*.8,a1=Math.PI*2.2;
    g.lineWidth=10;g.strokeStyle=col;g.globalAlpha=.2;g.beginPath();g.arc(cx,cy,r,a0,a1);g.stroke();
    g.globalAlpha=.9;g.beginPath();g.arc(cx,cy,r,a0,Math.PI*1.7);g.stroke();
    g.strokeStyle=col2;g.beginPath();g.arc(cx,cy,r,Math.PI*1.98,a1);g.stroke();
    g.lineWidth=2;g.strokeStyle=col;g.globalAlpha=.6;
    for(let i=0;i<=9;i++){const a=a0+(a1-a0)*i/9;g.beginPath();g.moveTo(cx+Math.cos(a)*(r-14),cy+Math.sin(a)*(r-14));
      g.lineTo(cx+Math.cos(a)*(r-6),cy+Math.sin(a)*(r-6));g.stroke();}
    g.globalAlpha=1;g.font='bold 26px monospace';g.textAlign='center';g.fillText('6.4G',cx,cy-12);
    g.font='bold 13px monospace';g.textAlign='left';
    for(let i=0;i<10;i++){g.globalAlpha=i<7?.85:.25;g.fillStyle=i<7?col:col2;g.fillRect(w*.14+i*w*.073,h*.84,w*.05,h*.07);}
    g.globalAlpha=1;
  },
  buttons(g,w,h,col,col2){   // switch / key grid for side consoles and the overhead panel
    g.fillStyle='#15181f';g.fillRect(0,0,w,h);
    const cols=8,rows=Math.max(2,Math.round(cols*h/w)),bw=w/cols,bh=h/rows;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=c*bw+bw*.18,y=r*bh+bh*.2,k=(r*7+c*13)%11;
      g.fillStyle='#262b36';g.fillRect(x,y,bw*.64,bh*.6);
      if(k<3){g.fillStyle=k===0?col2:col;g.globalAlpha=.85;g.fillRect(x+bw*.08,y+bh*.08,bw*.48,bh*.12);g.globalAlpha=1;}
      else if(k>8){g.fillStyle='#9aa3b8';g.fillRect(x+bw*.27,y+bh*.1,bw*.1,bh*.4);}   // toggle switch
    }
  },
  caution(g,w,h,col,col2){   // annunciator tiles
    g.fillStyle='#0b0c10';g.fillRect(0,0,w,h);
    const labs=['HYD','FUEL','GEN','O2','SHLD','ECM','APU','FIRE'],n=labs.length,tw=w/n;
    g.font='bold 20px monospace';g.textAlign='center';g.textBaseline='middle';
    labs.forEach((l,i)=>{const hot=i===4||i===7;g.fillStyle=hot?'#2c0a0c':'#2a1f08';g.fillRect(i*tw+4,6,tw-8,h-12);
      g.fillStyle=hot?cpHex(col2):cpHex(col);g.globalAlpha=.75;g.fillText(l,i*tw+tw/2,h/2);g.globalAlpha=1;});
  },
  hazard(g,w,h){
    g.fillStyle='#16130c';g.fillRect(0,0,w,h);g.fillStyle='#c48a12';
    for(let x=-h;x<w;x+=h*1.2){g.beginPath();g.moveTo(x,h);g.lineTo(x+h*.6,h);g.lineTo(x+h*1.2,0);g.lineTo(x+h*.6,0);g.fill();}
  },
  sweep(g,w,h,col){   // radar sweep wedge, rotated each frame over the radar screen
    const cx=w/2,cy=h/2;
    for(let i=0;i<24;i++){g.fillStyle=col;g.globalAlpha=(1-i/24)*.5;g.beginPath();g.moveTo(cx,cy);
      g.arc(cx,cy,w/2,-i*.04-.04,-i*.04,false);g.fill();}
    g.globalAlpha=1;
  },
};
function cpScreenTex(kind,col,col2,w=256,h=200){
  return cockpitTex(kind+col+'_'+col2+'_'+w,w,h,(g,W,H)=>CP_DRAW[kind](g,W,H,
    kind==='caution'?col:cpHex(col),kind==='caution'?col2:cpHex(col2)));
}

/* ---------- mesh helpers ---------- */
function cpBox(par,w,h,d,mat,x,y,z,rx=0,ry=0,rz=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);par.add(m);return m;}
function cpPlane(par,w,h,mat,x,y,z,rx=0,ry=0,rz=0){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);par.add(m);return m;}
/* a framed display: dark bezel with the screen face just proud of it (faces +z of the parent) */
function cpScreen(par,tex,w,h,x,y,mats){
  cpBox(par,w+.045,h+.045,.03,mats.bezel,x,y,.005);
  return cpPlane(par,w,h,new THREE.MeshBasicMaterial({map:tex}),x,y,.022);
}
/* round housing behind the DOM attitude ball */
function cpAdiHousing(par,r,x,y,mats){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.014,8,32),mats.metal);ring.position.set(x,y,.03);par.add(ring);
  const disk=new THREE.Mesh(new THREE.CircleGeometry(r,32),mats.bezel);disk.position.set(x,y,.024);par.add(disk);
}
/* canopy bow: a tube swept along an arch from the left sill over the top to the right sill,
   leaning back from z0 at the sills to zTop overhead */
function cpArch(par,xw,y0,yTop,z0,zTop,tube,mat,zOff=0){
  const pts=[];for(let i=0;i<=16;i++){const t=i/16*Math.PI,s=Math.sin(t);
    pts.push(new THREE.Vector3(-Math.cos(t)*xw,y0+s*(yTop-y0),z0+s*(zTop-z0)+zOff));}
  const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,tube,8,false),mat);par.add(m);return m;
}
function cpRail(par,a,b,tube,mat){   // straight tube between two points
  const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a,b),1,tube,8,false),mat);par.add(m);return m;
}
function cpBlink(par,col,x,y,z,period,phase,size=.022){
  const m=new THREE.Mesh(new THREE.SphereGeometry(size,8,6),new THREE.MeshBasicMaterial({color:col}));
  m.position.set(x,y,z);par.add(m);cockpitBlinks.push({m,period,phase});return m;
}
function cpRadar(par,w,x,y,col,col2,mats){
  cpScreen(par,cpScreenTex('radar',col,col2,256,256),w,w,x,y,mats);
  const sw=new THREE.Mesh(new THREE.PlaneGeometry(w*.86,w*.86),new THREE.MeshBasicMaterial({
    map:cpScreenTex('sweep',col,col,256,256),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  sw.position.set(x,y,.026);par.add(sw);cockpitSweeps.push(sw);
}

/* flight stick: base, gimbal, then stickPivot (tilted with steering input in js/update/hud.js) */
function cpStick(par,x,y,z,scale,mats,trigMat,guard){
  const st=new THREE.Group();st.position.set(x,y,z);st.rotation.x=.32;st.scale.setScalar(scale);par.add(st);
  st.add(new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,.12,12),mats.frame));
  const boot=new THREE.Mesh(new THREE.CylinderGeometry(.05,.11,.14,10),mats.grip);boot.position.y=.12;st.add(boot);
  stickPivot=new THREE.Group();stickPivot.position.y=.08;st.add(stickPivot);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.46,8),mats.metal);shaft.position.y=.24;stickPivot.add(shaft);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.07,.085,.26,10),mats.grip);grip.position.set(0,.55,.01);grip.rotation.x=-.15;stickPivot.add(grip);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),mats.grip);head.position.set(0,.69,-.01);head.scale.set(1,.7,1.15);stickPivot.add(head);
  cpBox(stickPivot,.1,.055,.02,trigMat,0,.53,.085);
  const hat=new THREE.Mesh(new THREE.SphereGeometry(.026,8,6),mats.metal);hat.position.set(0,.74,.02);stickPivot.add(hat);
  if(guard){const gd=new THREE.Mesh(new THREE.TorusGeometry(.1,.014,6,16,Math.PI),mats.metal);
    gd.position.set(0,.55,.07);gd.rotation.set(0,Math.PI/2,Math.PI/2);stickPivot.add(gd);}
}
/* throttle quadrant: rail with a lit guide slot; throttleLever slides along it (js/update/hud.js) */
function cpThrottle(par,x,y,z,twin,mats,guideMat,knobMat){
  const thr=new THREE.Group();thr.position.set(x,y,z);thr.rotation.x=.22;par.add(thr);
  cpBox(thr,twin?.24:.13,.06,.52,mats.frame,0,0,0);
  cpBox(thr,.02,.02,.46,guideMat,twin?-.05:0,.032,0);if(twin)cpBox(thr,.02,.02,.46,guideMat,.05,.032,0);
  throttleLever=new THREE.Group();thr.add(throttleLever);
  for(const lx of twin?[-.05,.05]:[0]){
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.26,8),mats.metal);stem.position.set(lx,.13,0);stem.rotation.x=-.35;throttleLever.add(stem);
  }
  cpBox(throttleLever,twin?.22:.15,.09,.12,mats.grip,0,.26,-.05);
  cpBox(throttleLever,twin?.2:.13,.012,.02,knobMat,0,.31,-.05);
}

function cockpitMaterials(style){
  const env=getShipEnvMap(),panel=getHullPanelTex();
  const acc=(c,o)=>new THREE.MeshBasicMaterial({color:c,blending:THREE.AdditiveBlending,transparent:true,opacity:o,depthWrite:false});
  return {
    frame:new THREE.MeshStandardMaterial({color:style.frame,map:panel,metalness:.5,roughness:.55,envMap:env,envMapIntensity:.15}),
    panel:new THREE.MeshStandardMaterial({color:style.panel,map:panel,metalness:.2,roughness:.85,envMap:env,envMapIntensity:.06}),
    bezel:new THREE.MeshStandardMaterial({color:0x06070a,metalness:.4,roughness:.6}),
    metal:new THREE.MeshStandardMaterial({color:0x3a3f4a,metalness:.85,roughness:.35,envMap:env,envMapIntensity:.3}),
    grip :new THREE.MeshStandardMaterial({color:0x060709,metalness:.1,roughness:.9}),
    acc  :acc(style.acc,.45), acc2:acc(style.acc2,.4), accDim:acc(style.acc,.2),
    glass2:new THREE.MeshBasicMaterial({color:style.acc2,transparent:true,opacity:.05,blending:THREE.AdditiveBlending,depthWrite:false}),
  };
}

/* ---------- Razorline: balanced fighter ---------- */
function cockpitFighter(g,cfg,M2){
  const A=cfg.edgeColor2,B=cfg.edgeColor;   // cyan displays, magenta warnings
  // dash, tilted back toward the pilot; children sit on its face (local +z)
  const dash=new THREE.Group();dash.position.set(0,.6,-.34);dash.rotation.x=-.42;g.add(dash);
  cpBox(dash,1.95,.52,.1,M2.panel,0,0,-.05);
  cpScreen(dash,cpScreenTex('radar',A,B),.34,.27,-.62,.01,M2);
  cpScreen(dash,cpScreenTex('weapons',A,B),.34,.27,.62,.01,M2);
  cpAdiHousing(dash,.12,0,.02,M2);
  cpPlane(dash,.22,.3,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,256,320)}),-.3,0,.012);
  cpPlane(dash,.22,.3,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',B,A,256,320)}),.3,0,.012);
  cpPlane(dash,.62,.06,new THREE.MeshBasicMaterial({map:cpScreenTex('caution',0xffb300,0xff2d78,512,48)}),0,-.2,.012);
  for(let i=0;i<5;i++)cpBlink(dash,i%2?A:0xffb300,-.24+i*.12,.22,.02,1.6+i*.37,i*.5,.014);
  // glareshield hood over the top of the dash, lit lip toward the pilot
  cpBox(g,1.98,.05,.32,M2.frame,0,.855,-.55);
  cpBox(g,1.7,.012,.012,M2.acc,0,.828,-.39);
  // HUD combiner: two posts and a faint tinted glass pane at the centre of view
  for(const sx of[-1,1])cpBox(g,.012,.2,.012,M2.metal,sx*.19,.97,-.6,-.2);
  cpPlane(g,.38,.2,M2.glass2,0,.98,-.6,-.2);
  cpBox(g,.38,.008,.008,M2.acc2,0,1.08,-.62,-.2);
  // canopy: one bow ahead of the pilot, sills running back along each side
  cpArch(g,1.08,.8,1.98,-.58,-.12,.05,M2.frame);
  cpArch(g,1.08,.8,1.98,-.58,-.12,.012,M2.acc,.05);
  for(const sx of[-1,1]){
    cpRail(g,new THREE.Vector3(sx*1.08,.8,-.58),new THREE.Vector3(sx*1.12,.86,1.1),.06,M2.frame);
    cpRail(g,new THREE.Vector3(sx*1.04,.8,-.5),new THREE.Vector3(sx*1.08,.86,1.1),.01,M2.accDim);
    // side walls closing the tub, with switch panels facing in
    cpBox(g,.08,.5,1.7,M2.panel,sx*1.04,.52,.25);
    cpPlane(g,.6,.24,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,320,128)}),sx*.995,.62,-.15,0,-sx*Math.PI/2);
  }
  cpStick(g,.3,-.02,-.12,.75,M2,new THREE.MeshBasicMaterial({color:B}),false);
  cpThrottle(g,-.66,.38,0,false,M2,new THREE.MeshBasicMaterial({color:A}),new THREE.MeshBasicMaterial({color:0xffb300}));
  return {light:0x6fd8ff,lightI:.3};
}

/* ---------- Viper-9: interceptor ---------- */
function cockpitInterceptor(g,cfg,M2){
  const A=cfg.edgeColor,B=0xffffff;
  // low, narrow wedge dash: one ultrawide display across the top, ADI housing below it
  const dash=new THREE.Group();dash.position.set(0,.58,-.36);dash.rotation.x=-.55;g.add(dash);
  cpBox(dash,1.3,.46,.08,M2.panel,0,0,-.04);
  cpScreen(dash,cpScreenTex('strip',A,0xff2d78,768,96),1.08,.135,0,.15,M2);
  cpAdiHousing(dash,.11,0,-.04,M2);
  cpPlane(dash,.3,.16,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,320,170)}),-.42,-.06,.012);
  cpPlane(dash,.3,.16,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,320,170)}),.42,-.06,.012);
  // thin sloped cowl with a single lit edge
  cpBox(g,1.36,.03,.24,M2.frame,0,.79,-.56,.12);
  cpBox(g,1.2,.01,.01,M2.acc,0,.785,-.44);
  // narrow tub: sides close in, low sills, long rails running back to the seat
  for(const sx of[-1,1]){
    cpBox(g,.06,.42,1.6,M2.panel,sx*.74,.5,.2);
    cpBox(g,.12,.035,1.6,M2.frame,sx*.74,.72,.2);
    cpBox(g,.01,.01,1.5,M2.acc,sx*.69,.74,.2);
    cpPlane(g,.5,.18,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,320,128)}),sx*.705,.58,-.1,0,-sx*Math.PI/2);
  }
  // bubble canopy: the only bow sits behind the pilot's head, so the view ahead is clear;
  // a faint glass sheen and the canopy edge are all that frame the forward view
  cpArch(g,1.0,.74,1.62,.25,.62,.035,M2.frame);
  for(const sx of[-1,1])cpRail(g,new THREE.Vector3(sx*.78,.74,-1.1),new THREE.Vector3(sx*1.0,.74,.3),.022,M2.frame);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({
    color:0x7fdcff,transparent:true,opacity:.025,blending:THREE.AdditiveBlending,side:THREE.BackSide,depthWrite:false}));
  shell.scale.set(.98,.95,1.9);shell.position.set(0,.74,-.3);g.add(shell);
  // side stick on the right console, throttle on the left: nothing between the pilot's knees
  cpStick(g,.52,.46,0,.45,M2,new THREE.MeshBasicMaterial({color:A}),false);
  cpThrottle(g,-.58,.42,.08,false,M2,M2.accDim,M2.accDim);
  return {light:0x9fe8ff,lightI:.22};
}

/* ---------- Bulwark: armoured gunship ---------- */
function cockpitGunship(g,cfg,M2){
  const A=cfg.edgeColor,B=cfg.edgeColor2;   // amber displays, red warnings
  const dash=new THREE.Group();dash.position.set(0,.6,-.36);dash.rotation.x=-.32;g.add(dash);
  cpBox(dash,2.3,.6,.12,M2.panel,0,0,-.06);
  cpScreen(dash,cpScreenTex('status',A,B),.3,.24,-.86,.05,M2);
  cpRadar(dash,.27,-.48,.04,A,B,M2);
  cpAdiHousing(dash,.13,0,.03,M2);
  cpScreen(dash,cpScreenTex('nav',A,B),.3,.24,.48,.05,M2);
  cpScreen(dash,cpScreenTex('weapons',A,B),.3,.24,.86,.05,M2);
  cpPlane(dash,.9,.07,new THREE.MeshBasicMaterial({map:cpScreenTex('caution',A,B,640,52)}),0,-.21,.012);
  for(let i=0;i<8;i++)cpBlink(dash,i%3?A:B,-.98+i*.28,.27,.02,.9+i*.31,i*.7,.016);
  // heavy glareshield with a hazard-striped lip
  cpBox(g,2.3,.08,.36,M2.frame,0,.88,-.58);
  cpPlane(g,2.2,.05,new THREE.MeshBasicMaterial({map:cockpitTex('hazard',512,24,CP_DRAW.hazard)}),0,.85,-.395);
  // armoured canopy frame: thick flattened bow plus angled side-window struts
  cpArch(g,1.12,.84,1.8,-.62,-.32,.08,M2.frame);
  cpArch(g,1.12,.84,1.8,-.62,-.32,.014,M2.acc2,.08);
  for(const sx of[-1,1]){
    cpRail(g,new THREE.Vector3(sx*1.12,.84,-.62),new THREE.Vector3(sx*1.0,1.75,.2),.06,M2.frame);
    cpRail(g,new THREE.Vector3(sx*1.12,.84,-.62),new THREE.Vector3(sx*1.18,.9,1.1),.075,M2.frame);
    cpBox(g,.1,.6,1.8,M2.panel,sx*1.1,.52,.25);
    cpPlane(g,.7,.3,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,320,140)}),sx*1.045,.6,-.15,0,-sx*Math.PI/2);
  }
  // overhead switch panel hanging from the roof, angled down at the pilot
  const ovh=new THREE.Group();ovh.position.set(0,1.72,-.28);ovh.rotation.x=.95;g.add(ovh);
  cpBox(ovh,1.0,.34,.08,M2.frame,0,0,-.04);
  cpPlane(ovh,.9,.26,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,512,150)}),0,0,.003);
  for(let i=0;i<4;i++)cpBlink(ovh,i===2?B:A,-.33+i*.22,-.15,.02,1.2+i*.45,i,.014);
  cpStick(g,.36,-.04,-.12,.85,M2,new THREE.MeshBasicMaterial({color:B}),true);
  cpThrottle(g,-.7,.38,0,true,M2,new THREE.MeshBasicMaterial({color:A}),new THREE.MeshBasicMaterial({color:B}));
  return {light:0xffa040,lightI:.3};
}

/* ---------- Stiletto: dogfighter ---------- */
function cockpitDuelist(g,cfg,M2){
  const A=cfg.edgeColor,B=cfg.edgeColor2;   // mint displays, gold warnings
  // short centre dash round the ADI, low enough to keep the nose view open
  const dash=new THREE.Group();dash.position.set(0,.58,-.34);dash.rotation.x=-.48;g.add(dash);
  cpBox(dash,.92,.44,.09,M2.panel,0,0,-.045);
  cpAdiHousing(dash,.12,0,.03,M2);
  cpPlane(dash,.18,.26,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,256,360)}),-.31,.01,.012);
  cpPlane(dash,.18,.26,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',B,A,256,360)}),.31,.01,.012);
  cpPlane(dash,.56,.05,new THREE.MeshBasicMaterial({map:cpScreenTex('caution',B,0xff3b3b,512,44)}),0,-.18,.012);
  for(let i=0;i<4;i++)cpBlink(dash,i===1?B:A,-.18+i*.12,.19,.02,1.3+i*.41,i*.6,.013);
  // wing displays angled in toward the pilot on either side: turn gauge to port, radar to starboard
  for(const sx of[-1,1]){
    const wing=new THREE.Group();wing.position.set(sx*.69,.63,-.24);wing.rotation.set(-.38,-sx*.6,0,'YXZ');g.add(wing);
    cpBox(wing,.44,.46,.08,M2.panel,0,0,-.04);
    if(sx<0)cpScreen(wing,cpScreenTex('turn',A,B,256,256),.36,.36,0,.01,M2);else cpRadar(wing,.34,0,.01,A,B,M2);
    cpBox(wing,.44,.012,.012,M2.acc,0,.235,0);
  }
  // slim glareshield and a small gunsight glass just under the line of sight, ring etched on it
  cpBox(g,1.0,.03,.22,M2.frame,0,.8,-.52);
  cpBox(g,.9,.01,.01,M2.acc,0,.79,-.41);
  cpBox(g,.012,.12,.012,M2.metal,0,.86,-.6,-.25);
  cpPlane(g,.2,.12,M2.glass2,0,.93,-.62,-.25);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.04,.003,6,28),M2.acc2);ring.position.set(0,.935,-.615);ring.rotation.x=-.25;g.add(ring);
  // canopy: nothing ahead of the pilot; two struts rise from the front sill corners and meet in a V over
  // the pilot's head, then one spine runs back to the seat
  const apex=new THREE.Vector3(0,1.9,.3);
  for(const sx of[-1,1]){
    cpRail(g,new THREE.Vector3(sx*.9,.8,-.85),apex,.03,M2.frame);
    cpRail(g,new THREE.Vector3(sx*.86,.81,-.81),new THREE.Vector3(0,1.86,.32),.008,M2.acc);
    cpRail(g,new THREE.Vector3(sx*.9,.8,-.85),new THREE.Vector3(sx*.98,.8,1.1),.04,M2.frame);
    cpBox(g,.07,.44,1.7,M2.panel,sx*.95,.52,.25);
    cpPlane(g,.56,.2,new THREE.MeshBasicMaterial({map:cpScreenTex('buttons',A,B,320,120)}),sx*.91,.6,.15,0,-sx*Math.PI/2);
  }
  cpRail(g,apex,new THREE.Vector3(0,1.78,1.2),.04,M2.frame);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({
    color:0x9fffd8,transparent:true,opacity:.02,blending:THREE.AdditiveBlending,side:THREE.BackSide,depthWrite:false}));
  shell.scale.set(.98,1.1,1.8);shell.position.set(0,.8,.1);g.add(shell);
  cpStick(g,.28,-.02,-.1,.72,M2,new THREE.MeshBasicMaterial({color:B}),false);
  cpThrottle(g,-.7,.18,.05,false,M2,new THREE.MeshBasicMaterial({color:A}),new THREE.MeshBasicMaterial({color:B}));
  return {light:0x7dffc8,lightI:.26};
}

const COCKPIT_STYLES={
  fighter    :{build:cockpitFighter,    frame:0x10141c,panel:0x0a0c12,acc:0xff2d78,acc2:0x00f0ff},
  interceptor:{build:cockpitInterceptor,frame:0x262a33,panel:0x0f1116,acc:0x00f0ff,acc2:0x00f0ff},
  gunship    :{build:cockpitGunship,    frame:0x1a1810,panel:0x0e0d0a,acc:0xffb300,acc2:0xff3b3b},
  duelist    :{build:cockpitDuelist,    frame:0x182224,panel:0x0b1012,acc:0x3dffa8,acc2:0xffd23d},
};
/* Builds the interior for a hull into a new group. Returns {group, light, lightI}: the cabin
   light colour and the intensity it runs at in first person (set on cabLight by buildShip). */
function buildCockpit(cfg){
  cockpitSweeps=[];cockpitBlinks=[];
  const style=COCKPIT_STYLES[cfg.cockpit]||COCKPIT_STYLES.fighter;
  const g=new THREE.Group();
  const lt=style.build(g,cfg,cockpitMaterials(style));
  return {group:g,light:lt.light,lightI:lt.lightI};
}
function cockpitAnim(dt){
  for(const s of cockpitSweeps)s.rotation.z-=dt*2.4;
  for(const b of cockpitBlinks)b.m.visible=((S.time+b.phase)%b.period)<b.period*.55;
}
