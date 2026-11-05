"use strict";
/* Squadron orders from the cockpit: the order wheel, the order tags and the orders you receive.

   The order wheel: hold Z (rebindable), hold LB on a pad, or tap Orders on touch. Pick who gets the order (your wing,
   TALON, WRAITH or all of them) with Q / E, the wheel or the d-pad, then one of the six wing orders with the mouse, the
   right stick, a tap or the 1-6 keys. Let go of Z or LB to send it. A quick tap of Z leaves the wheel open until you pick.
   The battle doesn't slow down (it couldn't in co-op). ATTACK pins the squadron on your current target until it is down.
   Orders go through ordSend, which uses the squadron orders in js/wingmen.js (setSquadOrder, setWingmanOrder).

   For the commander: the squadron board (wingHud, setWingOrderHud in js/wingmen.js) shows each squadron's order and
   flashes when one is given, and a tag in the squadron's colour marks what each squadron is attacking.

   For a squadron leader: ordReceive(o) puts an order in force (S.order). A card on the right says who sent it, the task
   and the range, the target wears a gold marker (an edge arrow when it is off screen), and the card clears when the
   target is down (ORDERS.bonus points) or lapses after ORDERS.expire. In the campaign CIC REYES sends one when an enemy
   lance charges on a friendly capital (ordLanceCharge, from js/update/capital.js); in co-op the commander will. */

const ORD_SLICES=['form','target','free','cover','defend','strike'];   // clockwise from the top, the same as the 1-6 keys
const ORD_LABEL={form:['REGROUP','form up'],target:['ATTACK','my target'],free:['FREE','engage'],
  cover:['COVER','me'],defend:['DEFEND','HALCYON'],strike:['STRIKE','capital']};
const ORD_COL=['#00f0ff','#ffb300','#ff2bd6'];   // the wing, TALON, WRAITH (SQUAD_DEFS colours)
const ORD_ACKS=['Copy.','On it.','Wilco.','Copy, moving.','Understood.'];
const ORD_HOLD=.22;   // seconds LB is held before it opens the wheel (a shorter press still targets)
const ORD={open:false,via:'',sel:-1,to:0,vx:0,vy:0,t0:0,sticky:false,built:false,last:0,flash:{},used:false,feedT:0,doneT:0};

/* who can take an order: squadrons with a pilot still flying, plus 'all' when there is more than one */
function ordRecipients(){
  const qs=[0,1,2].filter(q=>sqAlive(q).length);
  return qs.length>1?['all',...qs]:qs;
}
const ordName=r=>r==='all'?'ALL':SQUAD_DEFS[r].name;
const ordCan=()=>S.mode==='play'&&!S.bridge&&S.launchT<=0&&!S.awaitLock&&ordRecipients().length>0;
/* can slice o be sent now? null if it can, else why not (shown under the slice) */
function ordWhyNot(o){
  if(o==='target'&&(!S.target||S.target.dead))return 'no target';
  if(o==='defend'&&!wingDefendAnchor())return 'no carrier';
  if(o==='strike'&&!capTargets.some(E=>!E.dead))return 'no capital';
  return null;
}
/* the order's name as a squadron hears it */
function ordTaskName(r,o){
  if(o==='target'&&S.target)return 'ATTACK '+wingFocusName(S.target);
  if(o==='form')return r&&r!=='all'?'HOLD AT HALCYON':'FORM UP';
  return WING_ORDERS[o].name;
}

/* ---- sending ---- */
function ordSend(r,o){
  const all=ordRecipients(),qs=r==='all'?all.filter(x=>x!=='all'):all.includes(r)?[r]:[];
  if(!qs.length||!WING_ORDERS[o])return false;
  const task=ordTaskName(r,o);
  if(o==='target'){
    const T=S.target;
    if(!T||T.dead){announce('NO TARGET','Target a hostile first ('+keyLabel(keyBound(KEY_ACTIONS.find(a=>a.id==='target')))+')','ace');return false;}
    for(const q of qs)for(const w of sqAlive(q))setWingmanOrder(w,'focus',T);
    sfx('acquire');
  }else{
    if(!wingOrderOk(o))return false;
    for(const q of qs)setSquadOrder(q,o);
  }
  const now=performance.now();for(const q of qs)ORD.flash[q]=now;
  ORD.last=r;ORD.used=true;
  setWingOrderHud();
  const lead=sqAlive(qs[0])[0];
  ordFeed.innerHTML='<b style="color:'+(r==='all'?'#e8f4ff':ORD_COL[r])+'">'+ordName(r)+'</b> <i>▸</i> '+task
    +(lead?'<span>'+lead.callsign+': '+radioPick(ORD_ACKS)+'</span>':'');
  ordFeed.classList.add('on');ORD.feedT=2.6;
  return true;
}

