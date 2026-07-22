# Native HTML/JS Port — THE RETURN OF THE SHADOW

## Context

`return-of-the-shadow/main.lua` (~2370 lines) is a fully self-contained cinematic
platformer written for **LÖVE (Love2D) 11.x**. Everything — graphics, skeletal
animation, and audio — is generated procedurally in code (no external assets).
It has two levels (*The Ascent*, a climbing prologue with a cinematic + title
screen; *The Witch's Keep*, a castle with patrolling skeletons, a pressure-plate
trap, sword combat and hearts), hand-written AABB physics, seeded-RNG procedural
rock/mountain art, IK skeletal poses, a Verlet scarf, and synthesized wind/music.

The existing `dist/web/` is a **WASM/love.js** build. The goal here is a *true
hand-written native port* to **vanilla JavaScript + Canvas 2D** — no WASM, no
build step, no runtime dependencies — that runs by opening an HTML file.

### Decisions (confirmed with user)
- **Scope**: full faithful port of both levels + cinematic/title + procedural audio + HUD.
- **Stack**: vanilla JS + Canvas 2D, no bundler. Uses classic `<script>` tags so it runs from `file://` (double-click) as well as a static server.
- **RNG fidelity**: simple seeded JS PRNG (mulberry32). Same art style/gameplay; decorative random detail differs slightly from Love2D. (Gameplay geometry is hardcoded, not RNG-driven, so play is identical.)
- **Extras**: on-screen **touch controls** for mobile; **port the level editor** too; keep the exact **keyboard** scheme as primary.
- **Combat upgrade**: redesign the hero's sword animation taking inspiration from the **Prince of Persia** rotoscoped fencing (guard, lunge/thrust, recovery). Reference only — **no sprite art is imported**; poses stay procedural, preserving the "all-original, no external assets" principle.

## Strategy

Rather than rewrite the game, build a thin **LÖVE-compatibility shim** over the
browser APIs, then translate `main.lua` almost line-by-line into JS. This keeps
the port faithful and low-risk. The same shim powers the editor port.

## File layout (new folder, nothing existing is modified)

```
return-of-the-shadow/native-web/
  index.html      # game page: canvas + <script> includes
  love-shim.js    # LÖVE-compat layer (graphics/math/audio/keyboard/timer)
  game.js         # port of main.lua
  touch.js        # on-screen touch controls (game only)
  editor.html     # editor page
  editor.js       # port of editor/main.lua (reuses love-shim.js)
  README.md       # how to run + notes
```

## `love-shim.js` — the compatibility layer

A global `love`-like object wrapping `CanvasRenderingContext2D`. Key mappings:

- **State semantics**: In LÖVE, `push()` saves only the transform; color and
  line width are global and persist across push/pop. Implement by keeping
  `curColor`/`curLineWidth` as JS variables applied at each draw call, and using
  `ctx.save()/ctx.restore()` **only** for the transform matrix. This matches
  LÖVE exactly.
- **graphics**: `setColor(r,g,b,a)`, `setLineWidth`, `setLineStyle`(no-op),
  `push/pop/translate/scale/rotate`, `rectangle(mode,x,y,w,h)`,
  `circle(mode,x,y,r)`, `ellipse(mode,x,y,rx,ry)` (`ctx.ellipse`),
  `arc(mode[,arctype],x,y,r,a1,a2)` (Canvas & LÖVE share the y-down, CW,
  0=+x angle convention → direct map; `"fill"` = pie via `moveTo(center)+arc+closePath`,
  `"line","open"` = bare arc stroke), `polygon(mode,...pts)`, `line(...pts)`,
  `print`, `setFont`, `newFont(size[,path])` + `font.getWidth` via `measureText`.
- **canvas/pixel pipeline**: `newCanvas(w,h)` → offscreen `<canvas>`; render world
  to the low-res `pixCanvas` (VW/PIX × VH/PIX), then `drawImage` upscaled with
  `imageSmoothingEnabled=false` + letterbox bars — replicating `love.draw`.
- **Sky meshes** (`newMesh`, lines 192-216): only two vertical-gradient quads →
  replace with `createLinearGradient`. Ridges stay as triangle arrays.
- **math**: `newRandomGenerator(seed)` → object with `random()`→[0,1) (mulberry32,
  zero-arg only, which is all the code uses); global `love.math.random()` →
  `Math.random()`; `triangulate(pts)` → compact **ear-clipping** returning
  `[[x1,y1,x2,y2,x3,y3],…]` (used by `genRidge` and `rockOutline`; note both
  already `pcall`-guard triangulation and fall back to a quad).
- **audio** (Web Audio): translate `genWind`/`genMusic` sample loops (lines
  117-168) into `Float32Array`s → `AudioBuffer` + looping `BufferSource` + `GainNode`.
  `source:setVolume`→gain, `setPitch`→`playbackRate`, `play/stop`. **Autoplay**:
  create/resume `AudioContext` and start sources on the first `keydown`/`pointerdown`
  (same "audio starts on first input" behavior noted in the original README).
- **keyboard**: `isDown(name)` from a pressed-key `Set`; map LÖVE names
  (`left/right/up/down/a/d/w/s/space/z/k/x/f/r/return/escape`) from
  `KeyboardEvent`. Dispatch `love.keypressed(key)`.
