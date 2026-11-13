"use strict";
/* Engineering and the command report, two pieces of HALCYON's walkable deck (js/deck.js):
     engineering      a room off the spine's port side, aft of quarters (DK_ENG). The reactor stands in the middle, its glow
                      turning amber, then red, as HALCYON takes damage (dkWarTier, js/deckwar.js). Damage control on the forward
                      wall shows every ship's hull and repairs the whole fleet in one go (dockRepair, js/dock.js); the workshop
                      on the aft wall opens the upgrade shop, and the fleet register the Fleet station (captains, recruits,
                      repairs by ship). Chief Oda works here.
     command report   after a fleet battle (S.fleet) the debrief records what the fleet did in PROG.lastBattle: each ship's hull
                      or loss, the enemy line, systems knocked out, fleet orders and captains' calls. The debrief shows it as
                      one line, the bridge's aft wall as a board, and the holo table's hologram as the two lines of ships,
                      the lost and sunk ones dark. Reyes reads it out. */

const DK_ENG_DC=[-12,6.6];   // the damage control console: the objective tracker's waypoint for repairs (js/deckgoal.js)
const DK_ENG_TINT=[0x6ad8ff,0x6ad8ff,0xffc060,0xff9a40,0xff4a3a];   // the reactor by damage tier: fine, scorched, strained, failing

