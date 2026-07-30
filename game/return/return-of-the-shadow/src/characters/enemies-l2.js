// ============================================================================
//  characters/enemies-l2.js — Level 2 ("The Witch's Keep") enemies & NPCs.
//
//  Patrolling/striking skeletons and flying biters (spawn/update/draw, with the
//  shared BONE colour), plus the wall-climbing NPC. Procedural like the hero.
//  drawBiter is reused by Level 5. Resolves shared helpers, the player and the
//  l2 state via the top-level scope. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
function newSkel(x, x0, x1, armed) {
  return { x: x, y: 0, vx: 0, vy: 0, dir: 1, t: 0, cool: 0,
    x0: x0, x1: x1, state: 'patrol', armed: armed, phase: love.math.random() * 6 };
}

// Flying severed head — pale human face, green hair — that swoops in to bite.
function newBiter(x, y) {
  return { hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, t: 0, cool: 0,
    phase: love.math.random() * 6.28, state: 'hover', bite: 0, hurt: 0, dead: 0 };
}


function skelBlockedAt(x, y) {
  // Prevents skeleton knockback from pushing skeletons through solid walls
  // or closed gates.
  for (const q of plats) {
    if (!q.beam && overlap(
        x - 10, y - 48,
        x + 10, y - 2,
        q.x, q.y,
        q.x + q.w, q.y + q.h
    )) {
      return true;
    }
  }

  const gateSet =
      level === 2 ? l2.gates :
          level === 3 ? l3.gates :
              level === 5 ? l5.gates :
                  null;

  if (gateSet) {
    for (const g of gateSet) {
      if ((g.openT || 0) > 0.82) continue;

      if (overlap(
          x - 10, y - 48,
          x + 10, y - 2,
          g.x, g.yTop,
          g.x + g.w, g.yBot
      )) {
        return true;
      }
    }
  }

  return false;
}

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
    const nx = sk.x + sk.vx * dt;
    const noFloor = floorAt(nx, sk.y) === undefined;
    const lowerL5Labyrinth = level === 5 && sk.y > FLOOR5 + 80;
    // Avoid knockback tunneling through walls/gates. In the lower Level 5
    // labyrinth, also avoid pushing skeletons onto non-existing floors.
    if (skelBlockedAt(nx, sk.y) || (lowerL5Labyrinth && noFloor)) {
      sk.vx = 0;
    } else {
      sk.x = nx;
      if (noFloor) {
        sk.state = 'fall';
        return;
      }
    }
    sk.vx = sk.vx * (1 - Math.min(1, dt * 6));
    if (sk.t > 0.55) {
      sk.state = 'patrol';
      sk.t = 0;
    }
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
