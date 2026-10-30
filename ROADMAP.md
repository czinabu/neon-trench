# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list; keep the two in step.

## Now

Depth and feel before more systems.

- **Campaign tuning.** One full run from the first sortie to the Kiru Gate: fix pacing, difficulty spikes and anything that breaks. Includes the open tuning passes: trench routes (`FORK_*`, `PAD_*`), `DIFFICULTY`, where promotions fall, `SECTOR_CARRY` repairs and the fleet prices in `js/data/dock.js`.
- **Game feel.** Stronger hit feedback, camera shake, and sound and music that follow the situation.
- **Upgrade shop and unlocks.** Merge ship and fleet upgrades into one shop, then add unlockable ships and cosmetics for your character.

## Next

- **Story moments.** A few short cutscenes and crew conversations aboard the walkable HALCYON, plus more Kestrel encounters in the earlier acts.
- **Replayability.** Procedural missions after the campaign or a sector run, new objective types (escort, strike, interceptor, time trial) and an endless survival mode.
- **Gamepad and performance.** Gamepad support, a performance pass, and key rebinding in Settings.
- **Gameplay tests.** Extend `npm test` with win and lose checks for each mission.

## Later

Not scheduled; keep in mind when designing nearer work: more named characters, secondary weapon loadouts,
power routing and shield facing, new enemy classes, trench variants and asteroid field, boss fights,
mission modifiers, photo mode and accessibility options, cloud saves.

## Done

Shipped; details in `CHANGELOG.md`, and on hover in the in-game tab.

- **Campaign:** story (four acts, 17 ops), ranks, Admiral finale at the Kiru Gate, difficulty, sector map, fleet management.
- **HALCYON and command:** walkable HALCYON with character locker, command hub flow, command center, command bridge, fleet formations, squadron command.
- **Combat and fleets:** fleet battles with roles and the enemy admiral, capital ships, enemy squadrons, trench routes and set pieces, obstacle avoidance, arena combat, larger arena, capital ship design pass, ship damage feedback.
- **Modes and menus:** Free Play, Skirmish, saves, controls screen, flight school, menus, hangar and fullscreen, the core game.
- **Flight, HUD and audio:** cockpit and chase HUD, battle HUD tidy, decoupled flight and cruise control, targeting and missile mode, visibility pass, sound passes, hit sounds (kill ping, near-miss whistle) and the cinematic score.
