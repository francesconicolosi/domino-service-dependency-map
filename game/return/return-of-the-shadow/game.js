// ============================================================================
//  THE RETURN OF THE SHADOW — native HTML/JS port
//  Prologue: "The Ascent" + Level 2: "The Witch's Keep"
//
//  A near 1:1 translation of the original Love2D main.lua onto love-shim.js.
//  Everything (graphics, animation, audio) is generated procedurally in code.
//  The hero's sword combat has been re-choreographed for weight and reach,
//  taking motion cues from the classic Prince of Persia fencing (guard →
//  committed lunge/thrust → held reading of the hit → weighted recovery).
//  No sprite art is imported: the poses stay fully procedural.
// ============================================================================

(function () {
  'use strict';

  const lg = love.graphics;

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
  const BUILD = '2026-07-25f';  // shown on-screen (bottom-left) so a stale cached copy is obvious

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

  let level = 1;
  let plats, checkpoints;

  // -------------------------------------------------------------- AUDIO (procedural)
  let windSrc, musicSrc;
  let sfxSwing, sfxHit, sfxParry, sfxThunder;
  let musicVol = 0, windVol = 0;

  function genWind() {
    const rate = 22050, secs = 6;
    const n = rate * secs;
    const sd = love.sound.newSoundData(n, rate, 16, 1);
    const rng = love.math.newRandomGenerator(7);
    let lo = 0, mid = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const x = rng.random() * 2 - 1;
      lo = lo + 0.045 * (x - lo);
      mid = mid + 0.180 * (x - mid);
      const m = 0.55 + 0.30 * Math.sin(2 * Math.PI * 0.13 * t) + 0.15 * Math.sin(2 * Math.PI * 0.047 * t + 1.7);
      const s = (lo * 3.1 + mid * 0.8) * m;
      let fade = 1;
      if (t < 0.4) fade = t / 0.4; else if (t > secs - 0.4) fade = (secs - t) / 0.4;
      sd.setSample(i, clamp(s * fade, -1, 1));
    }
    return sd;
  }

  function genMusic() {
    const rate = 22050, dur = 4.0;
    const chords = [
      [73.42, 146.83, 174.61, 220.00, 293.66],
      [58.27, 116.54, 174.61, 233.08, 293.66],
      [49.00, 98.00, 146.83, 196.00, 233.08],
      [55.00, 110.00, 164.81, 220.00, 277.18],
    ];
    const total = Math.floor(rate * dur * chords.length);
    const sd = love.sound.newSoundData(total, rate, 16, 1);
    for (let ci = 0; ci < chords.length; ci++) {
      const notes = chords[ci];
      const base = Math.floor(ci * dur * rate);
      const nsamp = Math.floor(dur * rate);
      for (let i = 0; i < nsamp; i++) {
        const t = i / rate;
        let env = Math.max(0, Math.min(t / 1.4, 1) * Math.min((dur - t) / 1.2, 1));
        env = env * env * (3 - 2 * env);
        let s = 0;
        for (let ni = 0; ni < notes.length; ni++) {
          const f = notes[ni];
          const a = (ni === 0) ? 0.16 : 0.10;
          const ph = 2 * Math.PI * t;
          s += a * 0.5 * (Math.sin(ph * f * 0.9985) + Math.sin(ph * f * 1.0015));
          s += a * 0.32 * Math.sin(ph * f * 2.001);
        }
        const idx = base + i;
        if (idx < total) sd.setSample(idx, clamp(s * env, -1, 1));
      }
    }
    return sd;
  }

  // Sword swoosh: band-passed noise that swells then fades — a blade cutting air
  function genSwoosh() {
    const rate = 22050, dur = 0.24;
    const n = Math.floor(rate * dur);
    const sd = love.sound.newSoundData(n, rate, 16, 1);
    const rng = love.math.newRandomGenerator(4127);
    let lp = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const u = t / dur;
      const white = rng.random() * 2 - 1;
      const cutoff = 0.05 + 0.5 * (1 - u);        // lowpass opens then closes
      lp = lp + cutoff * (white - lp);
      const band = lp - prev; prev = lp;          // crude band-pass
      const env = Math.sin(Math.PI * clamp(u, 0, 1));
      const tone = 0.15 * Math.sin(2 * Math.PI * (900 - 500 * u) * t);
      const s = (band * 4.0 + tone) * env * env;
      sd.setSample(i, clamp(s, -1, 1));
    }
    return sd;
  }

  // Metallic hit: inharmonic partials with fast decay + a sharp noise transient
  function genClang() {
    const rate = 22050, dur = 0.34;
    const n = Math.floor(rate * dur);
    const sd = love.sound.newSoundData(n, rate, 16, 1);
    const rng = love.math.newRandomGenerator(9173);
    const partials = [[740, 20], [1108, 26], [1560, 30], [2090, 38], [2760, 46]];
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      let s = 0;
      for (const pr of partials) s += Math.sin(2 * Math.PI * pr[0] * t) * Math.exp(-t * pr[1]);
      s *= 0.16;
      if (t < 0.012) s += (rng.random() * 2 - 1) * (1 - t / 0.012) * 0.6;
      s *= Math.exp(-t * 6);
      sd.setSample(i, clamp(s, -1, 1));
    }
    return sd;
  }

  // Parry: a bright, high metallic ring (blade catching blade)
  function genParry() {
    const rate = 22050, dur = 0.30;
    const n = Math.floor(rate * dur);
    const sd = love.sound.newSoundData(n, rate, 16, 1);
    const rng = love.math.newRandomGenerator(3301);
    const partials = [[1240, 16], [1860, 20], [2480, 26], [3320, 34], [4100, 44]];
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      let s = 0;
      for (const pr of partials) s += Math.sin(2 * Math.PI * pr[0] * t) * Math.exp(-t * pr[1]);
      s *= 0.14;
      if (t < 0.008) s += (rng.random() * 2 - 1) * (1 - t / 0.008) * 0.5;
      s *= Math.exp(-t * 5);
      sd.setSample(i, clamp(s, -1, 1));
    }
    return sd;
  }

  // Thunderclap: a sharp crack transient followed by a long, deep rolling rumble
  function genThunder() {
    const rate = 22050, dur = 1.6;
    const n = Math.floor(rate * dur);
    const sd = love.sound.newSoundData(n, rate, 16, 1);
    const rng = love.math.newRandomGenerator(2718);
    let lo = 0, hi = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const white = rng.random() * 2 - 1;
      lo = lo + 0.035 * (white - lo);           // deep rumble body
      hi = hi + 0.55 * (white - hi);            // bright crack/hiss
      const crack = t < 0.05 ? (1 - t / 0.05) : 0;
      const roll = Math.exp(-t * 2.0) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 2.5 * t + 0.5));
      let s = lo * 7.0 * roll + hi * crack * 1.0;
      s += lo * 4.0 * Math.exp(-Math.abs(t - 0.55) * 5) * 0.6;   // a rolling after-peak
      sd.setSample(i, clamp(s, -1, 1));
    }
    return sd;
  }

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

  function drawBackground2(cam) {
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      lg.setColor(0.055 + 0.05 * k, 0.05 + 0.04 * k, 0.085 + 0.055 * k, 1);
      lg.rectangle('fill', 0, VH * k, VW, VH / 16 + 1);
    }
    const par = 0.25;
    let ox = (-cam.x * par) % 340;
    if (ox < 0) ox += 340;
    lg.setColor(0.095, 0.085, 0.135, 1);
    for (let i = -1; i <= 4; i++) {
      const ax = ox + i * 340;
      lg.rectangle('fill', ax, 235, 44, VH);
      lg.rectangle('fill', ax + 296, 235, 44, VH);
      lg.arc('fill', ax + 170, 262, 148, Math.PI, 2 * Math.PI);
    }
    lg.setColor(0.75, 0.45, 0.55, 0.045);
    lg.polygon('fill', 330, 0, 400, 0, 560, VH, 430, VH);
    lg.polygon('fill', 880, 0, 935, 0, 1080, VH, 970, VH);
  }

  function drawPlats() {
    lg.setLineWidth(1);
    for (let pi = 0; pi < plats.length; pi++) {
      const p = plats[pi];
      const seed = (pi + 1) * 733 + 5;
      const rng = love.math.newRandomGenerator(seed);
      if (p.beam) {
        lg.setColor(STONE.mid[0], STONE.mid[1], STONE.mid[2], 1);
        lg.rectangle('fill', p.x, p.y, p.w, p.h);
        lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 1);
        lg.rectangle('fill', p.x, p.y + p.h - 3, p.w, 3);
        lg.setColor(COL.rockLit[0], COL.rockLit[1], COL.rockLit[2], 0.7);
        lg.rectangle('fill', p.x + 1, p.y, p.w - 2, 2);
        if (level === 1) drawGrass(p.x, p.y, p.w, rng);
        else drawFlags(p.x, p.y, p.w, rng);
      } else if (level === 2 || level === 3) {
        drawBrickBody(p, pi + 1);
        if (p.climbL) drawClimbMarks(p, pi + 1);
        lg.setColor(1.0, 0.72, 0.4, level === 3 ? 0.30 * l3.litT : 0.30);
        lg.rectangle('fill', p.x, p.y, p.w, 2);
        if (level === 2 || l3.litT > 0.05) drawFlags(p.x, p.y, p.w, rng);
      } else {
        // extend the pillar far below its collision body so its base is never
        // visibly cut off when the camera drops during a fall (fades to dark)
        lg.setColor(STONE.base[0], STONE.base[1], STONE.base[2], 1);
        lg.rectangle('fill', p.x, p.y + p.h - 2, p.w, 2600);
        lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 0.55);
        lg.rectangle('fill', p.x, p.y + p.h - 2, p.w, 2600);

        rockOutline(p, pi + 1);   // computes p._pts (raw outline)
        lg.setColor(STONE.base[0], STONE.base[1], STONE.base[2], 1);
        lg.polygon('fill', p._pts);   // single simple-polygon fill (no triangle seams)

        const hLim = Math.min(p.h, 820);

        for (let k = 1; k <= 4; k++) {
          const sy = p.y + hLim * (0.30 + k * 0.17);
          if (sy < p.y + p.h) {
            lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 0.17);
            lg.rectangle('fill', p.x, sy, p.w, p.y + p.h - sy);
          }
        }

        const nLayers = Math.max(3, Math.floor(hLim / 110));
        for (let li = 0; li < nLayers; li++) {
          const sy = p.y + 22 + rng.random() * (hLim - 34);
          lg.setColor(0, 0, 0, 0.22);
          lg.rectangle('fill', p.x + 3, sy, p.w - 6, 2);
          lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.12);
          lg.rectangle('fill', p.x + 3, sy - 2, p.w - 6, 2);
        }

        const nBoulders = Math.max(4, Math.floor(p.w * hLim / 22000));
        for (let bi = 0; bi < nBoulders; bi++) {
          const cx = p.x + 12 + rng.random() * (p.w - 24);
          const cy = p.y + 16 + rng.random() * (hLim - 28);
          const r = 8 + rng.random() * 22;
          if (rng.random() < 0.55) lg.setColor(STONE.mid[0], STONE.mid[1], STONE.mid[2], 0.8);
          else lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.16);
          lg.polygon('fill',
            cx - r, cy + r * 0.15, cx - r * 0.35, cy - r * 0.65,
            cx + r * 0.55, cy - r * 0.5, cx + r, cy + r * 0.2,
            cx + r * 0.25, cy + r * 0.6, cx - r * 0.45, cy + r * 0.55);
        }

        lg.setColor(0, 0, 0, 0.32);
        lg.setLineWidth(2);
        const nCracks = Math.max(2, Math.floor(p.w / 100));
        for (let ci = 0; ci < nCracks; ci++) {
          let cx = p.x + 14 + rng.random() * (p.w - 28);
          let cy = p.y + 18 + rng.random() * hLim * 0.6;
          for (let s = 0; s < 3; s++) {
            const nx = cx + (rng.random() - 0.5) * 22;
            const ny = cy + 16 + rng.random() * 30;
            lg.line(cx, cy, nx, ny);
            cx = nx; cy = ny;
          }
        }

        if (p._pts && p._leftI != null) {
          lg.setColor(COL.rockLit[0], COL.rockLit[1], COL.rockLit[2], 0.30);
          lg.setLineWidth(2);
          const pts = p._pts;
          lg.line(pts[pts.length - 2], pts[pts.length - 1], p.x, p.y);
          for (let i = p._leftI; i <= pts.length - 4; i += 2) {
            lg.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
          }
        }

        if (p.climbL) drawClimbMarks(p, pi + 1);

        lg.setColor(COL.rockLit[0], COL.rockLit[1], COL.rockLit[2], 0.6);
        lg.rectangle('fill', p.x, p.y, p.w, 2);

        drawGrass(p.x, p.y, p.w, rng);

        if (p.y < 1050) {
          lg.setColor(COL.snow[0], COL.snow[1], COL.snow[2], 0.9);
          let sx = p.x + 5;
          while (sx < p.x + p.w - 8) {
            const sw2 = 18 + rng.random() * 34;
            lg.rectangle('fill', sx, p.y - 4, Math.min(sw2, p.x + p.w - 5 - sx), 4);
            sx = sx + sw2 + 8 + rng.random() * 22;
          }
        }
      }
    }
    lg.setLineWidth(1);
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

    // ground shadow + soft magic glow beneath the carpet
    lg.setColor(0, 0, 0, 0.22); lg.ellipse('fill', cx, gy + 1, 40 * s, 6 * s);
    lg.setColor(0.55, 0.40, 0.85, 0.12); lg.ellipse('fill', cx, gy - 16 * s, 30 * s, 9 * s);

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

  // -------------------------------------------------------------- PARTICLES
  const windStreaks = [], snowFlakes = [], dusts = [];

  function buildParticles() {
    const rng = love.math.newRandomGenerator(5);
    windStreaks.length = 0; snowFlakes.length = 0;
    for (let i = 0; i < 46; i++) {
      windStreaks.push({ x: rng.random() * VW, y: rng.random() * VH,
        spd: 260 + rng.random() * 420, len: 40 + rng.random() * 90, ph: rng.random() * 6.28 });
    }
    for (let i = 0; i < 70; i++) {
      snowFlakes.push({ x: rng.random() * VW, y: rng.random() * VH,
        spd: 40 + rng.random() * 90, r: 1 + rng.random() * 1.6, ph: rng.random() * 6.28 });
    }
  }

  function spawnDust(x, y, n, pow) {
    for (let i = 0; i < n; i++) {
      dusts.push({ x: x + (love.math.random() - 0.5) * 16, y: y - 3,
        vx: (love.math.random() - 0.5) * 90 * pow - 40,
        vy: -love.math.random() * 70 * pow,
        life: 0.5 + love.math.random() * 0.4, t: 0 });
    }
  }

  function updateParticles(dt) {
    const g = gust();
    for (const s of windStreaks) {
      s.x = s.x - s.spd * (0.5 + 0.8 * g) * dt;
      s.y = s.y + Math.sin(T * 2 + s.ph) * 22 * dt;
      if (s.x < -s.len) { s.x = VW + s.len; s.y = love.math.random() * VH; }
    }
    for (const f of snowFlakes) {
      f.x = f.x - f.spd * (0.8 + g) * dt * 2.2;
      f.y = f.y + (18 + 14 * Math.sin(T + f.ph)) * dt;
      if (f.x < -4) { f.x = VW + 4; f.y = love.math.random() * VH; }
      if (f.y > VH + 4) f.y = -4;
    }
    for (let i = dusts.length - 1; i >= 0; i--) {
      const d = dusts[i];
      d.t += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 60 * dt;
      if (d.t > d.life) dusts.splice(i, 1);
    }
  }

  function drawDusts() {
    for (const d of dusts) {
      const k = 1 - d.t / d.life;
      lg.setColor(0.85, 0.75, 0.66, 0.35 * k);
      lg.circle('fill', d.x, d.y, 2 + (1 - k) * 4);
    }
  }

  function drawScreenParticles(altFade) {
    const g = gust();
    lg.setLineWidth(1.4);
    for (const s of windStreaks) {
      lg.setColor(1, 0.92, 0.82, (0.04 + 0.10 * g));
      lg.line(s.x, s.y, s.x + s.len, s.y - 4);
    }
    for (const f of snowFlakes) {
      lg.setColor(0.95, 0.94, 1.0, 0.32 * altFade);
      lg.circle('fill', f.x, f.y, f.r);
    }
    lg.setLineWidth(1);
  }

  // -------------------------------------------------------------- PLAYER
  let player;

  const ledges = [], faces = [];
  function buildLevel() {
    ledges.length = 0; faces.length = 0;
    for (const p of plats) {
      if (!p.beam) {
        ledges.push({ x: p.x, y: p.y, side: -1 });
        ledges.push({ x: p.x + p.w, y: p.y, side: 1 });
        if (p.climbL) faces.push({ x: p.x, ytop: p.y, ybot: p.y + p.h, side: -1, bot: p.climbBot != null ? p.climbBot : (p.y + p.h) });
        if (p.climbR) faces.push({ x: p.x + p.w, ytop: p.y, ybot: p.y + p.h, side: 1, bot: p.climbBot != null ? p.climbBot : (p.y + p.h) });
      }
    }
  }

  let respawn = { x: checkpoints1[0].x, y: checkpoints1[0].y };

  let scarf = [];
  function resetScarf(x, y) {
    scarf = [];
    for (let i = 0; i < SCARF_N; i++) scarf.push({ x: x, y: y, px: x, py: y });
  }

  function newPlayer(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0, facing: 1,
      state: 'air', t: 0, runPhase: 0,
      coyote: 0, jbuf: 0, regrab: 0,
      onGround: false, onBeam: false,
      ledge: null, face: null,
      mant: null, landT: 0, prevVy: 0,
      deadFade: 0, dying: false,
      hp: 3, inv: 0, atkT: 0, drawT: 0, hasSword: false,
      blockT: 0, riposte: 0, riposteHits: 0, blockFlash: 0,
      iks: { hf: {}, hb: {}, ff: {}, fb: {} },
      iksState: null,
      turnT: 0, turnDur: 0.2, turnFlip: false, climbPh: 0,
      started: false, crouch: false,
    };
  }

  // y of the hero's head/top, accounting for crouch — used by projectile hit
  // tests so ducking actually slips the head under a high attack
  function heroTop(p) { return p.y - (p.crouch ? 34 : 56); }

  function bobOf(p) {
    if (p.state === 'ground') {
      if (p.landT > 0) return 7;
      if (Math.abs(p.vx) > 30) return Math.abs(Math.sin(p.runPhase)) * 2.2;
      return Math.sin(p.t * 1.6);
    }
    return 0;
  }

  function neckPos(p) {
    return [p.x - p.facing * 2, p.y - 49 + bobOf(p)];
  }

  function updateScarf(dt) {
    const p = player;
    const np = neckPos(p);
    const g = gust();
    scarf[0].x = np[0]; scarf[0].y = np[1];
    for (let i = 1; i < scarf.length; i++) {
      const n = scarf[i];
      const vx = (n.x - n.px) * 0.92;
      const vy = (n.y - n.py) * 0.92;
      n.px = n.x; n.py = n.y;
      const ax = -(190 + 190 * g) * (0.6 + 0.4 * Math.sin(T * 6.3 + i)) - p.vx * 0.9;
      const ay = 260 + 60 * Math.sin(T * 4.7 + i * 0.8) - p.vy * 0.35;
      n.x = n.x + vx + ax * dt * dt * 14;
      n.y = n.y + vy + ay * dt * dt * 14;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < scarf.length; i++) {
        const a = scarf[i - 1], b = scarf[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.001) {
          const diff = (d - SCARF_SEG) / d;
          if (i === 1) { b.x = b.x - dx * diff; b.y = b.y - dy * diff; }
          else {
            a.x = a.x + dx * diff * 0.5; a.y = a.y + dy * diff * 0.5;
            b.x = b.x - dx * diff * 0.5; b.y = b.y - dy * diff * 0.5;
          }
        }
      }
    }
    // hard length cap: wind must never stretch the cape long again
    for (let i = 1; i < scarf.length; i++) {
      const a = scarf[i - 1], b = scarf[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > SCARF_SEG) { b.x = a.x + dx / d * SCARF_SEG; b.y = a.y + dy / d * SCARF_SEG; }
    }
  }

  function drawScarf() {
    for (let i = 1; i < scarf.length; i++) {
      const a = scarf[i - 1], b = scarf[i];
      const ratio = (i + 1) / scarf.length;
      const w = 7.2 - ratio * 5.0;
      setColA(mul(COL.scarf, 1.0 - ratio * 0.22), 0.96);
      lg.setLineWidth(w);
      lg.line(a.x, a.y, b.x, b.y);
      lg.circle('fill', b.x, b.y, w * 0.48);
    }
    lg.setLineWidth(1);
  }

  // ---- procedural poses
  function basePose() {
    return { bob: 0, lean: 0,
      armF: [0.14, 0.34], armB: [-0.12, -0.30],
      legF: [0.06, 0.02], legB: [-0.10, -0.16] };
  }
  function mixPose(a, b, k) {
    const o = basePose();
    o.bob = lerp(a.bob, b.bob, k);
    o.lean = lerp(a.lean, b.lean, k);
    for (const key of ['armF', 'armB', 'legF', 'legB']) {
      o[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)];
    }
    return o;
  }
  function poseHang(t) {
    const sw = Math.sin(t * 1.7) * 0.06;
    const o = basePose();
    o.armF = [Math.PI - 0.04, Math.PI - 0.02];
    o.armB = [Math.PI - 0.30, Math.PI - 0.24];
    o.legF = [0.18 + sw, 0.02 + sw];
    o.legB = [-0.06 + sw, -0.34 + sw];
    o.lean = 0.05;
    return o;
  }
  function poseLand() {
    const o = basePose();
    o.bob = 7; o.lean = 0.24;
    o.armF = [0.85, 1.45]; o.armB = [-0.55, 0.05];
    o.legF = [0.50, -0.85]; o.legB = [-0.42, -1.30];
    return o;
  }
  function poseVault() {
    const o = basePose();
    o.bob = 7; o.lean = 0.30;
    o.armF = [1.05, 1.55]; o.armB = [0.55, 1.10];
    o.legF = [0.95, -1.25]; o.legB = [-0.25, -1.05];
    return o;
  }

  function pickHold(F, wantY, loY, hiY) {
    const base = F.ytop + HOLDSTEP;
    let y = base + Math.floor((wantY - base) / HOLDSTEP + 0.5) * HOLDSTEP;
    if (y < loY) y += HOLDSTEP;
    if (y > hiY) y -= HOLDSTEP;
    return clamp(y, base, (F.bot != null ? F.bot : F.ybot));
  }

  function ikTarget(p, key, lx, wy, snap, rate) {
    const s = p.iks[key];
    if (snap || s.wy === undefined) { s.lx = lx; s.wy = wy; }
    else {
      const k = Math.min(1, love.timer.getDelta() * (rate || 14));
      s.lx = s.lx + (lx - s.lx) * k;
      s.wy = s.wy + (wy - s.wy) * k;
    }
    return [s.lx, s.wy - p.y];
  }

  function poseFor(p) {
    const t = p.t;
    let o = basePose();
    if (p.state !== 'climb' && p.state !== 'hang') p.iksState = null;

    if (p.state === 'ground') {
      if (p.landT > 0) return poseLand();
      if (p.crouch) {
        const br = Math.sin(t * 3) * 0.4;
        o.bob = 15 + br;                 // sink the torso down toward the knees
        o.lean = 0.10;
        o.legF = [1.00, -1.30];          // deep knee bend, thighs forward
        o.legB = [-0.98, -1.34];
        const moving = Math.abs(p.vx) > 30;
        if (moving) {                    // low waddle while shuffling crouched
          const s = Math.sin(p.runPhase);
          o.legF[0] += 0.25 * s; o.legB[0] -= 0.25 * s;
        }
        o.armF = [0.55, 1.05];
        o.armB = [-0.35, -0.10];
        return o;
      }
      if ((p.turnT || 0) > 0) {
        const u = 1 - p.turnT / (p.turnDur || 0.2);
        const K1 = { bob: 2.6, lean: 0.0,
          armF: [0.06, 0.18], armB: [-0.06, -0.18], legF: [0.10, -0.06], legB: [-0.10, -0.14] };
        if (u < 0.5) {
          const K0 = { bob: 1.2, lean: -0.24,
            armF: [-0.55, -0.85], armB: [0.62, 1.05], legF: [0.52, 0.30], legB: [-0.34, -0.52] };
          return mixPose(K0, K1, smooth(u / 0.5));
        } else {
          const K2 = { bob: 1.4, lean: 0.20,
            armF: [0.55, 1.00], armB: [-0.50, -0.75], legF: [-0.30, -0.55], legB: [0.48, 0.24] };
          return mixPose(K1, K2, smooth((u - 0.5) / 0.5));
        }
      }
      const spd = Math.abs(p.vx);
      if (spd > 30) {
        const sf = clamp(spd / RUNSPD, 0.35, 1);
        if (p.onBeam) {
          const wob = Math.sin(t * 3.1) * 0.12;
          const s = Math.sin(p.runPhase);
          o.armF = [1.48 + wob, 1.62 + wob];
          o.armB = [-1.48 + wob, -1.62 + wob];
          o.legF = [0.38 * s, 0.38 * s - 0.28];
          o.legB = [-0.38 * s, -0.38 * s - 0.34];
          o.lean = wob * 0.5;
          o.bob = Math.abs(s) * 1.4;
        } else {
          const ph = p.runPhase;
          const sF = Math.sin(ph);
          const sB = Math.sin(ph + Math.PI);
          const kneeF = 0.30 + 0.85 * Math.max(0, Math.sin(ph - 2.1));
          const kneeB = 0.30 + 0.85 * Math.max(0, Math.sin(ph + Math.PI - 2.1));
          o.legF = [0.88 * sF * sf, (0.88 * sF - kneeF) * sf];
          o.legB = [0.88 * sB * sf, (0.88 * sB - kneeB) * sf];
          const aF = -0.60 * sF * sf, aB = -0.60 * sB * sf;
          o.armF = [aF, aF + 1.15 * sf + 0.15];
          o.armB = [aB, aB + 1.15 * sf + 0.15];
          o.lean = (0.16 + 0.05 * Math.abs(sF)) * sf;
          o.bob = Math.abs(Math.cos(ph)) * 2.4 * sf;
        }
      } else {
        const br = Math.sin(t * 1.6);
        const w = Math.sin(t * 0.45);
        o.bob = br;
        o.armF = [0.14 + br * 0.015, 0.36];
        o.armB = [-0.12 - br * 0.015, -0.32];
        o.legF = [0.06 + 0.04 * w, 0.02];
        o.legB = [-0.10 - 0.04 * w, -0.16 - 0.05 * Math.max(0, w)];
        o.lean = 0.03 + 0.02 * w;
      }
    } else if (p.state === 'air') {
      const runJump = clamp((Math.abs(p.vx) - 60) / (RUNSPD - 60), 0, 1);
      if (p.vy < -60) {
        const split = { bob: 0, lean: 0.18,
          armF: [1.05, 1.60], armB: [-1.15, -0.70], legF: [1.05, 0.75], legB: [-0.85, -1.45] };
        const tuck = { bob: 0, lean: 0.10,
          armF: [2.45, 2.85], armB: [-0.95, -0.45], legF: [0.85, -0.55], legB: [-0.45, -1.25] };
        return mixPose(tuck, split, runJump);
      } else {
        const fl = Math.sin(t * 9) * 0.14;
        o.armF = [2.65 + fl, 2.20 + fl]; o.armB = [-2.55 - fl, -2.10 - fl];
        o.legF = [0.55 - 0.25 * runJump, 0.10]; o.legB = [-0.35, -0.90];
        o.lean = 0.08 + 0.08 * runJump;
      }
    } else if (p.state === 'hang') {
      if (p.ledge) {
        const sway = Math.sin(t * 1.7);
        const snap = p.iksState !== 'hang';
        o.ik = {
          hip: [-2.5 + sway * 0.7, -24 + Math.abs(sway) * 0.4],
          ch: [-1.0 + sway * 0.4, -40],
          hf: ikTarget(p, 'hf', 14.2, p.y - 49.5, snap),
          hb: ikTarget(p, 'hb', 11.6, p.y - 47.0, snap),
          ff: ikTarget(p, 'ff', 13.6, p.y - 7, snap),
          fb: ikTarget(p, 'fb', 13.6, p.y - 19, snap),
        };
        p.iksState = 'hang';
      } else {
        return poseHang(t);
      }
    } else if (p.state === 'climb') {
      if (p.face) {
        const F = p.face;
        const snap = p.iksState !== 'climb';
        const iks = p.iks;
        const dir = (p.vy < -8 ? 1 : (p.vy > 8 ? -1 : 0));

        if (snap) {
          iks.hf.holdY = pickHold(F, p.y - 70, p.y - 80, p.y - 46);
          iks.hb.holdY = iks.hf.holdY + HOLDSTEP;
          iks.ff.holdY = pickHold(F, p.y - 14, p.y - 34, p.y - 2);
          iks.fb.holdY = iks.ff.holdY + HOLDSTEP;
          p.climbPh = 0;
        }

        const prevPh = p.climbPh || 0;
        p.climbPh = prevPh + dir * Math.abs(p.vy) * love.timer.getDelta() / (HOLDSTEP * 2);
        const ph = p.climbPh;

        function quarter(x) { return Math.floor(x * 4); }
        if (quarter(ph) !== quarter(prevPh)) {
          let q = ((quarter(ph) % 4) + 4) % 4;
          if (dir < 0) q = (3 - q + 4) % 4;
          const step = dir * HOLDSTEP * 2;
          if (q === 0) iks.hf.holdY = iks.hf.holdY - step;
          else if (q === 1) iks.hb.holdY = iks.hb.holdY - step;
          else if (q === 2) iks.ff.holdY = iks.ff.holdY - step;
          else iks.fb.holdY = iks.fb.holdY - step;
        }

        const sub = (((ph * 4) % 1) + 1) % 1;
        const push = (((quarter(ph) % 4) + 4) % 4 === 3) ? Math.sin(sub * Math.PI) : 0;
        const hug = (((quarter(ph) % 4) + 4) % 4 === 2) ? Math.sin(sub * Math.PI) : 0;

        o.ik = {
          hip: [-1.0 + hug * 1.6 - push * 0.8, -33 - push * 1.5],
          ch: [-0.5 + hug * 1.2 - push * 0.6, -48 - push * 2.2],
          hf: ikTarget(p, 'hf', 15.2, iks.hf.holdY, snap, 22),
          hb: ikTarget(p, 'hb', 13.6, iks.hb.holdY, snap, 22),
          ff: ikTarget(p, 'ff', 14.0 + hug * 1.5, iks.ff.holdY, snap, 19),
          fb: ikTarget(p, 'fb', 13.6, iks.fb.holdY, snap, 19),
        };
        p.iksState = 'climb';
      }
    } else if (p.state === 'mantle') {
      const m = p.mant, L = p.ledge;
      const k = m.t / m.dur;
      if (L && k < 0.44) {
        const u = smooth(k / 0.44);
        const su = smooth(clamp((k - 0.10) / 0.30, 0, 1));
        const fx = p.facing;
        const loc = function (wx) { return (wx - p.x) * fx; };
        o.ik = {
          hip: [0.5 + 2.5 * u, -31 + 3 * u],
          ch: [1.0 + 3.0 * u, -46 + 5 * u],
          hf: [loc(L.x + fx * 2.5), (L.y - 1.5) - p.y],
          hb: [loc(L.x - fx * 1.0), (L.y - 0.2) - p.y],
          ff: [loc(L.x + fx * (0.5 + 7.5 * su)), lerp(p.y - 7, L.y - 1, su) - p.y],
          fb: [loc(L.x + fx * 0.5), (m.sy - 18) - p.y],
        };
        p.iksState = 'mantle';
      } else if (k < 0.64) {
        const w = smooth((k - 0.44) / 0.20);
        return mixPose(poseVault(), poseLand(), w);
      } else if (k < 0.80) {
        return poseLand();
      } else {
        const w = smooth((k - 0.80) / 0.20);
        return mixPose(poseLand(), basePose(), w);
      }
    } else if (p.state === 'cine') {
      const spd = Math.abs(p.vx);
      if (spd > 20) {
        const ph = p.runPhase;
        const s = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
        o.legF = [0.55 * s, 0.55 * s - 0.35];
        o.legB = [0.55 * s2, 0.55 * s2 - 0.40];
        o.armF = [-0.40 * s, -0.40 * s + 0.55];
        o.armB = [-0.40 * s2, -0.40 * s2 + 0.55];
        o.bob = Math.abs(s) * 1.5;
        o.lean = 0.08;
      } else {
        const br = Math.sin(t * 1.2);
        o.bob = br * 0.8;
        o.lean = 0.02;
      }
    }
    return o;
  }

  // ---- body rendering primitives
  function segment(x1, y1, x2, y2, w1, w2, col) {
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.sqrt(dx * dx + dy * dy);
    setColA(col);
    if (d > 0.001) {
      const nx = -dy / d, ny = dx / d;
      lg.polygon('fill',
        x1 + nx * w1, y1 + ny * w1, x2 + nx * w2, y2 + ny * w2,
        x2 - nx * w2, y2 - ny * w2, x1 - nx * w1, y1 - ny * w1);
    }
    lg.circle('fill', x1, y1, w1);
    lg.circle('fill', x2, y2, w2);
  }

  function drawLeg(ox, oy, a1, a2, shade) {
    const k = shade ? 0.66 : 1;
    const kx = ox + Math.sin(a1) * 17, ky = oy + Math.cos(a1) * 17;
    const fx = kx + Math.sin(a2) * 16, fy = ky + Math.cos(a2) * 16;
    segment(ox, oy, kx, ky, 4.8, 3.7, mul(COL.pants, k));
    segment(kx, ky, fx, fy, 3.5, 2.8, mul(COL.pants, k));
    const bx = lerp(kx, fx, 0.45), by = lerp(ky, fy, 0.45);
    segment(bx, by, fx, fy, 3.4, 3.0, mul(COL.boots, k));
    segment(fx - 0.5, fy - 0.6, fx + 5.6, fy - 0.2, 2.8, 1.9, mul(COL.boots, k));
    return [fx, fy];
  }

  function drawArm(ox, oy, a1, a2, shade) {
    const k = shade ? 0.66 : 1;
    const ex = ox + Math.sin(a1) * 14, ey = oy + Math.cos(a1) * 14;
    const hx = ex + Math.sin(a2) * 13, hy = ey + Math.cos(a2) * 13;
    segment(ox, oy, ex, ey, 4.0, 3.2, mul(COL.shirt, k));
    const rx = lerp(ex, hx, 0.32), ry = lerp(ey, hy, 0.32);
    segment(ex, ey, rx, ry, 3.3, 3.1, mul(COL.shirt, k));
    segment(rx, ry, hx, hy, 2.5, 2.1, mul(COL.skin, k));
    return [hx, hy];
  }

  function ik2(ox, oy, tx, ty, l1, l2, mode) {
    const dx = tx - ox, dy = ty - oy;
    let d = Math.sqrt(dx * dx + dy * dy);
    d = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const phi = Math.atan2(dx, dy);
    const cA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const A = Math.acos(cA);
    let best1, best2, bestV;
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const a1 = phi + sgn * A;
      const ex = ox + Math.sin(a1) * l1, ey = oy + Math.cos(a1) * l1;
      const a2 = Math.atan2(tx - ex, ty - ey);
      const v = (mode === 'arm') ? ey : ex;
      if (bestV === undefined || v > bestV) { best1 = a1; best2 = a2; bestV = v; }
    }
    return [best1, best2];
  }

  function drawSwordAt(x, y, a) {
    const bx = Math.sin(a), by = Math.cos(a);
    const px = Math.sin(a + Math.PI / 2), py = Math.cos(a + Math.PI / 2);
    lg.setColor(0.42, 0.32, 0.16, 1);
    lg.setLineWidth(3);
    lg.line(x - bx * 4, y - by * 4, x + bx * 2, y + by * 2);
    lg.setColor(0.55, 0.42, 0.20, 1);
    lg.line(x + bx * 2 - px * 4.5, y + by * 2 - py * 4.5, x + bx * 2 + px * 4.5, y + by * 2 + py * 4.5);
    lg.setColor(0.76, 0.78, 0.84, 1);
    lg.setLineWidth(3.2);
    lg.line(x + bx * 3, y + by * 3, x + bx * 27, y + by * 27);
    lg.setColor(0.95, 0.97, 1.0, 0.85);
    lg.setLineWidth(1.2);
    lg.line(x + bx * 4, y + by * 4 - 0.8, x + bx * 26, y + by * 26 - 0.8);
    lg.setLineWidth(1);
  }

  function drawHeldSword(hx, hy, forearmA) {
    drawSwordAt(hx, hy, forearmA + 0.35);
  }

  // Overhead slash choreography (from the GIF reference). Blade angle uses the
  // body-local sin/cos convention: 0 = straight down, PI/2 = forward, PI = up.
  //   wind-up (raise up & back) → chop down through the front → hold → recover
  function swingBladeAngle(u) {
    if (u < 0.28) return lerp(1.15, 2.72, smooth(u / 0.28));         // raise up & back
    if (u < 0.55) return lerp(2.72, 0.70, smooth((u - 0.28) / 0.27)); // chop through forward
    if (u < 0.66) return 0.70;                                        // hold (down-forward)
    return lerp(0.70, 1.15, smooth((u - 0.66) / 0.34));              // recover to guard
  }

  // Fading crescent motion-trail that follows the blade's swept path.
  function drawSlashTrail(cx, cy, aFrom, aTo, ri, ro, baseAlpha, col) {
    const c = col || [0.97, 0.98, 1.0];
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t1 = (i + 1) / steps;
      const a0 = lerp(aFrom, aTo, i / steps), a1 = lerp(aFrom, aTo, t1);
      lg.setColor(c[0], c[1], c[2], baseAlpha * (0.10 + 0.90 * t1));
      lg.polygon('fill',
        cx + Math.sin(a0) * ri, cy + Math.cos(a0) * ri,
        cx + Math.sin(a0) * ro, cy + Math.cos(a0) * ro,
        cx + Math.sin(a1) * ro, cy + Math.cos(a1) * ro,
        cx + Math.sin(a1) * ri, cy + Math.cos(a1) * ri);
    }
  }

  // Impact starburst at the point of contact.
  function drawStar(x, y, r, alpha) {
    lg.setColor(1.0, 0.95, 0.7, alpha);
    lg.setLineWidth(1.6);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const rr = (k % 2 === 0) ? r : r * 0.55;
      lg.line(x, y, x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    lg.setColor(1.0, 1.0, 0.9, alpha);
    lg.circle('fill', x, y, r * 0.22);
    lg.setLineWidth(1);
  }

  function drawHero(p) {
    let o = poseFor(p);
    if ((p.inv || 0) > 0 && !p.dying && Math.floor(T * 14) % 2 === 0) return;

    // -------------------------------------------------------------------
    //  SWORD LUNGE — Prince-of-Persia-flavored fencing (procedural):
    //    anticipation (coil back)  →  committed lunge/thrust (front leg
    //    drives forward, back leg extends, torso commits along the blade)
    //    →  held extension that "reads" the hit  →  weighted recovery to
    //    the en-garde guard. Timing preserved (ATK_DUR) so L2 hits line up.
    // -------------------------------------------------------------------
    const GUARD_A = 1.15;   // blade angle at rest guard (forward, slightly down)
    const ground = (p.state === 'ground');
    if ((p.atkT || 0) > 0 && (p.state === 'ground' || p.state === 'air')) {
      const u = 1 - p.atkT / ATK_DUR;
      const bladeA = swingBladeAngle(u);
      // the arm follows the blade; the forearm carries it, the shoulder trails
      o.armF = [bladeA - 0.50, bladeA - 0.35];
      let lean, bob;
      if (u < 0.28) {                 // wind-up: rise, weight back
        const k = smooth(u / 0.28); lean = lerp(0.05, -0.14, k); bob = lerp(0, -1.2, k);
      } else if (u < 0.55) {          // chop: drop and drive forward
        const k = smooth((u - 0.28) / 0.27); lean = lerp(-0.14, 0.30, k); bob = lerp(-1.2, 3.6, k);
      } else if (u < 0.66) {          // contact hold
        lean = 0.30; bob = 3.6;
      } else {                        // recovery to guard
        const k = smooth((u - 0.66) / 0.34); lean = lerp(0.30, 0.05, k); bob = lerp(3.6, 0, k);
      }
      o.armB = [-0.30 - Math.max(0, lean) * 0.5, -0.54 - Math.max(0, lean) * 0.7];
      o.lean = lean;
      o.bob = (o.bob || 0) + bob;
      if (ground) {                    // GROUND ONLY: dramatic deep-lunge stance
        let lk;
        if (u < 0.28) lk = smooth(u / 0.28) * 0.35;
        else if (u < 0.55) lk = lerp(0.35, 1.0, smooth((u - 0.28) / 0.27));
        else if (u < 0.66) lk = 1.0;
        else lk = lerp(1.0, 0, smooth((u - 0.66) / 0.34));
        o.legF = [lerp(0.06, 0.98, lk), lerp(0.02, 0.34, lk)];    // front leg lunges out
        o.legB = [lerp(-0.10, -0.88, lk), lerp(-0.16, -1.18, lk)]; // back leg drives straight
        o.bob = (o.bob || 0) + lk * 1.8;                          // sink into the lunge
        o.lean = o.lean + lk * 0.06;
      }
    } else if ((p.drawT || 0) > 0) {
      const k = smooth(1 - p.drawT / DRAW_DUR);
      o.armF = [lerp(-0.95, 0.12, k), lerp(1.35, 0.72, k)];
      o.armB = [lerp(0.45, -0.30, k), lerp(0.80, -0.55, k)];
      o.lean = (o.lean || 0) - 0.10 * (1 - k);
    } else if ((p.blockT || 0) > 0) {
      // BLOCK / PARRY: the blade sweeps up to a high-forward deflect, braced wide
      const set = smooth(Math.min(1, (BLOCK_DUR - p.blockT) / 0.10));
      o.armF = [lerp(GUARD_A - 0.50, 1.70, set), lerp(GUARD_A - 0.35, 1.95, set)];
      o.armB = [-0.15, -0.45];
      o.lean = -0.05;
      if (ground) { o.legF = [0.34, 0.06]; o.legB = [-0.34, -0.30]; }
    } else if (p.hasSword && p.state === 'ground' && Math.abs(p.vx) < 30) {
      // en-garde guard: blade held ready down-forward, subtle breathing
      const br = Math.sin(p.t * 1.6) * 0.02;
      o.armF = [GUARD_A - 0.50, GUARD_A - 0.35 + br];
      o.armB = [-0.30, -0.52];
      o.lean = 0.06;
    }

    if (p.onGround) {
      lg.setColor(0, 0, 0, 0.22);
      lg.ellipse('fill', p.x, p.y + 2, 16, 4);
    }

    lg.push();
    lg.translate(p.x, p.y);
    lg.scale(p.facing, 1);

    let hipX = o.lean * 3, hipY = -33 + o.bob;
    let chX = o.lean * 8, chY = -49 + o.bob;

    if (o.ik) {
      hipX = o.ik.hip[0]; hipY = o.ik.hip[1];
      chX = o.ik.ch[0]; chY = o.ik.ch[1];
      o.legB = ik2(hipX, hipY, o.ik.fb[0], o.ik.fb[1], 17, 16, 'leg');
      o.legF = ik2(hipX, hipY, o.ik.ff[0], o.ik.ff[1], 17, 16, 'leg');
      o.armB = ik2(chX, chY, o.ik.hb[0], o.ik.hb[1], 14, 13, 'arm');
      o.armF = ik2(chX, chY, o.ik.hf[0], o.ik.hf[1], 14, 13, 'arm');
    }

    drawLeg(hipX, hipY, o.legB[0], o.legB[1], true);
    drawArm(chX, chY, o.armB[0], o.armB[1], true);

    setColA(COL.shirt);
    lg.polygon('fill',
      hipX - 5.6, hipY + 1.5, hipX + 5.6, hipY + 1.5,
      chX + 7.2, chY - 2.0, chX - 7.2, chY - 2.0);
    lg.circle('fill', chX, chY - 1.5, 6.8);

    setColA(mul(COL.vest, 0.92));
    lg.polygon('fill',
      chX - 7.2, chY - 2.5, chX - 2.2, chY - 3.5,
      hipX - 1.4, hipY - 0.5, hipX - 5.6, hipY + 1.0);
    lg.circle('fill', chX - 3.4, chY - 5.2, 4.4);
    setColA(mul(COL.vest, 0.70));
    lg.setLineWidth(2.2);
    lg.line(chX + 4.6, chY - 5.5, hipX + 2.2, hipY - 0.5);

    setColA(COL.belt);
    lg.setLineWidth(4);
    lg.line(hipX - 5.8, hipY - 0.5, hipX + 5.8, hipY - 0.5);
    setColA(COL.shirt, 0.9);
    lg.rectangle('fill', hipX - 1.4, hipY - 2.2, 2.8, 3.4);

    const hX = chX + o.lean * 4, hY = chY - 9.5;
    segment(chX, chY - 4, hX, hY + 3, 2.6, 2.2, COL.skin);
    setColA(COL.skin);
    lg.circle('fill', hX, hY, 6.2);
    lg.polygon('fill', hX + 2.5, hY + 1.0, hX + 6.2, hY + 1.8, hX + 3.0, hY + 4.4);
    setColA(COL.hair, 0.9);
    lg.circle('fill', hX + 3.4, hY - 0.6, 0.9);

    const g = gust();
    setColA(COL.hair);
    lg.circle('fill', hX - 1.4, hY - 2.8, 6.0);
    lg.circle('fill', hX + 2.4, hY - 4.2, 3.8);
    lg.polygon('fill',
      hX - 5.6, hY - 3.5, hX - 7.0, hY + 2.5, hX - 3.2, hY + 3.0, hX - 2.0, hY - 1.0);
    lg.setLineWidth(2.4);
    for (let i = 0; i <= 2; i++) {
      const wob = Math.sin(T * 7 + i * 1.9) * 2.4 * (0.5 + g);
      lg.line(hX - 4 - i * 1.4, hY - 3.5 + i * 1.2,
              hX - 9 - i * 2.4 - g * 3.5, hY - 4.0 + i * 2.2 + wob);
    }

    drawLeg(hipX, hipY, o.legF[0], o.legF[1], false);
    const hf = drawArm(chX, chY, o.armF[0], o.armF[1], false);
    if (p.hasSword && (p.drawT || 0) <= DRAW_DUR * 0.45) {
      const au = (p.atkT || 0) > 0 ? (1 - p.atkT / ATK_DUR) : null;
      const empowered = (p.riposte || 0) > 0 && (p.riposteHits || 0) > 0;
      if (au !== null && au > 0.24 && au < 0.66) {
        // big over-the-top sweeping motion-trail; gold when empowered
        const aNow = swingBladeAngle(au);
        const aPrev = swingBladeAngle(Math.max(0.20, au - 0.32));   // long wrap-around tail
        const fade = clamp((0.66 - au) / 0.20, 0.4, 1);
        const col = empowered ? [1.0, 0.86, 0.45] : [0.97, 0.98, 1.0];
        drawSlashTrail(chX, chY, aPrev, aNow, 14, 66, (empowered ? 0.55 : 0.42) * fade, col);
      }
      if (empowered) {   // charged-riposte glow on the blade hand
        lg.setColor(1.0, 0.85, 0.4, 0.22 + 0.1 * Math.sin(T * 12));
        lg.circle('fill', hf[0], hf[1], 5);
      }
      drawHeldSword(hf[0], hf[1], o.armF[1]);
      if ((p.blockT || 0) > 0 && (p.blockFlash || 0) <= 0) {
        // faint shield guard held in front while blocking (before any impact)
        const bp = 0.5 + 0.5 * Math.sin(T * 10);
        lg.setColor(0.7, 0.85, 1.0, 0.16 + 0.10 * bp);
        lg.setLineWidth(1.6);
        lg.circle('line', 12, -30, 11);
        lg.setLineWidth(1);
      }
      if (au !== null && au > 0.34 && au < 0.52) {
        // impact starburst at the blade tip on the (horizontal) contact frame
        const bladeA = o.armF[1] + 0.35;
        const tipX = hf[0] + Math.sin(bladeA) * 27;
        const tipY = hf[1] + Math.cos(bladeA) * 27;
        const sa = Math.sin((au - 0.34) / 0.18 * Math.PI);
        drawStar(tipX, tipY, (empowered ? 10 : 7) + sa * 3, 0.72 * sa);
      }
      if ((p.blockFlash || 0) > 0) {
        // successful-parry shield burst in front of the chest
        const bf = p.blockFlash / 0.25;
        const fx = 12, fy = -30, rr = 10 + (1 - bf) * 8;
        lg.setColor(0.7, 0.88, 1.0, 0.5 * bf);
        lg.setLineWidth(2.2);
        lg.circle('line', fx, fy, rr);
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3 + T * 6;
          lg.line(fx + Math.cos(a) * rr * 0.4, fy + Math.sin(a) * rr * 0.4, fx + Math.cos(a) * rr, fy + Math.sin(a) * rr);
        }
        lg.setLineWidth(1);
        drawStar(fx, fy, 8 * bf + 3, 0.7 * bf);
      }
    }

    lg.pop();
    lg.setLineWidth(1);
  }

  // -------------------------------------------------------------- PHYSICS
  function overlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
  }

  function moveAndCollide(p, dt) {
    p.x = p.x + p.vx * dt;
    for (const q of plats) {
      if (!q.beam) {
        if (overlap(p.x - 12, p.y - 56, p.x + 12, p.y - 2, q.x, q.y, q.x + q.w, q.y + q.h)) {
          if (p.vx > 0) p.x = q.x - 12;
          else if (p.vx < 0) p.x = q.x + q.w + 12;
          p.vx = 0;
        }
      }
    }
    // closed portcullis gates (Level 2 / 3) block horizontally — they span floor
    // to ceiling, so a full-height solid is enough to bar the way
    const gateSet = level === 2 ? l2.gates : (level === 3 ? l3.gates : null);
    if (gateSet) {
      for (const g of gateSet) {
        if ((g.openT || 0) > 0.82) continue;   // raised enough to walk under
        if (overlap(p.x - 12, p.y - 56, p.x + 12, p.y - 2, g.x, g.yTop, g.x + g.w, g.yBot)) {
          if (p.vx >= 0) p.x = g.x - 12; else p.x = g.x + g.w + 12;
          p.vx = 0;
        }
      }
    }
    const prevBottom = p.y;
    p.y = p.y + p.vy * dt;
    p.onGround = false;
    p.onBeam = false;
    for (const q of plats) {
      if (q.beam) {
        if (p.vy >= 0 && prevBottom <= q.y + 2 && p.y >= q.y
          && p.x + 10 > q.x && p.x - 10 < q.x + q.w) {
          p.y = q.y; p.vy = 0; p.onGround = true; p.onBeam = true;
        }
      } else {
        // the witch's lightning shatters a hole in the saloon floor — the hero
        // drops straight through it (no landing on the broken span)
        if (holeAt(p.x) && q.y <= FLOOR3 + 2 && q.y >= FLOOR3 - 2) continue;
        if (overlap(p.x - 12, p.y - 56, p.x + 12, p.y, q.x, q.y, q.x + q.w, q.y + q.h)) {
          if (p.vy > 0 && prevBottom <= q.y + 12) { p.y = q.y; p.vy = 0; p.onGround = true; }
          else if (p.vy < 0) { p.y = q.y + q.h + 56; p.vy = 0; }
        }
      }
    }
    // the chain lift is a moving one-way platform you ride up the shaft; the
    // generous top margin keeps the hero glued to it as it climbs
    if (level === 2 && l2.lift) {
      const L = l2.lift;
      if (p.vy >= 0 && p.x + 10 > L.x && p.x - 10 < L.x + L.w
        && prevBottom <= L.y + 16 && p.y >= L.y - 2) {
        p.y = L.y; p.vy = 0; p.onGround = true; p.onBeam = true;
      }
    }
  }

  function keyLeft() { return love.keyboard.isDown('left', 'a'); }
  function keyRight() { return love.keyboard.isDown('right', 'd'); }
  function keyUp() { return love.keyboard.isDown('up', 'w'); }
  function keyDown() { return love.keyboard.isDown('down', 's'); }

  function tryGrabLedge(p) {
    if (p.regrab > 0 || p.vy < -140) return;
    if (keyDown()) return;
    const hy = p.y - 50;
    const left = keyLeft(), right = keyRight();
    for (const L of ledges) {
      if (Math.abs(L.y - hy) < 22) {
        if (L.side === -1 && !left && p.x < L.x + 4 && L.x - p.x < 26) {
          p.state = 'hang'; p.ledge = L; p.facing = 1;
          p.x = L.x - 13; p.y = L.y + 48;
          p.vx = 0; p.vy = 0; p.t = 0;
          return;
        } else if (L.side === 1 && !right && p.x > L.x - 4 && p.x - L.x < 26) {
          p.state = 'hang'; p.ledge = L; p.facing = -1;
          p.x = L.x + 13; p.y = L.y + 48;
          p.vx = 0; p.vy = 0; p.t = 0;
          return;
        }
      }
    }
  }

  function tryGrabWall(p) {
    if (p.regrab > 0) return;
    const left = keyLeft(), right = keyRight(), up = keyUp(), down = keyDown();
    for (const F of faces) {
      const midY = p.y - 28;
      const bot = F.bot != null ? F.bot : F.ybot;
      if (midY > F.ytop + 10 && midY < bot + 34) {
        let dist, toward;
        if (F.side === -1) { dist = Math.abs((p.x + 12) - F.x); toward = right; }
        else { dist = Math.abs((p.x - 12) - F.x); toward = left; }
        if (((up || down) && dist < 38) || (toward && dist < 10 && p.state === 'air')) {
          p.state = 'climb'; p.face = F; p.facing = -F.side;
          p.x = F.x + F.side * 12.5;
          p.vx = 0; p.vy = 0; p.t = 0;
          return;
        }
      }
    }
  }

  function startMantle(p) {
    const L = p.ledge;
    p.state = 'mantle';
    p.mant = { sx: p.x, sy: p.y,
      tx: L.x + (L.side === -1 ? 15 : -15), ty: L.y,
      t: 0, dur: 0.95 };
    p.t = 0;
  }

  // -------------------------------------------------------------- CAMERA / CINE
  const cam = { x: 0, y: 0, zoom: 1 };
  const cine = { on: false, stage: 0, t: 0, titleA: 0, subA: 0, boxA: 0, hintA: 0 };
  let introT = 0;
  let FONT_HUD, FONT_LOC, FONT_TITLE, FONT_SUB;

  // studio "presents" card shown once at boot, then a bottom-left author credit
  // as the mountains scene opens
  const STUDIO_DUR = 6.0;
  const studio = { active: false, t: 0 };
  let showCredit = false;
  let DEBUG = false;   // enabled by ?debug=… — unlocks number-key level switching

  function startCine(p) {
    cine.on = true; cine.stage = 1; cine.t = 0;
    p.state = 'cine'; p.vx = 0; p.vy = 0;
  }

  function updateCine(dt, p) {
    cine.t = cine.t + dt;
    cine.boxA = Math.min(1, cine.boxA + dt * 0.8);
    if (cine.stage === 1) {
      p.facing = 1;
      p.vx = 128;
      p.x = p.x + p.vx * dt;
      p.runPhase = p.runPhase + dt * 6.5;
      if (p.x >= CINE_STOP_X) { p.x = CINE_STOP_X; p.vx = 0; cine.stage = 2; cine.t = 0; }
    } else if (cine.stage === 2) {
      p.vx = 0;
      if (cine.t > 1.3) { cine.stage = 3; cine.t = 0; musicSrc.play(); }
    } else if (cine.stage === 3) {
      if (cine.t > 0.9) cine.titleA = Math.min(1, cine.titleA + dt / 3.2);
      if (cine.titleA >= 1 && cine.t > 5.0) { cine.stage = 4; cine.t = 0; }
    } else if (cine.stage === 4) {
      cine.subA = Math.min(1, cine.subA + dt / 1.6);
      if (cine.t > 2.2) cine.hintA = Math.min(1, cine.hintA + dt / 1.6);
    }
  }

  function updateCamera(dt, p) {
    let tx, ty, tz;
    if (cine.on && cine.stage >= 2) { tx = CASTLE_X - 110; ty = PROM_Y - 238; tz = 0.82; }
    else if (cine.on) { tx = p.x + 180; ty = p.y - 170; tz = 0.94; }
    else { tx = p.x + p.facing * 70; ty = p.y - 130; tz = 1; }
    const k = Math.min(1, dt * (cine.on ? 1.1 : 3.4));
    cam.x = lerp(cam.x, tx, k);
    cam.y = lerp(cam.y, ty, k);
    cam.zoom = lerp(cam.zoom, tz, Math.min(1, dt * 0.9));
  }

  // -------------------------------------------------------------- PLAYER UPDATE
  function killPlayer(p) { if (!p.dying) { p.dying = true; p.deadFade = 0; } }

  function respawnPlayer(p) {
    p.x = respawn.x; p.y = respawn.y;
    p.vx = 0; p.vy = 0;
    p.state = 'ground'; p.onGround = true; p.coyote = COYOTE; p.t = 0;
    p.ledge = null; p.face = null; p.mant = null;
    p.hp = 3; p.inv = 1.2; p.atkT = 0; p.drawT = 0;
    p.blockT = 0; p.riposte = 0; p.riposteHits = 0;
    resetScarf(...neckPos(p));
  }

  // -------------------------------------------------------------- LEVEL 2 ENTITIES
  const l2 = { skels: [], biters: [], gates: [], rope: null, rbutton: null, key: null,
    lift: null, lives: 3, gameOver: false,
    doorOpen: false, doorOpenT: 0, endStage: 0, doorHinted: false,
    trap: null, button: null, sword: null, msg: '', msgT: 0, endT: 0 };
  function l2toast(s) { l2.msg = s; l2.msgT = 3; }

  // Attempt to parry an incoming blow coming from direction `dir` (the way it
  // would knock the player). Succeeds if blocking and facing the attacker.
  function tryParry(p, dir) {
    if ((p.blockT || 0) > 0 && p.facing === -dir && !p.dying) {
      p.riposte = RIPOSTE_WIN; p.riposteHits = 2; p.blockFlash = 0.25;
      p.vx = -dir * 50;
      if (sfxParry) sfxParry.play(0.55, 1.0 + love.math.random() * 0.12);
      spawnDust(p.x + dir * 10, p.y - 30, 6, 0.8);
      l2toast('Parried!  Riposte — double strike');
      return true;
    }
    return false;
  }

  function hurtPlayer(p, dir) {
    if ((p.inv || 0) > 0 || p.dying) return;
    p.hp = (p.hp || 3) - 1;
    p.inv = 1.1;
    p.vx = dir * 240;
    p.vy = -180;
    p.state = 'air'; p.t = 0;
    if (p.hp <= 0) killPlayer(p);
  }

  function floorAt(x, y) {
    let best;
    for (const p of plats) {
      if (!p.beam && x >= p.x && x <= p.x + p.w && p.y >= y - 8) {
        if (holeAt(x) && p.y <= FLOOR3 + 2 && p.y >= FLOOR3 - 2) continue;
        if (best === undefined || p.y < best) best = p.y;
      }
    }
    return best;
  }

  function newSkel(x, x0, x1, armed) {
    return { x: x, y: 0, vx: 0, vy: 0, dir: 1, t: 0, cool: 0,
      x0: x0, x1: x1, state: 'patrol', armed: armed, phase: love.math.random() * 6 };
  }

  // Flying severed head — pale human face, green hair — that swoops in to bite.
  function newBiter(x, y) {
    return { hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, t: 0, cool: 0,
      phase: love.math.random() * 6.28, state: 'hover', bite: 0, hurt: 0, dead: 0 };
  }

  function initEnts2() {
    l2.skels = [
      newSkel(2330, 2170, 2470, true),
      newSkel(3050, 2880, 3300, true),
      newSkel(3700, 3560, 3960, true),
      newSkel(4520, 4300, 4900, true),   // rope hall
      newSkel(5180, 5040, 5420, true),   // key hall
      newSkel(5560, 5420, 5700, true),   // key hall
      newSkel(6060, 5820, 6320, true),   // final approach
      newSkel(6360, 6120, 6560, true),   // final approach
    ];
    for (const s of l2.skels) s.y = floorAt(s.x, 0) || 744;
    // the rope-hall skeleton demonstrates the plate: it patrols onto the plate
    // and waits there (see updateEnts2), showing the weight drop / gate open
    l2.plateSkel = l2.skels[3];
    l2.plateSkel.x0 = 4470; l2.plateSkel.x1 = 4770;   // patrol tightened around the plate (4620)
    l2.plateSkel.x = 4720;
    l2.plateDemoDone = false;
    l2.biters = [
      newBiter(4680, 300),   // rope hall
      newBiter(5220, 640),   // key vault (basement) — guard the descent
      newBiter(5470, 560),   // key vault (basement)
      newBiter(5620, 700),   // key vault (basement) — guards the key
      newBiter(5980, 288),   // final approach
      newBiter(6340, 300),   // final approach
    ];
    l2.trap = { x: 2360, y0: 452, y: 452, w: 66, h: 42, state: 'armed', t: 0 };
    l2.button = { x: 2170, y: 744, w: 44, pressed: false };
    l2.sword = null;

    // --- rope-cut puzzle: a weight hangs over a button; cut the rope, the weight
    //     drops onto the button, gate A opens. (cleat on the left, pulley above.)
    l2.gates = [
      { id: 'A', x: 4960, w: 18, yTop: 150, yBot: 384, open: false, openT: 0, locked: false, hinted: false },
      { id: 'B', x: 5720, w: 18, yTop: 150, yBot: 384, open: false, openT: 0, locked: true, hinted: false },
    ];
    l2.rbutton = { x: 4620, y: 384, w: 44, pressed: false };
    l2.rope = { x: 4620, pulleyY: 176, cleatX: 4470, cleatY: 356, cut: false, hinted: false,
      weight: { x: 4620, y: 250, restY: 250, s: 26, falling: false, landed: false } };

    // --- key puzzle: the key is hidden in the basement; drop through the hole,
    //     beat the flying heads, grab it, then ride the chain lift back up and
    //     use it on locked gate B.
    l2.key = { x: 5580, y: 878, floorY: 900, taken: false, used: false };
    // chain lift oscillating in the shaft; its right edge is flush with the
    // upper-right walkway (5520) so you step straight off at the top
    l2.lift = { x: 5370, w: 150, y: 896, yTop: 384, yBot: 896, dir: -1, spd: 130 };

    l2.lives = 3; l2.gameOver = false;
    l2.doorOpen = false; l2.doorOpenT = 0; l2.endStage = 0; l2.doorHinted = false;
    l2.msg = ''; l2.msgT = 0; l2.endT = 0;
  }

  const END_DOOR_X = 6585;   // centre of the exit door at the far end of the keep

  function updateSkel(sk, dt, p) {
    sk.t = sk.t + dt;
    if (sk.state === 'gone' || sk.state === 'pile') return;
    const g = floorAt(sk.x, sk.y);
    if (sk.state === 'fall' || g === undefined) {
      sk.state = 'fall';
      sk.vy = sk.vy + GRAV * dt;
      sk.y = sk.y + sk.vy * dt;
      sk.x = sk.x + sk.vx * dt;
      if (sk.y > respawn.y + 900) sk.state = 'gone';
      return;
    }
    sk.y = g;
    const dx = p.x - sk.x;
    const dy = p.y - sk.y;
    const near = Math.abs(dx) < 170 && Math.abs(dy) < 70 && !p.dying;
    if (sk.state === 'stun') {
      sk.x = sk.x + sk.vx * dt;
      sk.vx = sk.vx * (1 - Math.min(1, dt * 6));
      if (floorAt(sk.x, sk.y) === undefined) { sk.state = 'fall'; return; }
      if (sk.t > 0.55) { sk.state = 'patrol'; sk.t = 0; }
    } else if (sk.state === 'windup') {
      sk.dir = dx >= 0 ? 1 : -1;
      if (sk.t > 0.38) {
        sk.state = 'strike'; sk.t = 0;
        if (Math.abs(dx) < 52 && Math.abs(dy) < 56) {
          if (tryParry(p, sk.dir)) { sk.state = 'stun'; sk.t = 0; sk.vx = -sk.dir * 220; }
          else hurtPlayer(p, sk.dir);
        }
      }
    } else if (sk.state === 'strike') {
      if (sk.t > 0.22) { sk.state = 'patrol'; sk.t = 0; sk.cool = 0.6; }
    } else {
      sk.cool = Math.max(0, (sk.cool || 0) - dt);
      if (near && sk.armed) {
        sk.dir = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 46 && sk.cool <= 0) { sk.state = 'windup'; sk.t = 0; }
        else if (Math.abs(dx) > 40) {
          const nx = sk.x + sk.dir * 62 * dt;
          if (floorAt(nx + sk.dir * 12, sk.y) !== undefined) sk.x = nx;
        }
      } else {
        sk.x = sk.x + sk.dir * 34 * dt;
        if (sk.x < sk.x0) sk.dir = 1; else if (sk.x > sk.x1) sk.dir = -1;
        if (floorAt(sk.x + sk.dir * 14, sk.y) === undefined) sk.dir = -sk.dir;
      }
    }
  }

  function updateBiter(bt, dt, p) {
    bt.t = bt.t + dt;
    bt.cool = Math.max(0, bt.cool - dt);
    bt.bite = Math.max(0, bt.bite - dt);
    bt.hurt = Math.max(0, bt.hurt - dt);
    if (bt.state === 'dead') { bt.dead = bt.dead + dt; return; }
    const bob = Math.sin(bt.t * 2.2 + bt.phase) * 9;
    const aimX = p.x, aimY = p.y - 34;
    const dx = aimX - bt.x, dy = aimY - bt.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const aggro = !p.dying && dist < 230;
    if (bt.state === 'hover') {
      const tx = bt.hx, ty = bt.hy + bob;
      bt.vx = lerp(bt.vx, (tx - bt.x) * 2.2, Math.min(1, dt * 3));
      bt.vy = lerp(bt.vy, (ty - bt.y) * 2.2, Math.min(1, dt * 3));
      if (aggro && bt.cool <= 0) bt.state = 'chase';
    } else {  // chase — swoop straight at the hero's head
      const sp = 172;
      bt.vx = lerp(bt.vx, (dx / dist) * sp, Math.min(1, dt * 2.6));
      bt.vy = lerp(bt.vy, (dy / dist) * sp, Math.min(1, dt * 2.6));
      if (dist > 330 || p.dying) bt.state = 'hover';
    }
    bt.x = bt.x + bt.vx * dt;
    bt.y = bt.y + bt.vy * dt;
    // bite on contact
    if (dist < 26 && bt.cool <= 0 && bt.bite <= 0) {
      bt.bite = 0.35; bt.cool = 1.1;
      const away = (bt.x <= p.x) ? 1 : -1;   // push the hero away from the head
      if ((p.blockT || 0) > 0 && p.facing === -away && !p.dying) {
        bt.vx = -away * 320; bt.vy = -90; bt.hurt = 0.25; bt.state = 'hover';
        if (sfxParry) sfxParry.play(0.4, 1.2 + love.math.random() * 0.1);
        spawnDust(bt.x, bt.y, 4, 0.7);
      } else {
        hurtPlayer(p, away);
        bt.vx = -away * 220; bt.vy = -60; bt.hurt = 0.15;
        if (sfxHit) sfxHit.play(0.42, 1.15);
      }
    }
  }

  function updateEnts2(dt) {
    const p = player;
    const b = l2.button, tr = l2.trap;
    if (b && tr) {
      const playerOn = p.onGround && Math.abs(p.x - b.x) < b.w * 0.5 + 8 && Math.abs(p.y - b.y) < 6;
      // a patrolling skeleton stepping on the button also drops the crate —
      // a live demonstration of what the button does
      let skelOnBtn = false;
      for (const sk of l2.skels) {
        if (sk.state !== 'pile' && sk.state !== 'gone' && sk.state !== 'fall'
          && Math.abs(sk.x - b.x) < b.w * 0.5 + 12 && Math.abs(sk.y - b.y) < 12) { skelOnBtn = true; break; }
      }
      const on = playerOn || skelOnBtn;
      if (on && !b.pressed && tr.state === 'armed') { b.pressed = true; tr.state = 'falling'; tr.t = 0; }
      if (tr.state === 'armed') b.pressed = on;
    }
    if (tr.state === 'falling') {
      tr.t = tr.t + dt;
      tr.y = tr.y + 1500 * tr.t * dt;
      const floorY = 744;
      if (tr.y + tr.h >= floorY) {
        tr.y = floorY - tr.h;
        tr.state = 'landed'; tr.t = 0;
        spawnDust(tr.x, floorY, 8, 1.2);
        for (const sk of l2.skels) {
          if (sk.state !== 'pile' && sk.state !== 'gone'
            && Math.abs(sk.x - tr.x) < 52 && Math.abs(sk.y - floorY) < 10) {
            sk.state = 'pile'; sk.armed = false;
            l2.sword = { x: sk.x + 34, y: floorY, taken: false };
            l2toast('The skeleton collapsed — take its sword');
          }
        }
      }
    } else if (tr.state === 'landed') {
      tr.t = tr.t + dt;
      if (!l2.sword && tr.t > 3.0) {
        tr.y = tr.y - 160 * dt;
        if (tr.y <= tr.y0) { tr.y = tr.y0; tr.state = 'armed'; b.pressed = false; }
      }
    }
    if (l2.sword && !l2.sword.taken) {
      if (Math.abs(p.x - l2.sword.x) < 22 && Math.abs(p.y - l2.sword.y) < 30) {
        l2.sword.taken = true;
        p.hasSword = true;
        p.drawT = DRAW_DUR;
        l2toast('Sword:  X strike  ·  C block (parry → riposte)');
      }
    }
    for (const sk of l2.skels) updateSkel(sk, dt, p);
    for (const bt of l2.biters) updateBiter(bt, dt, p);
    const au = 1 - (p.atkT || 0) / ATK_DUR;
    if ((p.atkT || 0) > 0 && au > 0.30 && au < 0.56) {
      const empowered = (p.riposte || 0) > 0 && (p.riposteHits || 0) > 0;
      let didHit = false;
      // a sword swing near the rope cleat cuts the line and drops the weight
      if (l2.rope && !l2.rope.cut) {
        const rdx = l2.rope.cleatX - p.x;
        if (rdx * p.facing > 0 && Math.abs(rdx) < 60 && Math.abs(p.y - l2.rope.cleatY) < 90) {
          l2.rope.cut = true;
          l2.rope.weight.falling = true;
          if (sfxSwing) sfxSwing.play(0.4, 0.8);
          spawnDust(l2.rope.cleatX, l2.rope.cleatY, 4, 0.7);
          l2toast('The rope snaps!');
        }
      }
      for (const bt of l2.biters) {
        if (bt.state === 'dead') continue;
        const dx = bt.x - p.x;
        if (dx * p.facing > 0 && Math.abs(dx) < 56 && Math.abs(bt.y - (p.y - 30)) < 52) {
          bt.state = 'dead'; bt.dead = 0;
          spawnDust(bt.x, bt.y, 7, 1.0);
          didHit = true;
        }
      }
      for (const sk of l2.skels) {
        if (sk.state !== 'pile' && sk.state !== 'gone' && sk.state !== 'fall' && sk.state !== 'stun') {
          const dx = sk.x - p.x;
          if (dx * p.facing > 0 && Math.abs(dx) < 52 && Math.abs(sk.y - p.y) < 60) {
            sk.state = 'stun'; sk.t = 0;
            sk.vx = p.facing * (empowered ? 540 : 260);   // riposte = double knockback
            didHit = true;
            spawnDust(sk.x - p.facing * 8, sk.y - 34, empowered ? 9 : 4, empowered ? 1.3 : 0.8);
          }
        }
      }
      if (didHit && !l2._hitThisSwing) {
        if (sfxHit) sfxHit.play(empowered ? 0.6 : 0.5, empowered ? 0.8 : (0.9 + love.math.random() * 0.18));
        if (empowered) p.riposteHits = Math.max(0, p.riposteHits - 1);
        l2._hitThisSwing = true;
      }
    }
    if ((p.atkT || 0) <= 0) l2._hitThisSwing = false;

    // --- weight/plate puzzle: gate A is held open ONLY while the plate is
    //     pressed. Standing on it opens the gate but it slams shut the moment
    //     you step off (you can't reach the gate in time) — so you learn you
    //     need the weight to hold it down permanently.
    const rp = l2.rope, rb = l2.rbutton, gA = gateById('A'), gB = gateById('B');
    if (rp && rb) {
      const w = rp.weight;
      if (w.falling && !w.landed) {
        w.vy = (w.vy || 0) + GRAV * dt;
        w.y = w.y + w.vy * dt;
        if (w.y + w.s >= rb.y) {
          w.y = rb.y - w.s; w.landed = true; w.falling = false;
          spawnDust(rb.x, rb.y, 8, 1.2);
          // crush any skeleton caught under the weight, for good measure
          for (const sk of l2.skels) {
            if (sk.state !== 'pile' && sk.state !== 'gone'
              && Math.abs(sk.x - rb.x) < 40 && Math.abs(sk.y - rb.y) < 12) { sk.state = 'pile'; sk.armed = false; }
          }
          l2toast('The weight pins the plate down — the gate stays open');
        }
      }
      // the rope-hall skeleton walks onto the plate and PAUSES there for a few
      // seconds — a live demonstration: the weight sinks, gate A grinds open, so
      // the player learns to weigh the plate down themselves before proceeding
      const ps = l2.plateSkel;
      if (ps && !l2.plateDemoDone && ps.state !== 'pile' && ps.state !== 'gone' && ps.state !== 'fall') {
        if ((ps.wait || 0) > 0) {
          ps.x = rb.x;                       // pin it on the plate while it waits
          ps.wait -= dt;
          if (ps.wait <= 0) { l2.plateDemoDone = true; ps.dir = 1; }
        } else if (Math.abs(ps.x - rb.x) < 22 && ps.state === 'patrol') {
          ps.wait = 3.6; ps.x = rb.x;        // reached the plate → begin the wait
          if (!ps._demoToast) { l2toast('Watch — while it stands here, the gate opens'); ps._demoToast = true; }
        }
      }
      // a body on the plate presses it — gate A opens ONLY while it is pressed.
      // The hanging weight does NOT move here; it only drops when the rope is cut
      // (that is the whole point — you need the weight to hold the plate down).
      let skelOnPlate = false;
      for (const sk of l2.skels) {
        if (sk.state !== 'pile' && sk.state !== 'gone' && sk.state !== 'fall'
          && Math.abs(sk.x - rb.x) < rb.w * 0.5 + 10 && Math.abs(sk.y - rb.y) < 14) { skelOnPlate = true; break; }
      }
      if (skelOnPlate && !rp.demoed) { l2toast('The plate opens the gate — but only while weighed down'); rp.demoed = true; }
      // the plate is pressed by the hero's body OR a skeleton OR (permanently)
      // by the fallen weight
      const playerOn = p.onGround && Math.abs(p.x - rb.x) < rb.w * 0.5 + 10 && Math.abs(p.y - rb.y) < 8;
      rb.pressed = playerOn || skelOnPlate || w.landed;
      if (playerOn && !w.landed && !rb._taught) {
        l2toast('The gate opens — but only while the plate is pressed'); rb._taught = true;
      }
      // hint when the hero is near the uncut rope with a sword in hand
      if (!rp.cut && p.hasSword && Math.abs(p.x - rp.cleatX) < 80 && Math.abs(p.y - rp.cleatY) < 120) {
        if (!rp.hinted) { l2toast('Cut the rope!  (X)'); rp.hinted = true; }
      } else if (rp.cut) rp.hinted = true;
    }

    // --- key pickup
    const kb = l2.key;
    if (kb && !kb.taken && Math.abs(p.x - kb.x) < 24 && Math.abs(p.y - kb.y) < 42) {
      kb.taken = true;
      l2toast('You pried a rusty key from the bones');
    }

    // --- gate B: you must be at the gate AND deliberately USE the key (▲) — just
    //     carrying it isn't enough
    if (gB && !gB.open) {
      const near = Math.abs(p.x - (gB.x + gB.w / 2)) < 40 && p.onGround;
      if (near && kb && kb.taken) {
        if (!gB.promptShown) { l2toast('Use the key — press ▲'); gB.promptShown = true; }
        if (keyUp()) {
          gB.open = true; kb.used = true;
          l2toast('The key turns — the gate creaks open');
        }
      } else if (near && (!kb || !kb.taken)) {
        if (!gB.hinted) { l2toast('A locked gate — find the key'); gB.hinted = true; }
      } else {
        gB.hinted = false; gB.promptShown = false;
      }
    }

    // --- chain lift oscillates up/down the shaft
    if (l2.lift) {
      const L = l2.lift;
      L.y = L.y + L.dir * L.spd * dt;
      if (L.y >= L.yBot) { L.y = L.yBot; L.dir = -1; }
      else if (L.y <= L.yTop) { L.y = L.yTop; L.dir = 1; }
    }

    // --- drive each gate's slide: gate A tracks its pressure plate (opens AND
    //     closes), gate B latches open once the key is used
    for (const g of l2.gates) {
      let wantOpen;
      if (g.id === 'A') wantOpen = !!(l2.rbutton && l2.rbutton.pressed);
      else wantOpen = g.open;
      const rate = (g.id === 'A') ? 3.0 : 1.6;   // the plate gate snaps quicker
      g.openT = clamp((g.openT || 0) + (wantOpen ? 1 : -1) * dt * rate, 0, 1);
    }

    // --- EXIT DOOR: opens only once the guardians of the final hall are gone,
    //     revealing a lit stairway. Enter it to trigger the stair-climb finale.
    if (!l2.doorOpen) {
      let foes = 0;
      for (const sk of l2.skels) if (sk.state !== 'pile' && sk.state !== 'gone' && sk.x > 5820) foes++;
      for (const bt of l2.biters) if (bt.state !== 'dead' && bt.x > 5820) foes++;
      if (foes === 0 && p.x > 5760) {   // only announce once the hero is in the final hall
        l2.doorOpen = true; l2.doorOpenT = 0;
        l2toast('The guardians are gone — the door grinds open');
      }
    }
    if (l2.doorOpen && l2.doorOpenT < 1) l2.doorOpenT = Math.min(1, l2.doorOpenT + dt * 1.1);

    if (l2.endStage === 0 && p.x > END_DOOR_X - 46 && !p.dying && !l2.gameOver) {
      if (l2.doorOpen && l2.doorOpenT >= 1) {
        // step into the doorway and begin the climb
        l2.endStage = 1; l2.endT = 0.0001;
        p.state = 'cine'; p.vx = 0; p.vy = 0; p.facing = 1;
        p.x = END_DOOR_X - 20; p.y = 384;
      } else if (!l2.doorOpen && !l2.doorHinted) {
        l2toast('The door is barred — clear the hall first'); l2.doorHinted = true;
      }
    }
    if (l2.endStage >= 1) l2.endT = l2.endT + dt;
    // once the stair-climb has faded fully to black, descend into Level 3
    if (l2.endStage >= 1 && l2.endT > 3.8) { initLevel(3); return; }
    l2.msgT = Math.max(0, l2.msgT - dt);
  }

  function gateById(id) {
    for (const g of l2.gates) if (g.id === id) return g;
    return null;
  }

  // -------------------------------------------------------------- LEVEL 2 DRAW
  const BONE = [0.86, 0.83, 0.74];

  function drawSkel(sk) {
    if (sk.state === 'gone') return;
    lg.push();
    lg.translate(sk.x, sk.y);
    if (sk.state === 'pile') {
      lg.setColor(BONE[0], BONE[1], BONE[2], 1);
      lg.circle('fill', -10, -7, 5.5);
      lg.setColor(0.1, 0.1, 0.12, 1);
      lg.circle('fill', -11.5, -7.5, 1.3);
      lg.setColor(BONE[0], BONE[1], BONE[2], 1);
      lg.setLineWidth(3);
      lg.line(-2, -3, 14, -6);
      lg.line(0, -8, 12, -2);
      lg.line(4, -12, 16, -12);
      lg.setLineWidth(1);
      lg.pop();
      return;
    }
    lg.scale(sk.dir, 1);
    const walk = (sk.state === 'patrol') ? Math.sin(sk.t * 7 + sk.phase) : 0;
    const lean = (sk.state === 'stun') ? -0.35 : ((sk.state === 'windup') ? 0.12 : 0);
    lg.setColor(BONE[0] * 0.75, BONE[1] * 0.75, BONE[2] * 0.75, 1);
    lg.setLineWidth(3);
    lg.line(0, -22, 4 * walk, -11, 2 * walk, 0);
    lg.setColor(BONE[0], BONE[1], BONE[2], 1);
    lg.line(0, -22, -4 * walk, -11, -2 * walk, 0);
    lg.line(-3, -22, 3, -22);
    lg.line(lean * 4, -22, 2 + lean * 8, -38);
    for (let i = 0; i <= 2; i++) {
      lg.line(-5 + lean * 7, -35 + i * 3.6, 6 + lean * 7, -35 + i * 3.6);
    }
    lg.setColor(BONE[0] * 0.7, BONE[1] * 0.7, BONE[2] * 0.7, 1);
    lg.line(1 + lean * 8, -37, -4 - 3 * walk, -30, -1 - 4 * walk, -24);
    lg.setColor(BONE[0], BONE[1], BONE[2], 1);
    lg.circle('fill', 3 + lean * 10, -43, 5.4);
    lg.rectangle('fill', 3 + lean * 10, -41, 5.5, 3.4);
    lg.setColor(0.08, 0.08, 0.1, 1);
    lg.circle('fill', 5.5 + lean * 10, -44, 1.4);
    // sword arm follows the SAME overhead-slash choreography as the hero
    let aA, swingU = null;
    if (sk.state === 'windup') { swingU = lerp(0.02, 0.30, smooth(Math.min(1, sk.t / 0.38))); aA = swingBladeAngle(swingU) - 0.35; }
    else if (sk.state === 'strike') { swingU = lerp(0.30, 0.86, smooth(Math.min(1, sk.t / 0.22))); aA = swingBladeAngle(swingU) - 0.35; }
    else if (sk.state === 'stun') aA = 1.9;
    else aA = 0.35 + 0.28 * walk;
    if (sk.armed && sk.state === 'strike' && swingU !== null) {   // matching motion trail
      const aNow = swingBladeAngle(swingU);
      const aPrev = swingBladeAngle(Math.max(0.28, swingU - 0.24));
      drawSlashTrail(2, -37, aPrev, aNow, 6, 24, 0.28);
    }
    lg.setColor(BONE[0], BONE[1], BONE[2], 1);
    lg.setLineWidth(3);
    const ex = 2 + Math.sin(aA) * 8, ey = -37 + Math.cos(aA) * 8;
    const hxx = ex + Math.sin(aA + 0.3) * 8, hyy = ey + Math.cos(aA + 0.3) * 8;
    lg.line(2, -37, ex, ey, hxx, hyy);
    if (sk.armed) drawSwordAt(hxx, hyy, aA + 0.35);
    lg.setLineWidth(1);
    lg.pop();
  }

  // Flying severed head — pale face, wild green hair, gnashing teeth.
  function drawBiter(bt) {
    lg.push();
    lg.translate(bt.x, bt.y);
    if (bt.state === 'dead') {
      const a = Math.max(0, 1 - bt.dead / 0.5);
      lg.setColor(0.55, 0.85, 0.45, 0.5 * a);
      lg.circle('fill', 0, -bt.dead * 40, 12 + bt.dead * 30);
      lg.pop();
      return;
    }
    const face = bt.x > player.x ? -1 : 1;   // look toward the hero
    lg.scale(face, 1);
    const chase = bt.state === 'chase';
    const bob = Math.sin(bt.t * 6 + bt.phase) * 1.5;
    lg.translate(0, bob);
    // faint sickly aura
    lg.setColor(0.45, 0.8, 0.4, 0.10 + (chase ? 0.06 : 0));
    lg.circle('fill', 0, 0, 20);
    // trailing green wisps under the head (the "flight")
    lg.setColor(0.35, 0.7, 0.35, 0.35);
    for (let i = 0; i < 3; i++) {
      const wy = 9 + i * 4, ww = 6 - i * 1.6;
      lg.circle('fill', Math.sin(bt.t * 8 + i) * 3, wy, Math.max(1, ww));
    }
    // green hair (spiky strands over the crown)
    lg.setColor(0.20, 0.62, 0.24, 1);
    for (let i = -3; i <= 3; i++) {
      const hx = i * 2.4, base = -6;
      lg.polygon('fill', hx - 1.8, base + 2, hx + 1.8, base + 2,
        hx + Math.sin(bt.t * 3 + i) * 1.5, base - 9 - Math.abs(i));
    }
    lg.setColor(0.14, 0.5, 0.18, 1);
    for (let i = -2; i <= 2; i++) {
      const hx = i * 3.0;
      lg.polygon('fill', hx - 1.4, -4, hx + 1.4, -4, hx, -12 - (2 - Math.abs(i)) * 2);
    }
    // pale head
    lg.setColor(0.93, 0.92, 0.88, 1);
    lg.circle('fill', 0, 0, 11);
    lg.setColor(0.82, 0.80, 0.76, 1);      // gaunt cheek shadow
    lg.circle('fill', -2, 3, 8);
    lg.setColor(0.93, 0.92, 0.88, 1);
    lg.circle('fill', 1, -1, 9.5);
    // sunken eyes (glow red when chasing)
    if (chase) lg.setColor(0.9, 0.2, 0.15, 1); else lg.setColor(0.12, 0.12, 0.14, 1);
    lg.circle('fill', -3.5, -2, 2.2);
    lg.circle('fill', 3.5, -2, 2.2);
    lg.setColor(1, 1, 1, 0.5);
    lg.circle('fill', -3, -2.6, 0.7);
    lg.circle('fill', 4, -2.6, 0.7);
    // gaping mouth with teeth — opens wide on a bite
    const open = 2.5 + (bt.bite > 0 ? 6 : chase ? 3 : 0);
    lg.setColor(0.32, 0.06, 0.08, 1);
    lg.polygon('fill', -5, 5, 5, 5, 4, 5 + open, -4, 5 + open);
    lg.setColor(0.95, 0.94, 0.9, 1);
    for (let i = -4; i <= 4; i += 2) {
      lg.polygon('fill', i - 0.9, 5, i + 0.9, 5, i, 7.5);          // upper teeth
      lg.polygon('fill', i - 0.9, 5 + open, i + 0.9, 5 + open, i, 5 + open - 2.5);  // lower teeth
    }
    lg.pop();
  }

  // A closed portcullis; when open the bars have slid up out of sight.
  function drawGate(g) {
    if (g.openT >= 1) return;
    const rise = (g.yBot - g.yTop) * smooth(g.openT);
    const x = g.x, top = g.yTop - rise, bot = g.yBot - rise;
    // frame jambs (stay put)
    lg.setColor(0.12, 0.10, 0.14, 1);
    lg.rectangle('fill', x - 8, g.yTop - 14, g.w + 16, 14);
    // iron bars
    lg.setColor(g.locked && !g.open ? 0.34 : 0.40, 0.30, 0.24, 1);
    const nbar = 4;
    for (let i = 0; i < nbar; i++) {
      const bx = x + 2 + i * (g.w - 4) / (nbar - 1);
      lg.rectangle('fill', bx - 1.5, top, 3, bot - top);
    }
    for (let cy = top + 12; cy < bot; cy += 26) {
      lg.rectangle('fill', x, cy - 1.5, g.w, 3);
    }
    lg.setColor(0.6, 0.5, 0.35, 0.5);
    for (let i = 0; i < nbar; i++) {
      const bx = x + 2 + i * (g.w - 4) / (nbar - 1);
      lg.rectangle('fill', bx - 1.5, top, 1, bot - top);
    }
    if (g.locked && !g.open) {   // a keyhole plate on a locked gate
      lg.setColor(0.72, 0.60, 0.22, 1);
      lg.circle('fill', x + g.w / 2, (top + bot) / 2, 4.5);
      lg.setColor(0.1, 0.09, 0.08, 1);
      lg.circle('fill', x + g.w / 2, (top + bot) / 2 - 1, 1.4);
      lg.rectangle('fill', x + g.w / 2 - 0.8, (top + bot) / 2 - 1, 1.6, 4);
    }
  }

  function drawRopePuzzle() {
    const rp = l2.rope, rb = l2.rbutton;
    if (rb) {   // the pressure plate the weight must land on
      const pressed = rb.pressed;
      lg.setColor(0.16, 0.14, 0.17, 1);
      lg.rectangle('fill', rb.x - rb.w / 2 - 4, rb.y - 2, rb.w + 8, 4);
      lg.setColor(pressed ? 0.5 : 0.62, pressed ? 0.42 : 0.52, 0.30, 1);
      const h = pressed ? 2 : 6;
      lg.rectangle('fill', rb.x - rb.w / 2, rb.y - h, rb.w, h);
      lg.setColor(1, 0.9, 0.6, 0.4);
      lg.rectangle('fill', rb.x - rb.w / 2, rb.y - h, rb.w, 1.5);
    }
    if (!rp) return;
    const w = rp.weight;
    // ceiling beam + pulley
    lg.setColor(0.20, 0.17, 0.13, 1);
    lg.rectangle('fill', rp.cleatX - 20, rp.pulleyY - 20, (rp.x - rp.cleatX) + 60, 10);
    lg.setColor(0.30, 0.28, 0.30, 1);
    lg.circle('fill', rp.x, rp.pulleyY, 6);
    lg.setColor(0.12, 0.11, 0.12, 1);
    lg.circle('fill', rp.x, rp.pulleyY, 2);
    // rope: pulley → weight (vertical), and pulley → cleat (the cut segment)
    lg.setColor(0.66, 0.54, 0.30, 1);
    lg.setLineWidth(2.5);
    lg.line(rp.x, rp.pulleyY, w.x, w.y - w.s);
    if (!rp.cut) {
      lg.line(rp.x, rp.pulleyY, rp.cleatX, rp.cleatY);
      // glint on the cuttable segment
      const gl = 0.5 + 0.5 * Math.sin(T * 5);
      lg.setColor(1, 0.95, 0.7, 0.35 * gl);
      lg.setLineWidth(3.5);
      lg.line(rp.x, rp.pulleyY, rp.cleatX, rp.cleatY);
      // cleat anchored to the floor
      lg.setColor(0.30, 0.26, 0.22, 1);
      lg.setLineWidth(1);
      lg.rectangle('fill', rp.cleatX - 4, rp.cleatY, 8, 384 - rp.cleatY);
    } else {
      // frayed loose end dangling from the pulley
      lg.setColor(0.66, 0.54, 0.30, 1);
      lg.line(rp.x, rp.pulleyY, rp.x - 6, rp.pulleyY + 20 + Math.sin(T * 3) * 3);
    }
    lg.setLineWidth(1);
    // the heavy weight (a studded iron block)
    lg.setColor(0.22, 0.21, 0.24, 1);
    lg.rectangle('fill', w.x - w.s, w.y - w.s, w.s * 2, w.s * 2);
    lg.setColor(0.34, 0.33, 0.37, 1);
    lg.rectangle('fill', w.x - w.s, w.y - w.s, w.s * 2, 3);
    lg.setColor(0.10, 0.09, 0.11, 1);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      lg.circle('fill', w.x + i * w.s * 0.6, w.y + j * w.s * 0.6, 2);
    lg.setColor(0.5, 0.42, 0.3, 1);
    lg.rectangle('line', w.x - w.s, w.y - w.s, w.s * 2, w.s * 2);
  }

  function drawKey(kb) {
    if (!kb || kb.taken) return;
    const floorY = kb.floorY || 384;
    const yb = kb.y + Math.sin(T * 3) * 2;
    const gl = 0.6 + 0.4 * Math.sin(T * 4);
    lg.setColor(1, 0.9, 0.5, 0.22 * gl);
    lg.circle('fill', kb.x, yb - 6, 16);
    lg.setColor(1, 0.9, 0.5, 0.10 * gl);
    lg.circle('fill', kb.x, yb - 6, 30);
    // little bone pedestal
    lg.setColor(0.80, 0.77, 0.68, 0.9);
    lg.rectangle('fill', kb.x - 10, floorY - 4, 20, 4);
    // key: bow (ring) + shaft + bit
    lg.setColor(0.85, 0.68, 0.24, 1);
    lg.setLineWidth(2.5);
    lg.circle('line', kb.x, yb - 12, 4.5);
    lg.line(kb.x, yb - 7.5, kb.x, yb + 4);
    lg.line(kb.x, yb + 4, kb.x + 4, yb + 4);
    lg.line(kb.x, yb + 1, kb.x + 3, yb + 1);
    lg.setLineWidth(1);
    lg.setColor(1, 0.92, 0.6, 0.9);
    lg.circle('fill', kb.x, yb - 12, 1.4);
  }

  // The chain lift: a header beam, two hanging chains, and the riding platform.
  function drawLift() {
    const L = l2.lift;
    if (!L) return;
    const headY = L.yTop - 26;
    // header beam bolted across the top of the shaft
    lg.setColor(0.18, 0.16, 0.19, 1);
    lg.rectangle('fill', L.x - 8, headY, L.w + 16, 10);
    lg.setColor(0.30, 0.28, 0.32, 1);
    lg.rectangle('fill', L.x - 8, headY, L.w + 16, 2);
    // two chains from the header down to the platform
    for (const cxx of [L.x + 14, L.x + L.w - 14]) {
      lg.setColor(0.34, 0.32, 0.36, 1);
      lg.setLineWidth(2);
      lg.line(cxx, headY + 8, cxx, L.y);
      lg.setColor(0.50, 0.48, 0.52, 1);
      for (let yy = headY + 12; yy < L.y - 1; yy += 7) lg.circle('line', cxx, yy, 2.1);
    }
    lg.setLineWidth(1);
    // the riding platform (iron-bound timber)
    lg.setColor(0.24, 0.19, 0.14, 1);
    lg.rectangle('fill', L.x, L.y, L.w, 13);
    lg.setColor(0.42, 0.35, 0.26, 1);
    lg.rectangle('fill', L.x, L.y, L.w, 3);
    lg.setColor(0.14, 0.12, 0.14, 1);
    lg.rectangle('fill', L.x, L.y + 10, L.w, 3);
    lg.setColor(0.30, 0.28, 0.32, 1);   // corner brackets
    lg.rectangle('fill', L.x, L.y, 5, 13);
    lg.rectangle('fill', L.x + L.w - 5, L.y, 5, 13);
  }

  // The level-exit door: a barred emblem door while enemies remain, that swings
  // open to reveal a warm, ascending stairway once the hall is cleared.
  function drawEndDoor() {
    const dx = END_DOOR_X, floorY = 384;
    const w = 96, h = 196;
    const left = dx - w / 2, top = floorY - h;
    const openA = smooth(clamp(l2.doorOpenT || 0, 0, 1));
    // stone arch surround
    lg.setColor(0.12, 0.11, 0.15, 1);
    lg.rectangle('fill', left - 14, top - 16, w + 28, h + 16);
    lg.arc('fill', dx, top, w / 2 + 14, Math.PI, 2 * Math.PI);
    lg.setColor(0.28, 0.25, 0.32, 1);
    lg.rectangle('fill', left - 7, top, w + 14, h);
    lg.arc('fill', dx, top, w / 2 + 7, Math.PI, 2 * Math.PI);
    // dark interior recess
    lg.setColor(0.05, 0.045, 0.06, 1);
    lg.rectangle('fill', left, top, w, h);
    lg.arc('fill', dx, top, w / 2, Math.PI, 2 * Math.PI);
    // revealed stairway (ascending, warm light spilling down)
    if (openA > 0.03) {
      const gl = 0.7 + 0.3 * Math.sin(T * 3);
      lg.setColor(0.98, 0.62, 0.26, 0.16 * openA * gl);   // glow pooling out the door
      lg.circle('fill', dx, floorY - 64, 92);
      lg.setColor(1.0, 0.7, 0.3, 0.10 * openA * gl);
      lg.circle('fill', dx, floorY - 40, 60);
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const sw = w * 0.92 * (1 - t0 * 0.62);
        const sx = dx - sw / 2;
        const sy = floorY - 6 - i * (h * 0.62 / steps);
        const sh = Math.max(2, (h * 0.62 / steps) - 2);
        const b = 0.16 + t0 * 0.6;                        // brighter toward the top
        lg.setColor(b * 0.95, b * 0.74, b * 0.46, openA);
        lg.rectangle('fill', sx, sy - sh, sw, sh);
        lg.setColor(1.0, 0.86, 0.5, 0.3 * openA);         // lit step nosing
        lg.rectangle('fill', sx, sy - sh, sw, 1.5);
      }
    }
    // the two door leaves — each shrinks and slides into its jamb as it opens
    const lw = (w / 2) * (1 - openA);          // remaining width of each leaf
    if (lw > 1) {
      for (const s of [-1, 1]) {
        const bx = (s < 0) ? left : (dx + (w / 2 - lw));   // hinge side stays at the jamb
        lg.setColor(0.15, 0.13, 0.19, 1);
        lg.rectangle('fill', bx, top + 3, lw, h - 3);
        lg.setColor(0.20, 0.17, 0.24, 1);                 // lit inner edge toward the opening
        lg.rectangle('fill', (s < 0) ? bx + lw - 2 : bx, top + 3, 2, h - 3);
        // plank seams
        lg.setColor(0.09, 0.08, 0.11, 1);
        lg.setLineWidth(1.5);
        for (let i = 1; i < 3; i++) lg.line(bx + i * lw / 3, top + 10, bx + i * lw / 3, floorY - 4);
        lg.setLineWidth(1);
      }
    }
    // emblem on the doors while they are (mostly) shut
    if (openA < 0.5) drawEmblem(dx, floorY - 100, 24, (1 - openA * 2) * 0.85, [0.16, 0.14, 0.20]);
    // a pair of braziers flanking the door, brightening as it opens
    const fl = 0.8 + 0.2 * Math.sin(T * 6);
    for (const bx of [left - 30, left + w + 30]) {
      lg.setColor(0.22, 0.16, 0.10, 1);
      lg.rectangle('fill', bx - 4, floorY - 96, 8, 22);
      lg.setColor(1.0, 0.6, 0.2, (0.5 + 0.45 * openA) * fl);
      lg.circle('fill', bx, floorY - 100, 7);
      lg.setColor(1.0, 0.85, 0.4, (0.5 + 0.45 * openA) * fl);
      lg.circle('fill', bx, floorY - 103, 3.2);
    }
  }

  // The hero, backlit, climbing the stairway during the finale — shrinking and
  // fading into the warm light at the top of the stairs.
  function drawClimber() {
    if (l2.endStage < 1) return;
    const dx = END_DOOR_X, floorY = 384;
    const prog = clamp(l2.endT / 1.7, 0, 1);
    const ease = smooth(prog);
    const cx = dx;
    const cy = floorY - 6 - ease * (196 * 0.56);
    const sc = 1 - ease * 0.55;
    const fade = 1 - clamp((prog - 0.68) / 0.32, 0, 1);   // dissolve near the top
    if (fade <= 0) return;
    const step = l2.endT * 8.5;
    const bob = Math.abs(Math.sin(step)) * 2;
    const stride = Math.sin(step) * 4.5;
    lg.push();
    lg.translate(cx, cy - bob);
    lg.scale(sc, sc);
    // legs (climbing stride)
    lg.setColor(0.06, 0.05, 0.08, fade);
    lg.setLineWidth(4.5);
    lg.line(0, -2, stride, -20);
    lg.line(0, -2, -stride, -20);
    // cloak / body
    lg.polygon('fill', -8, -18, 8, -18, 5, -40, -5, -40);
    // trailing cape
    lg.setColor(0.10, 0.08, 0.12, fade * 0.85);
    lg.polygon('fill', -4, -38, -14, -8, -3, -22);
    // head
    lg.setColor(0.07, 0.06, 0.09, fade);
    lg.circle('fill', 0, -46, 6);
    // a hint of the red scarf, catching the stairwell light
    lg.setColor(0.6, 0.16, 0.18, fade * 0.9);
    lg.line(2, -40, 8 + stride * 0.5, -34);
    lg.setLineWidth(1);
    lg.pop();
  }

  // A grand arched castle entrance drawn at the start of the level.
  function drawCastleDoor2(cx, floorY) {
    const w = 150, h = 240;
    const left = cx - w / 2, top = floorY - h;
    // warm pool of brazier light behind the whole entrance so it reads as a
    // grand doorway even in the keep's gloom
    const fl = 0.8 + 0.2 * Math.sin(T * 6 + cx);
    lg.setColor(0.9, 0.55, 0.25, 0.06 * fl);
    lg.circle('fill', cx, top + h * 0.5, 190);
    lg.setColor(0.9, 0.5, 0.22, 0.05 * fl);
    lg.circle('fill', cx, top + h * 0.5, 130);
    // recessed stone archway (outer surround)
    lg.setColor(0.14, 0.12, 0.17, 1);
    lg.rectangle('fill', left - 18, top - 26, w + 36, h + 26);
    lg.arc('fill', cx, top + 6, w / 2 + 18, Math.PI, 2 * Math.PI);
    // arch stone ring with voussoir blocks
    lg.setColor(0.34, 0.31, 0.38, 1);
    lg.rectangle('fill', left - 10, top, w + 20, h);
    lg.arc('fill', cx, top, w / 2 + 10, Math.PI, 2 * Math.PI);
    lg.setColor(0.20, 0.18, 0.23, 1);
    lg.setLineWidth(1.5);
    for (let a = 0; a <= 8; a++) {
      const ang = Math.PI + (a / 8) * Math.PI;
      lg.line(cx + Math.cos(ang) * (w / 2), top + Math.sin(ang) * (w / 2),
        cx + Math.cos(ang) * (w / 2 + 10), top + Math.sin(ang) * (w / 2 + 10));
    }
    // dark doorway recess behind the doors
    lg.setColor(0.06, 0.05, 0.08, 1);
    lg.rectangle('fill', left, top, w, h);
    lg.arc('fill', cx, top, w / 2, Math.PI, 2 * Math.PI);
    // two heavy wooden door leaves
    for (const s of [-1, 1]) {
      const dx = cx + (s < 0 ? -w / 2 : 0);
      lg.setColor(0.40, 0.26, 0.15, 1);
      lg.rectangle('fill', dx + (s < 0 ? 2 : 0), top + 4, w / 2 - 2, h - 6);
      lg.arc('fill', cx, top + 4, w / 2 - 2, s < 0 ? Math.PI : 1.5 * Math.PI, s < 0 ? 1.5 * Math.PI : 2 * Math.PI);
      // warm lit edge along the top of each leaf
      lg.setColor(0.58, 0.40, 0.22, 0.8);
      lg.rectangle('fill', dx + (s < 0 ? 2 : 0), top + 4, w / 2 - 2, 3);
      // vertical plank seams
      lg.setColor(0.24, 0.15, 0.08, 1);
      lg.setLineWidth(1.5);
      for (let i = 1; i < 4; i++) {
        const px = dx + i * (w / 2) / 4;
        lg.line(px, top + 12, px, floorY - 6);
        lg.setColor(0.48, 0.32, 0.18, 0.5);
        lg.line(px + 1, top + 12, px + 1, floorY - 6);
        lg.setColor(0.24, 0.15, 0.08, 1);
      }
    }
    // iron cross-bands with studs
    for (const by of [top + 40, top + h - 60]) {
      lg.setColor(0.17, 0.15, 0.18, 1);
      lg.rectangle('fill', left + 4, by, w - 8, 9);
      lg.setColor(0.30, 0.28, 0.32, 1);
      lg.rectangle('fill', left + 4, by, w - 8, 2);
      lg.setColor(0.46, 0.44, 0.48, 1);
      for (let i = 0; i <= 8; i++) lg.circle('fill', left + 10 + i * (w - 20) / 8, by + 4.5, 2);
    }
    // central seam + two ring handles
    lg.setColor(0.10, 0.07, 0.05, 1);
    lg.setLineWidth(2);
    lg.line(cx, top + 8, cx, floorY - 6);
    lg.setColor(0.55, 0.48, 0.30, 1);
    lg.setLineWidth(2.5);
    lg.circle('line', cx - 12, top + h * 0.55, 6);
    lg.circle('line', cx + 12, top + h * 0.55, 6);
    lg.setLineWidth(1);
    // flanking wall braziers that light the entrance
    for (const bx of [left - 30, left + w + 30]) {
      lg.setColor(0.22, 0.16, 0.10, 1);
      lg.rectangle('fill', bx - 5, top + 70, 10, 24);
      lg.setColor(1.0, 0.6, 0.2, 0.9 * fl);
      lg.circle('fill', bx, top + 66, 8);
      lg.setColor(1.0, 0.85, 0.4, 0.95 * fl);
      lg.circle('fill', bx, top + 62, 4);
      lg.setColor(1.0, 0.6, 0.25, 0.08 * fl);
      lg.circle('fill', bx, top + 66, 90);
    }
  }

  const L2_TORCHES = [[260, 812], [700, 812], [1420, 656], [1820, 656], [2210, 656],
    [2470, 656], [2900, 296], [3250, 296], [3620, 296], [3980, 296],
    [4360, 296], [4780, 296], [5140, 296], [5540, 296], [5920, 296], [6320, 296],
    [5060, 858], [5700, 858]];   // basement torches (key vault)

  function drawEnts2() {
    drawCastleDoor2(150, 900);   // grand entrance at the start of the level
    for (const tc of L2_TORCHES) {
      const fl = 0.75 + 0.25 * Math.sin(T * 9 + tc[0]);
      lg.setColor(0.30, 0.20, 0.12, 1);
      lg.rectangle('fill', tc[0] - 2, tc[1], 4, 16);
      lg.setColor(1.0, 0.62, 0.2, 0.85 * fl);
      lg.circle('fill', tc[0], tc[1] - 4, 5);
      lg.setColor(1.0, 0.85, 0.4, 0.9 * fl);
      lg.circle('fill', tc[0], tc[1] - 5, 2.4);
      lg.setColor(1.0, 0.6, 0.25, 0.05 + 0.04 * fl);
      lg.circle('fill', tc[0], tc[1] - 4, 60);
    }
    const b = l2.button;
    if (b) {
      const h = b.pressed ? 2 : 5;
      lg.setColor(0.16, 0.14, 0.17, 1);
      lg.rectangle('fill', b.x - b.w / 2 - 4, b.y - 2, b.w + 8, 4);
      lg.setColor(0.62, 0.52, 0.30, 1);
      lg.rectangle('fill', b.x - b.w / 2, b.y - h, b.w, h);
      lg.setColor(1, 0.9, 0.6, 0.5);
      lg.rectangle('fill', b.x - b.w / 2, b.y - h, b.w, 1.5);
    }
    const tr = l2.trap;
    if (tr) {
      lg.setColor(0.35, 0.33, 0.36, 1);
      lg.setLineWidth(2);
      for (let cy = 40; cy < tr.y - 8; cy += 10) lg.rectangle('line', tr.x - 2, cy, 4, 8);
      lg.setColor(0.24, 0.20, 0.16, 1);
      lg.rectangle('fill', tr.x - tr.w / 2, tr.y, tr.w, tr.h);
      lg.setColor(0.5, 0.42, 0.3, 1);
      lg.setLineWidth(2.5);
      for (let i = 0; i <= 4; i++) {
        const gx = tr.x - tr.w / 2 + 4 + i * (tr.w - 8) / 4;
        lg.line(gx, tr.y + 2, gx, tr.y + tr.h - 2);
      }
      lg.rectangle('line', tr.x - tr.w / 2, tr.y, tr.w, tr.h);
      lg.setLineWidth(1);
    }
    if (l2.sword && !l2.sword.taken) {
      const g = 0.6 + 0.4 * Math.sin(T * 4);
      drawSwordAt(l2.sword.x, l2.sword.y - 4, -1.1);
      lg.setColor(1, 1, 0.9, 0.25 * g);
      lg.circle('fill', l2.sword.x + 8, l2.sword.y - 14, 12);
    }
    drawRopePuzzle();
    drawLift();
    drawKey(l2.key);
    drawEndDoor();   // the doorway is scenery — draw it BEHIND enemies + hero so
                     // they never vanish behind a closed door
    for (const g of l2.gates) drawGate(g);
    for (const sk of l2.skels) drawSkel(sk);
    for (const bt of l2.biters) drawBiter(bt);
    drawClimber();   // the finale climber goes ON TOP, ascending into the doorway
  }

  // ============================================================================
  //  LEVEL 3 — THE BLACK HALLS  (dark descent + six-armed guardian + witch)
  // ============================================================================
  const l3 = {
    skels: [], biters: [], gates: [],
    key: null, gateK: null, gateS: null, candle: null,
    lit: false, litT: 0, boss: null, hole: null,
    end: { stage: 0, t: 0, holeX: 0 }, cutscene: false,
    lives: 3, gameOver: false, msg: '', msgT: 0, _hitThisSwing: false,
    windPush: 0, flash: 0, doorHinted: false, litHint: false,
  };
  function l3toast(s) { l3.msg = s; l3.msgT = 3; }

  const LANE3 = { low: FLOOR3 - 12, mid: FLOOR3 - 44, high: FLOOR3 - 84 };
  const SALOON_L = 3760, SALOON_R = 6260;
  const BOSS_X = 4120;
  const SWORD_REACH = 1860;   // how far the boomerangs fly before returning

  function holeAt(x) { return level === 3 && l3.hole && x > l3.hole.x0 && x < l3.hole.x1; }

  function initEnts3() {
    l3.skels = [
      newSkel(2520, 2300, 2760, true),
      newSkel(2900, 2760, 3120, true),
      newSkel(3420, 3230, 3720, true),
    ];
    for (const s of l3.skels) s.y = floorAt(s.x, 0) || FLOOR3;
    l3.biters = [
      newBiter(1930, 150),   // guards the key shelf
      newBiter(2720, 150),   // upper walkway
      newBiter(3460, 300),   // corridor
    ];
    l3.key = { x: 1930, y: 214, floorY: 244, taken: false };
    // gate K (locked, needs the key) bars the main floor; gate S seals the saloon
    // entrance once the candle is lifted. openT: 1 = fully open/passable, 0 = shut.
    l3.gateK = { id: 'K', x: 2166, w: 18, yTop: 150, yBot: FLOOR3, openT: 0, locked: true, open: false, hinted: false, promptShown: false };
    l3.gateS = { id: 'S', x: SALOON_L + 2, w: 20, yTop: 40, yBot: FLOOR3, openT: 1, locked: false, open: true };
    l3.gates = [l3.gateK, l3.gateS];
    l3.candle = { x: 6120, y: FLOOR3, taken: false };
    l3.lit = false; l3.litT = 0; l3.litHint = false;
    l3.boss = null; l3.hole = null;
    l3.end = { stage: 0, t: 0, holeX: 0 }; l3.cutscene = false;
    l3.lives = 3; l3.gameOver = false; l3.msg = ''; l3.msgT = 0;
    l3._hitThisSwing = false; l3.windPush = 0; l3.flash = 0; l3.doorHinted = false;
  }

  function spawnBoss() {
    l3.boss = {
      x: BOSS_X, y: FLOOR3, hp: 10, active: true, hitCool: 0, appearT: 0,
      swords: [], fireCool: 1.4, order: [], dead: false, deadT: 0,
      armSwing: 0, touchCool: 0,
      // six arms; a hand goes empty while the scimitar it threw is in flight
      // (index 0-2 = left side k0-2, 3-5 = right side k0-2)
      arms: [true, true, true, true, true, true], throwArm: -1,
    };
    l3toast('The guardian awakes — strike it ten times!');
  }

  function nextLane() {
    const b = l3.boss;
    if (!b.order.length) {
      b.order = ['low', 'mid', 'high'];
      for (let i = b.order.length - 1; i > 0; i--) {   // shuffle the volley
        const j = Math.floor(love.math.random() * (i + 1));
        const t = b.order[i]; b.order[i] = b.order[j]; b.order[j] = t;
      }
    }
    return b.order.pop();
  }

  // choose an arm that still holds a scimitar, preferring the side facing the
  // throw so the blade leaves from a hand on the hero's side
  function pickBossArm(b, dir) {
    const pref = dir > 0 ? [3, 4, 5] : [2, 1, 0];
    for (const i of pref) if (b.arms[i]) return i;
    for (let i = 0; i < 6; i++) if (b.arms[i]) return i;
    return -1;
  }

  function updateBoss(dt, p) {
    const b = l3.boss;
    if (!b) return;
    b.appearT = Math.min(1, b.appearT + dt * 1.2);
    b.hitCool = Math.max(0, b.hitCool - dt);
    b.armSwing = Math.max(0, b.armSwing - dt);
    b.touchCool = Math.max(0, b.touchCool - dt);
    // the guardian stalks slowly toward the hero (kept inside the sealed saloon)
    if (b.active && !b.dead && !l3.cutscene) {
      const want = clamp(p.x, SALOON_L + 130, SALOON_R - 220);
      const step = 26 * dt;   // slow, menacing drift
      if (want > b.x + 2) b.x = Math.min(want, b.x + step);
      else if (want < b.x - 2) b.x = Math.max(want, b.x - step);
    }
    // touching the guardian's body costs a life and flings the hero off
    if (b.active && !b.dead && !l3.cutscene && !p.dying && (p.inv || 0) <= 0 && b.touchCool <= 0) {
      if (Math.abs(p.x - b.x) < 32 && p.y > FLOOR3 - 150) {
        b.touchCool = 0.6;
        hurtPlayer(p, p.x >= b.x ? 1 : -1);
        spawnDust(p.x, p.y - 30, 6, 0.9);
      }
    }
    // fire boomerang swords, one lane at a time, up to three in flight
    if (b.active && !b.dead && !l3.cutscene) {
      b.fireCool -= dt;
      if (b.fireCool <= 0 && b.swords.length < 3) {
        const lane = nextLane();
        const dir = (p.x >= b.x) ? 1 : -1;   // always hurl toward the hero
        const armIndex = pickBossArm(b, dir);            // an arm still holding a blade
        if (armIndex >= 0) b.arms[armIndex] = false;     // its hand goes empty
        b.swords.push({ x: b.x + dir * 40, y: LANE3[lane], vx: 560 * dir, dir: dir, lane: lane, phase: 'out', spin: 0, armIndex: armIndex });
        b.fireCool = b.order.length ? 0.9 : 1.7;   // short gap within a volley, longer between
        b.armSwing = 0.35; b.throwArm = armIndex;   // throw animation on that arm
        if (sfxSwing) sfxSwing.play(0.4, 0.7 + love.math.random() * 0.1);
      }
    }
    // move swords: fly out, then boomerang back to the boss and vanish
    for (let i = b.swords.length - 1; i >= 0; i--) {
      const s = b.swords[i];
      s.spin += dt * 15 * (s.dir || 1);
      if (s.phase === 'out') {
        s.x += s.vx * dt;
        if (Math.abs(s.x - b.x) >= SWORD_REACH) { s.phase = 'back'; s.vx = -560 * s.dir; }
      } else {
        s.x += s.vx * dt;
        if ((s.dir || 1) > 0 ? s.x <= b.x + 20 : s.x >= b.x - 20) {
          if (s.armIndex >= 0) b.arms[s.armIndex] = true;   // the blade is caught again
          b.swords.splice(i, 1); continue;
        }
      }
      // hit the hero unless jumped/ducked out of this lane
      if (!p.dying && (p.inv || 0) <= 0 && Math.abs(s.x - p.x) < 22) {
        const top = heroTop(p), bot = p.y;
        if (s.y + 9 > top && s.y - 9 < bot) {
          hurtPlayer(p, s.vx > 0 ? 1 : -1);
          spawnDust(p.x, p.y - 30, 5, 0.8);
        }
      }
    }
  }

  // register a melee hit on the boss (called from the swing window in updateEnts3)
  function tryHitBoss(p, empowered) {
    const b = l3.boss;
    if (!b || b.dead || !b.active || b.hitCool > 0) return false;
    if (Math.abs(p.x - b.x) > 64 || p.facing !== (b.x < p.x ? -1 : 1)) return false;
    if (Math.abs(p.y - b.y) > 70) return false;
    b.hp -= 1; b.hitCool = 0.65;
    if (sfxHit) sfxHit.play(0.6, 0.7 + love.math.random() * 0.12);
    // a gust bursts from the guardian and flings the hero away
    const away = (p.x >= b.x) ? 1 : -1;
    p.vx = away * 460; p.vy = -190; p.state = 'air'; p.t = 0; p.inv = Math.max(p.inv || 0, 0.3);
    l3.windPush = 0.4;
    spawnDust(b.x + away * 30, b.y - 40, 10, 1.3);
    if (b.hp <= 0) {
      b.dead = true; b.deadT = 0; b.swords.length = 0; b.active = false;
      for (let i = 0; i < 6; i++) b.arms[i] = true;   // blades return to the dying hands
      l3.end.stage = 1; l3.end.t = 0; l3.cutscene = true;
      l3toast('The guardian shatters — but something worse stirs…');
    } else {
      l3toast('Guardian struck!  ' + b.hp + ' blow' + (b.hp === 1 ? '' : 's') + ' remain');
    }
    return true;
  }

  function updateEnts3(dt) {
    const p = player;
    l3.windPush = Math.max(0, l3.windPush - dt);
    l3.flash = Math.max(0, l3.flash - dt);
    if (l3.lit && l3.litT < 1) l3.litT = Math.min(1, l3.litT + dt * 0.8);

    for (const sk of l3.skels) updateSkel(sk, dt, p);
    for (const bt of l3.biters) updateBiter(bt, dt, p);
    updateBoss(dt, p);

    // --- hero sword swing: hits skeletons, heads and the boss during the strike
    const au = 1 - (p.atkT || 0) / ATK_DUR;
    if ((p.atkT || 0) > 0 && au > 0.30 && au < 0.56) {
      const empowered = (p.riposte || 0) > 0 && (p.riposteHits || 0) > 0;
      let didHit = false;
      for (const bt of l3.biters) {
        if (bt.state === 'dead') continue;
        const dx = bt.x - p.x;
        if (dx * p.facing > 0 && Math.abs(dx) < 56 && Math.abs(bt.y - (p.y - 30)) < 52) {
          bt.state = 'dead'; bt.dead = 0; spawnDust(bt.x, bt.y, 7, 1.0); didHit = true;
        }
      }
      for (const sk of l3.skels) {
        if (sk.state !== 'pile' && sk.state !== 'gone' && sk.state !== 'fall' && sk.state !== 'stun') {
          const dx = sk.x - p.x;
          if (dx * p.facing > 0 && Math.abs(dx) < 52 && Math.abs(sk.y - p.y) < 60) {
            sk.state = 'stun'; sk.t = 0; sk.vx = p.facing * (empowered ? 540 : 260);
            didHit = true; spawnDust(sk.x - p.facing * 8, sk.y - 34, 4, 0.8);
          }
        }
      }
      if (tryHitBoss(p, empowered)) didHit = true;
      if (didHit && !l3._hitThisSwing) {
        if (empowered) p.riposteHits = Math.max(0, p.riposteHits - 1);
        l3._hitThisSwing = true;
      }
    }
    if ((p.atkT || 0) <= 0) l3._hitThisSwing = false;

    // --- key pickup
    const kb = l3.key;
    if (kb && !kb.taken && Math.abs(p.x - kb.x) < 26 && Math.abs(p.y - kb.y) < 46) {
      kb.taken = true; l3toast('A cold iron key — for the barred door');
    }

    // --- locked gate K: stand at it with the key and press ▲ to open
    const gK = l3.gateK;
    if (gK && gK.openT < 1 && !gK.open) {
      const near = Math.abs(p.x - (gK.x + gK.w / 2)) < 42 && p.onGround;
      if (near && kb && kb.taken) {
        if (!gK.promptShown) { l3toast('Use the key — press ▲'); gK.promptShown = true; }
        if (keyUp()) { gK.open = true; l3toast('The lock grinds — the way opens'); }
      } else if (near) {
        if (!gK.hinted) { l3toast('Barred and locked — find the key'); gK.hinted = true; }
      } else { gK.hinted = false; gK.promptShown = false; }
    }
    if (gK) gK.openT = clamp(gK.openT + (gK.open ? 1 : -1) * dt * 1.6, 0, 1);

    // --- the candle: lifting it lights the hall, seals the saloon, wakes the boss
    const cd = l3.candle;
    if (cd && !cd.taken) {
      if (Math.abs(p.x - cd.x) < 30 && Math.abs(p.y - cd.y) < 60) {
        cd.taken = true; l3.lit = true; l3.litT = 0;
        l3.gateS.open = false;   // seal the entrance behind the hero
        spawnBoss();
      } else if (p.x > SALOON_L + 200 && !l3.litHint) {
        l3toast('A candle glimmers at the far end of the hall'); l3.litHint = true;
      }
    }
    // gate S slides shut once the candle is taken (openT 1 → 0)
    const gS = l3.gateS;
    if (gS) gS.openT = clamp(gS.openT + (gS.open ? 1 : -1) * dt * 1.4, 0, 1);

    // --- witch finale: appears, calls down lightning, breaks the floor, the hero
    //     drops into the dark and the scene fades out
    if (l3.end.stage > 0) {
      l3.end.t += dt;
      if (l3.end.stage === 1) {
        if (l3.end.t > 2.4) {                  // strike!
          l3.end.stage = 2; l3.end.t = 0; l3.flash = 0.5;
          l3.hole = { x0: p.x - 78, x1: p.x + 78 };   // shatter the floor under the hero
          l3.end.holeX = p.x;
          if (sfxThunder) sfxThunder.play(0.95, 1.0);   // lightning crack + rumble
          if (sfxHit) sfxHit.play(0.7, 0.5);            // floor shattering
          spawnDust(p.x, FLOOR3, 16, 1.6);
        }
      } else if (l3.end.stage === 2) {
        // the floor is gone; the cutscene path (updatePlayer) drops the hero
        // straight down the shaft. after a beat, begin the fade
        if (l3.end.t > 0.7) { l3.end.stage = 3; l3.end.t = 0; }
      } else if (l3.end.stage === 3) {
        // hero falls into the dark; the overlay fades the scene to black
      }
    }

    l3.msgT = Math.max(0, l3.msgT - dt);
  }

  // ------------------------------------------------------------------ L3 art
  function drawCandle(cd) {
    if (!cd || cd.taken) return;
    const x = cd.x, y = cd.y;
    const fl = 0.7 + 0.3 * Math.sin(T * 8 + 1.3);
    // glow so it's findable in the dark
    lg.setColor(1.0, 0.8, 0.4, 0.10 * fl); lg.circle('fill', x, y - 40, 120);
    lg.setColor(1.0, 0.75, 0.35, 0.18 * fl); lg.circle('fill', x, y - 40, 46);
    // holder + candle
    lg.setColor(0.55, 0.45, 0.22, 1); lg.rectangle('fill', x - 12, y - 4, 24, 4);
    lg.setColor(0.5, 0.4, 0.2, 1); lg.rectangle('fill', x - 4, y - 8, 8, 5);
    lg.setColor(0.92, 0.88, 0.76, 1); lg.rectangle('fill', x - 3, y - 42, 6, 34);
    // flame
    lg.setColor(1.0, 0.6, 0.2, 0.9 * fl); lg.circle('fill', x, y - 46, 5);
    lg.setColor(1.0, 0.9, 0.5, fl); lg.circle('fill', x, y - 47, 2.6);
  }

  // A solid curved scimitar drawn in local space: grip at the origin, the blade
  // sweeping out along +x to a flared tip (intrinsic tip angle ≈ -0.31 rad).
  // Reused by the boss's hands and by the flying boomerang blades.
  function drawScimitar(alpha) {
    const GOLD = [0.86, 0.69, 0.30], GOLDL = [1.0, 0.92, 0.60], GOLDD = [0.52, 0.40, 0.18], GRIP = [0.12, 0.09, 0.07];
    // handle + pommel
    setColA(GRIP, alpha);
    lg.polygon('fill', -2, -2.0, -12, -2.4, -13, 2.4, -2, 2.0);
    setColA(GOLDD, alpha); lg.circle('fill', -13, 0, 2.7);
    // crossguard (quillon)
    setColA(GOLD, alpha);
    lg.polygon('fill', -3.5, -6.5, -0.5, -6.5, -0.5, 6.5, -3.5, 6.5);
    lg.circle('fill', -2, 0, 2.4);
    // blade silhouette — spine on top, cutting belly below, flared tip
    const spine = [0, -3, 10, -3.6, 20, -4.4, 29, -6, 36, -9, 42, -13.5];
    const edge = [42, -13.5, 37, -5.5, 28, -0.8, 18, 1.6, 9, 2.4, 0, 3];
    setColA(GOLD, alpha); lg.polygon('fill', spine.concat(edge));
    // bright spine highlight
    setColA(GOLDL, alpha * 0.9); lg.setLineWidth(1.5);
    for (let i = 0; i < spine.length - 2; i += 2) lg.line(spine[i], spine[i + 1], spine[i + 2], spine[i + 3]);
    // darker fuller down the blade
    setColA(GOLDD, alpha * 0.75); lg.setLineWidth(1.2);
    lg.line(4, -0.5, 13, -2.5); lg.line(13, -2.5, 23, -4); lg.line(23, -4, 32, -6.5); lg.line(32, -6.5, 38, -10);
    lg.setLineWidth(1);
  }

  // one flying scimitar-boomerang (spins about its balance point)
  function drawFlyingSword(s) {
    lg.push();
    lg.translate(s.x, s.y);
    lg.setColor(1.0, 0.85, 0.4, 0.14); lg.circle('fill', 0, 0, 20);   // motion smear
    lg.rotate(s.spin);
    lg.translate(-20, 0);
    drawScimitar(1);
    lg.pop();
  }

  // The six-armed, six-sworded guardian on the saloon's left. Black body with
  // gold filigree, a tall ornate headdress and burning red eyes.
  function drawBoss() {
    const b = l3.boss;
    if (!b) return;
    const x = b.x, y = b.y;
    const a = smooth(b.appearT);
    const fade = b.dead ? clamp(1 - b.deadT * 0.6, 0, 1) : 1;
    const DARK = [0.08, 0.07, 0.10], DARK2 = [0.14, 0.12, 0.16], GOLD = [0.86, 0.69, 0.30];
    lg.push();
    lg.translate(x, y);
    lg.scale(a, a);
    // ground shadow
    lg.setColor(0, 0, 0, 0.3 * fade); lg.ellipse('fill', 0, 2, 46, 8);
    const LIMB = [0.10, 0.09, 0.12], LIMB2 = [0.13, 0.115, 0.15];
    const bodyC = mul(DARK2, 1, fade), limbC = mul(LIMB, 1, fade), limb2C = mul(LIMB2, 1, fade);
    const goldC = mul(GOLD, 1, fade);
    // a slow stalking stride so the legs read as flesh, not sticks
    const stride = Math.sin(T * 1.7) * 5;
    // legs — solid tapered thigh + shin + foot, one striding against the other
    for (let s = -1; s <= 1; s += 2) {
      const st = s * stride;
      const hipx = s * 10, hipy = -74;
      const kneex = s * 12 + st * 0.4, kneey = -40;
      const footx = s * 13 + st, footy = -4;
      segment(hipx, hipy, kneex, kneey, 7.0, 5.6, s < 0 ? limbC : limb2C);   // thigh
      segment(kneex, kneey, footx, footy, 5.6, 4.2, s < 0 ? limbC : limb2C); // shin
      lg.circle('fill', kneex, kneey, 5.0);                                  // knee
      segment(footx - 3, footy - 1, footx + 11, footy + 1, 4.4, 3.0, mul(DARK, 1, fade)); // foot
      // gold anklet
      setColA(goldC); lg.setLineWidth(2.4);
      lg.line(kneex + (footx - kneex) * 0.7 - 5, kneey + (footy - kneey) * 0.7,
              kneex + (footx - kneex) * 0.7 + 5, kneey + (footy - kneey) * 0.7);
    }
    // pelvis block tying the legs into the torso
    setColA(mul(DARK, 1, fade)); lg.polygon('fill', -16, -70, 16, -70, 20, -86, -20, -86);
    // torso
    setColA(bodyC);
    lg.polygon('fill', -22, -74, 22, -74, 27, -150, -27, -150);
    // shoulder mass / neck base so the six arms root into a solid trunk
    lg.polygon('fill', -30, -140, 30, -140, 22, -160, -22, -160);
    // gold sash/filigree on the chest
    setColA(GOLD, 0.9 * fade); lg.setLineWidth(3);
    lg.line(-16, -96, 16, -96); lg.line(-12, -118, 12, -118);
    lg.circle('line', 0, -108, 8);
    // six arms, each holding a solid scimitar, fanned out (3 per side). The arm
    // that just launched a blade thrusts out (b.throwArm) and its hand is empty
    // until the boomerang returns (b.arms[armIndex]).
    const armY = -150, shoulders = [-22, -6, 10];
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 3; k++) {
        const armIndex = (side < 0 ? 0 : 3) + k;
        const swing = (b.armSwing > 0 && b.throwArm === armIndex)
          ? Math.sin((1 - b.armSwing / 0.35) * Math.PI) : 0;
        const idle = Math.sin(T * 2.2 + k * 1.3 + (side > 0 ? 0.7 : 0)) * 3;
        const sy = armY + shoulders[k];
        const reach = 26 + k * 6 + swing * 18;    // hand thrusts out on a throw
        const shx = side * 9, shy = sy;           // shoulder root
        const hx = side * reach, hy = sy - 8 + idle - swing * 7;   // hand
        const elx = lerp(shx, hx, 0.5) + side * 3;                 // elbow (bent)
        const ely = lerp(shy, hy, 0.5) + 5 - swing * 3;
        const shadeK = (k === 1) ? 0.82 : 1;      // middle pair a touch darker for depth
        const armC = mul(LIMB, shadeK, fade), armC2 = mul(LIMB2, shadeK, fade);
        segment(shx, shy, elx, ely, 5.2, 4.2, armC);   // upper arm (solid taper)
        segment(elx, ely, hx, hy, 4.2, 3.0, armC);     // forearm
        lg.circle('fill', elx, ely, 4.4);              // elbow
        setColA(armC2); lg.circle('fill', hx, hy, 3.8); // hand/fist
        // gold wrist bracer, across the forearm at the wrist
        const wdx = hx - elx, wdy = hy - ely, wl = Math.hypot(wdx, wdy) || 1;
        const px = -wdy / wl, py = wdx / wl;
        setColA(goldC); lg.setLineWidth(2.4);
        lg.line(hx - px * 4 - wdx / wl * 3, hy - py * 4 - wdy / wl * 3,
                hx + px * 4 - wdx / wl * 3, hy + py * 4 - wdy / wl * 3);
        // solid scimitar gripped in the fist, pointing radially outward — drawn
        // only while this hand still holds its blade
        if (b.arms[armIndex]) {
          const outAng = Math.atan2(hy - (-110), hx);   // outward from the torso centre
          lg.push(); lg.translate(hx, hy); lg.rotate(outAng + 0.31);
          drawScimitar(fade);
          lg.pop();
        }
      }
    }
    // head + tall headdress
    setColA(DARK2, fade); lg.circle('fill', 0, -166, 14);
    setColA(DARK, fade);
    lg.polygon('fill', -18, -176, 18, -176, 22, -210, 0, -232, -22, -210);
    setColA(GOLD, 0.8 * fade); lg.setLineWidth(2);
    for (let i = -2; i <= 2; i++) lg.line(i * 7, -178, i * 8, -214);
    // burning red eyes
    const gl = 0.7 + 0.3 * Math.sin(T * 6);
    lg.setColor(1.0, 0.2, 0.15, fade * gl);
    lg.circle('fill', -5, -168, 2.4); lg.circle('fill', 5, -168, 2.4);
    lg.setColor(1.0, 0.5, 0.4, fade * 0.3);
    lg.circle('fill', -5, -168, 5); lg.circle('fill', 5, -168, 5);
    lg.setLineWidth(1);
    lg.pop();
    // its flying swords (drawn in world space, not scaled)
    for (const s of b.swords) drawFlyingSword(s);
  }

  // The witch on a far perch during the finale — a hooded silhouette raising a
  // crooked staff, wreathed in cold light.
  function drawWitch(alpha) {
    if (alpha <= 0) return;
    const p = player;
    const wx = p.x + 40, wy = FLOOR3 - 300;
    lg.push();
    lg.translate(wx, wy);
    // cold aura
    lg.setColor(0.5, 0.85, 0.9, 0.10 * alpha); lg.circle('fill', 0, -10, 70);
    // robe
    lg.setColor(0.06, 0.05, 0.09, alpha);
    lg.polygon('fill', -20, 40, 20, 40, 10, -34, -10, -34);
    // raised arms
    lg.setColor(0.06, 0.05, 0.09, alpha); lg.setLineWidth(5);
    lg.line(-8, -20, -30, -46); lg.line(8, -20, 30, -46);
    // hood + head
    lg.setColor(0.05, 0.04, 0.07, alpha); lg.circle('fill', 0, -40, 11);
    lg.polygon('fill', -12, -34, 12, -34, 0, -58);
    // glowing eyes
    lg.setColor(0.6, 1.0, 0.9, alpha * (0.6 + 0.4 * Math.sin(T * 5)));
    lg.circle('fill', -3, -42, 1.6); lg.circle('fill', 3, -42, 1.6);
    // crooked staff with an orb
    lg.setColor(0.3, 0.22, 0.14, alpha); lg.setLineWidth(3);
    lg.line(30, -46, 34, 30);
    lg.setColor(0.6, 1.0, 0.9, alpha * (0.7 + 0.3 * Math.sin(T * 7)));
    lg.circle('fill', 30, -50, 6);
    lg.setLineWidth(1);
    lg.pop();
  }

  // jagged lightning bolt from the witch's staff down onto the hero's floor
  function drawLightning(intensity) {
    const p = player;
    const x0 = p.x + 70, y0 = FLOOR3 - 350, x1 = l3.end.holeX || p.x, y1 = FLOOR3;
    const rng = love.math.newRandomGenerator(Math.floor(T * 30));
    let px = x0, py = y0;
    const segs = 10;
    lg.setColor(0.8, 0.95, 1.0, intensity);
    lg.setLineWidth(4);
    for (let i = 1; i <= segs; i++) {
      const k = i / segs;
      const nx = lerp(x0, x1, k) + (rng.random() - 0.5) * 46 * (1 - k);
      const ny = lerp(y0, y1, k);
      lg.line(px, py, nx, ny);
      px = nx; py = ny;
    }
    lg.setColor(0.6, 0.85, 1.0, intensity * 0.4);
    lg.setLineWidth(9);
    lg.line(x0, y0, x1, y1);
    lg.setLineWidth(1);
  }

  const L3_TORCHES_HALL = [[300, 300], [900, 300], [1500, 300], [2300, 300], [2760, 300], [3300, 300]];
  const L3_TORCHES_SALOON = [[3900, 300], [4400, 300], [4900, 300], [5400, 300], [5900, 300]];

  function drawEnts3() {
    // torches only exist once the candle has lit the halls
    if (l3.lit) {
      const torches = L3_TORCHES_HALL.concat(L3_TORCHES_SALOON);
      for (const tc of torches) {
        const fl = 0.75 + 0.25 * Math.sin(T * 9 + tc[0]);
        lg.setColor(0.30, 0.20, 0.12, l3.litT);
        lg.rectangle('fill', tc[0] - 2, tc[1], 4, 16);
        lg.setColor(1.0, 0.62, 0.2, 0.85 * fl * l3.litT);
        lg.circle('fill', tc[0], tc[1] - 4, 5);
        lg.setColor(1.0, 0.85, 0.4, 0.9 * fl * l3.litT);
        lg.circle('fill', tc[0], tc[1] - 5, 2.4);
        lg.setColor(1.0, 0.6, 0.25, (0.05 + 0.04 * fl) * l3.litT);
        lg.circle('fill', tc[0], tc[1] - 4, 60);
      }
    }
    drawKey(l3.key);
    for (const g of l3.gates) drawGate(g);
    drawCandle(l3.candle);
    for (const sk of l3.skels) drawSkel(sk);
    for (const bt of l3.biters) drawBiter(bt);
    if (l3.boss) drawBoss();
    // witch + lightning during the finale
    if (l3.end.stage >= 1) {
      const wa = smooth(clamp(l3.end.stage === 1 ? l3.end.t / 1.4 : 1, 0, 1));
      drawWitch(wa);
      if (l3.end.stage === 2 && l3.end.t < 0.4) drawLightning(1 - l3.end.t / 0.4);
      else if (l3.end.stage === 1 && l3.end.t > 1.8) drawLightning((l3.end.t - 1.8) * 1.5 % 1 * 0.4);
    }
    // as the hero drops into the dark, the magic carpet swoops in to catch it
    if (l3.end.stage === 3 && l3.end.t > 0.35) {
      const pl = player;
      const rise = clamp((l3.end.t - 0.35) / 0.8, 0, 1);
      const gy = pl.y + lerp(210, 96, rise);   // slides up to just under the hero's feet
      drawFlyingCarpet(pl.x, gy, 1.5);
    }
  }

  // Heavy darkness over the whole scene until the candle is lit. A soft warm
  // pool travels with the hero so the near ground stays readable.
  function drawDark3() {
    const veil = 0.80 * (1 - l3.litT);
    if (veil <= 0.001) return;
    const sx = VW / 2 + (player.x - cam.x) * cam.zoom;
    const sy = VH / 2 + (player.y - cam.y) * cam.zoom;
    lg.setColor(0.01, 0.01, 0.02, veil);
    lg.rectangle('fill', 0, 0, VW, VH);
    for (let i = 7; i >= 1; i--) {
      lg.setColor(0.85, 0.72, 0.45, 0.05 * (1 - l3.litT));
      lg.circle('fill', sx, sy - 44, i * 30);
    }
  }

  // -------------------------------------------------------------- LEVEL MGMT
  function initLevel(n) {
    level = n;
    if (n === 1) { plats = plats1; checkpoints = checkpoints1; }
    else if (n === 2) { plats = plats2; checkpoints = checkpoints2; }
    else { plats = plats3; checkpoints = checkpoints3; }
    buildLevel();
    respawn = { x: checkpoints[0].x, y: checkpoints[0].y };
    cine.on = false; cine.stage = 0; cine.t = 0;
    cine.titleA = 0; cine.subA = 0; cine.boxA = 0; cine.hintA = 0;
    musicVol = 0;
    if (musicSrc) {
      musicSrc.stop(); musicSrc.setVolume(0);
      if (n >= 2) musicSrc.play();
    }
    if (n === 2) initEnts2();
    if (n === 3) initEnts3();
    // snap the spawn onto the actual floor under the checkpoint and start
    // grounded, so the hero can never show a mid-air "falling" pose at the start
    const groundY = floorAt(checkpoints[0].x, checkpoints[0].y - 4);
    const spawnY = (groundY != null) ? groundY : checkpoints[0].y;
    player = newPlayer(checkpoints[0].x, spawnY);
    // actively resolve the spawn onto solid ground before the first frame is
    // ever drawn, so the hero always starts standing (never mid-air/falling)
    for (let i = 0; i < 8 && !player.onGround; i++) { player.vy = 260; moveAndCollide(player, 1 / 60); }
    // robust fallback: if the drop-resolve didn't reach a floor (deep gap under
    // the checkpoint, e.g. a saved editor level), snap onto the nearest floor
    if (!player.onGround) {
      const fy = floorAt(player.x, player.y);
      if (fy != null) player.y = fy;
    }
    player.vy = 0;
    player.state = 'ground'; player.onGround = true; player.coyote = COYOTE;
    // the hero carries the sword learned in the keep into the black halls.
    // Level 2 normally teaches the sword via its pickup puzzle, so only hand it
    // over there when a debug jump drops us straight into it.
    if (n === 3 || (DEBUG && n === 2)) { player.hasSword = true; player.drawT = 0; }
    player.spawnFloor = player.y; player.initGrace = 0.5; player.startGuard = 3.5;
    // the safe spawn the start-guard returns to (guaranteed on solid ground)
    player.safeX = player.x; player.safeY = player.y;
    resetScarf(...neckPos(player));
    cam.x = player.x + 70; cam.y = player.y - 130; cam.zoom = 1;
    introT = 0;
  }
  love.initLevel = initLevel;

  function updatePlayer(dt, p) {
    p.t = p.t + dt;
    p.regrab = Math.max(0, p.regrab - dt);
    p.jbuf = Math.max(0, p.jbuf - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    p.landT = Math.max(0, p.landT - dt);
    p.atkT = Math.max(-1, (p.atkT || 0) - dt);
    p.drawT = Math.max(0, (p.drawT || 0) - dt);
    p.inv = Math.max(0, (p.inv || 0) - dt);
    p.blockT = Math.max(0, (p.blockT || 0) - dt);
    p.riposte = Math.max(0, (p.riposte || 0) - dt);
    p.blockFlash = Math.max(0, (p.blockFlash || 0) - dt);
    p.initGrace = Math.max(0, (p.initGrace || 0) - dt);
    p.startGuard = Math.max(0, (p.startGuard || 0) - dt);
    if ((p.riposte || 0) <= 0) p.riposteHits = 0;

    if (p.dying) {
      p.deadFade = p.deadFade + dt * 1.6;
      if (p.deadFade >= 1) {
        // in the keep, dying costs a life; run out of lives → game over
        if (level === 2 && !l2.gameOver) {
          l2.lives = (l2.lives || 0) - 1;
          if (l2.lives <= 0) { l2.gameOver = true; p.deadFade = 1; return; }
        }
        if (level === 3 && !l3.gameOver) {
          l3.lives = (l3.lives || 0) - 1;
          if (l3.lives <= 0) { l3.gameOver = true; p.deadFade = 1; return; }
        }
        respawnPlayer(p); p.dying = false; p.deadFade = 0.999;
      }
      if (!p.dying) return;
    }
    if (p.deadFade > 0 && !p.dying) p.deadFade = Math.max(0, p.deadFade - dt * 1.4);

    if (p.state === 'cine') { updateCine(dt, p); return; }

    // LEVEL 3 finale cutscene: the hero is frozen in place (still subject to
    // gravity) while the witch appears; once the floor shatters it falls freely
    if (level === 3 && l3.cutscene) {
      p.vx = 0;
      p.vy = Math.min(p.vy + GRAV * dt, 1400);
      p.prevVy = p.vy;
      moveAndCollide(p, dt);
      p.state = p.onGround ? 'ground' : 'air';
      return;
    }

    const left = keyLeft(), right = keyRight(), up = keyUp(), down = keyDown();
    let dir = (right ? 1 : 0) - (left ? 1 : 0);

    // at the very start of a level the hero waits, planted on the spawn floor —
    // no gravity, no fall — until the player gives a first input
    if (!p.started) {
      if (left || right || up || down || p.jbuf > 0) { p.started = true; }
      else {
        p.vx = 0; p.vy = 0; p.onGround = true; p.state = 'ground';
        if (p.spawnFloor != null) p.y = p.spawnFloor;
        p.coyote = COYOTE;
        return;
      }
    }

    if (p.state === 'ground' || p.state === 'air') {
      if (up || down) {
        tryGrabWall(p);
        if (p.state === 'climb') { p.jbuf = 0; return; }
      }
      // CROUCH: hold DOWN on the ground to duck. The hero can shuffle slowly
      // while crouched; its head drops low enough to slip under high attacks
      // (see heroTop / the boss's upper sword lane in level 3).
      p.crouch = (p.state === 'ground' && down && !up && p.landT <= 0
        && (p.blockT || 0) <= 0 && (p.atkT || 0) <= 0);
      let max = p.onBeam ? BEAMSPD : RUNSPD;
      if (p.crouch) max = 96;
      if (p.landT > 0) dir = 0;
      // while blocking you hold your ground — you can re-orient to face the
      // attacker but you don't advance or retreat
      if ((p.blockT || 0) > 0) {
        if (dir !== 0 && p.state === 'ground') p.facing = dir;
        dir = 0;
      }

      p.turnT = Math.max(0, (p.turnT || 0) - dt);
      if (p.state === 'ground' && p.landT <= 0 && p.turnT <= 0
        && dir !== 0 && dir !== p.facing && (p.atkT || 0) <= 0) {
        p.turnDur = (Math.abs(p.vx) > 90) ? 0.22 : 0.15;
        p.turnT = p.turnDur;
        p.turnFlip = false;
        if (Math.abs(p.vx) > 120) spawnDust(p.x, p.y, 3, 0.7);
      }
      if (p.turnT > 0 && p.state === 'ground') {
        dir = 0;
        if (p.vx > 0) p.vx = Math.max(0, p.vx - 300 * dt);
        else p.vx = Math.min(0, p.vx + 300 * dt);
        if (!p.turnFlip && p.turnT <= p.turnDur * 0.5) { p.facing = -p.facing; p.turnFlip = true; }
      }

      if (dir !== 0) {
        const acc = p.onGround ? ACC_G : ACC_A;
        p.vx = clamp(p.vx + dir * acc * dt, -max, max);
        p.facing = dir;
      } else {
        const fr = (p.onGround ? FRICT : 300) * dt;
        if (p.vx > 0) p.vx = Math.max(0, p.vx - fr);
        else p.vx = Math.min(0, p.vx + fr);
      }
      if (Math.abs(p.vx) > 20) p.runPhase = p.runPhase + Math.abs(p.vx) * dt * 0.048;

      p.vy = Math.min(p.vy + GRAV * dt, 1400);
      p.prevVy = p.vy;
      moveAndCollide(p, dt);

      if (p.onGround) {
        if (p.state === 'air') {
          if (p.prevVy > 560) { p.landT = 0.26; spawnDust(p.x, p.y, 6, 1); }
          p.t = 0;
        }
        p.state = 'ground';
        p.coyote = COYOTE;
      } else {
        p.state = 'air';
      }

      // spawn safety net: during the first moments of a level, never let the
      // hero drift into a fall — snap onto any floor beneath if not jumping
      if ((p.initGrace || 0) > 0 && p.state === 'air' && p.vy >= 0 && p.jbuf <= 0) {
        const fy = floorAt(p.x, p.y - 30);
        if (fy != null) { p.y = fy; p.vy = 0; p.onGround = true; p.state = 'ground'; p.coyote = COYOTE; }
      }

      if (p.jbuf > 0 && p.coyote > 0 && p.landT <= 0) {
        p.vy = -JUMPV;
        p.jbuf = 0; p.coyote = 0;
        p.state = 'air'; p.t = 0;
        spawnDust(p.x, p.y, 3, 0.6);
      }

      if (p.state === 'air') {
        tryGrabLedge(p);
        if (p.state === 'air') tryGrabWall(p);
      }

    } else if (p.state === 'hang') {
      const L = p.ledge;
      if (up || p.jbuf > 0) { p.jbuf = 0; startMantle(p); }
      else if (down) { p.state = 'air'; p.regrab = 0.35; p.vy = 40; p.t = 0; }
      else if ((L.side === -1 && left) || (L.side === 1 && right)) {
        p.state = 'air'; p.regrab = 0.35;
        p.vx = -L.side * 60; p.vy = 0; p.t = 0;
      }

    } else if (p.state === 'climb') {
      const F = p.face;
      if (up) p.vy = -CLIMBSPD;
      else if (down) p.vy = CLIMBSPD;
      else p.vy = 0;
      p.y = p.y + p.vy * dt;
      p.runPhase = p.runPhase + Math.abs(p.vy) * dt * 0.035;
      if (p.y - 50 <= F.ytop + 6) {
        p.ledge = { x: F.x, y: F.ytop, side: F.side };
        p.x = F.x + (F.side === -1 ? -13 : 13);
        p.y = F.ytop + 48;
        if (up) startMantle(p); else { p.state = 'hang'; p.t = 0; }
      } else if (p.y - 20 >= (F.bot != null ? F.bot : F.ybot)) {
        p.y = (F.bot != null ? F.bot : F.ybot) + 20;
        p.vy = 0;
      } else if (p.jbuf > 0) {
        p.jbuf = 0;
        p.state = 'air'; p.regrab = 0.35; p.t = 0;
        p.vx = F.side * 250;
        p.vy = -500;
        p.facing = F.side;
      } else if ((F.side === -1 && left) || (F.side === 1 && right)) {
        p.state = 'air'; p.regrab = 0.3; p.t = 0;
      }

    } else if (p.state === 'mantle') {
      const m = p.mant;
      m.t = Math.min(m.dur, m.t + dt);
      const k = m.t / m.dur;
      const ky = smooth(clamp(k / 0.58, 0, 1));
      const kx = smooth(clamp((k - 0.28) / 0.36, 0, 1));
      p.y = lerp(m.sy, m.ty, ky);
      p.x = lerp(m.sx, m.tx, kx);
      if (k >= 1) {
        p.state = 'ground'; p.onGround = true; p.t = 0;
        p.vx = 0; p.vy = 0;
        spawnDust(p.x, p.y, 3, 0.5);
      }
    }

    if (p.onGround) {
      for (const c of checkpoints) {
        if (p.x > c.x && c.y <= respawn.y && c.x >= respawn.x) {
          if (c.x !== respawn.x) respawn = { x: c.x, y: c.y };
        }
      }
    }

    // START-GUARD: for the first seconds of a level the hero can never fall off
    // the world. If it has dropped well below the guaranteed-solid safe spawn
    // (whatever the cause — bad saved level, stray input, edge walk-off), return
    // it there and re-freeze until the player deliberately moves again.
    if ((p.startGuard || 0) > 0 && p.safeY != null && p.vy > 0 && p.y > p.safeY + 48) {
      p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0;
      p.state = 'ground'; p.onGround = true; p.coyote = COYOTE; p.jbuf = 0;
      p.facing = 1;   // face right (toward the level), exactly like a fresh spawn / R
      p.started = false;
      resetScarf(...neckPos(p));
    }

    // the finale fall through the shattered floor is intentional — don't "die"
    if (p.y > respawn.y + 720 && !(level === 3 && l3.end.stage >= 2)) killPlayer(p);

    if (p.x < 14) { p.x = 14; p.vx = Math.max(0, p.vx); }

    if (level === 1 && !cine.on && p.onGround && p.x > CINE_TRIGGER_X) startCine(p);
  }

  // -------------------------------------------------------------- TITLE / OVERLAY
  function printSpaced(text, cx, y, font, spacing, scale) {
    const chars = Array.from(text);
    let total = 0;
    for (const ch of chars) total += font.getWidth(ch) + spacing;
    total = (total - spacing) * scale;
    let x = cx - total / 2;
    for (const ch of chars) {
      lg.print(ch, x, y, 0, scale, scale);
      x = x + (font.getWidth(ch) + spacing) * scale;
    }
  }

  function drawTitle() {
    if (cine.titleA <= 0) return;
    const a = smooth(cine.titleA);
    const scale = 0.94 + 0.06 * a;

    drawEmblem(VW / 2, VH * 0.34, 150, a * 0.10, null);

    lg.setFont(FONT_TITLE);
    const y = VH * 0.26;
    const offs = [[-2, 0], [2, 0], [0, -2], [0, 2], [0, 0]];
    for (const off of offs) {
      if (off[0] === 0 && off[1] === 0) setColA(COL.title, a);
      else lg.setColor(1, 0.85, 0.55, a * 0.10);
      printSpaced('THE RETURN OF THE SHADOW', VW / 2 + off[0], y + off[1], FONT_TITLE, 13, scale);
    }

    if (cine.subA > 0) {
      lg.setFont(FONT_SUB);
      lg.setColor(0.88, 0.80, 0.72, smooth(cine.subA) * 0.9);
      printSpaced('PROLOGUE  ·  THE ASCENT', VW / 2, y + 92, FONT_SUB, 6, 1);
    }
    if (cine.hintA > 0) {
      lg.setFont(FONT_HUD);
      lg.setColor(0.9, 0.85, 0.8, smooth(cine.hintA) * (0.55 + 0.25 * Math.sin(T * 2)));
      const msg = 'Press R to relive the ascent';
      lg.print(msg, VW / 2 - FONT_HUD.getWidth(msg) / 2, VH - 74);
      const msg2 = 'Press ENTER to enter the castle';
      lg.setColor(0.9, 0.85, 0.8, smooth(cine.hintA));
      lg.print(msg2, VW / 2 - FONT_HUD.getWidth(msg2) / 2, VH - 50);
    }
  }

  function drawOverlays() {
    // "NYCOSOFT presents" studio card — a clean black screen with fading text
    if (studio.active) {
      lg.setColor(0, 0, 0, 1);
      lg.rectangle('fill', 0, 0, VW, VH);
      const a = smooth(clamp(studio.t / 0.8, 0, 1)) * smooth(clamp((STUDIO_DUR - studio.t) / 0.8, 0, 1));
      if (FONT_SUB) {
        lg.setFont(FONT_SUB);
        lg.setColor(0.93, 0.90, 0.84, a);
        printSpaced('NYCOSOFT', VW / 2, VH * 0.44, FONT_SUB, 10, 1.15);
        lg.setColor(0.72, 0.68, 0.62, a * 0.85);
        printSpaced('presents', VW / 2, VH * 0.44 + 40, FONT_SUB, 4, 0.7);
      }
      return;
    }

    const black = Math.max(1 - Math.min(introT / 1.8, 1), player.deadFade);
    if (black > 0) {
      lg.setColor(0, 0, 0, black);
      lg.rectangle('fill', 0, 0, VW, VH);
    }

    let locA = 0;
    if (introT > 0.8 && introT < 5.2) {
      locA = Math.min((introT - 0.8) / 1.2, 1) * Math.min((5.2 - introT) / 1.0, 1);
    }
    if (locA > 0) {
      lg.setFont(FONT_LOC);
      lg.setColor(0.94, 0.90, 0.84, locA);
      printSpaced(level === 1 ? 'NORTHERN PEAKS  ·  DUSK'
        : (level === 2 ? "THE WITCH'S KEEP  ·  INNER HALLS" : 'THE BLACK HALLS  ·  THE DEEP VAULTS'),
        VW / 2, VH * 0.16, FONT_LOC, 5, 1);
    }

    // author credit in the bottom-left, a few seconds after the scene opens (once)
    if (showCredit && level === 1) {
      const cA = Math.min((introT - 4.0) / 1.0, 1) * Math.min((10.0 - introT) / 1.4, 1);
      if (cA > 0 && FONT_SUB) {
        lg.setFont(FONT_SUB);
        lg.setColor(0.92, 0.88, 0.80, clamp(cA, 0, 1) * 0.92);
        lg.print('a game by Francesco Nicolosi', 30, VH - 52, 0, 0.82, 0.82);
      }
    }

    let hintA = 0;
    if (introT > 2.5 && introT < 11) {
      hintA = Math.min((introT - 2.5) / 1.2, 1) * Math.min((11 - introT) / 1.5, 1);
    }
    if (hintA > 0 && !cine.on) {
      lg.setFont(FONT_HUD);
      lg.setColor(0.92, 0.88, 0.82, hintA * 0.85);
      const msg = '< >  move    SPACE  jump    UP/DOWN  climb    DOWN  duck / let go';
      lg.print(msg, VW / 2 - FONT_HUD.getWidth(msg) / 2, VH - 52);
    }

    if (level === 2) {
      lg.setFont(FONT_HUD);
      for (let i = 1; i <= 3; i++) {
        const hx = 30 + (i - 1) * 36, hy = 32;
        const full = (player.hp || 0) >= i;
        if (full) lg.setColor(0.85, 0.16, 0.22, 1);
        else lg.setColor(0.25, 0.10, 0.13, 0.8);
        lg.circle('fill', hx - 5, hy - 3, 6.5);
        lg.circle('fill', hx + 5, hy - 3, 6.5);
        lg.polygon('fill', hx - 11, hy - 0.5, hx + 11, hy - 0.5, hx, hy + 12);
        lg.setColor(1, 1, 1, full ? 0.35 : 0.12);
        lg.circle('fill', hx - 6.5, hy - 5, 2);
      }
      // remaining lives — small hooded-hero pips beneath the hearts
      lg.setColor(0.86, 0.83, 0.9, 0.9);
      lg.print('LIVES', 30, 52, 0, 0.85, 0.85);
      for (let i = 0; i < Math.max(0, l2.lives || 0); i++) {
        const lx = 108 + i * 22, ly = 60;
        lg.setColor(0.55, 0.52, 0.66, 1);          // cloak
        lg.polygon('fill', lx - 6, ly + 6, lx + 6, ly + 6, lx, ly - 3);
        lg.setColor(0.9, 0.87, 0.94, 1);           // head
        lg.circle('fill', lx, ly - 4, 3.2);
      }
      if (l2.msgT > 0) {
        lg.setColor(0.94, 0.89, 0.78, Math.min(1, l2.msgT));
        lg.print(l2.msg, VW / 2 - FONT_HUD.getWidth(l2.msg) / 2, VH - 96);
      }
      if (l2.endT > 0) {
        // the hero climbs the stairs first (~1.9s), then the scene fades out
        const a = clamp((l2.endT - 1.9) / 1.6, 0, 1);
        lg.setColor(0, 0, 0, a * 0.92);
        lg.rectangle('fill', 0, 0, VW, VH);
        lg.setFont(FONT_SUB);
        lg.setColor(0.86, 0.82, 0.9, a * 0.9);
        printSpaced('DOWN  INTO  THE  DARK', VW / 2, VH / 2 - 12, FONT_SUB, 6, 1);
      }
      if (l2.gameOver) {
        lg.setColor(0.03, 0.0, 0.02, 0.9);
        lg.rectangle('fill', 0, 0, VW, VH);
        lg.setFont(FONT_SUB);
        lg.setColor(0.72, 0.12, 0.14, 1);
        printSpaced('GAME  OVER', VW / 2, VH / 2 - 28, FONT_SUB, 6, 1);
        lg.setFont(FONT_HUD);
        lg.setColor(0.9, 0.86, 0.82, 0.9);
        const m = 'Press  R  to  try  again';
        lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 24);
      }
    }

    if (level === 3) {
      lg.setFont(FONT_HUD);
      for (let i = 1; i <= 3; i++) {
        const hx = 30 + (i - 1) * 36, hy = 32;
        const full = (player.hp || 0) >= i;
        if (full) lg.setColor(0.85, 0.16, 0.22, 1);
        else lg.setColor(0.25, 0.10, 0.13, 0.8);
        lg.circle('fill', hx - 5, hy - 3, 6.5);
        lg.circle('fill', hx + 5, hy - 3, 6.5);
        lg.polygon('fill', hx - 11, hy - 0.5, hx + 11, hy - 0.5, hx, hy + 12);
        lg.setColor(1, 1, 1, full ? 0.35 : 0.12);
        lg.circle('fill', hx - 6.5, hy - 5, 2);
      }
      lg.setColor(0.86, 0.83, 0.9, 0.9);
      lg.print('LIVES', 30, 52, 0, 0.85, 0.85);
      for (let i = 0; i < Math.max(0, l3.lives || 0); i++) {
        const lx = 108 + i * 22, ly = 60;
        lg.setColor(0.55, 0.52, 0.66, 1);
        lg.polygon('fill', lx - 6, ly + 6, lx + 6, ly + 6, lx, ly - 3);
        lg.setColor(0.9, 0.87, 0.94, 1);
        lg.circle('fill', lx, ly - 4, 3.2);
      }
      // boss "blows remaining" bar, top-centre, while the guardian lives
      if (l3.boss && !l3.boss.dead) {
        const b = l3.boss;
        lg.setFont(FONT_HUD);
        lg.setColor(0.9, 0.3, 0.25, 0.95);
        const gm = 'GUARDIAN';
        lg.print(gm, VW / 2 - FONT_HUD.getWidth(gm) / 2, 22);
        const bw = 320, bx = VW / 2 - bw / 2, by = 42;
        lg.setColor(0.2, 0.06, 0.06, 0.8); lg.rectangle('fill', bx, by, bw, 10);
        lg.setColor(0.85, 0.20, 0.18, 1); lg.rectangle('fill', bx, by, bw * clamp(b.hp / 10, 0, 1), 10);
        lg.setColor(1, 0.8, 0.5, 0.5); lg.rectangle('fill', bx, by, bw, 2);
      }
      if (l3.msgT > 0) {
        lg.setColor(0.94, 0.89, 0.78, Math.min(1, l3.msgT));
        lg.print(l3.msg, VW / 2 - FONT_HUD.getWidth(l3.msg) / 2, VH - 96);
      }
      // lightning flash
      if (l3.flash > 0) {
        lg.setColor(0.9, 0.95, 1.0, clamp(l3.flash / 0.5, 0, 1) * 0.85);
        lg.rectangle('fill', 0, 0, VW, VH);
      }
      // finale fade to black as the hero drops into the dark
      if (l3.end.stage === 3) {
        const a = clamp(l3.end.t / 2.2, 0, 1);
        lg.setColor(0, 0, 0, a);
        lg.rectangle('fill', 0, 0, VW, VH);
        if (a >= 1) {
          lg.setFont(FONT_SUB);
          lg.setColor(0.80, 0.78, 0.86, clamp((l3.end.t - 2.4) / 1.2, 0, 1));
          printSpaced('THE  SHADOW  FALLS', VW / 2, VH / 2 - 18, FONT_SUB, 6, 1);
          lg.setFont(FONT_HUD);
          lg.setColor(0.7, 0.68, 0.76, clamp((l3.end.t - 3.4) / 1.0, 0, 1));
          const m = 'TO  BE  CONTINUED   ·   press  R  to  replay';
          lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 20);
        }
      }
      if (l3.gameOver) {
        lg.setColor(0.03, 0.0, 0.02, 0.9);
        lg.rectangle('fill', 0, 0, VW, VH);
        lg.setFont(FONT_SUB);
        lg.setColor(0.72, 0.12, 0.14, 1);
        printSpaced('GAME  OVER', VW / 2, VH / 2 - 28, FONT_SUB, 6, 1);
        lg.setFont(FONT_HUD);
        lg.setColor(0.9, 0.86, 0.82, 0.9);
        const m = 'Press  R  to  try  again';
        lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 24);
      }
    }

    if (cine.boxA > 0) {
      const h = 58 * smooth(cine.boxA);
      lg.setColor(0.02, 0.015, 0.04, 0.96);
      lg.rectangle('fill', 0, 0, VW, h);
      lg.rectangle('fill', 0, VH - h, VW, h);
    }

    drawTitle();

    lg.setColor(0, 0, 0, 0.16);
    lg.rectangle('fill', 0, 0, VW, 26);
    lg.rectangle('fill', 0, VH - 26, VW, 26);
  }

  // -------------------------------------------------------------- LOVE CALLBACKS
  const PIX = 2;
  let pixCanvas;

  // A saved editor level is only used if its first spawn checkpoint actually
  // rests on one of its platforms — otherwise the hero would fall at the start.
  function overrideGrounded(data, defCps) {
    const cps = (Array.isArray(data.checkpoints) && data.checkpoints.length) ? data.checkpoints : defCps;
    if (!cps || !cps.length) return true;
    const c = cps[0];
    for (const p of data.plats) {
      if (!p.beam && c.x >= p.x && c.x <= p.x + p.w && p.y >= c.y - 4 && p.y <= c.y + 40) return true;
    }
    return false;
  }

  function readLevelOverride(name) {
    const raw = love.filesystem.read(name);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.plats) && data.plats.length > 0) return data;
    } catch (e) { /* ignore */ }
    return null;
  }

  love.load = function () {
    try { console.info('[ROTS] build ' + BUILD + ' — door draw-order + key-use action + live plate gate'); } catch (e) {}
    pixCanvas = lg.newCanvas(VW / PIX, VH / PIX);

    // Loading index.html?reset wipes any level saved from the editor (a bad
    // saved spawn is the usual cause of "the hero falls at the start").
    try {
      if (/[?&](reset|fresh)\b/i.test(window.location.search || '')) {
        localStorage.removeItem('rots:level.lua');
        localStorage.removeItem('rots:level2.lua');
        console.info('[ROTS] Saved level overrides cleared (?reset).');
      }
    } catch (e) {}

    const lv1 = readLevelOverride('level.lua');
    if (lv1 && overrideGrounded(lv1, checkpoints1)) { plats1 = lv1.plats; if (Array.isArray(lv1.checkpoints) && lv1.checkpoints.length > 0) checkpoints1 = lv1.checkpoints; try { console.info('[ROTS] Using saved level.lua override.'); } catch (e) {} }
    else if (lv1) { try { console.warn('[ROTS] Ignoring saved level.lua — its first checkpoint is not on solid ground. Load index.html?reset to remove it.'); } catch (e) {} }
    const lv2 = readLevelOverride('level2.lua');
    if (lv2 && overrideGrounded(lv2, checkpoints2)) { plats2 = lv2.plats; if (Array.isArray(lv2.checkpoints) && lv2.checkpoints.length > 0) checkpoints2 = lv2.checkpoints; try { console.info('[ROTS] Using saved level2.lua override.'); } catch (e) {} }
    else if (lv2) { try { console.warn('[ROTS] Ignoring saved level2.lua — its first checkpoint is not on solid ground. Load index.html?reset to remove it.'); } catch (e) {} }

    buildBackground();
    buildParticles();

    windSrc = love.audio.newSource(genWind(), 'static');
    windSrc.setLooping(true);
    windSrc.setVolume(0);
    windSrc.play();

    musicSrc = love.audio.newSource(genMusic(), 'static');
    musicSrc.setLooping(true);
    musicSrc.setVolume(0);

    sfxSwing = love.audio.newSound(genSwoosh());
    sfxHit = love.audio.newSound(genClang());
    sfxParry = love.audio.newSound(genParry());
    sfxThunder = love.audio.newSound(genThunder());

    FONT_HUD = lg.newFont(15);
    FONT_LOC = lg.newFont(22);
    FONT_SUB = lg.newFont(19);
    FONT_TITLE = lg.newFont('title.ttf', 54);

    buildVolumeControl();
    buildFullscreenControl();

    // ?debug=… — a number boots straight into that level (armed); ?debug=true
    // just enables the number-key level switcher. Debug mode skips the studio
    // card so level-jumping is instant.
    let startLevel = 1;
    try {
      const m = /[?&]debug=([^&]*)/i.exec(window.location.search || '');
      if (m) {
        DEBUG = true;
        const n = Number(decodeURIComponent(m[1]));
        if (Number.isFinite(n) && n >= 1 && n <= 3) startLevel = Math.floor(n);
      }
    } catch (e) {}

    initLevel(startLevel);
    // boot with the "NYCOSOFT presents" studio card (only on a normal first
    // load — never on R, and never in debug mode)
    if (!DEBUG) { studio.active = true; studio.t = 0; }
  };

  // ---------------------------------------------------- master volume control
  // A small HTML slider in the top-right corner (persisted to localStorage).
  function buildVolumeControl() {
    try {
      if (typeof document === 'undefined') return;
      // On phones/tablets the on-screen slider is redundant — the device's own
      // physical volume buttons control loudness. Skip the widget entirely there
      // (audio still starts at a sensible default master volume).
      const coarsePtr = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const touchDev = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
      if (coarsePtr || touchDev) {
        const savedM = parseFloat(localStorage.getItem('rots:vol'));
        love.audio.setMasterVolume(isNaN(savedM) ? 0.6 : Math.max(0, Math.min(1, savedM)));
        return;
      }
      const saved = parseFloat(localStorage.getItem('rots:vol'));
      let vol = isNaN(saved) ? 0.6 : Math.max(0, Math.min(1, saved));
      let last = vol > 0 ? vol : 0.6;
      love.audio.setMasterVolume(vol);

      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;top:12px;right:14px;z-index:60;display:flex;align-items:center;gap:8px;' +
        'padding:6px 11px;border-radius:14px;background:rgba(22,17,30,0.5);' +
        'backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);' +
        'font-family:system-ui,sans-serif;user-select:none;-webkit-user-select:none;';
      const icon = document.createElement('span');
      icon.style.cssText = 'font-size:17px;cursor:pointer;line-height:1;';
      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.01';
      slider.value = String(vol);
      slider.style.cssText = 'width:104px;cursor:pointer;accent-color:#e0894a;';
      function refreshIcon(v) { icon.textContent = v <= 0 ? '🔈' : (v < 0.5 ? '🔉' : '🔊'); }
      function apply(v) {
        love.audio.setMasterVolume(v);
        try { localStorage.setItem('rots:vol', String(v)); } catch (e) {}
        refreshIcon(v);
      }
      refreshIcon(vol);
      slider.addEventListener('input', function () {
        const v = parseFloat(slider.value); if (v > 0) last = v; apply(v);
      });
      icon.addEventListener('click', function () {
        const cur = parseFloat(slider.value);
        if (cur > 0) { last = cur; slider.value = '0'; apply(0); }
        else { slider.value = String(last); apply(last); }
      });
      // keep the game from also reacting to keys while the slider has focus
      box.addEventListener('keydown', function (e) { e.stopPropagation(); });
      box.appendChild(icon); box.appendChild(slider);
      document.body.appendChild(box);

      // On desktop the control stays hidden and only appears while the mouse is
      // moving over the window, auto-hiding after a short idle (like media
      // controls). On touch devices it stays visible.
      box.style.transition = 'opacity 0.35s';
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
      if (coarse || hasTouch) {
        box.style.opacity = '1';
      } else {
        let hideTimer = null;
        const hide = function () { box.style.opacity = '0'; box.style.pointerEvents = 'none'; };
        const show = function () {
          box.style.opacity = '1'; box.style.pointerEvents = 'auto';
          if (hideTimer) clearTimeout(hideTimer);
          hideTimer = setTimeout(hide, 2200);
        };
        hide();
        window.addEventListener('mousemove', show);
        window.addEventListener('mousedown', show);
        box.addEventListener('mouseenter', function () { if (hideTimer) clearTimeout(hideTimer); box.style.opacity = '1'; box.style.pointerEvents = 'auto'; });
        box.addEventListener('mouseleave', show);
      }
    } catch (e) { /* ignore — audio control is non-essential */ }
  }

  // ---------------------------------------------------- fullscreen toggle button
  // A small corner button (desktop AND Android) that toggles fullscreen.
  //   * iPhone/iPad Safari has NO Fullscreen API for web pages (only <video>),
  //     so there the button instead shows "Add to Home Screen" instructions —
  //     launching from the home-screen icon is the only real fullscreen on iOS.
  //   * When already running as a home-screen web app (standalone), we're
  //     effectively fullscreen already, so no button is shown.
  function buildFullscreenControl() {
    try {
      if (typeof document === 'undefined') return;
      const el = document.documentElement || {};
      const ua = (navigator.userAgent || '');
      const iOS = /iP(hone|od|ad)/.test(ua)
        || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);   // iPadOS reports as Mac
      const standalone = (navigator.standalone === true)
        || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      const canFs = !!(el.requestFullscreen || el.webkitRequestFullscreen);

      // launched from the home screen → already fullscreen, nothing to add
      if (standalone) return;

      const btn = document.createElement('div');
      btn.setAttribute('aria-label', 'Fullscreen');
      btn.style.cssText = 'position:fixed;top:66px;right:20px;z-index:61;width:44px;height:38px;' +
        'display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;line-height:1;' +
        'color:rgba(240,232,224,0.92);background:rgba(22,17,30,0.5);border:1px solid rgba(240,220,200,0.28);' +
        'border-radius:12px;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);' +
        '-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:manipulation;';
      function glyph() { btn.textContent = document.fullscreenElement ? '⤡' : '⛶'; }
      glyph();

      // iOS: instructions card (built lazily) explaining Add-to-Home-Screen
      let hint = null;
      function showIosHint() {
        if (!hint) {
          hint = document.createElement('div');
          hint.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:210;' +
            'max-width:82%;padding:16px 18px;border-radius:16px;background:rgba(14,10,20,0.94);' +
            'color:rgba(240,232,224,0.96);font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;' +
            'text-align:center;box-shadow:0 8px 28px rgba(0,0,0,0.55);-webkit-user-select:none;user-select:none;';
          hint.innerHTML = '<b>Fullscreen on iPhone</b><br>' +
            'Safari can’t make a web page fullscreen. To play without the browser bars:' +
            '<br><br>1. Tap the <b>Share</b> button (↑ in a square) at the bottom of Safari.' +
            '<br>2. Choose <b>“Add to Home Screen.”</b>' +
            '<br>3. Open the game from its new home-screen icon.' +
            '<br><span style="display:inline-block;margin-top:12px;padding:7px 16px;' +
            'border:1px solid rgba(240,220,200,0.45);border-radius:10px;cursor:pointer;">Got it</span>';
          hint.addEventListener('click', function () { hint.style.display = 'none'; });
          document.body.appendChild(hint);
        }
        hint.style.display = 'block';
      }

      function toggle(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!canFs) { showIosHint(); return; }   // iOS / unsupported → show A2HS help
        try {
          if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); }
          else { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }
        } catch (err) {}
      }
      btn.addEventListener('click', toggle);
      btn.addEventListener('touchend', toggle, { passive: false });
      document.addEventListener('fullscreenchange', glyph);
      document.addEventListener('webkitfullscreenchange', glyph);
      document.body.appendChild(btn);
    } catch (e) { /* non-essential */ }
  }

  love.update = function (dt) {
    // mobile portrait: the landscape gate (index.html) freezes the world so the
    // hero can't drift/fall/die while the player rotates the device
    if (typeof window !== 'undefined' && window.__ROTS_PAUSED__) return;
    dt = Math.min(dt, 1 / 30);

    // studio card: hold the world frozen (introT pinned at 0 → mountains stay
    // fully black) until the card finishes, then reveal the scene + credit
    if (studio.active) {
      studio.t += dt;
      introT = 0;
      if (studio.t >= STUDIO_DUR) { studio.active = false; introT = 0; showCredit = true; }
      return;
    }

    T = T + dt;
    introT = introT + dt;
    // the author credit is a one-shot: once its display window has passed, don't
    // let a later R-restart of level 1 bring it back
    if (showCredit && introT > 10.5) showCredit = false;

    // GAME OVER freezes the world; only R (keypressed) restarts the level
    if (level === 2 && l2.gameOver) return;
    if (level === 3 && l3.gameOver) return;

    updatePlayer(dt, player);
    updateScarf(dt);
    updateParticles(dt);
    updateCamera(dt, player);

    if (level === 2) updateEnts2(dt);
    if (level === 3) updateEnts3(dt);

    if (level === 1) {
      let target = 0.28 * (0.55 + 0.45 * gust());   // gentler wind
      if (cine.on && cine.stage >= 2) target = 0.09;
      windVol = lerp(windVol, target, Math.min(1, dt * 1.5));
      windSrc.setVolume(windVol);
      windSrc.setPitch(0.9 + 0.22 * gust(1.7));
      if (cine.on && cine.stage >= 3) {
        musicVol = Math.min(0.85, musicVol + dt * 0.20);
        musicSrc.setVolume(musicVol);
      }
    } else {
      windVol = lerp(windVol, 0, Math.min(1, dt * 2.5));
      windSrc.setVolume(windVol);
      musicVol = lerp(musicVol, 0.36, Math.min(1, dt * 0.6));
      musicSrc.setVolume(musicVol);
    }
  };

  love.draw = function () {
    const dims = lg.getDimensions();
    const W = dims[0], H = dims[1];
    const S = Math.min(W / VW, H / VH);
    const ox = (W - VW * S) / 2, oy = (H - VH * S) / 2;

    lg.setCanvas(pixCanvas);
    lg.clear(0, 0, 0, 1);
    lg.push();
    lg.scale(1 / PIX);

    if (level === 1) drawBackground(cam); else drawBackground2(cam);

    lg.push();
    lg.translate(VW / 2, VH / 2);
    lg.scale(cam.zoom);
    lg.translate(-cam.x, -cam.y);

    if (level === 1) drawCastle(CASTLE_X, PROM_Y);
    drawPlats();
    if (level === 1) drawFlyingCarpet(-120, 1420, 1.7);   // magic carpet hovering over the high left cliff
    if (level === 2) drawEnts2();
    if (level === 3) drawEnts3();
    drawDusts();
    // during the stair-climb finale the real hero is replaced by the backlit
    // climber (drawn inside drawEnts2), so hide the normal hero + scarf
    if (!(level === 2 && l2.endStage > 0)) {
      drawScarf();
      drawHero(player);
    }

    lg.pop();

    // heavy darkness over the black halls until the candle is found
    if (level === 3) drawDark3();

    if (level === 1) {
      const altFade = clamp((1250 - cam.y) / 500, 0, 1);
      drawScreenParticles(altFade);
    }

    lg.pop();
    lg.setCanvas();

    lg.push();
    lg.translate(ox, oy);
    lg.scale(S);
    lg.setColor(1, 1, 1, 1);
    lg.draw(pixCanvas, 0, 0, 0, PIX, PIX);

    drawOverlays();

    // tiny build tag (bottom-left) — if this shows an OLD date the browser is
    // serving a cached copy; hard-reload (Cmd+Shift+R) to load the latest code
    if (FONT_HUD) {
      lg.setFont(FONT_HUD);
      lg.setColor(1, 1, 1, 0.35);
      lg.print('build ' + BUILD, 10, VH - 22, 0, 0.8, 0.8);
    }

    lg.pop();

    lg.setColor(0, 0, 0);
    if (ox > 0) {
      lg.rectangle('fill', 0, 0, ox, H);
      lg.rectangle('fill', W - ox, 0, ox, H);
    }
    if (oy > 0) {
      lg.rectangle('fill', 0, 0, W, oy);
      lg.rectangle('fill', 0, H - oy, W, oy);
    }
  };

  love.keypressed = function (key) {
    if (key === 'escape') { love.event.quit(); }
    // debug (?debug=…): number keys jump straight to a level
    if (DEBUG && (key === '1' || key === '2' || key === '3')) { initLevel(Number(key)); return; }
    if (key === 'r') { initLevel(level); return; }
    if (key === 'return' && level === 1 && cine.on && cine.stage >= 3) { initLevel(2); return; }
    if (key === 'space' || key === 'z' || key === 'k') { player.jbuf = JBUF; }
    const riposteReady = (player && (player.riposte || 0) > 0 && (player.riposteHits || 0) > 0);
    if ((key === 'x' || key === 'f') && (level === 2 || level === 3) && player.hasSword
      && (player.state === 'ground' || player.state === 'air')
      && (player.drawT || 0) <= 0
      && ((player.atkT || 0) <= -0.10 || riposteReady)) {   // riposte bypasses cooldown → double attack
      player.atkT = ATK_DUR;
      player.blockT = 0;
      if (player.onGround) player.vx += player.facing * (riposteReady ? 80 : 45);
      if (sfxSwing) sfxSwing.play(riposteReady ? 0.44 : 0.38, (riposteReady ? 0.85 : 0.95) + love.math.random() * 0.18);
    }
    // block / parry (Level 2 / 3, with a sword)
    if (key === 'c' && (level === 2 || level === 3) && player.hasSword && (player.atkT || 0) <= 0
      && (player.state === 'ground' || player.state === 'air')) {
      player.blockT = BLOCK_DUR;
    }
  };

  // expose a couple of read-only bits for the touch overlay
  love._game = { getLevel: function () { return level; }, hasSword: function () { return player && player.hasSword; } };

  // read-only hooks used by the headless verification harness (harmless in prod)
  love._debug = {
    player: function () { return player; },
    l2: function () { return l2; },
    l3: function () { return l3; },
    giveSword: function () { player.hasSword = true; player.drawT = 0; },
    drawHero: function () { drawHero(player); },
    drawSkel: function (sk) { drawSkel(sk); },
    setT: function (v) { T = v; },
    climbSetup: function () {
      if (faces.length) {
        const F = faces[0];
        player.face = F; player.facing = -F.side;
        player.x = F.x + F.side * 12.5; player.y = F.bot - 120;
        player.state = 'climb'; player.vy = -CLIMBSPD; player.iksState = null; player.climbPh = 0;
      }
    },
    climbStep: function () { player.vy = -CLIMBSPD; },
  };

})();
