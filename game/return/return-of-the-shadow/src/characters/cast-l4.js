// ============================================================================
//  characters/cast-l4.js — Level 4 cutscene cast (procedural, solid-limb style).
//
//  The character factory (mkChar4), the shared solid-limb primitives
//  (limbLeg/limbArm) and walk-cycle angle helpers, and the three figures: the
//  palace guard, the handmaiden and the child. See plans/modularization-refactor.md.
// ============================================================================
'use strict';
function mkChar4(x, facing) { return { x: x, y: GROUND4, vx: 0, facing: facing, runPhase: 0, arrived: false }; }

// ---- generic solid limbs (same look as the hero, parameterised colours)
function limbLeg(ox, oy, a1, a2, thighCol, bootCol, sc) {
  sc = sc || 1;
  const kx = ox + Math.sin(a1) * 17 * sc, ky = oy + Math.cos(a1) * 17 * sc;
  const fx = kx + Math.sin(a2) * 16 * sc, fy = ky + Math.cos(a2) * 16 * sc;
  segment(ox, oy, kx, ky, 4.8 * sc, 3.7 * sc, thighCol);
  segment(kx, ky, fx, fy, 3.6 * sc, 2.9 * sc, thighCol);
  const bx = lerp(kx, fx, 0.45), by = lerp(ky, fy, 0.45);
  segment(bx, by, fx, fy, 3.4 * sc, 3.0 * sc, bootCol);
  segment(fx - 0.5 * sc, fy - 0.6 * sc, fx + 6 * sc, fy - 0.2 * sc, 2.8 * sc, 1.9 * sc, bootCol);
  return [fx, fy];
}
function limbArm(ox, oy, a1, a2, sleeveCol, skinCol, sc) {
  sc = sc || 1;
  const ex = ox + Math.sin(a1) * 14 * sc, ey = oy + Math.cos(a1) * 14 * sc;
  const hx = ex + Math.sin(a2) * 13 * sc, hy = ey + Math.cos(a2) * 13 * sc;
  segment(ox, oy, ex, ey, 3.6 * sc, 2.9 * sc, sleeveCol);
  segment(ex, ey, hx, hy, 2.9 * sc, 2.4 * sc, sleeveCol);
  setColA(skinCol); lg.circle('fill', hx, hy, 2.7 * sc);
  return [hx, hy];
}
function legAngles(ch) {
  const ph = ch.runPhase;
  // idle: legs stand nearly straight and close together (not splayed)
  if (Math.abs(ch.vx) <= 8) return { fT: 0.03, fK: 0.04, bT: -0.03, bK: -0.07 };
  const sF = Math.sin(ph), sB = Math.sin(ph + Math.PI);
  const kneeF = 0.30 + 0.85 * Math.max(0, Math.sin(ph - 2.1));
  const kneeB = 0.30 + 0.85 * Math.max(0, Math.sin(ph + Math.PI - 2.1));
  return { fT: 0.82 * sF, fK: 0.82 * sF - kneeF, bT: 0.82 * sB, bK: 0.82 * sB - kneeB };
}
function armAngles(ch, base) {
  if (Math.abs(ch.vx) <= 8) return { f: base, fh: base + 0.15, b: -base, bh: -base + 0.15 };
  const sF = Math.sin(ch.runPhase), sB = Math.sin(ch.runPhase + Math.PI);
  return { f: -0.5 * sF, fh: -0.5 * sF + 0.5, b: -0.5 * sB, bh: -0.5 * sB + 0.5 };
}

// ---- the burly turbaned palace guard (crossed arms when idle)
// All balcony figures share the hero's exact proportions (feet 0, hip -33,
// chest -49, head ~-58) and are drawn in PROFILE (nose forward, one eye), so
// after scale(facing,1) they face the way they are looking.

