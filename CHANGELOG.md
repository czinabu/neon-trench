# Changelog

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
