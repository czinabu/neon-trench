"use strict";
/* Gamepad off the flight deck: menus, the HALCYON deck, the datapad and the command bridge. js/gamepad.js calls these
   from padPoll(); they only read the pad and drive the same things the keyboard and mouse do.
   Menus (every screen, pause, settings): d-pad or left stick moves the focus to the nearest control in that direction,
   A presses it (on a slider, left and right adjust it; on a drop-down, A or left and right change it), B goes back
   (Esc), Start takes the screen's main action (Enter).
   HALCYON deck: left stick walk, right stick look, B run, A use, Y or Start datapad, LB / RB camera in and out.
   Command bridge: left stick pan, right stick orbit, LT / RT zoom, LB / RB previous / next unit, A orders at the
   crosshair (a marker, else open map), d-pad moves through the panel and X presses its button, Y swaps views,
   B / Start / Back leave. */
const PAD_UI_SEL='button,input,select,[tabindex="0"]';
const padWalk={f:0,s:0,run:false};   // the deck's walk input from the pad (read by dkTick), analog so a light push walks slowly
const padBdg={x:0,z:0};              // the bridge's pan input from the pad (read by bridgeCamera)
let padSynth=false;                  // a key the pad tapped for the game, so it is not mistaken for the keyboard
let padOnT=0;                        // last time the pad was the one in use
const padRep={};                     // held directions: when each repeats next
let padUiScopePrev=null,padBdgIdx=-1;

/* the pad is what the player is using: its prompts replace the keyboard's */
const padActive=()=>padOnT>0&&performance.now()-padOnT<8000;
function padTouch(){padOnT=performance.now();}
for(const ev of ['keydown','mousedown','touchstart'])addEventListener(ev,()=>{if(!padSynth)padOnT=0;},true);
addEventListener('mousemove',e=>{if(!padSynth&&(Math.abs(e.movementX)+Math.abs(e.movementY))>2)padOnT=0;},true);

function padKeyTap(code){   // press and release a key as the keyboard would
  padSynth=true;
  try{dispatchEvent(new KeyboardEvent('keydown',{code,key:code}));dispatchEvent(new KeyboardEvent('keyup',{code,key:code}));}
  finally{padSynth=false;}
}
/* true on the first frame a direction is held, then repeating while it stays held */
function padStep(k,on,first,rate){
  const t=performance.now();
  if(!on){delete padRep[k];return false;}
  if(!(k in padRep)){padRep[k]=t+first;return true;}
  if(t>=padRep[k]){padRep[k]=t+rate;return true;}
  return false;
}

/* ---- which context the pad is in ---- */
function padUiScope(){
  if(keybindsOpen())return $('keybinds');
  if(settingsOpen())return $('settings');
  if(controlsOpen())return $('controls');
  if(S.mode==='paused')return $('pause');
  if(deckOn()){
    for(const o of [ccIntro,ccAcademy,ccPromo])if(o.parentNode===deck&&!o.classList.contains('hidden'))return o;
    if(DK.ward)return dkWard;
    if(DK.pad)return dkPadBox;
    return null;
  }
  for(const s of SCR){
    if(s==='pause'||s==='settings'||s==='keybinds'||s==='controls'||s==='deck')continue;
    const el=$(s);if(!el.classList.contains('hidden'))return el;
  }
  return null;
}
function padCtx(){
  if(S.mode==='play')return {type:S.bridge?'bridge':'play'};
  const sc=padUiScope();
  if(sc)return {type:'ui',scope:sc};
  if(deckOn()&&!dkBusy())return {type:'walk'};
  return {type:'none'};
}

