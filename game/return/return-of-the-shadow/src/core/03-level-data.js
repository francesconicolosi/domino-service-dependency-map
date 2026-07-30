// ============================================================================
//  core/03-level-data.js — static level geometry (platforms, checkpoints, floors).
//
//  The plats*/checkpoints* arrays and floor/landmark constants for every level
//  (FLOOR3, FLOOR5, DOOR_LIGHT_X, the Level 5 lava pools, …). Loaded before the
//  character and level scripts so their load-time consts (e.g. LANE3 derived
//  from FLOOR3) resolve. Depends only on core/01-constants.js.
//  See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// -------------------------------------------------------------- LEVEL DATA
let plats1 = [
  { x: -260, y: 1420, w: 260, h: 980 },
  { x: 0, y: 1800, w: 760, h: 560 },
  { x: 760, y: 1728, w: 300, h: 640 },   // connected step-up: no death gap right at the start
  { x: 1140, y: 1652, w: 190, h: 720 },
  { x: 1520, y: 1636, w: 330, h: 740 },
  { x: 1920, y: 1476, w: 260, h: 900 },
  { x: 2260, y: 1468, w: 150, h: 16, beam: true },
  { x: 2480, y: 1446, w: 140, h: 16, beam: true },
  { x: 2700, y: 1424, w: 320, h: 950 },
  { x: 3080, y: 1044, w: 280, h: 1330, climbL: true, climbBot: 1508 },
  { x: 3420, y: 1000, w: 230, h: 1380 },
  { x: 3760, y: 856, w: 210, h: 1520 },
  { x: 4030, y: 846, w: 140, h: 16, beam: true },
  { x: 4230, y: 816, w: 280, h: 1560 },
  { x: 4740, y: 796, w: 250, h: 1580 },
  { x: 5060, y: 516, w: 300, h: 1860, climbL: true, climbBot: 880 },
  { x: 5420, y: 470, w: 190, h: 1900 },
  { x: 5680, y: PROM_Y, w: 1520, h: 1960 },
];
let checkpoints1 = [
  { x: 160, y: 1800 }, { x: 1620, y: 1636 }, { x: 2760, y: 1424 },
  { x: 3480, y: 1000 }, { x: 4310, y: 816 }, { x: 5760, y: PROM_Y },
];

let plats2 = [
  { x: -60, y: 900, w: 1000, h: 560 },
  { x: 1300, y: 744, w: 660, h: 700 },
  { x: 2100, y: 744, w: 430, h: 700 },
  { x: 2530, y: 384, w: 260, h: 1060, climbL: true, climbBot: 700 },
  { x: 2790, y: 384, w: 560, h: 1420 },
  { x: 3480, y: 384, w: 760, h: 1420 },   // skeleton hall + trap/sword puzzle (3480..4240)
  { x: 4240, y: 384, w: 760, h: 1420 },   // ROPE HALL  — gate A at ~4960 (4240..5000)
  // KEY HALL (5000..5760): two upper walkways with an open shaft between them;
  // the key is hidden in the basement below, reached by dropping through the hole
  { x: 5000, y: 384, w: 280, h: 26 },     // upper-left walkway 5000..5280
  { x: 5520, y: 384, w: 240, h: 26 },     // upper-right walkway 5520..5760 (gate B at 5720)
  { x: 5000, y: 900, w: 760, h: 900 },    // basement floor 5000..5760
  { x: 5760, y: 384, w: 920, h: 1420 },   // FINAL APPROACH → emblem door (5760..6680)
];
for (let i = 0; i <= 5; i++) {
  plats2.push({ x: 940 + i * 60, y: 900 - (i + 1) * 26, w: 66, h: 560 + (i + 1) * 26 });
}
let checkpoints2 = [
  { x: 150, y: 900 }, { x: 1360, y: 744 }, { x: 2160, y: 744 }, { x: 2860, y: 384 }, { x: 3560, y: 384 },
  { x: 4300, y: 384 }, { x: 5060, y: 384 }, { x: 5820, y: 384 },
];

