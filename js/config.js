"use strict";
/* Core tuning constants: trench size, speeds, missiles, pacing. */

const TRENCH_LEN = 22000;           // metres to the reactor intake (long run)
const HALF_W = 30;                  // trench half width
const FLOOR_Y = -22, TOP_Y = 26;    // flak ceiling above TOP_Y
const SEG_LEN = 150, SEG_POOL = 16;
const INTERIOR_LEN = 7000;          // metres down a capital ship's reactor trench (js/interior.js)
const INT_CEIL = TOP_Y + 4;         // its solid ceiling; the ship is held 5 m under it
const VENT_WARN = 1.6, VENT_ON = 2.2, VENT_CYCLE = 3, VENT_DMG = 16;   // plasma vents: quiet, flicker, burn (s), damage per touch
const ESCAPE_T = 55, ESC_GAP = 200;   // escape run out of a capital ship after the core blows: seconds on the clock, metres between collapses
const MAX_SPD = 190, BOOST_MULT = 1.8;
const ACCEL_ARC = 115, ACCEL_REAL = 68;   // flight-assist authority per model (cruise control uses ACCEL_REAL)
const ACCEL_DECOUPLED = 80;                // thrust acceleration (m/s²) in decoupled realistic flight
const MSL_MAX = 8, MSL_START = 6;
const ENEMY_MSL_CAP = 2;           // enemy homing missiles in flight at once
const ENEMY_LOCK_T = 1.5;           // seconds an enemy holds a lock tone on you before it can launch
const BEAM_GAP_MIN = 170;           // minimum metres between consecutive hazards (fairness)
const COMBO_WINDOW = 3.2;           // seconds to chain a kill before the multiplier decays
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LS_KEY = 'neonTrench.best';   // localStorage record key

/* capital ship events in campaign arena ops (setting capEvents): chance per run on 'sometimes'; chance the event brings a hostile capital rather than only the friendly carrier */
const CAP_EVENT_CHANCE = .4, CAP_EVENT_HOSTILE = .7;

/* command bridge (B, js/bridge.js): game speed while you're on HALCYON's tactical view; orbit camera limits (metres from
   the fight's centre, and how far the camera may tilt from overhead) */
const BRIDGE = {slow:.25, dist:[220,600], pitch:[.35,1.35]};
/* the command room (js/holoroom.js), the bridge's default view: the holo-globe's radius and height above the deck, how far
   the camera stands from it, how much of the fight it shows (times the bridge zoom, BRIDGE.dist), and how much of the
   bridge's tilt (BRIDGE.pitch) the camera takes */
const HOLO = {r:2.7, y:3.4, eye:7.6, range:1.4, tilt:.55, dist:[20,600]};   // dist: the zoom range on the globe
