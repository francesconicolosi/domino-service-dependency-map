// ============================================================================
//  characters/enemies-l5.js — Level 5 ("The Lava Caverns") Lava Knight boss.
//
//  The Fire-Sword knight: hit detection, update AI, the lava splash and the
//  player's lava-bullet spawn, plus drawKnight5. Skeletons/biters are reused
//  from enemies-l2.js. Resolves the l5 state and shared helpers via the
//  top-level scope. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
function rectsOverlap(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function lavaKnightWorldBox(k, lx1, ly1, lx2, ly2) {
  // drawKnight5() mirrors the knight with lg.scale(k.dir, 1), so local X ranges
  // must be mirrored around k.x when the knight is travelling left.
  const f = k.dir || 1;
  if (f >= 0) return { x1: k.x + lx1, y1: k.y + ly1, x2: k.x + lx2, y2: k.y + ly2 };
  return { x1: k.x - lx2, y1: k.y + ly1, x2: k.x - lx1, y2: k.y + ly2 };
}

function lavaKnightHitBoxes(k) {
  // Hitboxes follow the actual drawKnight5() local-space silhouette.
  // They cover the horse body, head/neck, legs/tail, rider and raised weapon area,
  // so a hero sword touch on any visible part of the Lava Knight registers.
  return [
    // horse trunk and saddle mass
    lavaKnightWorldBox(k, -48, -68, 48, -32),
    // horse head, muzzle and neck
    lavaKnightWorldBox(k, 44, -92, 86, -54),
    // trailing tail and rear silhouette
    lavaKnightWorldBox(k, -70, -58, -42, -30),
    // legs and hooves
    lavaKnightWorldBox(k, -42, -48, 46, 2),
    // rider torso, helmet and seated leg
    lavaKnightWorldBox(k, -18, -118, 22, -54),
    // rider sword/arm area, broader while swinging
    lavaKnightWorldBox(k, 12, -112, 54, -74),
  ];
}

function heroSwordHitBox(p) {
  // Broad melee volume for the protagonist's procedural sword swing.
  // The sword is drawn from the upper body and sweeps forward/down, so the box
  // covers the real blade path rather than only the character center.
  const top = p.y - 98;
  const bot = p.y - 18;
  if ((p.facing || 1) >= 0) {
    return { x1: p.x + 14, y1: top, x2: p.x + 82, y2: bot };
  }
  return { x1: p.x - 82, y1: top, x2: p.x - 14, y2: bot };
}

function tryHitKnight(p) {
  const k = l5.knight;
  if (!k || k.dead || !k.active || k.hitCool > 0) return false;

  const swordBox = heroSwordHitBox(p);
  let touched = false;
  for (const box of lavaKnightHitBoxes(k)) {
    if (rectsOverlap(swordBox, box)) { touched = true; break; }
  }
  if (!touched) return false;

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
    if (!p.dying && Math.abs(b.x - p.x) < b.r + 11 && b.y > heroTop(p) && b.y < p.y) {
      const dir = b.vx > 0 ? 1 : -1;
      if ((p.blockT || 0) > 0 && p.facing === -dir) {
        // Lava bolts can be parried, but they do not rebound: the shield/sword
        // simply disperses the projectile in a small splash.
        p.blockFlash = 0.25;
        if (sfxParry) sfxParry.play(0.45, 0.85 + love.math.random() * 0.12);
        spawnLavaSplash(b.x, b.y, 3);
        k.bolts.splice(i, 1);
        continue;
      }
      if ((p.inv || 0) <= 0) {
        hurtPlayer(p, dir);
        spawnLavaSplash(b.x, b.y, 4);
        k.bolts.splice(i, 1);
      }
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