/* ---- engineering ---- */
function dkEng(M){
  const {x0,x1,z0,z1,h}=DK_ENG,sc=DK.scene,cx=-14,cz=DK_ENG.door;
  dkBox(M.floor,x0,-.2,z0,x1,0,z1);dkBox(M.ceil,x0,h,z0,x1,h+.3,z1);
  dkWall(M.wall,'x',z0,x0,x1,h);dkWall(M.wall,'x',z1,x0,x1,h);dkWall(M.wall,'z',x0,z0,z1,h);
  dkBox(M.wall,x1-DK_T/2,DK_SPINE.h,z0,x1+DK_T/2,h,z1);   // the spine wall is lower: close the gap over it
  for(const s of [z0+.2,z1-.2])dkBox(M.cyan,x0,.06,s-.03,x1,.12,s+.03);
  for(let z=z0+3;z<z1-1;z+=4){dkBox(M.metal,x0,h-.6,z-.3,x1,h,z+.3);dkBox(M.lamp,x0+1.5,h-.66,z-.12,-16.5,h-.6,z+.12);dkBox(M.lamp,-11.5,h-.66,z-.12,x1-1,h-.6,z+.12);}
  // the reactor: a plinth, a lit core in a glass tube, a cap into the ceiling, gyro rings round it and a rail to keep you off
  DK.engCoreM=new THREE.MeshBasicMaterial({color:DK_ENG_TINT[0]});
  DK.engGlowM=new THREE.MeshBasicMaterial({color:DK_ENG_TINT[0],blending:THREE.AdditiveBlending,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide});
  const add=(geo,m,y)=>{const o=new THREE.Mesh(geo,m);o.position.set(cx,y,cz);sc.add(o);return o;};
  add(new THREE.CylinderGeometry(2.4,2.7,.6,32),M.metal,.3);add(new THREE.CylinderGeometry(1.6,1.8,.3,32),M.dark,.75);
  add(new THREE.CylinderGeometry(.5,.5,h-1.8,16),DK.engCoreM,.9+(h-1.8)/2);
  add(new THREE.CylinderGeometry(1.3,1.3,h-1.8,32,1,true),DK.engGlowM,.9+(h-1.8)/2);
  add(new THREE.CylinderGeometry(1.9,1.5,.9,32),M.metal,h-.45);
  for(const y of [1.6,h-1.4])add(new THREE.TorusGeometry(1.34,.07,6,40),M.metal,y).rotation.x=Math.PI/2;
  const gyro=new THREE.Group();gyro.position.set(cx,h/2+.2,cz);sc.add(gyro);
  [[.35,0],[-.35,Math.PI/3],[.2,Math.PI*2/3]].forEach(([tilt,ry],i)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(1.95+i*.12,.05,6,56),DK.engCoreM);
    r.rotation.set(Math.PI/2+tilt,ry,0);gyro.add(r);});
  DK.spin.push({o:gyro,r:.5});
  const rail=add(new THREE.TorusGeometry(3,.05,6,56),M.metal,1.05);rail.rotation.x=Math.PI/2;
  for(let a=0;a<Math.PI*2;a+=Math.PI/6)dkBox(M.metal,cx+Math.cos(a)*3-.04,0,cz+Math.sin(a)*3-.04,cx+Math.cos(a)*3+.04,1.05,cz+Math.sin(a)*3+.04);
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.85,3,64),M.cyanDim);ring.rotation.x=-Math.PI/2;ring.position.set(cx,.02,cz);sc.add(ring);
  dkBlock({x:cx,z:cz,r:3.1});
  // conduits from the reactor's cap out along the ceiling to both side walls, and coolant tanks on the outer wall
  for(const s of [-1,1]){dkBat(M.metal).box(.5,.5,9.6-3,cx,h-.9,cz+s*(1.9+(9.6-3)/2+.5));dkBat(M.amberDim).box(.56,.56,.2,cx,h-.9,cz+s*4.5);}
  dkBat(M.metal).box(cx-x0-1.9,.5,.5,(x0+cx-1.9)/2,h-.9,cz);
  for(const z of [9,21]){const t=new THREE.Mesh(sharedGeo('dkTank',()=>new THREE.CylinderGeometry(1,1,3.6,18)),M.metal);t.position.set(x0+1.3,1.8,z);sc.add(t);
    const b=new THREE.Mesh(sharedGeo('dkTankBand',()=>new THREE.CylinderGeometry(1.03,1.03,.18,18)),M.cyanDim);b.position.set(x0+1.3,2.6,z);sc.add(b);
    dkBlock({x:x0+1.3,z,r:1.1});}
  // damage control on the forward wall, the workshop and the fleet register on the aft wall, each under its board
  const board=(x,z,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(8.4,3.15),new THREE.MeshBasicMaterial({color:0xc8d4e0}));m.position.set(x,3.9,z);m.rotation.y=ry;sc.add(m);
    dkBox(M.metal,x-4.3,2.2,z-(ry?-.05:.05)-.03,x+4.3,5.6,z-(ry?-.05:.05)+.03);return m;};
  DK.engDC=board(-12,z0+.2,0);DK.engWS=board(-12,z1-.2,Math.PI);
  dkConsole(M,DK_ENG_DC[0],DK_ENG_DC[1],0,'#6ad8ff');dkConsole(M,-14.5,z1-1.6,Math.PI,'#ffb300');dkConsole(M,-9.5,z1-1.6,Math.PI,'#00f0ff');
  dkSign([['DAMAGE CONTROL',44]],'#6ad8ff',2.4,.34,-12,1.85,z0+.17,0);
  dkSign([['WORKSHOP',44]],'#ffb300',1.9,.3,-14.5,1.85,z1-.17,Math.PI);dkSign([['FLEET REGISTER',44]],'#9fe8ff',2.2,.3,-9.5,1.85,z1-.17,Math.PI);
  // a reactor tech at the outer wall
  const P=dkPerson(M,{suit:0x2a3a44,trim:0x6ad8ff,hair:0x2a1a10});P.g.position.set(-18.4,0,cz);P.g.rotation.y=-Math.PI/2;sc.add(P.g);
  DK.crew.push({P,work:true,ph:Math.random()*6});dkBlock({x:-18.4,z:cz,r:.45});
  DK.acts.push({x:DK_ENG_DC[0],z:DK_ENG_DC[1],r:1,room:'eng',name:'Damage control',get sub(){return dkEngRepairSub();},go:dkEngRepair},
    {x:-14.5,z:z1-1.6,r:1,room:'eng',name:'Workshop',get sub(){return 'Upgrade shop · ship, wing, HALCYON'+(sectorOpen()?', destroyer refits':'');},go:()=>openHangar('deck','up')},
    {x:-9.5,z:z1-1.6,r:1,room:'eng',name:'Fleet register',get sub(){return sectorOpen()?'Captains, recruits, repairs ship by ship':'Carrier and pilots';},go:()=>{openCommand();selectStation('fleet');}},
    {x:cx,z:cz,r:3.1,room:'eng',name:'Reactor',get sub(){return 'Output '+dkEngOutput()+'%';},go:()=>dkSay('chief',dkEngReactorLine())});
  dkRect(x0,z0,x1,z1,'eng');
}
const dkEngOutput=()=>Math.round(100-dkWarTier()*7);
function dkEngReactorLine(){
  const t=dkWarTier();
  return t>=4?'She is running on spite and emergency coolant. Repair her before the next jump or we drift home.'
    :t>=2?'Output is down. Every hit on the hull shakes something loose in here. Damage control will fix it.'
    :t?'A little scorched, nothing that matters. She will give you full output when you need it.'
    :'Running clean at full output. Do not touch anything.';
}
/* the whole fleet's repair bill now, in credits (0 with nothing to fix) */
const dkEngBill=()=>dockHurt().reduce((s,n)=>s+dockRepairCost(n),0);
function dkEngRepairSub(){
  if(!sectorOpen())return 'Opens with the sector map';
  const c=dkEngBill();return c?'Repair the fleet · '+c.toLocaleString()+' cr':'Every ship at full hull';
}
/* repair every ship that needs it at once; short of credits, say so and leave the choice to the fleet register */
function dkEngRepair(){
  if(!sectorOpen()){dkSay('chief','Nothing on the board yet. Once the fleet carries damage from one battle to the next, this is where it gets fixed.');return;}
  const hurt=dockHurt(),c=dkEngBill();
  if(!hurt.length){dkSay('chief','Every ship in the line is at full hull. Go and break something.');return;}
  if(PROG.credits<c){dkSay('chief','Full repairs are '+c.toLocaleString()+' cr and you have '+PROG.credits.toLocaleString()+'. Pick which ships come first at the fleet register.');return;}
  dockRepair(hurt);saveProg();sfx('acquire');dkWarApply();
  dkSay('chief',hurt.includes('HALCYON')?'Repair crews are done. HALCYON is back to 100%, and the deck stopped sparking.':'Done. '+hurt.join(' and ')+' back to full hull.');
}
/* engineering's two boards and the reactor's colour: redrawn from dkWarApply on every visit and after a repair */
function dkEngDraw(){
  if(!DK||!DK.engDC)return;
  const t=Math.min(4,dkWarTier());DK.engCoreM.color.setHex(DK_ENG_TINT[t]);DK.engGlowM.color.setHex(DK_ENG_TINT[t]);DK.engLight.color.setHex(DK_ENG_TINT[t]);
  const put=(mesh,draw)=>{const old=mesh.material.map;mesh.material.map=holoTex(1024,384,draw);mesh.material.needsUpdate=true;if(old)old.dispose();};
  const frame=(g,W,H,col,bg,title)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.strokeStyle=col;g.lineWidth=5;g.strokeRect(4,4,W-8,H-8);g.fillStyle=col;g.font='bold 34px monospace';g.fillText(title,28,54);};
  put(DK.engDC,(g,W,H)=>{frame(g,W,H,'#6ad8ff','#030b10','DAMAGE CONTROL // FLEET HULL');
    const ships=sectorOpen()?dockFleet():['HALCYON'];
    ships.slice(0,5).forEach((n,i)=>{const hh=sectorHull(n),y=112+i*50,c=dockRepairCost(n),col=hh>=1?'#7af0c0':hh>.6?'#ffc23c':'#ff5a4a';
      g.fillStyle='#cfe8f4';g.font='bold 32px monospace';g.fillText(n,28,y);
      g.fillStyle='#0d2a34';g.fillRect(250,y-26,420,28);g.fillStyle=col;g.fillRect(250,y-26,420*hh,28);
      g.font='30px monospace';g.fillText(Math.round(hh*100)+'%',690,y);
      g.fillStyle=c?'#ffc23c':'#4a8a78';g.fillText(c?c.toLocaleString()+' CR':'READY',806,y);});
    g.fillStyle='#8ab8c8';g.font='26px monospace';
    const c=dkEngBill();
    g.fillText(!sectorOpen()?'Damage carries between fleet battles once the sector map opens.':c?'Repair the fleet: '+c.toLocaleString()+' cr · you have '+PROG.credits.toLocaleString()+' cr':'Every ship in the line at full hull.',28,H-26);});
  put(DK.engWS,(g,W,H)=>{frame(g,W,H,'#ffb300','#0c0802','WORKSHOP // UPGRADES AND REFITS');
    g.font='bold 28px monospace';g.fillStyle='#ffe0a0';g.fillText(PROG.credits.toLocaleString()+' CR · '+PROG.parts+' PARTS',28,108);
    const up=shipUpBuyable()+fleetBuyable(),rf=dockRefitsBuyable();
    g.font='30px monospace';g.fillStyle=up?'#ffc23c':'#8a6a30';g.fillText(up?up+' upgrade'+(up>1?'s':'')+' you can buy now':'No upgrades in reach yet',28,158);
    if(sectorOpen()){g.fillStyle=rf?'#ffc23c':'#8a6a30';g.fillText(rf?rf+' destroyer refit'+(rf>1?'s':'')+' you can fit':'No refits in reach',28,200);}
    let y=sectorOpen()?250:210;g.font='26px monospace';
    for(const n of (sectorOpen()?dockFleet():[]).filter(n=>n!=='HALCYON').slice(0,3)){const l=dockRank(n);
      g.fillStyle='#c8a870';g.fillText(n+' · Capt. '+CAPTAINS[n]+', '+DOCK.ranks[l].name+' · armour '+dockRefitLv(n,'armour')+' · guns '+dockRefitLv(n,'guns'),28,y);y+=32;}
    g.fillStyle='#a8884a';g.fillText('Credits buy hull and upgrades. Parts buy refits.',28,H-24);});
}
/* the reactor breathes: a slow pulse on its glow, faster as it strains (from dkWarTick) */
function dkEngTick(){
  if(!DK.engGlowM)return;const t=dkWarTier();
  DK.engGlowM.opacity=.12+.06*Math.sin(DK.t*(1.4+t*.9))+(t>=4&&Math.random()<.05?.1:0);
}

