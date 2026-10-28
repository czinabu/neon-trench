# Roadmap

Where Neon Trench goes next. Kept short on purpose: only the near term gets detail. The title screen's
**Roadmap** tab (`js/data/roadmap.js`) shows the same list, titles only with the detail on hover or click; keep the two in step.

## In progress

- **Trench routes and set pieces.** The trench is no longer one straight corridor. Now and then a solid divider forks it: the main lane keeps the usual crossbars, and a narrow side channel is riskier (tight pillars and a squeeze) but faster (boost pads) and hides a stash (pickups and two caches to shoot). The director also lays set pieces: a run of pipes to thread under and hop over, a blast door that slams shut as you close on it and reopens, and girders that tear loose from the ceiling and drop across the trench. Every ship in the trench (fighters, bombers) is steered round the crossbars, dividers and doors and stopped by them, and roll gates are only passable through the slot; homing missiles burst on them and a divider stops shots. Tuning in `FORK_*` and `PAD_*` (`js/config.js`) and the top of `js/setpieces.js`; navigation in `js/trenchnav.js`. Next: playtest and tune, wingmen in the trench.
- **Campaign story.** Four acts (Cold Start, The Wing, The Line, The Kiru Gate) across 17 ops, ending with the sovereign fleet's flagship and a last duel with Kestrel. A first-visit intro on who you are and why HALCYON matters, briefings and debriefs voiced by Captain Vale, CIC Reyes, Pike, Lark and Kestrel, timed radio chatter in each op plus reactive lines (low hull, wingman down, capital kill), and a new rank line and quarters at each promotion. Text only; data in `js/data/story.js`. Next: more Kestrel encounters through the earlier acts.
- **Difficulty.** Easy, Normal and Hard in Settings (Skirmish starts at your setting and can still change it). The early campaign ops are gentler on every level and ease up to full strength by Act II: enemy fighters turn slower, shoot less often and fire slower bolts, take fewer hits, break off less, hold longer straight runs and juke less in the trench, and fewer press you at once in the arena. Fighters also fly with more momentum: turns build up and ease off, hard turns bleed speed, and trench fighters point their noses into a sideways drift. Hard goes past the old tuning in later acts. Next: playtest and tune the numbers in `DIFFICULTY` (`js/config.js`).
- **Campaign ranks.** Flight Officer (solo), Lieutenant (wingmen, 1-6 orders), Commander (command bridge, fleet battles), Admiral (the combined fleet). Commander tools unlock one per op: the bridge and holo-globe in Broadside, squadrons in Ambush Lane, autopilot in Spearhead, fleet movement in Falling Back, SOLACE formations in Wings of the Fleet; Admiral adds battle groups and ship roles in The Kiru Gate and the reserve in Breaking the Gate. Each op's briefing and a bonus objective teach its tool. Next: tune where promotions fall.
- **Admiral finale.** Act IV, three ops at the Kiru Gate where you command the whole fleet: HALCYON, SOLACE and the Rim destroyer BASTION, each its own battle group. The Kiru Gate breaks the picket with fleet-wide orders; Breaking the Gate puts a jump gate behind the enemy line that sends a fresh capital through every 35 seconds until you shoot out its three anchors, with the reserve destroyer MERIDIAN to call in wherever you click; Sovereign is the last battle against the gold-trimmed flagship SOVEREIGN and Kestrel. Free Trench and Free Dogfight still open after Act III. This is the first step toward a fleet strategy mode. Next: tune the finale's difficulty.
- **Sector map.** Opens once Broadside is cleared: the road from Broadside to Sovereign as a map of systems. Before each fleet battle, strike one of two side targets or skip them (the other slips away once you pick): a supply depot repairs the fleet, a shipyard leaves the next enemy line with 20% less hull, a fighter base halves the next op's fighters, a salvage field pays parts. Fleet damage carries forward: HALCYON, SOLACE, BASTION and MERIDIAN start the next battle with the hull they ended on plus field repairs, and a sunk destroyer comes back patched at 40%. Only the front-line op carries damage; replays fly at full strength. Tuning in `SECTOR_CARRY` (`js/config.js`), targets in `js/data/sector.js`. Next: playtest and tune the repair numbers.
- **Command center.** HALCYON hub framed as the carrier's command deck: station cards (keys 1-5, the sector map among them once it opens), a pulsing Next op button naming the op, and a sortie panel with a campaign progress track and objective and fact chips. Your quarters change with each rank: a bunkroom rack and porthole, an officer's cabin, a commander's cabin with a holo-desk, then the admiral's flag cabin and fleet plot, with the hub's accent colour to match; the new room is revealed when you acknowledge a promotion. Sortie board, fleet status, hangar, campaign log, Upgrades. Briefings are now short: two voiced lines, one situation line, objective and bonus chips, and "NEW" tip cards that expand on click, with the full text under Full briefing. Next: pilots shot down sit out the next op.
- **Command bridge.** B with HALCYON on station: a slowed tactical view over the fight (orbit, pan, zoom) to order the wing, the squadrons, HALCYON and SOLACE; V swaps to the command room's holo-globe. Click an enemy turret to send a unit or the broadsides at it; Strike capital goes for the guns first. Select YOU to put your own ship on autopilot. Click open space to send HALCYON or SOLACE to a waypoint, pull a damaged ship back, or hold SOLACE in a formation; Q and E step through the squadrons. In Admiral ops a FLEET row at the top orders every capital at once and calls in the reserve. Runs Ambush Lane, Spearhead, Falling Back and Wings of the Fleet (the last two are built around the movement, squadron and formation orders). The holo-globe keeps a faint grid and shows turret and order labels only for the selected, marked or hovered unit. Strike runs (wingmen and your autopilot) stay on one capital and break off the hull cleanly between passes, and HALCYON and SOLACE steer round hulls and rocks on the way to a waypoint. Next: tune both.
- **Fleet formations.** Two wingmen with 1-6 orders, per-wingman orders from the bridge.
- **Squadron command.** From the bridge, launch TALON and WRAITH from HALCYON's hangar (two fighters each) and order three squadrons separately, each under its own leader. Unlocked in Ambush Lane. Next: more squadron types.
- **Fleet battles.** Broadside: knock out MAW and VESPER subsystems while the fleets trade fire. The Admiral ops add allied destroyers, a reserve and the Kiru Gate. Capital ships, both sides, now have roles: Line holds and trades broadsides, Screen keeps between its ward and the enemy and catches shells meant for it, Artillery stands off with heavy, slower broadsides. The FLEET row puts the destroyers in a formation off HALCYON with a real effect (line abreast lands more hits, a column takes fewer, a screen covers HALCYON). In Act IV an enemy admiral aboard the flagship reads your orders: it covers the ship you mass on, punishes a lone push, presses after a withdrawal and hunts an uncovered HALCYON, until you shoot out its bridge. Capital ships steer round asteroids, the derelict station and the wreck. The first time each mechanic comes up in a fight (subsystems, focus fire, the bridge, battle groups, roles, formations, screens, enemy artillery, the admiral, the reserve, the Kiru Gate), a short tip card explains it, once per pilot. Next: enemy fighter escorts.
- **Skirmish.** A title-screen mode, hidden until Broadside (the first fleet battle) is cleared so fleet battles stay a surprise: set up a fleet battle against the AI and fight it. Put SOLACE, BASTION and MERIDIAN in the line, in reserve or leave them home, each with a role; build the enemy line ship by ship (cruiser or frigate, with a role); switch the enemy admiral and the Kiru Gate on or off; pick fighter cover and difficulty. Every fleet tool is open, nothing is paid or saved, and the result screen offers a rematch. Next: playtest and tune, more enemy ship types.
- **Capital ships.** MAW and VESPER in arena runs; HALCYON launches the wing; Shipbreaker, Dark Approach, Hold Halcyon, Heart of the Throne.
- **Saves.** Title screen Saves: New game (confirm) plus three manual save slots to save, load or delete. Progress still autosaves.
- **Controls screen.** Grouped key cards; data in `js/data/controls.js`.
- **Enemy squadrons.** Formation flying and dogfight breaks. Next: squadron types, formation-aware targeting.

