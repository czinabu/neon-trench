"use strict";
/* The in-game Roadmap tab (title screen). ROADMAP.md has the longer notes behind each item; keep the
   two in step when adding, reordering or shipping something.
     p   priority: 'Planned' (committed next big features), 'Next', 'Later' or 'Someday'
     t   title    d  one or two sentences */
const ROADMAP=[
  {area:'Fleet command',note:'The next big direction: from lone pilot to commander.',items:[
    {p:'Planned',t:'Fleet formations',d:'Lead a squadron of AI fighters. Assign wingmen to specific enemies or objectives, and call them back into formation. Two wingmen with 1/2/3 orders are in the arena; assigning targets per wingman is next.'},
    {p:'Planned',t:'Capital-class command ships',d:'Friendly and enemy capital ships: slow to turn, heavy guns built to fight other capital ships or hold an objective, '+
      'and destroyable automatic turrets (not too strong) that shoot fighters that come close.'},
    {p:'Planned',t:'Capital ship interiors and command center',d:'Walk the ship among NPC support crews. From the command center the captain assigns fighters '+
      'to squadrons or one by one and sets attack and defend objectives, directing the whole battle.'},
    {p:'Planned',t:'Flight school: course',d:'Flight school now teaches every control. Next: an obstacle course of rings and slaloms, moving targets and pass grades.'},
  ]},
  {area:'Story',items:[
    {p:'Next',t:'Campaign arcs',d:'Group the ops into acts with a title card and short intro between them.'},
    {p:'Next',t:'Radio chatter',d:'Timed lines from a wingman or handler during a mission.'},
    {p:'Next',t:'Named characters',d:'A handler, a wingman and Kestrel as a recurring rival, with portrait cards.'},
    {p:'Later',t:'Branching outcomes',d:'Bonus objectives change which op comes next.'},
    {p:'Later',t:'Act II',d:'The syndicate strikes back: escort, base defence and a capital ship assault.'},
    {p:'Later',t:'Kestrel rematches',d:'Kestrel escapes and returns with new tricks, ending in a final duel.'},
    {p:'Someday',t:'Cutscenes',d:'In-engine fly-bys before missions and after the big moments.'},
  ]},
  {area:'Missions',items:[
    {p:'Next',t:'Escort',d:'Keep a convoy ship alive to its jump point.'},
    {p:'Next',t:'Strike targets',d:'Destroy comm arrays and fuel tanks along the trench.'},
    {p:'Next',t:'Interceptor',d:'Stop bombers before they reach their target.'},
    {p:'Next',t:'Time trial',d:'Fly the trench through every roll gate under par time.'},
    {p:'Later',t:'Pursuit and recon',d:'Chase down a courier; scan marked targets under fire.'},
    {p:'Later',t:'Boss fights',d:'Capital ships and trench guardians with subsystems to knock out in order.'},
    {p:'Later',t:'Daily op',d:'A seeded random mission each day with its own best score.'},
    {p:'Someday',t:'Mission editor',d:'Build and share ops as text.'},
  ]},
  {area:'Sectors',items:[
    {p:'Next',t:'Trench variants',d:'A narrow maintenance trench, an ice-blue cryo trench, a collapsing trench.'},
    {p:'Later',t:'Asteroid field',d:'A dense, drifting rock field to weave through.'},
    {p:'Later',t:'Capital ship surface',d:'A run over a huge hull with turrets and a bridge to hit.'},
    {p:'Later',t:'Planet canyon and station interior',d:'Atmospheric canyon flight; tight tunnels to a reactor core.'},
    {p:'Someday',t:'Linked sectors',d:'Open space into a trench and back out with no loading break.'},
  ]},
  {area:'Gameplay',items:[
    {p:'Next',t:'Wingmen',d:'One or two AI allies with simple orders. The first step toward fleet formations.'},
    {p:'Next',t:'Secondary weapons',d:'Pick missiles, rockets, an ion burst or mines before a mission.'},
    {p:'Next',t:'Power routing',d:'Shift power between lasers, shields and engines.'},
    {p:'Later',t:'Shield facing and subsystem damage',d:'Front and rear shields; heavy hits knock systems out for a moment.'},
    {p:'Later',t:'New enemy classes',d:'A shielded gunship, a stealth fighter, a carrier and drone swarms.'},
    {p:'Later',t:'Difficulty and modifiers',d:'Easy to ace, plus optional handicaps for extra credits.'},
    {p:'Someday',t:'Hyperspace jumps',d:'A jump between sectors with a debris dodge on arrival.'},
  ]},
  {area:'Ships and progression',items:[
    {p:'Next',t:'More hulls',d:'A torpedo bomber, a stealth hull and a late-game prototype.'},
    {p:'Next',t:'Cosmetics',d:'Paint, engine trails and cockpit trim.'},
    {p:'Later',t:'Per-hull upgrades, ranks and challenges',d:'Mod slots per ship, pilot ranks and medals, and one-off goals that pay parts.'},
    {p:'Someday',t:'New Game+',d:'Replay the campaign harder and keep your hangar.'},
  ]},
  {area:'Modes and polish',items:[
    {p:'Next',t:'Survival',d:'Endless arena waves with a best-wave record.'},
    {p:'Next',t:'Key rebinding and end cinematics',d:'Rebind keys in Settings; the reactor going up behind you.'},
    {p:'Later',t:'Training range',d:'A sandbox with target drones, building on flight school.'},
    {p:'Later',t:'Music, photo mode and accessibility',d:'Themes per act, a free camera on pause, colour-blind HUD and subtitles.'},
    {p:'Someday',t:'Co-op, gamepad and replays',d:'Two pilots, flight stick support, and recorded runs.'},
  ]},
];
