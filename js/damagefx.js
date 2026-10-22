"use strict";
/* Visible damage on the player's ship, in chase and cockpit view.
   Shield: an energy bubble around the hull that ripples cyan from each hit, flares orange when the
   shield collapses, and flickers while it runs low. Hull: scorch marks build up where you were hit and
   sparks, smoke and finally fire leak from them as hull drops. Built into `shipVis` by rebuildShip(). */
const DFX_MAX_HITS=3, DFX_MAX_SCORCH=8;
let dfxBubble=null, dfxHits=[], dfxBreakT=9, dfxRadii=new THREE.Vector3(2,1,3), dfxScorch=[], dfxScorchGroup=null, dfxLastTier=0;
const dfxV=new THREE.Vector3(), dfxW=new THREE.Vector3();
const DFX_VERT=`varying vec3 vN;varying vec3 vDir;varying vec3 vView;
void main(){vDir=normalize(position);vN=normalize(normalMatrix*normal);
vec4 mv=modelViewMatrix*vec4(position,1.);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
const DFX_FRAG=`uniform vec4 uHit[${DFX_MAX_HITS}];uniform float uBreak;uniform float uLow;uniform float uTime;
varying vec3 vN;varying vec3 vDir;varying vec3 vView;
void main(){
  float fres=pow(1.-abs(dot(normalize(vN),normalize(vView))),2.2);
  float a=0.;
  for(int i=0;i<${DFX_MAX_HITS};i++){
    vec4 h=uHit[i];if(h.w<0.)continue;
    float d=acos(clamp(dot(vDir,h.xyz),-1.,1.));
    float ring=exp(-pow((d-h.w*3.2)*4.5,2.));
    float core=exp(-d*d*5.)*exp(-h.w*5.);
    a+=(ring*.9+core*1.4)*exp(-h.w*1.8);
  }
  vec2 g=abs(fract(vDir.xz*7.+vDir.y*5.)-.5);float grid=smoothstep(.42,.5,max(g.x,g.y));   // faint hex-ish lattice, brightest under the ripple
  vec3 col=mix(vec3(.1,.85,1.),vec3(.8,1.,1.),clamp(a,0.,1.));
  float alpha=(a*(.55+grid*.8)+fres*a*.8);
  float flick=uLow*step(.55,fract(sin(uTime*47.)*43758.5))*(.08+fres*.25);
  alpha+=flick;
  vec3 bc=vec3(1.,.5,.15);
  float b=uBreak*(.35+fres*.9);
  col=mix(col,bc,clamp(uBreak*2.,0.,1.));alpha+=b;
  gl_FragColor=vec4(col,clamp(alpha,0.,1.));
}`;
function initDamageFx(){
  const box=new THREE.Box3().setFromObject(shipVis),sz=box.getSize(dfxV);
  dfxRadii.set(Math.max(1.6,sz.x/2*1.12),Math.max(1,sz.y/2*1.3),Math.max(2.4,sz.z/2*1.08));
  const ctr=box.getCenter(dfxW);
  dfxHits=[];for(let i=0;i<DFX_MAX_HITS;i++)dfxHits.push(new THREE.Vector4(0,0,1,-1));
  dfxBubble=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),new THREE.ShaderMaterial({
    uniforms:{uHit:{value:dfxHits},uBreak:{value:0},uLow:{value:0},uTime:{value:0}},
    vertexShader:DFX_VERT,fragmentShader:DFX_FRAG,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  dfxBubble.scale.copy(dfxRadii);dfxBubble.position.copy(ctr);dfxBubble.visible=false;dfxBubble.frustumCulled=false;
  shipVis.add(dfxBubble);
  dfxScorchGroup=new THREE.Group();shipVis.add(dfxScorchGroup);
  dfxScorch=[];dfxBreakT=9;dfxLastTier=0;
}
function resetDamageFx(){
  if(!dfxBubble)return;
  for(const h of dfxHits)h.w=-1;
  for(const s of dfxScorch)dfxScorchGroup.remove(s.grp);
  dfxScorch=[];dfxBreakT=9;dfxLastTier=0;dfxBubble.visible=false;
}
/* a dark smudge with a hot ember on top; the ember only glows once the hull is hurt */
function addScorch(dir){
  if(dfxScorch.length>=DFX_MAX_SCORCH)dfxScorchGroup.remove(dfxScorch.shift().grp);
  const grp=new THREE.Group();
  grp.position.set(dir.x*dfxRadii.x,dir.y*dfxRadii.y,dir.z*dfxRadii.z).multiplyScalar(.85).add(dfxBubble.position);
  const sc=1.2+Math.random()*1.0;
  const smudge=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x050507,transparent:true,opacity:.8,depthWrite:false}));
  smudge.scale.setScalar(sc);
  const ember=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xff6a1a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  ember.scale.setScalar(sc*.55);
  grp.add(smudge,ember);dfxScorchGroup.add(grp);
  dfxScorch.push({grp,ember,ph:Math.random()*6});
}
/* called from damage(): `from` is a world point the hit came from (may be absent), `hullHit` = it got through the shield */
function hitShipFx(from,onShield,shieldBroke,hullHit){
  if(!dfxBubble)return;
  if(from)dfxV.copy(from);else dfxV.set(Math.random()-.5,Math.random()-.2,Math.random()-.5).multiplyScalar(50).add(ship.position);
  shipVis.worldToLocal(dfxV).sub(dfxBubble.position);
  dfxV.set(dfxV.x/dfxRadii.x,dfxV.y/dfxRadii.y,dfxV.z/dfxRadii.z);
  if(dfxV.lengthSq()<1e-6)dfxV.set(0,1,0);
  dfxV.normalize();
  if(onShield){   // reuse the oldest ripple slot
    let h=dfxHits[0];for(const x of dfxHits)if(x.w<0||x.w>h.w)h=x;
    h.set(dfxV.x,dfxV.y,dfxV.z,0);
  }
  if(shieldBroke)dfxBreakT=0;
  if(hullHit)addScorch(dfxV);
}
function updateDamageFx(dt){
  if(!dfxBubble)return;
  let live=false;
  for(const h of dfxHits)if(h.w>=0){h.w+=dt;if(h.w>1.8)h.w=-1;else live=true;}
  if(dfxBreakT<9){dfxBreakT+=dt;}
  const brk=Math.max(0,1-dfxBreakT/.9);
  const low=S.shield>0&&S.shield<25&&S.mode==='play'?1:0;
  const u=dfxBubble.material.uniforms;
  u.uBreak.value=brk*brk;u.uLow.value=low;u.uTime.value=S.time;
  dfxBubble.visible=live||brk>0||low>0;
  /* hull: new scorch at each damage tier even when nothing hit a specific spot (heat, stress) */
  const tier=S.hull<25?3:S.hull<50?2:S.hull<75?1:0;
  if(tier>dfxLastTier&&S.mode==='play'){for(let i=dfxLastTier;i<tier;i++){dfxV.set(Math.random()-.5,Math.random()*.8,Math.random()-.5).normalize();addScorch(dfxV);}}
  dfxLastTier=tier;
  const heat=Math.max(0,Math.min(1,(75-S.hull)/60));   // 0 healthy .. 1 critical
  for(const s of dfxScorch){
    s.ember.material.opacity=heat*(.5+.5*Math.sin(S.time*9+s.ph))*.9;
    if(heat<=0||S.mode!=='play')continue;
    s.grp.localToWorld(dfxW.set(0,0,0));
    if(Math.random()<heat*dt*3)spark(dfxW,0xff9030,1,5+heat*6);
    if(heat>.5&&Math.random()<heat*dt*2)puff(dfxW,1);
    if(heat>.8&&Math.random()<dt*7)fireball(dfxW,0xff5a10,.18);
  }
}
