"use strict";
/* The Controls screen (title or pause): sections of bindings, one row each, with the details panel
   showing the hovered or selected row. To add a control, push an item into the right group (or add a group).
     name   section heading
     items  [{a:short action, k:key label (omit for a tip), t:tip shown in the panel, n:optional extra panel line}] */
const CONTROLS=[
  {name:'Flight',items:[
    {a:'Steer',k:'Mouse',t:'Pitch and yaw follow the mouse. Click the game once to capture the pointer.'},
    {a:'Throttle',k:'W · S',t:'Throttle up and down. In the realistic flight model W and S are thrust forward and back instead.'},
    {a:'Brake to a stop',k:'X',t:'Kills your speed and cancels cruise control. In the realistic model it is the way to stop drifting.'},
    {a:'Cruise control',k:'T',t:'Holds your current speed hands-off. Works in either flight model; press again to release.'},
    {a:'Strafe',k:'A · D',t:'Slide left and right without turning. Good for dodging while keeping a target in your sights.'},
    {a:'Climb / descend',k:'Space · C',t:'Slide up and down without pitching.'},
    {a:'Roll',k:'Q · E',t:'Roll the ship. Match a roll gate\'s slot angle as you pass through it for Overdrive: shields, a missile and faster guns.'},
    {a:'Boost',k:'Shift',t:'A burst of speed that drains the boost gauge and recharges when released.'},
  ]},
  {name:'Weapons',items:[
    {a:'Lasers',k:'Left click',t:'Hold to fire. In missile mode the same click launches a missile instead.'},
    {a:'Zoom',k:'Right click',t:'Hold to zoom in for long shots.'},
    {a:'Target hostile',k:'R',t:'Selects the hostile nearest your crosshair; press again to cycle. The target box shows range, closing speed and hull, the lead ring follows it, and missiles lock only it.'},
    {a:'Lasers / missiles',k:'Middle click',t:'Switch weapon mode. Target an enemy with R, hold it in your sights until it locks, then left click to fire.'},
    {a:'Torpedo',k:'F',t:'Lock on the reactor core and press F. Only works at a reactor.'},
    {a:'Flares',k:'G',t:'Decoy homing missiles. Hunters and aces fire them, so pop flares, break hard, boost away or shoot the missile down. Flares recharge over time.'},
  ]},
  {name:'Wingman orders',items:[
    {a:'Form up',k:'1',t:'Wingmen fly on your wing. Orders work in the arena, when you have a wing.'},
    {a:'Attack my target',k:'2',t:'Both wingmen go after the hostile you have targeted with R.'},
    {a:'Free engage',k:'3',t:'Wingmen pick their own targets and dogfight freely.'},
    {a:'Cover me',k:'4',t:'Wingmen engage the hostile fighters nearest you, splitting up when there is more than one.'},
    {a:'Defend HALCYON',k:'5',t:'Wingmen engage the hostile fighters nearest the carrier. Needs HALCYON on station.'},
    {a:'Strike capital',k:'6',t:'Wingmen attack the enemy capital ship\'s weak points. Needs a capital ship in the zone.'},
  ]},
  {name:'Squadrons',items:[
    {a:'Launch a squadron',k:'B, then TALON / WRAITH',t:'Needs Commander rank and HALCYON on station. Select an unlaunched squadron on the bridge and press Launch: two fighters leave the bay (HALCYON carries two squadrons) and hold station beside it. Lost pilots are not replaced.'},
    {a:'Order a squadron',k:'B, then 1-6',t:'Select a squadron in the panel, or click its leader\'s marker on the map (click again for a single pilot). Buttons or the 1-6 keys give it an order, and you can click a hostile or a friendly capital to send it there. Your own wing keeps taking 1-6 in the cockpit.'},
  ]},
  {name:'Autopilot',items:[
    {a:'Order your own ship',k:'B, then YOU',t:'Needs Commander rank. On the command bridge, select YOU and pick an order (hold on HALCYON, attack my target, free engage, cover the wing, defend HALCYON, strike capital) or click a hostile or a friendly capital. Your ship flies it, back in the cockpit too, with the wing\'s targeting.'},
    {a:'Take the stick back',k:'Any flight input',t:'W S A D Q E X C T, Space, Shift, a mouse move or a fire click puts you back in control, as does Take the stick on the bridge.'},
  ]},
  {name:'View and system',items:[
    {a:'Cockpit / chase view',k:'Alt',t:'Switch between the cockpit view and the chase camera.'},
    {a:'Command bridge',k:'B',t:'Arena fights with HALCYON on station: the battle slows and the mouse is freed, and you step into HALCYON\'s command room, with the fight on a holo-globe in the middle of the deck. Drag to orbit, right-drag (or middle / Shift-drag, or W A S D) to pan, C to recentre, wheel to zoom, click a ship to send a squadron, a single wingman, HALCYON or SOLACE at it, or pick an order. Launch the TALON and WRAITH squadrons from HALCYON\'s hangar (two fighters each) and give each its own orders. Selecting a unit swings the camera to it. Pick YOU (or click your marker) to give your own ship an order and fly it on autopilot. B or Esc returns to the cockpit.'},
    {a:'Holo-globe / live view',k:'B, then V',t:'On the command bridge, swap between the command room\'s holo-globe and the live view out over the fight itself. Orders, markers, panning and zoom work the same in both; on the globe the wheel zooms the map, and anything out of range sits on its rim.'},
    {a:'Flight model',k:'V',t:'Toggle between arcade and realistic (decoupled, Newtonian) flight. Realistic flight drifts: thrust adds velocity and the ship keeps moving while you rotate. Use X to brake.'},
    {a:'Pause',k:'Esc · P',t:'Pause the run. The pause menu has Settings and this screen.'},
    {a:'Mute sound',k:'N',t:'Mute or unmute all sound.'},
  ]},
  {name:'Tips',items:[
    {a:'Roll gates',t:'Match the slot\'s angle as you pass through for Overdrive: shields, a missile and faster guns.'},
    {a:'Combos',t:'Chain kills quickly to raise the score multiplier.'},
    {a:'Incoming missiles',t:'Pop flares (G) to decoy them, break hard, boost away, or shoot them down.'},
    {a:'Pickups',t:'Wrecks drop shield, missile and score pickups. Fly through them to collect.'},
  ]},
];
