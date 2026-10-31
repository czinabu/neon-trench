"use strict";
/* Live cockpit instruments. The screens, annunciator strips and status lamps built by js/cockpit.js
   show the real ship state instead of fixed pictures:
     radar    contacts around you (enemies, capital ships, wingmen, missiles inbound, the exhaust port),
              forward is up, the selected target boxed; blips past the range ring sit on the edge
     weapons  guns, missiles and lock, flares and their recharge, boost, the selected target
     status   shield, hull, boost energy and throttle bars; the airframe drawing reddens with damage
     nav      trench progress to the port, or the arena objective
     strip    (Viper-9) speed, heading tape and boost cells
     turn     (Stiletto) G load and turn rate
     caution  annunciator tiles that light (and blink) on real faults: see CP_COND
   cpScreenTex() hands out a live texture for any kind in CP_LIVE; cockpitLiveUpdate() (called by
   updateHud in first person) redraws them a few times a second and drives the lamps every frame. */

const CP_LIVE_HZ=12;
let cockpitLive=[], cockpitLamps=[], cockpitLiveT=0;
const cpLiveV=new THREE.Vector3(), cpLiveQ=new THREE.Quaternion(), cpLiveE=new THREE.Euler(0,0,0,'YXZ');
const cpTurn={q:new THREE.Quaternion(),rate:0,g:1,init:false};   // turn rate (rad/s, pitch + yaw only) and G for the turn gauge

/* light state for a caution tile or lamp: 0 off, 1 lit, 2 blinking */
const CP_COND={
  HYD :()=>S.hull<50?1:0,
  FUEL:()=>S.boostLock?2:S.boostE<25?1:0,
  GEN :()=>S.shield<=0?2:0,
  O2  :()=>S.hull<20?2:0,
  SHLD:()=>S.shield<30?2:0,
  ECM :()=>S.mslWarnD<650?2:S.lockWarn?1:0,
  APU :()=>S.cruise||S.auto?1:0,
  FIRE:()=>S.hull<35?2:0,
  MSL :()=>S.missiles>0?1:0,
  LCK :()=>S.lockTarget&&S.lockT>=1?1:S.lockTarget&&S.lockT>0?2:0,
  BST :()=>S.boostLock?2:S.boost?1:0,
  CM  :()=>S.cm>0?1:0,
  TGT :()=>S.target?1:0,
  GUN :()=>S.buffT>0?2:S.fireHeld&&!S.mslMode?1:0,
  SHD :()=>S.shield<30?2:S.shield>0?1:0,
  CRZ :()=>S.cruise?1:0,
  AUT :()=>S.auto?1:0,
  WRN :()=>S.mslWarnD<650||S.lockWarn||S.hull<35||S.shield<30?2:0,
};
const cpBlinkOn=()=>(S.time*3.2)%1<.55;
const cpLit=k=>{const c=CP_COND[k]?CP_COND[k]():0;return c===1||(c===2&&cpBlinkOn());};

/* ---------- per-frame data the screens share ---------- */
const CPD={arena:false,spd:0,vmax:1,mslMax:1};
function cpLiveData(arena){
  CPD.arena=!!arena;
  CPD.spd=S.vel.length();
  CPD.vmax=MAX_SPD*curShip.spdMul*BOOST_MULT;
  CPD.mslMax=MSL_MAX+curShip.mslBonus;
  return CPD;
}
function cpBar(g,x,y,w,h,f,col){
  g.globalAlpha=.22;g.fillStyle=col;g.fillRect(x,y,w,h);
  g.globalAlpha=1;g.fillRect(x,y,w*Math.max(0,Math.min(1,f)),h);
}
function cpRight(g,t,x,y){g.fillText(t,x-g.measureText(t).width,y);}

