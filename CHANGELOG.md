# Changelog

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