/* ---- the command report ---- */
/* at the debrief of a fleet battle: what the fleet did, kept in PROG.lastBattle. Returns the debrief's line */
function cmdReportRecord(m,win,promos){
  const own=[],seen=new Set();
  for(const K of capitals)if(K.friendly&&(K.kind==='carrier'||K.kind==='escort')&&!seen.has(K.T.name)){
    seen.add(K.T.name);own.push({n:K.T.name,h:K.dead?0:Math.max(0,Math.min(1,K.hp/K.T.hp)),lost:!!K.dead});}
  if(sectorLive(m))for(const n of sectorShipsIn(m,S.reserveUsed))if(!seen.has(n)){seen.add(n);own.push({n,h:0,lost:true});}   // gone from the scene already
  const foes=capitals.filter(K=>!K.friendly&&K.fleet&&!K.gate).map(K=>({n:K.T.name,sunk:!!K.dead}));
  for(let k=foes.filter(f=>f.sunk).length;k<S.fleetSunk;k++)foes.push({n:'',sunk:true});
  const R={op:m.id,name:m.name,win:!!win,ships:own.slice(0,8),foes:foes.slice(0,8),total:Math.max((S.fleetLine||[]).length,foes.length),sunk:S.fleetSunk,
    sys:S.sysDown,orders:S.fleetOrders,calls:Object.keys(S.callDone||{}).length,callsOk:S.callsOk,promos:(promos||[]).slice(0,4)};
  PROG.lastBattle=R;saveProg();
  return cmdReportLine(R);
}
function cmdReportBits(R){
  const lost=R.ships.filter(s=>s.lost).map(s=>s.n),b=[];
  if(R.total)b.push(R.sunk+' of '+R.total+' enemy capitals sunk');
  if(R.sys)b.push(plural(R.sys,'system')+' knocked out');
  b.push(R.orders?plural(R.orders,'fleet order'):'no fleet orders');
  if(R.calls)b.push(R.callsOk+' of '+R.calls+' captains\' calls approved');
  b.push(lost.length?'lost '+lost.join(', '):'no ships lost');
  return b;
}
const cmdReportLine=R=>'Command · '+cmdReportBits(R).join(' · ');
function cmdReportSay(R){
  if(!R)return 'Nothing to report yet, Commander. Once we fight as a fleet, every order and every ship goes on this board.';
  const b=cmdReportBits(R);
  return (R.win?'Last action, '+R.name+', and we held. ':'Last action, '+R.name+'. We did not hold. ')+b[0].charAt(0).toUpperCase()+b[0].slice(1)+(b.length>1?', '+b.slice(1).join(', '):'')+'.';
}
/* the board on the bridge's aft wall, and the act that has Reyes read it */
function dkCmdBuild(M){
  const x=-9,z=DK_BRIDGE.z1-.2;
  DK.cmdBoard=new THREE.Mesh(new THREE.PlaneGeometry(8.4,3.4),new THREE.MeshBasicMaterial({color:0xc8d4e0}));DK.cmdBoard.position.set(x,4.4,z);DK.cmdBoard.rotation.y=Math.PI;DK.scene.add(DK.cmdBoard);
  dkBox(M.metal,x-4.3,2.6,z+.02,x+4.3,6.2,z+.08);
  dkSign([['COMMAND REPORT',44]],'#9fe8ff',2.6,.34,x,2.3,z-.02,Math.PI);
  DK.acts.push({x,z:z-1.2,r:.8,room:'bridge',name:'Command report',get sub(){const R=PROG.lastBattle;return R?R.name+' · '+(R.win?'held':'lost'):'No fleet action logged yet';},
    go:()=>dkSay('reyes',cmdReportSay(PROG.lastBattle))});
}
function dkCmdDraw(){
  if(!DK||!DK.cmdBoard)return;
  const R=PROG.lastBattle,old=DK.cmdBoard.material.map;
  DK.cmdBoard.material.map=holoTex(1024,416,(g,W,H)=>{
    g.fillStyle='#03080e';g.fillRect(0,0,W,H);g.strokeStyle='#29d6ee';g.lineWidth=5;g.strokeRect(4,4,W-8,H-8);
    g.fillStyle='#9fe8ff';g.font='bold 34px monospace';g.fillText('COMMAND REPORT // LAST ACTION',28,54);
    if(!R){g.fillStyle='#5a8a9a';g.font='26px monospace';g.fillText('No fleet action logged yet.',28,120);g.fillText('Fight as a fleet and every order lands here.',28,160);return;}
    g.fillStyle=R.win?'#7af0c0':'#ff5a6a';g.font='bold 36px monospace';g.fillText(R.name.toUpperCase()+(R.win?' · HELD':' · LOST'),28,108);
    g.font='bold 26px monospace';g.fillStyle='#29d6ee';g.fillText('YOUR LINE',28,156);g.fillStyle='#ff2d78';g.fillText('ENEMY LINE',520,156);
    g.font='30px monospace';
    R.ships.slice(0,5).forEach((s,i)=>{g.fillStyle=s.lost?'#ff5a6a':'#cfe8f4';g.fillText(s.n+(s.lost?' · LOST':' · '+Math.round(s.h*100)+'%'),28,198+i*40);});
    g.fillStyle='#ffd0e0';g.fillText(R.sunk+' of '+R.total+' capitals sunk',520,198);
    g.fillStyle='#cfe8f4';g.fillText(plural(R.sys,'system')+' knocked out',520,238);
    g.fillText(plural(R.orders,'fleet order')+' given',520,278);
    g.fillText(R.calls?R.callsOk+' of '+R.calls+' calls approved':'No captains\' calls',520,318);
    if(R.promos.length){g.fillStyle='#ffc23c';g.font='24px monospace';g.fillText('Promoted: '+R.promos.join(' · '),28,H-24);}
  });
  DK.cmdBoard.material.needsUpdate=true;if(old)old.dispose();
  dkCmdHolo(R);
}
/* the holo table's hologram: your line and theirs, each ship an arrowhead, the lost and the sunk ones dark */
function dkCmdHolo(R){
  const F=DK.holoFleet;if(!F)return;
  F.clear();
  const M=DK.M,geo=sharedGeo('dkIcon',()=>new THREE.ConeGeometry(.07,.24,4).rotateX(-Math.PI/2)),dead=DK.holoDeadM||(DK.holoDeadM=new THREE.MeshBasicMaterial({color:0x3a4650}));
  const own=R?R.ships.map(s=>s.lost?dead:M.cyan):[M.cyan,M.cyan,M.cyan],foe=R?R.foes.map(f=>f.sunk?dead:M.mag):[M.mag,M.mag];
  const line=(mats,a0)=>mats.forEach((m,i)=>{const c=new THREE.Mesh(geo,m),a=a0+(i-(mats.length-1)/2)*.42;
    c.position.set(Math.cos(a)*1.25,(i%2)*.08-(m===dead?.25:0),Math.sin(a)*1.25);c.lookAt(Math.cos(a+.3)*1.25,c.position.y,Math.sin(a+.3)*1.25);F.add(c);});
  line(own,.5);line(foe,.5+Math.PI);
}
