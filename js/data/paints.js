"use strict";
/* Hull paint schemes for the hangar's Paint tab. A paint tints every hull's body toward `tint` (`mix` of the way) and
   swaps the glowing edge lines for `edge` and `edge2`, so each hull keeps its own look. Bought with credits (`cost`)
   or earned by clearing an op (`after`: a mission id). The pick is saved as PROG.paint, bought ones in PROG.paints. */
const PAINTS=[
  {id:'std',     name:'FACTORY',      desc:'The stock Rim Fleet finish.',                                       cost:0},
  {id:'ember',   name:'EMBER',        desc:'Burnt orange plating with amber trim.',                              cost:500,tint:0xd9552a,mix:.45,edge:0xffb300,edge2:0xff3b3b},
  {id:'glacier', name:'GLACIER',      desc:'Pale blue-white plating, cold cyan trim.',                           cost:500,tint:0x9fd8ff,mix:.5, edge:0x00f0ff,edge2:0xffffff},
  {id:'void',    name:'VOID',         desc:'Near-black plating with violet and magenta trim.',                   cost:800,tint:0x2a2338,mix:.6, edge:0xb050ff,edge2:0xff2d78},
  {id:'gilt',    name:'KESTREL GILT', desc:'Gold plating in the squadron leader\'s colours.',                    after:'m5',tint:0xcaa24a,mix:.5, edge:0xffd54a,edge2:0xffffff},
  {id:'crown',   name:'SOVEREIGN',    desc:'Ivory and gold, the flagship\'s livery.',                            after:'m17',tint:0xe8e2cf,mix:.55,edge:0xffd54a,edge2:0xff2d78},
];
const paintById=id=>PAINTS.find(p=>p.id===id)||PAINTS[0];
const paintOwned=p=>!p.cost&&!p.after||(PROG.paints||[]).includes(p.id)||!!(p.after&&PROG.completed[p.after]);
/* a hull's visual config with the equipped paint applied (the hull's own config is left alone) */
function paintedVisual(v){
  const p=paintById(PROG.paint);
  if(!p.tint||!paintOwned(p))return v;
  const t=new THREE.Color(p.tint),c1=new THREE.Color(v.hullColor).lerp(t,p.mix),c2=new THREE.Color(v.hullColor2).lerp(t,p.mix*.7);
  return Object.assign({},v,{hullColor:c1.getHex(),hullColor2:c2.getHex(),edgeColor:p.edge,edgeColor2:p.edge2});
}