/* ---- focus movement ---- */
function padUiList(scope){
  return [...scope.querySelectorAll(PAD_UI_SEL)].filter(el=>{
    if(el.disabled||el.tabIndex<0||el.type==='hidden'||!el.getClientRects().length)return false;
    const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';
  });
}
function padUiDefault(list){
  return list.find(el=>/\b(sel|on|main)\b/.test(el.className))||list[0];
}
/* the control nearest to `cur` in the direction (dx,dy), or null */
function padUiPick(list,cur,dx,dy){
  const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let best=null,bs=1e9;
  for(const el of list){
    if(el===cur)continue;
    const q=el.getBoundingClientRect(),ex=q.left+q.width/2-cx,ey=q.top+q.height/2-cy;
    const along=ex*dx+ey*dy,across=Math.abs(ex*dy-ey*dx);
    if(along<=2)continue;
    const s=along+across*2.2;if(s<bs){bs=s;best=el;}
  }
  return best;
}
function padUiFocus(el){
  if(!el)return;
  el.focus();
  if(el.scrollIntoView)el.scrollIntoView({block:'nearest',inline:'nearest'});
  sfx('tick');
}
/* left / right on a slider or drop-down changes its value; true if it took the press */
function padUiAdjust(el,d){
  if(el.tagName==='INPUT'&&el.type==='range'){
    const st=parseFloat(el.step)||1,mn=parseFloat(el.min),mx=parseFloat(el.max);
    const v=Math.max(mn,Math.min(mx,Math.round((parseFloat(el.value)+d*st)/st)*st));
    if(v!==parseFloat(el.value)){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));sfx('tick');}
    return true;
  }
  if(el.tagName==='SELECT'){
    const i=Math.max(0,Math.min(el.options.length-1,el.selectedIndex+d));
    if(i!==el.selectedIndex){el.selectedIndex=i;el.dispatchEvent(new Event('change',{bubbles:true}));sfx('tick');}
    return true;
  }
  return false;
}
function padUiAct(el){
  if(el.tagName==='SELECT'){el.selectedIndex=(el.selectedIndex+1)%el.options.length;el.dispatchEvent(new Event('change',{bubbles:true}));sfx('tick');}
  else if(!(el.tagName==='INPUT'&&el.type==='range'))el.click();
}

/* one frame on a menu screen */
function padUiTick(g,scope,edge,lx,ly){
  const fresh=scope!==padUiScopePrev;padUiScopePrev=scope;
  const list=padUiList(scope);if(!list.length)return;
  let cur=document.activeElement;
  const has=cur&&scope.contains(cur)&&list.includes(cur);
  const dir=[
    [padStep('l',g.buttons[14].pressed||lx<-.55,380,110),-1,0],
    [padStep('r',g.buttons[15].pressed||lx>.55,380,110),1,0],
    [padStep('u',g.buttons[12].pressed||ly<-.55,380,110),0,-1],
    [padStep('d',g.buttons[13].pressed||ly>.55,380,110),0,1]];
  for(const [fire,dx,dy] of dir){
    if(!fire)continue;
    if(!has||fresh){padUiFocus(padUiDefault(list));return;}
    if(dx&&padUiAdjust(cur,dx))continue;
    const n=padUiPick(list,cur,dx,dy);if(n){padUiFocus(n);cur=n;}
  }
  if(edge(PAD_B.A)){
    if(!has||fresh){padUiFocus(padUiDefault(list));return;}
    padUiAct(cur);
  }
  if(edge(PAD_B.B))padKeyTap('Escape');
  if(edge(PAD_B.Start)&&S.mode!=='paused')padKeyTap('Enter');   // the screen's main action; Start on the pause screen resumes (gamepad.js)
  if(edge(PAD_B.Y)&&scope===$('pause'))padKeyTap('Escape');
  if(scope===dkWard){const rx=padAxis(g.axes[2]);if(rx)DK.face+=rx*.05;}   // turn round at the locker
}

