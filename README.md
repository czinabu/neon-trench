# NEON TRENCH // RUN

A cyberpunk trench-run flight game in plain JavaScript and Three.js. Procedural meshes, synthesized
audio, a diegetic cockpit HUD, a five-mission campaign, three unlockable ships and an upgrade
workshop. No build step and no asset files.

## How to play

No install, no build, no internet connection needed. All you need is a modern desktop browser
(Chrome, Edge, Firefox or Safari).

1. **Get the game.** On the GitHub page click **Code → Download ZIP** and unzip it, or clone it:
   `git clone https://github.com/czinabu/neon-trench.git`
2. **Open `index.html`.** Double-click it and it opens in your browser. Three.js is bundled in
   `vendor/`, so it runs straight from disk.
3. **Click to take control** (the game captures the mouse), then pick **Campaign** on the title
   screen. Your first Reactor Run starts with a short training walkthrough; press Enter to skip it.

Progress (credits, parts, ships, upgrades, mission clears) and settings are saved in your browser,
so they stay on the computer and browser you played on.

### Play it from a link (optional)

To get a link you can open anywhere or share, turn on GitHub Pages: in the repository go to
**Settings → Pages**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, and
save. After a minute the game is live at `https://czinabu.github.io/neon-trench/`. (Pages on a
private repository needs a paid GitHub plan; on a public one it's free.)

### Run it on localhost (optional)

If you have [Node.js](https://nodejs.org) installed, you can play it from a local link instead:

```
git clone https://github.com/czinabu/neon-trench.git
cd neon-trench
npm run dev
```

Open the `http://localhost:5173/` link it prints. There's nothing to install first. The page
reloads by itself whenever you save a change to the game's files, which makes it the easiest way to
work on the game. Other devices on the same network can open it at your computer's IP address on the
same port, which is handy for testing on a phone. Ctrl+C stops it.

## The game

- **Campaign**: five missions unlocked in order, each with a briefing, optional bonus objectives
  and a payout of credits and parts.
  1. *Reactor Run*: fly the trench and put a torpedo in the reactor intake.
  2. *Clear the Screen*: open-space sweep, down 12 hostiles.
  3. *Hold the Line*: survive 90 seconds covering an evac convoy.
  4. *Silent Run*: a trench strike where boosting gives you away.
  5. *Ace Duel*: named aces, ending with squadron leader Kestrel.
- **Sector map**: from the campaign's first fleet battle on, strike one of two side targets before each
  fleet battle (repairs, a thinner enemy line, fewer fighters or parts), or skip them. Fleet damage carries
  from one battle to the next.
- **Free Trench** and **Free Dogfight**: quick runs in either sector outside the campaign, chasing a
  best score. They unlock once every campaign op is cleared.
- **Skirmish**: set up a fleet battle against the AI (your destroyers and their roles, the enemy line,
  the enemy admiral, the Kiru Gate, fighter cover, difficulty) and fight it. Appears once the campaign's first fleet battle is cleared.
- **Hangar**: spend parts on new hulls and credits on upgrades.
  - Ships: *Razorline* (balanced, free), *Viper-9* (fast interceptor, 3 parts), *Bulwark* (armoured
    quad-cannon gunship, 5 parts), *Stiletto* (forward-swept dogfighter, 7 parts once Ace Duel is cleared).
    Each has its own model and cockpit.
  - Upgrades (three levels each, apply to every hull): focused lasers, coolant loop (fire rate),
    ablative plating (armour), shield capacitor, boost injectors, extended missile rack.
- **Enemies**: line fighters, darts, missile-firing hunters, aces, bombers, turrets, mines and
  crossbeams in the trench.
- **Settings**: mouse sensitivity, invert Y, music and effects volume, field of view, camera shake
  and graphics quality (lower it if the game stutters).

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
| Middle click | Switch lasers / missiles. In missile mode, left click fires at the R target once locked |
| G | Flares: decoy incoming missiles (charges recharge) |
| F | Torpedo (once locked on the reactor intake) |
| R | Target the hostile nearest the crosshair (press again to cycle) |
| Alt | Camera: cockpit / chase |
| V | Flight model: arcade / realistic |
| N | Mute |
| P / Esc | Pause |
| Arrows / Enter / Esc | Move / pick / go back in menus |

The Controls screen (title screen or pause) lists these with tips. Touch devices get on-screen
buttons. The game goes fullscreen when you start playing; turn that off from the title or pause
screen. In Chrome and Edge, Esc pauses without leaving fullscreen (hold Esc to leave it).

**Tips:** match a roll gate's angle as you pass through for Overdrive (shields, a missile and
faster guns). Chain kills quickly to raise the combo multiplier. When a missile tone sounds, break
hard, boost away or shoot the missile down. Fly through wreck pickups for shields, missiles and score.

## Project layout

```
index.html              page markup: HUD, menus, screens; loads the scripts below in order
css/style.css           all styling
vendor/                 Three.js r128 + the bloom post-processing passes (don't edit)
js/
  config.js             core tuning: trench length/width, max speed, boost, missiles, pacing
  settings.js           player settings (sensitivity, volumes, FOV, shake, graphics quality), saved locally
  fullscreen.js         fullscreen on by default, the toggles, and keeping Esc for the pause menu
  data/ships.js         ship roster: stats, prices and look of every hull
  data/missions.js      campaign missions: objectives, briefings, bonuses, rewards, unlock chain
  data/sector.js        sector map: the route, side targets and what striking each one does
  renderer.js           renderer, scene, camera, lights, bloom, shared materials
  data/enemies.js       enemy classes: fighters, darts, hunters, aces
  data/upgrades.js      ship upgrades for the upgrade shop: effects and prices per level
  ship.js               player ship meshes and hangar thumbnails
  cockpit.js            per-hull first-person cockpit interiors
  trench.js             trench wall segments and the starfield
  interior.js           capital ship interior run: enclosed corridor, hull breach, plasma vents, reactor
  enemies.js            beams, spawn director, roll gates, turrets, pickups, fighters, bombers, mines, reactor
  arena.js              open-space dogfight arena and its spawning
  effects.js            bolts, sparks, explosions, smoke, engine trail, missiles
  audio.js              engine drone, procedural music, sound effects
  state.js              the global game state `S`, best score, camera / flight-model toggles
  input.js              keyboard, mouse and touch
  progression.js        saved credits, parts, owned ships, mission clears
  menus.js              title screen, mission select, hangar, briefing, debrief, settings screens
  sector.js             sector map screen and the fleet damage carried between battles
  shop.js               the hangar's upgrade shop: ship, wing, HALCYON and destroyer upgrades in one list
  tutorial.js           first-flight training prompts
  stage.js              3D backdrops behind the menus (one per title-screen mode) and the hangar turntable
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
tools/dev-server.mjs    local server with auto-reload (`npm run dev`)
tools/playtest.mjs      pilot bot that flies every campaign op, gives bridge and fleet orders, and prints win/loss, time and hull (`npm run playtest`)
archive/                every earlier single-file version (0.1 to 0.15), for reference
ROADMAP.md              ideas for future story, missions, maps and mechanics
```

The scripts are plain (non-module) files that share one global scope, loaded in the order listed in
`index.html`. That is what lets the game run by double-click. A new file just needs a
`<script src>` line in the right place.

## Common changes

- **Balance a ship**: edit its multipliers in `js/data/ships.js`.
- **Upgrade prices or effects**: `js/data/upgrades.js`.
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
