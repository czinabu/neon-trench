"use strict";
/* The in-game Roadmap tab (title screen). ROADMAP.md is the same list; keep the two in step when
   something ships or moves. Groups run Done, In progress, Next, Later.
     name  group heading   note  optional line under it
     items [{t:title, d:one sentence}]; Later items have no d and render as one-liners. */
const ROADMAP=[
  {name:'In progress',key:'progress',note:'Being built right now.',items:[
    {t:'Command center',d:'The campaign now opens on a hub aboard HALCYON: the sortie board, fleet status (the carrier and every pilot\'s service record), the hangar and a campaign log. The Fleet station\'s Upgrades subtab spends credits and parts on wingman hull, fire rate and gunnery, and on HALCYON\'s hull, bay turnaround and reserve pilots; purchases are saved. Next: let the wing\'s record matter, with pilots sitting out an op after being shot down.'},
    {t:'Command bridge',d:'Press B in an arena fight with HALCYON on station to step onto its bridge: the battle slows, the mouse is free, and a tactical map marks every ship. Order the whole wing or one wingman, click a hostile to send them at it or a friendly capital to guard it, and in fleet battles focus HALCYON\'s and SOLACE\'s broadsides on a capital or one of its subsystems and have them hold, close in or fall back. Two new campaign ops lean on it: Ambush Lane (escort HALCYON through two lance frigates) and Spearhead (strike the cruiser GORGON with your wing). Next: tune both from play.'},
    {t:'Fleet formations',d:'Two wingmen with 1-6 orders (form up, attack my target, free engage, cover me, defend HALCYON, strike capital) fly in the arena, take damage and can be shot down, and pick their own targets in free engage. Campaign missions choose a wing or solo flight. The command bridge gives each wingman its own order.'},
    {t:'Fleet battles',d:'Broadside, the new campaign op after Heart of the Throne, puts HALCYON and the destroyer SOLACE in a line trading broadsides with MAW and VESPER. Shoot out each enemy capital\'s shield generator (lets the fleet\'s guns bite and exposes the reactor), engines (stops it closing on HALCYON) and bridge (wrecks its aim). HALCYON and SOLACE take broadside orders from the command bridge. Next: fighter escorts launched from enemy capitals, and a fleet battle option in free arena.'},
    {t:'Capital ships',d:'The cruiser MAW or the lance frigate VESPER warps into free arena runs; knock out its weapons to drop the reactor shield, then destroy the reactor. The carrier HALCYON launches your wingmen, replaces lost ones and shoots down nearby enemy fighters and missiles with its own point-defence turrets. Arena runs with HALCYON on station open with a short launch out of its bay (click or Enter skips it). Capital ship events (Settings, on Sometimes by default) can also bring a hostile capital or HALCYON into other campaign arena ops. Two campaign missions fight MAW. Hold Halcyon is a campaign defence op against the frigate. Heart of the Throne flies you inside the dreadnought THRONE, down its enclosed reactor trench past plasma vents, to torpedo the core, then back out again in a timed escape as the ship collapses around you.'},
    {t:'Controls screen',d:'Bindings are grouped into flight, weapons, wingman orders and view sections with just the key and a short action; as cards of key caps and short actions; hover or click a row for its tip.'},
    {t:'Enemy squadrons',d:'Arena squadrons (lead plus two wingmen) fly in formation and break to dogfight when engaged. Enemies sometimes target your wingmen. Next: squadron types and formation-aware targeting.'},
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
    {t:'Arena combat',d:'Deep-space arena, solid obstacles, dogfight AI, flares and a chase-view nose lean.'},
    {t:'Menus, hangar and fullscreen',d:'3D backdrop per mode, revolving hangar hull, free modes unlocked by the campaign. The sortie board and flight school use the hangar layout: a title row per entry, hover previews the details and a click locks the choice in, with Start mission and Start lesson buttons beside Back.'},
    {t:'Core game',d:'Five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety.'},
  ]},
];
