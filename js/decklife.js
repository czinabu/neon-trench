"use strict";
/* Life aboard HALCYON (data in js/data/deck.js, the deck in js/deck.js):
     walk out to launch   with Settings > Walk to launch on, Launch on a briefing opened from the deck takes you to the
                          foot of pad one instead of straight into the cockpit: walk to your ship and use it to climb in
                          (a short scene, skipped by E, Enter, Esc or Use). The datapad's Next op launches at once
     climb out            back from a sortie you climb down from the cockpit, and the deck crew say how it went
     service honours      a wall of cases on the spine, one per op that mattered (DECK_TROPHIES), filled as you clear them
     touch                on a touch screen the deck walks too: a stick on the left, drag the right to look, Use and
                          Pad buttons, and a Run button that holds */

/* ---- walk out to launch, climb out after landing ---- */
let dkLanded=null;   // the last sortie, set at its debrief (js/menus.js): {m, win, hull, first}
/* the briefing's Launch: on the deck, go and board instead. Returns true if it took over */
function dkBoardFirst(m){
  if(!m||!hubWalk()||!SETTINGS.walkLaunch||PROG.onboard==='tour'||m.skirmish||m.contract||briefFrom==='contracts')return false;
  openDeck();dkArm(m);return true;
}
function dkArm(m){
  const P=DECK_LIFE.path[0];DK.armed=m;
  DK.x=P[0];DK.z=P[2];DK.yaw=DK.face=Math.atan2(-(0-P[0]),-(66-P[2]));DK.pitch=-.12;DK.vx=DK.vz=0;DK.placed=true;DK.room=null;
  DK.heard.chief=true;dkSay('chief',DECK_LIFE.armLine(m));
}
function dkBoard(){if(!DK.armed||DK.seq)return;sfx('lock');DK.seq={kind:'board',t:0,m:DK.armed};dkPrompt.classList.remove('on');DK.focus=null;}
function dkLaunchNow(){const m=DK.armed;DK.armed=null;DK.seq=null;dkPad(false);launchMission(m);}
/* one frame of a scene; returns true while it runs (dkTick then skips walking) */
function dkSeqTick(dt){
  const D=DK,Q=D.seq,L=DECK_LIFE,board=Q.kind==='board',T=board?L.board:L.land;
  Q.t=Math.min(T,Q.t+dt);
  const k=Q.t/T,path=board?L.path:L.path.slice().reverse(),cut=board?.55:.45,seg=k<cut?0:1,u=seg?(k-cut)/(1-cut):k/cut,e=u*u*(3-2*u),
    a=path[seg],b=path[seg+1],x=a[0]+(b[0]-a[0])*e,y=a[1]+(b[1]-a[1])*e,z=a[2]+(b[2]-a[2])*e,ground=a[1]===0&&b[1]===0;
  const me=D.me;me.g.position.set(x,y,z);
  if(ground){me.g.rotation.y=Math.atan2(-(b[0]-a[0]),-(b[2]-a[2]));dkStride(me,dt,1);}
  else{me.g.rotation.y=Math.atan2(-(0-x),-(66-z));dkStride(me,dt,0);}   // on the ladder: face the ship
  const C=L.cam;D.cam.position.set(C[0],C[1],C[2]);D.cam.lookAt(x*.6-1,1.4+y*.6,64.5);
  D.cam.fov=60;D.cam.aspect=innerWidth/innerHeight;D.cam.updateProjectionMatrix();
  if(board&&Q.t>T-.4)dkFade.style.opacity=1;
  if(Q.t>=T){
    if(board){dkLaunchNow();return true;}
    D.seq=null;D.x=x;D.z=z;D.face=D.yaw=me.g.rotation.y;D.pitch=-.12;
    const [who,line]=L.landed(Q.L);D.heard[who]=true;dkSay(who,line);
  }
  return true;
}
/* E, Enter, Esc or Use during a scene: skip to its end */
function dkSeqSkip(){const Q=DK&&DK.seq;if(Q)Q.t=Q.kind==='board'?DECK_LIFE.board:DECK_LIFE.land;}

