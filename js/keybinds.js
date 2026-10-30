"use strict";
/* Key rebinding. Every system in the game reads fixed key codes, so a rebind is a translation at the door: a capture
   listener turns the key you pressed into the action's default code and re-fires the event, and swallows an unbound
   default key. SETTINGS.keys maps action id -> the code you chose (only the ones you changed). Settings lists them. */
const KEY_ACTIONS=[
  {id:'thrUp',a:'Throttle up',k:'KeyW'},{id:'thrDn',a:'Throttle down',k:'KeyS'},
  {id:'left',a:'Strafe left',k:'KeyA'},{id:'right',a:'Strafe right',k:'KeyD'},
  {id:'up',a:'Climb',k:'Space'},{id:'down',a:'Descend',k:'KeyC'},
  {id:'rollL',a:'Roll left',k:'KeyQ'},{id:'rollR',a:'Roll right',k:'KeyE'},
  {id:'boost',a:'Boost',k:'ShiftLeft'},{id:'brake',a:'Brake',k:'KeyX'},{id:'cruise',a:'Cruise control',k:'KeyT'},
  {id:'flare',a:'Flares',k:'KeyG'},{id:'torp',a:'Torpedo',k:'KeyF'},{id:'target',a:'Target hostile',k:'KeyR'},
  {id:'model',a:'Flight model',k:'KeyV'},{id:'view',a:'Cockpit / chase view',k:'AltLeft'},{id:'bridge',a:'Command bridge',k:'KeyB'},
];
const keyBound=a=>SETTINGS.keys[a.id]||a.k;
/* the label shown for a key code */
function keyLabel(c){
  return c.replace(/^Key/,'').replace(/^Digit/,'').replace('ShiftLeft','Shift').replace('ShiftRight','Right Shift').replace('ControlLeft','Ctrl')
    .replace('AltLeft','Alt').replace('AltRight','Right Alt').replace(/^Arrow/,'').replace('Backquote','`')
    .replace('Mouse0','Left click').replace('Mouse1','Mid click').replace('Mouse2','Right click')
    .replace('Mouse3','Mouse back').replace('Mouse4','Mouse fwd').replace('WheelUp','Wheel up').replace('WheelDown','Wheel down');
}
/* bind an action to a code; a code another action holds is swapped to this action's old key */
function keySet(id,code){
  const a=KEY_ACTIONS.find(x=>x.id===id),old=keyBound(a),other=KEY_ACTIONS.find(x=>x!==a&&keyBound(x)===code);
  const put=(x,c)=>{if(c===x.k)delete SETTINGS.keys[x.id];else SETTINGS.keys[x.id]=c;};
  put(a,code);if(other)put(other,old);
}
let kbSynth=false;
function kbMap(code){   // physical code -> the code the game should see (null: swallow it)
  for(const a of KEY_ACTIONS)if(keyBound(a)===code)return a.k;
  for(const a of KEY_ACTIONS)if(a.k===code&&SETTINGS.keys[a.id])return null;
  return code;
}
function kbFire(type,m,repeat){   // re-fire a key event with the game's code; true if the game cancelled it
  kbSynth=true;
  try{return !dispatchEvent(new KeyboardEvent(type,{code:m,key:/^Alt/.test(m)?'Alt':m,repeat,cancelable:true,bubbles:true}));}
  finally{kbSynth=false;}
}
function kbRemap(e){
  if(kbSynth||!e.isTrusted&&e.code===undefined||kbCapture)return;
  if(!Object.keys(SETTINGS.keys).length)return;
  const m=kbMap(e.code);if(m===e.code)return;
  e.stopImmediatePropagation();
  if(m===null)return;
  if(kbFire(e.type,m,e.repeat))e.preventDefault();
}
/* Mouse buttons and the wheel can be bound too: a bound one is swallowed (in a run only, so menus keep working) and
   becomes the action's key. They use the codes Mouse0..4, WheelUp and WheelDown. */
function kbMouse(e){
  if(kbSynth||kbCapture||!Object.keys(SETTINGS.keys).length||typeof S==='undefined'||S.mode!=='play')return;
  const wheel=e.type==='wheel',code=wheel?(e.deltaY<0?'WheelUp':'WheelDown'):'Mouse'+e.button;
  const m=kbMap(code);if(m===code||m===null)return;
  e.stopImmediatePropagation();e.preventDefault();
  if(e.type==='mouseup')kbFire('keyup',m,false);
  else{kbFire('keydown',m,false);if(wheel)setTimeout(()=>kbFire('keyup',m,false),90);}   // a wheel notch is a short tap
}
for(const t of ['mousedown','mouseup'])addEventListener(t,kbMouse,true);
addEventListener('wheel',kbMouse,{capture:true,passive:false});
/* while waiting for a new key, a mouse press or wheel notch is taken as the choice */
function kbMouseCapture(e){
  if(!kbCapture)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.type==='mouseup')return;
  const cb=kbCapture;kbCapture=null;
  keySet(cb.id,e.type==='wheel'?(e.deltaY<0?'WheelUp':'WheelDown'):'Mouse'+e.button);
  cb.done();
}
addEventListener('mousedown',kbMouseCapture,true);addEventListener('mouseup',kbMouseCapture,true);
addEventListener('wheel',kbMouseCapture,{capture:true,passive:false});
let kbCapture=null;   // the action waiting for its new key
addEventListener('keydown',e=>{
  if(!kbCapture)return;
  e.preventDefault();e.stopImmediatePropagation();
  const cb=kbCapture;kbCapture=null;
  if(e.code!=='Escape')keySet(cb.id,e.code);
  cb.done();
},true);
addEventListener('keydown',kbRemap,true);
addEventListener('keyup',kbRemap,true);
addEventListener('blur',()=>{kbCapture=null;});
function keyListen(id,done){kbCapture={id,done};}
