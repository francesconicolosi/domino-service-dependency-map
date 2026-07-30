// ============================================================================
//  characters/player.js — the hero ("The King"): entity, cape physics, and the
//  fully procedural pose / animation system + rendering.
//
//  No sprite art exists in this game: every pose is math (IK limbs, pose
//  interpolation). This file holds the player entity + factory (newPlayer), the
//  scarf/cape simulation, the pose selectors (poseFor and its helpers), the
//  limb/sword drawing primitives, the master renderer drawHero, and the
//  kill/respawn helpers. Per-frame game logic (updatePlayer) still lives with
//  the engine for now; it will move here in a later pass.
//
//  Resolves shared constants/utils/art and the module globals it touches
//  (respawn, level, lN, …) via the shared top-level scope of the ordered
//  classic scripts. See plans/modularization-refactor.md.
// ============================================================================
'use strict';

// -------------------------------------------------------------- PLAYER
let player;

const ledges = [], faces = [];
function buildLevel() {
  ledges.length = 0; faces.length = 0;
  for (const p of plats) {
    if (!p.beam) {
      ledges.push({ x: p.x, y: p.y, side: -1 });
      ledges.push({ x: p.x + p.w, y: p.y, side: 1 });
      if (p.climbL) {
        if (p.climbRanges && p.climbRanges.length) {
          for (const r of p.climbRanges) faces.push({ x: p.x, ytop: r.top, ybot: r.bot, side: -1, bot: r.bot });
        } else faces.push({ x: p.x, ytop: p.y, ybot: p.y + p.h, side: -1, bot: p.climbBot != null ? p.climbBot : (p.y + p.h) });
      }
      if (p.climbR) {
        if (p.climbRanges && p.climbRanges.length) {
          for (const r of p.climbRanges) faces.push({ x: p.x + p.w, ytop: r.top, ybot: r.bot, side: 1, bot: r.bot });
        } else faces.push({ x: p.x + p.w, ytop: p.y, ybot: p.y + p.h, side: 1, bot: p.climbBot != null ? p.climbBot : (p.y + p.h) });
      }
    }
  }
}

// Lazy default: initLevel() always assigns the real per-level respawn point
// (from checkpoints[0]) before the player spawns, so we must NOT read level
// data (checkpoints1) at load time here — that data lives in a later-loaded
// script and would be in the temporal dead zone.
let respawn = { x: 0, y: 0 };

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
    hp: difficultyMaxHp(), inv: 0, atkT: 0, drawT: 0, hasSword: false,
    blockT: 0, riposte: 0, riposteHits: 0, blockFlash: 0,
    sheathed: false, swordIdle: 0,   // sword rests in the back scabbard after 5s idle
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