/* ---- the wheel ---- */
function ordBuild(){
  if(ORD.built)return;ORD.built=true;
  let h='';
  ORD_SLICES.forEach((o,i)=>{
    const a=i*Math.PI/3,x=Math.sin(a)*118,y=-Math.cos(a)*118;
    h+='<button class="owS" data-i="'+i+'" style="left:calc(50% + '+x.toFixed(1)+'px);top:calc(50% + '+y.toFixed(1)+'px)">'
      +'<em>'+(i+1)+'</em><b>'+ORD_LABEL[o][0]+'</b><span>'+ORD_LABEL[o][1]+'</span></button>';
  });
  ordRing.innerHTML=h+'<div id="ordPtr"></div><div id="ordCore"><b id="ordCoreTo"></b><span id="ordCoreNow"></span></div>';
  for(const el of ordRing.querySelectorAll('.owS')){
    const i=+el.dataset.i;
    el.addEventListener('mouseenter',()=>{if(ORD.open&&!document.pointerLockElement){ORD.sel=i;ordRender();}});
    el.addEventListener('click',e=>{e.stopPropagation();if(ORD.open)ordPick(i);});
    el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();if(ORD.open)ordPick(i);});
  }
  ordTo.addEventListener('click',e=>{const c=e.target.closest('[data-r]');if(c&&ORD.open){ORD.to=+c.dataset.r;ordRender();}});
  ordTo.addEventListener('touchstart',e=>{const c=e.target.closest('[data-r]');if(c&&ORD.open){e.preventDefault();ORD.to=+c.dataset.r;ordRender();}});
}
function ordOpenWheel(via){
  if(ORD.open||!ordCan())return false;
  ordBuild();
  const rs=ordRecipients();
  ORD.open=true;ORD.via=via;ORD.sel=-1;ORD.vx=ORD.vy=0;ORD.t0=performance.now();ORD.sticky=via==='touch';
  ORD.to=Math.max(0,rs.indexOf(ORD.last));
  if(via!=='key')S.fireHeld=false;
  ordWheel.className='on via-'+via;ordRender();sfx('tick');
  return true;
}
function ordClose(){
  if(!ORD.open)return;
  ORD.open=false;ordWheel.className='';
}
function ordPick(i){
  if(!ORD.open)return;
  const rs=ordRecipients(),r=rs[ORD.to];
  if(r==null){ordClose();return;}
  const why=ordWhyNot(ORD_SLICES[i]);
  if(why){ORD.sel=i;ordRender();sfx('ui');if(!ORD.sticky)ordClose();
    if(ORD_SLICES[i]==='target')ordSend(r,'target');else wingOrderOk(ORD_SLICES[i]);   // says why
    return;}
  ordSend(r,ORD_SLICES[i]);ordClose();
}
/* let go of Z or LB: send the slice you are on; a quick tap with nothing picked keeps the wheel open */
function ordRelease(){
  if(!ORD.open)return;
  if(ORD.sel>=0)ordPick(ORD.sel);
  else if(ORD.via==='key'&&performance.now()-ORD.t0<250)ORD.sticky=true;
  else ordClose();
}
function ordCycle(d){
  const n=ordRecipients().length;if(!n)return;
  ORD.to=(ORD.to+d+n)%n;ordRender();
}
const ordSliceAt=(x,y)=>Math.round(((Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2))/(Math.PI/3))%6;
function ordMouse(dx,dy){   // the mouse moves a pointer out from the centre of the wheel
  ORD.vx+=dx/70;ORD.vy+=dy/70;
  const l=Math.hypot(ORD.vx,ORD.vy);if(l>1){ORD.vx/=l;ORD.vy/=l;}
  if(l>.45)ORD.sel=ordSliceAt(ORD.vx,ORD.vy);
  ordRender();
}
function ordStick(x,y){   // a pad's right stick points at a slice; letting it go keeps the pick
  if(Math.hypot(x,y)<.5)return;
  ORD.vx=x;ORD.vy=y;ORD.sel=ordSliceAt(x,y);ordRender();
}
function ordRender(){
  if(!ORD.open)return;
  const rs=ordRecipients();if(ORD.to>=rs.length)ORD.to=0;
  const r=rs[ORD.to];
  ordTo.innerHTML=rs.map((x,i)=>'<span data-r="'+i+'" class="'+(i===ORD.to?'on':'')+'" style="--c:'+(x==='all'?'#e8f4ff':ORD_COL[x])+'">'+ordName(x)+'</span>').join('');
  ordWheel.style.setProperty('--oc',r==='all'?'#e8f4ff':ORD_COL[r]);
  ordCoreTo.textContent=r==null?'':ordName(r);
  ordCoreNow.textContent=r==null?'':r==='all'?rs.length-1+' squadrons':sqOrderName(r);
  ordRing.querySelectorAll('.owS').forEach((el,i)=>{
    const why=ordWhyNot(ORD_SLICES[i]);
    el.classList.toggle('sel',i===ORD.sel);el.classList.toggle('off',!!why);
    const sub=why||(ORD_SLICES[i]==='target'&&S.target?wingFocusName(S.target).toLowerCase():ORD_SLICES[i]==='form'&&r!==0?'hold at HALCYON':ORD_LABEL[ORD_SLICES[i]][1]);
    const s=el.querySelector('span');if(s.textContent!==sub)s.textContent=sub;
  });
  ordPtr.style.display=ORD.sel>=0?'block':'none';
  if(ORD.sel>=0)ordPtr.style.transform='translate(-50%,-100%) rotate('+(ORD.sel*60)+'deg)';
  const pad=ORD.via==='pad',touch=ORD.via==='touch';
  ordHint.innerHTML=touch?'Tap a squadron, then an order':pad?'<b>◂ ▸</b> squadron · <b>right stick</b> order · release <b>LB</b> to send · <b>B</b> cancel'
    :'<b>Q E</b> squadron · <b>mouse</b> or <b>1-6</b> order · '+(ORD.sticky?'<b>click</b> to send':'release <b>'+keyLabel(ordKey())+'</b> to send')+' · <b>Esc</b> cancel';
}
const ordKey=()=>keyBound(KEY_ACTIONS.find(a=>a.id==='orders'));
/* keys while flying (js/input.js): true when the wheel used the key */
function ordKeyDown(e){
  if(e.code==='KeyZ'){
    if(e.repeat)return true;
    if(ORD.open){if(ORD.sticky)ordClose();}
    else if(!ordOpenWheel('key')&&!ordRecipients().length)announce('NO SQUADRONS','Nobody on your wing to order','');
    return true;
  }
  if(!ORD.open)return false;
  if(e.code==='Escape'){ordClose();return true;}
  const n=/^Digit([1-6])$/.exec(e.code);if(n){if(!e.repeat)ordPick(+n[1]-1);return true;}
  if(e.code==='KeyQ'||e.code==='ArrowLeft'){if(!e.repeat)ordCycle(-1);return true;}
  if(e.code==='KeyE'||e.code==='ArrowRight'||e.code==='Tab'){if(!e.repeat)ordCycle(1);return true;}
  return false;
}
function ordKeyUp(e){if(e.code==='KeyZ'&&ORD.open&&ORD.via==='key'&&!ORD.sticky)ordRelease();}

