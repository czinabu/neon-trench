"use strict";
/* The in-game Roadmap tab (title screen). ROADMAP.md is the same list; keep the two in step when
   something ships or moves. Groups run Done, In progress, Next, Later.
     name  group heading   note  optional line under it
     items [{t:title, d:one sentence}]; Later items have no d and render as one-liners. */
const ROADMAP=[
  {name:'In progress',key:'progress',note:'Being built right now.',items:[
    {t:'Campaign ranks',d:'Three ranks, earned by clearing ops: Flight Officer (solo), Lieutenant (wingmen and 1-6 orders), Commander (command bridge and fleet battles). Next: tune where promotions fall.'},
    {t:'Command center',d:'A hub aboard HALCYON: sortie board, fleet status, hangar, campaign log and an Upgrades subtab. Next: pilots shot down sit out the following op.'},
    {t:'Command bridge',d:'Press B with HALCYON on station for a slowed tactical map (orbit, pan, zoom) where you order the wing, HALCYON and SOLACE. Select YOU to put your own ship on autopilot. Click an enemy turret to send a unit or the broadsides at it; Strike capital goes for the guns first. Runs Ambush Lane and Spearhead. Next: tune both.'},
    {t:'Fleet formations',d:'Two wingmen take 1-6 orders, can be shot down, and pick their own targets. The command bridge orders each one separately.'},
    {t:'Squadron command',d:'From the bridge, launch TALON and WRAITH from HALCYON\'s hangar (two fighters each) and order three squadrons separately, each under its own leader. Commander rank. Next: more squadron types, then a holo-globe command room aboard a capital ship.'},
    {t:'Fleet battles',d:'Broadside: HALCYON and SOLACE trade broadsides with MAW and VESPER while you knock out their subsystems. Next: enemy fighter escorts and a free-arena option.'},
    {t:'Capital ships',d:'MAW and VESPER warp into arena runs; HALCYON launches your wing. Also Shipbreaker, Dark Approach, Hold Halcyon and Heart of the Throne with its escape run.'},
    {t:'Controls screen',d:'Key bindings grouped by section as cards; hover or click a row for its tip.'},
    {t:'Enemy squadrons',d:'Lead plus two wingmen fly in formation and break to dogfight. Next: squadron types and formation-aware targeting.'},
  ]},
  {name:'Next',key:'next',note:'Small to medium, builds on what exists.',items:[
    {t:'Campaign arcs and radio chatter',d:'Group ops into acts with a title card, plus timed handler and wingman lines during a mission.'},
    {t:'New objective types',d:'Escort, strike targets, interceptor and a time trial, all on the existing trench and arena.'},
    {t:'Survival mode',d:'Endless arena waves with a best-wave record.'},
    {t:'Key rebinding',d:'Rebind controls in Settings, saved with the other settings.'},
    {t:'Gameplay tests',d:'Extend npm test with win and lose checks for each mission.'},
  ]},
  {name:'Later',key:'later',note:'Ideas, not scheduled.',items:[
    {t:'Named characters and Kestrel rematches'},
    {t:'Secondary weapon loadouts'},{t:'Power routing and shield facing'},{t:'New enemy classes'},
    {t:'More hulls and cosmetics'},{t:'Trench variants and asteroid field'},{t:'Boss fights'},
    {t:'Difficulty settings and mission modifiers'},{t:'Photo mode and accessibility options'},{t:'Gamepad support'},
  ]},
  {name:'Done',key:'done',note:'Shipped; details in CHANGELOG.md.',items:[
    {t:'Capital ship design pass',d:'HALCYON, SOLACE, MAW, VESPER and the hull round THRONE\'s breach rebuilt to match the fighters: faceted armoured hulls, lit window galleries, neon trim, detailed engines and turrets, HALCYON\'s angled deck and lit launch bay, VESPER\'s forked lance prow, and layered plating and gun decks round the breach. Weak points, hit points and the fights play as before.'},
    {t:'Ship damage feedback',d:'Shield hits ripple across an energy bubble round your ship, a collapsing shield flares and a weak one flickers. Hull hits leave scorch marks that spark, smoke and finally burn as hull drops, in chase and cockpit view.'},
    {t:'Sound pass',d:'A heroic menu anthem that starts on the first click, an afterburner whoosh, a mission-complete stinger, menu click sounds and a master volume slider next to music and effects.'},
    {t:'Cinematic score',d:'Orchestral space-opera music (swelling strings, sub drone, low brass, choir, horn theme and taiko) replaces the synthwave: a stately menu theme and separate themes for the trench, the arena, capital fights and danger that build with the battle. Ship engine sound is quieter by default.'},
    {t:'Sound pass 2',d:'Layered engine sound, punchier blasters, missile launch and impact sounds, and adaptive music that changes theme for the trench, the arena, capital fights and danger, with tempo following intensity.'},
    {t:'Flight school',d:'A controls tour plus nine graded drills (rings, slalom, strafing, throttle, gunnery, moving targets, missile lock, evasion, and a final check ride) in an academy range.'},
    {t:'Cockpit and chase HUD rework',d:'Thin line-work gauges that move with the ship and sit on the glass.'},
    {t:'Battle HUD tidy',d:'Compact one-line capital ship panel, trench gauges hidden in open space, no stray key hints by the reticle.'},
    {t:'Decoupled flight and cruise control',d:'Realistic mode is now Newtonian: thrust adds velocity, the ship drifts while you rotate, and X brakes. Cruise control has its own key (T) and works in either model.'},
    {t:'Targeting and missile mode',d:'Target lock on R, missile mode on middle click, flight model on V, camera on Alt.'},
    {t:'Visibility pass',d:'Clearer enemies, trench sky and a rebalanced missile.'},
    {t:'Larger arena',d:'The combat zone grows from 620 to 1000 radius with more asteroids, a wider rock belt and enemies that arrive from further out.'},
    {t:'Arena combat',d:'Deep-space arena, solid obstacles, dogfight AI, flares and a chase-view nose lean.'},
    {t:'Menus, hangar and fullscreen',d:'3D backdrop per mode, revolving hangar hull, free modes unlocked by the campaign. The sortie board and flight school use the hangar layout: a title row per entry, hover previews the details and a click locks the choice in, with Start mission and Start lesson buttons beside Back.'},
    {t:'Core game',d:'Five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety.'},
  ]},
];
