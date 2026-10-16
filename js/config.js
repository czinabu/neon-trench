"use strict";
/* Core tuning constants: trench size, speeds, missiles, pacing. */

const TRENCH_LEN = 22000;           // metres to the reactor intake (long run)
const HALF_W = 30;                  // trench half width
const FLOOR_Y = -22, TOP_Y = 26;    // flak ceiling above TOP_Y
const SEG_LEN = 150, SEG_POOL = 16;
const MAX_SPD = 190, BOOST_MULT = 1.8;
const ACCEL_ARC = 115, ACCEL_REAL = 68;   // flight-assist authority per model
const MSL_MAX = 8, MSL_START = 6;
const BEAM_GAP_MIN = 170;           // minimum metres between consecutive hazards (fairness)
const COMBO_WINDOW = 3.2;           // seconds to chain a kill before the multiplier decays
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LS_KEY = 'neonTrench.best';   // localStorage record key
