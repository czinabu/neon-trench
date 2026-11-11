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
- `S.mode` (`menu`, `play`, `paused`, `win`, `dead`) is a state machine: assigning it goes through the
  table in `js/state.js`, and a move the table does not list fails the smoke test. Every state machine in
  the game, explicit or still kept as flags, is listed in `docs/state-machines.md`; add new ones there,
  and use `defineMachine()` (`js/machine.js`) when a state has rules about what may follow it.
- `update(dt)` in `js/loop.js` calls the stages in `js/update/` in a fixed order and passes a shared
  `frame` object (`dt`, `arena`, `p` = ship position, plus values earlier stages write for later
  ones). Keep that order unless the change needs a different one.
- Data that's meant to be tuned lives in `js/config.js`, `js/data/ships.js` and `js/data/missions.js`.
- The UI look is a small design system in `css/theme.css` (tokens, type, frames, buttons, colour roles),
  loaded after `css/style.css`, which only lays screens out. Use its tokens and the `uiIco()` icons
  (`js/data/icons.js`) instead of new colours or Unicode symbols. Fonts are bundled in `vendor/fonts/`.
- Saves use `localStorage` keys `neonTrench.prog`, `neonTrench.best`, `neonTrench.mute`, `neonTrench.settings`. Changing a
  save's shape must still load old saves (see `loadProg()`'s merge).

## Before finishing a change

Run `npm test` (headless smoke test; needs `npm install` and `npx playwright install chromium`
once). If the change touches gameplay or features, update `ROADMAP.md` and the in-game roadmap
(`js/data/roadmap.js`) to match.

Do not bump `version` in `package.json` or add to `CHANGELOG.md` in a feature PR. Those are updated
once per release, only when the owner asks for one, with a single changelog entry covering everything
merged since the last release.

README screenshots live in `docs/screenshots/`; `node tools/screenshots.mjs` remakes them after a big visual change.

`archive/` holds the old single-file builds for reference only. Do not edit them.
