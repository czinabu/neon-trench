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
  {name:'View and system',items:[
    {a:'Cockpit / chase view',k:'Alt',t:'Switch between the cockpit view and the chase camera.'},
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
