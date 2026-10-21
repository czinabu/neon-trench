# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list; keep the two in step.

## In progress

- **Fleet formations.** Two wingmen with 1/2/3 orders (form up, attack my target, free engage) fly in the arena. Still to come: per-wingman targets and objectives, and wingmen that can take damage.
- **Enemy squadrons.** Arena squadrons (lead plus two wingmen) fly in formation and break to dogfight when engaged. Next: squadron types and formation-aware targeting.

## Next

- **Campaign arcs and radio chatter.** Group ops into acts with a title card; timed handler and wingman lines per mission.
- **New objective types.** Escort, strike targets, interceptor and a time trial on the existing trench and arena.
- **Flight school: evasion and a check ride.** A flares and missile-evasion drill (needs harmless training missiles) and a graded exam that chains the drills.
- **Survival mode.** Endless arena waves with a best-wave record.
- **Key rebinding.** In Settings, saved with the other settings.
- **Gameplay tests.** Extend `npm test` with win and lose checks for each mission.

## Later

Not scheduled; keep in mind when designing nearer work.

- Capital-class command ships
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

- Flight school: a controls tour plus seven graded drills (ring run, slalom, strafing, throttle control, gunnery, moving targets, missile lock) with A/B/C grades, in an academy range
- Cockpit and chase HUD rework
- Targeting (R), missile mode (middle click), flight model (V), camera toggle (Alt)
- Visibility pass: clearer enemies, trench sky, rebalanced missile
- Arena combat: deep space, solid obstacles, dogfight AI, flares, chase-view nose lean
- Menus, hangar and fullscreen; free modes unlocked by the campaign
- Core game: five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety
