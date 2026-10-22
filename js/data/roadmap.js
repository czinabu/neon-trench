"use strict";
/* The in-game Roadmap tab (title screen). ROADMAP.md is the same list; keep the two in step when
   something ships or moves. Groups run Done, In progress, Next, Later.
     name  group heading   note  optional line under it
     items [{t:title, d:one sentence}]; Later items have no d and render as one-liners. */
const ROADMAP=[
  {name:'In progress',key:'progress',note:'Being built right now.',items:[
    {t:'Fleet formations',d:'Two wingmen with 1/2/3 orders fly in the arena, take damage and can be shot down, and pick their own targets in free engage. Campaign missions choose a wing or solo flight. Next: wingman objectives.'},
    {t:'Capital ships',d:'The cruiser MAW or the lance frigate VESPER warps into free arena runs; knock out its weapons to drop the reactor shield, then destroy the reactor. The carrier HALCYON launches your wingmen and replaces lost ones. Two campaign missions fight MAW. Hold Halcyon is a campaign defence op against the frigate. Heart of the Throne flies you inside the dreadnought THRONE, down its enclosed reactor trench past plasma vents, to torpedo the core. Next: fighter escorts and an escape run.'},
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
    {t:'Command center hub between ops'},{t:'Named characters and Kestrel rematches'},
    {t:'Secondary weapon loadouts'},{t:'Power routing and shield facing'},{t:'New enemy classes'},
    {t:'More hulls and cosmetics'},{t:'Trench variants and asteroid field'},{t:'Boss fights'},
    {t:'Difficulty settings and mission modifiers'},{t:'Photo mode and accessibility options'},{t:'Gamepad support'},
  ]},
  {name:'Done',key:'done',note:'Shipped; details in CHANGELOG.md.',items:[
    {t:'Sound pass',d:'A quiet menu theme that starts on the first click, an afterburner whoosh, a mission-complete stinger, menu click sounds and a master volume slider next to music and effects.'},
    {t:'Flight school',d:'A controls tour plus nine graded drills (rings, slalom, strafing, throttle, gunnery, moving targets, missile lock, evasion, and a final check ride) in an academy range.'},
    {t:'Cockpit and chase HUD rework',d:'Thin line-work gauges that move with the ship and sit on the glass.'},
    {t:'Targeting and missile mode',d:'Target lock on R, missile mode on middle click, flight model on V, camera on Alt.'},
    {t:'Visibility pass',d:'Clearer enemies, trench sky and a rebalanced missile.'},
    {t:'Arena combat',d:'Deep-space arena, solid obstacles, dogfight AI, flares and a chase-view nose lean.'},
    {t:'Menus, hangar and fullscreen',d:'3D backdrop per mode, revolving hangar hull, free modes unlocked by the campaign. The sortie board and flight school use the hangar layout: a title row per entry, details in a panel on hover or click.'},
    {t:'Core game',d:'Five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety.'},
  ]},
];