## Next

- **Fleet management.** Between battles, repair, refit and recruit capital ships, with captains who gain experience. Builds on the sector map's carried damage.
- **New objective types.** Escort, strike targets, interceptor and a time trial on the existing trench and arena.
- **Survival mode.** Endless arena waves with a best-wave record.
- **Key rebinding.** In Settings, saved with the other settings.
- **Gameplay tests.** Extend `npm test` with win and lose checks for each mission.

## Later

Not scheduled; keep in mind when designing nearer work.

- More named characters
- Secondary weapon loadouts
- Power routing and shield facing
- New enemy classes
- More hulls and cosmetics
- Trench variants and asteroid field
- Boss fights
- Mission modifiers
- Photo mode and accessibility options
- Gamepad support

## Done

Details in `CHANGELOG.md`.

- Capital ship design pass
- Ship damage feedback
- Sound pass, sound pass 2 and cinematic score
- Flight school: a practice range on the title screen, and the campaign's first step (a short controls tour and ring run for new pilots, skippable)
- Cockpit and chase HUD rework, battle HUD tidy
- Decoupled flight and cruise control (T)
- Targeting, missile mode, flight model and camera toggles
- Visibility pass
- Larger arena (combat zone radius 620 to 1000, more rocks, wider spawns)
- Arena combat
- Obstacle avoidance: every AI ship (fighters, bombers, squadrons, wingmen, your autopilot) looks ahead and steers round asteroids and the derelict station
- Menus, hangar and fullscreen
- Core game: five-op campaign, trench and arena modes, three hulls, six upgrade tracks