const CP_LIVE={
  radar(L,D){
    const {g,w,h,col,col2}=L;cpScreenBase(g,w,h,col);
    const cx=w/2,cy=h/2,r=Math.min(w,h)*.42,rng=D.arena?1600:800;
    g.strokeStyle=col;g.lineWidth=1.5;
    for(let k=1;k<=3;k++){g.globalAlpha=.2+k*.1;g.beginPath();g.arc(cx,cy,r*k/3,0,Math.PI*2);g.stroke();}
    g.globalAlpha=.25;g.beginPath();g.moveTo(cx-r,cy);g.lineTo(cx+r,cy);g.moveTo(cx,cy-r);g.lineTo(cx,cy+r);g.stroke();
    g.globalAlpha=1;g.fillStyle=col;g.fillText('RNG '+(rng/1000).toFixed(1)+'K',14,14);
    // own ship: a chevron pointing up (forward)
    g.beginPath();g.moveTo(cx,cy-7);g.lineTo(cx+5,cy+5);g.lineTo(cx,cy+2);g.lineTo(cx-5,cy+5);g.closePath();g.fill();
    if(!ship)return;
    const p=ship.position;cpLiveQ.copy(ship.quaternion).invert();
    let n=0;
    // returns the screen point for a world position, or null; far contacts clamp to the rim
    const plot=(pos,maxR)=>{
      cpLiveV.copy(pos).sub(p);if(maxR&&cpLiveV.length()>maxR)return null;
      cpLiveV.applyQuaternion(cpLiveQ);
      let x=cpLiveV.x/rng,y=cpLiveV.z/rng;const d=Math.hypot(x,y),edge=d>1;
      if(edge){x/=d;y/=d;}
      return {x:cx+x*r,y:cy+y*r,edge,up:cpLiveV.y};
    };
    const blip=(pos,c,s,shape,maxR)=>{
      const b=plot(pos,maxR);if(!b)return null;
      g.fillStyle=c;g.globalAlpha=b.edge?.5:1;const z=b.edge?s*.7:s;
      if(shape==='tri'){g.beginPath();g.moveTo(b.x,b.y-z);g.lineTo(b.x+z,b.y+z*.8);g.lineTo(b.x-z,b.y+z*.8);g.closePath();g.fill();}
      else if(shape==='dia'){g.beginPath();g.moveTo(b.x,b.y-z);g.lineTo(b.x+z,b.y);g.lineTo(b.x,b.y+z);g.lineTo(b.x-z,b.y);g.closePath();g.fill();}
      else g.fillRect(b.x-z/2,b.y-z/2,z,z);
      // altitude tick: contacts well above or below you trail a short line up or down
      if(!b.edge&&Math.abs(b.up)>rng*.08){g.fillRect(b.x-.75,b.up>0?b.y-z-6:b.y+z/2,1.5,6);}
      g.globalAlpha=1;n++;return b;
    };
    for(const T of turrets)if(!T.dead)blip(T.mesh.position,col2,4,'sq',rng*1.2);
    if(exhaustPort&&!D.arena){exhaustPort.getWorldPosition(sv3Live);blip(sv3Live,col,9,'dia');}
    for(const C of capitals)if(C.state!=='wreck'&&!C.dead)blip(C.g.position,C.friendly?col:col2,14,'sq');
    for(const W of wingmen)if(!W.dead)blip(W.mesh.position,col,6,'tri');
    for(const B of bombers)if(!B.dead)blip(B.mesh.position,col2,9,'sq');
    for(const F of fighters)if(!F.dead)blip(F.mesh.position,col2,6,'sq');
    if(cpBlinkOn())for(const E of eMsls)if(!E.decoy)blip(E.m.position,'#ffffff',4,'sq');
    const tg=S.target;
    if(tg&&!tg.dead&&tg.mesh){const b=plot(tg.mesh.position);
      if(b){g.strokeStyle='#ffffff';g.lineWidth=1.5;g.strokeRect(b.x-8,b.y-8,16,16);}}
    g.fillStyle=col;cpRight(g,String(n),w-14,14);
  },
  weapons(L,D){
    const {g,w,h,col,col2}=L;cpScreenBase(g,w,h,col);
    g.fillStyle=col;g.fillText(S.mslMode?'WPN // MISSILE':'WPN // GUNS',14,14);
    const locked=S.lockTarget&&S.lockT>=1, cmMax=curShip.cmMax;
    const rows=[
      ['LSR',S.mslMode?'SAFE':S.buffT>0?'OVRD':S.fireHeld?'FIRE':'RDY',S.buffT>0,null],
      ['MSL',S.missiles<=0?'EMPTY':S.missiles+'/'+D.mslMax+(locked?' LOCK':S.lockTarget&&S.mslMode?' '+Math.round(S.lockT*100)+'%':''),locked||S.missiles<=0,S.missiles/D.mslMax],
      ['CM',S.cm>0?S.cm+'/'+cmMax:'RCHG',S.cm<=0||((S.mslWarnD<650||S.lockWarn)&&S.cm>0),S.cm<cmMax?S.cmT/curShip.cmRecharge:null],
      ['BST',S.boostLock?'RCHG':S.boost?'ON':Math.round(S.boostE)+'%',S.boostLock,S.boostE/100],
    ];
    const y0=40,step=(h-y0-30)/rows.length;
    g.textBaseline='middle';
    rows.forEach(([a,b,hot,f],i)=>{const y=y0+i*step;
      g.globalAlpha=.16;g.fillStyle=col;g.fillRect(14,y,w-28,step-6);g.globalAlpha=1;
      g.fillStyle=col;g.fillText(a,24,y+(step-6)/2);
      g.fillStyle=hot?col2:col;cpRight(g,b,w-24,y+(step-6)/2);
      if(f!=null){g.fillStyle=hot?col2:col;cpBar(g,14,y+step-9,w-28,3,f,hot?col2:col);}
    });
    const tg=S.target;
    g.fillStyle=tg?col2:col;g.globalAlpha=tg?1:.5;
    g.fillText(tg&&!tg.dead?'TGT '+(isTurret(tg)?'TURRET':targetName(tg))+' '+Math.round(tg.mesh.position.distanceTo(ship.position))+'M':'TGT ---',14,h-16);
    g.globalAlpha=1;g.textBaseline='top';
  },
  status(L,D){
    const {g,w,h,col,col2}=L;cpScreenBase(g,w,h,col);
    const hit=S.time-S.lastHit<.35, dmg=S.hull<35?'CRITICAL':S.hull<70?'DAMAGED':'NOMINAL';
    g.fillStyle=hit||S.hull<35?col2:col;g.fillText('SYS // '+(hit?'IMPACT':dmg),14,14);
    // top-down airframe, drawn in the warning colour as the hull goes; the shield is a ring round it
    const cx=w*.32,cy=h*.58;
    if(S.shield>0){g.strokeStyle=col;g.lineWidth=2;g.globalAlpha=.15+S.shield/100*.6;
      g.beginPath();g.ellipse(cx,cy,74,70,0,0,Math.PI*2);g.stroke();}
    g.strokeStyle=S.hull<35?col2:S.hull<70?'#ffb300':col;g.lineWidth=2;g.globalAlpha=hit?1:.85;
    g.beginPath();g.moveTo(cx,cy-60);g.lineTo(cx+14,cy-10);g.lineTo(cx+62,cy+22);g.lineTo(cx+14,cy+26);
    g.lineTo(cx+10,cy+44);g.lineTo(cx-10,cy+44);g.lineTo(cx-14,cy+26);g.lineTo(cx-62,cy+22);g.lineTo(cx-14,cy-10);g.closePath();g.stroke();
    g.globalAlpha=1;
    const bars=[['SHLD',S.shield/100,S.shield<30],['HULL',S.hull/100,S.hull<35],['PWR',S.boostE/100,S.boostLock],['THR',Math.abs(S.throttle),S.throttle<0]];
    bars.forEach(([l,f,hot],i)=>{const y=h*.24+i*(h*.17);
      g.fillStyle=hot?col2:col;g.fillText(l,w*.6,y);cpRight(g,Math.round(f*100)+'',w*.94,y);
      cpBar(g,w*.6,y+18,w*.34,8,f,hot?col2:col);});
  },
  nav(L,D){
    const {g,w,h,col,col2}=L;cpScreenBase(g,w,h,col);
    g.fillStyle=col;g.fillText(D.arena?(S.fleet?'NAV // FLEET':'NAV // ARENA'):S.escape?'NAV // ESCAPE':'NAV // TRENCH',14,14);
    g.strokeStyle=col;g.globalAlpha=.15;g.lineWidth=1;
    for(let x=0;x<w;x+=24){g.beginPath();g.moveTo(x,36);g.lineTo(x,h-30);g.stroke();}
    for(let y=36;y<h-30;y+=24){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    g.globalAlpha=1;
    const f=Math.max(0,Math.min(1,(parseFloat(railF.style.width)||0)/100));
    if(!D.arena){
      // the run as a route: travelled leg bright, the rest dim, you a dot, the port at the end
      const pts=[[.12,.82],[.32,.6],[.48,.66],[.68,.4],[.86,.24]].map(([x,y])=>[x*w,y*h]);
      const segL=[];let tot=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);segL.push(l);tot+=l;}
      g.lineWidth=3;g.strokeStyle=col;g.globalAlpha=.3;g.beginPath();g.moveTo(...pts[0]);for(const q of pts.slice(1))g.lineTo(...q);g.stroke();
      g.globalAlpha=1;g.strokeStyle=col2;g.beginPath();g.moveTo(...pts[0]);
      let left=f*tot,sx=pts[0][0],sy=pts[0][1];
      for(let i=1;i<pts.length&&left>0;i++){const k=Math.min(1,left/segL[i-1]);
        sx=pts[i-1][0]+(pts[i][0]-pts[i-1][0])*k;sy=pts[i-1][1]+(pts[i][1]-pts[i-1][1])*k;g.lineTo(sx,sy);left-=segL[i-1];}
      g.stroke();
      g.fillStyle=col;g.beginPath();g.arc(pts[4][0],pts[4][1],7,0,Math.PI*2);g.fill();
      g.fillStyle=col2;g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();
    }else{
      // objective progress as one wide bar, with how far the fight has come
      g.fillStyle=col;cpBar(g,w*.1,h*.48,w*.8,14,f,col2);
      g.fillStyle=col;g.fillText(Math.round(f*100)+'%',w*.1,h*.48-22);
    }
    g.fillStyle=col;g.fillText(distV.textContent.slice(0,22),14,h-24);
  },
  strip(L,D){   // the interceptor's one ultrawide display: speed, heading tape, boost cells
    const {g,w,h,col,col2}=L;
    g.fillStyle='#02060a';g.fillRect(0,0,w,h);g.strokeStyle=col;g.globalAlpha=.55;g.lineWidth=2;g.strokeRect(4,4,w-8,h-8);
    g.globalAlpha=1;g.textBaseline='middle';g.fillStyle=col;
    g.font='bold 34px monospace';g.fillText(String(Math.round(D.spd)).padStart(3,'0'),18,h*.42);
    g.font='bold 14px monospace';g.fillText('M/S',96,h*.36);
    g.fillStyle=S.shield<30?col2:col;g.fillText('SH '+Math.round(S.shield),18,h*.78);
    g.fillStyle=S.hull<35?col2:col;g.fillText('HL '+Math.round(S.hull),104,h*.78);
    // heading tape: ticks every 5 degrees scroll under a fixed caret
    if(ship){cpLiveE.setFromQuaternion(ship.quaternion,'YXZ');}
    const hdg=((-cpLiveE.y*57.2958)%360+360)%360, x0=w*.3,x1=w*.7,span=60;
    g.fillStyle=col;
    for(let a=Math.floor((hdg-span/2)/5)*5;a<=hdg+span/2;a+=5){
      const x=x0+(a-hdg+span/2)/span*(x1-x0);if(x<x0||x>x1)continue;
      const major=((a%30)+30)%30===0;g.globalAlpha=major?.9:.4;g.fillRect(x,h*.22,2,major?h*.3:h*.16);
      if(major){g.font='bold 13px monospace';g.textAlign='center';g.fillText(String(((a%360)+360)%360).padStart(3,'0'),x,h*.66);g.textAlign='left';}
    }
    g.globalAlpha=1;g.fillStyle=col2;g.beginPath();g.moveTo(w*.5,h*.6);g.lineTo(w*.5-8,h*.86);g.lineTo(w*.5+8,h*.86);g.fill();
    const lit=Math.round(S.boostE/100*12);
    for(let i=0;i<12;i++){const on=i<lit;g.globalAlpha=on?.9:.22;g.fillStyle=S.boostLock||!on?col2:col;g.fillRect(w*.74+i*16,h*.3,11,h*.4);}
    g.globalAlpha=1;g.font='bold 15px monospace';g.textBaseline='top';
  },
  turn(L,D){   // the duelist's G / turn-rate gauge: an arc with a redline, rate bars below
    const {g,w,h,col,col2}=L;cpScreenBase(g,w,h,col);g.fillStyle=col;g.fillText('G // TURN',14,14);
    const cx=w/2,cy=h*.56,r=Math.min(w,h)*.3,a0=Math.PI*.8,a1=Math.PI*2.2,gMax=10,red=8;
    const ang=v=>a0+(a1-a0)*Math.min(1,v/gMax);
    g.lineWidth=10;g.strokeStyle=col;g.globalAlpha=.2;g.beginPath();g.arc(cx,cy,r,a0,a1);g.stroke();
    g.globalAlpha=.9;g.beginPath();g.arc(cx,cy,r,a0,ang(Math.min(cpTurn.g,red)));g.stroke();
    g.strokeStyle=col2;g.globalAlpha=.35;g.beginPath();g.arc(cx,cy,r,ang(red),a1);g.stroke();
    if(cpTurn.g>red){g.globalAlpha=1;g.beginPath();g.arc(cx,cy,r,ang(red),ang(cpTurn.g));g.stroke();}
    g.lineWidth=2;g.strokeStyle=col;g.globalAlpha=.6;
    for(let i=0;i<=gMax;i++){const a=a0+(a1-a0)*i/gMax;g.beginPath();g.moveTo(cx+Math.cos(a)*(r-14),cy+Math.sin(a)*(r-14));
      g.lineTo(cx+Math.cos(a)*(r-6),cy+Math.sin(a)*(r-6));g.stroke();}
    g.globalAlpha=1;g.fillStyle=cpTurn.g>red?col2:col;g.font='bold 26px monospace';g.textAlign='center';
    g.fillText(cpTurn.g.toFixed(1)+'G',cx,cy-12);
    g.font='bold 13px monospace';g.fillStyle=col;g.fillText(Math.round(cpTurn.rate*57.2958)+'°/S',cx,cy+18);g.textAlign='left';
    const lit=Math.round(Math.min(1,cpTurn.rate/2.2)*10);
    for(let i=0;i<10;i++){g.globalAlpha=i<lit?.85:.2;g.fillStyle=i<7?col:col2;g.fillRect(w*.14+i*w*.073,h*.84,w*.05,h*.07);}
    g.globalAlpha=1;g.font='bold 15px monospace';
  },
  caution(L,D){   // annunciator tiles: one row of eight, or two rows of four on a squarer panel
    const {g,w,h,col,col2}=L;
    g.fillStyle='#0b0c10';g.fillRect(0,0,w,h);
    const labs=['HYD','FUEL','GEN','O2','SHLD','ECM','APU','FIRE'],hotK={O2:1,SHLD:1,ECM:1,FIRE:1};
    const cols=h>w*.25?4:8,rows=8/cols,tw=w/cols,th=h/rows;
    g.font='bold '+Math.round(Math.min(20,th*.42))+'px monospace';g.textAlign='center';g.textBaseline='middle';
    labs.forEach((l,i)=>{const x=(i%cols)*tw,y=Math.floor(i/cols)*th,hot=hotK[l],on=cpLit(l);
      g.fillStyle=on?(hot?col2:col):(hot?'#2c0a0c':'#2a1f08');g.globalAlpha=on?.9:1;g.fillRect(x+4,y+5,tw-8,th-10);
      g.globalAlpha=on?1:.45;g.fillStyle=on?'#0b0c10':(hot?col2:col);g.fillText(l,x+tw/2,y+th/2);g.globalAlpha=1;});
    g.textAlign='left';g.textBaseline='top';
  },
};
const sv3Live=new THREE.Vector3();