/* ---- walking HALCYON's deck ---- */
function padWalkTick(g,edge,dt){
  const lx=padAxis(g.axes[0]),ly=padAxis(g.axes[1]),rx=padAxis(g.axes[2]),ry=padAxis(g.axes[3]);
  padWalk.f=-ly;padWalk.s=lx;padWalk.run=g.buttons[PAD_B.B].pressed||g.buttons[PAD_B.L3].pressed;
  DK.yaw-=rx*2.6*SETTINGS.padSens*dt;
  DK.pitch=Math.max(-.9,Math.min(.45,DK.pitch-ry*1.8*SETTINGS.padSens*dt*(SETTINGS.padInvertY?-1:1)));
  if(g.buttons[PAD_B.LB].pressed)DK.dist=Math.max(1.8,DK.dist*(1-dt*1.2));
  if(g.buttons[PAD_B.RB].pressed)DK.dist=Math.min(7,DK.dist*(1+dt*1.2));
  if(edge(PAD_B.A)||edge(PAD_B.X))dkUse();
  if(edge(PAD_B.Y)||edge(PAD_B.Start))dkPad(true);
}

/* ---- the command bridge ---- */
const padBdgBtns=()=>[...bdgPanel.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length);
function padBdgMark(){   // draw the pad's panel focus and the marker under the crosshair
  const bs=padBdgBtns();
  bs.forEach((b,i)=>b.classList.toggle('padf',i===padBdgIdx));
}
function padBdgNearest(){
  let best=null,bd=75*75;
  for(let i=0;i<bdgList.length;i++){
    const M=bdgList[i];if(M.kind==='ed')continue;
    const d=(M.x-innerWidth/2)**2+(M.y-innerHeight/2)**2;if(d<bd){bd=d;best=M;}
  }
  return best;
}
function padBridgeTick(g,edge,dt){
  const lx=padAxis(g.axes[0]),ly=padAxis(g.axes[1]),rx=padAxis(g.axes[2]),ry=padAxis(g.axes[3]);
  padBdg.x=lx;padBdg.z=-ly;
  bdgCam.yaw-=rx*2*dt;
  bdgCam.pitch=Math.max(BRIDGE.pitch[0],Math.min(BRIDGE.pitch[1],bdgCam.pitch+ry*1.5*dt));
  const zi=g.buttons[PAD_B.RT].value,zo=g.buttons[PAD_B.LT].value;
  if(zi>.1||zo>.1)bdgZoom(Math.exp((zo-zi)*dt*1.6));
  if(edge(PAD_B.LB))bridgeKey({code:'KeyQ'});
  if(edge(PAD_B.RB))bridgeKey({code:'KeyE'});
  if(edge(PAD_B.Y))bridgeKey({code:'KeyV'});
  if(edge(PAD_B.B)||edge(PAD_B.Back)||edge(PAD_B.Start)){bridgeClose();return;}
  const bs=padBdgBtns();
  if(padBdgIdx>=bs.length)padBdgIdx=bs.length-1;
  const dirs=[[PAD_B.Left,-1,0],[PAD_B.Right,1,0],[PAD_B.Up,0,-1],[PAD_B.Down,0,1]];
  for(const [bi,dx,dy] of dirs){
    if(!padStep('b'+bi,g.buttons[bi].pressed,380,140)||!bs.length)continue;
    if(padBdgIdx<0){padBdgIdx=0;sfx('tick');continue;}
    const n=padUiPick(bs,bs[padBdgIdx],dx,dy);if(n){padBdgIdx=bs.indexOf(n);sfx('tick');}
  }
  if(edge(PAD_B.X)&&bs[padBdgIdx])bs[padBdgIdx].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  if(edge(PAD_B.A)){const M=padBdgNearest();if(M)bdgMark(M);else bdgGroundClick(innerWidth/2,innerHeight/2);}
  padBdgMark();
  const near=padBdgNearest();
  for(let i=0;i<bdgPool.length;i++)bdgPool[i].classList.toggle('padt',!!near&&bdgList[i]===near);
}
function padBridgeRelease(){
  padBdg.x=padBdg.z=0;padBdgIdx=-1;
  for(const k in padRep)delete padRep[k];
}
