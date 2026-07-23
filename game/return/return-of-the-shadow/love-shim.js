// ============================================================================
//  love-shim.js — a thin LÖVE (Love2D) 11.x compatibility layer over the
//  browser (Canvas 2D + Web Audio + DOM input). Just enough of the API to run
//  THE RETURN OF THE SHADOW and its level editor, translated almost 1:1 from
//  Lua. No external dependencies, no build step.
//
//  Design notes:
//   * LÖVE's push()/pop() save only the TRANSFORM; color and line width are
//     global and persist across push/pop. We honor that by keeping curColor /
//     curLineWidth as JS state applied at each draw call, and using
//     ctx.save()/restore() only for the transform (and clip).
//   * Angle convention matches: y points down, angle 0 = +x, positive = CW,
//     so love.graphics.arc maps directly onto ctx.arc(...false).
//   * love.math.atan2(dx,dy) keeps Lua's argument order; callers use the
//     x=sin(a)*l, y=cos(a)*l convention. We provide love.math.atan2 = Math.atan2.
// ============================================================================

(function (global) {
  'use strict';

  const love = {};
  global.love = love;

  // ------------------------------------------------------------------ helpers
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ------------------------------------------------------------------ canvas / ctx
  // The active drawing context. Switches when setCanvas() is called.
  let ctx = null;        // active context (screen or an offscreen canvas)
  let mainCtx = null;    // the on-screen context
  let mainCanvas = null;

  let curColor = [1, 1, 1, 1];
  let curLineWidth = 1;
  let curFont = null;

  function toCss(c) {
    const r = Math.round(clamp(c[0], 0, 1) * 255);
    const g = Math.round(clamp(c[1], 0, 1) * 255);
    const b = Math.round(clamp(c[2], 0, 1) * 255);
    const a = (c[3] === undefined || c[3] === null) ? 1 : clamp(c[3], 0, 1);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function applyFill()  { ctx.fillStyle = toCss(curColor); }
  function applyStroke() { ctx.strokeStyle = toCss(curColor); ctx.lineWidth = curLineWidth; }

  // ------------------------------------------------------------------ graphics
  const graphics = {};
  love.graphics = graphics;

  graphics.setDefaultFilter = function () { /* nearest — handled via imageSmoothing */ };
  graphics.setLineStyle = function () { /* rough/smooth: no-op */ };

  graphics.getDimensions = function () { return [mainCanvas.width, mainCanvas.height]; };
  graphics.getWidth  = function () { return mainCanvas.width; };
  graphics.getHeight = function () { return mainCanvas.height; };

  graphics.setColor = function (r, g, b, a) {
    if (Array.isArray(r)) { curColor = [r[0], r[1], r[2], r[3] === undefined ? (a === undefined ? 1 : a) : r[3]]; }
    else { curColor = [r, g, b, a === undefined ? 1 : a]; }
  };
  graphics.setLineWidth = function (w) { curLineWidth = w; };

  graphics.push = function () { ctx.save(); };
  graphics.pop = function () { ctx.restore(); };
  graphics.translate = function (x, y) { ctx.translate(x, y); };
  graphics.scale = function (sx, sy) { ctx.scale(sx, sy === undefined ? sx : sy); };
  graphics.rotate = function (r) { ctx.rotate(r); };

  graphics.rectangle = function (mode, x, y, w, h) {
    if (mode === 'fill') { applyFill(); ctx.fillRect(x, y, w, h); }
    else { applyStroke(); ctx.strokeRect(x, y, w, h); }
  };

  graphics.circle = function (mode, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (mode === 'fill') { applyFill(); ctx.fill(); }
    else { applyStroke(); ctx.stroke(); }
  };

  graphics.ellipse = function (mode, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    if (mode === 'fill') { applyFill(); ctx.fill(); }
    else { applyStroke(); ctx.stroke(); }
  };

  // arc(mode, x, y, r, a1, a2)  OR  arc(mode, arctype, x, y, r, a1, a2)
  // arctype: "pie" (default), "open", "closed"
  graphics.arc = function (mode, a2, a3, a4, a5, a6, a7) {
    let arctype = 'pie', x, y, r, a1, a2a;
    if (typeof a2 === 'string') { arctype = a2; x = a3; y = a4; r = a5; a1 = a6; a2a = a7; }
    else { x = a2; y = a3; r = a4; a1 = a5; a2a = a6; }
    ctx.beginPath();
    if (arctype === 'pie') {
      ctx.moveTo(x, y);
      ctx.arc(x, y, Math.max(0, r), a1, a2a, false);
      ctx.closePath();
    } else {
      ctx.arc(x, y, Math.max(0, r), a1, a2a, false);
      if (arctype === 'closed') ctx.closePath();
    }
    if (mode === 'fill') { applyFill(); ctx.fill(); }
    else { applyStroke(); ctx.stroke(); }
  };

  // polygon("fill", x1,y1,x2,y2,...)  or  polygon("fill", [x1,y1,...])
  graphics.polygon = function (mode) {
    let pts;
    if (arguments.length === 2 && Array.isArray(arguments[1])) pts = arguments[1];
    else { pts = []; for (let i = 1; i < arguments.length; i++) pts.push(arguments[i]); }
    if (pts.length < 6) return;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (mode === 'fill') { applyFill(); ctx.fill(); }
    else { applyStroke(); ctx.stroke(); }
  };

  // line(x1,y1,x2,y2,...)  or  line([x1,y1,...])
  graphics.line = function () {
    let pts;
    if (arguments.length === 1 && Array.isArray(arguments[0])) pts = arguments[0];
    else pts = Array.prototype.slice.call(arguments);
    if (pts.length < 4) return;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    applyStroke();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  // --- fonts ---------------------------------------------------------------
  function Font(size, family) {
    this.size = size;
    this.family = family || 'sans-serif';
    this._css = size + 'px ' + this.family;
  }
  Font.prototype.getWidth = function (s) {
    ctx.font = this._css;
    return ctx.measureText(s).width;
  };
  Font.prototype.getHeight = function () { return this.size; };

  graphics.newFont = function (a, b) {
    // newFont(size) | newFont(path, size). We ignore custom TTFs (self-contained
    // spirit) and use a serif system stack for the title, sans for the HUD.
    if (typeof a === 'string') { return new Font(b, "Georgia, 'Times New Roman', serif"); }
    return new Font(a, "'Segoe UI', Helvetica, Arial, sans-serif");
  };
  graphics.setFont = function (f) { curFont = f; };
  graphics.print = function (text, x, y, r, sx, sy) {
    ctx.save();
    ctx.translate(x, y);
    if (r) ctx.rotate(r);
    if (sx !== undefined) ctx.scale(sx, sy === undefined ? sx : sy);
    ctx.font = (curFont ? curFont._css : '14px sans-serif');
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    applyFill();
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  // --- offscreen canvases + pixel pipeline ---------------------------------
  function LoveCanvas(w, h) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.floor(w));
    this.canvas.height = Math.max(1, Math.floor(h));
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }
  LoveCanvas.prototype.setFilter = function () { this.ctx.imageSmoothingEnabled = false; };
  LoveCanvas.prototype.getWidth = function () { return this.canvas.width; };
  LoveCanvas.prototype.getHeight = function () { return this.canvas.height; };

  graphics.newCanvas = function (w, h) { return new LoveCanvas(w, h); };
  graphics.setCanvas = function (c) {
    ctx = c ? c.ctx : mainCtx;
    ctx.imageSmoothingEnabled = false;
  };
  graphics.clear = function (r, g, b, a) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (r === undefined) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    else { ctx.fillStyle = toCss([r, g, b, a === undefined ? 1 : a]); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
    ctx.restore();
  };
  graphics.draw = function (img, x, y, r, sx, sy) {
    const image = (img instanceof LoveCanvas) ? img.canvas : img;
    ctx.save();
    ctx.translate(x || 0, y || 0);
    if (r) ctx.rotate(r);
    if (sx !== undefined) ctx.scale(sx, sy === undefined ? sx : sy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  };

  // Scissor: the game only uses it to keep the upscaled frame inside the
  // letterbox, and it then paints solid black bars over the margins afterwards,
  // so a no-op is visually equivalent and avoids transform headaches.
  graphics.setScissor = function () { /* no-op — letterbox bars cover margins */ };

  // Meshes: the game builds only two vertical-gradient quads (sky). We expose a
  // tiny helper instead so game.js can draw gradients directly.
  graphics.gradientRect = function (x, y, w, h, cTop, cBot) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, toCss(cTop));
    grad.addColorStop(1, toCss(cBot));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  };

  // ------------------------------------------------------------------ math
  const lmath = {};
  love.math = lmath;
  lmath.atan2 = Math.atan2; // NB: Lua order (dx, dy) preserved by callers

  // mulberry32: small deterministic PRNG (same style, not LÖVE's exact RNG).
  function mulberry32(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  lmath.newRandomGenerator = function (seed) {
    const rnd = mulberry32(seed >>> 0);
    return {
      // rng:random()  -> [0,1)
      // rng:random(m) -> integer [1,m]   ; rng:random(m,n) -> integer [m,n]
      random: function (m, n) {
        const r = rnd();
        if (m === undefined) return r;
        if (n === undefined) return Math.floor(r * m) + 1;
        return Math.floor(r * (n - m + 1)) + m;
      }
    };
  };
  lmath.random = function (m, n) {
    const r = Math.random();
    if (m === undefined) return r;
    if (n === undefined) return Math.floor(r * m) + 1;
    return Math.floor(r * (n - m + 1)) + m;
  };

  // Ear-clipping triangulation of a simple polygon.
  // Input: flat [x0,y0,x1,y1,...]. Output: [[ax,ay,bx,by,cx,cy], ...].
  lmath.triangulate = function (poly) {
    const n = poly.length / 2;
    if (n < 3) return [];
    const V = [];
    for (let i = 0; i < n; i++) V.push(i);
    // signed area to detect winding; algorithm assumes CCW
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += poly[2 * i] * poly[2 * j + 1] - poly[2 * j] * poly[2 * i + 1];
    }
    if (area < 0) V.reverse();

    function px(i) { return poly[2 * V[i]]; }
    function py(i) { return poly[2 * V[i] + 1]; }
    function cross(ax, ay, bx, by, cx, cy) {
      return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }
    function inTri(ax, ay, bx, by, cx, cy, px2, py2) {
      const d1 = cross(ax, ay, bx, by, px2, py2);
      const d2 = cross(bx, by, cx, cy, px2, py2);
      const d3 = cross(cx, cy, ax, ay, px2, py2);
      const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      return !(neg && pos);
    }

    const tris = [];
    let count = V.length;
    let guard = 2 * count;
    let i = 0;
    while (count > 3 && guard-- > 0) {
      const i0 = (i) % count;
      const i1 = (i + 1) % count;
      const i2 = (i + 2) % count;
      const ax = px(i0), ay = py(i0);
      const bx = px(i1), by = py(i1);
      const cx = px(i2), cy = py(i2);
      let ear = cross(ax, ay, bx, by, cx, cy) > 0; // convex vertex
      if (ear) {
        for (let k = 0; k < count; k++) {
          if (k === i0 || k === i1 || k === i2) continue;
          if (inTri(ax, ay, bx, by, cx, cy, px(k), py(k))) { ear = false; break; }
        }
      }
      if (ear) {
        tris.push([ax, ay, bx, by, cx, cy]);
        V.splice(i1, 1);
        count--;
        guard = 2 * count;
        i = 0;
      } else {
        i++;
        if (i >= count) i = 0;
      }
    }
    if (count === 3) tris.push([px(0), py(0), px(1), py(1), px(2), py(2)]);
    return tris;
  };

  // ------------------------------------------------------------------ audio
  let audioCtx = null;
  let masterGain = null;
  let _masterVol = 1;
  const pendingSources = [];
  let audioUnlocked = false;

  function ensureAudioCtx() {
    if (!audioCtx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = _masterVol;
        masterGain.connect(audioCtx.destination);
      }
    }
    return audioCtx;
  }
  function audioOut() { return masterGain || audioCtx.destination; }

  function SoundData(n, rate) {
    this.data = new Float32Array(n);
    this.rate = rate;
    this._n = n;
  }
  SoundData.prototype.setSample = function (i, v) { this.data[i] = v; };
  SoundData.prototype.getSampleCount = function () { return this._n; };

  love.sound = {
    newSoundData: function (n, rate /*, bits, channels */) { return new SoundData(n, rate); }
  };

  function Source(sd) {
    this.sd = sd;
    this.looping = false;
    this.volume = 1;
    this.pitch = 1;
    this.node = null;
    this.gain = null;
    this.buffer = null;
    this.playing = false;
    this.wantPlay = false;
    pendingSources.push(this);
  }
  Source.prototype._buildBuffer = function () {
    if (this.buffer || !audioCtx) return;
    this.buffer = audioCtx.createBuffer(1, this.sd._n, this.sd.rate);
    this.buffer.getChannelData(0).set(this.sd.data);
  };
  Source.prototype.setLooping = function (b) { this.looping = b; if (this.node) this.node.loop = b; };
  Source.prototype.setVolume = function (v) { this.volume = v; if (this.gain) this.gain.gain.value = v; };
  Source.prototype.setPitch = function (p) { this.pitch = p; if (this.node) this.node.playbackRate.value = p; };
  Source.prototype.play = function () {
    this.wantPlay = true;
    if (!audioUnlocked || !audioCtx) return; // will start on unlock
    this._buildBuffer();
    if (this.playing) return;
    this.node = audioCtx.createBufferSource();
    this.node.buffer = this.buffer;
    this.node.loop = this.looping;
    this.node.playbackRate.value = this.pitch;
    this.gain = audioCtx.createGain();
    this.gain.gain.value = this.volume;
    this.node.connect(this.gain).connect(audioOut());
    const self = this;
    this.node.onended = function () { self.playing = false; };
    try { this.node.start(0); this.playing = true; } catch (e) { /* ignore */ }
  };
  Source.prototype.stop = function () {
    this.wantPlay = false;
    if (this.node) { try { this.node.stop(0); } catch (e) {} this.node = null; }
    this.playing = false;
  };

  // One-shot sound effect: overlapping, retriggerable playback (no loop state).
  // Each play() spins up a fresh BufferSource → gain → destination.
  function Sfx(sd) { this.sd = sd; this.buffer = null; }
  Sfx.prototype.play = function (vol, pitch) {
    if (!audioUnlocked || !audioCtx) return;
    if (!this.buffer) {
      this.buffer = audioCtx.createBuffer(1, this.sd._n, this.sd.rate);
      this.buffer.getChannelData(0).set(this.sd.data);
    }
    const node = audioCtx.createBufferSource();
    node.buffer = this.buffer;
    node.playbackRate.value = pitch || 1;
    const g = audioCtx.createGain();
    g.gain.value = (vol == null ? 1 : vol);
    node.connect(g).connect(audioOut());
    try { node.start(0); } catch (e) { /* ignore */ }
  };

  love.audio = {
    newSource: function (sd /*, type */) { return new Source(sd); },
    newSound: function (sd) { return new Sfx(sd); },
    setMasterVolume: function (v) { _masterVol = Math.max(0, Math.min(1, v)); if (masterGain) masterGain.gain.value = _masterVol; },
    getMasterVolume: function () { return _masterVol; }
  };

  function unlockAudio() {
    if (audioUnlocked) return;
    ensureAudioCtx();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    audioUnlocked = true;
    for (const s of pendingSources) if (s.wantPlay) s.play();
  }

  // ------------------------------------------------------------------ keyboard
  const pressed = new Set();
  love.keyboard = { isDown: function () { for (let i = 0; i < arguments.length; i++) if (pressed.has(arguments[i])) return true; return false; } };

  function mapKey(e) {
    switch (e.code) {
      case 'ArrowLeft':  return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowUp':    return 'up';
      case 'ArrowDown':  return 'down';
      case 'Space':      return 'space';
      case 'Enter': case 'NumpadEnter': return 'return';
      case 'Escape':     return 'escape';
      case 'Tab':        return 'tab';
      case 'Delete':     return 'delete';
      case 'Backspace':  return 'backspace';
      case 'F5':         return 'f5';
      case 'ControlLeft':  return 'lctrl';
      case 'ControlRight': return 'rctrl';
    }
    if (e.key && e.key.length === 1) return e.key.toLowerCase();
    return null;
  }

  // ------------------------------------------------------------------ mouse
  let mouseX = 0, mouseY = 0;
  love.mouse = { getPosition: function () { return [mouseX, mouseY]; },
                 getX: function () { return mouseX; }, getY: function () { return mouseY; } };

  // ------------------------------------------------------------------ timer
  let lastDt = 0;
  love.timer = { getDelta: function () { return lastDt; }, getTime: function () { return performance.now() / 1000; } };

  // ------------------------------------------------------------------ filesystem
  // Minimal: level overrides are stored as JSON in localStorage by the editor.
  love.filesystem = {
    _key: function (name) { return 'rots:' + name; },
    getInfo: function (name) { try { return localStorage.getItem(love.filesystem._key(name)) ? { type: 'file' } : null; } catch (e) { return null; } },
    read: function (name) { try { return localStorage.getItem(love.filesystem._key(name)); } catch (e) { return null; } },
    write: function (name, data) { try { localStorage.setItem(love.filesystem._key(name), data); return true; } catch (e) { return false; } },
    getSaveDirectory: function () { return 'localStorage'; }
  };

  // ------------------------------------------------------------------ event
  love.event = { quit: function () { /* no-op in browser */ } };

  // ------------------------------------------------------------------ runtime
  // Attaches the canvas, wires input, and drives love.load/update/draw.
  love._run = function (canvasEl, opts) {
    opts = opts || {};
    mainCanvas = canvasEl;
    mainCtx = canvasEl.getContext('2d');
    mainCtx.imageSmoothingEnabled = false;
    ctx = mainCtx;

    function resize() {
      const w = global.innerWidth, h = global.innerHeight;
      mainCanvas.width = w;
      mainCanvas.height = h;
      mainCtx.imageSmoothingEnabled = false;
    }
    global.addEventListener('resize', resize);
    resize();

    // input wiring -------------------------------------------------
    const preventKeys = new Set(['left', 'right', 'up', 'down', 'space', 'tab', 'f5', 'backspace']);
    global.addEventListener('keydown', function (e) {
      unlockAudio();
      const k = mapKey(e);
      if (!k) return;
      if (preventKeys.has(k)) e.preventDefault();
      const repeat = pressed.has(k);
      pressed.add(k);
      if (!repeat && love.keypressed) love.keypressed(k);
      else if (repeat && love.keypressed && (k === 'space')) { /* no auto-repeat for jump */ }
    });
    global.addEventListener('keyup', function (e) {
      const k = mapKey(e);
      if (k) pressed.delete(k);
    });
    global.addEventListener('blur', function () { pressed.clear(); });

    function updateMouse(e) {
      const rect = mainCanvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }
    function loveBtn(e) { return e.button === 0 ? 1 : (e.button === 2 ? 2 : 3); }
    mainCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    mainCanvas.addEventListener('mousedown', function (e) {
      unlockAudio(); updateMouse(e);
      if (love.mousepressed) love.mousepressed(mouseX, mouseY, loveBtn(e));
    });
    global.addEventListener('mousemove', function (e) {
      updateMouse(e);
      if (love.mousemoved) love.mousemoved(mouseX, mouseY);
    });
    global.addEventListener('mouseup', function (e) {
      updateMouse(e);
      if (love.mousereleased) love.mousereleased(mouseX, mouseY, loveBtn(e));
    });
    mainCanvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (love.wheelmoved) love.wheelmoved(0, e.deltaY > 0 ? -1 : 1);
    }, { passive: false });

    // Expose a few hooks for touch controls (game.js provides these).
    love._pressed = pressed;
    love._unlockAudio = unlockAudio;
    love._pressKey = function (k) { const rep = pressed.has(k); pressed.add(k); if (!rep && love.keypressed) love.keypressed(k); };
    love._releaseKey = function (k) { pressed.delete(k); };

    // main loop ----------------------------------------------------
    if (love.load) love.load();
    let prev = performance.now();
    function frame(now) {
      let dt = (now - prev) / 1000;
      prev = now;
      if (dt > 0.1) dt = 0.1;
      lastDt = dt;
      if (love.update) love.update(dt);
      if (love.draw) love.draw();
      global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
  };

})(window);
