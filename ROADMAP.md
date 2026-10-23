# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list; keep the two in step.

## In progress

- **Command center.** The Campaign button opens a hub aboard the carrier HALCYON with four stations: the sortie board (next op and campaign progress), fleet status (HALCYON and the four pilots it carries, with sorties flown and times shot down, written at every debrief), the hangar, and a campaign log of best scores and bonuses. Next op jumps to the next uncleared op's briefing, and debriefs return here. The Fleet station's Upgrades subtab spends campaign rewards on six upgrades: wingman hull, fire rate and gunnery (credits), and HALCYON's hull, bay turnaround and reserve pilots (parts). Purchases are saved and apply in every arena op. Next: give the wing's record weight, such as a pilot shot down sitting out the following op.
- **Fleet formations.** Two wingmen with 1/2/3 orders (form up, attack my target, free engage) fly in the arena. They take damage and can be shot down (health shown under the order readout, with a callout when one goes), and each picks its own target in free engage. Campaign missions choose whether you fly with a wing or solo. Still to come: wingman objectives.
- **Capital ships.** An enemy capital warps into free arena runs a few kills in: the cruiser MAW (six gun turrets) or the lance frigate VESPER (four flak turrets and a spinal lance that charges, then fires down its bore). Knock out its weapons to drop the reactor shield, then destroy the reactor to break the ship in two; the zone isn't clear until it's down. The friendly carrier HALCYON launches your wingmen from its bay and sends replacements for lost ones while its reserve lasts. Any arena run with HALCYON on station, including the fleet battle, opens with a short launch: you sit in the bay with the wing either side, catapult out of the mouth, and take control once clear (untouchable until then; click or Enter skips it). Capital ship events reach the other campaign arena ops too: with the Capital ship events setting on Sometimes (the default) or Always, an arena op that doesn't name a capital can bring in a hostile MAW or VESPER, or just HALCYON on station; set it to Off to turn them away. Two campaign missions fight MAW: Shipbreaker (with wingmen) and Dark Approach (solo). Hold Halcyon is a campaign defence op: destroy the frigate while keeping the carrier afloat. Heart of the Throne flies you inside the dreadnought THRONE, MAW's kilometres-long flagship: in through a hull breach and down its enclosed reactor trench (solid ceiling, plasma vents that fire across it on a cycle) to torpedo the core. The core blowing starts an escape run: turn around and fly back out to the breach inside a 55 second clock while girders and pillars collapse into the trench and fires rage along the walls.
- **Fleet battles.** Broadside, the campaign op after Heart of the Throne, is a set-piece fight: HALCYON and the destroyer SOLACE hold a line while MAW and VESPER warp in across from them, and the two lines trade broadsides (heavy shells you don't want to fly through). Enemy shields soak most of the fleet's fire, so the player takes out each enemy capital's subsystems: the shield generator (drops the reactor shield and lets the broadsides bite), the engines (stops it closing on HALCYON and stops VESPER swinging its lance, which goes for HALCYON when you're not close) and the bridge (turrets fire slower and broadsides miss). An enemy capital goes when its reactor is destroyed or its hull runs out; lose HALCYON and the op fails. Next: fighter escorts launched from enemy capitals, and a fleet battle option in free arena.
- **Enemy squadrons.** Arena squadrons (lead plus two wingmen) fly in formation and break to dogfight when engaged. Enemy fighters sometimes turn on a wingman instead of you. Next: squadron types and formation-aware targeting.

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

- Capital ship design pass: HALCYON, SOLACE, MAW, VESPER and the hull round THRONE's breach rebuilt to the fighters' standard (faceted armoured hulls, window galleries, neon trim, detailed engines and turrets, HALCYON's angled deck and lit launch bay, VESPER's forked lance prow, layered plating and gun decks round the breach), with the same weak points and hit points
- Ship damage feedback: shield hits ripple across an energy bubble round the ship (flares when the shield collapses, flickers when low); hull hits leave scorch marks that spark, smoke and finally burn as hull drops, in chase and cockpit view
- Sound pass: a heroic menu anthem that starts on the first click (combat music keeps its intensity ramp), afterburner whoosh, mission-complete stinger, menu click sounds and a master volume slider alongside music and effects
- Sound pass 2: layered engine (sub rumble, turbine whine, intake noise), punchier blasters, missile launch and impact sounds, and music that switches theme for the trench, the arena, a capital fight and danger (low hull or incoming missiles), with tempo following intensity
- Flight school: a controls tour plus nine graded drills (ring run, slalom, strafing, throttle control, gunnery, moving targets, missile lock, evasion, and a check ride that chains gates into drones) with A/B/C grades, in an academy range
- Cockpit and chase HUD rework
- Decoupled realistic flight: thrust adds velocity and the ship drifts while you rotate; X brakes. Cruise control moved to its own key (T) and works in either model
- Targeting (R), missile mode (middle click), flight model (V), camera toggle (Alt)
- Visibility pass: clearer enemies, trench sky, rebalanced missile
- Arena combat: deep space, solid obstacles, dogfight AI, flares, chase-view nose lean
- Menus, hangar and fullscreen; free modes unlocked by the campaign. The sortie board and flight school use the hangar layout: a title row per entry, hover previews the details and a click locks the choice in, with Start mission and Start lesson buttons beside Back
- Core game: five-op campaign, trench and arena modes, three hulls, six upgrade tracks, enemy variety
