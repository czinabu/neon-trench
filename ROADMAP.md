# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list; keep the two in step.

## In progress

- **Fleet formations.** Lead a squadron of AI fighters, assign wingmen to targets or objectives, call them back into formation. Needs an order menu and a friendly version of the arena pilot AI in `js/update/enemies.js`.
- **Flight school: more course.** Slaloms, moving targets and pass grades, on top of the ring course.

## Next

- **Wingmen orders.** Number-key orders (attack my target, cover me, form up) on top of fleet formations.
- **Campaign arcs and radio chatter.** Group ops into acts with a title card; timed handler and wingman lines per mission.
- **New objective types.** Escort, strike targets, interceptor and a time trial on the existing trench and arena.
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

- Flight school: guided walkthrough of every control, a ring course and target drones
- Cockpit and chase HUD rework
- Targeting (R), missile mode (middle click), flight model (V), camera toggle (Alt)
- Visibility pass: clearer enemies, trench sky, rebalanced missile
- Arena combat: deep space, solid obstacles, dogfight AI, flares, chase-view nose lean
- Menus, hangar and fullscreen; free modes unlocked by the campaign
- Core game: five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety
