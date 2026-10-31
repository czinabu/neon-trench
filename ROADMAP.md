# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list; keep the two in step.

## Now

Depth and feel before more systems.

- **Campaign tuning.** One full run from the first sortie to the Kiru Gate: fix pacing, difficulty spikes and anything that breaks. Includes the open tuning passes: trench routes (`FORK_*`, `PAD_*`), `DIFFICULTY`, where promotions fall, `SECTOR_CARRY` repairs and the fleet prices in `js/data/dock.js`.
- **Game feel.** Stronger hit feedback, camera shake, and sound and music that follow the situation.
- **Upgrade shop and unlocks.** Hull paints are in (a Paint tab in the hangar: buy four with credits, earn two by clearing Ace Duel and Sovereign; `js/data/paints.js`). A fourth hull is in: STILETTO, a dogfighter with forward-swept wings, a V-tail, its own cockpit and the tightest turn in the fleet, unlocked for 7 parts once Ace Duel is cleared (`js/data/ships.js`). Next: merge ship and fleet upgrades into one shop.

## Next

- **Story moments.** Crew aboard the walkable HALCYON now have something new to say after key ops (13 story beats from Pike, Lark, Vale, Reyes, Chief Oda and Hale, said once each, data in `DECK_BEATS`, `js/data/deck.js`). Next: a few short cutscenes, and more Kestrel encounters in the earlier acts.
- **Replayability.** Survival is in Free Play: endless arena waves, ten kills a wave, tougher and more crowded each wave with aces from wave four, and your best wave is the record (`SURVIVAL` in `js/config.js`). Contracts are in Free Play too: a board of three procedural ops dealt from a six-letter code (sweeps, holds, capital strikes, ace hunts, carrier defence, trench and interior runs, fleet actions), each with a threat level, two bonuses and a payout in credits and parts; a repeat pays half, and typing a code flies someone else's board (`CONTRACTS` in `js/data/contracts.js`). Next: playtest contract pay and threat, and new objective types (escort, interceptor, time trial).
- **Gamepad and performance.** Gamepad flight is in: sticks, triggers and buttons for steering, throttle, fire, boost, flares, missiles, roll, view and pause, with a rumble on hits (`js/gamepad.js`, listed on the Controls screen). Pad support now covers the menus, the pause screen, Settings, the command bridge and walking HALCYON's deck (`js/padui.js`). Settings has gamepad sensitivity, invert Y and rumble, and key rebinding for flight keys, including mouse buttons and the wheel (`js/keybinds.js`), on a two-column Settings screen; the Controls screen shows your rebound keys. The performance pass has started: trench and interior segments are merged into a few meshes each, which cuts the trench from about 700 draw calls a frame to about 200, and phones and tablets now start at medium graphics. Next: more performance work, and a real-controller playtest of the new menu, deck and bridge controls.
- **Gameplay tests.** Extend `npm test` with win and lose checks for each mission.

## Later

Not scheduled; keep in mind when designing nearer work: more named characters, secondary weapon loadouts,
power routing and shield facing, new enemy classes, trench variants and asteroid field, boss fights,
mission modifiers, photo mode and accessibility options, cloud saves (a server; for now Export and Import save move a save by hand).

## Done

Shipped; details in `CHANGELOG.md`, and on hover in the in-game tab.

- **Campaign:** story (four acts, 17 ops), ranks, Admiral finale at the Kiru Gate, difficulty, sector map, fleet management.
- **HALCYON and command:** walkable HALCYON with character locker, command hub flow, command center, command bridge, fleet formations, squadron command.
- **Combat and fleets:** fleet battles with roles and the enemy admiral, capital ships, enemy squadrons, trench routes and set pieces, obstacle avoidance, arena combat, larger arena, capital ship design pass, ship damage feedback.
- **Modes and menus:** Free Play, Skirmish, saves (with save code export and import), controls screen, flight school, menus, hangar and fullscreen, the core game.
- **Flight, HUD and audio:** cockpit and chase HUD, battle HUD tidy, decoupled flight and cruise control, targeting and missile mode, visibility pass, sound passes, hit sounds (kill ping, near-miss whistle) and the cinematic score.
