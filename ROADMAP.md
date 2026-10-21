# Roadmap

Ideas for where Neon Trench goes next. This is a living list: add to it, reorder it, and strike
items out (or move them to `CHANGELOG.md`) as they ship.

**Priority**

- **Next**: small to medium, builds directly on what exists, good next pick.
- **Later**: bigger, or depends on something in *Next*.
- **Someday**: large or speculative; worth keeping in mind when designing the nearer items.

Work already under way (third-person aim drift, countermeasures, arena obstacle collision, a
space-looking arena, the dogfight feel pass, the menu and hangar redesign, fullscreen, and locking
the free modes behind the campaign) is not listed here.

The title screen's **Roadmap** tab shows a short version of this list from `js/data/roadmap.js`.
Keep the two in step.

## Fleet command (planned)

The next big direction: the player goes from lone pilot to commander. These build on each other,
and on *Wingmen* under Gameplay mechanics.

| Priority | Idea |
|---|---|
| In progress (v1 shipped: two wingmen with 1/2/3 orders in the arena) | **Fleet formations.** Lead a squadron of AI fighters. Assign each wingman (or the whole flight) to a specific enemy or an objective, and call them back into formation. Needs a small order wheel or number-key menu and a friendly version of the arena pilot AI in `js/update/enemies.js`. |
| Planned | **Capital-class command ships, friendly and enemy.** Much less manoeuvrable than fighters but with stronger firepower, built to fight other capital ships or defend objectives. Destroyable automatic turrets (not too powerful) engage enemy fighters that come within close range. Turrets and main guns are subsystems that can be knocked out. |
| Planned | **Capital ship interiors and the command center.** Walkable interiors with NPC support crews. From the command center the captain assigns fighters to squadrons or individually and sets attack and defend objectives strategically, directing the battle. |
| Done (v1) | **Flight school.** Shipped as a guided control walkthrough with a ring course and target drones (title screen button). Still to come: slaloms and tighter courses, moving targets and a pass grade per stage. |

## Story mode

Today the campaign is five standalone ops (`js/data/missions.js`) with three-line briefings. The
fiction is already there: the player against a syndicate that runs the Helios-Kiru grid, and
Kestrel squadron's aces.

