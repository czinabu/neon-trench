# Changelog

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
