// ============================================================================
//  art/shared-art.js — level-agnostic art vocabulary reused across scenarios.
//
//  Rock/stone and brick masonry primitives (with their STONE/BRICK palettes),
//  the witch emblem, the castle, and the flying carpet. All are pure drawing
//  helpers over `lg` + the shared constants/utils; they hold no level state.
//  Level-specific backgrounds and the plats renderer stay with rendering/levels.
//  See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// -------------------------------------------------------------- ROCK / STONE
const STONE = {
  base: [0.335, 0.305, 0.375],
  mid: [0.265, 0.240, 0.310],
  dark: [0.160, 0.145, 0.205],
  lit: [0.475, 0.440, 0.485],
  moss: [0.30, 0.42, 0.18],
  mossL: [0.50, 0.68, 0.25],
};

function rockOutline(p, pi) {
  if (p._tris) return p._tris;
  const rng = love.math.newRandomGenerator(pi * 4211 + 13);
  const pts = [];
  function push(x, y) { pts.push(x); pts.push(y); }
  push(p.x, p.y);
  push(p.x + p.w, p.y);
  if (!p.climbR) {
    let y = p.y;
    while (y < p.y + p.h - 44) {
      y = y + 30 + rng.random() * 42;
      push(p.x + p.w + rng.random() * 14, Math.min(y, p.y + p.h - 6));
    }
  }
  push(p.x + p.w, p.y + p.h);
  push(p.x, p.y + p.h);
  if (!p.climbL) {
    p._leftI = pts.length;
    const ys = [];
    let y = p.y + p.h;
    while (y > p.y + 44) { y = y - (30 + rng.random() * 42); ys.push(Math.max(y, p.y + 8)); }
    for (const yy of ys) push(p.x - rng.random() * 14, yy);
  }
  let tris = love.math.triangulate(pts);
  if (!tris || tris.length === 0) {
    tris = [[p.x, p.y, p.x + p.w, p.y, p.x + p.w, p.y + p.h],
            [p.x, p.y, p.x + p.w, p.y + p.h, p.x, p.y + p.h]];
  }
  p._tris = tris;
  p._pts = pts;
  return p._tris;
}

function drawGrass(x, y, w, rng) {
  lg.setColor(STONE.moss[0] * 0.55, STONE.moss[1] * 0.55, STONE.moss[2] * 0.55, 1);
  lg.rectangle('fill', x, y - 4, w, 5);
  let gx = x + 3;
  while (gx < x + w - 3) {
    const gh = 4 + Math.floor(rng.random() * 6);
    lg.setColor(STONE.moss[0], STONE.moss[1], STONE.moss[2], 1);
    lg.rectangle('fill', gx, y - 4 - gh, 3, gh);
    if (rng.random() < 0.55) {
      lg.setColor(STONE.mossL[0], STONE.mossL[1], STONE.mossL[2], 1);
      lg.rectangle('fill', gx, y - 4 - gh, 2, 2);
    }
    gx = gx + 4 + Math.floor(rng.random() * 7);
  }
}

function drawClimbMarks(p, pi) {
  const rng = love.math.newRandomGenerator(pi * 557 + 3);
  const x = p.x;
  const yEnd = Math.min((p.climbBot != null ? p.climbBot : (p.y + p.h)) + 30, p.y + p.h - 16);
  lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.30);
  lg.rectangle('fill', x, p.y + 4, 18, yEnd - p.y - 4);
  lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 0.95);
  lg.rectangle('fill', x + 18, p.y + 4, 2, yEnd - p.y - 4);
  let y = p.y + HOLDSTEP;
  while (y < yEnd - 14) {
    lg.setColor(0, 0, 0, 0.55);
    lg.rectangle('fill', x + 2, y, 13, 4);
    lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.85);
    lg.rectangle('fill', x + 2, y - 2, 13, 2);
    if (rng.random() < 0.35) {
      lg.setColor(STONE.mid[0], STONE.mid[1], STONE.mid[2], 1);
      lg.rectangle('fill', x - 4, y + 9, 5, 6);
      lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.7);
      lg.rectangle('fill', x - 4, y + 9, 5, 2);
    }
    y = y + HOLDSTEP;
  }
}

