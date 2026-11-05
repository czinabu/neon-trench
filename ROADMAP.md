# Roadmap

Where Neon Trench goes next. Kept short on purpose: one line on what it is, one on the next step.
Shipped work moves to Done. The title screen's **Roadmap** tab (`js/data/roadmap.js`) shows the same
list; keep the two in step.

## Now

Playtest and tune what just shipped.

- **Campaign tuning.** One full run from the first sortie to the Directorate: pacing, difficulty spikes, anything that breaks.
  *Next:* teach the playtest bot (`npm run playtest`) the long capital ops (Ace Duel, Shipbreaker, Dark Approach), then tune trench routes, promotions, repairs and fleet prices.
- **Act V in the Drift.** Five ops in the asteroid field, with exploding ore and rocks that block broadsides.
  *Next:* playtest the pacing, the rock density and the ore blast damage (`FIELD` in `js/config.js`).
- **Game feel.** Hit feedback, camera shake, and sound and music that follow the fight.
  *Next:* a cockpit framing pass; the dash fills about 40% of the view.
- **Debrief ranks.** S to C ranks graded on bonuses, hull, combo and time against par.
  *Next:* tune the rank thresholds and par times in a campaign run (`DEBRIEF`, an op's `par`).
- **Shop and STILETTO.** One upgrade shop for ship, wing, HALCYON and destroyer upgrades, plus the fourth hull.
  *Next:* playtest the shop prices and how STILETTO flies.
- **Walking HALCYON.** The deck shows battle damage, the fleet, crew bets and a walk out to your ship.
  *Next:* playtest the walk-out on a full campaign run and on a real phone.

## Next

Near-term, builds on what exists.

- **Onboarding trim.** The intro movie, prologue, hub tour and first flight are in.
  *Next:* watch a first-time player go through it and cut what they skip.
- **More story.** Crew beats, cutscenes and trench flybys are in.
  *Next:* more Kestrel encounters in the earlier acts; maybe a jamming enemy that cuts the neural link.
- **Contracts.** Procedural ops in Free Play, dealt from a shareable code.
  *Next:* playtest pay and threat, then add escort, interceptor and time trial objectives.
- **Phone controls.** Touch flight and deck walking are in.
  *Next:* real-phone playtest, strafe, a portrait layout and the command bridge by touch.
- **Gamepad and performance.** Pad covers flight, menus, the deck and the bridge; draw calls are down a lot.
  *Next:* a real-controller playtest and more performance work.
- **Co-op campaign.** Co-op works in Free Play for up to four pilots.
  *Next:* fly campaign ops in co-op.
- **Gameplay tests.** `npm test` covers menus and smoke checks.
  *Next:* win and lose checks for each mission.

## Later

Ideas, not scheduled: more named characters, secondary weapon loadouts, power routing and shield facing,
new enemy classes, trench variants, boss fights, mission modifiers, photo mode and accessibility options,
cloud saves (needs a server; Export and Import save cover it for now).

## Done

Shipped; details in `CHANGELOG.md`, and as drop-downs in the in-game tab.

- **Campaign:** story (five acts, 22 ops), Act V in the asteroid field, mission debrief with S to C ranks, upgrade shop, paints and STILETTO, onboarding, story moments and cutscenes, campaign ranks, Admiral finale at the Kiru Gate, difficulty, sector map, fleet management.
- **HALCYON and command:** walkable HALCYON with character locker, a living HALCYON (damage, ready room, crew bets, walk-out), command hub flow, command center, command bridge, fleet formations, squadron command.
- **Combat and fleets:** co-op squadrons and the order wheel, fleet battles with roles and the enemy admiral, capital ships, enemy squadrons, trench routes and set pieces, obstacle avoidance, arena combat, larger arena, capital ship design pass, ship damage feedback.
- **Modes and menus:** Free Play, Survival, Contracts, Skirmish, saves (with save code export and import), controls screen, flight school, menus, hangar and fullscreen, the core game.
- **Flight, HUD and audio:** gamepad, phone touch controls, performance pass, cockpit and chase HUD, live cockpit panels (radar, weapons, systems and caution lights on every hull), battle HUD tidy, a HUD corner that names where the run is, decoupled flight and cruise control, targeting and missile mode, visibility pass, sound passes, hit sounds (kill ping, near-miss whistle) and the cinematic score.