function drawGuard(g) {
  const SKIN = [0.80, 0.55, 0.36], PANT = [0.58, 0.15, 0.13], SASH = [0.86, 0.68, 0.28],
    TURB = [0.90, 0.87, 0.80], TURBB = [0.66, 0.16, 0.15], HAIR = [0.08, 0.06, 0.05];
  const moving = Math.abs(g.vx) > 8;
  const leg = legAngles(g), arm = armAngles(g, 0.3);
  const bob = moving ? Math.abs(Math.sin(g.runPhase)) * 1.6 : Math.sin(T * 1.4) * 0.5;
  lg.push(); lg.translate(g.x, g.y); lg.scale(g.facing, 1);
  lg.setColor(0, 0, 0, 0.22); lg.ellipse('fill', 0, 2, 14, 4);
  const hipY = -33 + bob, chY = -49 + bob;
  limbLeg(-2, hipY, leg.bT, leg.bK, mul(PANT, 0.72), [0.2, 0.14, 0.1], 1);
  if (moving) limbArm(-1, chY, arm.b, arm.bh, mul(SKIN, 0.82), mul(SKIN, 0.82), 1);
  // bare, slightly broad torso
  setColA(SKIN);
  lg.polygon('fill', -6.4, hipY + 1.5, 6.4, hipY + 1.5, 7.8, chY - 2, -7.8, chY - 2);
  lg.circle('fill', 0, chY - 1.5, 7.2);
  // chest sash + waist sash
  setColA(SASH); lg.setLineWidth(4); lg.line(-6.4, chY - 4, 6, hipY - 0.5);
  lg.setLineWidth(1); lg.rectangle('fill', -6.6, hipY - 1, 13, 3.5);
  // scimitar SHEATHED at the hip — a curved scabbard hanging down-back (its
  // hilt just peeks above the belt; the blade is not drawn pointing up)
  segment(-3, hipY, -7, hipY + 12, 2.8, 2.2, [0.32, 0.25, 0.17]);
  segment(-7, hipY + 12, -12, hipY + 20, 2.2, 1.4, [0.32, 0.25, 0.17]);
  setColA([0.74, 0.58, 0.30]); lg.circle('fill', -12, hipY + 20, 1.6);   // gold chape (tip)
  lg.rectangle('fill', -4.6, hipY - 2, 3, 3);                            // gold throat at the belt
  setColA([0.68, 0.50, 0.24]); lg.circle('fill', -2.6, hipY - 4, 1.5);   // small hilt pommel
  limbLeg(2, hipY, leg.fT, leg.fK, PANT, [0.2, 0.14, 0.1], 1);
  if (moving) { limbArm(1, chY, arm.f, arm.fh, SKIN, SKIN, 1); }
  else {   // folded arms (profile)
    segment(1, chY + 1, 8, chY + 7, 3.6, 3.0, mul(SKIN, 0.9));
    segment(1, chY + 6, 8, chY + 1, 3.4, 2.8, SKIN);
    setColA(SKIN); lg.circle('fill', 8, chY + 7, 3); lg.circle('fill', 8, chY + 1, 2.8);
  }
  // neck + profile head
  const hX = 0, hY = chY - 9.5;
  segment(0, chY - 4, hX, hY + 3, 2.9, 2.5, SKIN);
  setColA(SKIN); lg.circle('fill', hX, hY, 6.6);
  lg.polygon('fill', hX + 2.8, hY + 1, hX + 7, hY + 1.8, hX + 3.2, hY + 4.6);   // nose / chin
  setColA([0.1, 0.08, 0.08]); lg.circle('fill', hX + 2.6, hY - 0.6, 1.1);       // eye
  setColA(HAIR); lg.setLineWidth(1.8); lg.line(hX + 0.6, hY - 2.4, hX + 4.6, hY - 1.5);  // brow
  lg.setLineWidth(3);
  lg.arc('line', 'open', hX + 4.4, hY + 3, 3.2, -1.4, 1.0);                     // curled moustache
  lg.circle('fill', hX + 7.2, hY + 3.4, 1.5);
  // turban
  setColA(TURB); lg.ellipse('fill', hX - 1, hY - 6.5, 8.5, 6);
  lg.circle('fill', hX - 4, hY - 7, 4.5); lg.circle('fill', hX + 3, hY - 7, 4.5); lg.circle('fill', hX - 0.5, hY - 10, 5);
  setColA(TURBB); lg.rectangle('fill', hX - 8, hY - 6, 15, 2.2);
  setColA(SASH); lg.circle('fill', hX - 0.5, hY - 6, 1.6);
  setColA([0.75, 0.85, 0.9]); lg.setLineWidth(1.6); lg.line(hX - 0.5, hY - 11, hX + 1.5, hY - 18);
  lg.setLineWidth(1);
  lg.pop();
}