/* ---- the service honours wall on the spine's port side ---- */
const DK_TROPHY_Z=[27.1,28.9,31.1,32.9,35.1,36.9,39.1,40.9,43.1];   // two cases between each pair of ribs
function dkTrophyBuild(M){
  const sc=DK.scene,X=DK_SPINE.x;DK.trophies=[];
  dkSign([['SERVICE HONOURS',50],['one for every op that mattered',22]],'#ffc23c',4,.62,-X+.17,2.95,35,Math.PI/2);
  const solid=c=>inkMat({color:c,metal:.45,rough:.4}),glow=c=>new THREE.MeshBasicMaterial({color:c});
  DECK_TROPHIES.forEach((T,i)=>{
    const z=DK_TROPHY_Z[i],x=-X+.47;if(z===undefined)return;
    dkBox(M.metal,-X+.12,0,z-.36,-X+.82,1,z+.36);dkBox(M.cyanDim,-X+.12,1,z-.37,-X+.83,1.03,z+.37);
    const back=new THREE.Mesh(new THREE.PlaneGeometry(.7,1.1),new THREE.MeshBasicMaterial({color:T.col,transparent:true,opacity:.16,depthWrite:false}));
    back.position.set(-X+.17,1.6,z);back.rotation.y=Math.PI/2;sc.add(back);
    let geo,mat=solid(T.col);
    switch(T.shape){
      case 'ring':geo=new THREE.TorusGeometry(.2,.05,8,28);mat=glow(T.col);break;
      case 'dial':geo=new THREE.CylinderGeometry(.22,.22,.06,28).rotateX(Math.PI/2);break;
      case 'bar':geo=new THREE.BoxGeometry(.07,.07,.5);break;
      case 'plate':geo=new THREE.BoxGeometry(.04,.36,.48);mat=solid(0x2a1a14);break;
      case 'shard':geo=new THREE.OctahedronGeometry(.17).scale(1,1.7,1);mat=glow(T.col);break;
      case 'barrel':geo=new THREE.CylinderGeometry(.05,.075,.56,12).rotateZ(Math.PI/2);break;
      case 'arc':geo=new THREE.TorusGeometry(.28,.06,6,24,Math.PI*.7);mat=glow(T.col);break;
      default:geo=new THREE.ConeGeometry(.2,.36,5);
    }
    const o=new THREE.Mesh(geo,mat);o.position.set(x,1.45,z);sc.add(o);
    if(T.shape==='dial'){const hand=new THREE.Mesh(new THREE.BoxGeometry(.02,.16,.02),glow(0x1a1208));hand.position.set(0,.06,.04);o.add(hand);}
    if(T.shape==='plate'){const e=new THREE.Mesh(new THREE.PlaneGeometry(.4,.4),DK.emberM);e.rotation.y=Math.PI/2;e.position.x=.025;o.add(e);}
    const plaque=dkSign([[' ',30]],'#ffc23c',.64,.3,-X+.83,.7,z,Math.PI/2);
    DK.spin.push({o,r:.35});
    const slot={T,o,back,plaque,z,got:null,op:missionById(T.op)};DK.trophies.push(slot);
    dkBlock({x0:-X,z0:z-.4,x1:-X+.85,z1:z+.4});
    DK.acts.push({x:x+.1,z,r:.45,room:'spine',get name(){return slot.got?'Look':'Empty case';},
      get sub(){return slot.got?T.name:'For '+(slot.op?slot.op.name:'a later op');},
      go:()=>slot.got?dkSay(T.who,T.line):dkSay('vale','That case waits for '+(slot.op?slot.op.name:'an op still ahead')+'.')});
  });
}
/* fill the cases you have earned, each visit */
function dkTrophies(){
  for(const S0 of DK.trophies){
    const got=!!PROG.completed[S0.T.op];S0.o.visible=got;S0.back.material.opacity=got?.16:.04;
    if(S0.got===got)continue;S0.got=got;
    const old=S0.plaque.material.map,hex='#'+S0.T.col.toString(16).padStart(6,'0');
    S0.plaque.material.map=got?dkTextTex([[S0.T.name,34],[S0.op?S0.op.name:'',24]],hex,512,240):dkTextTex([['EMPTY',34],['for '+(S0.op?S0.op.name:'?'),24]],'#5a6478',512,240);
    S0.plaque.material.needsUpdate=true;if(old)old.dispose();
  }
}