// ---- Level 2 masonry / backdrop
const BRICK = {
  base: [0.30, 0.27, 0.30], dark: [0.165, 0.145, 0.175],
  lit: [0.42, 0.38, 0.40], mort: [0.11, 0.10, 0.125],
};

function drawBrickBody(p, pi) {
  const rng = love.math.newRandomGenerator(pi * 911 + 17);
  lg.setColor(BRICK.dark[0], BRICK.dark[1], BRICK.dark[2], 1);
  lg.rectangle('fill', p.x, p.y, p.w, p.h);
  const bh = 16, bw = 46;
  const hLim = Math.min(p.h, 900);
  let row = 0, cy = p.y;
  while (cy < p.y + hLim) {
    const off = (row % 2 === 0) ? 0 : bw * 0.5;
    let cx = p.x - off;
    while (cx < p.x + p.w) {
      const x0 = Math.max(cx, p.x);
      const x1 = Math.min(cx + bw - 2, p.x + p.w);
      if (x1 > x0 + 3) {
        const v = 0.85 + rng.random() * 0.3;
        lg.setColor(BRICK.base[0] * v, BRICK.base[1] * v, BRICK.base[2] * v, 1);
        lg.rectangle('fill', x0, cy + 1, x1 - x0, bh - 2);
        lg.setColor(BRICK.lit[0], BRICK.lit[1], BRICK.lit[2], 0.25);
        lg.rectangle('fill', x0, cy + 1, x1 - x0, 2);
      }
      cx = cx + bw;
    }
    lg.setColor(BRICK.mort[0], BRICK.mort[1], BRICK.mort[2], 1);
    lg.rectangle('fill', p.x, cy, p.w, 1.5);
    cy = cy + bh;
    row = row + 1;
  }
  for (let k = 1; k <= 3; k++) {
    const sy = p.y + hLim * (0.42 + k * 0.19);
    if (sy < p.y + p.h) {
      lg.setColor(0, 0, 0, 0.18);
      lg.rectangle('fill', p.x, sy, p.w, p.y + p.h - sy);
    }
  }
}

function drawFlags(x, y, w, rng) {
  lg.setColor(BRICK.lit[0], BRICK.lit[1], BRICK.lit[2], 1);
  lg.rectangle('fill', x, y - 3, w, 4);
  lg.setColor(BRICK.mort[0], BRICK.mort[1], BRICK.mort[2], 1);
  let gx = x;
  while (gx < x + w) {
    lg.rectangle('fill', gx, y - 3, 1.5, 4);
    gx = gx + 26 + rng.random() * 14;
  }
  lg.setColor(1, 0.85, 0.6, 0.18);
  lg.rectangle('fill', x, y - 3, w, 1.5);
}

// -------------------------------------------------------------- WITCH EMBLEM
function drawEmblem(x, y, r, alpha, bg) {
  const a = alpha === undefined ? 1 : alpha;
  const pulse = 0.75 + 0.25 * Math.sin(T * 1.3);
  lg.push();
  lg.translate(x, y);

  setColA(COL.emblem, a * 0.9);
  lg.setLineWidth(r * 0.06);
  lg.circle('line', 0, 0, r);
  lg.setLineWidth(r * 0.03);
  lg.circle('line', 0, 0, r * 0.80);

  for (let k = 0; k <= 7; k++) {
    const an = k * Math.PI / 4 + Math.PI / 8;
    lg.line(Math.cos(an) * r * 0.86, Math.sin(an) * r * 0.86,
            Math.cos(an) * r * 0.94, Math.sin(an) * r * 0.94);
  }

  lg.setLineWidth(r * 0.045);
  for (let k = 0; k <= 2; k++) {
    const an = -Math.PI / 2 + k * 2 * Math.PI / 3;
    lg.circle('line', Math.cos(an) * r * 0.32, Math.sin(an) * r * 0.32, r * 0.44);
  }

  setColA(COL.emblem, a * pulse);
  if (bg) {
    lg.circle('fill', 0, r * 0.06, r * 0.30);
    setColA(bg, 1);
    lg.circle('fill', r * 0.11, -r * 0.05, r * 0.27);
  } else {
    lg.setLineWidth(r * 0.05);
    lg.arc('line', 'open', 0, r * 0.06, r * 0.30, Math.PI * 0.35, Math.PI * 1.65);
    lg.arc('line', 'open', r * 0.05, 0.0, r * 0.24, Math.PI * 0.45, Math.PI * 1.55);
  }

  setColA(COL.emblem, a * pulse);
  lg.setLineWidth(r * 0.04);
  lg.ellipse('line', 0, -r * 0.10, r * 0.17, r * 0.095);
  lg.circle('fill', 0, -r * 0.10, r * 0.045);

  lg.pop();
  lg.setLineWidth(1);
}

