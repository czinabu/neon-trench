"use strict";
/* WebGL renderer, scene, camera, lights, bloom post-processing, shared materials. */

/* ============================ RENDERER ============================ */
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.FogExp2(0x070a18, 0.0024);   // a touch clearer → more reaction time at speed
const FOG_A=new THREE.Color(0x070a18), FOG_B=new THREE.Color(0x1c0a14); // entry blue → reactor warm tint
const camera = new THREE.PerspectiveCamera(78, innerWidth/innerHeight, 0.08, 4000);
scene.add(new THREE.AmbientLight(0x33405f, .9));
scene.add(new THREE.HemisphereLight(0x2c4a6e, 0x0c0a14, .4));
const dir = new THREE.DirectionalLight(0x7fb0ff, .55); dir.position.set(.3,1,.4); scene.add(dir);

/* ---------- bloom post-processing (graceful fallback if the CDN libs miss) ---------- */
let composer=null, bloomPass=null;
const useBloom = !!(THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass);
if(useBloom){
  composer=new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene,camera));
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),
    0.85,  /* strength  */
    0.55,  /* radius    */
    0.62); /* threshold — only the bright neon blooms, the dark trench stays clean */
  composer.addPass(bloomPass);
  composer.setPixelRatio(Math.min(devicePixelRatio,2));
}
function renderFrame(){ if(composer) composer.render(); else renderer.render(scene,camera); }

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  if(composer){composer.setSize(innerWidth,innerHeight);bloomPass.setSize(innerWidth,innerHeight);}});

/* ============================ MATERIALS ============================ */
const M = {
  dark : new THREE.MeshLambertMaterial({color:0x0e1226}),
  dark2: new THREE.MeshLambertMaterial({color:0x161d3a}),
  cyan : new THREE.MeshBasicMaterial({color:0x00f0ff}),
  mag  : new THREE.MeshBasicMaterial({color:0xff2d78}),
  amber: new THREE.MeshBasicMaterial({color:0xffb300}),
  white: new THREE.MeshBasicMaterial({color:0xbfeaff}),
  boltP: new THREE.MeshBasicMaterial({color:0x00f0ff,blending:THREE.AdditiveBlending,transparent:true}),
  boltE: new THREE.MeshBasicMaterial({color:0xff2d78,blending:THREE.AdditiveBlending,transparent:true}),
  glow : new THREE.MeshBasicMaterial({color:0xff5500,blending:THREE.AdditiveBlending,transparent:true,opacity:.9}),
  flame: new THREE.MeshBasicMaterial({color:0x35e8ff,blending:THREE.AdditiveBlending,transparent:true,opacity:.95}),
};

/* glyph billboard texture (street-sign holograms) */
function glyphTexture(color){
  const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');
  g.fillStyle='rgba(5,6,15,.85)';g.fillRect(0,0,128,256);
  g.fillStyle=color;g.font='bold 44px monospace';g.textAlign='center';
  for(let i=0;i<5;i++){const ch=String.fromCharCode(0x30A0+((Math.random()*96)|0));g.fillText(ch,64,48+i*44);}
  g.strokeStyle=color;g.lineWidth=3;g.strokeRect(4,4,120,248);
  return new THREE.CanvasTexture(c);
}
const glyphMats=[];
for(let i=0;i<6;i++) glyphMats.push(new THREE.MeshBasicMaterial({
  map:glyphTexture(i%2?'#00f0ff':'#ff2d78'),transparent:true,opacity:.92,side:THREE.DoubleSide}));
