"use strict";
/* Ship roster: stats + visual config for every unlockable hull. */

/* Ship roster — unlockable hulls, spent from the same `parts` currency missions pay out.
   Each stat is a multiplier applied at its one hot-path touch point (turn rate, thrust,
   accel, boost regen, incoming damage, missile capacity) — kept few + isolated so balance
   stays easy to retune. armorMul<1 = tankier (less damage taken), >1 = fragile. */
/* visual: the exterior silhouette per hull — hull/wing proportions, engine size, accent
   colors, and a `guns` array of {x,y} barrel mount points (count = firepower read, not
   damage — actual DPS stays balanced by the stats above; more barrels just LOOK heavier). */
/* dmgMul/rofMul are the REAL firepower knobs (unlike the visual gun count, these actually
   change DPS): rofMul multiplies the shot cooldown (lower = faster fire), dmgMul multiplies
   per-hit damage. Approx sustained laser DPS at baseline (10/s): Razor 10, Viper ~9.5
   (2.4x RPM but weaker hits — net slightly below baseline), Bulwark ~13.3 (slower but the
   biggest hits — highest DPS, the payoff for its poor mobility). */
/* cmMax/cmRecharge: countermeasure flares (G) — charges carried, and seconds to regain one.
   after: an op that must be cleared before the hull can be unlocked (on top of its parts cost). */
const SHIPS=[
  {id:'s1',name:'RAZORLINE',cost:0,role:'Standard hull',desc:'Balanced multirole fighter — no weaknesses, no edges.',
   spdMul:1,accelMul:1,turnMul:1,boostRegenMul:1,armorMul:1,mslBonus:0,dmgMul:1,rofMul:1,cmMax:4,cmRecharge:10,
   visual:{cockpit:'fighter',hullShape:'diamond',hullColor:0x4a5878,hullColor2:0x2c3348,hullR:1.0,hullLen:5.8,wingSpan:6.6,wingThick:.14,edgeColor:0xff2d78,edgeColor2:0x00f0ff,doubleEdge:true,
     engineR1:.34,engineR2:.42,engineLen:1.6,engineX:2.6,
     gunR:.09,gunZ:.3,gunLen:2.4,gunTipZ:-.95,guns:[{x:-3.2,y:-.1},{x:3.2,y:-.1}],
     canopyPos:[0,.55,-.2],canopyScale:[1,.6,1.6],pod:false}},
  {id:'s2',name:'VIPER-9',cost:3,role:'Interceptor',desc:'Needle-slim and fast. Twin-linked cannon runs hot — light hits, brutal rate of fire. Paper-thin armor.',
   spdMul:1.15,accelMul:1.2,turnMul:1.15,boostRegenMul:1.3,armorMul:1.35,mslBonus:-1,dmgMul:.4,rofMul:.42,cmMax:3,cmRecharge:6.5,
   visual:{cockpit:'interceptor',hullShape:'needle',hullColor:0xb7c2d6,hullColor2:0x56627a,hullR:.6,hullLen:7.6,wingSpan:4.2,wingThick:.09,edgeColor:0x00f0ff,edgeColor2:0x00f0ff,doubleEdge:false,
     engineR1:.22,engineR2:.27,engineLen:1.3,engineX:1.5,
     gunR:.075,gunZ:.05,gunLen:3.2,gunTipZ:-1.75,guns:[{x:0,y:-.48}],
     canopyPos:[0,.46,-.05],canopyScale:[.78,.5,1.75],pod:false}},
  {id:'s3',name:'BULWARK',cost:5,role:'Heavy gunship',desc:'Armored slab of a hull with a quad-cannon spread — slow to turn, devastating per hit. Built to take a beating and keep firing.',
   spdMul:.88,accelMul:.8,turnMul:.82,boostRegenMul:.75,armorMul:.7,mslBonus:2,dmgMul:2.0,rofMul:1.5,cmMax:6,cmRecharge:12,
   visual:{cockpit:'gunship',hullShape:'block',hullColor:0x6b6150,hullColor2:0x3a3530,hullR:1.35,hullLen:5.0,wingSpan:8.8,wingThick:.26,edgeColor:0xffb300,edgeColor2:0xff3b3b,doubleEdge:true,
     engineR1:.48,engineR2:.6,engineLen:2.0,engineX:3.4,
     gunR:.14,gunZ:.4,gunLen:2.8,gunTipZ:-1.1,guns:[{x:-4.1,y:.05},{x:-2.6,y:-.3},{x:2.6,y:-.3},{x:4.1,y:.05}],
     canopyPos:[0,.76,-.05],canopyScale:[1.2,.86,1.45],pod:true}},
  {id:'s4',name:'STILETTO',cost:7,after:'m5',role:'Dogfighter',desc:'Forward-swept wings and a V-tail: the tightest turn in the fleet. Built to out-turn Kestrel\'s aces. Light armor, quick wing cannons, a deep flare rack.',
   spdMul:1.02,accelMul:1.12,turnMul:1.32,boostRegenMul:1.15,armorMul:1.15,mslBonus:0,dmgMul:.75,rofMul:.7,cmMax:5,cmRecharge:8,
   visual:{cockpit:'duelist',hullShape:'swept',hullColor:0x46606a,hullColor2:0x23323a,hullR:.8,hullLen:7.0,wingSpan:6.2,wingThick:.11,edgeColor:0x3dffa8,edgeColor2:0xffd23d,doubleEdge:true,
     engineR1:.28,engineR2:.35,engineLen:1.7,engineX:.92,
     gunR:.08,gunZ:.15,gunLen:2.6,gunTipZ:-1.4,guns:[{x:-2.05,y:-.16},{x:2.05,y:-.16}],
     canopyPos:[0,.5,-.45],canopyScale:[.82,.55,1.9],pod:false}},
];
const shipById=id=>SHIPS.find(s=>s.id===id)||SHIPS[0];
