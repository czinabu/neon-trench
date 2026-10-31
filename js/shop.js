"use strict";
/* Upgrade shop: the hangar's Upgrades tab (js/menus.js), one list for everything you can upgrade. Your ship's workshop
   upgrades (js/data/upgrades.js, credits, every hull), the wing and HALCYON (js/data/fleet.js, credits and parts), then
   each destroyer's refits once the sector map opens (js/data/dock.js, parts). Rows carry data-shop, data-up or data-dock. */

const shipUpLevel=u=>PROG.upgrades[u.id]||0;
const shipUpPrice=u=>{const l=shipUpLevel(u);return l>=u.costs.length?null:u.costs[l];};
const shipUpBuyable=()=>UPGRADES.filter(u=>{const c=shipUpPrice(u);return c!==null&&PROG.credits>=c;}).length;
const hullsBuyable=()=>SHIPS.filter(s=>hullState(s).afford).length;
const fleetPrice=u=>{const l=fleetLevel(u.id);return l>=u.costs.length?null:u.costs[l];};
const fleetCanBuy=u=>{const c=fleetPrice(u);return c!==null&&PROG[u.cur]>=c;};
const fleetBuyable=()=>FLEET_UPGRADES.filter(fleetCanBuy).length;
/* everything in the shop you can afford right now */
const shopBuyable=()=>shipUpBuyable()+fleetBuyable()+dockRefitsBuyable();
const shopCost=(c,cur)=>c.toLocaleString()+(cur==='parts'?' ◆':' cr');
/* one row: name, what a level adds, pips, then the buy button or Maxed. The description shows on hover or focus */
function shopRow(name,per,desc,l,max,c,ok,attr){
  return '<div class="ccup'+(c===null?' maxed':'')+'"><div><b>'+name+'</b><span>'+per+'</span>'+(desc?'<small>'+desc+'</small>':'')+'</div>'
    +dockPips(l,max)+(c===null?'<em class="ok">Maxed</em>':'<button class="btn alt ccbuy" '+attr+(ok?'':' disabled')+'>'+c+'</button>')+'</div>';
}
const shopSort=(list,price)=>list.slice().sort((a,b)=>(price(a)===null)-(price(b)===null));   // maxed ones sink to the bottom
function shopShipRows(){
  return shopSort(UPGRADES,shipUpPrice).map(u=>{const c=shipUpPrice(u);
    return shopRow(u.name,u.per,u.desc,shipUpLevel(u),u.costs.length,c===null?null:shopCost(c),c!==null&&PROG.credits>=c,'data-shop="'+u.id+'"');}).join('');
}
function shopFleetRows(g){
  return shopSort(FLEET_UPGRADES.filter(u=>u.group===g),fleetPrice).map(u=>{const c=fleetPrice(u);
    return shopRow(u.name,u.per,u.desc,fleetLevel(u.id),u.costs.length,c===null?null:shopCost(c,u.cur),fleetCanBuy(u),'data-up="'+u.id+'"');}).join('');
}
function shopLevels(){
  const lv=UPGRADES.reduce((n,u)=>n+shipUpLevel(u),0)+FLEET_UPGRADES.reduce((n,u)=>n+fleetLevel(u.id),0);
  const max=UPGRADES.reduce((n,u)=>n+u.costs.length,0)+FLEET_UPGRADES.reduce((n,u)=>n+u.costs.length,0);
  return [lv,max];
}
/* a row's group and name, to find it again after a redraw */
function shopRowKey(r){let g=r.previousElementSibling;while(g&&!g.classList.contains('ccgrp'))g=g.previousElementSibling;return (g?g.textContent:'')+'|'+r.querySelector('b').textContent;}
function renderShop(){
  const f=document.activeElement,back=f&&f.parentNode===upList&&f.classList.contains('ccup')?shopRowKey(f):null;
  const top=upList.scrollTop;
  upList.innerHTML='<div class="ccgrp">Your ship · credits · every hull</div>'+shopShipRows()
    +'<div class="ccgrp">Wingmen · credits</div>'+shopFleetRows('wing')
    +'<div class="ccgrp">HALCYON · parts</div>'+shopFleetRows('carrier')+dockRefitBody();
  upList.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>shopBuy(()=>buyUpgrade(UPGRADES.find(u=>u.id===b.dataset.shop))));
  upList.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>shopBuy(()=>buyFleetUpgrade(FLEET_UPGRADES.find(u=>u.id===b.dataset.up))));
  upList.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>dockAct(b.dataset.dock));   // js/dock.js: destroyer refits
  /* the pad steps through whole rows (a row spans the list, so the D-pad finds it from the tabs) and A on a row presses its
     buy button; the buttons themselves stay for the mouse. A focused row shows its description */
  for(const r of upList.querySelectorAll('.ccup')){
    const b=r.querySelector('.ccbuy');r.tabIndex=0;if(b)b.tabIndex=-1;
    r.onclick=e=>{if(e.target===r&&b&&!b.disabled)b.click();};
  }
  upList.scrollTop=top;
  if(back){const r=[...upList.querySelectorAll('.ccup')].find(x=>shopRowKey(x)===back);if(r)r.focus({preventScroll:true});}   // a buy redraws the list: keep the focus on that row
}
function shopBuy(fn){if(fn()){sfx('acquire');renderHangar();}}