/* a live canvas texture for a cockpit screen; cpScreenTex() calls this for any kind in CP_LIVE */
function cpLiveTex(kind,col,col2,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=4;
  const L={kind,g:c.getContext('2d'),tex,w,h,col:cpHex(col),col2:cpHex(col2)};
  cockpitLive.push(L);cockpitLiveT=0;   // first drawn on the next first-person frame
  return tex;
}
function cpLiveDraw(L,D){L.g.save();CP_LIVE[L.kind](L,D);L.g.restore();L.tex.needsUpdate=true;}

/* a row of labelled status lamps across a panel; each lamp follows CP_COND[role]. The label sits
   under the lamp, or over it ('above') or beside it ('right') where a panel has no room below */
function cpLamps(par,roles,colOf,x0,dx,y,size,label){
  roles.forEach((role,i)=>{
    const col=colOf(i),m=new THREE.Mesh(new THREE.SphereGeometry(size,8,6),new THREE.MeshBasicMaterial({color:col}));
    m.position.set(x0+i*dx,y,.02);par.add(m);
    cockpitLamps.push({m,role,on:new THREE.Color(col),off:new THREE.Color(col).multiplyScalar(.12)});
    const tex=cockpitTex('lamp_'+role,64,24,(g,w,h)=>{g.fillStyle='#07080b';g.fillRect(0,0,w,h);
      g.fillStyle='#9aa3b8';g.font='bold 16px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(role,w/2,h/2+1);});
    cpPlane(par,.064,.024,new THREE.MeshBasicMaterial({map:tex}),label==='right'?x0+i*dx+size+.04:x0+i*dx,label==='right'?y:y+(label==='above'?1:-1)*(size+.022),.013);
  });
}

/* called from buildCockpit before a new interior is built: drop the old canvases */
function cockpitLiveReset(){
  for(const L of cockpitLive)L.tex.dispose();
  cockpitLive=[];cockpitLamps=[];cockpitLiveT=0;cpTurn.init=false;
}
/* first person only: lamps every frame, screens at CP_LIVE_HZ */
function cockpitLiveUpdate(dt,arena){
  if(!ship)return;
  // turn rate from the frame's rotation, pitch and yaw only (a roll is not a turn)
  if(cpTurn.init&&dt>0){
    cpLiveQ.copy(cpTurn.q).invert().multiply(ship.quaternion);
    const rate=Math.min(6,2*Math.hypot(cpLiveQ.x,cpLiveQ.y)/dt);
    cpTurn.rate+=(rate-cpTurn.rate)*Math.min(1,8*dt);
    const gT=Math.min(12,1+S.vel.length()*cpTurn.rate/9.81*.25);
    cpTurn.g+=(gT-cpTurn.g)*Math.min(1,6*dt);
  }
  cpTurn.q.copy(ship.quaternion);cpTurn.init=true;
  for(const l of cockpitLamps)l.m.material.color.copy(cpLit(l.role)?l.on:l.off);
  cockpitLiveT-=dt;if(cockpitLiveT>0)return;
  cockpitLiveT=1/CP_LIVE_HZ;
  const D=cpLiveData(arena);
  for(const L of cockpitLive)cpLiveDraw(L,D);
}