// Level 5 wake-up: fast two-frame sequence using the standard hero model only.
// Frame 1: standard protagonist laid down and vertically inverted.
// Frame 2: exactly the same crouch pose used by normal gameplay.
// No custom renderer, no IK, no custom torso, no interpolation.
function wakePose(k) {
  const o = basePose();
  k = clamp(k, 0, 1);

  if (k < 0.76) {                       // FRAME 1: prone / face-down, vertical inversion
    o.rot = 1.55;                       // lay the standard model almost horizontal
    o.flipXY = true;                    // first frame: belly down, head right / body left
    o.bob = 0;
    o.lean = 0.02;
    o.armF = [0.34, 0.26];
    o.armB = [-0.20, -0.10];
    o.legF = [0.12, 0.06];
    o.legB = [-0.12, -0.16];

  } else {                              // FRAME 2: exact gameplay crouch pose
    o.bob = 15;
    o.lean = 0.10;
    o.legF = [1.00, -1.30];
    o.legB = [-0.98, -1.34];
    o.armF = [0.55, 1.05];
    o.armB = [-0.35, -0.10];
  }
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

  // Level 5 wake-up: the hero is getting up off the cave floor
  if (level === 5 && l5.wake && l5.wake.active) return wakePose(l5.wake.rise || 0);

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

// A curved steel scimitar. `a` is the blade's base direction (body-local
// sin/cos convention); the blade bows toward its back (spine) as it nears the
// flared tip, with the cutting edge along the inner belly. Shared by the hero,
// the skeletons and the loose sword pickups so every blade reads the same.
function drawSwordAt(x, y, a) {
  const bx = Math.sin(a), by = Math.cos(a);                          // blade axis
  const px = Math.sin(a + Math.PI / 2), py = Math.cos(a + Math.PI / 2); // perpendicular
  // grip + pommel
  lg.setColor(0.30, 0.22, 0.12, 1); lg.setLineWidth(3);
  lg.line(x - bx * 5, y - by * 5, x + bx * 2, y + by * 2);
  lg.setColor(0.20, 0.15, 0.09, 1); lg.circle('fill', x - bx * 5, y - by * 5, 1.8);
  // curved crossguard (quillon)
  lg.setColor(0.62, 0.48, 0.22, 1); lg.setLineWidth(2.6);
  lg.line(x + bx * 2 - px * 5, y + by * 2 - py * 5, x + bx * 2 + px * 5, y + by * 2 + py * 5);
  lg.setColor(0.80, 0.64, 0.30, 1); lg.circle('fill', x + bx * 2, y + by * 2, 1.9);
  // curved blade — spine (back) and edge (belly) meeting at a flared tip
  const L = 30, CURVE = 9, N = 8;
  const baseX = x + bx * 3, baseY = y + by * 3;
  const spine = [], edge = [], mids = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const w = (1 - s) * 2.6 + (s > 0.86 ? 1.4 : 0.5);   // taper, slight tip flare
    const cur = CURVE * s * s;                            // curvature grows to the tip
    const cx = baseX + bx * (L * s) + px * cur;
    const cy = baseY + by * (L * s) + py * cur;
    mids.push(cx, cy);
    spine.push(cx + px * w, cy + py * w);   // back edge (outer)
    edge.push(cx - px * w, cy - py * w);    // cutting edge (inner belly)
  }
  const poly = spine.slice();
  for (let i = edge.length - 2; i >= 0; i -= 2) { poly.push(edge[i], edge[i + 1]); }
  lg.setColor(0.74, 0.77, 0.83, 1); lg.polygon('fill', poly);
  // bright spine highlight
  lg.setColor(0.96, 0.98, 1.0, 0.9); lg.setLineWidth(1.3);
  for (let i = 0; i < spine.length - 2; i += 2) lg.line(spine[i], spine[i + 1], spine[i + 2], spine[i + 3]);
  // darker fuller down the centreline
  lg.setColor(0.52, 0.55, 0.62, 0.8); lg.setLineWidth(1);
  for (let i = 0; i < mids.length - 2; i += 2) lg.line(mids[i], mids[i + 1], mids[i + 2], mids[i + 3]);
  lg.setLineWidth(1);
}

function drawHeldSword(hx, hy, forearmA) {
  drawSwordAt(hx, hy, forearmA + 0.35);
}