/* ---- what a squadron is doing, for the board and the wheel ---- */
function sqOrderName(q){
  const al=sqAlive(q);if(!al.length)return 'NONE LEFT';
  const a=al[0];
  if(a.order&&al.every(w=>w.order===a.order&&w.focus===a.focus&&w.guard===a.guard))return wingOrderName(a);   // all on one mark
  const o=sqOrder(q);return o==='form'&&q?'HOLD AT HALCYON':WING_ORDERS[o].name;
}
/* the board's flash on a squadron just ordered (a negative delay so a redraw doesn't restart it) */
function ordFlashStyle(q){
  const t=performance.now()-(ORD.flash[q]||-1e9);
  return t<1200?' flash" style="animation-delay:-'+Math.round(t)+'ms':'';
}

/* ---- orders you receive ---- */
/* o: {who: a CAST id or a callsign, task: 'KILL THE LANCE', on: the target's name, ref: the target, line: radio line} */
function ordReceive(o){
  S.order=Object.assign({t:S.time,state:'live',end:0},o);S.orderLast=S.time;
  if(o.line&&S.mission&&CAST[o.who])radioSay(o.who,o.line);
  ocFrom.textContent=CAST[o.who]?CAST[o.who].name:o.who;
  ocTask.textContent=o.task;ocInfo.textContent=o.on||'';
  ordCard.className='on';sfx('acquire');padRumble(.25,90);
}
/* an enemy lance charging on a friendly capital: CIC orders you onto it (single player; js/update/capital.js) */
function ordLanceCharge(C,L,onYou){
  if(onYou||C.friendly||!S.carrierMode||S.order||!capTargets.includes(L)||L.dead)return;
  if(S.time-S.orderLast<ORDERS.gap)return;
  const at=L.aimK&&L.aimK.T?L.aimK.T.name:'the fleet';
  ordReceive({who:'reyes',task:'KILL THE LANCE',on:C.T.name,ref:L,line:C.T.name+' is charging its lance on '+at+'. Take that lance out.'});
}
function ordReset(){
  S.order=null;S.orderLast=-1e9;ORD.used=false;ORD.flash={};ORD.feedT=0;
  ordClose();ordCard.className='';ordFeed.classList.remove('on');ordMarks.innerHTML='';ordMarkPool.length=0;
}

