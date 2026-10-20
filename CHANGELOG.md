# Changelog

## 0.26.1: Key moves

- Targeting moves from T to R, and the flight model (arcade / realistic) moves from R to T, a reach
  away from the roll and movement keys so it isn't switched by accident. M no longer switches it.

## 0.26.0: Visibility, targeting and roadmap

- Enemy visibility: every hostile carries a small warm beacon that stays the same size on screen
  at any range (red fighters, amber missile boats and bombers, gold aces). Hostile pips are red
  and brighter. The arena sky has fewer, cooler stars and a dimmer nebula, and the speed dust is
  fainter there.
- The arena edge no longer lights up as a whole wireframe sphere: a soft grid fades in only around
  the point you are flying toward.
- Targeting (T): selects the hostile nearest the crosshair; press again to cycle. The target gets a
  box with its name, range, closing speed and hull, an edge arrow when off screen, the lead ring
  and gun assist, and the only missile lock. Camera view moves to Alt.
- Enemy missiles: a missile boat must hold a lock tone on you for 1.5 s before it can launch, at
  most two enemy missiles fly at once, and missile boats fire less often. Flares now have time to
  answer every launch.
- The trench has space above it: the nebula, stars, sun and ringed planet from the arena hang over
  the walls.
- Roadmap is a tab on the title screen. New planned items: fleet formations, capital-class command
  ships (turrets, interiors with crews, a command center to direct the battle) and a flight school.

## 0.25.0: Menus, hangar and fullscreen

- New title screen: the modes run down the left over a live 3D backdrop that changes with the
  highlighted mode (your squadron over the planet for Campaign, a run down the trench, a dogfight
  in open space, the hangar bay), with an info panel for each mode. Arrow keys move the selection.
- Hangar: pick a hull on the left and it revolves on a turntable on the right, with its role,
  description, stat bars (workshop upgrades shown in amber) and an Unlock or Equip button.
- Free Trench and Free Dogfight unlock once every campaign op is cleared.
- The game goes fullscreen on the first click, and again when a run starts or resumes; toggle it
  from the title or pause screen (the choice is saved). In Chrome and Edge, Esc opens and closes the
  pause menu without leaving fullscreen (hold Esc to leave). Firefox and Safari still leave
  fullscreen on Esc; the run pauses and resuming goes back to fullscreen.
## 0.25.0: Arena combat and flight feel

- Chase view: the ship's nose leans toward the mouse and banks into turns; guns fire from the
  leaning hull.
- Flares (G) on every ship to decoy enemy homing missiles: Razorline 4 charges, Viper-9 3 with a
  fast recharge, Bulwark 6. An enemy-lock warning and tone sound before a missile boat fires.
- The arena is now deep space: nebula sky, real stars, a sun, a ringed gas giant, an asteroid
  field, the derelict station and a wrecked cruiser. The neon grid, towers and cage rings are gone.
- Arena obstacles are solid: ramming one bounces you off and costs hull by impact speed; bolts
  and missiles stop on them; enemies steer round them.
- Arena enemy pilots dogfight instead of jousting: two press the attack at a time while the rest
  circle; they swing for your flank instead of head-on passes, match your speed when you chase
  them, and break across your view when you line them up. Enemies leave a contrail, the ship
  you're fighting gets a bigger bracket, and a light gun assist pulls bolts to the lead point.

## 0.24.3: roadmap

- Added `ROADMAP.md`: future ideas grouped by area (story, missions, maps, mechanics, ships,
  modes, polish, tooling) and rough priority.

## 0.24.2: npm run dev

- `npm run dev` serves the game on `http://localhost:5173/` and reloads the page when a file
  changes. It needs no `npm install`; `npm start` does the same.

## 0.24.1: README

- README opens with how to play (download or clone, open index.html, optional GitHub Pages link)
  and describes the current modes, ships, upgrades, enemies, settings and controls.

## 0.24.0: UI and UX pass

- Title screen rebuilt around a big Campaign button that names your next op, with free modes,
  Hangar, Controls and Settings below and a line showing ops cleared, credits, parts and hull.
- New Controls screen (from the title or pause) with every key and short tips, replacing the
  wall of text on the title screen.
- Bigger, higher-contrast text across the menus and HUD.
- Sortie board cards are numbered and show cleared / next / locked, best score, bonuses and
  payout, with the next op highlighted.
- Briefing shows the hull you're flying with a Change hull button that comes back to the briefing.
  Debrief shows score, kills, time, best combo and hull, and calls out a new best.
- First-flight training on your first Reactor Run walks through the controls; Enter skips it.
- Esc goes back and Enter picks the main option on every menu; screens fade in.

## 0.23.0: audio pass

- A limiter on the master output, so stacked explosions squash instead of clipping.
- Shared reverb: shots, blasts and missiles ring out; the music gets a touch of it too.
- Sounds with a source are panned left/right by where it is relative to the camera and fade with
  distance: kills, missile hits, flak, enemy missile launches.
- New sounds: hostile gunfire (fighters, turrets, bombers), a whoosh when a ship or a missile you
  shook off passes close by, and a separate shield-hit zap so you can hear shields from hull.

