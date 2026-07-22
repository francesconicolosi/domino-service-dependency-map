// ============================================================================
//  THE RETURN OF THE SHADOW — Level Editor (native HTML/JS port)
//  Ported from editor/main.lua onto love-shim.js.
//
//  Saves layouts to the browser's localStorage (which the game reads back
//  automatically) AND offers a .lua download compatible with the desktop
//  Love2D build. Drag on empty space to create a platform (thin = beam),
//  click to select, drag to move, drag an edge to resize.
// ============================================================================

(function () {
  'use strict';
  const lg = love.graphics;

  const VW = 1280, VH = 720, PIX = 2;
  let pixCanvas;
  const CASTLE_X = 6500, PROM_Y = 424;

  const COL = { skyTop: [0.22, 0.12, 0.36], skyLow: [0.99, 0.55, 0.24], rockLit: [0.98, 0.62, 0.34], snow: [0.90, 0.88, 0.97] };
  const STONE = { base: [0.335, 0.305, 0.375], mid: [0.265, 0.240, 0.310], dark: [0.160, 0.145, 0.205], lit: [0.475, 0.440, 0.485], moss: [0.30, 0.42, 0.18], mossL: [0.50, 0.68, 0.25] };
  const BRICK = { base: [0.30, 0.27, 0.30], dark: [0.165, 0.145, 0.175], lit: [0.42, 0.38, 0.40], mort: [0.11, 0.10, 0.125] };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // -------------------------------------------------------------- LEVEL DATA
  let plats1 = [
    { x: -260, y: 1420, w: 260, h: 980 }, { x: 0, y: 1800, w: 760, h: 560 },
    { x: 840, y: 1728, w: 220, h: 640 }, { x: 1140, y: 1652, w: 190, h: 720 },
    { x: 1520, y: 1636, w: 330, h: 740 }, { x: 1920, y: 1476, w: 260, h: 900 },
    { x: 2260, y: 1468, w: 150, h: 16, beam: true }, { x: 2480, y: 1446, w: 140, h: 16, beam: true },
    { x: 2700, y: 1424, w: 320, h: 950 }, { x: 3080, y: 1044, w: 280, h: 1330, climbL: true, climbBot: 1508 },
    { x: 3420, y: 1000, w: 230, h: 1380 }, { x: 3760, y: 856, w: 210, h: 1520 },
    { x: 4030, y: 846, w: 140, h: 16, beam: true }, { x: 4230, y: 816, w: 280, h: 1560 },
    { x: 4740, y: 796, w: 250, h: 1580 }, { x: 5060, y: 516, w: 300, h: 1860, climbL: true, climbBot: 880 },
    { x: 5420, y: 470, w: 190, h: 1900 }, { x: 5680, y: PROM_Y, w: 1520, h: 1960 },
  ];
  let checkpoints1 = [{ x: 160, y: 1800 }, { x: 1620, y: 1636 }, { x: 2760, y: 1424 }, { x: 3480, y: 1000 }, { x: 4310, y: 816 }, { x: 5760, y: PROM_Y }];

  let plats2 = [
    { x: -60, y: 900, w: 1000, h: 560 }, { x: 1300, y: 744, w: 660, h: 700 },
    { x: 2100, y: 744, w: 430, h: 700 }, { x: 2530, y: 384, w: 260, h: 1060, climbL: true, climbBot: 700 },
    { x: 2790, y: 384, w: 560, h: 1420 }, { x: 3480, y: 384, w: 760, h: 1420 },
  ];
  for (let i = 0; i <= 5; i++) plats2.push({ x: 940 + i * 60, y: 900 - (i + 1) * 26, w: 66, h: 560 + (i + 1) * 26 });
  let checkpoints2 = [{ x: 150, y: 900 }, { x: 1360, y: 744 }, { x: 2160, y: 744 }, { x: 2860, y: 384 }, { x: 3560, y: 384 }];

  let curLevel = 1;
  let plats = plats1, checkpoints = checkpoints1;

  const L2_MARKS = {
    trap: { x: 2360, y: 452, w: 66, h: 42 },
    button: { x: 2170, y: 744, w: 44 },
    skels: [[2170, 2470, 744], [2880, 3300, 384], [3560, 3960, 384]],
    door: { x: 4100, y: 384 },
  };

  // -------------------------------------------------------------- ROCK RENDER
  function invalidate(p) { p._tris = null; p._pts = null; p._leftI = null; }

  function rockOutline(p, pi) {
    if (p._tris) return p._tris;
    const rng = love.math.newRandomGenerator(pi * 4211 + 13);
    const pts = [];
    function push(x, y) { pts.push(x); pts.push(y); }
    push(p.x, p.y); push(p.x + p.w, p.y);
    if (!p.climbR) {
      let y = p.y;
      while (y < p.y + p.h - 44) { y = y + 30 + rng.random() * 42; push(p.x + p.w + rng.random() * 14, Math.min(y, p.y + p.h - 6)); }
    }
    push(p.x + p.w, p.y + p.h); push(p.x, p.y + p.h);
    if (!p.climbL) {
      p._leftI = pts.length;
      const ys = []; let y = p.y + p.h;
      while (y > p.y + 44) { y = y - (30 + rng.random() * 42); ys.push(Math.max(y, p.y + 8)); }
      for (const yy of ys) push(p.x - rng.random() * 14, yy);
    }
    let tris = love.math.triangulate(pts);
    if (!tris || tris.length === 0) tris = [[p.x, p.y, p.x + p.w, p.y, p.x + p.w, p.y + p.h], [p.x, p.y, p.x + p.w, p.y + p.h, p.x, p.y + p.h]];
    p._tris = tris; p._pts = pts;
    return p._tris;
  }
  function drawGrass(x, y, w, rng) {
    lg.setColor(STONE.moss[0] * 0.55, STONE.moss[1] * 0.55, STONE.moss[2] * 0.55, 1);
    lg.rectangle('fill', x, y - 4, w, 5);
    let gx = x + 3;
    while (gx < x + w - 3) {
      const gh = 4 + Math.floor(rng.random() * 6);
      lg.setColor(STONE.moss[0], STONE.moss[1], STONE.moss[2], 1);
      lg.rectangle('fill', gx, y - 4 - gh, 3, gh);
      if (rng.random() < 0.55) { lg.setColor(STONE.mossL[0], STONE.mossL[1], STONE.mossL[2], 1); lg.rectangle('fill', gx, y - 4 - gh, 2, 2); }
      gx = gx + 4 + Math.floor(rng.random() * 7);
    }
  }
  function drawClimbMarks(p, pi) {
    const rng = love.math.newRandomGenerator(pi * 557 + 3);
    const x = p.x;
    const yEnd = Math.min((p.climbBot != null ? p.climbBot : (p.y + p.h)) + 30, p.y + p.h - 16);
    lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.30); lg.rectangle('fill', x, p.y + 4, 18, yEnd - p.y - 4);
    lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 0.95); lg.rectangle('fill', x + 18, p.y + 4, 2, yEnd - p.y - 4);
    let y = p.y + 26;
    while (y < yEnd - 14) {
      lg.setColor(0, 0, 0, 0.55); lg.rectangle('fill', x + 2, y, 13, 4);
      lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.85); lg.rectangle('fill', x + 2, y - 2, 13, 2);
      if (rng.random() < 0.35) {
        lg.setColor(STONE.mid[0], STONE.mid[1], STONE.mid[2], 1); lg.rectangle('fill', x - 4, y + 9, 5, 6);
        lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.7); lg.rectangle('fill', x - 4, y + 9, 5, 2);
      }
      y = y + 26;
    }
  }
  function drawBrickBody(p, pi) {
    const rng = love.math.newRandomGenerator(pi * 911 + 17);
    lg.setColor(BRICK.dark[0], BRICK.dark[1], BRICK.dark[2], 1); lg.rectangle('fill', p.x, p.y, p.w, p.h);
    const bh = 16, bw = 46; const hLim = Math.min(p.h, 900);
    let row = 0, cy = p.y;
    while (cy < p.y + hLim) {
      const off = (row % 2 === 0) ? 0 : bw * 0.5; let cx = p.x - off;
      while (cx < p.x + p.w) {
        const x0 = Math.max(cx, p.x), x1 = Math.min(cx + bw - 2, p.x + p.w);
        if (x1 > x0 + 3) {
          const v = 0.85 + rng.random() * 0.3;
          lg.setColor(BRICK.base[0] * v, BRICK.base[1] * v, BRICK.base[2] * v, 1); lg.rectangle('fill', x0, cy + 1, x1 - x0, bh - 2);
          lg.setColor(BRICK.lit[0], BRICK.lit[1], BRICK.lit[2], 0.25); lg.rectangle('fill', x0, cy + 1, x1 - x0, 2);
        }
        cx = cx + bw;
      }
      lg.setColor(BRICK.mort[0], BRICK.mort[1], BRICK.mort[2], 1); lg.rectangle('fill', p.x, cy, p.w, 1.5);
      cy = cy + bh; row = row + 1;
    }
    for (let k = 1; k <= 3; k++) { const sy = p.y + hLim * (0.42 + k * 0.19); if (sy < p.y + p.h) { lg.setColor(0, 0, 0, 0.18); lg.rectangle('fill', p.x, sy, p.w, p.y + p.h - sy); } }
  }
  function drawFlags(x, y, w, rng) {
    lg.setColor(BRICK.lit[0], BRICK.lit[1], BRICK.lit[2], 1); lg.rectangle('fill', x, y - 3, w, 4);
    lg.setColor(BRICK.mort[0], BRICK.mort[1], BRICK.mort[2], 1);
    let gx = x; while (gx < x + w) { lg.rectangle('fill', gx, y - 3, 1.5, 4); gx = gx + 26 + rng.random() * 14; }
    lg.setColor(1, 0.85, 0.6, 0.18); lg.rectangle('fill', x, y - 3, w, 1.5);
  }

  function drawPlats() {
    lg.setLineWidth(1);
    for (let idx = 0; idx < plats.length; idx++) {
      const p = plats[idx]; const pi = idx + 1;
      const rng = love.math.newRandomGenerator(pi * 733 + 5);
      if (p.beam) {
        lg.setColor(STONE.mid[0], STONE.mid[1], STONE.mid[2], 1); lg.rectangle('fill', p.x, p.y, p.w, p.h);
        lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 1); lg.rectangle('fill', p.x, p.y + p.h - 3, p.w, 3);
        lg.setColor(COL.rockLit[0], COL.rockLit[1], COL.rockLit[2], 0.7); lg.rectangle('fill', p.x + 1, p.y, p.w - 2, 2);
        if (curLevel === 1) drawGrass(p.x, p.y, p.w, rng); else drawFlags(p.x, p.y, p.w, rng);
      } else if (curLevel === 2) {
        drawBrickBody(p, pi);
        if (p.climbL) drawClimbMarks(p, pi);
        lg.setColor(1.0, 0.72, 0.4, 0.30); lg.rectangle('fill', p.x, p.y, p.w, 2);
        drawFlags(p.x, p.y, p.w, rng);
      } else {
        const tris = rockOutline(p, pi);
        lg.setColor(STONE.base[0], STONE.base[1], STONE.base[2], 1);
        for (const t of tris) lg.polygon('fill', t);
        const hLim = Math.min(p.h, 820);
        for (let k = 1; k <= 4; k++) { const sy = p.y + hLim * (0.30 + k * 0.17); if (sy < p.y + p.h) { lg.setColor(STONE.dark[0], STONE.dark[1], STONE.dark[2], 0.17); lg.rectangle('fill', p.x, sy, p.w, p.y + p.h - sy); } }
        const nL = Math.max(3, Math.floor(hLim / 110));
        for (let li = 0; li < nL; li++) { const sy = p.y + 22 + rng.random() * (hLim - 34); lg.setColor(0, 0, 0, 0.22); lg.rectangle('fill', p.x + 3, sy, p.w - 6, 2); lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.12); lg.rectangle('fill', p.x + 3, sy - 2, p.w - 6, 2); }
        const nB = Math.max(4, Math.floor(p.w * hLim / 22000));
        for (let bi = 0; bi < nB; bi++) {
          const cx = p.x + 12 + rng.random() * (p.w - 24), cy = p.y + 16 + rng.random() * (hLim - 28), r = 8 + rng.random() * 22;
          if (rng.random() < 0.55) lg.setColor(STONE.mid[0], STONE.mid[1], STONE.mid[2], 0.8); else lg.setColor(STONE.lit[0], STONE.lit[1], STONE.lit[2], 0.16);
          lg.polygon('fill', cx - r, cy + r * 0.15, cx - r * 0.35, cy - r * 0.65, cx + r * 0.55, cy - r * 0.5, cx + r, cy + r * 0.2, cx + r * 0.25, cy + r * 0.6, cx - r * 0.45, cy + r * 0.55);
        }
        lg.setColor(0, 0, 0, 0.32); lg.setLineWidth(2);
        const nC = Math.max(2, Math.floor(p.w / 100));
        for (let ci = 0; ci < nC; ci++) {
          let cx = p.x + 14 + rng.random() * (p.w - 28), cy = p.y + 18 + rng.random() * hLim * 0.6;
          for (let s = 0; s < 3; s++) { const nx = cx + (rng.random() - 0.5) * 22, ny = cy + 16 + rng.random() * 30; lg.line(cx, cy, nx, ny); cx = nx; cy = ny; }
        }
        if (p._pts && p._leftI != null) {
          lg.setColor(COL.rockLit[0], COL.rockLit[1], COL.rockLit[2], 0.30); lg.setLineWidth(2);
          const pts = p._pts;
          lg.line(pts[pts.length - 2], pts[pts.length - 1], p.x, p.y);
          for (let i = p._leftI; i <= pts.length - 4; i += 2) lg.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
        }
        if (p.climbL) drawClimbMarks(p, pi);
        lg.setColor(COL.rockLit[0], COL.rockLit[1], COL.rockLit[2], 0.6); lg.rectangle('fill', p.x, p.y, p.w, 2);
        drawGrass(p.x, p.y, p.w, rng);
        if (p.y < 1050) {
          lg.setColor(COL.snow[0], COL.snow[1], COL.snow[2], 0.9);
          let sx = p.x + 5;
          while (sx < p.x + p.w - 8) { const sw2 = 18 + rng.random() * 34; lg.rectangle('fill', sx, p.y - 4, Math.min(sw2, p.x + p.w - 5 - sx), 4); sx = sx + sw2 + 8 + rng.random() * 22; }
        }
      }
    }
    lg.setLineWidth(1);
  }

  // -------------------------------------------------------------- EDITOR STATE
  const cam = { x: 400, y: 1500, z: 0.5 };
  let snap = true; const GRID = 10;
  let sel = null, drag = null, panDrag = null;
  let showHelp = true;
  let statusMsg = '', statusT = 0;
  let FONT;

  function setStatus(s) { statusMsg = s; statusT = 3; }
  function snapv(v) { return snap ? Math.floor(v / GRID + 0.5) * GRID : Math.floor(v + 0.5); }

  function toWorld(mx, my) {
    const dims = lg.getDimensions(); const W = dims[0], H = dims[1];
    const S = Math.min(W / VW, H / VH);
    const ox = (W - VW * S) / 2, oy = (H - VH * S) / 2;
    const vx = (mx - ox) / S, vy = (my - oy) / S;
    return [(vx - VW / 2) / cam.z + cam.x, (vy - VH / 2) / cam.z + cam.y];
  }
  function platAt(wx, wy) {
    for (let i = plats.length - 1; i >= 0; i--) {
      const p = plats[i];
      if (wx >= p.x - 6 && wx <= p.x + p.w + 6 && wy >= p.y - 6 && wy <= p.y + p.h + 6) return [p, i];
    }
    return [null, -1];
  }
  function edgeAt(p, wx, wy) {
    const m = 10 / cam.z;
    const L = Math.abs(wx - p.x) < m, R = Math.abs(wx - (p.x + p.w)) < m;
    const Ttop = Math.abs(wy - p.y) < m, B = Math.abs(wy - (p.y + p.h)) < m;
    if (!(L || R || Ttop || B)) return null;
    return (Ttop ? 'n' : (B ? 's' : '')) + (L ? 'w' : (R ? 'e' : ''));
  }

  // -------------------------------------------------------------- SAVE / LOAD
  function levelFile() { return curLevel === 1 ? 'level.lua' : 'level2.lua'; }

  // Lua text (for the .lua download — compatible with the desktop Love build)
  function serializeLua() {
    const out = ['-- ' + levelFile() + ' — generated by the Level Editor', 'return {', '  plats = {'];
    for (const p of plats) {
      let s = '    {x=' + p.x + ', y=' + p.y + ', w=' + p.w + ', h=' + p.h;
      if (p.beam) s += ', beam=true';
      if (p.climbL) s += ', climbL=true';
      if (p.climbR) s += ', climbR=true';
      if (p.climbBot != null) s += ', climbBot=' + p.climbBot;
      out.push(s + '},');
    }
    out.push('  },'); out.push('  checkpoints = {');
    for (const c of checkpoints) out.push('    {x=' + c.x + ', y=' + c.y + '},');
    out.push('  },'); out.push('}');
    return out.join('\n');
  }
  // JSON (for localStorage — read back by the native game)
  function serializeJson() {
    const clean = plats.map(function (p) {
      const o = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (p.beam) o.beam = true; if (p.climbL) o.climbL = true; if (p.climbR) o.climbR = true;
      if (p.climbBot != null) o.climbBot = p.climbBot;
      return o;
    });
    return JSON.stringify({ plats: clean, checkpoints: checkpoints.map(function (c) { return { x: c.x, y: c.y }; }) });
  }
  function downloadText(name, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function saveLevel() {
    love.filesystem.write(levelFile(), serializeJson());     // game reads this
    downloadText(levelFile(), serializeLua());               // desktop-compatible
    setStatus('Saved ' + levelFile() + ' to browser storage (game will load it) + downloaded .lua');
  }
  function loadLevel() {
    const raw = love.filesystem.read(levelFile());
    if (!raw) { setStatus('No saved ' + levelFile() + ' in browser storage'); return; }
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.plats)) {
        plats = data.plats; checkpoints = data.checkpoints || checkpoints;
        for (const p of plats) invalidate(p);
        if (curLevel === 1) { plats1 = plats; checkpoints1 = checkpoints; } else { plats2 = plats; checkpoints2 = checkpoints; }
        sel = null; setStatus(levelFile() + ' loaded'); return;
      }
    } catch (e) { /* fall through */ }
    setStatus('Failed to load ' + levelFile());
  }
  function switchLevel() {
    curLevel = (curLevel === 1) ? 2 : 1;
    if (curLevel === 1) { plats = plats1; checkpoints = checkpoints1; cam.x = 400; cam.y = 1500; cam.z = 0.5; }
    else { plats = plats2; checkpoints = checkpoints2; cam.x = 700; cam.y = 700; cam.z = 0.5; }
    sel = null; drag = null;
    setStatus('Editing Level ' + curLevel + (curLevel === 2 ? " — The Witch's Keep" : ' — The Ascent'));
  }

  // -------------------------------------------------------------- CALLBACKS
  love.load = function () {
    pixCanvas = lg.newCanvas(VW / PIX, VH / PIX);
    FONT = lg.newFont(14);
    lg.setFont(FONT);
    // prevent the browser's Ctrl/Cmd+S (and Ctrl+L) from hijacking save/load
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'l')) e.preventDefault();
    });
  };

  love.update = function (dt) {
    statusT = Math.max(0, statusT - dt);
    const sp = 900 * dt / cam.z;
    const kd = love.keyboard.isDown;
    if (kd('a') || kd('left')) cam.x = cam.x - sp;
    if (kd('d') || kd('right')) cam.x = cam.x + sp;
    if (kd('w') || kd('up')) cam.y = cam.y - sp;
    if (kd('s') || kd('down')) cam.y = cam.y + sp;
  };

  love.wheelmoved = function (_dx, dy) { cam.z = clamp(cam.z * (1 + dy * 0.12), 0.12, 2.5); };

  love.mousepressed = function (mx, my, btn) {
    const w = toWorld(mx, my); const wx = w[0], wy = w[1];
    if (btn === 3) { panDrag = { mx: mx, my: my, cx: cam.x, cy: cam.y }; return; }
    if (btn === 2) {
      for (let i = 0; i < checkpoints.length; i++) {
        const c = checkpoints[i];
        if (Math.abs(wx - c.x) < 24 / cam.z && Math.abs(wy - c.y) < 40 / cam.z) { checkpoints.splice(i, 1); setStatus('Checkpoint removed'); return; }
      }
      return;
    }
    if (btn !== 1) return;
    const found = platAt(wx, wy); const p = found[0];
    if (p) {
      sel = p;
      const e = edgeAt(p, wx, wy);
      if (e) drag = { mode: 'resize', edge: e, p: p };
      else drag = { mode: 'move', p: p, dx: wx - p.x, dy: wy - p.y };
    } else {
      sel = null;
      drag = { mode: 'new', x0: snapv(wx), y0: snapv(wy) };
    }
  };

  love.mousemoved = function (mx, my) {
    if (panDrag) {
      const dims = lg.getDimensions(); const W = dims[0], H = dims[1];
      const S = Math.min(W / VW, H / VH);
      cam.x = panDrag.cx - (mx - panDrag.mx) / S / cam.z;
      cam.y = panDrag.cy - (my - panDrag.my) / S / cam.z;
      return;
    }
    if (!drag) return;
    const w = toWorld(mx, my); const wx = w[0], wy = w[1];
    if (drag.mode === 'move') {
      const p = drag.p; p.x = snapv(wx - drag.dx); p.y = snapv(wy - drag.dy); invalidate(p);
    } else if (drag.mode === 'resize') {
      const p = drag.p, e = drag.edge;
      if (e.indexOf('e') >= 0) p.w = Math.max(20, snapv(wx) - p.x);
      if (e.indexOf('s') >= 0) p.h = Math.max(12, snapv(wy) - p.y);
      if (e.indexOf('w') >= 0) { const nx = Math.min(snapv(wx), p.x + p.w - 20); p.w = p.w + (p.x - nx); p.x = nx; }
      if (e.indexOf('n') >= 0) { const ny = Math.min(snapv(wy), p.y + p.h - 12); p.h = p.h + (p.y - ny); p.y = ny; }
      invalidate(p);
    }
  };

  love.mousereleased = function (mx, my, btn) {
    if (btn === 3) { panDrag = null; return; }
    if (!drag) return;
    if (drag.mode === 'new') {
      const w = toWorld(mx, my); const wx = w[0], wy = w[1];
      const x0 = drag.x0, y0 = drag.y0, x1 = snapv(wx), y1 = snapv(wy);
      const nx = Math.min(x0, x1), ny = Math.min(y0, y1), nw = Math.abs(x1 - x0), nh = Math.abs(y1 - y0);
      if (nw >= 30 && nh >= 12) {
        const p = { x: nx, y: ny, w: nw, h: nh };
        if (nh <= 24) p.beam = true;
        plats.push(p); sel = p;
        setStatus('Platform created' + (p.beam ? ' (beam)' : ''));
      }
    }
    drag = null;
  };

  love.keypressed = function (key) {
    if (key === 'escape') love.event.quit();
    if (key === 'h') showHelp = !showHelp;
    if (key === 'tab') { switchLevel(); return; }
    if (key === 'g') { snap = !snap; setStatus('Snap: ' + (snap ? 'ON' : 'OFF')); }
    const ctrl = love.keyboard.isDown('lctrl', 'rctrl');
    if (key === 'f5' || (key === 's' && ctrl)) { saveLevel(); return; }
    if (key === 'l' && ctrl) { loadLevel(); return; }
    if (key === 'k') {
      const mp = love.mouse.getPosition(); const w = toWorld(mp[0], mp[1]);
      checkpoints.push({ x: snapv(w[0]), y: snapv(w[1]) }); setStatus('Checkpoint added');
    }
    if (sel) {
      if (key === 'b') { sel.beam = !sel.beam; invalidate(sel); setStatus('Beam: ' + sel.beam); }
      if (key === 'c') { sel.climbL = !sel.climbL; invalidate(sel); setStatus('Climbable wall: ' + sel.climbL); }
      if (key === 'n') {
        const mp = love.mouse.getPosition(); const w = toWorld(mp[0], mp[1]);
        if (sel.climbBot != null) { sel.climbBot = null; setStatus('climbBot cleared'); }
        else { sel.climbBot = snapv(w[1]); setStatus('climbBot = ' + sel.climbBot); }
      }
      if (key === 'x' || key === 'delete') {
        const i = plats.indexOf(sel); if (i >= 0) plats.splice(i, 1);
        sel = null; setStatus('Platform deleted');
      }
    }
  };

  // -------------------------------------------------------------- DRAW
  function drawWorld() {
    if (curLevel === 1) {
      for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        lg.setColor(COL.skyTop[0] + (COL.skyLow[0] - COL.skyTop[0]) * k, COL.skyTop[1] + (COL.skyLow[1] - COL.skyTop[1]) * k, COL.skyTop[2] + (COL.skyLow[2] - COL.skyTop[2]) * k, 1);
        lg.rectangle('fill', 0, VH * k, VW, VH / 20 + 1);
      }
    } else {
      for (let i = 0; i <= 16; i++) { const k = i / 16; lg.setColor(0.055 + 0.05 * k, 0.05 + 0.04 * k, 0.085 + 0.055 * k, 1); lg.rectangle('fill', 0, VH * k, VW, VH / 16 + 1); }
    }

    lg.push();
    lg.translate(VW / 2, VH / 2);
    lg.scale(cam.z);
    lg.translate(-cam.x, -cam.y);

    if (cam.z > 0.25) {
      lg.setColor(1, 1, 1, 0.05); const step = 100;
      const x0 = Math.floor((cam.x - VW / cam.z) / step) * step, x1 = cam.x + VW / cam.z;
      const y0 = Math.floor((cam.y - VH / cam.z) / step) * step, y1 = cam.y + VH / cam.z;
      for (let x = x0; x <= x1; x += step) lg.line(x, y0, x, y1);
      for (let y = y0; y <= y1; y += step) lg.line(x0, y, x1, y);
    }

    if (curLevel === 1) {
      lg.setColor(0.155, 0.145, 0.24, 0.85);
      lg.rectangle('fill', CASTLE_X - 120, PROM_Y - 260, 240, 260);
      lg.rectangle('fill', CASTLE_X - 170, PROM_Y - 180, 60, 180);
      lg.rectangle('fill', CASTLE_X + 110, PROM_Y - 180, 60, 180);
      lg.setColor(0.07, 0.065, 0.115, 1);
      lg.rectangle('fill', CASTLE_X - 34, PROM_Y - 88, 68, 88);
    }

    drawPlats();

    if (curLevel === 2) {
      const M = L2_MARKS;
      lg.setColor(0.9, 0.55, 0.2, 0.85);
      lg.rectangle('line', M.trap.x - M.trap.w / 2, M.trap.y, M.trap.w, M.trap.h);
      lg.line(M.trap.x, 40, M.trap.x, M.trap.y);
      lg.print('TRAP', M.trap.x - 18, M.trap.y - 22);
      lg.setColor(0.85, 0.75, 0.35, 0.9);
      lg.rectangle('fill', M.button.x - M.button.w / 2, M.button.y - 5, M.button.w, 5);
      lg.print('SWITCH', M.button.x - 26, M.button.y - 30);
      lg.setColor(0.85, 0.85, 0.8, 0.8);
      for (const s of M.skels) {
        lg.line(s[0], s[2] - 8, s[1], s[2] - 8);
        lg.circle('fill', (s[0] + s[1]) / 2, s[2] - 20, 6);
        lg.print('SKELETON', (s[0] + s[1]) / 2 - 34, s[2] - 52);
      }
      lg.setColor(0.5, 0.75, 0.7, 0.9);
      lg.rectangle('line', M.door.x, M.door.y - 150, 90, 150);
      lg.print('EXIT', M.door.x + 24, M.door.y - 174);
    }

    for (const c of checkpoints) {
      lg.setColor(0.30, 0.23, 0.14, 1);
      lg.rectangle('fill', c.x - 1.5, c.y - 46, 3, 46);
      lg.setColor(0.74, 0.31, 0.18, 1);
      lg.polygon('fill', c.x + 1.5, c.y - 46, c.x + 26, c.y - 39, c.x + 1.5, c.y - 32);
    }

    if (sel) {
      lg.setColor(0.60, 0.82, 0.78, 0.9);
      lg.setLineWidth(2 / cam.z);
      lg.rectangle('line', sel.x, sel.y, sel.w, sel.h);
      if (sel.climbBot != null) {
        lg.setColor(0.98, 0.62, 0.34, 0.9);
        lg.line(sel.x - 26, sel.climbBot, sel.x + 26, sel.climbBot);
      }
    }

    lg.pop();
  }

  love.draw = function () {
    const dims = lg.getDimensions(); const W = dims[0], H = dims[1];
    const S = Math.min(W / VW, H / VH);
    const ox = (W - VW * S) / 2, oy = (H - VH * S) / 2;

    lg.setCanvas(pixCanvas);
    lg.clear(0, 0, 0, 1);
    lg.push(); lg.scale(1 / PIX);
    drawWorld();
    lg.pop();
    lg.setCanvas();

    lg.push();
    lg.translate(ox, oy);
    lg.scale(S);
    lg.setColor(1, 1, 1, 1);
    lg.draw(pixCanvas, 0, 0, 0, PIX, PIX);

    lg.setColor(0, 0, 0, 0.55);
    lg.rectangle('fill', 0, 0, VW, 26);
    lg.setColor(0.94, 0.89, 0.78, 1);
    lg.setFont(FONT);
    const info = 'LEVEL ' + curLevel + ' (' + (curLevel === 1 ? 'The Ascent' : "The Witch's Keep") + ')  ·  TAB switch  ·  cam '
      + Math.round(cam.x) + ',' + Math.round(cam.y) + '  zoom ' + cam.z.toFixed(2) + '  snap ' + (snap ? 'ON' : 'OFF')
      + '  plats ' + plats.length + '  checkpoints ' + checkpoints.length;
    lg.print(info, 10, 5);
    if (sel) {
      const flags = (sel.beam ? ' beam' : '') + (sel.climbL ? ' climbL' : '') + (sel.climbBot != null ? ' climbBot=' + sel.climbBot : '');
      lg.print('selected: x=' + sel.x + ' y=' + sel.y + ' w=' + sel.w + ' h=' + sel.h + flags, 10, VH - 26);
    }

    if (statusT > 0) {
      lg.setColor(0, 0, 0, 0.65); lg.rectangle('fill', 0, 30, VW, 24);
      lg.setColor(0.60, 0.82, 0.78, 1); lg.print(statusMsg, 10, 34);
    }

    if (showHelp) {
      const lines = [
        'LEVEL EDITOR — H to hide this help', '',
        'TAB ....................... switch Level 1 / Level 2 (castle)',
        'Drag on empty space ....... create platform (thin = beam)',
        'Click platform ............ select · drag to move · drag edge to resize',
        'B ......................... toggle beam (narrow ledge)',
        'C ......................... toggle climbable wall (left face)',
        'N ......................... set/clear climb route bottom at mouse height',
        'K ......................... add checkpoint at mouse',
        'Right-click flag .......... remove checkpoint',
        'X / DEL ................... delete selected platform',
        'G ......................... toggle grid snap',
        'CTRL+S / F5 ............... save (browser + .lua)   CTRL+L  load',
        'WASD / arrows ............. pan    wheel  zoom    middle-drag  pan',
        '',
        'Saves to browser storage (the game auto-loads it) and',
        'downloads level.lua / level2.lua for the desktop build.',
      ];
      lg.setColor(0, 0, 0, 0.72);
      lg.rectangle('fill', VW - 470, 40, 460, 26 + lines.length * 19);
      lg.setColor(0.94, 0.89, 0.78, 1);
      for (let i = 0; i < lines.length; i++) lg.print(lines[i], VW - 456, 52 + i * 19);
    }

    lg.pop();
  };

  // read/write hooks used by the headless verification harness
  love._ed = {
    save: saveLevel, load: loadLevel, switch: switchLevel,
    plats: function () { return plats; },
    addPlat: function (p) { plats.push(p); },
    level: function () { return curLevel; },
  };
})();