// -------------------------------------------------------------- CASTLE
function tower(cx, base, w, top, col) {
  setColA(col);
  lg.polygon('fill', cx - w / 2, base, cx - w * 0.42, top, cx + w * 0.42, top, cx + w / 2, base);
  lg.polygon('fill', cx - w * 0.56, top + 4, cx, top - w * 1.35, cx + w * 0.56, top + 4);
  setColA(COL.rockLit, 0.55);
  lg.setLineWidth(2);
  lg.line(cx - w * 0.56, top + 4, cx, top - w * 1.35);
  lg.line(cx - w / 2, base, cx - w * 0.42, top);
}

function archWindow(x, y, w, h) {
  lg.rectangle('fill', x - w / 2, y - h + w / 2, w, h - w / 2);
  lg.arc('fill', x, y - h + w / 2, w / 2, Math.PI, 2 * Math.PI);
}

function drawCastle(cx, gy) {
  setColA(mul(COL.castle2, 0.9));
  lg.polygon('fill', cx - 330, gy, cx - 235, gy - 72, cx + 245, gy - 84, cx + 335, gy);

  tower(cx - 30, gy - 60, 84, gy - 470, COL.castle2);
  tower(cx - 205, gy - 55, 58, gy - 360, COL.castle2);
  tower(cx + 195, gy - 60, 62, gy - 385, COL.castle2);

  setColA(COL.castle);
  lg.polygon('fill', cx - 150, gy - 60, cx - 135, gy - 305, cx + 135, gy - 305, cx + 150, gy - 60);
  for (let i = -3; i <= 3; i++) {
    lg.rectangle('fill', cx + i * 38 - 11, gy - 322, 22, 20);
  }
  tower(cx - 128, gy - 60, 52, gy - 330, COL.castle);
  tower(cx + 122, gy - 60, 52, gy - 318, COL.castle);

  setColA(COL.portal);
  archWindow(cx - 60, gy - 205, 16, 42);
  archWindow(cx, gy - 235, 18, 48);
  archWindow(cx + 60, gy - 205, 16, 42);
  archWindow(cx - 128, gy - 250, 12, 30);
  archWindow(cx + 122, gy - 240, 12, 30);
  const flick = 0.55 + 0.20 * Math.sin(T * 7.3) + 0.12 * Math.sin(T * 13.1);
  lg.setColor(1.0, 0.62, 0.25, flick);
  archWindow(cx, gy - 235, 18, 48);
  lg.setColor(1.0, 0.62, 0.25, flick * 0.25);
  lg.circle('fill', cx, gy - 250, 26);

  setColA(COL.portal);
  const pw = 96, ph = 128;
  lg.rectangle('fill', cx - pw / 2, gy - 60 - ph + pw / 2, pw, ph - pw / 2);
  lg.arc('fill', cx, gy - 60 - ph + pw / 2, pw / 2, Math.PI, 2 * Math.PI);
  setColA(COL.rockLit, 0.35);
  lg.setLineWidth(3);
  lg.arc('line', 'open', cx, gy - 60 - ph + pw / 2, pw / 2 + 3, Math.PI, 2 * Math.PI);
  lg.line(cx - pw / 2 - 3, gy - 60 - ph + pw / 2, cx - pw / 2 - 3, gy - 60);
  lg.line(cx + pw / 2 + 3, gy - 60 - ph + pw / 2, cx + pw / 2 + 3, gy - 60);

  drawEmblem(cx, gy - 60 - ph * 0.52, 34, 0.9, COL.portal);

  lg.setLineWidth(1);
}

