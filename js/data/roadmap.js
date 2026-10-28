"use strict";
/* The in-game Roadmap tab (title screen). ROADMAP.md is the same list; keep the two in step when
   something ships or moves. Groups run Done, In progress, Next, Later.
     name  group heading   note  optional line under it
     items [{t:title, d:one sentence}]; Later items have no d and render as one-liners. */
const ROADMAP=[
  {name:'In progress',key:'progress',note:'Being built right now.',items:[
    {t:'Campaign story',d:'Four acts across 17 ops, ending with the sovereign fleet\'s flagship and a last duel with Kestrel. A first-visit intro on who you are and why HALCYON matters, briefings and debriefs voiced by Captain Vale, CIC Reyes, Pike, Lark and Kestrel, radio chatter in each op (timed, plus low hull, wingman down and capital kill), and a new rank line and quarters at each promotion. Next: more Kestrel encounters through the earlier acts.'},
    {t:'Campaign ranks',d:'Four ranks, earned by clearing ops: Flight Officer (solo), Lieutenant (wingmen and 1-6 orders), Commander (command bridge and fleet battles), Admiral (the combined fleet). Commander tools unlock one per op: the bridge and holo-globe in Broadside, squadrons in Ambush Lane, autopilot in Spearhead, fleet movement in Falling Back and SOLACE formations in Wings of the Fleet; Admiral adds battle groups and ship roles in The Kiru Gate and the reserve in Breaking the Gate. Each is taught by its briefing and a bonus. Next: tune where promotions fall.'},
    {t:'Admiral finale',d:'Act IV, three ops at the Kiru Gate commanding the whole fleet: HALCYON, SOLACE and the Rim destroyer BASTION, each its own battle group. Break the picket with fleet-wide orders, shoot out the anchors of a jump gate that sends a fresh capital through every 35 seconds (with the reserve destroyer MERIDIAN to call in wherever you click), then fight the flagship SOVEREIGN and Kestrel. Free modes still open after Act III. A first step toward a fleet strategy mode. Next: tune the finale\'s difficulty.'},
    {t:'Command center',d:'The command deck aboard HALCYON: station cards (keys 1-4), a pulsing Next op button, and a sortie panel with a campaign progress track and objective chips. Sortie board, fleet status, hangar, campaign log and an Upgrades subtab. Briefings are short now: two voiced lines, a situation line, objective and bonus chips, and expandable NEW tip cards, with the full text under Full briefing. Next: pilots shot down sit out the following op.'},
    {t:'Command bridge',d:'Press B with HALCYON on station for a slowed tactical view over the fight (orbit, pan, zoom) where you order the wing, the squadrons, HALCYON and SOLACE, with V for the command room\'s holo-globe. Click an enemy turret to send a unit or the broadsides at it; Strike capital goes for the guns first. Select YOU to put your own ship on autopilot. Click open space to send HALCYON or SOLACE to a waypoint, pull a damaged ship back, or hold SOLACE in a formation; Q and E step through the squadrons. In Admiral ops a FLEET row orders every capital at once and calls in the reserve. Runs Ambush Lane, Spearhead, Falling Back and Wings of the Fleet (the last two are built around the movement, squadron and formation orders). The holo-globe keeps a faint grid and shows turret and order labels only for the selected, marked or hovered unit. Strike runs (wingmen and your autopilot) stay on one capital and break off the hull cleanly between passes, and HALCYON and SOLACE steer round hulls and rocks on the way to a waypoint. Next: tune both.'},
    {t:'Fleet formations',d:'Two wingmen take 1-6 orders, can be shot down, and pick their own targets. The command bridge orders each one separately.'},
    {t:'Squadron command',d:'From the bridge, launch TALON and WRAITH from HALCYON\'s hangar (two fighters each) and order three squadrons separately, each under its own leader. Unlocked in Ambush Lane. Next: more squadron types.'},
    {t:'Fleet battles',d:'Broadside: HALCYON and SOLACE trade broadsides with MAW and VESPER while you knock out their subsystems. The Admiral ops add allied destroyers, a reserve and the Kiru Gate. Capital ships on both sides have roles (Line, Screen that catches shells meant for its ward, Artillery that stands off), the FLEET row sets destroyer formations with real effects, and in Act IV an enemy admiral aboard the flagship reacts to your orders until you shoot out its bridge. Capital ships steer round asteroids and derelicts. Next: skirmish mode against the AI, and enemy fighter escorts.'},
    {t:'Capital ships',d:'MAW and VESPER warp into arena runs; HALCYON launches your wing. Also Shipbreaker, Dark Approach, Hold Halcyon and Heart of the Throne with its escape run.'},
    {t:'Saves',d:'Title screen Saves: start a New game after a confirm, or keep three manual save slots to save, load and delete. Progress still autosaves.'},
    {t:'Controls screen',d:'Key bindings grouped by section as cards; hover or click a row for its tip.'},
    {t:'Enemy squadrons',d:'Lead plus two wingmen fly in formation and break to dogfight. Next: squadron types and formation-aware targeting.'},
  ]},
  {name:'Next',key:'next',note:'Small to medium, builds on what exists.',items:[
    {t:'New objective types',d:'Escort, strike targets, interceptor and a time trial, all on the existing trench and arena.'},
    {t:'Survival mode',d:'Endless arena waves with a best-wave record.'},
    {t:'Key rebinding',d:'Rebind controls in Settings, saved with the other settings.'},
    {t:'Gameplay tests',d:'Extend npm test with win and lose checks for each mission.'},
  ]},
  {name:'Later',key:'later',note:'Ideas, not scheduled.',items:[
    {t:'Fleet strategy mode: a sector map of linked fights, built on the Admiral ops'},{t:'More named characters'},
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
