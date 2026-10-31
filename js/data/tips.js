"use strict";
/* Fleet tips (js/fleettips.js): a short card in the corner of the fight the first time each fleet battle mechanic comes up,
   in campaign ops and skirmish alike. Each shows once per pilot (PROG.tips). Kept to a title and one or two sentences.
   {n} is the ship it is about. The order here is the order they queue in when several come up at once. */
const FLEET_TIPS={
  subsys:  {t:'Strip their systems',d:'Enemy capitals carry three subsystems. Shoot out the shield generator and your fleet\'s broadsides bite; the engines stop it closing, the bridge wrecks its aim.'},
  bridge:  {t:'Command from the bridge',d:'Press B to step back to the holo table aboard HALCYON. Press B again to relink to your fighter. Click an enemy capital there to put your broadsides on it.'},
  focus:   {t:'Focus fire',d:'{n}\'s shield is down. Put your ships on it now: shells into a shield are mostly wasted.'},
  groups:  {t:'Battle groups',d:'On the bridge, select FLEET at the top of the list to order every capital at once.'},
  roles:   {t:'Ship roles',d:'Select a destroyer on the bridge to set its role. Line holds, Screen guards HALCYON, Artillery stands off and hits hard.'},
  forms:   {t:'Formations',d:'Line abreast lands more hits, Column takes fewer, Screen puts your destroyers in front of HALCYON.'},
  admiral: {t:'Enemy admiral',d:'{n} carries their admiral, who reacts to your orders. Shoot out {n}\'s bridge to silence it.'},
  admPlan: {t:'The admiral answers',d:'Mass on one ship and it covers it; fall back and it chases; leave HALCYON alone and it hunts her. Watch the FLEET panel.'},
  screen:  {t:'Your screen works',d:'{n} took a shell meant for HALCYON. A screen only catches fire while it sits between HALCYON and the enemy.'},
  foeScreen:{t:'Enemy screen',d:'{n} is covering for another ship. Hit the screen first, or come at its ward from the side.'},
  artillery:{t:'Enemy artillery',d:'{n} hangs back and shells you from long range. Send your wing or a destroyer after it.'},
  silenced:{t:'Admiral silenced',d:'Their line no longer covers, chases or focuses fire. Press the attack.'},
  reserve: {t:'The reserve',d:'{n} waits one jump out. On the bridge, FLEET row, call it in and click where it should warp in. Once only.'},
  gate:    {t:'The Kiru Gate',d:'It sends a fresh capital through on a timer until its three anchors are shot out.'},
};
