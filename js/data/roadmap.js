"use strict";
/* The in-game Roadmap tab (title screen). ROADMAP.md is the same list; keep the two in step when
   something ships or moves. Groups run Done, In progress, Next, Later.
     name  group heading   note  optional line under it
     items [{t:title, d:one sentence}]; Later items have no d and render as one-liners. */
const ROADMAP=[
  {name:'In progress',key:'progress',note:'Being built right now.',items:[
    {t:'Fleet formations',d:'Lead a squadron of AI fighters: assign wingmen to targets or objectives and call them back into formation.'},
    {t:'Flight school: more course',d:'Slaloms, moving targets and pass grades, on top of the ring course.'},
  ]},
  {name:'Next',key:'next',note:'Small to medium, builds on what exists.',items:[
    {t:'Wingmen orders',d:'Simple number-key orders (attack my target, cover me, form up) on top of fleet formations.'},
    {t:'Campaign arcs and radio chatter',d:'Group ops into acts with a title card, plus timed handler and wingman lines during a mission.'},
    {t:'New objective types',d:'Escort, strike targets, interceptor and a time trial, all on the existing trench and arena.'},
    {t:'Survival mode',d:'Endless arena waves with a best-wave record.'},
    {t:'Key rebinding',d:'Rebind controls in Settings, saved with the other settings.'},
    {t:'Gameplay tests',d:'Extend npm test with win and lose checks for each mission.'},
  ]},
  {name:'Later',key:'later',note:'Ideas, not scheduled.',items:[
    {t:'Capital-class command ships'},{t:'Capital ship interiors and command center'},{t:'Named characters and Kestrel rematches'},
    {t:'Secondary weapon loadouts'},{t:'Power routing and shield facing'},{t:'New enemy classes'},
    {t:'More hulls and cosmetics'},{t:'Trench variants and asteroid field'},{t:'Boss fights'},
    {t:'Difficulty settings and mission modifiers'},{t:'Photo mode and accessibility options'},{t:'Gamepad support'},
  ]},
  {name:'Done',key:'done',note:'Shipped; details in CHANGELOG.md.',items:[
    {t:'Flight school',d:'Guided walkthrough of every control, a ring course and target drones.'},
    {t:'Cockpit and chase HUD rework',d:'Thin line-work gauges that move with the ship and sit on the glass.'},
    {t:'Targeting and missile mode',d:'Target lock on R, missile mode on middle click, flight model on V, camera on Alt.'},
    {t:'Visibility pass',d:'Clearer enemies, trench sky and a rebalanced missile.'},
    {t:'Arena combat',d:'Deep-space arena, solid obstacles, dogfight AI, flares and a chase-view nose lean.'},
    {t:'Menus, hangar and fullscreen',d:'3D backdrop per mode, revolving hangar hull, free modes unlocked by the campaign.'},
    {t:'Core game',d:'Five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety.'},
  ]},
];
