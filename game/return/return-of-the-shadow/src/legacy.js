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
//
//  NOTE: this file is the yet-to-be-split remainder of the original game.js.
//  It is being carved into src/core, src/characters, src/levels and src/art in
//  incremental steps (see plans/modularization-refactor.md). It is no longer
//  wrapped in an IIFE: `lg` and the `RTS` namespace come from
//  core/00-namespace.js, which loads first, and resolve here by name because
//  ordered classic scripts share one top-level scope.
// ============================================================================
'use strict';

  // CONSTANTS + COL palette moved to core/01-constants.js

  // UTILITY moved to core/02-utils.js

  // LEVEL DATA moved to core/03-level-data.js

  let level = 1;
  let plats, checkpoints;

  // -------------------------------------------------------------- AUDIO (procedural)
  let windSrc, musicSrc, battleSrc;
  let sfxSwing, sfxHit, sfxParry, sfxThunder;
  let musicVol = 0, windVol = 0, battleVol = 0;
  let bossWasFighting = false;   // rising-edge latch: rewind the battle theme when the fight starts

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

  // Boss battle theme — loaded from an audio file ("Persian Neon Battle", an
  // 8-bit Middle-Eastern track). See BATTLE_MUSIC_URL / battleSrc below; it
  // crossfades in while the L3 guardian is alive and back out when it dies.
  // The ?v= cache-buster only matters over http(s) (mobile Safari caches hard);
  // on file:// we skip it so the query never confuses local file resolution.
  const BATTLE_MUSIC_URL = 'battle-theme.mp3' +
    ((typeof location !== 'undefined' && location.protocol === 'file:') ? '' : ('?v=' + BUILD));

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

  // ROCK/STONE + brick masonry primitives moved to art/shared-art.js

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
      } else if (level === 5) {
        // dark basalt cavern rock with a lava-lit rim
        const thin = p.h < 60;   // a floating ledge vs. a full-height rock body
        // thin ledges are drawn with a solid stone body under them so they read
        // as carved steps of ground, not thin bars floating over a hole
        const drawH = thin ? Math.max(p.h, 52) : p.h;
        lg.setColor(0.14, 0.10, 0.11, 1);
        lg.rectangle('fill', p.x, p.y, p.w, drawH);
        lg.setColor(0.19, 0.14, 0.15, 1);
        lg.rectangle('fill', p.x, p.y, p.w, Math.min(drawH, 40));
        if (thin) {   // a shaded underside so the step looks solid and grounded
          lg.setColor(0.07, 0.05, 0.06, 1);
          lg.rectangle('fill', p.x, p.y + drawH - 4, p.w, 4);
        }
        // scattered fissures — ONLY within a full-height rock body (never below a
        // thin floating ledge, where they'd hang in mid-air)
        if (!thin) {
          const bodyH = Math.min(p.h, 900);
          lg.setColor(0.06, 0.045, 0.05, 0.7);
          const nCr = Math.max(2, Math.floor(p.w / 120));
          for (let ci = 0; ci < nCr; ci++) {
            let cx = p.x + 12 + rng.random() * (p.w - 24), cy = p.y + 16 + rng.random() * bodyH * 0.5;
            lg.setLineWidth(2);
            for (let s = 0; s < 3; s++) {
              const nx = cx + (rng.random() - 0.5) * 22, ny = cy + 14 + rng.random() * 28;
              if (ny > p.y + p.h - 4) break;   // keep the crack inside the rock body
              lg.line(cx, cy, nx, ny); cx = nx; cy = ny;
            }
          }
          lg.setLineWidth(1);
        }
        // warm lava-lit top edge
        lg.setColor(1.0, 0.5, 0.16, 0.5);
        lg.rectangle('fill', p.x, p.y, p.w, 2);
        lg.setColor(1.0, 0.4, 0.12, 0.14);
        lg.rectangle('fill', p.x, p.y, p.w, 8);
        // climbable LEFT face — a ladder of small jutting handhold rocks so the
        // player can see the wall can be climbed
        if (p.climbL) {
          const ranges = (p.climbRanges && p.climbRanges.length)
            ? p.climbRanges
            : [{ top: p.y, bot: Math.min((p.climbBot != null ? p.climbBot : p.y + p.h), p.y + p.h - 20) }];
          const crng = love.math.newRandomGenerator((pi + 1) * 131 + 7);
          for (const r of ranges) {
            const yStart = r.top + HOLDSTEP;
            const yEnd = Math.min(r.bot, p.y + p.h - 20);
            for (let y = yStart; y < yEnd; y += HOLDSTEP) {
              const ww = 8 + crng.random() * 7;
              lg.setColor(0.23, 0.16, 0.15, 1); lg.rectangle('fill', p.x - ww, y, ww + 3, 6);
              lg.setColor(1.0, 0.5, 0.2, 0.45); lg.rectangle('fill', p.x - ww, y, ww + 3, 2);
              lg.setColor(0, 0, 0, 0.4); lg.rectangle('fill', p.x - ww, y + 5, ww + 3, 2);
            }
          }
        }
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
          // keep the whole blob (radius r) inside the rock body so it never
          // spills over the pillar's edge
          let r = 8 + rng.random() * 20;
          r = Math.min(r, (p.w - 20) / 2);
          const cx = p.x + 10 + r + rng.random() * Math.max(0, p.w - 20 - 2 * r);
          const cy = p.y + 18 + r + rng.random() * Math.max(0, hLim - 36 - 2 * r);
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

  // WITCH EMBLEM + CASTLE + FLYING CARPET moved to art/shared-art.js

  // PARTICLES moved to core/04-particles.js

  // PLAYER (entity, cape, poses, drawHero) moved to characters/player.js

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
    const gateSet = level === 2 ? l2.gates : (level === 3 ? l3.gates : (level === 5 ? l5.gates : null));
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
  let IMMORTAL = false;   // enabled by ?immortal=true — the hero never takes damage

  // -------------------------------------------------------------- SAVE / TITLE
  // The furthest level reached is stored in localStorage, but only from Level 2
  // on (Level 1 never saves). On the next visit a title screen offers to
  // Continue from that level or start a New Game (which wipes the save).
  const SAVE_KEY = 'rots:progress';
  function saveProgress(n) {
    try { if (n >= 2 && n <= 5) localStorage.setItem(SAVE_KEY, String(n)); } catch (e) {}
  }
  function loadProgress() {
    try {
      const v = parseInt(localStorage.getItem(SAVE_KEY), 10);
      return (Number.isFinite(v) && v >= 2 && v <= 5) ? v : 0;
    } catch (e) { return 0; }
  }
  function clearProgress() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  // titleMenu.active freezes the world behind a black title screen with the
  // witch's symbol and a Continue / New Game choice.
  const titleMenu = { active: false, sel: 0, savedLevel: 0, t: 0 };

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

  // kill/respawn helpers moved to characters/player.js

  // -------------------------------------------------------------- LEVEL 2 ENTITIES
  // l2 state + l2toast moved to levels/level2.js
  // tryParry/hurtPlayer moved to characters/player.js
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

  // newSkel/newBiter moved to characters/enemies-l2.js
  // initEnts2 moved to levels/level2.js
  // skelBlockedAt/updateSkel/updateBiter moved to characters/enemies-l2.js
  // updateEnts2/gateById moved to levels/level2.js
  // -------------------------------------------------------------- LEVEL 2 DRAW
  // BONE + drawSkel/drawBiter moved to characters/enemies-l2.js
  // gate/rope/key/lift/end-door draws moved to levels/level2.js
  // drawClimber moved to characters/enemies-l2.js
  // drawCastleDoor2/drawEnts2 moved to levels/level2.js
  // l3 state + consts + holeAt + initEnts3 moved to levels/level3.js
  // boss (spawn/lane/arms/update/hit) moved to characters/enemies-l3.js
  // updateEnts3 moved to levels/level3.js
  // candle/scimitar/flying-sword/boss/witch/lightning draws moved to characters/enemies-l3.js
  // torches + drawEnts3 + rescue carpet + drawDark3 moved to levels/level3.js

  // ============================================================================
  //  LEVEL 5 — THE LAVA CAVERNS
  //  The King wakes deep in a molten cave (a getting-up cutscene). Lava pits spit
  //  fire-balls and kill on contact; skeletons are fought with the blade (a hit
  //  knocks them back — into a pit if one is near). A barred door is opened from
  //  a hidden basement button. The buried magic carpet lies under a rock too
  //  heavy to shift — only the Lava Knight's Fire-Sword can break it: BLOCK
  //  charges the sword with three lava bullets, each loosed by an ATTACK swing.
  //  Once the rock is gone the freed carpet flies him over the blocking lava river.
  // ============================================================================
  const KNIGHT_L = 3900, KNIGHT_R = 4720;
  const l5 = {
    skels: [], biters: [], door: null, gates: [], button: null,
    lava: [], balls: [], bullets: [],
    rock: null, carpet: null, knight: null, swordPickup: null,
    lives: 3, gameOver: false, msg: '', msgT: 0,
    wake: { active: false, stage: 0, t: 0, rise: 0 },
    dialog: { text: '', t: 0, dur: 0 }, dialogDelay: null,
    end: { stage: 0, t: 0 }, flight: null, carpetNear: false,
    riverHinted: false, doorHinted: false, carpetHinted: false, _hitThisSwing: false,
  };
  function l5toast(s) { l5.msg = s; l5.msgT = 3.2; }
  // the hero's spoken lines use the game's usual subtitle dialog box ("The King")
  function l5say(text, dur) { l5.dialog = { text: text, t: 0, dur: dur || 5 }; }

  function lavaAt(x) {
    for (const L of LAVA5) if (x > L.x0 && x < L.x1) return L;
    return null;
  }

  // the Middle-Eastern battle theme underscores the whole of Level 5 (including
  // the cutscenes and the final light-door screen); the ambient theme is silenced
  function driveL5BattleTheme(dt, target) {
    windVol = lerp(windVol, 0, Math.min(1, dt * 2.5)); if (windSrc) windSrc.setVolume(windVol);
    if (musicSrc) { musicVol = lerp(musicVol, 0, Math.min(1, dt * 1.2)); musicSrc.setVolume(musicVol); }
    if (battleSrc) {
      if (!bossWasFighting && battleSrc.rewind) battleSrc.rewind();
      bossWasFighting = true;
      battleVol = lerp(battleVol, target, Math.min(1, dt * 0.9));
      battleSrc.setVolume(battleVol);
    }
  }

  // During the wake-up cutscene the battle theme is held back: only the game's
  // usual lonely ambient score plays. bossWasFighting is kept false so the battle
  // theme rewinds and starts from the top the moment the hero is on his feet.
  function driveL5WakeMusic(dt) {
    windVol = lerp(windVol, 0, Math.min(1, dt * 2.5)); if (windSrc) windSrc.setVolume(windVol);
    if (musicSrc) { musicVol = lerp(musicVol, 0.36, Math.min(1, dt * 0.6)); musicSrc.setVolume(musicVol); }
    if (battleSrc) { battleVol = lerp(battleVol, 0, Math.min(1, dt * 2.2)); battleSrc.setVolume(battleVol); }
    bossWasFighting = false;
  }

  function initEnts5() {
    l5.skels = [
      newSkel(1740, 1600, 1860, true),   // before pit 3 — knock it into the lava
      newSkel(2180, 2070, 2300, true),   // on the thick approach rock
      newSkel(1180, 1010, 1400, true),   // patrols by pit 2
      newSkel(2420, 2340, 2500, true),   // labyrinth: L2 ledge guard
      newSkel(2470, 2410, 2550, true),   // labyrinth: L3 ledge guard
    ];
    for (const s of l5.skels) s.y = floorAt(s.x, 0) || FLOOR5;
    // two flying heads haunting the labyrinth
    l5.biters = [newBiter(2450, 620), newBiter(2400, 980)];
    // the barred door + the hidden button (deep in the labyrinth) that opens it
    l5.door = { id: 'D', x: 2850, w: 20, yTop: 40, yBot: FLOOR5, openT: 0, locked: true, open: false };
    l5.gates = [l5.door];
    l5.button = { x: 2380, y: 1070, w: 54, pressed: false };
    l5.lava = LAVA5;
    l5.balls = []; l5.bullets = [];
    // the magic carpet, pinned under a heavy boulder
    l5.rock = { x: 3320, y: FLOOR5, w: 128, hp: 3, destroyed: false, hitT: 0 };
    l5.carpet = { x: 3320, y: FLOOR5 - 22, state: 'pinned', t: 0 };
    // the mounted Lava Knight patrolling the arena
    l5.knight = {
      x: KNIGHT_R - 60, y: FLOOR5, dir: -1, hp: 5, state: 'gallop',
      active: true, dead: false, deadT: 0, hitCool: 0, ph: 0, flash: 0, swing: 0,
      volley: 3, fireCool: 2.6, pauseT: 0, bolts: [],
    };
    l5.swordPickup = null;
    l5.lives = 3; l5.gameOver = false; l5.msg = ''; l5.msgT = 0;
    l5.wake = { active: true, stage: 0, t: 0, rise: 0 };
    l5.dialog = { text: '', t: 0, dur: 0 }; l5.dialogDelay = null;
    l5.end = { stage: 0, t: 0 }; l5.flight = null; l5.carpetNear = false;
    l5.riverHinted = false; l5.doorHinted = false; l5.carpetHinted = false;
    l5._hitThisSwing = false;
  }

  // ---- the slow wake-up cutscene (black bands, hero gets up off the cave floor)
  function updateWake5(dt) {
    const w = l5.wake, p = player;
    w.t += dt;
    p.vx = 0; p.vy = 0; p.onGround = true; p.state = 'ground'; p.facing = 1;
    if (p.spawnFloor != null) p.y = p.spawnFloor;
    if (w.stage === 0) {                       // full black, hold
      w.rise = 0;
      if (w.t > 1.3) { w.stage = 1; w.t = 0; }
    } else if (w.stage === 1) {                // dim glow — the hero lies still
      w.rise = 0;
      if (w.t > 2.4) { w.stage = 2; w.t = 0; }
    } else if (w.stage === 2) {                // the hero gets up (arms + legs)
      w.rise = clamp(w.t / 0.75, 0, 1);
      if (w.t > 0.75) { w.stage = 3; w.t = 0; w.rise = 1; }
    } else if (w.stage === 3) {                 // location label fades out while bands stay in place
      w.rise = 1;
      if (w.t > 1.55) { w.stage = 4; w.t = 0; }
    } else {                                      // now retract bands, then play begins
      w.rise = 1;
      if (w.t > 0.9) {
        w.active = false;
        l5.dialogDelay = {
          t: 0, wait: 3.0,
          text: 'Where am I…?  Lava on every side — how far did I fall?',
          dur: 5
        };
      }
    }
  }

  // ---- lava-ball emitters: pits belch arcing globs of molten rock
  function spawnLavaBalls(dt) {
    for (const L of l5.lava) {
      if (!L.emit) continue;
      L.cool = (L.cool || 0.6 + love.math.random() * 1.4) - dt;
      if (L.cool <= 0 && l5.balls.length < 120) {
        L.cool = L.river ? 0.5 + love.math.random() * 0.9 : 1.1 + love.math.random() * 1.9;
        const bx = L.x0 + 20 + love.math.random() * (L.x1 - L.x0 - 40);
        l5.balls.push({ x: bx, y: L.y, vx: (love.math.random() - 0.5) * 90,
          vy: -(430 + love.math.random() * 210), r: 7 + love.math.random() * 4, t: 0 });
      }
    }
  }

  function updateEnts5(dt) {
    const p = player;
    l5.msgT = Math.max(0, l5.msgT - dt);
    if (l5.dialogDelay) {
      l5.dialogDelay.t += dt;
      if (l5.dialogDelay.t >= l5.dialogDelay.wait) {
        l5say(l5.dialogDelay.text, l5.dialogDelay.dur);
        l5.dialogDelay = null;
      }
    }
    updateFireCharge(p, dt);   // Fire-Sword: 1s BLOCK hold recharges it (on the ground too)
    // while a scripted beat plays (wake / carpet flight) the hero is invulnerable
    const safe = l5.wake.active || (l5.carpet && l5.carpet.state === 'riding') || l5.end.stage > 0;

    // --- instant death: the hero's feet touch molten lava (same fiery burst the
    //     skeletons throw up when they're shoved in)
    if (!safe && !p.dying && !IMMORTAL) {
      const L = lavaAt(p.x);
      if (L && p.y > L.y - 6 && floorAt(p.x, p.y - 20) === undefined) {
        spawnLavaSplash(p.x, L.y, 18);
        spawnLavaSplash(p.x, L.y, 10);
        spawnDust(p.x, L.y - 10, 8, 1.2);
        if (sfxHit) sfxHit.play(0.55, 0.7);
        p.lavaSink = L.y;   // sink down into the lava (like the skeletons vanishing)
        killPlayer(p);
      }
    }

    // --- lava balls
    spawnLavaBalls(dt);
    for (let i = l5.balls.length - 1; i >= 0; i--) {
      const b = l5.balls[i];
      b.t += dt; b.vy += 1200 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const L = lavaAt(b.x);
      // a ball falling back into lava vanishes; only real (non-splash) balls
      // throw up a small splash — splash droplets never spawn more (no cascade)
      if (b.vy > 0 && L && b.y > L.y) {
        if (!b.splash) spawnLavaSplash(b.x, L.y, 3);
        l5.balls.splice(i, 1); continue;
      }
      if (b.y > FLOOR5 + 700 || b.t > 4) { l5.balls.splice(i, 1); continue; }
      // only real, rising/arcing balls can burn the hero (cosmetic splashes don't)
      if (!b.splash && !safe && !p.dying && (p.inv || 0) <= 0 && Math.abs(b.x - p.x) < b.r + 12
        && b.y > heroTop(p) && b.y < p.y) {
        hurtPlayer(p, b.x < p.x ? -1 : 1);
        l5.balls.splice(i, 1);
      }
    }

    // --- skeletons: fought exactly like the keep (blade stuns + knocks back);
    //     a struck skeleton slides, and if the blow sends it over a pit it falls
    //     into the lava. There is NO walk-into shove — you must use the sword.
    for (const sk of l5.skels) updateSkel(sk, dt, p);
    for (const sk of l5.skels) {
      if (sk.state === 'gone' || sk.state === 'pile') continue;
      if (sk.state === 'fall') {
        const L = lavaAt(sk.x);
        if (L && sk.y > L.y) { spawnLavaSplash(sk.x, L.y, 8); sk.state = 'gone'; }
      }
    }
    // --- flying heads haunting the labyrinth
    for (const bt of l5.biters) updateBiter(bt, dt, p);

    // --- hero sword swing (same combat as L2/L3: the blade stuns skeletons and
    //     hurls them back; the fire blade also looses a lava bullet per swing)
    const au = 1 - (p.atkT || 0) / ATK_DUR;
    if ((p.atkT || 0) > 0 && au > 0.30 && au < 0.56) {
      let didHit = false;
      for (const sk of l5.skels) {
        if (sk.state === 'patrol' || sk.state === 'windup' || sk.state === 'strike') {
          const dx = sk.x - p.x;
          if (dx * p.facing > 0 && Math.abs(dx) < 52 && Math.abs(sk.y - p.y) < 60) {
            sk.state = 'stun'; sk.t = 0; sk.vx = p.facing * 520; didHit = true;   // strong shove toward the pit
            spawnDust(sk.x - p.facing * 8, sk.y - 34, 4, 0.8);
          }
        }
      }
      for (const bt of l5.biters) {   // the blade also cuts down flying heads
        if (bt.state === 'dead') continue;
        const dx = bt.x - p.x;
        if (dx * p.facing > 0 && Math.abs(dx) < 56 && Math.abs(bt.y - (p.y - 30)) < 52) {
          bt.state = 'dead'; bt.dead = 0; spawnDust(bt.x, bt.y, 7, 1.0); didHit = true;
        }
      }
      if (tryHitKnight(p)) didHit = true;
      if (didHit && !l5._hitThisSwing) l5._hitThisSwing = true;
    }
    if ((p.atkT || 0) <= 0) l5._hitThisSwing = false;

    // --- hidden button opens the door permanently
    const bt = l5.button;
    if (bt && !bt.pressed) {
      const playerOnButton = p.onGround && Math.abs(p.x - bt.x) < bt.w * 0.5 + 10 && Math.abs(p.y - bt.y) < 14;
      let skelOnButton = false;
      for (const sk of l5.skels) {
        if (sk.state !== 'gone' && sk.state !== 'fall'
            && Math.abs(sk.x - bt.x) < bt.w * 0.5 + 14 && Math.abs(sk.y - bt.y) < 18) {
          skelOnButton = true;
          break;
        }
      }
      if (playerOnButton || skelOnButton) {
        bt.pressed = true;
        l5.door.open = true;
        l5.door.locked = false;
        if (sfxHit) sfxHit.play(0.5, 0.7);
        l5toast(skelOnButton && !playerOnButton
            ? 'The skeleton presses the hidden switch — the barred door opens'
            : 'A hidden mechanism grinds — the barred door swings open');
      }
    }

    if (l5.door) l5.door.openT = clamp(l5.door.openT + (l5.door.open ? 1 : -1) * dt * 1.6, 0, 1);
    // door hint when the hero reaches it still barred
    if (l5.door && !l5.door.open && Math.abs(p.x - l5.door.x) < 60 && p.onGround && !l5.doorHinted) {
      l5toast('Barred fast — the release must be hidden below'); l5.doorHinted = true;
    }

    // dialog timer (the usual subtitle box)
    if (l5.dialog && l5.dialog.dur > 0) l5.dialog.t += dt;

    // --- the buried carpet + the boulder pinning it
    const rk = l5.rock, cp = l5.carpet;
    if (rk) rk.hitT = Math.max(0, rk.hitT - dt);
    if (cp && cp.state === 'pinned' && !l5.carpetHinted
      && Math.abs(p.x - cp.x) < 90 && p.onGround) {
      l5.carpetHinted = true;   // the King works out what happened, in English
      l5say('The carpet must have saved me during the fall — but then this boulder must have crushed it. And it is far too heavy to move.', 7);
    }
    if (cp && cp.state === 'free') {
      cp.t += dt;
      // hover just above the rubble; a label invites the hero to ride
      l5.carpetNear = (Math.abs(p.x - cp.x) < 130 && p.onGround);
      if (Math.abs(p.x - cp.x) < 70 && p.onGround && keyUp()) {
        cp.state = 'riding'; cp.t = 0;
        startFlight5();
        l5toast('The carpet lifts — away, over the fire!');
      }
    } else { l5.carpetNear = false; }

    // --- the mounted Lava Knight
    updateKnight(dt, p);

    // --- the dropped fire-sword: grants the lava-bullet power
    const sp = l5.swordPickup;
    if (sp && !sp.taken && Math.abs(p.x - sp.x) < 30 && Math.abs(p.y - sp.y) < 60) {
      sp.taken = true; p.lavaSword = true; p.lavaCharge = 0;
      p.sheathed = false; p.swordIdle = 0; p.drawT = DRAW_DUR;   // raise the new blade
      l5toast('The Fire-Sword!  BLOCK to charge it, then ATTACK to loose 3 lava bullets');
    }

    // --- hero lava bullets
    for (let i = l5.bullets.length - 1; i >= 0; i--) {
      const bu = l5.bullets[i];
      bu.t += dt; bu.x += bu.vx * dt; bu.y += bu.vy * dt;
      let gone = bu.t > 1.7;
      if (rk && !rk.destroyed && Math.abs(bu.x - rk.x) < rk.w * 0.5 + 6
        && bu.y > FLOOR5 - 96 && bu.y < FLOOR5 + 4) {
        rk.hp -= 1; rk.hitT = 0.28; gone = true;
        spawnLavaSplash(bu.x, bu.y, 6);
        if (sfxHit) sfxHit.play(0.5, 0.8);
        if (rk.hp <= 0) {
          rk.destroyed = true; l5.carpet.state = 'free';
          spawnDust(rk.x, FLOOR5, 18, 1.6); spawnLavaSplash(rk.x, FLOOR5 - 30, 14);
          l5toast('The boulder bursts — the magic carpet is free!');
        }
      }
      for (const sk of l5.skels) {
        if (sk.state === 'patrol' || sk.state === 'windup' || sk.state === 'strike') {
          if (Math.abs(bu.x - sk.x) < 24 && Math.abs(bu.y - (sk.y - 26)) < 36) {
            sk.state = 'stun'; sk.t = 0; sk.vx = Math.sign(bu.vx) * 380; gone = true;
          }
        }
      }
      for (const bt of l5.biters) {
        if (bt.state !== 'dead' && Math.abs(bu.x - bt.x) < 22 && Math.abs(bu.y - bt.y) < 22) {
          bt.state = 'dead'; bt.dead = 0; spawnDust(bt.x, bt.y, 6, 0.9); gone = true;
        }
      }
      if (gone) l5.bullets.splice(i, 1);
    }

    // --- the lava river: too wide to leap
    if (!l5.riverHinted && p.x > 4650 && p.x < 4820 && p.onGround) {
      l5.riverHinted = true;
      l5toast('A river of lava — far too wide to cross on foot');
    }

    // --- finale card once the carpet lands on the far side
    if (l5.end.stage > 0) l5.end.t += dt;
  }

  function tryHitKnight(p) {
    const k = l5.knight;
    if (!k || k.dead || !k.active || k.hitCool > 0) return false;
    if (Math.abs(p.x - k.x) > 74) return false;
    if (p.facing !== (k.x < p.x ? -1 : 1)) return false;
    if (p.y < FLOOR5 - 96) return false;
    k.hp -= 1; k.hitCool = 0.5; k.flash = 0.3;
    if (sfxHit) sfxHit.play(0.6, 0.85 + love.math.random() * 0.1);
    const away = (p.x >= k.x) ? 1 : -1;
    p.vx = away * 300; p.vy = -150; p.state = 'air'; p.t = 0; p.inv = Math.max(p.inv || 0, 0.35);
    spawnDust(k.x, k.y - 60, 8, 1.1);
    if (k.hp <= 0) {
      k.dead = true; k.deadT = 0; k.active = false; k.bolts.length = 0;
      l5.swordPickup = { x: k.x, y: FLOOR5 - 26, taken: false };
      l5toast('The Lava Knight is unhorsed — take its burning sword');
    } else {
      l5toast('Lava Knight struck!  ' + k.hp + ' blow' + (k.hp === 1 ? '' : 's') + ' remain');
    }
    return true;
  }

  function updateKnight(dt, p) {
    const k = l5.knight;
    if (!k) return;
    k.flash = Math.max(0, k.flash - dt);
    k.hitCool = Math.max(0, k.hitCool - dt);
    if (k.dead) { k.deadT += dt; return; }
    if (l5.wake.active) return;
    const speed = 132 + (5 - k.hp) * 12;   // a touch faster the more wounded it is
    k.x += k.dir * speed * dt;
    k.ph += speed * dt * 0.02;
    if (k.x < KNIGHT_L) { k.x = KNIGHT_L; k.dir = 1; }
    else if (k.x > KNIGHT_R) { k.x = KNIGHT_R; k.dir = -1; }
    // the horse tramples a grounded hero it runs into (jump the charge to dodge)
    if (!p.dying && (p.inv || 0) <= 0 && k.hitCool <= 0
      && Math.abs(p.x - k.x) < 48 && p.y > FLOOR5 - 74) {
      k.hitCool = 0.7; k.swing = 0.3;
      hurtPlayer(p, k.dir);
      spawnDust(p.x, p.y - 30, 6, 1.0);
    }
    k.swing = Math.max(0, k.swing - dt);

    // --- ranged attack: loose THREE lava bullets, then pause, then repeat ---
    if (k.pauseT > 0) {
      k.pauseT -= dt;
      if (k.pauseT <= 0) { k.volley = 3; k.fireCool = 0.3; }   // start the next cycle
    } else {
      k.fireCool -= dt;
      if (k.fireCool <= 0 && k.volley > 0) {
        // aim from the rider's raised blade toward the hero
        const ox = k.x + k.dir * 18, oy = FLOOR5 - 96;
        const tx = p.x, ty = p.y - 30;
        const dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy) || 1;
        const spd = 400;
        k.bolts.push({ x: ox, y: oy, vx: dx / d * spd, vy: dy / d * spd, t: 0, r: 7 });
        k.swing = 0.3;
        if (sfxSwing) sfxSwing.play(0.4, 0.7);
        k.volley -= 1;
        k.fireCool = 0.55;                       // slower gap between the three shots
        if (k.volley <= 0) k.pauseT = 4.0;       // a long pause after the burst
      }
    }
    // move the knight's lava bolts; they burn the hero on contact
    for (let i = k.bolts.length - 1; i >= 0; i--) {
      const b = k.bolts[i];
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.t > 2.6 || b.y > FLOOR5 + 40 || b.x < KNIGHT_L - 400 || b.x > KNIGHT_R + 400) { k.bolts.splice(i, 1); continue; }
      if (!p.dying && (p.inv || 0) <= 0 && Math.abs(b.x - p.x) < b.r + 11 && b.y > heroTop(p) && b.y < p.y) {
        hurtPlayer(p, b.vx < 0 ? -1 : 1);
        spawnLavaSplash(b.x, b.y, 4);
        k.bolts.splice(i, 1);
      }
    }
  }

  function spawnLavaSplash(x, y, n) {
    if (l5.balls.length > 140) return;   // safety cap — splashes are cosmetic
    for (let i = 0; i < n; i++) {
      l5.balls.push({ x: x + (love.math.random() - 0.5) * 24, y: y - 4,
        vx: (love.math.random() - 0.5) * 260, vy: -(120 + love.math.random() * 260),
        r: 3 + love.math.random() * 4, t: 0, splash: true });
    }
  }

  // one lava bullet loosed straight ahead as the charged fire-blade swings
  function fireLavaBullet(p) {
    const hx = p.x + p.facing * 18, hy = p.y - 32;
    l5.bullets.push({ x: hx, y: hy, vx: p.facing * 660, vy: -24, t: 0, r: 6 });
    if (sfxSwing) sfxSwing.play(0.5, 0.6);
  }

  // ------------------------------------------------------------------ L5 art
  function drawLava5() {
    // only draw the on-screen slice of each pool (the river can be very long)
    const camL = cam.x - VW * 0.62 / cam.zoom - 40, camR = cam.x + VW * 0.62 / cam.zoom + 40;
    for (const L of l5.lava) {
      if (L.x1 < camL || L.x0 > camR) continue;
      const x0 = Math.max(L.x0, camL), x1 = Math.min(L.x1, camR), w = x1 - x0;
      if (w <= 0) continue;
      // molten body — a deep, seemingly ENDLESS column that fades from bright red
      // toward the cave's near-black, so the bottom is never visible from inside.
      // Everything is clamped to the pit's own borders (never spills onto the rock).
      const DEPTH = 1600, N = 26;
      for (let i = 0; i < N; i++) {
        const k = i / N;
        lg.setColor(lerp(0.55, 0.055, k), lerp(0.14, 0.02, k), lerp(0.05, 0.02, k), 1);
        lg.rectangle('fill', x0, L.y + i * (DEPTH / N), w, DEPTH / N + 1);
      }
      // bright hot upper band
      lg.setColor(0.9, 0.32, 0.07, 1);
      lg.rectangle('fill', x0, L.y, w, 40);
      // rolling bright surface crust — clamped so it can't overrun the pit borders
      lg.setColor(1.0, 0.62, 0.14, 0.95);
      const step = 22;
      for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
        if (x < L.x0) continue;
        const yy = L.y + Math.sin(x * 0.05 + T * 3) * 4 + Math.sin(x * 0.13 + T * 5) * 2;
        lg.rectangle('fill', Math.max(x, x0), yy, Math.min(step, x1 - Math.max(x, x0)), 6);
      }
      // glow haze rising off the surface (within the pit)
      lg.setColor(1.0, 0.5, 0.12, 0.10);
      lg.rectangle('fill', x0, L.y - 50, w, 50);
      // hot vertical cracks in the upper body (kept inside the borders)
      lg.setColor(1.0, 0.85, 0.4, 0.5 + 0.3 * Math.sin(T * 4 + L.x0));
      for (let x = Math.max(x0 + 16, L.x0 + 16); x < x1 - 4; x += 46) {
        lg.rectangle('fill', x, L.y + 12, 3, 30 + Math.sin(T * 3 + x) * 8);
      }
    }
  }

  function drawLavaBalls() {
    for (const b of l5.balls) {
      lg.setColor(1.0, 0.5, 0.12, 0.18); lg.circle('fill', b.x, b.y, b.r * 2.1);
      lg.setColor(0.95, 0.32, 0.06, 1); lg.circle('fill', b.x, b.y, b.r);
      lg.setColor(1.0, 0.82, 0.3, 1); lg.circle('fill', b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.5);
    }
  }

  function drawLavaBullets() {
    for (const bu of l5.bullets) {
      // motion trail
      lg.setColor(1.0, 0.45, 0.1, 0.18);
      lg.circle('fill', bu.x - bu.vx * 0.012, bu.y - bu.vy * 0.012, bu.r * 1.6);
      lg.setColor(1.0, 0.55, 0.12, 0.4); lg.circle('fill', bu.x, bu.y, bu.r * 1.7);
      lg.setColor(1.0, 0.35, 0.08, 1); lg.circle('fill', bu.x, bu.y, bu.r);
      lg.setColor(1.0, 0.92, 0.5, 1); lg.circle('fill', bu.x - 1.5, bu.y - 1.5, bu.r * 0.45);
    }
  }

  function drawButton5() {
    const b = l5.button;
    if (!b) return;
    const h = b.pressed ? 2 : 6;
    lg.setColor(0.16, 0.13, 0.13, 1);
    lg.rectangle('fill', b.x - b.w / 2 - 4, b.y - 2, b.w + 8, 4);
    lg.setColor(b.pressed ? 0.5 : 0.78, 0.24, 0.14, 1);
    lg.rectangle('fill', b.x - b.w / 2, b.y - h, b.w, h);
    lg.setColor(1.0, 0.6, 0.3, b.pressed ? 0.3 : 0.7 + 0.3 * Math.sin(T * 5));
    lg.rectangle('fill', b.x - b.w / 2, b.y - h, b.w, 1.6);
  }

  function drawRockCarpet5() {
    const rk = l5.rock, cp = l5.carpet;
    // the carpet peeking from under the rock (or hovering, once free)
    if (cp) {
      if (cp.state === 'pinned') {
        // a red-gold corner poking out from beneath the boulder
        lg.setColor(0.58, 0.12, 0.17, 1);
        lg.polygon('fill', cp.x - 70, FLOOR5 - 6, cp.x - 30, FLOOR5 - 14, cp.x - 26, FLOOR5 - 2, cp.x - 74, FLOOR5 + 2);
        lg.setColor(0.86, 0.69, 0.32, 1);
        lg.setLineWidth(2); lg.line(cp.x - 70, FLOOR5 - 6, cp.x - 30, FLOOR5 - 14); lg.setLineWidth(1);
      } else if (cp.state === 'free') {
        const gy = FLOOR5 - 60 + Math.sin(T * 1.6) * 6;
        lg.setColor(1.0, 0.8, 0.4, 0.10 + 0.05 * Math.sin(T * 3));
        lg.circle('fill', cp.x, gy - 6, 60);
        drawFlyingCarpet(cp.x, gy, 1.5);
      }
    }
    if (rk && !rk.destroyed) {
      const jolt = rk.hitT > 0 ? (love.math.random() - 0.5) * 5 * (rk.hitT / 0.28) : 0;
      const x = rk.x + jolt, w = rk.w;
      lg.setColor(0, 0, 0, 0.3); lg.ellipse('fill', x, FLOOR5 + 2, w * 0.55, 8);
      lg.setColor(0.20, 0.18, 0.21, 1);
      lg.polygon('fill', x - w / 2, FLOOR5, x - w * 0.38, FLOOR5 - 78,
        x - w * 0.05, FLOOR5 - 96, x + w * 0.34, FLOOR5 - 80, x + w / 2, FLOOR5);
      lg.setColor(0.29, 0.27, 0.31, 1);
      lg.polygon('fill', x - w * 0.32, FLOOR5 - 66, x - w * 0.05, FLOOR5 - 84,
        x + w * 0.20, FLOOR5 - 70, x + w * 0.02, FLOOR5 - 52);
      lg.setColor(0.10, 0.09, 0.11, 1); lg.setLineWidth(2);
      lg.line(x - w * 0.2, FLOOR5 - 20, x - w * 0.05, FLOOR5 - 58);
      lg.line(x + w * 0.1, FLOOR5 - 10, x + w * 0.18, FLOOR5 - 62);
      lg.setLineWidth(1);
      if (rk.hitT > 0) {   // fresh cracks glowing after a bullet strike
        lg.setColor(1.0, 0.5, 0.15, rk.hitT / 0.28);
        lg.setLineWidth(2);
        lg.line(x - w * 0.15, FLOOR5 - 30, x + w * 0.1, FLOOR5 - 66);
        lg.setLineWidth(1);
      }
    }
  }

  // The Lava Knight: a black steed wreathed in embers, ridden by an armoured
  // rider with a molten scimitar. Fully procedural, drawn in profile.
  function drawKnight5() {
    const k = l5.knight;
    if (!k || (k.dead && k.deadT > 1.4)) return;
    const fade = k.dead ? clamp(1 - k.deadT * 0.7, 0, 1) : 1;
    const f = k.dir;   // facing = travel direction
    lg.push();
    lg.translate(k.x, k.y);
    lg.scale(f, 1);
    if (k.flash > 0) lg.setColor(1, 1, 1, 1);   // (flash handled per-part below)
    const HIDE = [0.10, 0.09, 0.12], HIDE2 = [0.15, 0.13, 0.17], EMBER = [0.95, 0.4, 0.1];
    const fl = k.flash > 0 ? 1.6 : 1;
    const bodyC = [HIDE[0] * fl, HIDE[1] * fl, HIDE[2] * fl, fade];
    const legC = [HIDE2[0] * fl, HIDE2[1] * fl, HIDE2[2] * fl, fade];
    const gallop = Math.sin(k.ph) ;
    // ground shadow
    lg.setColor(0, 0, 0, 0.28 * fade); lg.ellipse('fill', 0, 2, 62, 9);
    // --- horse legs (two pairs, galloping)
    for (const pair of [[-30, 0.0], [34, Math.PI]]) {
      const px = pair[0], phase = pair[1];
      const sw = Math.sin(k.ph * 2 + phase) * 16;
      segment(px, -46, px + sw * 0.4, -20, 5, 4, legC);
      segment(px + sw * 0.4, -20, px + sw, -2, 4, 3, legC);
      const sw2 = Math.sin(k.ph * 2 + phase + 1.0) * 16;
      segment(px + 8, -46, px + 8 + sw2 * 0.4, -20, 5, 4, bodyC);
      segment(px + 8 + sw2 * 0.4, -20, px + 8 + sw2, -2, 4, 3, bodyC);
    }
    // --- horse body
    setColA(bodyC);
    lg.polygon('fill', -44, -58, 40, -60, 48, -42, 34, -34, -40, -36, -50, -48);
    lg.ellipse('fill', -6, -50, 46, 20);
    // tail streaming with embers
    setColA(legC);
    lg.polygon('fill', -44, -56, -70, -40 + gallop * 4, -66, -30, -42, -44);
    lg.setColor(EMBER[0], EMBER[1], EMBER[2], 0.5 * fade);
    lg.circle('fill', -68, -36 + gallop * 4, 3);
    // neck + head, reaching forward
    setColA(bodyC);
    lg.polygon('fill', 40, -62, 62, -86, 74, -80, 58, -54, 44, -50);
    lg.polygon('fill', 66, -84, 86, -82, 84, -70, 66, -72);   // muzzle
    // glowing eye + fiery mane
    lg.setColor(1.0, 0.55, 0.12, fade); lg.circle('fill', 70, -78, 2.2);
    lg.setColor(EMBER[0], EMBER[1], EMBER[2], 0.75 * fade);
    for (let i = 0; i < 5; i++) lg.circle('fill', 40 + i * 5, -70 - i * 3 + Math.sin(T * 6 + i) * 2, 3.2);
    // --- rider (seated), armoured, with a molten scimitar
    const ry = -66;   // saddle top
    const lean = k.swing > 0 ? Math.sin((1 - k.swing / 0.3) * Math.PI) * 0.4 : 0;
    lg.push();
    lg.translate(-2, ry);
    lg.rotate(lean * 0.2);
    setColA([0.13 * fl, 0.12 * fl, 0.16, fade]);
    lg.polygon('fill', -12, 0, 12, 0, 9, -34, -9, -34);   // torso
    segment(-6, -6, -14, 16, 5, 4, legC);                 // near leg down the flank
    // sword arm raised with a glowing blade
    const armA = -0.5 - lean;
    const hx = 8 + Math.cos(armA) * 20, hy = -30 + Math.sin(armA) * 20;
    segment(6, -28, hx, hy, 4.5, 3.5, legC);
    // a molten glow behind the blade, then the SAME curved scimitar the hero
    // wields — same shape/orientation (drawSwordAt uses the body-local sin/cos
    // convention, so armA maps to a = PI/2 - armA)
    lg.setColor(1.0, 0.45, 0.1, 0.4 * fade);
    lg.circle('fill', hx + Math.cos(armA) * 26, hy + Math.sin(armA) * 26, 13);
    drawSwordAt(hx, hy, Math.PI / 2 - armA);
    // hot molten tint over the steel blade
    lg.setColor(1.0, 0.5, 0.12, 0.45 * fade); lg.setLineWidth(3);
    lg.line(hx + Math.cos(armA) * 6, hy + Math.sin(armA) * 6, hx + Math.cos(armA) * 34, hy + Math.sin(armA) * 34);
    lg.setLineWidth(1);
    // helmed head
    setColA([0.16 * fl, 0.14 * fl, 0.18, fade]);
    lg.circle('fill', 0, -40, 8);
    lg.polygon('fill', -8, -40, 8, -40, 6, -52, -6, -52);   // crest
    lg.setColor(1.0, 0.4, 0.1, fade); lg.circle('fill', 4, -40, 1.8);   // eye slit glow
    lg.pop();
    lg.pop();
  }

  function drawEnts5() {
    drawLava5();
    drawButton5();
    for (const g of l5.gates) drawGate(g);
    drawRockCarpet5();
    for (const sk of l5.skels) drawSkel(sk);
    for (const bt of l5.biters) drawBiter(bt);
    drawKnight5();
    // the knight's flung lava bolts
    if (l5.knight && l5.knight.bolts) {
      for (const b of l5.knight.bolts) {
        lg.setColor(1.0, 0.45, 0.1, 0.22); lg.circle('fill', b.x - b.vx * 0.012, b.y - b.vy * 0.012, b.r * 1.7);
        lg.setColor(0.95, 0.32, 0.06, 1); lg.circle('fill', b.x, b.y, b.r);
        lg.setColor(1.0, 0.82, 0.35, 1); lg.circle('fill', b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.5);
      }
    }
    if (l5.swordPickup && !l5.swordPickup.taken) {
      const sp = l5.swordPickup, g = 0.6 + 0.4 * Math.sin(T * 4);
      lg.setColor(1.0, 0.5, 0.15, 0.25 * g); lg.circle('fill', sp.x, sp.y - 14, 16);
      lg.push(); lg.translate(0, Math.sin(T * 3) * 2);
      drawSwordAt(sp.x, sp.y, -1.1);
      // molten tint over the blade
      lg.setColor(1.0, 0.45, 0.1, 0.5 * g);
      lg.circle('fill', sp.x + 12, sp.y - 20, 5);
      lg.pop();
    }
    drawLavaBalls();
    drawLavaBullets();
    // the carpet-flight entities (heads, rising bolts, the door of light)
    if (l5.flight && l5.flight.active) drawFlightEnts();
  }

  // dim, red-lit cave backdrop with distant molten glow
  function drawBackground5(cam) {
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      lg.setColor(0.09 + 0.09 * k, 0.045 + 0.02 * k, 0.05 + 0.02 * k, 1);
      lg.rectangle('fill', 0, VH * k, VW, VH / 16 + 1);
    }
    // rough cave-wall silhouettes (parallax)
    const par = 0.3;
    let ox = (-cam.x * par) % 420;
    if (ox < 0) ox += 420;
    lg.setColor(0.11, 0.06, 0.07, 1);
    for (let i = -1; i <= 4; i++) {
      const ax = ox + i * 420;
      lg.polygon('fill', ax, VH, ax + 40, 300, ax + 120, 360, ax + 210, 250, ax + 300, 340, ax + 380, 300, ax + 420, VH);
    }
    // distant lava glow pooling along the cavern floor
    lg.setColor(0.7, 0.24, 0.06, 0.10 + 0.04 * Math.sin(T * 1.3));
    lg.rectangle('fill', 0, VH * 0.72, VW, VH * 0.28);
    // stalactites hanging from the ceiling
    let ox2 = (-cam.x * 0.5) % 260;
    if (ox2 < 0) ox2 += 260;
    lg.setColor(0.08, 0.05, 0.06, 1);
    for (let i = -1; i <= 6; i++) {
      const ax = ox2 + i * 260;
      lg.polygon('fill', ax, 0, ax + 24, 0, ax + 12, 70 + (i % 3) * 26);
    }
  }

  function drawL5Overlay() {
    const p = player;
    // during a cinematic with black bands (the wake-up), the HUD is hidden
    const hudOff = l5.wake.active;
    if (!hudOff) {
    // hearts + lives (mirrors L2/L3)
    lg.setFont(FONT_HUD);
    for (let i = 1; i <= 3; i++) {
      const hx = 30 + (i - 1) * 36, hy = 32;
      const full = (p.hp || 0) >= i;
      if (full) lg.setColor(0.85, 0.16, 0.22, 1); else lg.setColor(0.25, 0.10, 0.13, 0.8);
      lg.circle('fill', hx - 5, hy - 3, 6.5); lg.circle('fill', hx + 5, hy - 3, 6.5);
      lg.polygon('fill', hx - 11, hy - 0.5, hx + 11, hy - 0.5, hx, hy + 12);
      lg.setColor(1, 1, 1, full ? 0.35 : 0.12); lg.circle('fill', hx - 6.5, hy - 5, 2);
    }
    lg.setColor(0.9, 0.83, 0.8, 0.9);
    lg.print('LIVES', 30, 52, 0, 0.85, 0.85);
    for (let i = 0; i < Math.max(0, l5.lives || 0); i++) {
      const lx = 108 + i * 22, ly = 60;
      lg.setColor(0.62, 0.5, 0.5, 1);
      lg.polygon('fill', lx - 6, ly + 6, lx + 6, ly + 6, lx, ly - 3);
      lg.setColor(0.94, 0.86, 0.84, 1); lg.circle('fill', lx, ly - 4, 3.2);
    }
    // fire-sword power indicator + charge pips
    if (p.lavaSword) {
      lg.setColor(1.0, 0.5, 0.15, 0.9);
      lg.print('FIRE-SWORD', 30, 78, 0, 0.85, 0.85);
      const charged = p.lavaCharge || 0;
      for (let i = 0; i < 3; i++) {
        const cx = 118 + i * 16, cy = 84;
        if (i < charged) { lg.setColor(1.0, 0.45, 0.12, 1); lg.circle('fill', cx, cy, 5); lg.setColor(1.0, 0.9, 0.5, 1); lg.circle('fill', cx - 1.4, cy - 1.4, 2); }
        else { lg.setColor(0.4, 0.2, 0.12, 0.7); lg.circle('line', cx, cy, 5); }
      }
      lg.setColor(0.85, 0.7, 0.6, 0.7);
      lg.print(charged > 0 ? 'ATTACK to fire' : 'BLOCK to charge', 178, 78, 0, 0.8, 0.8);
    }
    // Lava Knight health bar: show it only when the player is close to the knight,
    // not from the beginning of Level 5 while the boss object already exists off-screen.
    if (l5.knight && !l5.knight.dead) {
      const k = l5.knight;
      const nearKnight = Math.abs((p.x || 0) - k.x) < 760 && Math.abs((p.y || 0) - k.y) < 260;
      if (nearKnight) {
        lg.setColor(0.95, 0.4, 0.2, 0.95);
        const gm = 'LAVA  KNIGHT';
        lg.print(gm, VW / 2 - FONT_HUD.getWidth(gm) / 2, 22);
        const bw = 300, bx = VW / 2 - bw / 2, by = 42;
        lg.setColor(0.2, 0.06, 0.04, 0.8); lg.rectangle('fill', bx, by, bw, 10);
        lg.setColor(0.95, 0.35, 0.12, 1); lg.rectangle('fill', bx, by, bw * clamp(k.hp / 5, 0, 1), 10);
        lg.setColor(1, 0.8, 0.4, 0.5); lg.rectangle('fill', bx, by, bw, 2);
      }
    }
    }   // end HUD (hidden during the wake cutscene)
    // toast
    if (l5.msgT > 0) {
      lg.setColor(0.96, 0.88, 0.78, Math.min(1, l5.msgT));
      lg.print(l5.msg, VW / 2 - FONT_HUD.getWidth(l5.msg) / 2, VH - 96);
    }
    // the hero's spoken lines — the game's usual subtitle dialog box ("The King")
    if (l5.dialog && l5.dialog.dur > 0 && l5.dialog.t < l5.dialog.dur) {
      drawSubtitle({ who: 'HERO', text: l5.dialog.text });
    }
    // "Press UP to use the carpet" prompt when standing by the freed carpet
    if (l5.carpetNear && l5.carpet && l5.carpet.state === 'free') {
      const sx = VW / 2 + (l5.carpet.x - cam.x) * cam.zoom;
      const sy = VH / 2 + (l5.carpet.y - 96 - cam.y) * cam.zoom;
      const m = 'Press  ▲  to use the carpet';
      lg.setFont(FONT_HUD);
      const tw = FONT_HUD.getWidth(m), bob = Math.sin(T * 4) * 3;
      lg.setColor(0.05, 0.03, 0.02, 0.8);
      lg.rectangle('fill', sx - tw / 2 - 10, sy - 14 + bob, tw + 20, 26);
      lg.setColor(1.0, 0.72, 0.4, 0.95);
      lg.rectangle('fill', sx - tw / 2 - 10, sy - 14 + bob, tw + 20, 2);
      lg.setColor(0.98, 0.92, 0.82, 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(T * 4)));
      lg.print(m, sx - tw / 2, sy - 8 + bob);
    }
    // wake-up cutscene: black bands + fade + location card
    const w = l5.wake;
    if (w.active) {
      // Keep the cinematic bands fixed during the location label fade-out;
      // retract them only after the label is fully gone.
      const bandH = (w.stage >= 4) ? 58 * clamp((0.9 - w.t) / 0.9, 0, 1) : 58;
      let blackA = 0;
      if (w.stage === 0) blackA = 1;
      else if (w.stage === 1) blackA = clamp(1 - w.t / 1.4, 0.34, 1);
      else if (w.stage === 2) blackA = 0.34;
      else if (w.stage === 3) blackA = 0.34 * clamp(1 - w.t / 1.4, 0, 1);
      else blackA = 0;
      if (blackA > 0) { lg.setColor(0.03, 0.0, 0.0, blackA); lg.rectangle('fill', 0, 0, VW, VH); }
      if (bandH > 0) {
        lg.setColor(0.02, 0.0, 0.0, 0.96);
        lg.rectangle('fill', 0, 0, VW, bandH);
        lg.rectangle('fill', 0, VH - bandH, VW, bandH);
      }
      if (w.stage >= 1 && w.stage <= 3 && FONT_LOC) {
        const a = (w.stage === 1) ? clamp((w.t - 0.4) / 1.0, 0, 1)
          : (w.stage === 2 ? 1 : clamp(1 - w.t / 1.4, 0, 1));
        lg.setFont(FONT_LOC);
        lg.setColor(0.95, 0.8, 0.62, a);
        printSpaced('THE  LAVA  CAVERNS  ·  THE  DEEP', VW / 2, VH * 0.18, FONT_LOC, 5, 1);
      }
    }
    // finale — the King has passed into the door of light; hold on WHITE with a
    // black label
    if (l5.end.stage >= 5) {
      lg.setColor(1, 1, 1, 1); lg.rectangle('fill', 0, 0, VW, VH);   // full white
      const a = clamp((l5.end.t - 0.6) / 1.2, 0, 1);
      if (a > 0 && FONT_SUB) {
        lg.setFont(FONT_SUB);
        lg.setColor(0.08, 0.07, 0.10, a);
        printSpaced('THE  KING  PASSES  INTO  THE  REALM  OF  LIGHT', VW / 2, VH / 2 - 22, FONT_SUB, 4, 0.82);
        lg.setColor(0.16, 0.14, 0.18, a);
        printSpaced('TO  BE  CONTINUED', VW / 2, VH / 2 + 18, FONT_SUB, 6, 1);
        lg.setFont(FONT_HUD);
        lg.setColor(0.3, 0.28, 0.32, a * 0.8);
        const m = 'press  R  to  replay';
        lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 54);
      }
    } else if (l5.end.stage > 0) {
      const a = clamp(l5.end.t / 2.0, 0, 1);
      lg.setColor(0.02, 0.0, 0.0, a * 0.92); lg.rectangle('fill', 0, 0, VW, VH);
      if (a >= 1 && FONT_SUB) {
        lg.setFont(FONT_SUB);
        lg.setColor(0.96, 0.7, 0.4, clamp((l5.end.t - 2.2) / 1.2, 0, 1));
        printSpaced('OUT  OF  THE  DEEP', VW / 2, VH / 2 - 6, FONT_SUB, 6, 1);
        lg.setFont(FONT_HUD);
        lg.setColor(0.85, 0.8, 0.78, 0.8);
        const m = 'press  R  to  replay';
        lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 24);
      }
    }
    if (l5.gameOver) {
      lg.setColor(0.04, 0.0, 0.0, 0.9); lg.rectangle('fill', 0, 0, VW, VH);
      lg.setFont(FONT_SUB); lg.setColor(0.85, 0.2, 0.12, 1);
      printSpaced('GAME  OVER', VW / 2, VH / 2 - 28, FONT_SUB, 6, 1);
      lg.setFont(FONT_HUD); lg.setColor(0.9, 0.86, 0.82, 0.9);
      const m = 'Press  R  to  try  again';
      lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 24);
    }
  }

  // ---------------------------------------------------------------- CARPET FLIGHT
  // A SEAMLESS continuation of the level: the King simply lifts off on the carpet
  // and flies right over the level's own long lava river. Flying-head enemies
  // sweep in from the right and lava bolts rise from the river; he flies up /
  // down / left / right to dodge and looses charged lava bullets to destroy the
  // heads. At the far end a giant door of light swallows him → fade to white.
  const FL = { TOP: 96, BOT: 400, RIVER: 452, ALT: 236, CAMY: 252, SCROLL: 268, VFLY: 340, HFLY: 175 };

  function startFlight5() {
    l5.flight = {
      active: true, phase: 'lift', t: 0,
      heads: [], upBolts: [], headCool: 1.4, boltCool: 1.2,
      startX: player.x, y0: player.y, doorX: DOOR_LIGHT_X, whiteA: 0,
    };
    player.state = 'cine'; player.vx = 0; player.vy = 0; player.facing = 1;
    player.sheathed = false; player.swordIdle = 0;   // fire-sword out for the flight
    player.lavaSword = true; player.lavaCharge = 3;  // start charged so you can fire at once
    player.hp = 3; player.inv = 0.6; player.blockHold = 0;
    l5.bullets.length = 0;
  }

  function flightHurt(p) {
    // already tumbling off the carpet to our death — ignore any further hits this
    // frame (several enemies can overlap the King on the fatal frame)
    if (l5.flight && l5.flight.phase === 'fall') return;
    if (IMMORTAL) { p.inv = Math.max(p.inv || 0, 0.4); return; }
    if ((p.inv || 0) > 0 || p.dying) return;
    p.hp = (p.hp || 3) - 1; p.inv = 1.1; p.blockFlash = 0.2;
    spawnDust(p.x, p.y, 5, 0.9);
    if (sfxHit) sfxHit.play(0.5, 1.0);
    if (p.hp <= 0) {
      // Out of life points. Losing a life must NOT respawn / reposition the King.
      // The old code jumped him back to the lift-off point AND cleared f.heads /
      // f.upBolts while updateFlightEnts was still iterating them — dereferencing
      // the emptied arrays threw and crashed the game on the 3rd hit. Instead he
      // simply stays aloft on the carpet: spend a life, refill the hearts and fly
      // on. Only when the last life AND its hearts are gone does he fall and die.
      if ((l5.lives || 0) > 0) {
        l5.lives -= 1;
        p.hp = 3; p.inv = 1.6; player.lavaCharge = 3; player.blockHold = 0;
        l5toast('A life spent — stay aloft!');
      } else {
        startFlightFall(p);
      }
    }
  }

  // The King has run out of both hearts and lives while over the lava river: he
  // is struck from the carpet and plummets into the fire below. This is a death,
  // not a respawn — the riderless carpet drifts on (see updateFlightFall and the
  // fall-phase branch in the level-5 draw). Placing the flight into the 'fall'
  // phase also stops updateFlightEnts from running, so no more hits land.
  function startFlightFall(p) {
    const f = l5.flight;
    f.phase = 'fall'; f.t = 0; f.splashed = false;
    p.hp = 0; p.inv = 0; p.atkT = 0;
    p.state = 'air'; p.onGround = false;
    p.vy = -150; p.vx = -70; p.facing = -1;   // knocked backward off the carpet
    spawnDust(p.x, p.y, 8, 1.0);
    if (sfxHit) sfxHit.play(0.6, 0.75);
    l5toast('Struck from the carpet!');
  }

  // 1-second HOLD-to-charge; you cannot shoot while charging (applies on the
  // ground too, wherever the Fire-Sword is used)
  const CHARGE_TIME = 1.0;
  function updateFireCharge(p, dt) {
    if (!(level === 5 && p.lavaSword)) return;
    const blocking = love.keyboard.isDown('c');
    if (blocking && (p.lavaCharge || 0) < 3) {
      p.blockHold = (p.blockHold || 0) + dt;
      p.blockT = Math.max(p.blockT || 0, 0.15);   // hold the block pose while charging
      if (p.blockHold >= CHARGE_TIME) {
        p.lavaCharge = 3; p.blockHold = 0; p.blockFlash = 0.28;
        l5toast('The Fire-Sword blazes — 3 lava bullets ready');
      }
    } else {
      p.blockHold = 0;
    }
  }
  // true while the block is being held to recharge (blocks shooting)
  function fireCharging(p) { return (p.blockHold || 0) > 0; }

  function updateFlightEnts(dt) {
    const f = l5.flight, p = player;
    const au = 1 - (p.atkT || 0) / ATK_DUR;
    const swordActive = (p.atkT || 0) > 0 && au > 0.30 && au < 0.62;
    let swordHit = false;
    for (let i = f.heads.length - 1; i >= 0; i--) {
      const h = f.heads[i];
      h.t += dt;
      if (h.state === 'dead') { h.dead += dt; if (h.dead > 0.5) f.heads.splice(i, 1); continue; }
      h.x += h.vx * dt;
      h.y = clamp(h.y + h.vy * dt + Math.sin((T + h.ph) * 3) * 26 * dt, FL.TOP, FL.BOT);
      if (h.x < cam.x - VW * 0.72) { f.heads.splice(i, 1); continue; }
      // Normal sword hit while riding the carpet: short forward melee arc.
      if (swordActive) {
        const dx = h.x - p.x;
        if (dx * p.facing > 0 && Math.abs(dx) < 70 && Math.abs(h.y - (p.y - 28)) < 56) {
          h.state = 'dead'; h.dead = 0; swordHit = true;
          spawnDust(h.x, h.y, 7, 1.0);
          continue;
        }
      }
      if ((p.inv || 0) <= 0 && Math.abs(h.x - p.x) < 24 && Math.abs(h.y - (p.y - 18)) < 24) {
        flightHurt(p); h.state = 'dead'; h.dead = 0;
      }
    }
    if (swordHit && !l5._hitThisSwing) {
      if (sfxHit) sfxHit.play(0.5, 1.05 + love.math.random() * 0.18);
      l5._hitThisSwing = true;
    }
    if ((p.atkT || 0) <= 0) l5._hitThisSwing = false;
    for (let i = f.upBolts.length - 1; i >= 0; i--) {
      const b = f.upBolts[i];
      b.t += dt; b.vy += 55 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < FL.TOP - 90 || b.t > 4.5) { f.upBolts.splice(i, 1); continue; }
      if ((p.inv || 0) <= 0 && Math.abs(b.x - p.x) < b.r + 12 && Math.abs(b.y - (p.y - 18)) < b.r + 18) {
        flightHurt(p); f.upBolts.splice(i, 1);
      }
    }
    for (let i = l5.bullets.length - 1; i >= 0; i--) {
      const bu = l5.bullets[i];
      bu.t += dt; bu.x += bu.vx * dt; bu.y += bu.vy * dt;
      let gone = bu.t > 1.6 || bu.x > cam.x + VW * 0.62;
      for (const h of f.heads) {
        if (h.state === 'dead') continue;
        if (Math.abs(bu.x - h.x) < 24 && Math.abs(bu.y - h.y) < 24) {
          h.state = 'dead'; h.dead = 0; gone = true;
          spawnDust(h.x, h.y, 6, 0.9);
          if (sfxHit) sfxHit.play(0.5, 1.2);
        }
      }
      if (gone) l5.bullets.splice(i, 1);
    }
  }

  function updateFlight5(dt) {
    const f = l5.flight, p = player, cp = l5.carpet;
    f.t += dt; cp.t += dt;
    p.inv = Math.max(0, (p.inv || 0) - dt);
    p.blockFlash = Math.max(0, (p.blockFlash || 0) - dt);
    p.blockT = Math.max(0, (p.blockT || 0) - dt);
    p.atkT = Math.max(-1, (p.atkT || 0) - dt);
    p.drawT = Math.max(0, (p.drawT || 0) - dt);
    p.lavaCharge = p.lavaCharge || 0;

    // death fall: the King has been thrown off the carpet into the lava
    if (f.phase === 'fall') { updateFlightFall(dt); return; }

    p.state = 'ground'; p.onGround = true; p.vx = 0; p.facing = 1;   // standing pose on the carpet
    cp.x = p.x; cp.y = p.y;

    if (f.phase === 'lift') {
      const k = smooth(clamp(f.t / 1.3, 0, 1));
      p.y = lerp(f.y0, FL.ALT, k);
      p.x = f.startX + f.t * 140;
      cam.x = lerp(cam.x, p.x + 190, Math.min(1, dt * 3)); cam.y = lerp(cam.y, FL.CAMY, Math.min(1, dt * 3)); cam.zoom = 1;
      if (f.t > 1.3) { f.phase = 'run'; f.t = 0; }
      return;
    }

    if (f.phase === 'run') {
      updateFireCharge(p, dt);
      const up = keyUp(), down = keyDown(), left = keyLeft(), right = keyRight();
      let vy = 0; if (up) vy -= FL.VFLY; if (down) vy += FL.VFLY;
      p.y = clamp(p.y + vy * dt, FL.TOP, FL.BOT);
      let vx = FL.SCROLL; if (right) vx += FL.HFLY; if (left) vx -= FL.HFLY * 0.8;
      p.x += vx * dt;
      cam.x = lerp(cam.x, p.x + 190, Math.min(1, dt * 4)); cam.y = FL.CAMY; cam.zoom = 1;

      // spawn heads sweeping in from the right
      f.headCool -= dt;
      if (f.headCool <= 0) {
        f.headCool = 0.7 + love.math.random() * 0.85;
        const hy = FL.TOP + 24 + love.math.random() * (FL.BOT - FL.TOP - 48);
        f.heads.push({ x: cam.x + VW * 0.60, y: hy, vx: -(135 + love.math.random() * 80),
          vy: (love.math.random() - 0.5) * 46, ph: love.math.random() * 6, t: 0,
          phase: love.math.random() * 6.28, state: 'chase', bite: 0, hurt: 0, dead: 0 });
      }
      // lava bolts rising from the river below the King
      f.boltCool -= dt;
      if (f.boltCool <= 0) {
        f.boltCool = 0.5 + love.math.random() * 0.65;
        const bx = p.x + (love.math.random() - 0.3) * 340;
        f.upBolts.push({ x: bx, y: FL.RIVER, vx: (love.math.random() - 0.5) * 40,
          vy: -(255 + love.math.random() * 130), r: 7, t: 0 });
      }
      updateFlightEnts(dt);
      if (p.x >= f.doorX - 100) { f.phase = 'enter'; f.t = 0; }
      return;
    }

    if (f.phase === 'enter') {
      // the King flies into the giant door of light; everything fades to WHITE
      p.x += 150 * dt; p.y = lerp(p.y, FL.ALT - 10, Math.min(1, dt * 2));
      cam.x = lerp(cam.x, p.x + 190, Math.min(1, dt * 4)); cam.y = FL.CAMY;
      f.whiteA = Math.min(1, (f.whiteA || 0) + dt * 0.7);
      updateFlightEnts(dt);
      if (f.t > 2.4) { f.phase = 'done'; f.t = 0; if (l5.end.stage < 5) { l5.end.stage = 5; l5.end.t = 0; } }
      return;
    }
    // done
    f.whiteA = 1;
    if (l5.end.stage >= 5) l5.end.t += dt;
  }

  // Per-frame update while the King is falling off the carpet to his death.
  // Real gravity pulls him down into the lava river while the now-empty carpet
  // floats up and drifts on. When he reaches the lava a fiery splash bursts and
  // the level-5 GAME OVER takes over (which freezes the world; R restarts).
  function updateFlightFall(dt) {
    const f = l5.flight, p = player, cp = l5.carpet;
    p.state = 'air'; p.onGround = false;
    p.vy = (p.vy || 0) + GRAV * dt;
    p.x += (p.vx || 0) * dt;
    p.y += p.vy * dt;
    p.facing = (p.vx || 0) < 0 ? -1 : 1;
    // the riderless carpet floats up a little and drifts onward
    cp.x += 46 * dt; cp.y -= 24 * dt;
    cam.x = lerp(cam.x, p.x + 120, Math.min(1, dt * 3));
    cam.y = lerp(cam.y, clamp(p.y - 40, FL.CAMY, FL.CAMY + 90), Math.min(1, dt * 2));
    if (!f.splashed && p.y >= FL.RIVER) {
      f.splashed = true;
      spawnDust(p.x, FL.RIVER, 16, 1.3);   // molten splash where he hits the fire
      if (sfxThunder) sfxThunder.play(0.5, 0.7);
      l5.gameOver = true;                   // freezes the world → GAME OVER overlay
    }
  }

  // the giant DOOR OF LIGHT at the end of the river (drawn in world space)
  function drawDoorOfLight(x) {
    const top = 118, bot = 522, w = 130, springY = top + w / 2;
    for (let i = 7; i >= 1; i--) {   // outer radiance
      lg.setColor(1.0, 0.96, 0.82, 0.05);
      lg.rectangle('fill', x - w / 2 - i * 12, top - i * 12, w + i * 24, (bot - top) + i * 24);
    }
    lg.setColor(1.0, 0.98, 0.9, 0.9);
    lg.rectangle('fill', x - w / 2, springY, w, bot - springY);
    lg.arc('fill', x, springY, w / 2, Math.PI, 2 * Math.PI);
    lg.setColor(1.0, 1.0, 1.0, 0.95);
    lg.rectangle('fill', x - w / 2 + 16, springY, w - 32, bot - springY - 8);
    lg.arc('fill', x, springY, w / 2 - 16, Math.PI, 2 * Math.PI);
    // radiant beams streaming out
    lg.setColor(1.0, 0.98, 0.85, 0.10);
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.28;
      lg.polygon('fill', x, springY + 40, x + Math.cos(a) * 900 - 20, springY + 40 + Math.sin(a) * 900, x + Math.cos(a) * 900 + 20, springY + 40 + Math.sin(a) * 900);
    }
    // golden frame
    lg.setColor(0.95, 0.85, 0.45, 0.9); lg.setLineWidth(5);
    lg.line(x - w / 2, springY, x - w / 2, bot); lg.line(x + w / 2, springY, x + w / 2, bot);
    lg.arc('line', 'open', x, springY, w / 2, Math.PI, 2 * Math.PI);
    lg.setLineWidth(1);
  }

  // flight entities, drawn INSIDE the level's camera transform (from drawEnts5)
  function drawFlightEnts() {
    const f = l5.flight;
    if (!f || !f.active) return;
    drawDoorOfLight(f.doorX);
    for (const b of f.upBolts) {
      lg.setColor(1.0, 0.45, 0.1, 0.22); lg.circle('fill', b.x - b.vx * 0.01, b.y - b.vy * 0.01, b.r * 1.8);
      lg.setColor(0.95, 0.32, 0.06, 1); lg.circle('fill', b.x, b.y, b.r);
      lg.setColor(1.0, 0.82, 0.35, 1); lg.circle('fill', b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.5);
    }
    for (const h of f.heads) drawBiter(h);
  }

  // the flight's own HUD (hearts, lives, fire-sword charge, distance)
  function drawFlightOverlay() {
    const p = player;
    lg.setFont(FONT_HUD);
    for (let i = 1; i <= 3; i++) {
      const hx = 30 + (i - 1) * 36, hy = 32;
      const full = (p.hp || 0) >= i;
      if (full) lg.setColor(0.85, 0.16, 0.22, 1); else lg.setColor(0.25, 0.10, 0.13, 0.8);
      lg.circle('fill', hx - 5, hy - 3, 6.5); lg.circle('fill', hx + 5, hy - 3, 6.5);
      lg.polygon('fill', hx - 11, hy - 0.5, hx + 11, hy - 0.5, hx, hy + 12);
      lg.setColor(1, 1, 1, full ? 0.35 : 0.12); lg.circle('fill', hx - 6.5, hy - 5, 2);
    }
    lg.setColor(0.9, 0.83, 0.8, 0.9); lg.print('LIVES', 30, 52, 0, 0.85, 0.85);
    for (let i = 0; i < Math.max(0, l5.lives || 0); i++) {
      const lx = 108 + i * 22, ly = 60;
      lg.setColor(0.62, 0.5, 0.5, 1); lg.polygon('fill', lx - 6, ly + 6, lx + 6, ly + 6, lx, ly - 3);
      lg.setColor(0.94, 0.86, 0.84, 1); lg.circle('fill', lx, ly - 4, 3.2);
    }
    if (p.lavaSword) {
      lg.setColor(1.0, 0.5, 0.15, 0.9); lg.print('FIRE-SWORD', 30, 78, 0, 0.85, 0.85);
      const charged = p.lavaCharge || 0;
      for (let i = 0; i < 3; i++) {
        const cx = 118 + i * 16, cy = 84;
        if (i < charged) { lg.setColor(1.0, 0.45, 0.12, 1); lg.circle('fill', cx, cy, 5); lg.setColor(1.0, 0.9, 0.5, 1); lg.circle('fill', cx - 1.4, cy - 1.4, 2); }
        else { lg.setColor(0.4, 0.2, 0.12, 0.7); lg.circle('line', cx, cy, 5); }
      }
      // charging: a 0→2s hold meter; otherwise the hint
      if ((p.blockHold || 0) > 0) {
        lg.setColor(0.85, 0.7, 0.6, 0.7); lg.print('CHARGING…', 178, 78, 0, 0.8, 0.8);
        lg.setColor(0.3, 0.15, 0.08, 0.8); lg.rectangle('fill', 178, 90, 90, 5);
        lg.setColor(1.0, 0.6, 0.15, 1); lg.rectangle('fill', 178, 90, 90 * clamp(p.blockHold / CHARGE_TIME, 0, 1), 5);
      } else {
        lg.setColor(0.85, 0.7, 0.6, 0.7); lg.print(charged > 0 ? 'ATTACK to fire  ·  hold BLOCK 1s to recharge' : 'hold BLOCK 1s to charge', 178, 78, 0, 0.8, 0.8);
      }
    }
    // flight progress bar (distance to the door of light)
    if (l5.flight.phase === 'run' || l5.flight.phase === 'lift') {
      const prog = clamp((p.x - l5.flight.startX) / (l5.flight.doorX - l5.flight.startX), 0, 1);
      const bw = 300, bx = VW / 2 - bw / 2, by = 26;
      lg.setColor(0.2, 0.06, 0.04, 0.7); lg.rectangle('fill', bx, by, bw, 8);
      lg.setColor(0.8, 0.75, 0.5, 1); lg.rectangle('fill', bx, by, bw * prog, 8);
      lg.setColor(0.9, 0.85, 0.75, 0.9);
      const m = 'ACROSS  THE  LAVA  RIVER';
      lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, 40);
    }
    if (l5.msgT > 0) {
      lg.setColor(0.96, 0.88, 0.78, Math.min(1, l5.msgT));
      lg.print(l5.msg, VW / 2 - FONT_HUD.getWidth(l5.msg) / 2, VH - 96);
    }
    if (p.blockFlash > 0 && (p.hp || 0) >= 0) {
      lg.setColor(0.9, 0.2, 0.15, clamp(p.blockFlash / 0.2, 0, 1) * 0.25);
      lg.rectangle('fill', 0, 0, VW, VH);
    }
    // fade to WHITE as the King enters the door of light
    if ((l5.flight.whiteA || 0) > 0) {
      lg.setColor(1, 1, 1, clamp(l5.flight.whiteA, 0, 1));
      lg.rectangle('fill', 0, 0, VW, VH);
    }
    if (l5.gameOver) {
      lg.setColor(0.04, 0.0, 0.0, 0.9); lg.rectangle('fill', 0, 0, VW, VH);
      lg.setFont(FONT_SUB); lg.setColor(0.85, 0.2, 0.12, 1);
      printSpaced('GAME  OVER', VW / 2, VH / 2 - 28, FONT_SUB, 6, 1);
      lg.setFont(FONT_HUD); lg.setColor(0.9, 0.86, 0.82, 0.9);
      const m = 'Press  R  to  try  again';
      lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 24);
    }
  }

  // ============================================================================
  //  LEVEL 4 — "THIRTY DAYS BEFORE"  (Persian-palace balcony cutscene)
  //  A scripted, non-playable flashback: the king takes his leave. All figures
  //  are procedural, drawn in the hero's style with SOLID (segment) limbs and a
  //  walk cycle. Subtitles carry the dialogue (Italian → English).
  // ============================================================================
  const GROUND4 = 545;

  const L4_LINES = [
    { who: 'SERVANT', text: 'My king, you cannot leave us. I beg you — reconsider.' },
    { who: 'GUARD', text: 'My king, the Sea Peoples will come to attack us if you abandon the kingdom.' },
    { who: 'HERO', text: 'My faithful servants, I know I have failed you — but I have a mission to fulfil. I know the royal guard will hold the kingdom together in my absence.' },
    { who: 'GUARD', text: 'My lord, you are our king. We need you.' },
    { who: 'HERO', text: 'I was never a king. I was never a prince. I have always been a street rat taken in by the royal family. My mission is to bring back the true queen of this realm.' },
    { who: 'SERVANT', text: 'My lord, the queen is dead now. She has been buried; there is nothing more to be done. It is no one’s fault.' },
    { who: 'HERO', text: 'There you are wrong, handmaiden. The fault is mine — and the curse my family has carried for generations. I must find who did this to us; who hides behind the witch’s symbol that tortured my queen’s mind until it drove her to that final act.' },
    { who: 'SERVANT', text: 'My lord, little Shahraman — your son — needs you.' },
    { who: 'GUARD', text: 'There is nothing that can be done now.' },
    { who: 'HERO', text: 'No. There is still one thing I can do. The ancient manuscripts speak of a way into the place where Ahriman keeps the souls of witchcraft’s victims. That is where I am bound.' },
    { who: 'SHAHRAMAN', text: 'Father, please — don’t go.' },
    { who: 'HERO', text: 'I’m sorry.' },
  ];

  const l4 = {
    phase: 0, t: 0, line: -1, lineT: 0, lineDur: 0, skip: false,
    fade: 0, fade2: 0, jt: 0, guard: null, servant: null, child: null, carpet: null,
  };
  function mkChar4(x, facing) { return { x: x, y: GROUND4, vx: 0, facing: facing, runPhase: 0, arrived: false }; }

  // ---- generic solid limbs (same look as the hero, parameterised colours)
  function limbLeg(ox, oy, a1, a2, thighCol, bootCol, sc) {
    sc = sc || 1;
    const kx = ox + Math.sin(a1) * 17 * sc, ky = oy + Math.cos(a1) * 17 * sc;
    const fx = kx + Math.sin(a2) * 16 * sc, fy = ky + Math.cos(a2) * 16 * sc;
    segment(ox, oy, kx, ky, 4.8 * sc, 3.7 * sc, thighCol);
    segment(kx, ky, fx, fy, 3.6 * sc, 2.9 * sc, thighCol);
    const bx = lerp(kx, fx, 0.45), by = lerp(ky, fy, 0.45);
    segment(bx, by, fx, fy, 3.4 * sc, 3.0 * sc, bootCol);
    segment(fx - 0.5 * sc, fy - 0.6 * sc, fx + 6 * sc, fy - 0.2 * sc, 2.8 * sc, 1.9 * sc, bootCol);
    return [fx, fy];
  }
  function limbArm(ox, oy, a1, a2, sleeveCol, skinCol, sc) {
    sc = sc || 1;
    const ex = ox + Math.sin(a1) * 14 * sc, ey = oy + Math.cos(a1) * 14 * sc;
    const hx = ex + Math.sin(a2) * 13 * sc, hy = ey + Math.cos(a2) * 13 * sc;
    segment(ox, oy, ex, ey, 3.6 * sc, 2.9 * sc, sleeveCol);
    segment(ex, ey, hx, hy, 2.9 * sc, 2.4 * sc, sleeveCol);
    setColA(skinCol); lg.circle('fill', hx, hy, 2.7 * sc);
    return [hx, hy];
  }
  function legAngles(ch) {
    const ph = ch.runPhase;
    // idle: legs stand nearly straight and close together (not splayed)
    if (Math.abs(ch.vx) <= 8) return { fT: 0.03, fK: 0.04, bT: -0.03, bK: -0.07 };
    const sF = Math.sin(ph), sB = Math.sin(ph + Math.PI);
    const kneeF = 0.30 + 0.85 * Math.max(0, Math.sin(ph - 2.1));
    const kneeB = 0.30 + 0.85 * Math.max(0, Math.sin(ph + Math.PI - 2.1));
    return { fT: 0.82 * sF, fK: 0.82 * sF - kneeF, bT: 0.82 * sB, bK: 0.82 * sB - kneeB };
  }
  function armAngles(ch, base) {
    if (Math.abs(ch.vx) <= 8) return { f: base, fh: base + 0.15, b: -base, bh: -base + 0.15 };
    const sF = Math.sin(ch.runPhase), sB = Math.sin(ch.runPhase + Math.PI);
    return { f: -0.5 * sF, fh: -0.5 * sF + 0.5, b: -0.5 * sB, bh: -0.5 * sB + 0.5 };
  }

  // ---- the burly turbaned palace guard (crossed arms when idle)
  // All balcony figures share the hero's exact proportions (feet 0, hip -33,
  // chest -49, head ~-58) and are drawn in PROFILE (nose forward, one eye), so
  // after scale(facing,1) they face the way they are looking.
  const L4_ARCHES = [{ x: 300, w: 210 }, { x: 640, w: 250 }, { x: 980, w: 210 }];
  const L4_SPRING = 205, L4_TIP = 50, L4_BOT = 360;

  function drawGuard(g) {
    const SKIN = [0.80, 0.55, 0.36], PANT = [0.58, 0.15, 0.13], SASH = [0.86, 0.68, 0.28],
      TURB = [0.90, 0.87, 0.80], TURBB = [0.66, 0.16, 0.15], HAIR = [0.08, 0.06, 0.05];
    const moving = Math.abs(g.vx) > 8;
    const leg = legAngles(g), arm = armAngles(g, 0.3);
    const bob = moving ? Math.abs(Math.sin(g.runPhase)) * 1.6 : Math.sin(T * 1.4) * 0.5;
    lg.push(); lg.translate(g.x, g.y); lg.scale(g.facing, 1);
    lg.setColor(0, 0, 0, 0.22); lg.ellipse('fill', 0, 2, 14, 4);
    const hipY = -33 + bob, chY = -49 + bob;
    limbLeg(-2, hipY, leg.bT, leg.bK, mul(PANT, 0.72), [0.2, 0.14, 0.1], 1);
    if (moving) limbArm(-1, chY, arm.b, arm.bh, mul(SKIN, 0.82), mul(SKIN, 0.82), 1);
    // bare, slightly broad torso
    setColA(SKIN);
    lg.polygon('fill', -6.4, hipY + 1.5, 6.4, hipY + 1.5, 7.8, chY - 2, -7.8, chY - 2);
    lg.circle('fill', 0, chY - 1.5, 7.2);
    // chest sash + waist sash
    setColA(SASH); lg.setLineWidth(4); lg.line(-6.4, chY - 4, 6, hipY - 0.5);
    lg.setLineWidth(1); lg.rectangle('fill', -6.6, hipY - 1, 13, 3.5);
    // scimitar SHEATHED at the hip — a curved scabbard hanging down-back (its
    // hilt just peeks above the belt; the blade is not drawn pointing up)
    segment(-3, hipY, -7, hipY + 12, 2.8, 2.2, [0.32, 0.25, 0.17]);
    segment(-7, hipY + 12, -12, hipY + 20, 2.2, 1.4, [0.32, 0.25, 0.17]);
    setColA([0.74, 0.58, 0.30]); lg.circle('fill', -12, hipY + 20, 1.6);   // gold chape (tip)
    lg.rectangle('fill', -4.6, hipY - 2, 3, 3);                            // gold throat at the belt
    setColA([0.68, 0.50, 0.24]); lg.circle('fill', -2.6, hipY - 4, 1.5);   // small hilt pommel
    limbLeg(2, hipY, leg.fT, leg.fK, PANT, [0.2, 0.14, 0.1], 1);
    if (moving) { limbArm(1, chY, arm.f, arm.fh, SKIN, SKIN, 1); }
    else {   // folded arms (profile)
      segment(1, chY + 1, 8, chY + 7, 3.6, 3.0, mul(SKIN, 0.9));
      segment(1, chY + 6, 8, chY + 1, 3.4, 2.8, SKIN);
      setColA(SKIN); lg.circle('fill', 8, chY + 7, 3); lg.circle('fill', 8, chY + 1, 2.8);
    }
    // neck + profile head
    const hX = 0, hY = chY - 9.5;
    segment(0, chY - 4, hX, hY + 3, 2.9, 2.5, SKIN);
    setColA(SKIN); lg.circle('fill', hX, hY, 6.6);
    lg.polygon('fill', hX + 2.8, hY + 1, hX + 7, hY + 1.8, hX + 3.2, hY + 4.6);   // nose / chin
    setColA([0.1, 0.08, 0.08]); lg.circle('fill', hX + 2.6, hY - 0.6, 1.1);       // eye
    setColA(HAIR); lg.setLineWidth(1.8); lg.line(hX + 0.6, hY - 2.4, hX + 4.6, hY - 1.5);  // brow
    lg.setLineWidth(3);
    lg.arc('line', 'open', hX + 4.4, hY + 3, 3.2, -1.4, 1.0);                     // curled moustache
    lg.circle('fill', hX + 7.2, hY + 3.4, 1.5);
    // turban
    setColA(TURB); lg.ellipse('fill', hX - 1, hY - 6.5, 8.5, 6);
    lg.circle('fill', hX - 4, hY - 7, 4.5); lg.circle('fill', hX + 3, hY - 7, 4.5); lg.circle('fill', hX - 0.5, hY - 10, 5);
    setColA(TURBB); lg.rectangle('fill', hX - 8, hY - 6, 15, 2.2);
    setColA(SASH); lg.circle('fill', hX - 0.5, hY - 6, 1.6);
    setColA([0.75, 0.85, 0.9]); lg.setLineWidth(1.6); lg.line(hX - 0.5, hY - 11, hX + 1.5, hY - 18);
    lg.setLineWidth(1);
    lg.pop();
  }

  function drawServant(s) {
    const ROBE = [0.72, 0.20, 0.16], ROBED = [0.50, 0.13, 0.12], CREAM = [0.90, 0.85, 0.72],
      SASH = [0.86, 0.70, 0.30], SKIN = [0.82, 0.60, 0.44], HAIR = [0.10, 0.08, 0.09], FEATH = [0.78, 0.30, 0.32];
    const moving = Math.abs(s.vx) > 8;
    const sway = moving ? Math.sin(s.runPhase) * 0.9 : Math.sin(T * 1.2) * 0.3;
    const bob = moving ? Math.abs(Math.sin(s.runPhase)) * 1.4 : 0;
    lg.push(); lg.translate(s.x, s.y - bob); lg.scale(s.facing, 1);
    lg.setColor(0, 0, 0, 0.2); lg.ellipse('fill', 0, 2 + bob, 12, 3.5);
    const hipY = -33, chY = -49;
    // long swaying robe (hip → floor), same overall height as the hero
    setColA(ROBE); lg.polygon('fill', -6, hipY, 6, hipY, 11 + sway, 0, -9 + sway, 0);
    setColA(ROBED); lg.polygon('fill', 0, hipY, 5, hipY, 7 + sway, 0, 1 + sway, 0);
    setColA(SASH); lg.setLineWidth(1.8); lg.line(-9 + sway, -1, 11 + sway, -1);
    if (moving) { const f = Math.sin(s.runPhase); setColA([0.5, 0.35, 0.2]); lg.ellipse('fill', 3 + f * 3 + sway, -1, 3, 2); lg.ellipse('fill', -3 - f * 3 + sway, -1, 3, 2); }
    // bodice
    setColA(ROBE); lg.polygon('fill', -6, hipY + 1, 6, hipY + 1, 6.5, chY - 2, -6.5, chY - 2); lg.circle('fill', 0, chY - 1.5, 6.2);
    setColA(SASH); lg.rectangle('fill', -6.5, hipY - 1, 13, 3.5);
    // arms clasped in front (profile, cream sleeves)
    segment(0, chY + 2, 6, chY + 9, 3, 2.5, mul(CREAM, 0.9));
    segment(0, chY + 4, 6, chY + 8, 2.8, 2.3, CREAM);
    setColA(SKIN); lg.circle('fill', 6, chY + 8.5, 2.4);
    // neck + profile head
    const hX = 0, hY = chY - 9.5;
    segment(0, chY - 4, hX, hY + 3, 2.3, 2.0, SKIN);
    setColA(HAIR); lg.polygon('fill', hX - 2, hY - 4, hX - 8, hY + 14, hX - 2, hY + 12, hX - 1, hY);  // hair flows back
    setColA(SKIN); lg.circle('fill', hX, hY, 5.8);
    lg.polygon('fill', hX + 2.4, hY + 1, hX + 6, hY + 1.6, hX + 2.8, hY + 4);   // nose
    setColA([0.1, 0.08, 0.09]); lg.circle('fill', hX + 2, hY - 0.4, 0.95);     // eye
    // tall headdress + feather
    setColA(CREAM); lg.polygon('fill', hX - 5, hY - 4, hX + 5, hY - 4, hX + 3.5, hY - 15, hX - 4.5, hY - 15);
    setColA(SASH); lg.rectangle('fill', hX - 5, hY - 5.5, 10, 2);
    setColA(FEATH); lg.setLineWidth(2); lg.line(hX + 1, hY - 13, hX + 6, hY - 25);
    lg.setLineWidth(1);
    lg.pop();
  }

  function drawChild(c) {
    const TUNIC = [0.28, 0.44, 0.55], PANT = [0.34, 0.29, 0.20], SKIN = [0.86, 0.64, 0.47],
      HAIR = [0.12, 0.10, 0.09], SASH = [0.80, 0.55, 0.25];
    const moving = Math.abs(c.vx) > 8;
    const leg = legAngles(c), arm = armAngles(c, 0.32), sc = 0.66;
    const bob = moving ? Math.abs(Math.sin(c.runPhase)) * 1.6 : Math.sin(T * 1.6) * 0.5;
    lg.push(); lg.translate(c.x, c.y); lg.scale(c.facing * sc, sc);
    lg.setColor(0, 0, 0, 0.22); lg.ellipse('fill', 0, 2, 13, 4);
    const hipY = -33 + bob, chY = -49 + bob;
    limbLeg(-2, hipY, leg.bT, leg.bK, mul(PANT, 0.72), [0.2, 0.14, 0.1], 1);
    limbArm(-1, chY, arm.b, arm.bh, mul(TUNIC, 0.82), mul(SKIN, 0.85), 1);
    setColA(TUNIC); lg.polygon('fill', -5.6, hipY + 1.5, 5.6, hipY + 1.5, 7.2, chY - 2, -7.2, chY - 2); lg.circle('fill', 0, chY - 1.5, 6.8);
    setColA(SASH); lg.setLineWidth(3); lg.line(-5.8, hipY - 0.5, 5.8, hipY - 0.5); lg.setLineWidth(1);
    limbLeg(2, hipY, leg.fT, leg.fK, PANT, [0.2, 0.14, 0.1], 1);
    limbArm(1, chY, arm.f, arm.fh, TUNIC, SKIN, 1);
    const hX = 0, hY = chY - 9.5;
    segment(0, chY - 4, hX, hY + 3, 2.6, 2.2, SKIN);
    setColA(SKIN); lg.circle('fill', hX, hY, 6.2);
    lg.polygon('fill', hX + 2.5, hY + 1, hX + 6.4, hY + 1.8, hX + 3, hY + 4.4);   // nose
    setColA([0.1, 0.08, 0.08]); lg.circle('fill', hX + 2.4, hY - 0.6, 1.0);       // eye
    setColA(HAIR); lg.circle('fill', hX - 1, hY - 3.5, 6);
    lg.polygon('fill', hX - 5, hY - 2, hX - 6.5, hY + 4, hX - 2, hY + 2, hX - 1.5, hY - 2);
    lg.pop();
  }

  // The BACK layer: the night sky seen through the arches (moon + stars). Drawn
  // first; the wall (front layer) then punches it down to just the openings.
  function drawBalconyBack() {
    lg.gradientRect(0, 0, VW, VH, [0.10, 0.13, 0.30], [0.05, 0.06, 0.13]);
    const rng = love.math.newRandomGenerator(1234);
    setColA([0.9, 0.95, 1.0], 0.9);
    for (let i = 0; i < 70; i++) { const x = rng.random() * VW, y = rng.random() * 350; lg.circle('fill', x, y, rng.random() < 0.22 ? 1.7 : 1); }
    // crescent moon in the central arch (occluded by the wall/frame around it)
    const mx = 660, my = 168;
    setColA([0.97, 0.93, 0.7], 0.96); lg.circle('fill', mx, my, 26);
    setColA([0.07, 0.09, 0.22]); lg.circle('fill', mx + 10, my - 6, 23);
  }

  // The FRONT layer: opaque wall covering everything EXCEPT the arch openings,
  // then the gold frames, columns, balustrade and floor. Drawn AFTER the carpet
  // so the carpet/flying hero read as being BEHIND the walls, in the sky.
  function drawBalconyFront() {
    const GOLD = [0.83, 0.66, 0.28], GOLDL = [0.97, 0.83, 0.44], GOLDD = [0.55, 0.42, 0.18], WALL = [0.09, 0.11, 0.26];
    const A = L4_ARCHES, sp = L4_SPRING, tp = L4_TIP, bt = L4_BOT;
    setColA(WALL);
    // full-height wall strips beside / between the arches
    lg.rectangle('fill', 0, 0, A[0].x - A[0].w / 2, 372);
    lg.rectangle('fill', A[0].x + A[0].w / 2, 0, (A[1].x - A[1].w / 2) - (A[0].x + A[0].w / 2), 372);
    lg.rectangle('fill', A[1].x + A[1].w / 2, 0, (A[2].x - A[2].w / 2) - (A[1].x + A[1].w / 2), 372);
    lg.rectangle('fill', A[2].x + A[2].w / 2, 0, VW - (A[2].x + A[2].w / 2), 372);
    lg.rectangle('fill', 0, 0, VW, tp);   // top band above the arch tips
    for (const a of A) {                  // corner wedges beside each pointed top + wall below
      const h = a.w / 2;
      lg.polygon('fill', a.x - h, tp, a.x, tp, a.x - h, sp);
      lg.polygon('fill', a.x + h, tp, a.x, tp, a.x + h, sp);
      lg.rectangle('fill', a.x - h, bt, a.w, 372 - bt);
    }
    // gold arch frames
    for (const a of A) {
      const h = a.w / 2;
      setColA(GOLD); lg.setLineWidth(7);
      lg.line(a.x - h, bt, a.x - h, sp); lg.line(a.x + h, bt, a.x + h, sp);
      lg.line(a.x - h, sp, a.x, tp); lg.line(a.x, tp, a.x + h, sp);
      setColA(GOLDL); lg.setLineWidth(2);
      lg.line(a.x - h, sp, a.x, tp); lg.line(a.x, tp, a.x + h, sp);
    }
    // twisted gold columns between the arches
    for (const cxp of [470, 810]) {
      setColA(GOLD); lg.rectangle('fill', cxp - 7, 60, 14, 300);
      setColA(GOLDD); lg.setLineWidth(2.4);
      for (let y = 64; y < 356; y += 12) lg.line(cxp - 7, y, cxp + 7, y + 8);
      setColA(GOLDL); lg.rectangle('fill', cxp - 7, 60, 3, 300);
      setColA(GOLD); lg.rectangle('fill', cxp - 11, 54, 22, 10); lg.rectangle('fill', cxp - 11, 356, 22, 10);
    }
    // balustrade (railing) — you see sky through it beyond the arches
    setColA(GOLD); lg.rectangle('fill', 0, 352, VW, 8);
    for (let x = 24; x < VW; x += 34) { setColA(GOLD); lg.ellipse('fill', x, 372, 5, 12); setColA(GOLDD); lg.rectangle('fill', x - 5, 366, 10, 3); }
    setColA(GOLD); lg.rectangle('fill', 0, 386, VW, 6);
    // marble floor (no tile seams — a clean dark floor)
    lg.gradientRect(0, 392, VW, VH - 392, [0.15, 0.14, 0.21], [0.09, 0.08, 0.13]);
    setColA([0.9, 0.7, 0.4], 0.04); lg.ellipse('fill', VW / 2, 560, 360, 90);
    lg.setLineWidth(1);
  }

  function drawCarpetAt(x, bodyY, s) { drawFlyingCarpet(x, bodyY + 44 * s, s); }

  // ---- cutscene logic
  function walkToward(ch, tx, spd, dt) {
    const d = tx - ch.x;
    if (Math.abs(d) < 3) { ch.x = tx; ch.vx = 0; ch.arrived = true; return true; }
    const dir = d > 0 ? 1 : -1;
    ch.vx = spd * dir; ch.facing = dir; ch.x += ch.vx * dt;
    ch.runPhase += Math.abs(ch.vx) * dt * 0.05;
    return false;
  }
  function l4StartLine(i) {
    l4.line = i; l4.lineT = 0;
    l4.lineDur = 2.6 + L4_LINES[i].text.split(' ').length * 0.4;
  }
  function l4LineDone() { return l4.lineT >= l4.lineDur || l4.skip; }

  function updateL4(dt) {
    const l = l4; l.t += dt;
    player.t += dt;
    if (Math.abs(player.vx) > 8) player.runPhase += Math.abs(player.vx) * dt * 0.05;
    if (l.line >= 0) l.lineT += dt;

    if (l.phase === 0) {                       // "thirty days before" card
      if (l.t > 1.6 || l.skip) { l.phase = 1; l.t = 0; }
    } else if (l.phase === 1) {                // fade in + the king walks to centre
      l.fade = Math.min(1, l.fade + dt * 1.2);
      player.state = 'ground';
      if (l.skip) { player.x = 500; player.vx = 0; l.fade = 1; }
      const done = walkToward(player, 500, 120, dt);
      if (done) { player.vx = 0; if (l.fade >= 1) { l.phase = 2; l.t = 0; } }
    } else if (l.phase === 2) {                // guard + servant enter from the right
      if (l.skip) { l.servant.x = 705; l.servant.arrived = true; l.servant.vx = 0; l.guard.x = 885; l.guard.arrived = true; l.guard.vx = 0; }
      const a = walkToward(l.servant, 705, 190, dt);
      const b = walkToward(l.guard, 885, 190, dt);
      player.vx = 0; player.facing = 1;
      if (a && b) { l.phase = 3; l4StartLine(0); }
    } else if (l.phase === 3) {                // main dialogue (lines 0..9)
      player.vx = 0; player.facing = 1;
      if (l4LineDone()) {
        if (l.line < 9) l4StartLine(l.line + 1);
        else { l.line = -1; l.phase = 4; l.t = 0; }
      }
    } else if (l.phase === 4) {                // carpet flies in (in the sky) + the son runs in
      if (!l.carpet) l.carpet = { x: 1500, y: 300 };
      l.carpet.x = lerp(l.carpet.x, 645, Math.min(1, dt * 1.4));
      l.carpet.y = lerp(l.carpet.y, 300, Math.min(1, dt * 1.4));
      if (!l.child) l.child = mkChar4(-50, 1);
      walkToward(l.child, 360, 108, dt);
      player.vx = 0; player.facing = -1;
      if (l.child.arrived && Math.abs(l.carpet.x - 645) < 10) { l.phase = 5; l4StartLine(10); }
    } else if (l.phase === 5) {                // Shahraman pleads
      player.vx = 0; player.facing = -1;
      if (l4LineDone()) { l.line = -1; l.phase = 6; l4StartLine(11); }
    } else if (l.phase === 6) {                // the king: "I'm sorry"
      player.vx = 0; player.facing = -1;
      if (l4LineDone()) { l.line = -1; l.phase = 7; l.jt = 0; }
    } else if (l.phase === 7) {                // step under the arch, then leap onto the carpet
      const underX = l.carpet.x - 20;
      if (player.x < underX - 4 && l.jt === 0) {
        player.state = 'ground';
        walkToward(player, underX, 100, dt);
      } else {
        l.jt += dt;
        const k = clamp(l.jt / 0.85, 0, 1);
        player.state = 'air'; player.facing = 1; player.vx = 40;
        player.x = lerp(underX, l.carpet.x - 6, k);
        player.y = lerp(GROUND4, l.carpet.y, k) - Math.sin(k * Math.PI) * 70;
        if (k >= 1) { player.y = l.carpet.y; player.state = 'ground'; player.vx = 0; l.phase = 8; }
      }
    } else if (l.phase === 8) {                // fly up into the sky (behind the walls) while fading out
      // Fade fully to black, then continue directly into Level 5.
      // Never show the old TO BE CONTINUED / R replay card here.
      l.carpet.y = Math.max(178, l.carpet.y - 120 * dt);
      l.carpet.x += 22 * dt;
      player.x = l.carpet.x - 6; player.y = l.carpet.y; player.facing = 1; player.vx = 0;
      l.fade2 = Math.min(1, l.fade2 + dt * 0.9);
      if (l.fade2 >= 1) { initLevel(5); return; }
    } else if (l.phase === 9) {                // legacy safeguard: skip old end card
      initLevel(5); return;
    }
    l.skip = false;
  }

  // ---- subtitles
  function wrapText(text, font, maxW) {
    const words = text.split(' '); const out = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (cur && font.getWidth(test) > maxW) { out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  }
  const L4_NAMES = { HERO: 'The King', GUARD: 'Royal Guard', SERVANT: 'Handmaiden', SHAHRAMAN: 'Shahraman' };
  const L4_COLS = { HERO: [1.0, 0.86, 0.5], GUARD: [0.93, 0.44, 0.34], SERVANT: [0.96, 0.62, 0.72], SHAHRAMAN: [0.6, 0.86, 1.0] };
  function speakerHead(who) {
    // Level 5 draws overlays in screen space over a scrolling camera, so convert
    // the hero's world position to screen coordinates for the speaker marker.
    if (who === 'HERO' && level === 5) {
      return { x: VW / 2 + (player.x - cam.x) * cam.zoom,
               y: VH / 2 + (player.y - 70 - cam.y) * cam.zoom };
    }
    if (who === 'HERO') return { x: player.x, y: player.y - 118 };
    if (who === 'GUARD' && l4.guard) return { x: l4.guard.x, y: l4.guard.y - 136 };
    if (who === 'SERVANT' && l4.servant) return { x: l4.servant.x, y: l4.servant.y - 128 };
    if (who === 'SHAHRAMAN' && l4.child) return { x: l4.child.x, y: l4.child.y - 80 };
    return null;
  }
  function drawSubtitle(line) {
    const col = L4_COLS[line.who] || [1, 1, 1];
    lg.setFont(FONT_HUD);
    const lines = wrapText(line.text, FONT_HUD, VW * 0.66);
    const lh = 22, boxW = VW * 0.72, bx = (VW - boxW) / 2;
    const boxH = 42 + lines.length * lh + 10;
    const by = VH - boxH - 26;
    lg.setColor(0.03, 0.02, 0.05, 0.85); lg.rectangle('fill', bx, by, boxW, boxH);
    lg.setColor(col[0], col[1], col[2], 0.95); lg.rectangle('fill', bx, by, boxW, 3);
    lg.setFont(FONT_SUB); lg.setColor(col[0], col[1], col[2], 1);
    lg.print(L4_NAMES[line.who] || '', bx + 18, by + 9);
    lg.setFont(FONT_HUD); lg.setColor(0.96, 0.94, 0.9, 1);
    for (let i = 0; i < lines.length; i++) lg.print(lines[i], bx + 18, by + 40 + i * lh);
    lg.setColor(0.72, 0.68, 0.6, 0.4 + 0.35 * Math.sin(T * 4));
    lg.print('▸', bx + boxW - 26, by + boxH - 24);
    // marker above whoever is speaking
    const h = speakerHead(line.who);
    if (h) {
      const bob = Math.sin(T * 4) * 3;
      lg.setColor(col[0], col[1], col[2], 0.95);
      lg.polygon('fill', h.x - 8, h.y - 10 + bob, h.x + 8, h.y - 10 + bob, h.x, h.y + bob);
    }
  }
  function drawL4Overlay() {
    const l = l4;
    if (l.phase === 0) {
      lg.setColor(0, 0, 0, 1); lg.rectangle('fill', 0, 0, VW, VH);
      const a = smooth(clamp(l.t / 0.7, 0, 1)) * smooth(clamp((2.8 - l.t) / 0.7, 0, 1));
      if (FONT_SUB) { lg.setFont(FONT_SUB); lg.setColor(0.9, 0.87, 0.8, a); printSpaced('THIRTY  DAYS  BEFORE', VW / 2, VH * 0.46, FONT_SUB, 6, 1); }
      return;
    }
    if (l.fade < 1) { lg.setColor(0, 0, 0, 1 - l.fade); lg.rectangle('fill', 0, 0, VW, VH); }
    if (l.line >= 0) drawSubtitle(L4_LINES[l.line]);
    if (l.phase >= 8) {   // fade to black grows during the fly-away (hides the hero fully)
      lg.setColor(0, 0, 0, clamp(l.fade2, 0, 1)); lg.rectangle('fill', 0, 0, VW, VH);
    }
  }

  function initL4() {
    cine.on = false; cine.stage = 0; cine.t = 0;
    cine.titleA = 0; cine.subA = 0; cine.boxA = 0; cine.hintA = 0;
    musicVol = 0.3;
    if (windSrc) windSrc.setVolume(0);
    if (musicSrc) { musicSrc.stop(); musicSrc.setVolume(0.3); musicSrc.play(); }
    // the battle theme carried through the finale; cut it here (level 4 skips
    // the crossfade loop). Keep it playing silently so a later L3 replay can
    // fade it back in without needing a fresh audio-unlock gesture.
    battleVol = 0; bossWasFighting = false;
    if (battleSrc) battleSrc.setVolume(0);
    player = newPlayer(420, GROUND4);
    player.state = 'ground'; player.onGround = true; player.started = true;
    player.hasSword = false; player.facing = 1;
    resetScarf(...neckPos(player));
    cam.x = VW / 2; cam.y = VH / 2; cam.zoom = 1;
    l4.phase = 0; l4.t = 0; l4.line = -1; l4.lineT = 0; l4.lineDur = 0; l4.skip = false;
    l4.fade = 0; l4.fade2 = 0; l4.jt = 0;
    l4.guard = mkChar4(1310, -1); l4.servant = mkChar4(1370, -1);
    l4.child = null; l4.carpet = null;
    introT = 999;   // suppress the platformer intro/location overlays
  }

  // -------------------------------------------------------------- LEVEL MGMT
  function initLevel(n) {
    level = n;
    saveProgress(n);   // remember the furthest level reached (Level 2 and on)
    if (n === 4) { initL4(); return; }
    if (n === 1) { plats = plats1; checkpoints = checkpoints1; }
    else if (n === 2) { plats = plats2; checkpoints = checkpoints2; }
    else if (n === 5) { plats = plats5; checkpoints = checkpoints5; }
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
    if (n === 5) initEnts5();
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
    if (n === 3 || n === 5 || (DEBUG && n === 2)) { player.hasSword = true; player.drawT = 0; }
    player.spawnFloor = player.y; player.initGrace = 0.5; player.startGuard = 3.5;
    // hard spawn-floor lock for the black halls: for the first seconds the hero
    // physically cannot drop below the start floor (a bullet-proof net for any
    // first-frame fall glitch on debug=3 loads). Doesn't block jumping.
    player.l3SpawnLock = (n === 3) ? 4.5 : 0;
    // the safe spawn the start-guard returns to (guaranteed on solid ground)
    player.safeX = player.x; player.safeY = player.y;
    resetScarf(...neckPos(player));
    cam.x = player.x + 70; cam.y = player.y - 130; cam.zoom = 1;
    introT = 0;
    // Level 5 opens on its own wake-up cutscene, which draws the black bands and
    // location card — suppress the generic platformer intro overlays. The King
    // wakes with his sword sheathed on his back (drawn with ATTACK).
    if (n === 5) { introT = 999; player.started = true; player.sheathed = true; player.swordIdle = 5; }
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
    p.lavaCool = Math.max(0, (p.lavaCool || 0) - dt);
    p.riposte = Math.max(0, (p.riposte || 0) - dt);
    p.blockFlash = Math.max(0, (p.blockFlash || 0) - dt);
    // sword idle → after 5s unused, sheathe it on the back (drawn/attacked out again)
    if (p.hasSword && !p.dying) {
      const busy = (p.atkT || 0) > 0 || (p.drawT || 0) > 0 || (p.blockT || 0) > 0;
      if (busy) p.swordIdle = 0; else p.swordIdle = (p.swordIdle || 0) + dt;
      if (!p.sheathed && p.swordIdle > 5) p.sheathed = true;
    }
    // the spawn guard rails only count down ONCE the hero actually starts moving
    // — otherwise, on a dark level where you take a few seconds to get oriented,
    // the guard would expire while the hero is still frozen at the spawn, leaving
    // the very start of play unprotected (the reported debug=3 fall).
    if (p.started) {
      p.initGrace = Math.max(0, (p.initGrace || 0) - dt);
      p.startGuard = Math.max(0, (p.startGuard || 0) - dt);
    }
    // the hard spawn-floor lock (Level 3) counts down in REAL time, no matter what
    p.l3SpawnLock = Math.max(0, (p.l3SpawnLock || 0) - dt);
    if ((p.riposte || 0) <= 0) p.riposteHits = 0;

    // BULLET-PROOF LEVEL-3 SPAWN: for the first seconds of the black halls the hero
    // can NEVER fall or die. This runs before the dying block, so even a death
    // already in progress is cancelled and the hero is snapped back onto the start
    // floor. (No enemies are within reach this early, and the intentional finale
    // fall is far later — the lock has long expired by then.)
    if (level === 3 && (p.l3SpawnLock || 0) > 0 && l3.end.stage === 0) {
      if (p.dying) { p.dying = false; p.deadFade = 0; }
      if (p.y > FLOOR3 + 40) {
        p.y = FLOOR3; p.vy = 0; p.state = 'ground'; p.onGround = true; p.coyote = COYOTE;
        p.started = false; p.facing = 1;   // re-freeze facing right, like level 1's start
      }
    }

    if (p.dying) {
      // dying in lava: the King sinks down into the molten pool (like the skeletons)
      if (p.lavaSink != null) {
        p.vx = 0; p.y = p.y + 200 * dt;
        if (Math.floor(T * 12) % 2 === 0) spawnLavaSplash(p.x, p.lavaSink, 2);
      }
      p.deadFade = p.deadFade + dt * (p.lavaSink != null ? 1.9 : 1.6);
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
        if (level === 5 && !l5.gameOver) {
          l5.lives = (l5.lives || 0) - 1;
          if (l5.lives <= 0) { l5.gameOver = true; p.deadFade = 1; return; }
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
        p.facing = 1;   // a regular-level spawn always faces right (toward the level)
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
    // Level 5's labyrinth descends deep, so allow a longer fall before it counts
    // as falling out of the world
    const fallLimit = (level === 5) ? 1040 : 720;
    if (p.y > respawn.y + fallLimit && !(level === 3 && l3.end.stage >= 2)) killPlayer(p);

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

  const LEVEL_NAMES = {
    2: "THE  WITCH'S  KEEP", 3: 'THE  BLACK  HALLS',
    4: 'THIRTY  DAYS  BEFORE', 5: 'THE  LAVA  CAVERNS',
  };
  // Rects for the two menu options, filled in during drawTitleMenu so a mouse
  // click (love.mousepressed) can hit-test them.
  const menuRects = [null, null];
  function drawTitleMenu() {
    lg.setColor(0, 0, 0, 1);
    lg.rectangle('fill', 0, 0, VW, VH);

    // the witch's symbol, coldly pulsing above the title
    drawEmblem(VW / 2, VH * 0.30, 84, 0.9, null);

    // game title
    if (FONT_TITLE) {
      lg.setFont(FONT_TITLE);
      const y = VH * 0.44, sc = 0.7;
      const offs = [[-2, 0], [2, 0], [0, -2], [0, 2], [0, 0]];
      for (const off of offs) {
        if (off[0] === 0 && off[1] === 0) setColA(COL.title, 1);
        else lg.setColor(1, 0.85, 0.55, 0.10);
        printSpaced('THE RETURN OF THE SHADOW', VW / 2 + off[0], y + off[1], FONT_TITLE, 10, sc);
      }
    }

    // two options
    const opts = ['CONTINUE  ·  LEVEL ' + titleMenu.savedLevel, 'NEW  GAME'];
    const sub = LEVEL_NAMES[titleMenu.savedLevel] || '';
    lg.setFont(FONT_SUB);
    const oy = [VH * 0.62, VH * 0.72];
    for (let i = 0; i < 2; i++) {
      const on = (titleMenu.sel === i);
      const pulse = on ? (0.75 + 0.25 * Math.sin(T * 3)) : 0.42;
      lg.setColor(0.94, 0.89, 0.78, pulse);
      printSpaced(opts[i], VW / 2, oy[i], FONT_SUB, 5, on ? 1.06 : 0.95);
      // a rough clickable band around the line
      menuRects[i] = { x: VW / 2 - 240, y: oy[i] - 6, w: 480, h: 40 };
      if (on) {
        lg.setColor(0.60, 0.82, 0.78, 0.85);
        printSpaced('‹', VW / 2 - 230, oy[i], FONT_SUB, 0, 1.1);
        printSpaced('›', VW / 2 + 222, oy[i], FONT_SUB, 0, 1.1);
      }
    }
    if (sub && titleMenu.sel === 0) {
      lg.setFont(FONT_HUD);
      lg.setColor(0.72, 0.68, 0.62, 0.8);
      printSpaced(sub, VW / 2, oy[0] + 26, FONT_HUD, 3, 0.9);
    }

    lg.setFont(FONT_HUD);
    lg.setColor(0.7, 0.68, 0.76, 0.7);
    const hint = '↑ ↓  choose      ENTER  confirm';
    lg.print(hint, VW / 2 - FONT_HUD.getWidth(hint) / 2, VH - 46);
  }

  // Begin the game from the title-menu choice (or straight away when no menu).
  function startFromMenu(continueGame) {
    titleMenu.active = false;
    if (continueGame && titleMenu.savedLevel >= 2) {
      initLevel(titleMenu.savedLevel);
    } else {
      clearProgress();
      initLevel(1);
      if (!DEBUG) { studio.active = true; studio.t = 0; }   // fresh run: play the studio card
    }
  }

  function drawOverlays() {
    // title menu: witch's symbol + Continue / New Game (drawn over a black world)
    if (titleMenu.active) { drawTitleMenu(); return; }
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
      // finale: fade to black, then the diving rescue carpet ON TOP of it, then
      // the end label last so the text stays readable over the carpet
      if (l3.end.stage >= 2) {
        let a = 0;
        if (l3.end.stage === 3) {
          a = clamp(l3.end.t / 2.2, 0, 1);
          lg.setColor(0, 0, 0, a);
          lg.rectangle('fill', 0, 0, VW, VH);
        }
        // the magic carpet descends after the hero — always visible (foreshadow)
        drawRescueCarpet();
        if (l3.end.stage === 3 && a >= 1) {
          // the card fades in and then HOLDS (time is frozen once waiting) so it
          // stays lit while the battle theme plays; a blinking prompt invites Enter
          lg.setFont(FONT_SUB);
          lg.setColor(0.80, 0.78, 0.86, clamp((l3.end.t - 2.4) / 1.2, 0, 1) * clamp((6.0 - l3.end.t) / 0.8, 0, 1));
          printSpaced('THE  SHADOW  FALLS', VW / 2, VH / 2 - 6, FONT_SUB, 6, 1);
          if (l3.end.waiting) {
            lg.setFont(FONT_HUD);
            lg.setColor(0.82, 0.80, 0.88, 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(T * 3)));
            const m = 'Press  Enter  to  continue';
            lg.print(m, VW / 2 - FONT_HUD.getWidth(m) / 2, VH / 2 + 42);
          }
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

    if (level === 5) {
      if (l5.flight && l5.flight.active && l5.flight.phase !== 'done') drawFlightOverlay();
      else drawL5Overlay();
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

    // Level 4 cutscene: title card, subtitles and final fade sit on top of all
    if (level === 4) drawL4Overlay();
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
        clearProgress();
        console.info('[ROTS] Saved level overrides + progress cleared (?reset).');
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

    battleSrc = love.audio.newStreamSource(BATTLE_MUSIC_URL);
    battleSrc.setLooping(true);
    battleSrc.setVolume(0);
    battleSrc.play();   // loops silently; volume ramps up during the boss fight

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
        if (Number.isFinite(n) && n >= 1 && n <= 5) startLevel = Math.floor(n);
      }
      // ?immortal=true — the hero cannot be hurt or die (debug aid; combine like
      // ?debug=5&immortal=true)
      if (/[?&]immortal=(true|1|yes)\b/i.test(window.location.search || '')) IMMORTAL = true;
    } catch (e) {}

    initLevel(startLevel);
    // If the player has reached Level 2+ before, greet them with the title
    // screen (witch's symbol + Continue / New Game) over the frozen world.
    // Otherwise boot with the "NYCOSOFT presents" studio card (normal first
    // load — never on R, and never in debug mode).
    const saved = DEBUG ? 0 : loadProgress();
    if (saved >= 2) {
      titleMenu.active = true; titleMenu.sel = 0; titleMenu.savedLevel = saved; titleMenu.t = 0;
    } else if (!DEBUG) {
      studio.active = true; studio.t = 0;
    }
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

    // title menu: freeze the world behind the black title screen
    if (titleMenu.active) { titleMenu.t += dt; T = T + dt; return; }

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

    // Level 4 is a scripted cutscene — its own update, no platformer physics
    if (level === 4) { updateL4(dt); updateScarf(dt); updateParticles(dt); return; }

    // GAME OVER freezes the world; only R (keypressed) restarts the level
    if (level === 2 && l2.gameOver) return;
    if (level === 3 && l3.gameOver) return;
    if (level === 5 && l5.gameOver) { updateParticles(dt); return; }

    // Level 5 scripted beats: the wake-up cutscene and the carpet flight bypass
    // the platformer physics (the hero is frozen / carried)
    if (level === 5 && l5.wake.active) {
      updateWake5(dt); updateEnts5(dt); updateScarf(dt); updateParticles(dt); updateCamera(dt, player);
      driveL5WakeMusic(dt);   // only the lonely ambient score until the hero wakes
      return;
    }
    if (level === 5 && l5.flight && l5.flight.active) {
      if (!l5.gameOver) updateFlight5(dt);
      updateScarf(dt); updateParticles(dt);
      driveL5BattleTheme(dt, 0.6);
      return;
    }

    updatePlayer(dt, player);
    updateScarf(dt);
    updateParticles(dt);
    updateCamera(dt, player);

    if (level === 2) updateEnts2(dt);
    if (level === 3) updateEnts3(dt);
    if (level === 5) updateEnts5(dt);

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
      // during the L3 boss fight AND its aftermath (the witch finale + the
      // "THE SHADOW FALLS" card) crossfade the ambient theme out and the
      // Middle-Eastern battle theme in — the battle theme holds all the way to
      // the cut into Level 4.
      const bossEngaged = (level === 3 && l3.boss && l3.boss.active && !l3.boss.dead);   // live fight
      const bossAftermath = (level === 3 && l3.end && l3.end.stage > 0);                  // finale → SHADOW FALLS
      // the battle theme underscores the WHOLE of Level 5 (a lava-cave gauntlet)
      const l5Battle = (level === 5 && !l5.wake.active);
      const battleOn = bossEngaged || bossAftermath || l5Battle;
      musicVol = lerp(musicVol, battleOn ? 0.0 : 0.36, Math.min(1, dt * (battleOn ? 1.5 : 0.6)));
      musicSrc.setVolume(musicVol);
      if (battleSrc) {
        // the theme loops silently since load; on the rising edge of the fight
        // rewind it so it's heard from the very start, not mid-track
        if (battleOn && !bossWasFighting && battleSrc.rewind) battleSrc.rewind();
        bossWasFighting = battleOn;
        // hold at full through the whole finale, incl. the SHADOW FALLS card
        // while it waits for Enter; Level 4 (initL4) snaps it silent on the cut
        const battleTarget = battleOn ? 0.55 : 0.0;
        battleVol = lerp(battleVol, battleTarget, Math.min(1, dt * (battleTarget < battleVol ? 2.2 : 0.9)));
        battleSrc.setVolume(battleVol);
      }
    }
  };

  love.draw = function () {
    const dims = lg.getDimensions();
    const W = dims[0], H = dims[1];
    const S = Math.min(W / VW, H / VH);
    const ox = (W - VW * S) / 2, oy = (H - VH * S) / 2;
    // remember the letterbox transform so a menu click can map back to VW/VH
    titleMenu._S = S; titleMenu._ox = ox; titleMenu._oy = oy;

    lg.setCanvas(pixCanvas);
    lg.clear(0, 0, 0, 1);
    lg.push();
    lg.scale(1 / PIX);

    if (level === 1) drawBackground(cam); else if (level === 4) drawBalconyBack(); else if (level === 5) drawBackground5(cam); else drawBackground2(cam);

    lg.push();
    lg.translate(VW / 2, VH / 2);
    lg.scale(cam.zoom);
    lg.translate(-cam.x, -cam.y);

    if (level === 4) {
      // BEHIND the walls: the carpet (and the hero once he's flying away in the sky)
      if (l4.carpet) drawCarpetAt(l4.carpet.x, l4.carpet.y, 1.9);
      if (l4.phase === 8) { drawScarf(); drawHero(player); }
      drawBalconyFront();   // wall + frames + columns + balustrade + floor (occludes the sky layer)
      // IN FRONT, on the balcony floor: the attendants and the standing hero
      if (l4.guard) drawGuard(l4.guard);
      if (l4.servant) drawServant(l4.servant);
      if (l4.child) drawChild(l4.child);
      if (l4.phase !== 8) { drawScarf(); drawHero(player); }
    } else {
      if (level === 1) drawCastle(CASTLE_X, PROM_Y);
      drawPlats();
      if (level === 1) drawFlyingCarpet(-120, 1420, 1.7);   // magic carpet hovering over the high left cliff
      if (level === 2) drawEnts2();
      if (level === 3) drawEnts3();
      if (level === 5) drawEnts5();
    }
    drawDusts();
    // during the stair-climb finale the real hero is replaced by the backlit
    // climber (drawn inside drawEnts2), so hide the normal hero + scarf.
    // Falling into lava: the body vanishes on the spot (only the fiery splash
    // "schizzo" remains) instead of visibly sinking down through the molten pool.
    const heroInLava = (player.dying && player.lavaSink != null);
    if (level !== 4 && !(level === 2 && l2.endStage > 0) && !heroInLava) {
      // Level 5: the carpet flight seats the hero atop the flying carpet. (The
      // wake-up "getting up" is handled inside drawHero via wakePose/o.rot.)
      if (level === 5 && l5.carpet && l5.carpet.state === 'riding') {
        const fl = l5.flight;
        if (fl && fl.phase === 'fall') {
          // thrown from the carpet: draw the empty carpet where it drifts and the
          // King tumbling below it into the lava (decoupled from the carpet)
          drawFlyingCarpet(l5.carpet.x, l5.carpet.y + 74, 1.5);
          drawHero(player);
        } else {
          // carpet drawn at the hero's feet (its internal hover lifts it), so the
          // King rides ON TOP of it, not below
          drawFlyingCarpet(player.x, player.y + 74, 1.5);
          drawScarf(); drawHero(player);
        }
      } else if (level === 5 && l5.wake.active) {
        drawHero(player);   // no scarf while the body is tilted, getting up
      } else {
        drawScarf();
        drawHero(player);
      }
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
    // title menu: ↑/↓ choose, Enter/Space confirm
    if (titleMenu.active) {
      if (key === 'up' || key === 'down' || key === 'w' || key === 's' || key === 'left' || key === 'right') {
        titleMenu.sel = 1 - titleMenu.sel;
      } else if (key === 'return' || key === 'space' || key === 'z' || key === 'k' || key === 'x') {
        startFromMenu(titleMenu.sel === 0);
      }
      return;
    }
    // debug (?debug=…): number keys jump straight to a level
    if (DEBUG && (key === '1' || key === '2' || key === '3' || key === '4' || key === '5')) { initLevel(Number(key)); return; }
    if (key === 'r') { initLevel(level); return; }
    // Level 4 cutscene: advance the dialogue / skip beats
    if (level === 4) { if (key === 'space' || key === 'return' || key === 'x' || key === 'z' || key === 'k') l4.skip = true; return; }
    if (key === 'return' && level === 1 && cine.on && cine.stage >= 3) { initLevel(2); return; }
    // "THE SHADOW FALLS" card holds until the player continues — then the cut to
    // the flashback (Level 4). Enter (or the touch ENTER button, which sends
    // 'return'); space works too for parity with the game's other confirms.
    if ((key === 'return' || key === 'space') && level === 3 && l3.end && l3.end.waiting) { initLevel(4); return; }
    if (key === 'space' || key === 'z' || key === 'k') { player.jbuf = JBUF; }
    // CARPET FLIGHT: ATTACK always swings the sword while flying.
    // If the Fire-Sword has charge, the same swing also looses a lava bullet;
    // if it has no charge, the swing still works as a normal melee hit.
    if (level === 5 && l5.flight && l5.flight.active && l5.flight.phase === 'run' && !l5.gameOver) {
      if ((key === 'x' || key === 'f') && player.hasSword && !fireCharging(player)
        && (player.drawT || 0) <= 0 && ((player.atkT || 0) <= -0.10)) {
        player.swordIdle = 0;
        player.atkT = ATK_DUR;
        player.blockT = 0;
        if (sfxSwing) sfxSwing.play(0.38, 0.95 + love.math.random() * 0.18);
        if (player.lavaSword && (player.lavaCharge || 0) > 0) {
          fireLavaBullet(player);
          player.lavaCharge -= 1;
          if (player.lavaCharge <= 0) l5toast('Out of fire — hold BLOCK 1s to recharge');
        }
      }
      return;
    }
    const l5busy = (level === 5 && (l5.wake.active || (l5.flight && l5.flight.active)));
    const swordLevel = (level === 2 || level === 3 || level === 5);
    // if the blade is sheathed on the back, an ATTACK (or block) first DRAWS it
    // back into the usual position instead of striking
    if ((key === 'x' || key === 'f' || key === 'c') && swordLevel && player.hasSword && player.sheathed && !l5busy
      && (player.state === 'ground' || player.state === 'air')) {
      player.sheathed = false; player.swordIdle = 0; player.drawT = DRAW_DUR;
      if (sfxSwing) sfxSwing.play(0.3, 1.25);
      return;
    }
    const hasFire = (level === 5 && player.lavaSword);
    const riposteReady = (player && (player.riposte || 0) > 0 && (player.riposteHits || 0) > 0);
    if ((key === 'x' || key === 'f') && swordLevel && player.hasSword && !l5busy && !(hasFire && fireCharging(player))
      && (player.state === 'ground' || player.state === 'air')
      && (player.drawT || 0) <= 0
      && ((player.atkT || 0) <= -0.10 || riposteReady)) {   // riposte bypasses cooldown → double attack
      player.swordIdle = 0;
      player.atkT = ATK_DUR;
      player.blockT = 0;
      if (player.onGround) player.vx += player.facing * (riposteReady ? 80 : 45);
      if (sfxSwing) sfxSwing.play(riposteReady ? 0.44 : 0.38, (riposteReady ? 0.85 : 0.95) + love.math.random() * 0.18);
      // Fire-Sword: a charged swing looses one of its three lava bullets
      if (hasFire && (player.lavaCharge || 0) > 0) {
        fireLavaBullet(player);
        player.lavaCharge -= 1;
        if (player.lavaCharge <= 0) l5toast('Out of fire — hold BLOCK 1s to recharge');
      }
    }
    // block / parry (Level 2 / 3, with a sword). On Level 5 the Fire-Sword's
    // recharge is a 1-second BLOCK HOLD (handled continuously in updateFireCharge),
    // so a tap here does nothing for it.
    if (key === 'c' && swordLevel && player.hasSword && !l5busy && !hasFire
      && (player.atkT || 0) <= 0 && (player.state === 'ground' || player.state === 'air')) {
      player.blockT = BLOCK_DUR;
      player.swordIdle = 0;
    }
  };

  // title menu: click either option (hover highlights via the pointer)
  love.mousepressed = function (mx, my, button) {
    if (!titleMenu.active || button !== 1) return;
    const S = titleMenu._S || 1, ox = titleMenu._ox || 0, oy = titleMenu._oy || 0;
    const vx = (mx - ox) / S, vy = (my - oy) / S;
    for (let i = 0; i < menuRects.length; i++) {
      const r = menuRects[i];
      if (r && vx >= r.x && vx <= r.x + r.w && vy >= r.y && vy <= r.y + r.h) {
        titleMenu.sel = i; startFromMenu(i === 0); return;
      }
    }
  };
  love.mousemoved = function (mx, my) {
    if (!titleMenu.active) return;
    const S = titleMenu._S || 1, ox = titleMenu._ox || 0, oy = titleMenu._oy || 0;
    const vx = (mx - ox) / S, vy = (my - oy) / S;
    for (let i = 0; i < menuRects.length; i++) {
      const r = menuRects[i];
      if (r && vx >= r.x && vx <= r.x + r.w && vy >= r.y && vy <= r.y + r.h) { titleMenu.sel = i; return; }
    }
  };

  // expose a couple of read-only bits for the touch overlay
  love._game = {
    getLevel: function () { return level; },
    hasSword: function () { return player && player.hasSword; },
    // true while a non-interactive cutscene is playing — the touch overlay hides
    // its gameplay buttons (movement/jump/attack/block), keeping only R / ENTER
    inCutscene: function () {
      return titleMenu.active
        || level === 4
        || (level === 1 && cine.on)
        || (level === 2 && (l2.endStage || 0) > 0)
        || (level === 3 && (l3.end.stage || 0) > 0)
        || (level === 5 && (l5.wake.active || l5.end.stage > 0
            || (l5.flight && l5.flight.active && l5.flight.phase !== 'run')));
    },
  };

  // read-only hooks used by the headless verification harness (harmless in prod)
  love._debug = {
    player: function () { return player; },
    l2: function () { return l2; },
    l3: function () { return l3; },
    l4: function () { return l4; },
    l5: function () { return l5; },
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