function drawServant(s) {
  const ROBE = [0.72, 0.20, 0.16], ROBED = [0.50, 0.13, 0.12], CREAM = [0.90, 0.85, 0.72],
    SASH = [0.86, 0.70, 0.30], SKIN = [0.82, 0.60, 0.44], HAIR = [0.10, 0.08, 0.09], FEATH = [0.78, 0.30, 0.32];
  const moving = Math.abs(s.vx) > 8;
  const sway = moving ? Math.sin(s.runPhase) * 0.9 : Math.sin(T * 1.2) * 0.3;
  const bob = moving ? Math.abs(Math.sin(s.runPhase)) * 1.4 : 0;
  lg.push(); lg.translate(s.x, s.y - bob); lg.scale(s.facing, 1);
  lg.setColor(0, 0, 0, 0.2); lg.ellipse('fill', 0, 2 + bob, 12, 3.5);
  const hipY = -33, chY = -49;
  // long swaying robe (hip → floor), same overall height as the hero
  setColA(ROBE); lg.polygon('fill', -6, hipY, 6, hipY, 11 + sway, 0, -9 + sway, 0);
  setColA(ROBED); lg.polygon('fill', 0, hipY, 5, hipY, 7 + sway, 0, 1 + sway, 0);
  setColA(SASH); lg.setLineWidth(1.8); lg.line(-9 + sway, -1, 11 + sway, -1);
  if (moving) { const f = Math.sin(s.runPhase); setColA([0.5, 0.35, 0.2]); lg.ellipse('fill', 3 + f * 3 + sway, -1, 3, 2); lg.ellipse('fill', -3 - f * 3 + sway, -1, 3, 2); }
  // bodice
  setColA(ROBE); lg.polygon('fill', -6, hipY + 1, 6, hipY + 1, 6.5, chY - 2, -6.5, chY - 2); lg.circle('fill', 0, chY - 1.5, 6.2);
  setColA(SASH); lg.rectangle('fill', -6.5, hipY - 1, 13, 3.5);
  // arms clasped in front (profile, cream sleeves)
  segment(0, chY + 2, 6, chY + 9, 3, 2.5, mul(CREAM, 0.9));
  segment(0, chY + 4, 6, chY + 8, 2.8, 2.3, CREAM);
  setColA(SKIN); lg.circle('fill', 6, chY + 8.5, 2.4);
  // neck + profile head
  const hX = 0, hY = chY - 9.5;
  segment(0, chY - 4, hX, hY + 3, 2.3, 2.0, SKIN);
  setColA(HAIR); lg.polygon('fill', hX - 2, hY - 4, hX - 8, hY + 14, hX - 2, hY + 12, hX - 1, hY);  // hair flows back
  setColA(SKIN); lg.circle('fill', hX, hY, 5.8);
  lg.polygon('fill', hX + 2.4, hY + 1, hX + 6, hY + 1.6, hX + 2.8, hY + 4);   // nose
  setColA([0.1, 0.08, 0.09]); lg.circle('fill', hX + 2, hY - 0.4, 0.95);     // eye
  // tall headdress + feather
  setColA(CREAM); lg.polygon('fill', hX - 5, hY - 4, hX + 5, hY - 4, hX + 3.5, hY - 15, hX - 4.5, hY - 15);
  setColA(SASH); lg.rectangle('fill', hX - 5, hY - 5.5, 10, 2);
  setColA(FEATH); lg.setLineWidth(2); lg.line(hX + 1, hY - 13, hX + 6, hY - 25);
  lg.setLineWidth(1);
  lg.pop();
}

function drawChild(c) {
  const TUNIC = [0.28, 0.44, 0.55], PANT = [0.34, 0.29, 0.20], SKIN = [0.86, 0.64, 0.47],
    HAIR = [0.12, 0.10, 0.09], SASH = [0.80, 0.55, 0.25];
  const moving = Math.abs(c.vx) > 8;
  const leg = legAngles(c), arm = armAngles(c, 0.32), sc = 0.66;
  const bob = moving ? Math.abs(Math.sin(c.runPhase)) * 1.6 : Math.sin(T * 1.6) * 0.5;
  lg.push(); lg.translate(c.x, c.y); lg.scale(c.facing * sc, sc);
  lg.setColor(0, 0, 0, 0.22); lg.ellipse('fill', 0, 2, 13, 4);
  const hipY = -33 + bob, chY = -49 + bob;
  limbLeg(-2, hipY, leg.bT, leg.bK, mul(PANT, 0.72), [0.2, 0.14, 0.1], 1);
  limbArm(-1, chY, arm.b, arm.bh, mul(TUNIC, 0.82), mul(SKIN, 0.85), 1);
  setColA(TUNIC); lg.polygon('fill', -5.6, hipY + 1.5, 5.6, hipY + 1.5, 7.2, chY - 2, -7.2, chY - 2); lg.circle('fill', 0, chY - 1.5, 6.8);
  setColA(SASH); lg.setLineWidth(3); lg.line(-5.8, hipY - 0.5, 5.8, hipY - 0.5); lg.setLineWidth(1);
  limbLeg(2, hipY, leg.fT, leg.fK, PANT, [0.2, 0.14, 0.1], 1);
  limbArm(1, chY, arm.f, arm.fh, TUNIC, SKIN, 1);
  const hX = 0, hY = chY - 9.5;
  segment(0, chY - 4, hX, hY + 3, 2.6, 2.2, SKIN);
  setColA(SKIN); lg.circle('fill', hX, hY, 6.2);
  lg.polygon('fill', hX + 2.5, hY + 1, hX + 6.4, hY + 1.8, hX + 3, hY + 4.4);   // nose
  setColA([0.1, 0.08, 0.08]); lg.circle('fill', hX + 2.4, hY - 0.6, 1.0);       // eye
  setColA(HAIR); lg.circle('fill', hX - 1, hY - 3.5, 6);
  lg.polygon('fill', hX - 5, hY - 2, hX - 6.5, hY + 4, hX - 2, hY + 2, hX - 1.5, hY - 2);
  lg.pop();
}

// The BACK layer: the night sky seen through the arches (moon + stars). Drawn
// first; the wall (front layer) then punches it down to just the openings.