/* ---- per frame ---- */
/* every frame from js/loop.js, also paused: shut the wheel when it can't be used, show the Orders button on touch */
function ordTick(dt){
  if(ORD.open&&!ordCan())ordClose();
  if(ORD.open)ordRender();
  if(isTouch){const on=S.mode==='play'&&!S.bridge&&ordRecipients().length>0;if(tOrd.classList.contains('on')!==on)tOrd.classList.toggle('on',on);}
  if(ORD.feedT>0){ORD.feedT-=dt;if(ORD.feedT<=0)ordFeed.classList.remove('on');}
}
const ordMarkPool=[];
function ordMark(i){
  while(ordMarkPool.length<=i){const el=document.createElement('div');el.className='omk';el.innerHTML='<b></b><span></span>';ordMarks.appendChild(el);ordMarkPool.push(el);}
  return ordMarkPool[i];
}
const ordP=new THREE.Vector3();
const ordPos=F=>F.g?F.g.position:F.mesh.position;
/* world-space tags: what each squadron is attacking, and the order you are under (from updateAimAids, js/update/aim.js) */
function ordHudFrame(fr){
  let mi=0;
  const W=innerWidth,H=innerHeight;
  const onScreen=pos=>{ordP.copy(pos).project(camera);return ordP.z<1&&Math.abs(ordP.x)<1&&Math.abs(ordP.y)<1;};
  // squadrons on a mark: one tag per mark, naming each squadron on it
  const marks=new Map();
  for(let q=0;q<squadrons.length;q++){
    const w=sqAlive(q).find(w=>wingOrderOf(w)==='focus'&&w.focus&&wingFocusLive(w.focus));
    if(!w)continue;
    const m=marks.get(w.focus)||[];m.push(q);marks.set(w.focus,m);
  }
  for(const [F,qs] of marks){
    if(!onScreen(ordPos(F)))continue;
    const el=ordMark(mi++);el.style.display='block';el.className='omk sq';
    el.style.left=((ordP.x*.5+.5)*W).toFixed(1)+'px';el.style.top=((-ordP.y*.5+.5)*H).toFixed(1)+'px';
    el.firstChild.innerHTML=qs.map(q=>'<i style="color:'+ORD_COL[q]+'">'+SQUAD_DEFS[q].name+'</i>').join(' ');
    el.lastChild.textContent='';
  }
  // the order you are under
  const O=S.order;
  if(O){
    if(O.state==='live'){
      if(!wingFocusLive(O.ref)){O.state='done';O.end=S.time;S.score+=ORDERS.bonus;
        ocTask.textContent='ORDER COMPLETE';ocInfo.textContent='+'+ORDERS.bonus+' · '+O.task.toLowerCase();ordCard.className='on done';sfx('acquire');}
      else if(S.time-O.t>ORDERS.expire){O.state='lapsed';O.end=S.time;
        ocTask.textContent='ORDER LAPSED';ocInfo.textContent=O.task.toLowerCase();ordCard.className='on lapsed';}
    }
    if(O.state!=='live'){if(S.time-O.end>2.6){S.order=null;ordCard.className='';}}
    else{
      const pos=ordPos(O.ref),d=pos.distanceTo(fr.p);
      ocInfo.textContent=(O.on?O.on+' · ':'')+(d<1000?Math.round(d)+' M':(d/1000).toFixed(1)+' KM');
      const el=ordMark(mi++);el.style.display='block';
      if(onScreen(pos)){
        el.className='omk me';el.style.transform='';
        el.style.left=((ordP.x*.5+.5)*W).toFixed(1)+'px';el.style.top=((-ordP.y*.5+.5)*H).toFixed(1)+'px';
        el.firstChild.textContent='ORDER';el.lastChild.textContent=d<1000?Math.round(d)+'M':(d/1000).toFixed(1)+'KM';
      }else{   // off screen: a gold chevron on the edge, pointing at it
        const a=screenBearing(pos),dx=Math.sin(a),dy=-Math.cos(a),W2=W/2,H2=H/2,e=70;
        const k=Math.min((W2-e)/Math.max(1e-3,Math.abs(dx)),(H2-e)/Math.max(1e-3,Math.abs(dy)));
        el.className='omk edge';el.style.left=(W2+dx*k).toFixed(1)+'px';el.style.top=(H2+dy*k).toFixed(1)+'px';
        el.firstChild.textContent='';el.lastChild.textContent='';
        el.style.setProperty('--a',a.toFixed(3)+'rad');
      }
    }
  }
  for(let i=mi;i<ordMarkPool.length;i++)ordMarkPool[i].style.display='none';
}