- **timer**: `getDelta()` returns the current frame `dt` (used inside pose funcs
  `ikTarget`/`climbPh`).
- **filesystem**: `getInfo`/`load` for `level.lua`/`level2.lua` (lines 2209-2232)
  → replaced by reading level overrides from `localStorage` (written by the ported editor).

## `game.js` — porting `main.lua`

Nearly 1:1 translation. Notes on Lua→JS gotchas:
- `love.math.atan2(dx,dy)` → `Math.atan2(dx,dy)` (same arg order; the code uses the
  x=sin·l, y=cos·l convention, e.g. `ik2` line 1197, so keep the order verbatim).
- 1-based Lua arrays/`ipairs` → 0-based JS arrays/`for…of`. Tables → plain objects.
- `love.load/update/draw/keypressed` → module functions; drive with
  `requestAnimationFrame`, `dt = Math.min(delta, 1/30)` (line 2256).
- Port order: (1) shim + RAF loop; (2) constants/palette/level data/utilities +
  generators (`buildBackground`, `rockOutline`, particles); (3) drawing
  (`drawBackground[2]`, `drawPlats`, `drawCastle`, `drawEmblem`, `drawHero`,
  `drawScarf`, `drawSkel`, `drawEnts2`, `drawOverlays`, `drawTitle`); (4) physics +
  player state machine (`moveAndCollide`, `tryGrabLedge/Wall`, `startMantle`,
  `updatePlayer`, cinematic, camera); (5) Level-2 entities (`updateSkel`,
  `updateEnts2`, trap/button/sword); (6) audio.

## PoP-inspired combat upgrade (hero)

Rework the sword animation, which currently lives in `drawHero`'s `atkT` branch
(lines 1247-1279) and the idle-guard branch (1276-1279). Keep it fully procedural
— PoP is used only as motion/timing reference (poses, weight, follow-through):
- **En-garde guard** (has sword, idle/near-idle): side-on stance, front arm holding
  the blade forward at mid-height angled up, weight settled, subtle breathing —
  a fencing guard rather than today's small tweak.
- **Lunge/thrust** replacing the overhead slash: 4 beats with clear
  anticipation → commit → held extension ("reads" the hit) → weighted recovery,
  with the front leg extending into a lunge, back leg straightening, torso
  committing along the blade line, and a small forward `vx` nudge on the commit for
  weight (mirroring PoP's advancing thrust). Reuse the existing blade-arc/`drawHeldSword`
  trail (lines 1359-1370). Timing constants (`ATK_DUR`, `DRAW_DUR`) preserved so
  Level-2 hit windows (`updateEnts2` lines 1691-1703, keypressed 2362-2366) still line up.
- Optional light polish: brief advance/retreat lean when moving with sword drawn.
- Keep the draw-from-sheath animation (`drawT`, lines 1270-1274) and skeleton
  combat as-is (skeletons are out of scope for the animation ask).

## Touch controls (`touch.js`, game only)

Overlay (shown only for touch/coarse-pointer devices): left/right pad, Jump, an
Up/Down pair (climb / grab / let-go), and an Attack button (Level 2). Buttons feed
the shim's pressed-key `Set` and emit `keypressed` for `space`/`x`, so the game
logic needs no branching. Also serves as the first-input gesture that starts audio.

## Editor port (`editor.html` + `editor.js`)

Port `editor/main.lua` on the same shim: drag-to-create platforms (thin = beam),
click-select, drag-move, edge-resize, `TAB` L1/L2, `B` beam, `C` climb wall,
`N` climb base, `K` checkpoint, `G` grid snap, `H` help, `CTRL+S`/`F5` save.
Save writes the level table to `localStorage` (keys `level.lua`/`level2.lua`
equivalents) **and** offers a `.json`/`.lua` download; the game reads those
overrides via the shim `filesystem` stub. (I'll read `editor/main.lua` in full at
implementation time — it wasn't needed for this plan.)

## Verification

1. Serve locally (`cd native-web && python3 -m http.server 8000`) and also confirm
   `index.html` opens directly from `file://`.
2. Drive it with the browser tooling (claude-in-chrome / run skill) and screenshot:
   - **L1**: run/turn, jump, coyote/buffer; automatic ledge-grab + mantle; wall
     climb up/down + push-off; beam balance; fall→checkpoint respawn; reach
     `CINE_TRIGGER_X` → cinematic + "THE RETURN OF THE SHADOW" title + music fade-in.
   - **ENTER** → **L2**: skeletons patrol/attack, 3 hearts + damage/respawn,
     pressure plate drops the cage, skeleton→bone pile drops sword, pick up → **X**
     attack knocks skeletons back / off ledges, reach exit → "TO BE CONTINUED".
   - **Combat**: confirm the new guard + lunge/thrust reads well and hit windows work.
   - **Audio**: wind gusts on L1, muted keep theme on L2, starts on first input.
   - **Touch**: emulate a touch device; verify all actions reachable.
   - **Editor**: create/move/resize/save a platform, reload the game, confirm the
     saved level loads.
3. Compare side-by-side against the Love2D original (`love return-of-the-shadow`)
   for feel/pacing parity.

## Out of scope / notes
- No WASM; the existing `dist/web` love.js build is untouched.
- `assets/title.ttf` is optional in the original (system-font fallback); the port
  uses a serif system font stack with letter-spacing, matching that fallback.
