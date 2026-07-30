// ============================================================================
//  core/04-particles.js — the shared particle system.
//
//  Wind streaks, snow and impact dust. Depends on lg, VW/VH, T and gust (all
//  from earlier core files) and love.math. Pure visuals, no level state.
//  See plans/modularization-refactor.md.
// ============================================================================
'use strict';
// -------------------------------------------------------------- PARTICLES
const windStreaks = [], snowFlakes = [], dusts = [];

function buildParticles() {
  const rng = love.math.newRandomGenerator(5);
  windStreaks.length = 0; snowFlakes.length = 0;
  for (let i = 0; i < 46; i++) {
    windStreaks.push({ x: rng.random() * VW, y: rng.random() * VH,
      spd: 260 + rng.random() * 420, len: 40 + rng.random() * 90, ph: rng.random() * 6.28 });
  }
  for (let i = 0; i < 70; i++) {
    snowFlakes.push({ x: rng.random() * VW, y: rng.random() * VH,
      spd: 40 + rng.random() * 90, r: 1 + rng.random() * 1.6, ph: rng.random() * 6.28 });
  }
}

function spawnDust(x, y, n, pow) {
  for (let i = 0; i < n; i++) {
    dusts.push({ x: x + (love.math.random() - 0.5) * 16, y: y - 3,
      vx: (love.math.random() - 0.5) * 90 * pow - 40,
      vy: -love.math.random() * 70 * pow,
      life: 0.5 + love.math.random() * 0.4, t: 0 });
  }
}

function updateParticles(dt) {
  const g = gust();
  for (const s of windStreaks) {
    s.x = s.x - s.spd * (0.5 + 0.8 * g) * dt;
    s.y = s.y + Math.sin(T * 2 + s.ph) * 22 * dt;
    if (s.x < -s.len) { s.x = VW + s.len; s.y = love.math.random() * VH; }
  }
  for (const f of snowFlakes) {
    f.x = f.x - f.spd * (0.8 + g) * dt * 2.2;
    f.y = f.y + (18 + 14 * Math.sin(T + f.ph)) * dt;
    if (f.x < -4) { f.x = VW + 4; f.y = love.math.random() * VH; }
    if (f.y > VH + 4) f.y = -4;
  }
  for (let i = dusts.length - 1; i >= 0; i--) {
    const d = dusts[i];
    d.t += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 60 * dt;
    if (d.t > d.life) dusts.splice(i, 1);
  }
}

function drawDusts() {
  for (const d of dusts) {
    const k = 1 - d.t / d.life;
    lg.setColor(0.85, 0.75, 0.66, 0.35 * k);
    lg.circle('fill', d.x, d.y, 2 + (1 - k) * 4);
  }
}

function drawScreenParticles(altFade) {
  const g = gust();
  lg.setLineWidth(1.4);
  for (const s of windStreaks) {
    lg.setColor(1, 0.92, 0.82, (0.04 + 0.10 * g));
    lg.line(s.x, s.y, s.x + s.len, s.y - 4);
  }
  for (const f of snowFlakes) {
    lg.setColor(0.95, 0.94, 1.0, 0.32 * altFade);
    lg.circle('fill', f.x, f.y, f.r);
  }
  lg.setLineWidth(1);
}
