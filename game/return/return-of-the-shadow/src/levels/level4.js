// ============================================================================
//  levels/level4.js — Level 4 "Some Time Before": the palace cutscene.
//
//  The l4 state, the dialogue (L4_LINES), the balcony architecture (arch consts
//  + drawBalconyBack/Front), the cutscene logic (updateL4, walkToward, line
//  pacing) and the subtitle system + overlay. The procedural cast lives in
//  characters/cast-l4.js. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// ============================================================================
//  LEVEL 4 — "SOME TIME BEFORE"  (Persian-palace balcony cutscene)
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

const L4_ARCHES = [{ x: 300, w: 210 }, { x: 640, w: 250 }, { x: 980, w: 210 }];
const L4_SPRING = 205, L4_TIP = 50, L4_BOT = 360;


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

  if (l.phase === 0) {                       // "some time before" card
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
    if (FONT_SUB) { lg.setFont(FONT_SUB); lg.setColor(0.9, 0.87, 0.8, a); printSpaced('SOME  TIME  BEFORE', VW / 2, VH * 0.46, FONT_SUB, 6, 1); }
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