## 0.22.0: workshop upgrades

- Credits now buy upgrades in a new Upgrades tab in the hangar: laser damage, fire rate, armour,
  shield recharge, boost recharge and missile capacity. Upgrades apply to every hull, on top of
  its own stats, and are saved with your progress (older saves load with no upgrades).

## 0.21.0: enemy variety

- Enemy ships come in classes (js/data/enemies.js), each with its own model and flying style:
  line fighters, darts (fast, fragile, two-round bursts), hunters (missile boats that hold
  standoff range) and aces (black-and-gold elites that break hard when you line them up and fire
  three-round bursts).
- Hunters and the squadron leader fire homing missiles. A missile tone and warning sound while
  one is tracking you; break hard, boost away, or shoot it down for points.
- Ace Duel is now a fight against named aces, ending with squadron leader KESTREL: a shielded,
  crimson ace that arrives once 14 hostiles are down. Aces get callouts when they arrive and fall.
- Clear the Screen and Hold the Line mix in darts and hunters; the trench adds them past the
  first third.
- Fixed open-space enemies flying tail-first.

## 0.20.0: cockpit interiors

- Each hull has its own first-person cockpit (js/cockpit.js). Razorline is a fighter: canopy bow,
  three-screen dash and HUD combiner glass. Viper-9 is an interceptor: frameless bubble canopy,
  narrow tub, one wide display and a side stick. Bulwark is a gunship: armoured frame, overhead
  switch panel, four screens with a live radar sweep, hazard-striped glareshield and twin throttles.
- Displays, switch panels and caution lights are drawn on the instruments; indicator lights blink.
- The exterior fuselage is hidden in first person so it no longer pokes through the dash.

## 0.19.0: ship models

- All three player hulls are rebuilt: lofted fuselages, swept wing planforms, engine nacelles with
  intakes and nozzles, canopy glass, panel-line textures, metallic paint with reflections, nav
  lights and strobes. Razorline, Viper-9 and Bulwark now each have a distinct silhouette and paint.
- Engine glow lights sit behind the ship so they light the trench without washing out the hull in
  chase view; engine plumes are slimmer and a deeper blue.
- Hangar thumbnails frame each ship whole at a front three-quarter angle.

## 0.18.0: visual pass

- Trench walls and floor get procedural textures: panel seams plus rows of dimly lit windows and
  deck guide lights, so the trench has depth and speed reads off the walls.
- Explosions add a swelling fireball that cools from white-hot to the blast colour; destroyed
  ships throw tumbling hull debris.
- Dust motes stream past the camera in both sectors for a sense of speed.
- Chase camera now eases its offset from the ship instead of its world position, which had left it
  trailing about 30 m behind at full speed so the ship shrank to a speck. It drops back slightly
  with speed instead.
- Engine flames stretch into plumes along the thrust axis instead of swelling into balls.
- Lit wall panels toned down so they no longer bloom into white blocks.

## 0.17.0: combat readability

- Enemies out of view within about 1.1 km get an arrow on the screen edge pointing at them
  (magenta for fighters, amber for bombers), fading with range.
- Enemy fire and mines now flash a red arc around the reticle on the side the hit came from.
- The progress rail in the arena reads Engaged / Zone clear (or Hold / Evac ready on survival
  missions) instead of the trench's labels.

## 0.16.0: settings screen

- New Settings screen, reachable from the main menu and the pause screen: mouse sensitivity, invert Y,
  music and effects volume (now on separate audio buses), field of view, camera shake on/off, and
  graphics quality (high, medium, or low with bloom off). Saved in `neonTrench.settings`.
- Esc backs out of Settings before it pauses or resumes.

## 0.15.1: stutter, leak and collision fixes

- Fixed hitches when pickups drop or missiles launch: their glow now borrows from a fixed pool of
  lights, so three.js no longer recompiles every lit material each time the light count changes.
- Fixed GPU memory growing for the whole session: spawned enemies, hazards and missiles share one
  geometry per shape, and explosions, smoke and engine trail reuse pooled meshes.
- Beams, enemy bolts, mines and pickups are now hit-tested along the path covered each frame, so
  fast flight or a low frame rate can no longer skip through them.
- Fixed mines and pickups in the arena vanishing whenever they were behind the ship in world Z.
- If the browser refuses to capture the mouse (it does briefly after Esc), the run now holds with a
  "Click to take control" prompt instead of carrying on with no steering.

## 0.15.0: project restructure

- Split the single-file 0.15 build into `index.html`, `css/style.css` and `js/` files by area.
  Gameplay is unchanged: a seeded, frame-stepped replay of the trench and the arena produces
  identical HUD readouts frame for frame against the original file.
- Split the 700-line per-frame `update()` into ordered stages under `js/update/`.
- Moved the ship roster and mission roster into `js/data/`.
- Bundled Three.js r128 locally in `vendor/`, so the game runs offline and no longer depends on CDNs.
- Moved versions 0.1 to 0.15 into `archive/`.
- Added a headless smoke test (`npm test`), `CLAUDE.md`, and an updated README.

## 0.1 to 0.15

Single-file builds, kept in `archive/`.