// Flames wreathing the charged Fire-Sword blade. `a` is the blade direction
// (body-local sin/cos convention). Drawn in the hero's local space.
function drawBladeFire(hx, hy, a) {
  const bx = Math.sin(a), by = Math.cos(a);                          // along the blade
  const px = Math.sin(a + Math.PI / 2), py = Math.cos(a + Math.PI / 2); // perpendicular
  const bx0 = hx + bx * 6, by0 = hy + by * 6;   // start a little out from the hand
  // slim heat glow hugging the blade (not a big blob near the body)
  for (let i = 1; i <= 6; i++) {
    const d = 6 + i * 4.2;
    lg.setColor(1.0, 0.42, 0.10, 0.09);
    lg.circle('fill', hx + bx * d, hy + by * d, 4.6);
  }
  // flickering flame tongues licking off the edge, growing toward the tip
  const n = 6;
  for (let i = 0; i < n; i++) {
    const d = 4 + i * (28 / n);
    const flick = Math.sin(T * 16 + i * 1.7) * 0.5 + 0.5;
    const side = (i % 2 === 0) ? 1 : -1;
    const bxp = bx0 + bx * d, byp = by0 + by * d;                    // point along blade
    const len = 5 + flick * 7;
    const tipx = bxp + (bx * 0.7 + px * side * 0.7) * len;
    const tipy = byp + (by * 0.7 + py * side * 0.7) * len;
    lg.setColor(1.0, 0.38, 0.07, 0.5);
    lg.polygon('fill', bxp - px * side * 1.8, byp - py * side * 1.8,
      bxp + px * side * 1.8, byp + py * side * 1.8, tipx, tipy);
    lg.setColor(1.0, 0.85, 0.4, 0.75);
    lg.polygon('fill', bxp - px * side * 0.9, byp - py * side * 0.9,
      bxp + px * side * 0.9, byp + py * side * 0.9,
      bxp + (bx * 0.7 + px * side * 0.7) * len * 0.55, byp + (by * 0.7 + py * side * 0.7) * len * 0.55);
  }
  // bright white-hot core running down the blade
  lg.setColor(1.0, 0.78, 0.35, 0.85); lg.setLineWidth(2);
  lg.line(bx0, by0, hx + bx * 30, hy + by * 30);
  lg.setLineWidth(1);
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
  } else if (p.hasSword && !p.sheathed && p.state === 'ground' && Math.abs(p.vx) < 30) {
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
  // wake-up: tilt the whole body up from lying flat to standing (pivot = feet)
  if (o.flipXY) {
    // Level 5 wake-up frame 1: mirror both axes so the hero is belly-down
    // while keeping the head to the right and the rest of the body to the left.
    lg.scale(-p.facing, -1);
    if (o.rot) lg.rotate(-o.rot);
  } else {
    if (o.rot) lg.rotate(-o.rot * p.facing);
    lg.scale(p.facing, 1);
  }

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


  // sword sheathed on the back — the scabbard runs along the back edge with
  // BOTH ends poking clear of the body: the chape below the hip and the hilt
  // above the shoulder (drawn behind the torso, on the back/left side)
  if (p.hasSword && p.sheathed && (p.drawT || 0) <= 0) {
    const bx0 = hipX - 9, by0 = hipY + 5;   // chape (below the hip, back edge)
    const bx1 = chX - 9, by1 = chY - 3;     // scabbard mouth (at the shoulder)
    let ux = bx1 - bx0, uy = by1 - by0; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const pxp = -uy, pyp = ux;
    lg.setColor(0.19, 0.14, 0.09, 1); lg.setLineWidth(6); lg.line(bx0, by0, bx1, by1);   // scabbard body
    lg.setColor(0.36, 0.27, 0.16, 1); lg.setLineWidth(2.4); lg.line(bx0, by0, bx1, by1); // rib highlight
    lg.setColor(0.60, 0.50, 0.30, 1); lg.circle('fill', bx0, by0, 2.4);                  // metal chape
    // hilt above the shoulder: grip + gold curved crossguard + pommel
    const gx = bx1 + ux * 4, gy = by1 + uy * 4, tx = bx1 + ux * 15, ty = by1 + uy * 15;
    lg.setColor(0.32, 0.23, 0.12, 1); lg.setLineWidth(3.4); lg.line(gx, gy, tx, ty);
    lg.setColor(0.22, 0.16, 0.09, 1); lg.circle('fill', tx, ty, 2.4);                    // pommel
    lg.setColor(0.70, 0.55, 0.26, 1); lg.setLineWidth(2.8);
    lg.line(gx - pxp * 5.5, gy - pyp * 5.5, gx + pxp * 5.5, gy + pyp * 5.5);              // crossguard
    lg.setColor(0.86, 0.70, 0.34, 1); lg.circle('fill', gx, gy, 1.8);                    // guard boss
    lg.setLineWidth(1);
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
  if (p.hasSword && !p.sheathed && (p.drawT || 0) <= DRAW_DUR * 0.45) {
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
    // Fire-Sword charged: the blade blazes with flame
    if (level === 5 && p.lavaSword && (p.lavaCharge || 0) > 0) {
      drawBladeFire(hf[0], hf[1], o.armF[1] + 0.35);
    }
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

// -------------------------------------------------------------- PLAYER UPDATE
function killPlayer(p) { if (IMMORTAL) return; if (!p.dying) { p.dying = true; p.deadFade = 0; } }

function respawnPlayer(p) {
  p.x = respawn.x; p.y = respawn.y;
  p.vx = 0; p.vy = 0;
  p.state = 'ground'; p.onGround = true; p.coyote = COYOTE; p.t = 0;
  p.ledge = null; p.face = null; p.mant = null;
  p.hp = difficultyMaxHp(); p.inv = 1.2; p.atkT = 0; p.drawT = 0;
  p.blockT = 0; p.riposte = 0; p.riposteHits = 0;
  p.sheathed = false; p.swordIdle = 0;   // respawn with the blade drawn and ready
  p.lavaSink = null;
  resetScarf(...neckPos(p));
}

// ---------------------------------------------------------------- player combat
// tryParry / hurtPlayer were physically located in the Level 2 section of the
// old monolith but are player-character logic, so they live here with the hero.
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
  if (IMMORTAL) { p.inv = Math.max(p.inv || 0, 0.4); return; }
  if ((p.inv || 0) > 0 || p.dying) return;
  p.hp = (p.hp || difficultyMaxHp()) - 1;
  p.inv = 1.1;
  p.vx = dir * 240;
  p.vy = -180;
  p.state = 'air'; p.t = 0;
  if (p.hp <= 0) killPlayer(p);
}


// ---------------------------------------------------------------- player update
// updatePlayer — the hero's per-frame logic / state machine (movement, jump,
// wall-grab, climb, attack/block, level-specific death handling). Reads level
// state (l2/l3/l5) and the cine via the shared top-level scope.
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
    if (!p.sheathed && p.swordIdle > 10) p.sheathed = true;
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