/* ---- walking the deck by touch ---- */
const dkTW={f:0,s:0,run:false};   // read by dkTick beside the pad's padWalk
let dkTStick=null,dkTLook=null;
const DK_TSTICK_R=52;
function dkLifePoll(){   // once a frame while the deck is up: the touch buttons on a touch screen
  if(DK.seq){dkGoal.classList.remove('on');dkWay.classList.remove('on');}   // the objective tracker (js/deckgoal.js) steps aside while you board or climb out
  const on=isTouch&&deckOn();
  if(on!==dkTouchBox.classList.contains('on'))dkTouchBox.classList.toggle('on',on);
  if(on){dkTUse.classList.toggle('lit',!!DK.focus||!!DK.seq);dkTRun.classList.toggle('down',dkTW.run);}
}
(()=>{
  const el=renderer.domElement,stick=$('dkStick'),knob=$('dkKnob');
  const reset=()=>{dkTStick=null;dkTW.f=dkTW.s=0;stick.style.display='none';};
  el.addEventListener('touchstart',e=>{
    if(!isTouch||!deckOn())return;
    if(DK.seq){dkSeqSkip();return;}
    if(dkBusy())return;
    for(const t of e.changedTouches){
      if(!dkTStick&&t.clientX<innerWidth*.45){dkTStick={id:t.identifier,x:t.clientX,y:t.clientY};stick.style.display='block';stick.style.left=t.clientX+'px';stick.style.top=t.clientY+'px';knob.style.transform='';}
      else if(!dkTLook)dkTLook={id:t.identifier,x:t.clientX,y:t.clientY};}
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!isTouch||!deckOn())return;
    for(const t of e.changedTouches){
      if(dkTStick&&t.identifier===dkTStick.id){
        const dx=t.clientX-dkTStick.x,dy=t.clientY-dkTStick.y,l=Math.hypot(dx,dy),k=Math.min(1,l/DK_TSTICK_R)/(l||1);
        dkTW.s=dx*k;dkTW.f=-dy*k;knob.style.transform='translate('+dx*k*DK_TSTICK_R+'px,'+dy*k*DK_TSTICK_R+'px)';}
      else if(dkTLook&&t.identifier===dkTLook.id&&!dkBusy()){
        const q=.0055*SETTINGS.sens;DK.yaw-=(t.clientX-dkTLook.x)*q;
        DK.pitch=Math.max(-.9,Math.min(.45,DK.pitch-(t.clientY-dkTLook.y)*q*(SETTINGS.invertY?-1:1)));
        dkTLook.x=t.clientX;dkTLook.y=t.clientY;}}
  },{passive:true});
  const end=e=>{for(const t of e.changedTouches){if(dkTStick&&t.identifier===dkTStick.id)reset();if(dkTLook&&t.identifier===dkTLook.id)dkTLook=null;}};
  el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);
  const tap=(b,fn)=>b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn();},{passive:false});
  tap(dkTUse,()=>{if(DK&&DK.seq)dkSeqSkip();else dkUse();});
  tap(dkTPad,()=>{if(DK&&!DK.seq&&!DK.ward)dkPad(!DK.pad);});
  tap(dkTRun,()=>{dkTW.run=!dkTW.run;});
})();
