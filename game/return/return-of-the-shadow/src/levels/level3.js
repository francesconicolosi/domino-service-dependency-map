// ============================================================================
//  levels/level3.js — Level 3 "The Black Halls": state, logic and scenario.
//
//  The l3 state (+lane/boss tuning consts), the hole test, initEnts3/updateEnts3,
//  the hall/saloon torches and level draw (drawEnts3), the rescue carpet, and
//  the darkness veil (drawDark3). The boss and other enemies live in
//  characters/enemies-l3.js. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
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
  // gate K stands on the floor just past the key shelf — its base sits ON the
  // brick floor (over the basement, not sunk into it) and it's tall enough
  // (top well above head height) that it can't be cleared with a jump.
  l3.gateK = { id: 'K', x: 2150, w: 18, yTop: -100, yBot: FLOOR3, openT: 0, locked: true, open: false, hinted: false, promptShown: false };
  l3.gateS = { id: 'S', x: SALOON_L + 2, w: 20, yTop: 40, yBot: FLOOR3, openT: 1, locked: false, open: true };
  l3.gates = [l3.gateK, l3.gateS];
  l3.candle = { x: 6120, y: FLOOR3, taken: false };
  l3.lit = false; l3.litT = 0; l3.litHint = false;
  l3.boss = null; l3.hole = null;
  l3.end = { stage: 0, t: 0, holeX: 0, waiting: false }; l3.cutscene = false;
  l3.lives = difficultyMaxLives(); l3.gameOver = false; l3.msg = ''; l3.msgT = 0;
  l3._hitThisSwing = false; l3.windPush = 0; l3.flash = 0; l3.doorHinted = false;
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
    // once we hold on the SHADOW FALLS card (stage 3) freeze time so the card
    // stays lit and the battle theme keeps playing until the player continues
    if (!l3.end.waiting) l3.end.t += dt;
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
      // hero has fallen into the dark and the card has faded in — HOLD here and
      // wait for the player to press Enter before cutting to the "some time
      // before" flashback (Level 4). Advancing happens in keypressed.
      if (l3.end.t > 3.6) l3.end.waiting = true;
    }
  }

  l3.msgT = Math.max(0, l3.msgT - dt);
}

// ------------------------------------------------------------------ L3 art

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
  // (the rescue carpet is drawn in screen space in drawOverlays so it stays
  //  visible on TOP of the fade-to-black and the end label)
}

// The magic carpet diving after the falling hero — drawn in SCREEN space so it
// stays visible over the fade-to-black and the "TO BE CONTINUED" label. It's a
// foreshadow of the next level's rescue, so it must never be hidden.
function drawRescueCarpet() {
  const e = l3.end;
  if (e.stage < 2) return;
  const ft = (e.stage === 2) ? e.t : e.t + 0.7;   // seconds since the fall began
  const sx = VW / 2 + (player.x - cam.x) * cam.zoom;   // tracks the hero (≈ centre)
  const gy = clamp(VH * 0.28 + ft * 150, VH * 0.28, VH * 0.82);   // enters high, descends, then hovers
  drawFlyingCarpet(sx, gy, 2.0);
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
