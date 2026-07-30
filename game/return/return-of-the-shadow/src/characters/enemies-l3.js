// ============================================================================
//  characters/enemies-l3.js — Level 3 ("The Black Halls") enemies & effects.
//
//  The six-armed guardian boss (spawn, lane logic, arm choreography, update and
//  hit detection) with its flung scimitars/flying swords, the candle-bearer,
//  the witch, and the storm lightning. Resolves the l3 state and shared helpers
//  via the top-level scope. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
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


function damageBossFromDeflectedSword(s) {
  const b = l3.boss;
  if (!b || b.dead || !b.active) return;
  b.hp -= 1;
  b.hitCool = 0.65;
  b.armSwing = 0.18;
  b.throwArm = s.armIndex;
  l3.windPush = 0.25;
  if (sfxHit) sfxHit.play(0.6, 0.7 + love.math.random() * 0.12);
  spawnDust(b.x + (s.dir || 1) * 28, b.y - 82, 10, 1.2);
  if (b.hp <= 0) {
    b.dead = true; b.deadT = 0; b.swords.length = 0; b.active = false;
    for (let i = 0; i < 6; i++) b.arms[i] = true;
    l3.end.stage = 1; l3.end.t = 0; l3.cutscene = true;
    l3toast('The returned blade shatters the guardian — but something worse stirs…');
  } else {
    l3toast('The returned blade strikes the guardian!  ' + b.hp + ' blow' + (b.hp === 1 ? '' : 's') + ' remain');
  }
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
        if (s.deflected) damageBossFromDeflectedSword(s);
        if (s.armIndex >= 0) b.arms[s.armIndex] = true;   // the blade is caught again
        b.swords.splice(i, 1); continue;
      }
    }
    // contact with the hero — blockable, else it wounds
    if (!p.dying && Math.abs(s.x - p.x) < 22 && !s.deflected) {
      const top = heroTop(p), bot = p.y;
      if (s.y + 9 > top && s.y - 9 < bot) {
        const dir = s.vx > 0 ? 1 : -1;   // way it would knock the hero
        // only the MIDDLE-lane blade can be parried; the low and high blades
        // must be dodged (jump the low, stay grounded under the high)
        if (s.lane === 'mid' && (p.blockT || 0) > 0 && p.facing === -dir) {
          // BLOCKED — the boomerang is knocked back toward the guardian
          s.phase = 'back'; s.vx = -560 * s.dir; s.deflected = true;
          p.blockFlash = 0.25;
          if (sfxParry) sfxParry.play(0.55, 1.0 + love.math.random() * 0.12);
          spawnDust(p.x + dir * 10, p.y - 30, 6, 0.8);
          l3toast('Blocked!  The blade is hurled back at the guardian');
        } else if ((p.inv || 0) <= 0) {
          hurtPlayer(p, dir);
          spawnDust(p.x, p.y - 30, 5, 0.8);
        }
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
  const facing = (player.x >= b.x) ? 1 : -1;   // the guardian turns to face the hero (profile)
  lg.push();
  lg.translate(x, y);
  lg.scale(a * facing, a);
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
  // back spines running up the spine (menacing silhouette)
  setColA(mul(DARK2, 1.1, fade));
  for (let i = 0; i < 4; i++) { const sy2 = -92 - i * 15; lg.polygon('fill', -24, sy2, -34 - i * 2, sy2 - 5, -24, sy2 - 9); }
  // torso base — tapered trunk
  setColA(bodyC);
  lg.polygon('fill', -22, -74, 22, -74, 28, -152, -28, -152);
  // darker central under-plate for depth
  setColA(mul(DARK, 1, fade));
  lg.polygon('fill', -13, -80, 13, -80, 17, -150, -17, -150);
  // V-shaped chest armour plate
  setColA(mul(DARK2, 1.25, fade));
  lg.polygon('fill', -24, -152, 24, -152, 15, -118, 0, -104, -15, -118);
  // abdominal ridges
  setColA(mul(DARK, 1, fade)); lg.setLineWidth(2);
  lg.line(-14, -90, 14, -90); lg.line(-12, -84, 12, -84);
  // gold filigree bands
  setColA(GOLD, 0.9 * fade); lg.setLineWidth(2.5);
  lg.line(-17, -100, 17, -100); lg.line(-13, -126, 13, -126);
  // glowing chest gem
  const gemg = 0.6 + 0.4 * Math.sin(T * 3);
  lg.setColor(1.0, 0.55, 0.35, fade * gemg * 0.4); lg.circle('fill', 0, -118, 10);
  lg.setColor(1.0, 0.28, 0.18, fade * gemg); lg.circle('fill', 0, -118, 5);
  // broad shoulder mass with spiked pauldrons (roots the long arms)
  setColA(bodyC); lg.polygon('fill', -34, -140, 34, -140, 24, -162, -24, -162);
  for (const sd of [-1, 1]) {
    setColA(mul(DARK2, 1.2, fade)); lg.polygon('fill', sd * 16, -158, sd * 34, -154, sd * 30, -140, sd * 14, -144);
    setColA(goldC); lg.polygon('fill', sd * 26, -156, sd * 40, -172, sd * 30, -152);
  }
  // six arms, each holding a solid scimitar, fanned out (3 per side). The arm
  // that just launched a blade thrusts out (b.throwArm) and its hand is empty
  // until the boomerang returns (b.arms[armIndex]).
  const armY = -152, shoulders = [-24, -6, 12];
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < 3; k++) {
      const armIndex = (side < 0 ? 0 : 3) + k;
      const swing = (b.armSwing > 0 && b.throwArm === armIndex)
        ? Math.sin((1 - b.armSwing / 0.35) * Math.PI) : 0;
      const idle = Math.sin(T * 2.2 + k * 1.3 + (side > 0 ? 0.7 : 0)) * 3.5;
      const sy = armY + shoulders[k];
      const reach = 46 + k * 12 + swing * 22;   // LONG arms; hand thrusts out on a throw
      const shx = side * 13, shy = sy;          // shoulder root
      const hx = side * reach, hy = sy - 6 + idle - swing * 9;   // hand
      const elx = lerp(shx, hx, 0.5) + side * 4;                 // elbow (bent)
      const ely = lerp(shy, hy, 0.5) + 9 - swing * 4;
      const shadeK = (k === 1) ? 0.82 : 1;      // middle pair a touch darker for depth
      const armC = mul(LIMB, shadeK, fade), armC2 = mul(LIMB2, shadeK, fade);
      segment(shx, shy, elx, ely, 6.0, 4.6, armC);   // upper arm (solid taper)
      segment(elx, ely, hx, hy, 4.6, 3.2, armC);     // forearm
      lg.circle('fill', elx, ely, 4.8);              // elbow
      setColA(armC2); lg.circle('fill', hx, hy, 4.0); // hand/fist
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
  // head — PROFILE, turned toward the hero (forward = +x). One eye, a forward
  // brow/snout, and a tall headdress swept up and back.
  setColA(DARK2, fade); lg.circle('fill', 0, -166, 14);
  setColA(DARK, fade);
  lg.polygon('fill', 10, -172, 20, -168, 17, -159, 9, -159);   // forward brow / snout
  // headdress swept up and back
  lg.polygon('fill', -14, -176, 8, -176, -2, -214, -20, -228, -26, -204);
  setColA(GOLD, 0.8 * fade); lg.setLineWidth(2);
  for (let i = 0; i < 4; i++) lg.line(-2 - i * 4, -180, -9 - i * 4, -214);
  // one burning red eye, forward
  const gl = 0.7 + 0.3 * Math.sin(T * 6);
  lg.setColor(1.0, 0.5, 0.4, fade * 0.3); lg.circle('fill', 7, -169, 5);
  lg.setColor(1.0, 0.2, 0.15, fade * gl); lg.circle('fill', 7, -169, 2.6);
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

