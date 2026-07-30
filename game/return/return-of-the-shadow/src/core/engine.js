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
//  core/engine.js — the shared engine core (loaded LAST). What remains after the
//  characters (src/characters), levels (src/levels) and shared art (src/art) were
//  carved out of the original monolith. It holds: procedural AUDIO; the shared
//  L2/L3 background + the platform renderer (drawPlats); PHYSICS
//  (collision/ledge/wall/mantle) and floorAt; save/title; the CAMERA + prologue
//  cinematic; the level manager (initLevel); TITLE/OVERLAY; and the love.*
//  callbacks (load/update/draw/keypressed) plus the read-only debug hooks.
//
//  Not wrapped in an IIFE: `lg` and the `RTS` namespace come from
//  core/00-namespace.js (loaded first), and every symbol from the other split
//  files resolves here by name because ordered classic scripts share one
//  top-level scope. The many "// X moved to Y" breadcrumbs below map where each
//  former section now lives. See plans/modularization-refactor.md.
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

  // L1 mountain background moved to levels/level1.js
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
  const DIFFICULTY_KEY = 'rots:difficulty';
  let gameDifficulty = 'normal';

  function normalizeDifficulty(value) { return value === 'easy' ? 'easy' : 'normal'; }
  function difficultyMaxHp() { return gameDifficulty === 'easy' ? 5 : 3; }
  function difficultyMaxLives() { return gameDifficulty === 'easy' ? 5 : 3; }
  function saveDifficulty(value) {
    gameDifficulty = normalizeDifficulty(value);
    try { localStorage.setItem(DIFFICULTY_KEY, gameDifficulty); } catch (e) {}
    return gameDifficulty;
  }
  function loadDifficulty() {
    try { gameDifficulty = normalizeDifficulty(localStorage.getItem(DIFFICULTY_KEY)); }
    catch (e) { gameDifficulty = 'normal'; }
    return gameDifficulty;
  }
  function clearDifficulty() {
    gameDifficulty = 'normal';
    try { localStorage.removeItem(DIFFICULTY_KEY); } catch (e) {}
  }
  function saveProgress(n) {
    try {
      if (n >= 2 && n <= 5) {
        localStorage.setItem(SAVE_KEY, String(n));
        localStorage.setItem(DIFFICULTY_KEY, gameDifficulty);
      }
    } catch (e) {}
  }
  function loadProgress() {
    try {
      const v = parseInt(localStorage.getItem(SAVE_KEY), 10);
      return (Number.isFinite(v) && v >= 2 && v <= 5) ? v : 0;
    } catch (e) { return 0; }
  }
  function clearProgress() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    clearDifficulty();
  }
  // titleMenu.active freezes the world behind a black title screen with the
  // witch's symbol and a Continue / New Game choice.
  const titleMenu = { active: false, sel: 0, savedLevel: 0, savedDifficulty: 'normal', t: 0 };

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

  // L5 banner/state/consts, music drivers, initEnts5/wake/updateEnts5 moved to levels/level5.js
  // Lava Knight (hit/update/splash/bullet) moved to characters/enemies-l5.js
  // lava/button/rock-carpet scenery draws moved to levels/level5.js
  // drawKnight5 moved to characters/enemies-l5.js
  // drawEnts5/background/overlay + CARPET FLIGHT moved to levels/level5.js

  // L4 banner/GROUND4/L4_LINES/l4 state moved to levels/level4.js
  // mkChar4 + limb helpers moved to characters/cast-l4.js
  // L4 balcony consts moved to levels/level4.js
  // drawGuard/drawServant/drawChild moved to characters/cast-l4.js
  // balcony draws + updateL4 + subtitles + overlay moved to levels/level4.js
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
    cine.titleA = 0; cine.subA = 0; cine.boxA = 0; cine.hintA = 0; cine.difficultySel = 0;
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
    player.hp = difficultyMaxHp();
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

  // updatePlayer moved to characters/player.js

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
      const a = smooth(cine.hintA);
      lg.setFont(FONT_HUD);
      lg.setColor(0.9, 0.85, 0.8, a * (0.55 + 0.25 * Math.sin(T * 2)));
      const msg = 'Press R to relive the ascent';
      lg.print(msg, VW / 2 - FONT_HUD.getWidth(msg) / 2, VH - 102);

      const diffY = VH - 76;
      const normalOn = cine.difficultySel === 0, easyOn = cine.difficultySel === 1;
      const normal = 'NORMAL';
      const easy = 'EASY';
      lg.setColor(0.9, 0.85, 0.8, a * (normalOn ? 1.0 : 0.45));
      lg.print((normalOn ? '› ' : '  ') + normal, VW / 2 - 115, diffY);
      lg.setColor(0.9, 0.85, 0.8, a * (easyOn ? 1.0 : 0.45));
      lg.print((easyOn ? '› ' : '  ') + easy + '  ·  5 HP / 5 LIVES', VW / 2 + 16, diffY);
      const msg2 = '← → choose difficulty      ENTER enter the castle';
      lg.setColor(0.9, 0.85, 0.8, a);
      lg.print(msg2, VW / 2 - FONT_HUD.getWidth(msg2) / 2, VH - 50);
    }
  }

  const LEVEL_NAMES = {
    2: "THE  WITCH'S  KEEP", 3: 'THE  BLACK  HALLS',
    4: 'SOME  TIME  BEFORE', 5: 'THE  LAVA  CAVERNS',
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
    const opts = ['CONTINUE  ·  LEVEL ' + titleMenu.savedLevel + '  ·  ' + titleMenu.savedDifficulty.toUpperCase(), 'NEW  GAME'];
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
      saveDifficulty(titleMenu.savedDifficulty || loadDifficulty());
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
      for (let i = 1; i <= difficultyMaxHp(); i++) {
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
      for (let i = 1; i <= difficultyMaxHp(); i++) {
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

    loadDifficulty();
    initLevel(startLevel);
    // If the player has reached Level 2+ before, greet them with the title
    // screen (witch's symbol + Continue / New Game) over the frozen world.
    // Otherwise boot with the "NYCOSOFT presents" studio card (normal first
    // load — never on R, and never in debug mode).
    const saved = DEBUG ? 0 : loadProgress();
    if (saved >= 2) {
      titleMenu.active = true; titleMenu.sel = 0; titleMenu.savedLevel = saved; titleMenu.savedDifficulty = gameDifficulty; titleMenu.t = 0;
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
    if (level === 1 && cine.on && cine.stage === 4 && cine.hintA >= 0.95) {
      // Normal is selected by default. Mobile keeps LEFT/RIGHT visible here;
      // ENTER confirms the current choice.
      if (key === 'left' || key === 'a' || key === 'up' || key === 'w') {
        cine.difficultySel = 0;
        return;
      }
      if (key === 'right' || key === 'd' || key === 'down' || key === 's') {
        cine.difficultySel = 1;
        return;
      }
      if (key === 'return' || key === 'space' || key === 'z' || key === 'k' || key === 'x') {
        saveDifficulty(cine.difficultySel === 1 ? 'easy' : 'normal');
        initLevel(2);
        return;
      }
    } else if (level === 1 && cine.on && cine.stage >= 3) {
      // The title card is still arriving: ignore confirm keys so the player
      // cannot skip the difficulty choice before it is fully visible.
      return;
    }
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
    getDifficulty: function () { return gameDifficulty; },
    maxHp: difficultyMaxHp,
    maxLives: difficultyMaxLives,  
    inDifficultyChoice: function () { return level === 1 && cine.on && cine.stage === 4 && cine.hintA >= 0.95; },
    getDifficultyChoice: function () { return cine.difficultySel || 0; },
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
    difficulty: function () { return gameDifficulty; },
    setDifficulty: function (value) { return saveDifficulty(value); },
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
