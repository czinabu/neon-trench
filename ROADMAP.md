# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list; keep the two in step.

## In progress

- **Fleet formations.** Two wingmen with 1/2/3 orders (form up, attack my target, free engage) fly in the arena. They take damage and can be shot down (health shown under the order readout, with a callout when one goes), and each picks its own target in free engage. Campaign missions choose whether you fly with a wing or solo. Still to come: wingman objectives.
- **Capital ships.** An enemy capital warps into free arena runs a few kills in: the cruiser MAW (six gun turrets) or the lance frigate VESPER (four flak turrets and a spinal lance that charges, then fires down its bore). Knock out its weapons to drop the reactor shield, then destroy the reactor to break the ship in two; the zone isn't clear until it's down. The friendly carrier HALCYON launches your wingmen from its bay and sends replacements for lost ones while its reserve lasts. Two campaign missions fight MAW: Shipbreaker (with wingmen) and Dark Approach (solo). Hold Halcyon is a campaign defence op: destroy the frigate while keeping the carrier afloat. Next: fighter escorts launched from enemy capitals.
- **Enemy squadrons.** Arena squadrons (lead plus two wingmen) fly in formation and break to dogfight when engaged. Enemy fighters sometimes turn on a wingman instead of you. Next: squadron types and formation-aware targeting.

## Next

- **Campaign arcs and radio chatter.** Group ops into acts with a title card; timed handler and wingman lines per mission.
- **New objective types.** Escort, strike targets, interceptor and a time trial on the existing trench and arena.
- **Survival mode.** Endless arena waves with a best-wave record.
- **Key rebinding.** In Settings, saved with the other settings.
- **Gameplay tests.** Extend `npm test` with win and lose checks for each mission.

## Later

Not scheduled; keep in mind when designing nearer work.

- Capital ship interiors and command center
- Named characters and Kestrel rematches
- Secondary weapon loadouts
- Power routing and shield facing
- New enemy classes
- More hulls and cosmetics
- Trench variants and asteroid field
- Boss fights
- Difficulty settings and mission modifiers
- Photo mode and accessibility options
- Gamepad support

## Done

Details in `CHANGELOG.md`.

- Sound pass: a quiet menu theme that starts on the first click (combat music keeps its intensity ramp), afterburner whoosh, mission-complete stinger, menu click sounds and a master volume slider alongside music and effects
- Flight school: a controls tour plus nine graded drills (ring run, slalom, strafing, throttle control, gunnery, moving targets, missile lock, evasion, and a check ride that chains gates into drones) with A/B/C grades, in an academy range
- Cockpit and chase HUD rework
- Targeting (R), missile mode (middle click), flight model (V), camera toggle (Alt)
- Visibility pass: clearer enemies, trench sky, rebalanced missile
- Arena combat: deep space, solid obstacles, dogfight AI, flares, chase-view nose lean
- Menus, hangar and fullscreen; free modes unlocked by the campaign
- Core game: five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety
