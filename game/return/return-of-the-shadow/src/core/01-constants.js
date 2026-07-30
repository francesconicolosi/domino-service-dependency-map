// ============================================================================
//  core/01-constants.js — engine constants and the COL colour palette.
//
//  Pure data, no dependencies. Loaded early so every later classic script sees
//  these by bare name (VW, VH, GRAV, physics tunables, the COL palette, …).
//  See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// -------------------------------------------------------------- CONSTANTS
const VW = 1280, VH = 720;
const GRAV = 1500;
const RUNSPD = 260;
const BEAMSPD = 118;
const ACC_G = 1900;
const ACC_A = 950;
const FRICT = 2100;
const JUMPV = 620;
const CLIMBSPD = 200;
const ATK_DUR = 0.42;
const DRAW_DUR = 0.55;
const BLOCK_DUR = 0.5;      // how long the block guard is held
const RIPOSTE_WIN = 1.6;    // window after a successful parry to counter-attack
const HOLDSTEP = 26;
const COYOTE = 0.10;
const JBUF = 0.13;
const SCARF_N = 6;          // cape node count (fewer = shorter cape)
const SCARF_SEG = 5.0;      // cape segment rest length; max cape ≈ (SCARF_N-1)*SCARF_SEG
const BUILD = '2026-07-29-L6';  // shown on-screen (bottom-left) so a stale cached copy is obvious

const CINE_TRIGGER_X = 5980;
const CINE_STOP_X = 6180;
const CASTLE_X = 6500;
const PROM_Y = 424;

const COL = {
  skyTop:  [0.22, 0.12, 0.36],
  skyMid:  [0.66, 0.28, 0.44],
  skyLow:  [0.99, 0.55, 0.24],
  sun:     [1.00, 0.86, 0.58],
  ridge1:  [0.47, 0.30, 0.46],
  ridge2:  [0.33, 0.21, 0.37],
  ridge3:  [0.21, 0.14, 0.27],
  rock:    [0.145, 0.115, 0.20],
  rockLit: [0.98, 0.62, 0.34],
  snow:    [0.90, 0.88, 0.97],
  castle:  [0.155, 0.145, 0.24],
  castle2: [0.115, 0.105, 0.185],
  portal:  [0.07, 0.065, 0.115],
  emblem:  [0.60, 0.82, 0.78],
  skin:    [0.87, 0.64, 0.47],
  shirt:   [0.88, 0.82, 0.67],
  vest:    [0.66, 0.27, 0.15],
  pants:   [0.42, 0.36, 0.23],
  boots:   [0.24, 0.18, 0.125],
  belt:    [0.32, 0.23, 0.14],
  hair:    [0.13, 0.10, 0.085],
  scarf:   [0.74, 0.31, 0.18],
  title:   [0.94, 0.89, 0.78],
};
