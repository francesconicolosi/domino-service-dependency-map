// ============================================================================
//  levels/level5.js — Level 5 "The Lava Caverns": state, logic and scenario.
//
//  The l5 state (+KNIGHT/FL/CHARGE consts), the lava test, the L5 battle/wake
//  music drivers, initEnts5, the wake-up cutscene, lava-ball emitters and the
//  per-frame logic (updateEnts5), the lava/button/rock-carpet scenery draws,
//  the level draw + background + HUD overlay, and the whole CARPET FLIGHT
//  sub-mode (including the fixed fall-to-death). The Lava Knight lives in
//  characters/enemies-l5.js. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
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
  l5.lives = difficultyMaxLives(); l5.gameOver = false; l5.msg = ''; l5.msgT = 0;
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
  for (let i = 1; i <= difficultyMaxHp(); i++) {
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
  player.hp = difficultyMaxHp(); player.inv = 0.6; player.blockHold = 0;
  l5.bullets.length = 0;
}

function flightHurt(p) {
  // already tumbling off the carpet to our death — ignore any further hits this
  // frame (several enemies can overlap the King on the fatal frame)
  if (l5.flight && l5.flight.phase === 'fall') return;
  if (IMMORTAL) { p.inv = Math.max(p.inv || 0, 0.4); return; }
  if ((p.inv || 0) > 0 || p.dying) return;
  p.hp = (p.hp || difficultyMaxHp()) - 1; p.inv = 1.1; p.blockFlash = 0.2;
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
      p.hp = difficultyMaxHp(); p.inv = 1.6; player.lavaCharge = 3; player.blockHold = 0;
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
  for (let i = 1; i <= difficultyMaxHp(); i++) {
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
