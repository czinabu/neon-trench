"use strict";
/* Skirmish (title screen, shown once Broadside, the first fleet battle, is cleared): set up a fleet battle against the AI outside the campaign and
   fight it. The setup screen (#skirmish) edits SKIRM, which starts from SKIRMISH.start (js/data/skirmish.js) and is kept
   for the session; skirmishMission turns it into a fleet op object, so the battle runs on the same code as the
   campaign's fleet ops. A skirmish has every Commander and Admiral tool (toolOn), pays nothing, leaves the campaign
   and its fleet record alone, and shows its result on the debrief screen (skirmishDebrief). */
const SKIRM=JSON.parse(JSON.stringify(SKIRMISH.start));
const SK_STATES={line:'In the line',reserve:'Reserve',off:'Stays home'};
const SK_KINDS={cruiser:'Cruiser',frigate:'Frigate'};

/* the setup as a fleet op (missions' `fleet` fields: allies, reserve, line, gate; see js/data/missions.js) */
function skirmishMission(c){
  const D=SKIRMISH.difficulty[c.difficulty]||SKIRMISH.difficulty.normal,used={cruiser:0,frigate:0};
  const name=k=>{const a=SKIRMISH.foeNames[k];return a[used[k]++%a.length];};
  const flag=c.admiral?Math.max(0,c.foes.findIndex(f=>f.kind==='cruiser')):-1;   // the admiral flies the first cruiser
  const line=c.foes.map((f,i)=>{
    const e={kind:f.kind,name:name(f.kind),role:f.role,t:SKIRMISH.arrive[0]+i*SKIRMISH.arrive[1],at:SKIRMISH.foeAt[i%SKIRMISH.foeAt.length],
      hp:Math.round(FLEET.hp[f.kind]*D.foeHp*(i===flag?1.3:1))};
    if(i===flag){e.admiral=true;e.pal='flag';}
    return e;
  });
  const G=SKIRMISH.gate;
  const gate=c.gate?Object.assign({},G,{ships:G.ships.map(s=>Object.assign({},s,{name:name(s.kind),hp:Math.round((s.hp||FLEET.hp[s.kind])*D.foeHp)}))}):null;
  const allies=[];let reserve=null;
  SKIRMISH.allies.forEach((a,i)=>{const s=c.allies[i];
    if(s.state==='line')allies.push({name:a.name,at:a.at,role:s.role});
    else if(s.state==='reserve'&&!reserve)reserve={name:a.name,role:s.role};});
  const fighters=(SKIRMISH.fighters[c.fighters]||SKIRMISH.fighters.light).n;
  return {id:'skirmish',skirmish:true,name:'SKIRMISH',sub:'// fleet battle',sector:'arena',fleet:true,carrier:true,escort:false,
    carrierHp:D.carrierHp,count:fighters,allies,reserve,line,gate,roster:SKIRMISH.roster,
    objective:'Destroy the enemy fleet'+(gate?' and collapse the Kiru Gate':'')+(fighters?', and shoot down '+fighters+' fighters':''),
    bonuses:[],reward:{credits:0,parts:0}};
}
function openSkirmish(){S.mode='menu';document.exitPointerLock&&document.exitPointerLock();stagePick('skirmish');renderSkirmish();showScreen('skirmish');}
const skBtn=(on,label,data)=>'<button class="tab'+(on?' on':'')+'" '+Object.entries(data).map(([k,v])=>'data-'+k+'="'+v+'"').join(' ')+'>'+label+'</button>';
const skRoles=(g,i,cur)=>Object.keys(FLEET.roles).map(r=>skBtn(cur===r,FLEET.roles[r].name,{g,i,role:r})).join('');
function renderSkirmish(){
  const c=SKIRM,m=skirmishMission(c);
  let h='<div class="sksec">Your fleet</div>'
    +'<div class="skrow"><div><b>HALCYON</b><span>Carrier · '+m.carrierHp+' hull</span></div><div class="skopts"><span class="skfix">Always in · launches your wing</span></div></div>';
  SKIRMISH.allies.forEach((a,i)=>{const s=c.allies[i];
    h+='<div class="skrow'+(s.state==='off'?' off':'')+'"><div><b>'+a.name+'</b><span>Destroyer</span></div><div class="skopts">'
      +Object.keys(SK_STATES).map(st=>skBtn(s.state===st,SK_STATES[st],{g:'ally',i,state:st})).join('')+'</div>'
      +(s.state==='off'?'':'<div class="skopts">'+skRoles('ally',i,s.role)+'</div>')+'</div>';});
  h+='<div class="sksec">Enemy fleet</div>';
  c.foes.forEach((f,i)=>{const e=m.line[i];
    h+='<div class="skrow"><div><b>'+e.name+'</b><span>'+(e.admiral?'Flagship · admiral':SK_KINDS[f.kind])+'</span></div><div class="skopts">'
      +Object.keys(SK_KINDS).map(k=>skBtn(f.kind===k,SK_KINDS[k],{g:'foe',i,kind:k})).join('')
      +(c.foes.length>1?skBtn(false,'Remove',{g:'del',i}):'')+'</div><div class="skopts">'+skRoles('foe',i,f.role)+'</div></div>';});
  if(c.foes.length<SKIRMISH.maxFoes)h+='<button class="tab skadd" data-g="add">+ Add a ship</button>';
  const opt=(label,k,vals)=>'<div class="skrow"><div><b>'+label+'</b></div><div class="skopts">'+vals.map(([v,l])=>skBtn(String(c[k])===String(v),l,{g:'opt',k,v})).join('')+'</div></div>';
  h+='<div class="sksec">Battle</div>'
    +opt('Enemy admiral','admiral',[[true,'On'],[false,'Off']])
    +opt('Kiru Gate','gate',[[false,'Off'],[true,'On']])
    +opt('Fighter cover','fighters',Object.entries(SKIRMISH.fighters).map(([k,v])=>[k,v.name]))
    +opt('Difficulty','difficulty',Object.entries(SKIRMISH.difficulty).map(([k,v])=>[k,v.name]));
  skSetup.innerHTML=h;
  // the summary on the right
  const yours=1+m.allies.length,theirs=m.line.length;
  skDesc.textContent=m.objective+'. If HALCYON goes down the battle is lost. You fly as usual; B opens the bridge with every fleet order.';
  skFacts.innerHTML=hgFacts([
    ['Your line',yours+' capital'+(yours>1?'s':'')+(m.reserve?' + '+m.reserve.name+' in reserve':'')],
    ['Enemy line',theirs+' capital'+(theirs>1?'s':'')+(m.gate?' + '+m.gate.ships.length+' through the gate':''),'amber'],
    ['Enemy admiral',c.admiral?'Aboard '+(m.line.find(e=>e.admiral)||{}).name:'None'],
    ['Fighters',m.count?m.count+' to shoot down':'None'],
    ['Payout','None · practice only'],
  ]);
}
skSetup.onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  const d=b.dataset,c=SKIRM,i=+d.i;
  if(d.g==='ally'){const s=c.allies[i];
    if(d.state){if(d.state==='reserve')c.allies.forEach(o=>{if(o.state==='reserve')o.state='line';});s.state=d.state;}   // one reserve at a time
    if(d.role)s.role=d.role;}
  else if(d.g==='foe'){if(d.kind)c.foes[i].kind=d.kind;if(d.role)c.foes[i].role=d.role;}
  else if(d.g==='del'){if(c.foes.length>1)c.foes.splice(i,1);}
  else if(d.g==='add'){if(c.foes.length<SKIRMISH.maxFoes)c.foes.push({kind:c.foes.length%2?'cruiser':'frigate',role:'line'});}
  else if(d.g==='opt')c[d.k]=d.v==='true'?true:d.v==='false'?false:d.v;
  sfx('tick');renderSkirmish();
};
function skirmishLaunch(){S.school=false;launchMission(skirmishMission(SKIRM));}
skLaunch.onclick=skirmishLaunch;
skBack.onclick=()=>showScreen('menu');
/* the result, on the debrief screen: no payout, nothing saved */
function skirmishDebrief(win,cause){
  const m=S.mission;
  showScreen('debrief');
  // ships leave the capitals list once their wrecks clear, so count from the run's tallies
  const foes=S.fleetLine.length,sunk=S.fleetSunk,mine=1+m.allies.length+(S.reserveUsed?1:0),lost=S.alliesLost+(S.carrierLost?1:0);
  const fmtT=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
  dbStats.innerHTML=[[sunk+' / '+foes,'Capitals sunk'],[lost+' / '+mine,'Ships lost'],[S.kills,'Fighters'],[fmtT(S.time),'Time'],
    [S.adm?(S.adm.silenced?'Silenced':'Still in command'):'None','Enemy admiral']]
    .map(([v,l])=>'<div><b>'+v+'</b>'+l+'</div>').join('');
  dbVox.innerHTML='';
  dbTitle.textContent=win?'VICTORY':'DEFEAT';
  dbTitle.style.color=win?'var(--cyan)':'var(--mag)';
  dbSub.textContent=win?'// skirmish won':'// '+(cause||'HALCYON lost');
  dbObj.innerHTML='<div class="objl '+(win?'met':'fail')+'">'+(win?'✓':'✕')+' '+m.objective+'</div>';
  dbReward.innerHTML='<span class="rep">Skirmish · practice only, no payout</span>';
  dbTotal.textContent='';
  dbBtns.innerHTML='';
  const mk=(label,cls,fn)=>{const b=document.createElement('button');b.className='btn'+(cls||'');b.textContent=label;b.onclick=fn;dbBtns.appendChild(b);};
  mk('Rematch',' alt',skirmishLaunch);
  mk('Change setup',' ghost',openSkirmish);
  mk('Menu',' ghost',()=>{S.mission=null;showScreen('menu');});
}