// -------------------------------------------------------------- LEVEL 3: THE BLACK HALLS
// A pitch-dark descent into the keep's lower vaults. No torches until the hero
// finds the candle at the far end of a great saloon. Everything is one long
// floor with stairs, floating ledges and a great hall; the saloon (3760..6260)
// is where the six-armed guardian awakes.
const FLOOR3 = 384;
let plats3 = [
  { x: -80, y: FLOOR3, w: 2260, h: 1600 },     // entrance hall + stair base
  // stairs climbing up to the key shelf (they rest on the entrance floor)
  { x: 1180, y: 356, w: 130, h: 60 },
  { x: 1310, y: 328, w: 130, h: 90 },
  { x: 1440, y: 300, w: 130, h: 120 },
  { x: 1570, y: 272, w: 130, h: 150 },
  { x: 1700, y: 244, w: 440, h: 180 },         // key shelf (1700..2140)
  // hall beyond the locked gate (gate K sits at x≈2180, added in initEnts3)
  { x: 2180, y: FLOOR3, w: 1000, h: 1600 },
  // floating ledges — an upper layer patrolled by flying heads
  { x: 2360, y: 250, w: 130, h: 18 },
  { x: 2640, y: 208, w: 320, h: 18 },
  { x: 2980, y: 250, w: 130, h: 18 },
  { x: 3180, y: FLOOR3, w: 620, h: 1600 },     // corridor to the saloon
  // THE SALOON — a vast hall (3760..6260)
  { x: 3760, y: FLOOR3, w: 2560, h: 1600 },
  { x: 4380, y: 246, w: 240, h: 16 },          // saloon side ledges (standable)
  { x: 5320, y: 246, w: 240, h: 16 },
];
let checkpoints3 = [
  { x: 120, y: FLOOR3 }, { x: 2300, y: FLOOR3 }, { x: 3300, y: FLOOR3 }, { x: 3860, y: FLOOR3 },
];

// -------------------------------------------------------------- LEVEL 5: THE LAVA CAVERNS
// The hero wakes in a molten cave. A long floor punched with lava pits (which
// spit lava balls and kill on contact), skeletons to shove in, a barred door
// opened from a hidden basement button, the buried magic carpet under a rock,
// a mounted Lava Knight guarding the fire-sword power, and a wide lava river
// the freed carpet must fly across.
const FLOOR5 = 384;
let plats5 = [
  // wake area + first lava gauntlet (floor with pit gaps)
  { x: -300, y: FLOOR5, w: 1120, h: 1400 },   // -300..820   (hero wakes at ~120)
  // LAVA PIT 1: 820..980
  { x: 980,  y: FLOOR5, w: 440,  h: 1400 },    // 980..1420
  // LAVA PIT 2: 1420..1580
  { x: 1580, y: FLOOR5, w: 300,  h: 1400 },    // 1580..1880  (skeleton stretch, before pit 3)
  // LAVA PIT 3: 1880..2040 (moved well left of the door / button hole)
  // --- the barred-door approach + a deep labyrinth descent to the hidden button ---
  { x: 2040, y: FLOOR5, w: 280, h: 1400 },      // THICK ROCK between the lava and the hole (2040..2320)
  { x: 2320, y: FLOOR5, w: 160, h: 26 },        // A: thin approach walkway 2320..2480 (over the labyrinth)
  // DROP-IN gap 2480..2560 (fall into the labyrinth below)
  // B: the solid door pillar; its LEFT face (x2560) is climbable, so the hero
  //    climbs smoothly out of the labyrinth and mantles onto the top by the door.
  { x: 2560, y: FLOOR5, w: 340, h: 1400 }, // 2560..2900 (door at 2850); solid wall, not climbable
  // the winding, oblique DESCENT far DOWN — well clear of the lava (280px of rock away)
  { x: 2380, y: 560,  w: 180, h: 18 },          // L1  2380..2560 (catches the drop)
  { x: 2320, y: 730,  w: 200, h: 18 },          // L2  2320..2520
  { x: 2400, y: 900,  w: 160, h: 18 },          // L3  2400..2560
  { x: 2320, y: 1070, w: 240, h: 18 },          // L4  2320..2560 — button room (button at 2380), climb B's face at the right end
  { x: 2320, y: 1200, w: 580, h: 120 },         // bottom safety floor 2320..2900
  // DOOR gate at x≈2850 (added in initEnts5)
  { x: 2900, y: FLOOR5, w: 760,  h: 1400 },    // seg5 2900..3660 (carpet + rock at ~3320)
  // LAVA PIT 4: 3660..3820
  { x: 3820, y: FLOOR5, w: 980,  h: 1400 },    // knight arena 3820..4800
  // LONG LAVA RIVER: 4800..25200 (impassable on foot — flown over on the carpet;
  // ~20400px wide, roughly triple the original crossing so the flight lasts longer)
  { x: 25200, y: FLOOR5, w: 400, h: 1400 },    // the far lip, where the DOOR OF LIGHT stands
];
const DOOR_LIGHT_X = 25240;   // the giant door of light at the end of the river flight
let checkpoints5 = [
  { x: 120, y: FLOOR5 }, { x: 1660, y: FLOOR5 }, { x: 2300, y: FLOOR5 },
  { x: 2960, y: FLOOR5 }, { x: 3900, y: FLOOR5 },
];
// lava pools that fill the pit gaps (surface Y a touch below the floor lip)
const LAVA5 = [
  { x0: 820,  x1: 980,  y: 452, emit: true },
  { x0: 1420, x1: 1580, y: 452, emit: true },
  { x0: 1880, x1: 2040, y: 452, emit: true },
  { x0: 3660, x1: 3820, y: 452, emit: true },
  { x0: 4800, x1: 25200, y: 452, river: true },   // the long river (no pit-balls; the flight has its own bolts)
];
