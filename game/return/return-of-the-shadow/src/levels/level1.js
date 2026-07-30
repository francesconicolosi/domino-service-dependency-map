// ============================================================================
//  levels/level1.js — Level 1 "The Ascent" (Prologue) scenery.
//
//  The parallax mountain background: ridge generation (genRidge/buildBackground)
//  and the sky/ridge/cloud render (drawBackground) with its ridge/cloud state.
//  The prologue's castle cinematic stays in the engine (it drives the shared
//  camera). Level 1 has no enemies. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// -------------------------------------------------------------- BACKGROUND
let ridges = [];
let clouds = [];

function genRidge(seed, amp, x0, x1, n) {
  const rng = love.math.newRandomGenerator(seed);
  const a1 = rng.random() * 6.283, a2 = rng.random() * 6.283, a3 = rng.random() * 6.283;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    const u = i * 0.35;
    const h = amp * (0.60 + 0.40 * Math.sin(u * 0.8 + a1))
      + amp * 0.45 * (1 - Math.abs(Math.sin(u * 1.7 + a2)))
      + amp * 0.18 * Math.sin(u * 4.1 + a3);
    pts.push(x); pts.push(-h);
  }
  pts.push(x1); pts.push(1400);
  pts.push(x0); pts.push(1400);
  // return the raw outline (a single simple polygon). Drawing it as ONE fill
  // avoids the hairline seams that Safari renders between separate triangles.
  return pts;
}

function buildBackground() {
  ridges = [
    { tris: genRidge(11, 250, -600, 8400, 150), par: 0.12, lift: -55, col: COL.ridge1 },
    { tris: genRidge(23, 330, -600, 8400, 170), par: 0.30, lift: 15, col: COL.ridge2 },
    { tris: genRidge(47, 420, -600, 8400, 190), par: 0.55, lift: 105, col: COL.ridge3 },
  ];
  const rng = love.math.newRandomGenerator(99);
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: rng.random() * VW, y: VH * (0.18 + rng.random() * 0.30),
      w: 180 + rng.random() * 260, h: 10 + rng.random() * 16,
      spd: 4 + rng.random() * 8, a: 0.14 + rng.random() * 0.16
    });
  }
}

function drawBackground(cam) {
  // two abutting gradients sharing skyMid at an INTEGER boundary — no seam.
  // upper: night purple → dusk pink; lower half: pink → orange (fills down)
  const hMid = Math.round(VH * 0.45);
  lg.gradientRect(0, 0, VW, hMid, COL.skyTop, COL.skyMid);
  lg.gradientRect(0, hMid, VW, VH - hMid, COL.skyMid, COL.skyLow);

  const sx = VW * 0.60, sy = VH * 0.55;
  for (let i = 5; i >= 1; i--) {
    setColA(COL.sun, 0.05 * i);
    lg.circle('fill', sx, sy, 42 + (6 - i) * 30);
  }
  setColA(COL.sun, 0.95);
  lg.circle('fill', sx, sy, 40);

  for (const c of clouds) {
    lg.setColor(0.46, 0.23, 0.42, c.a);
    const cx = (c.x - T * c.spd) % (VW + c.w) - c.w * 0.5;
    lg.ellipse('fill', cx, c.y, c.w, c.h);
  }

  for (const L of ridges) {
    lg.push();
    const offY = VH * 0.62 + (1500 - cam.y) * L.par * 0.5 + L.lift;
    lg.translate(-cam.x * L.par, offY);
    setColA(L.col);
    lg.polygon('fill', L.tris);   // single simple-polygon fill (no triangle seams)
    lg.pop();
  }

  // warm dusk wash over the lower half — ONE continuous gradient (alpha fades
  // in toward the bottom), so there are no hard internal edges / horizon seam
  const wy = Math.round(VH * 0.46);
  lg.gradientRect(0, wy, VW, VH - wy, [COL.skyLow[0], COL.skyLow[1], COL.skyLow[2], 0],
    [COL.skyLow[0], COL.skyLow[1], COL.skyLow[2], 0.5]);
}

// ROCK/STONE + brick masonry primitives moved to art/shared-art.js

