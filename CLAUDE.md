# Neon Trench: notes for AI assistants

Plain JavaScript + Three.js r128 (global `THREE`, bundled in `vendor/`). No build step, no modules.

## How the code is wired

- Every file in `js/` is a classic `<script>` sharing one global scope. Load order is the
  `<script>` list at the bottom of `index.html`. Code that runs at load time (not inside a function)
  can only use things defined in earlier files; code inside functions can use anything.
- Do not convert to ES modules or add a bundler. Modules stop the game from running by
  double-clicking `index.html`, which is how it is played.
- Each file starts with `"use strict";`. Top-level `const`/`let` names are global across files, so
  a new top-level name must not clash with an existing one.
- HTML elements with an `id` are used directly as globals (e.g. `warn`, `hudVel`, `msList`). Keep
  ids unique and do not declare a variable with the same name as an id you use.
- `S` in `js/state.js` is the whole run state. `startGame()` in `js/game.js` resets it; add new
  per-run fields to both places.
- `update(dt)` in `js/loop.js` calls the stages in `js/update/` in a fixed order and passes a shared
  `frame` object (`dt`, `arena`, `p` = ship position, plus values earlier stages write for later
  ones). Keep that order unless the change needs a different one.
- Data that's meant to be tuned lives in `js/config.js`, `js/data/ships.js` and `js/data/missions.js`.
- Saves use `localStorage` keys `neonTrench.prog`, `neonTrench.best`, `neonTrench.mute`. Changing a
  save's shape must still load old saves (see `loadProg()`'s merge).

## Before finishing a change

Run `npm test` (headless smoke test; needs `npm install` and `npx playwright install chromium`
once). Bump `version` in `package.json` and add a line to `CHANGELOG.md`.

`archive/` holds the old single-file builds for reference only. Do not edit them.
