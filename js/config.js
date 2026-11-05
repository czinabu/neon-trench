"use strict";
/* Core tuning constants: trench size, speeds, missiles, pacing. */

const TRENCH_LEN = 15000;           // metres to the reactor intake
const TRENCH_SWELL = 4800;          // the trench score swells over this last stretch to the intake (scaled with TRENCH_LEN)
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
const FORK_LEN = 420, FORK_DIV = [4, 12], FORK_GAP = 2300;   // trench forks (js/branch.js): length, divider x range (mirrored for a left channel), minimum metres between forks
const PAD_BOOST = 1.35, PAD_T = 2.6;   // a side-channel boost pad: speed multiplier, seconds it lasts
/* trench readability: a crossbeam on your line this many seconds out flashes a CLIMB/DIVE/LEFT/RIGHT call (0 = off, per difficulty) */
const BEAM_WARN = {easy:1.3, normal:1.0, hard:0};
/* a capital ship's lance on the player: damage multiplier per difficulty (the lance's own dmg is in js/data/capitals.js) */
const LANCE_DMG = {easy:.6, normal:.8, hard:1};
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

/* an enemy bolt that passes within this many metres of the ship without hitting it whistles and nudges the camera */
const NEAR_MISS_R = 14;

/* Survival (Free Play): endless waves in the open arena. A wave is SURVIVAL.perWave kills. Each wave past the first raises the enemy
   hull, turn rate, bolt speed and damage and lowers their fire delay and calm by these fractions of the run's base (to the caps in
   survivalWave, js/arena.js), lifts how many fighters fly at once (start, +1 every 2 waves, max), and shifts the roster toward
   darts, hunters and (from wave 4) aces. */
/* fleet battles: once the op's fighter count is spent, enemy capitals still alive keep launching hunters that go for you,
   so the pilot seat is never a turret-only fight (gap = seconds between launches [base, random]; max alive per difficulty) */
// (not in a leader op such as Sovereign, where the squadron leader comes for you instead)
const FLEET_HUNT={gap:[16,10],max:{easy:1,normal:3,hard:3}};
/* fleet battles: the fighter's shield waits `delay` seconds after a hit before it recharges, at `rate` per second (the
   open arena and the trench use 3 s and 7/s), so fire wears you down; and the chance each few seconds that a free-flying enemy
   fighter turns on a friendly fighter instead of you (`squadFoe`: it goes for TALON or WRAITH first when they are out) */
const FLEET_PILOT={delay:4,rate:6,squadFoe:.5};
/* orders you receive in the cockpit (js/orders.js): points for clearing one, seconds before one lapses, and the
   fewest seconds between two CIC sends (a lance charging on a friendly capital) */
const ORDERS={bonus:250,expire:60,gap:35};
/* co-op (js/net.js): how players' games reach each other.
   NET_RELAY   a WebSocket room server's address (e.g. 'wss://neon-trench-rooms.example.workers.dev/room'), for a
               future game server. Empty: players link straight to the host's game (PeerJS + WebRTC, below).
   NET_PEER    the peer-to-peer link: the free PeerJS broker matches the room code to the host's game, then the games
               talk directly. `prefix` keeps our room codes apart from other PeerJS games'; `turn` is the Vercel function
               (api/turn.js) that hands out Cloudflare TURN relay logins for networks that block direct links, and `wait`
               how long to wait for it before going without. Add ?net=local to the address to link tabs of one browser
               instead (offline testing). */
const NET_RELAY='';
const NET_PEER={prefix:'neontrench-',turn:'/api/turn',wait:2500,stun:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']};
const SURVIVAL={perWave:10,hp:.07,turn:.025,fire:.03,calm:.03,bolt:.01,dmg:.02,cap:[4,8],aceFrom:4};

/* Asteroid fields (js/field.js): a second open-space battlefield, packed with rock, for arena ops that set `field:'drift'`
   (Act V, some contracts, a Skirmish option).
     rocks/big    solid rocks in the field, and how many of them are the big ones; size, bigSize: their radius range (m)
     ore          volatile ore rocks among them (amber seams); oreHp: player hits to set one off
     blastR       an ore blast's reach past the rock's surface; blastDmg: hull to you at point blank (less further out);
                  blastFoe: damage to every enemy fighter it reaches
     keep         rock-free room kept round the start point and every capital ship's station, so no fleet starts inside rock
     fog, dust    the field's haze (fog density) and how bright the dust motes are */
const FIELD={rocks:170,big:22,size:[6,22],bigSize:[36,66],ore:16,oreHp:3,blastR:70,blastDmg:30,blastFoe:14,keep:160,fog:.00062,dust:.4};
