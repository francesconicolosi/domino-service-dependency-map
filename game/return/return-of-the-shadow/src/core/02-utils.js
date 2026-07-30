// ============================================================================
//  core/02-utils.js — tiny math/colour helpers and the global time `T`.
//
//  Depends only on `lg` (from core/00-namespace.js). Provides clamp/lerp/smooth,
//  colour helpers mul/setColA, the shared time accumulator `T`, and the wind
//  `gust`. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// -------------------------------------------------------------- UTILITY
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, k) { return a + (b - a) * k; }
function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
function mul(c, f, a) { return [c[0] * f, c[1] * f, c[2] * f, a === undefined ? 1 : a]; }
function setColA(c, a) { lg.setColor(c[0], c[1], c[2], a === undefined ? (c[3] === undefined ? 1 : c[3]) : a); }

let T = 0;
function gust(off) {
  const t = T + (off || 0);
  return clamp(0.55 + 0.32 * Math.sin(t * 0.23) + 0.18 * Math.sin(t * 0.71 + 1.3), 0, 1);
}
