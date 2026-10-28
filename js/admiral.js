"use strict";
/* The enemy admiral (Admiral ops): a fleet op whose line has an entry with `admiral:true` puts the admiral aboard that
   ship when it arrives (admBoard, from spawnCapital). Every ADMIRAL.think seconds (js/data/capitals.js) it reads the
   friendly fleet's orders and picks one plan for the enemy line (S.adm.plan), most pressing first:
     cover    two or more of your ships are focused on one of its ships: its screens move to cover that ship (fleetWard
              in js/fleet.js), and if that ship is badly hurt it pulls back for a while, once
     pursue   your fleet is falling back or returning to station: its line ships close faster and nearer (fleetAdvance)
     punish   your destroyers are closing in: its guns go onto the weakest of them
     break    two or more of your destroyers are screening HALCYON: its guns go onto the weakest screen
     exposed  no destroyer of yours near HALCYON: its guns go onto HALCYON
     press    otherwise: fire spread over your line, HALCYON first
   S.adm.focus is the plan's mark, which draws most of the enemy broadsides (fleetPick). Shooting out the flagship's
   bridge, or sinking it, silences the admiral for the rest of the op. The CIC calls each new plan on the radio, and the
   bridge's FLEET panel shows it (admTxt). */

const ADM_PLANS={
  cover:  {name:'COVERING',   tip:n=>'its screens are moving to cover '+n+'. Hit something else, or go through the screens.'},
  pursue: {name:'PURSUING',   tip:()=>'its line is pressing after your fleet as you pull back.'},
  punish: {name:'PUNISHING',  tip:n=>'its guns are on '+n+', closing in on its own.'},
  break:  {name:'BREAKING',   tip:n=>'its guns are on '+n+' to break the screen round HALCYON.'},
  exposed:{name:'HUNTING',    tip:()=>'HALCYON has no destroyer near her, so every gun is on her.'},
  press:  {name:'PRESSING',   tip:()=>'its fire is spread over your line.'},
};
const admOn=()=>!!S.adm&&!!S.adm.C&&!S.adm.silenced;
/* the op's admiral, if it has one (from startGame); it boards its flagship when that ship arrives */
function admSetup(m){
  const has=e=>e.admiral;
  S.adm=m&&m.fleet&&((m.line||[]).some(has)||m.gate&&m.gate.ships.some(has))
    ?{C:null,plan:'press',focus:null,cover:null,t:0,silenced:false,plans:0,radioT:0}:null;
}
function admBoard(C){
  if(!S.adm||S.adm.C)return;
  S.adm.C=C;S.adm.t=ADMIRAL.think;
  admRadio('board',C.T.name);
}
/* lines for each plan and event: STORY_ADMIRAL in js/data/story.js, {n} the ship's name */
function admRadio(k,n){
  const A=S.adm,lines=STORY_ADMIRAL[k];
  if(!lines||(A.radioT>0&&k!=='silenced'&&k!=='board'))return;
  const [w,t]=radioPick(lines);radioSay(w,t.replace('{n}',n||''));A.radioT=ADMIRAL.radioGap;
}
function admFrame(dt){
  const A=S.adm;if(!A||!A.C||A.silenced)return;
  A.radioT-=dt;
  const F=A.C,bridge=F.systems.find(E=>E.kind==='bridge');
  if(F.state==='warp')return;
  if(F.dead||F.state!=='fight'||bridge&&bridge.dead){   // the flagship's bridge is gone: no more orders
    A.silenced=true;A.plan='press';A.focus=A.cover=null;
    announce('ADMIRAL SILENCED','The enemy fleet has lost its commander','ace');admRadio('silenced',F.T.name);fleetTip('silenced');
    return;
  }
  A.t-=dt;if(A.t>0)return;
  A.t=ADMIRAL.think;
  admThink(A);
}
function admThink(A){
  const mine=fleetShips(),K=carrierShip(),dds=mine.filter(C=>C.kind==='escort');
  const foes=capitals.filter(o=>!o.friendly&&o.fleet&&o.state==='fight'&&!o.dead);
  const weakest=a=>a.reduce((b,C)=>!b||C.hp/C.T.hp<b.hp/b.T.hp?C:b,null);
  let plan='press',focus=null,cover=null;
  // which of its ships your fleet has massed on
  const n=new Map();for(const C of mine)if(C.focus&&foes.includes(C.focus))n.set(C.focus,(n.get(C.focus)||0)+1);
  for(const [X,k] of n)if(k>=2&&(!cover||k>n.get(cover)))cover=X;
  const closing=dds.filter(C=>C.stance==='close'&&!C.goal);
  const back=mine.some(C=>C.retreat||C.stance==='back');
  const screens=dds.filter(C=>K&&C.g.position.distanceTo(K.g.position)<FLEET.roles.screen.guard+60&&(C.role==='screen'&&!C.held||C.form==='screen'));
  const guarded=K&&dds.some(C=>C.g.position.distanceTo(K.g.position)<ADMIRAL.exposed);
  if(cover){
    plan='cover';focus=closing.length?weakest(closing):null;
    if(!cover.withdrew&&!cover.adrift&&cover.hp<cover.T.hp*ADMIRAL.withdrawHp){cover.withdrew=true;cover.withdraw=ADMIRAL.withdrawT;}
  }
  else if(back)plan='pursue';
  else if(closing.length){plan='punish';focus=weakest(closing);}
  else if(screens.length>=2){plan='break';focus=weakest(screens);}
  else if(K&&!guarded){plan='exposed';focus=K;}
  const was=A.plan+(A.cover?A.cover.T.name:'')+(A.focus?A.focus.T.name:'');
  A.plan=plan;A.focus=focus;A.cover=cover;
  if(was!==plan+(cover?cover.T.name:'')+(focus?focus.T.name:'')&&plan!=='press'){
    A.plans++;admRadio(plan,(cover||focus||K||{T:{name:''}}).T.name);
  }
}
/* the FLEET panel's line on the admiral: [heading, what it is doing] */
function admTxt(){
  const A=S.adm;if(!A)return null;
  if(!A.C)return ['Enemy admiral // not yet in the fight','Its flagship has not arrived. Shoot out the flagship\'s bridge to silence it.'];
  if(A.silenced)return ['Enemy admiral // silenced','The enemy line has lost its commander: no more covering, pursuit or focused fire.'];
  const P=ADM_PLANS[A.plan],n=(A.cover||A.focus||{T:{name:''}}).T.name;
  return ['Enemy admiral // aboard '+A.C.T.name+' // '+P.name,'It reads your orders: '+P.tip(n)+' Shoot out '+A.C.T.name+'\'s bridge to silence it.'];
}
