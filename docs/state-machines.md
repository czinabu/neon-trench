# State machines in Neon Trench

Every piece of the game that is "in one of a few states and moves between them", where it lives, and
how explicit it is. Read this before adding a flag like `isSomething`: the state you need may already exist.

Four levels, from most to least explicit:

- **Machine**: built with `defineMachine()` (`js/machine.js`). Has a table of allowed moves; a move that is
  not in the table logs a `console.error` (which fails `npm test`) and is still made. Inspect any of them
  from the browser console: `MACHINES.run.state`, `MACHINES.run.log`.
- **Named state**: one field holding a string (`E.state='engage'`). Explicit enough; no table.
- **Derived**: a function that reads the state off timers or flags, so it cannot disagree with them.
- **Flags**: several booleans, timers or "is this object null" checks that together mean a state. These
  are the implicit ones. Each has a note on why it was left and what would make it worth converting.

## Machines

### Run mode: `S.mode` (`RUN_MODE` in `js/state.js`)

Where the game is between the menus and a sortie. `S.mode` reads and assigns like a plain field; the
assignment goes through the table.

```
            startGame                 pauseGame
   menu ───────────────► play ◄──────────────────► paused
    ▲                    │  ▲        resumeGame        │
    │   toMenu, open*()  │  │ retry / restart          │ toMenu, restart
    ├────────────────────┤  │                          │
    │                    ▼  │                          │
    │              win / dead                          │
    └──────────────────────────────────────────────────┘
```

| State | Means | May move to |
|---|---|---|
| `menu` | any screen outside a sortie: title, deck, briefing, hangar | `menu`, `play` |
| `play` | a sortie is running, `update()` ticks | `play` (restart), `paused`, `win`, `dead`, `menu` |
| `paused` | pause screen over a frozen sortie | `play`, `menu` |
| `win` / `dead` | sortie over, end screen or debrief up | `play` (retry), `menu` |

Sub-states of `play`, still flags on `S` because they are orthogonal to each other:
`S.awaitLock` (held until the mouse is captured again), `S.bridge` (command bridge open, battle slowed),
`S.admiral` (co-op host at the holo table, no ship), `S.auto` (autopilot flying).

## Derived

| What | Function | States | Read from |
|---|---|---|---|
| Flight phase | `flightPhase()` in `js/update/launch.js` | `launch`, `dive`, `free` | `S.launchT`, `S.diveT` |
| Gamepad context | `padCtx()` in `js/padui.js` | `play`, `bridge`, `ui`, `walk`, `none` | `S.mode`, `S.bridge`, visible screen, deck |
| Co-op role | `netHost()`, `netGuest()`, `netOnline()` in `js/net.js` | offline, host, guest | `NET.role` |
| What draws the frame | the `renderCut \|\| renderDeck \|\| renderStage \|\| renderHolo \|\| renderFrame` chain in `js/loop.js` | cutscene, deck, menu backdrop, holo room, flight | `CUT`, `deckOn()`, `S.mode`, `S.bridge` |

## Named states (already explicit)

| What | Field | States | File |
|---|---|---|---|
| Fighter AI | `E.state` | `engage`, `break`, `extend` | `js/update/enemies.js` |
| Capital ship | `C.state` | `fight`, `dying`, `wreck` | `js/capital.js`, `js/update/capital.js` |
| Capital lance | `L.phase` | `idle`, `charge`, `fire` | `js/update/capital.js` |
| Squadron order | `S.order.state` | `live`, `shown`, `done`, `lapsed` | `js/orders.js` |
| Fleet call | `S.call.state` | live, answered, `lapsed` | `js/fleetcalls.js` |
| Deck sequence | `DK.seq.kind` | `board`, `aboard`, `land` (or no sequence) | `js/deck.js`, `js/decklife.js`, `js/deckcoop.js` |
| Bridge view | `bdgView` | `live`, `holo` | `js/bridge.js` |
| Title page | `menuPage` | `main`, `free` | `js/menus.js` |
| Wing order | `S.wingOrder` | `form`, `target`, `free`, `cover`, `defend`, `strike` | `js/wingmen.js` |

## Flags (implicit, left as they are)

| What | Held in | States it really has | Why it was left |
|---|---|---|---|
| Visible screen | the `hidden` class on each id in `SCR` (`js/menus.js`) | one of 20 screens, or none | The DOM is the state, and five places scan it (`menuKey`, `padUiScope`, `deckOn`, `cutStart`, `cutEnd`). Best next candidate: a `curScreen()` plus one machine would replace those scans. Left until the UI restyle has landed, since it rewrites this code. |
| Where Back goes | `hangarFrom`, `briefFrom`, `controlsFrom`, `settingsFrom`, `savesFrom`, `schoolFrom`, `ctFrom` | a one-deep "came from" per screen | Seven variables doing the job of one back stack. Convert together with the visible screen. |
| Cutscene | `CUT` null or the playing scene (`js/cutscene.js`) | none, playing; remembers the screens to bring back | One object, two states. Clear enough. |
| Debrief | `DBT` (tally counting), `OUTRO` (scene playing behind it) in `js/debrief.js` | counting, done; backdrop on or off | Two independent on/off pairs. |
| Trench objective | `S.lock`, `S.locked`, `S.fired`, `torpedo`, `S.escape` (`js/update/objective.js`, `js/interior.js`) | approach, acquiring, locked, torpedo away, escape, won | A straight line with no branches back; all in one function. |
| Arena objective | `S.leaderSpawned/Down`, `S.capSpawned/Down`, `S.carrierLost` | each: waiting, out, down | Independent win conditions, checked together in `js/update/world.js`. |
| Training | `TUT` (first flight), `SCH` (lesson), `ACADEMY` (course index), `CO` (deck tour) | off or step N | Each is already "null or a step counter". |
| Co-op session | `NET.role`, `NET.status`, `COOP.live`, `DK.muster` | offline, joining, lobby, muster, in battle | Spread over four fields in three files. Worth a machine if the lobby grows; its screens are in the UI restyle's path today. |
| Boost | `S.boost`, `S.boostLock`, `S.boostE` | ready, burning, locked out | Three lines in `js/update/flight.js`. |
| Missile lock | `S.mslMode`, `S.lockTarget`, `S.lockT` | lasers, seeking, locked | Timer driven, one stage owns it. |
