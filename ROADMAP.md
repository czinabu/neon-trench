# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list, titles only with the detail on hover or click; keep the two in step.

## In progress

- **Campaign ranks.** Flight Officer (solo), Lieutenant (wingmen, 1-6 orders), Commander (command bridge, fleet battles). Next: tune where promotions fall.
- **Command center.** HALCYON hub: sortie board, fleet status, hangar, campaign log, Upgrades. Next: pilots shot down sit out the next op.
- **Command bridge.** B with HALCYON on station: a slowed tactical view over the fight (orbit, pan, zoom) to order the wing, the squadrons, HALCYON and SOLACE; V swaps to the command room's holo-globe. Click an enemy turret to send a unit or the broadsides at it; Strike capital goes for the guns first. Select YOU to put your own ship on autopilot. Click open space to send HALCYON or SOLACE to a waypoint, pull a damaged ship back, or hold SOLACE in a formation; Q and E step through the squadrons. Runs Ambush Lane, Spearhead, Falling Back and Wings of the Fleet (the last two are built around the movement, squadron and formation orders). The holo-globe keeps a faint grid and shows turret and order labels only for the selected, marked or hovered unit. Next: tune both.
- **Fleet formations.** Two wingmen with 1-6 orders, per-wingman orders from the bridge.
- **Squadron command.** From the bridge, launch TALON and WRAITH from HALCYON's hangar (two fighters each) and order three squadrons separately, each under its own leader. Commander rank. Next: more squadron types.
- **Fleet battles.** Broadside: knock out MAW and VESPER subsystems while the fleets trade fire. Next: enemy fighter escorts, free-arena option.
- **Capital ships.** MAW and VESPER in arena runs; HALCYON launches the wing; Shipbreaker, Dark Approach, Hold Halcyon, Heart of the Throne.
- **Saves.** Title screen Saves: New game (confirm) plus three manual save slots to save, load or delete. Progress still autosaves.
- **Controls screen.** Grouped key cards; data in `js/data/controls.js`.
- **Enemy squadrons.** Formation flying and dogfight breaks. Next: squadron types, formation-aware targeting.

## Next

- **Campaign arcs and radio chatter.** Group ops into acts with a title card; timed handler and wingman lines per mission.
- **New objective types.** Escort, strike targets, interceptor and a time trial on the existing trench and arena.
- **Survival mode.** Endless arena waves with a best-wave record.
- **Key rebinding.** In Settings, saved with the other settings.
- **Gameplay tests.** Extend `npm test` with win and lose checks for each mission.

## Later

Not scheduled; keep in mind when designing nearer work.

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

- Capital ship design pass
- Ship damage feedback
- Sound pass, sound pass 2 and cinematic score
- Flight school
- Cockpit and chase HUD rework, battle HUD tidy
- Decoupled flight and cruise control (T)
- Targeting, missile mode, flight model and camera toggles
- Visibility pass
- Larger arena (combat zone radius 620 to 1000, more rocks, wider spawns)
- Arena combat
- Menus, hangar and fullscreen
- Core game: five-op campaign, trench and arena modes, three hulls, six upgrade tracks