// -------------------------------------------------------------- FLYING CARPET
// A magic flying carpet hovering over the high left cliff — the enchanted rug
// the hero rode up to this place. It undulates gently and glows with magic.
function drawFlyingCarpet(cx, gy, s) {
  s = s || 1;
  const RED = [0.58, 0.12, 0.17], REDD = [0.36, 0.07, 0.13],
    GOLD = [0.86, 0.69, 0.32], GOLDD = [0.55, 0.42, 0.20], CREAM = [0.93, 0.87, 0.64];
  const hover = -44 * s;                 // carpet floats this far above the cliff

  // (no shadow or glow beneath the carpet — it is airborne)
  lg.push();
  lg.translate(cx, gy + hover);
  lg.scale(s, s);

  const L = 46, N = 16, amp = 4.2, thick = 7.0, slope = -0.09;
  // centreline of the carpet at length-coordinate x (gentle travelling wave + tilt)
  const wv = function (x) { return Math.sin(x * 0.13 + T * 1.5) * amp + x * slope; };

  // carpet body — filled ribbon (top edge left→right, bottom edge right→left)
  const poly = [];
  for (let i = 0; i <= N; i++) { const x = -L + 2 * L * i / N; poly.push(x, wv(x) - thick); }
  for (let i = N; i >= 0; i--) { const x = -L + 2 * L * i / N; poly.push(x, wv(x) + thick); }
  setColA(RED); lg.polygon('fill', poly);
  // darker underside band for depth
  setColA(REDD);
  const under = [];
  for (let i = 0; i <= N; i++) { const x = -L + 2 * L * i / N; under.push(x, wv(x) + thick * 0.35); }
  for (let i = N; i >= 0; i--) { const x = -L + 2 * L * i / N; under.push(x, wv(x) + thick); }
  lg.polygon('fill', under);

  // gold trim along both long edges
  lg.setLineWidth(2.2); setColA(GOLD);
  for (let e = -1; e <= 1; e += 2) {
    for (let i = 0; i < N; i++) {
      const x0 = -L + 2 * L * i / N, x1 = -L + 2 * L * (i + 1) / N;
      lg.line(x0, wv(x0) + e * thick, x1, wv(x1) + e * thick);
    }
  }

  // woven pattern — evenly spaced cross-stripes
  setColA(GOLDD); lg.setLineWidth(1.4);
  for (let k = -2; k <= 2; k++) {
    const x = k * 15.5;
    lg.line(x, wv(x) - thick + 1.6, x, wv(x) + thick - 1.6);
  }
  // central medallion (diamond)
  const cy0 = wv(0);
  setColA(CREAM); lg.polygon('fill', 0, cy0 - 4.6, 6.4, cy0, 0, cy0 + 4.6, -6.4, cy0);
  setColA(REDD); lg.polygon('fill', 0, cy0 - 2.6, 3.4, cy0, 0, cy0 + 2.6, -3.4, cy0);
  setColA(GOLD); lg.circle('fill', 0, cy0, 1.1);

  // fringe / tassels at both ends
  setColA(CREAM); lg.setLineWidth(1.5);
  for (const end of [-L, L]) {
    const base = wv(end), dir = end < 0 ? -1 : 1;
    for (let f = -2; f <= 2; f++) {
      const yy = base + f * 2.7;
      lg.line(end, yy, end + dir * 5, yy + 2.0);
    }
  }
  lg.setLineWidth(1);

  // a couple of drifting magic sparkles
  const tw = 0.55 + 0.45 * Math.sin(T * 3.1);
  setColA([1.0, 0.95, 0.7], 0.7 * tw);
  lg.circle('fill', -L * 0.55, wv(-L * 0.55) - thick - 7 - 2 * tw, 1.3);
  setColA([0.85, 0.9, 1.0], 0.6 * (1 - tw));
  lg.circle('fill', L * 0.35, wv(L * 0.35) - thick - 10 + 2 * tw, 1.1);

  lg.pop();
}
