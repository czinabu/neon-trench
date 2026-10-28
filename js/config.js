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
const FORK_LEN = 420, FORK_DIV = [4, 12], FORK_GAP = 3200;   // trench forks (js/branch.js): length, divider x range (mirrored for a left channel), minimum metres between forks
const PAD_BOOST = 1.35, PAD_T = 2.6;   // a side-channel boost pad: speed multiplier, seconds it lasts
const BEAM_GAP_MIN = 170;           // minimum metres between consecutive hazards (fairness)
const COMBO_WINDOW = 3.2;           // seconds to chain a kill before the multiplier decays
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LS_KEY = 'neonTrench.best';   // localStorage record key

/* Difficulty (setting `difficulty`, see diffFor in js/game.js). Each stat runs from an early-campaign value to a late one across the
   first DIFF_RAMP ops, so the opening dogfights are gentler than Act III on every level; Normal's late values are the old tuning.
     turn      enemy fighter turn-rate multiplier      fire     multiplier on seconds between enemy attacks (higher = slower)
     bolt      enemy bolt speed multiplier             hp       enemy fighter hull multiplier
     calm      multiplier on how long a pilot stays off a break after one (higher = longer straight runs)
     jink      trench weave and juke size, and how readily a pilot jukes (1 = old tuning)
     attackers fighters pressing you at once in the arena (the rest orbit; goes up through the ramp)   dmg  damage you take */
const DIFF_RAMP=9;
const DIFFICULTY={
  easy:  {name:'Easy',  early:{turn:.7, fire:1.5, bolt:.85,hp:.7, calm:2.2,jink:.5,attackers:1,dmg:.75},late:{turn:.85,fire:1.25,bolt:.92,hp:.85,calm:1.6,jink:.7, attackers:2,dmg:.85}},
  normal:{name:'Normal',early:{turn:.8, fire:1.25,bolt:.9, hp:.8, calm:1.8,jink:.7,attackers:1,dmg:.85},late:{turn:1,  fire:1,   bolt:1,  hp:1,  calm:1,  jink:1,  attackers:2,dmg:1}},
  hard:  {name:'Hard',  early:{turn:1,  fire:1,   bolt:1,  hp:1,  calm:1,  jink:1,  attackers:2,dmg:1},   late:{turn:1.15,fire:.8, bolt:1.05,hp:1.25,calm:.7,jink:1.2,attackers:3,dmg:1.15}},
};

/* capital ship events in campaign arena ops (setting capEvents): chance per run on 'sometimes'; chance the event brings a hostile capital rather than only the friendly carrier */
const CAP_EVENT_CHANCE = .4, CAP_EVENT_HOSTILE = .7;

/* command bridge (B, js/bridge.js): game speed while you're on HALCYON's tactical view; orbit camera limits (metres from
   the fight's centre, and how far the camera may tilt from overhead) */
const BRIDGE = {slow:.25, dist:[220,600], pitch:[.35,1.35]};
/* the command room (js/holoroom.js), the bridge's holo-globe view (V): the globe's radius and height above the deck, how far
   the camera stands from it, how much of the fight it shows (times the bridge zoom, BRIDGE.dist), and how much of the
   bridge's tilt (BRIDGE.pitch) the camera takes */
const HOLO = {r:2.7, y:3.4, eye:7.6, range:1.4, tilt:.55, dist:[20,600]};   // dist: the zoom range on the globe

/* sector map (js/sector.js): how fleet damage carries from one fleet battle to the next, and what a struck target does to it.
     field  hull fraction every ship gets back between ops (field repairs)   floor  the least a surviving ship starts the next op with
     sunk   hull fraction a destroyer sunk in an op is patched back up to     yard   enemy capital hull multiplier after a shipyard strike
     base   enemy fighter multiplier after a fighter base strike */
const SECTOR_CARRY={field:.2,floor:.4,sunk:.4,yard:.8,base:.5};
