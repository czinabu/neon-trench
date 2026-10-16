# NEON TRENCH // RUN

A cyberpunk trench-run flight game in plain JavaScript and Three.js. Procedural meshes, synthesized
audio, a diegetic cockpit HUD, a five-mission campaign and three unlockable ships. No build step and
no asset files.

## Play

Double-click `index.html`. It runs straight from disk in any modern desktop browser, with no install
and no internet connection needed (Three.js is bundled in `vendor/`).

To serve it locally instead (handy for testing on a phone on the same network): `npm start`.

## Controls

| Input | Action |
|---|---|
| Mouse | Steer |
| W / S | Throttle up / down (X cuts throttle) |
| A / D | Strafe left / right |
| Space / C | Climb / descend |
| Q / E | Roll (match roll gates for Overdrive) |
| Shift | Boost (limited energy, recharges) |
| Left click (hold) | Lasers |
| Right click (hold) | Zoom / aim |
| V | Missile (hold a target in your sights to lock) |
| F | Torpedo (once locked on the reactor intake) |
| T | Camera: cockpit / chase |
| R | Flight model: arcade / realistic |
| N | Mute |
| P / Esc | Pause |

Touch devices get on-screen buttons.

## Project layout

```
index.html              page markup: HUD, menus, screens; loads the scripts below in order
css/style.css           all styling
vendor/                 Three.js r128 + the bloom post-processing passes (don't edit)
js/
  config.js             core tuning: trench length/width, max speed, boost, missiles, pacing
  settings.js           player settings (sensitivity, volumes, FOV, shake, graphics quality), saved locally
  data/ships.js         ship roster: stats, prices and look of every hull
  data/missions.js      campaign missions: objectives, briefings, bonuses, rewards, unlock chain
  renderer.js           renderer, scene, camera, lights, bloom, shared materials
  ship.js               player ship meshes (exterior, cockpit) and hangar thumbnails
  trench.js             trench wall segments and the starfield
  enemies.js            beams, spawn director, roll gates, turrets, pickups, fighters, bombers, mines, reactor
  arena.js              open-space dogfight arena and its spawning
  effects.js            bolts, sparks, explosions, smoke, engine trail, missiles
  audio.js              engine drone, procedural music, sound effects
  state.js              the global game state `S`, best score, camera / flight-model toggles
  input.js              keyboard, mouse and touch
  progression.js        saved credits, parts, owned ships, mission clears
  menus.js              mission select, hangar, briefing, debrief, settings screens
  game.js               start / pause / end of a run, damage, kills, targeting
  loop.js               main loop; `update()` runs the stages below in order each frame
  update/
    flight.js           flight model, sector bounds, shield regen
    world.js            trench recycling, fog, enemy spawning, arena win check
    weapons.js          lasers, missile lock, missiles in flight
    enemies.js          turret, fighter and bomber AI, mines, pickups
    collisions.js       bolt hits, crossbeams, roll gates
    particles.js        sparks, explosions, smoke, trail, combo / hit-marker fade
    objective.js        reactor intake and torpedo run
    camera.js           cockpit / chase camera, shake, recoil
    aim.js              impact point, enemy pips, lead indicator, score popups
    audio.js            engine pitch and music intensity
    hud.js              HUD readouts, gauges, cockpit instruments
tests/smoke.mjs         headless click-through of every screen (`npm test`)
archive/                every earlier single-file version (0.1 to 0.15), for reference
```

The scripts are plain (non-module) files that share one global scope, loaded in the order listed in
`index.html`. That is what lets the game run by double-click. A new file just needs a
`<script src>` line in the right place.

## Common changes

- **Balance a ship**: edit its multipliers in `js/data/ships.js`.
- **Add or edit a mission**: add an entry to `MISSIONS` in `js/data/missions.js`. `req` sets which mission unlocks it.
- **Global feel** (speed, trench length, missile count): `js/config.js`.
- **Enemy behaviour**: spawning in `js/enemies.js` / `js/arena.js`, AI in `js/update/enemies.js`.
- **HUD or menus**: markup in `index.html`, styling in `css/style.css`, logic in `js/update/hud.js` / `js/menus.js`.

## Testing

```
npm install
npx playwright install chromium
npm test
```

The smoke test opens the game headless, flies a few seconds of the trench, the arena and a campaign
mission, opens every menu, and fails on any JavaScript error.

## License

See [LICENSE](LICENSE). Three.js is MIT-licensed; see [vendor/THREE-LICENSE](vendor/THREE-LICENSE).
