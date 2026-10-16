"use strict";
/* Trench segment geometry (recycled pool) and the starfield. */

/* ============================ TRENCH SEGMENTS ============================ */
function buildSegment(){
  const g=new THREE.Group();
  for(const side of [-1,1]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(4,TOP_Y-FLOOR_Y+18,SEG_LEN),M.dark);
    wall.position.set(side*(HALF_W+2),(TOP_Y+FLOOR_Y)/2+9,-SEG_LEN/2); g.add(wall);
    for(let k=0;k<3;k++){ // neon strips
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,SEG_LEN),k%2?M.mag:M.cyan);
      strip.position.set(side*HALF_W, FLOOR_Y+6+k*14, -SEG_LEN/2); g.add(strip);
    }
    for(let k=0;k<9;k++){ // greeble panels + windows
      const p=new THREE.Mesh(new THREE.BoxGeometry(1.2,2+Math.random()*7,3+Math.random()*10),
        Math.random()<.3?M.white:M.dark2);
      p.position.set(side*(HALF_W-.4), FLOOR_Y+4+Math.random()*38, -Math.random()*SEG_LEN); g.add(p);
    }
    // conduit pipes
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,SEG_LEN,6),M.dark2);
    pipe.rotation.x=Math.PI/2;
    pipe.position.set(side*(HALF_W+.6), FLOOR_Y+10+Math.random()*24, -SEG_LEN/2); g.add(pipe);
    // glyph hologram boards
    if(Math.random()<.7){
      const b=new THREE.Mesh(new THREE.PlaneGeometry(5,10),glyphMats[(Math.random()*glyphMats.length)|0]);
      b.position.set(side*(HALF_W-1.2), 6+Math.random()*22, -20-Math.random()*(SEG_LEN-40));
      b.rotation.y=side>0?-Math.PI/2:Math.PI/2; g.add(b);
    }
    // skyline towers above the trench
    const tw=new THREE.Mesh(new THREE.BoxGeometry(14+Math.random()*20,60+Math.random()*120,18),M.dark);
    tw.position.set(side*(HALF_W+30+Math.random()*60), TOP_Y+30+Math.random()*40, -SEG_LEN/2);
    g.add(tw);
    const twl=new THREE.Mesh(new THREE.BoxGeometry(.8,40+Math.random()*60,.8),Math.random()<.5?M.cyan:M.mag);
    twl.position.copy(tw.position); twl.position.x+=side*-8; g.add(twl);
  }
  const floor=new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2+4,2,SEG_LEN),M.dark2);
  floor.position.set(0,FLOOR_Y-1,-SEG_LEN/2); g.add(floor);
  const line=new THREE.Mesh(new THREE.BoxGeometry(.6,.2,SEG_LEN),M.cyan);
  line.position.set(0,FLOOR_Y+.15,-SEG_LEN/2); g.add(line);
  for(let k=0;k<4;k++){
    const cross=new THREE.Mesh(new THREE.BoxGeometry(HALF_W*2,.2,.5),M.mag);
    cross.position.set(0,FLOOR_Y+.12,-(k+.5)*SEG_LEN/4); g.add(cross);
  }
  return g;
}
const segments=[];
for(let i=0;i<SEG_POOL;i++){const s=buildSegment();s.position.z=-i*SEG_LEN;scene.add(s);segments.push(s);}

/* stars */
{
  const starGeo=new THREE.BufferGeometry();const pts=[];
  for(let i=0;i<1100;i++)pts.push((Math.random()-.5)*3000,60+Math.random()*900,(Math.random()-.5)*3500);
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fd8ff,size:1.6,sizeAttenuation:false})));
}
