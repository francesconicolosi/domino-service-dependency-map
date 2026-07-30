// ============================================================================
//  levels/level2.js — Level 2 "The Witch's Keep": state, logic and scenario.
//
//  The l2 state object, entity setup (initEnts2), per-frame logic (updateEnts2)
//  and the scenario rendering: gates, the rope/button puzzle, key, lift, end
//  door and keep castle door, plus the level draw (drawEnts2). Enemies live in
//  characters/enemies-l2.js; geometry data (plats2) is still in the engine core
//  for now. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
const l2 = { skels: [], biters: [], gates: [], rope: null, rbutton: null, key: null,
  lift: null, lives: 3, gameOver: false,
  doorOpen: false, doorOpenT: 0, endStage: 0, doorHinted: false,
  trap: null, button: null, sword: null, msg: '', msgT: 0, endT: 0 };
function l2toast(s) { l2.msg = s; l2.msgT = 3; }


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

  l2.lives = difficultyMaxLives(); l2.gameOver = false;
  l2.doorOpen = false; l2.doorOpenT = 0; l2.endStage = 0; l2.doorHinted = false;
  l2.msg = ''; l2.msgT = 0; l2.endT = 0;
}

const END_DOOR_X = 6585;   // centre of the exit door at the far end of the keep


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
