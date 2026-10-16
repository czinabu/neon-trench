"use strict";
/* Workshop upgrades bought with credits. They apply to every hull, on top of the hull's own stats
   (see effectiveShip() in js/progression.js). `costs` lists the price of each level in turn. */
const UPGRADES=[
  {id:'guns',  name:'FOCUSED LASERS',  desc:'Tighter beam focus. Every laser bolt hits harder.',
   per:'+10% laser damage',  costs:[400,900,1600], apply:(s,l)=>{s.dmgMul*=1+.10*l;}},
  {id:'cool',  name:'COOLANT LOOP',    desc:'Faster cycling between shots.',
   per:'+8% fire rate',      costs:[400,900,1600], apply:(s,l)=>{s.rofMul/=1+.08*l;}},
  {id:'armor', name:'ABLATIVE PLATING',desc:'Every hit does less damage to shields and hull.',
   per:'-7% damage taken',   costs:[500,1100,1900],apply:(s,l)=>{s.armorMul*=1-.07*l;}},
  {id:'shield',name:'SHIELD CAPACITOR',desc:'Shields recharge faster once you stop taking fire.',
   per:'+25% shield recharge',costs:[350,800,1400],apply:(s,l)=>{s.shieldRegenMul*=1+.25*l;}},
  {id:'boost', name:'BOOST INJECTORS', desc:'Boost energy refills faster.',
   per:'+15% boost recharge',costs:[300,700,1200], apply:(s,l)=>{s.boostRegenMul*=1+.15*l;}},
  {id:'rack',  name:'EXTENDED RACK',   desc:'Carry more missiles into every sortie.',
   per:'+1 missile',         costs:[600,1400],     apply:(s,l)=>{s.mslBonus+=l;}},
];