| Priority | Idea |
|---|---|
| Next | **Campaign arcs.** Group missions into acts (Act I is today's five ops) with an act title card and a short text intro between acts. A field on each mission (`act:1`) and a small screen in `menus.js` is enough. |
| Next | **In-mission radio chatter.** Timed or triggered lines from a wingman or handler shown under the HUD ("Hunters inbound, break left!"). A `radio:[{t:12,who:'OPS',line:'...'}]` list per mission, driven from the update loop. Reuses the ace callout plumbing. |
| Next | **Named characters.** A handler, a wingman and Kestrel as a recurring rival, each with a portrait card (procedural, like the ships) on briefings and debriefs. |
| Later | **Branching outcomes.** Bonus objectives or a pass/fail on a key op change which mission comes next or which act ending you get. Needs `req` to accept "cleared with bonus X" as well as "cleared". |
| Later | **Act II: the syndicate strikes back.** New sectors (see *Maps*) and missions where the player defends rather than raids: escort, base defence, a capital ship assault. |
| Later | **Kestrel rematches.** Kestrel escapes at low hull in Ace Duel and returns with new tricks in later acts, ending in a final duel. |
| Someday | **Fully voiced or scripted cutscenes** using the in-engine ships and camera (fly-bys before a mission, the reactor going up after Reactor Run). |

## New missions

Every mission is either a trench run (`sector:'trench'`) or an arena fight (`sector:'arena'`)
with a kill count, a survival timer or the reactor torpedo as its win condition. New objective
types open up a lot of missions without new maps.

| Priority | Idea |
|---|---|
| Next | **Escort.** Keep a convoy ship (with its own hull bar) alive to a jump point. Hold the Line's evac convoy made real. |
| Next | **Strike targets.** Destroy N ground or station targets (comm arrays, fuel tanks) along the trench before the intake. Turrets already exist as a base. |
| Next | **Interceptor.** Bombers fly a set path toward a target; stop them before they arrive. Bombers exist; this adds a lose condition. |
| Next | **Time trial.** Fly the trench through every roll gate under a par time, no enemies. Good for practice and for chasing best scores. |
| Later | **Pursuit.** Chase a fleeing courier through the trench and down it before it reaches the exit. |
| Later | **Recon.** Fly within scanning range of marked targets and hold steady for a few seconds each, under fire, without destroying them. |
| Later | **Boss fights.** A capital ship or a trench-guardian with destructible subsystems (shield generators, turrets, engines) that must be taken out in order. |
| Later | **Daily op.** A seeded random mission (sector, objective, roster and modifiers picked from a daily seed) with its own best-score line. Needs a seeded random number generator in place of `Math.random()`. |
| Someday | **Mission editor.** An in-game screen that writes a mission entry (sector, objective, roster, bonuses) and saves it locally, so players can build and share ops as text. |

## Maps and sectors

Two sectors exist: the neon trench and the open-space arena.

| Priority | Idea |
|---|---|
| Next | **Trench variants.** Re-skin and re-tune the existing trench generator: a narrow maintenance trench with tighter gaps, an ice-blue cryo trench, a collapsing trench where wall segments fall in. Mostly palette and `config.js` values per mission. |
| Later | **Asteroid field.** An arena variant with a dense, drifting rock field to weave through, building on arena obstacle collision. |
| Later | **Capital ship surface.** A run over a huge ship's hull with turrets, superstructure and a bridge to hit, like a wide, shallow trench. |
| Later | **Planetary canyon.** Atmospheric flight down a canyon on a planet's surface, with fog, sky and ground fire. Uses trench logic with a sky instead of walls overhead. |
| Later | **Space station interior.** Tight tunnels and chambers, slower and closer than the trench, ending in a reactor core. |
| Someday | **Linked sectors.** A mission that starts in open space, dives into a trench, and exits back into the arena, without a loading break. |

## Gameplay mechanics

| Priority | Idea |
|---|---|
| Next | **Wingmen.** One or two AI allies who fly with you, take some heat, and can be given simple orders (attack my target, cover me, form up) on number keys. |
| Next | **Secondary weapon choice.** Pick a loadout before a mission: missiles, a spread of dumbfire rockets, a short-range ion burst that disables shields, or proximity mines. |
| Next | **Power routing.** Shift power between lasers, shields and engines (a classic flight-sim mechanic) with three keys and a small cockpit gauge. |
| Later | **Shield facing.** Shields split front and back so where you take fire matters, and you can push power to one side. |
| Later | **Subsystem damage.** Heavy hits can knock out a system for a few seconds (sensors flicker, a cannon jams, boost fails) instead of only draining hull. |
| Later | **New enemy classes.** A shielded gunship that must be flanked, a stealth fighter that only shows on radar when firing, a carrier that launches fighters until destroyed, and interceptor drones that swarm. Add to `js/data/enemies.js`. |
| Later | **Difficulty settings.** Easy / normal / hard / ace, scaling enemy accuracy, damage and missile frequency, with a payout bonus on harder settings. |
| Later | **Mission modifiers.** Optional handicaps for extra credits: no shields, lasers only, double enemies, one-hit hull. |
| Someday | **Hyperspace jumps.** A scripted jump between sectors as a transition, with a short dodge-the-debris sequence on arrival. |

## Ships and progression

Three hulls and six upgrade tracks, all bought with credits and parts.

| Priority | Idea |
|---|---|
| Next | **More hulls.** A heavy bomber that carries torpedoes for strike missions, a stealth hull with low radar signature (made for Silent Run style ops), and a late-game prototype unlocked by beating the campaign. |
| Next | **Cosmetics.** Paint schemes, engine trail colours and cockpit trim, bought with credits once upgrades are maxed. Gives credits a long-term use. |
| Later | **Per-hull upgrades.** Mod slots specific to each ship (Viper-9 afterburner, Bulwark flak cannon) on top of the shared workshop upgrades. |
| Later | **Pilot ranks and medals.** Rank up from career stats (kills, ops cleared, flawless runs); medals for feats like downing Kestrel without taking damage. Shown on the title screen line. |
| Later | **Challenges.** A list of one-off goals ("down 3 hunters with lasers only") that pay parts. |
| Someday | **New Game+.** Replay the campaign with tougher enemies and keep your hangar. |

## Modes

| Priority | Idea |
|---|---|
| Next | **Survival.** Endless arena waves that get harder, with a wave counter and best-wave record. |
| Later | **Score attack.** A fixed trench layout with a global best per op, for chasing combos and roll gates. |
| Later | **Training range.** A safe sandbox with target drones and toggles for each mechanic, building on the tutorial. |
| Someday | **Local split-screen or online co-op.** Two pilots in the same arena. A big change to input, camera and rendering; only worth it once single-player is deep. |
| Someday | **Gamepad and flight stick support** via the browser Gamepad API, with remappable bindings. |

## Presentation and polish

| Priority | Idea |
|---|---|
| Next | **Mission end cinematics.** Reactor explosion seen from behind the ship as you pull out of the trench; Kestrel's ship spinning down. |
| Next | **Key rebinding** in Settings, saved with the other settings. |
| Later | **Adaptive music per act** with its own themes, plus a calmer menu track. |
| Later | **Photo mode.** Freeze the game during pause, free-fly the camera and hide the HUD. |
| Later | **Accessibility.** Colour-blind friendly HUD palette, subtitles for radio chatter, an option to hold-to-toggle boost and zoom. |
| Someday | **Replays.** Record inputs from a seeded run and play it back from any camera. Needs the same seeded random number generator as the daily op. |

## Tech and tooling

| Priority | Idea |
|---|---|
| Next | **Gameplay tests.** Extend `npm test` beyond the smoke click-through with checks for each mission's win and lose conditions. |
| Later | **Save export / import** as a text code, so progress can move between browsers. |
| Later | **Performance budget.** An on-screen frame-time graph (debug key) and a check in the smoke test that flags big frame-time regressions. |
