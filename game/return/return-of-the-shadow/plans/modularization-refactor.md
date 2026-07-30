# Refactoring plan — split `game.js` into per-domain files

> Status: **EXECUTED** (commits `fa78835` → `9e6bcef`). `game.js` was split into 17
> ordered classic scripts under `src/` (core/, art/, characters/, levels/); the
> remainder is `src/core/engine.js`, loaded last. Each step was verified in-browser
> (all 5 levels init + update + draw, the level-4 cutscene, and the flight death)
> before committing.
>
> Deviations from the original design below, all to reduce risk:
> - The mechanism is shared **top-level lexical scope** across ordered classic
>   scripts (IIFE removed), so internal references did not need rewriting. A thin
>   `window.RTS` holds only the (future) level registry + debug hooks.
> - Level geometry data went into one early `core/03-level-data.js` (not per-level
>   files) because level files derive load-time consts from it (e.g. `LANE3` from
>   `FLOOR3`) and it must load first.
> - The `level === N` dispatch was **not** yet converted to a registry; audio,
>   physics, camera/save and the render/title code remain consolidated in
>   `core/engine.js` rather than split into separate core files. Those are the
>   remaining optional polish items (see "Out of scope" — now "Future polish").
>
> Companion change shipped first: the Level-5 carpet-flight crash fix (the
> `flightHurt` / `startFlightFall` / `updateFlightFall` changes, now in
> `src/levels/level5.js`).

## Context — why

`game.js` is a single **6,300-line IIFE**. Every constant, helper, character and level lives
in one closure scope, and the update/draw/input loops dispatch behaviour with giant
`if (level === N)` chains. That makes the file hard to navigate, hard to review, and risky to
edit (the carpet-flight crash is a good example — a small local mistake in a buried function).

Goal: split it into **per-domain files** so that **characters + their animations** live in their
own files and **levels + their scenarios** live in their own files, each with a clear header
comment describing its contents. No behaviour change — this is a pure reorganisation.

## Chosen approach (from the three decisions)

1. **Written plan first** → this document.
2. **Ordered `<script>` tags + a namespace** → no bundler, no `type="module"`. The game keeps
   loading as plain classic scripts, exactly as today (`index.html` lines 66–68).
3. **Per-domain granularity** → `core/`, `characters/`, `levels/`, `art/` — not one file per
   entity.

### How "ordered `<script>` + namespace" works here (the key mechanism)

Classic (non-module) scripts loaded into the same page **share one top-level lexical scope**:
top-level `let`/`const`/`function` declared in one file are visible to every later classic
script, and `var`/`function` also land on `window`. So we can **remove the single outer IIFE**
and cut its body across several ordered files **without rewriting the thousands of internal
references** — `player`, `level`, `plats`, `l5`, `COL`, `moveAndCollide`, … keep resolving by
name across files. This is by far the lowest-churn, lowest-risk mechanical split.

A thin explicit namespace object, `window.RTS`, is added for the two things that genuinely
benefit from being explicit rather than implicit-global:

- `RTS.levels` — the **level registry** (see below), which replaces the `if (level === N)`
  dispatch chains.
- `RTS.debug` / `RTS.game` — the existing `love._debug` / `love._game` verification hooks,
  re-homed onto the namespace (kept back-compatible on `love.*` so the harness and `editor.js`
  keep working).

We do **not** rewrite every symbol to `RTS.player` etc. — that would be enormous churn for no
runtime benefit. The namespace is deliberately minimal.

### Load-order discipline (the one real gotcha)

Because there is no IIFE, files execute top-to-bottom in `<script>` order, and cross-file
`const`/`let` are in the temporal-dead-zone until their file has run. Mitigation — split so that
anything **evaluated at load time** comes before its dependents, and anything **only called at
runtime** (inside `love.load/update/draw/keypressed`) can appear in any order because those
callbacks don't run until the shim invokes them after all scripts have loaded. Concretely the
load order is: **constants/utils → shared art → characters → levels → core engine (assigns
`love.*` + builds `RTS.levels`) last.** Each file starts with its own `'use strict';`.

## Target file tree

```
return-of-the-shadow/
  index.html            # <script> list updated to load src/ files in order (keep ?v= cache-bust)
  love-shim.js          # UNCHANGED
  touch.js              # UNCHANGED (feeds the love key set)
  editor.js             # UNCHANGED (separate app; still talks to the love global)
  src/
    core/
      00-namespace.js    # 'use strict'; window.RTS={levels:{}}; const lg = love.graphics; DEBUG flag
      01-constants.js    # VW/VH, GRAV, RUNSPD…, COL palette, CINE_/CASTLE_ consts
      02-utils.js        # clamp, lerp, smooth, gust, overlap
      03-audio.js        # genWind/genMusic/…, sources, driveL5* music helpers
      04-particles.js    # particle pool + update/draw
      05-physics.js      # moveAndCollide, floorAt, ledge/wall grab, mantle
      06-camera-save.js  # cam, updateCamera, cine, SAVE_KEY/save/load/clear, title helpers
      90-render.js       # pixCanvas, background dispatch, drawOverlays, love.draw
      91-engine.js       # love.load, love.update dispatch, input helpers, love.keypressed,
                         #   RTS.levels registration wiring, love._debug/_game hooks
    art/
      shared-art.js      # cross-level art: drawEmblem, castle, drawFlyingCarpet, rock/stone
    characters/
      player.js          # newPlayer, scarf physics, pose system (poseFor + mixPose/poseHang/…),
                         #   limbs/IK, sword render, drawHero, updatePlayer
      enemies-l2.js      # skeletons, biters, climber NPC, gates/rope/lift/key
      enemies-l3.js      # six-armed guardian boss, witch NPC, flying heads/scimitars, candle
      enemies-l5.js      # lava knight boss, lava balls/bullets, flight enemies (heads/bolts)
      cast-l4.js         # mkChar4 + guard/servant/child draws, limb helpers, name/colour tables
    levels/
      level1.js          # plats1/checkpoints1, prologue "The Ascent" cine, background+castle
      level2.js          # plats2/checkpoints2, l2 state, initEnts2/updateEnts2/drawEnts2
      level3.js          # plats3/checkpoints3, l3 state, triad, darkness overlay
      level4.js          # l4 state, initL4/updateL4, palace overlay + dialogue
      level5.js          # plats5/LAVA5/checkpoints5, l5 state, triad, CARPET FLIGHT, background5
```

Numeric filename prefixes in `core/` encode the load order so it stays obvious and correct.

## Section → file mapping (current line ranges)

Ranges are from the pre-refactor file; re-grep the section-banner comments when cutting
(the flight fix shifted everything after ~4400 down by ~40 lines).

| Current lines | Section | → destination |
|---|---|---|
| 18–68 | CONSTANTS + `COL` | `core/01-constants.js` |
| 70–81 | utils | `core/02-utils.js` |
| 215–362 | audio gen + sources | `core/03-audio.js` |
| 3608, 3622 | `driveL5BattleTheme/WakeMusic` | `core/03-audio.js` |
| 942–1011 | particles | `core/04-particles.js` |
| 1810–1924 | physics/collision | `core/05-physics.js` |
| 1925–1994 | camera / cine / save / title | `core/06-camera-save.js` |
| 363–439 | generic background | `levels/level1.js` (or `core/90-render.js` if shared) |
| 440–941 | rock/stone, emblem, castle, flying-carpet art | `art/shared-art.js` |
| 1012–1809 | PLAYER build/pose/draw | `characters/player.js` |
| 5141–5400 | `updatePlayer` | `characters/player.js` |
| 1995–2009 | kill/respawn helpers | `characters/player.js` |
| 2010–3001 | LEVEL 2 (state + entities + draw) | `levels/level2.js` + `characters/enemies-l2.js` |
| 3002–3575 | LEVEL 3 | `levels/level3.js` + `characters/enemies-l3.js` |
| 3576–4667+ | LEVEL 5 incl. carpet flight | `levels/level5.js` + `characters/enemies-l5.js` |
| 4668–5082 | LEVEL 4 cutscene | `levels/level4.js` + `characters/cast-l4.js` |
| 5083–5140 | `initLevel` dispatcher | becomes `RTS.levels` registry in `core/91-engine.js` |
| 5401–5722 | title / overlays | `core/90-render.js` |
| 5723–6067 | `love.load`, `love.update` | `core/91-engine.js` |
| 6068–6301 | `love.draw`, `love.keypressed`, `love._debug/_game` | `core/90-render.js` + `core/91-engine.js` |

For each level, the split rule is: **`levelN.js`** holds geometry data (`platsN`/`checkpointsN`/
level constants), the `lN` state object, and the `initEntsN/updateEntsN/drawEntsN` triad +
scenario/background/overlay; **`enemies-lN.js`** (or `cast-l4.js`) holds that level's
character `new*/update*/draw*` functions. Where a draw helper is shared by two levels (e.g.
`drawBiter` used by L2 and L5, `drawFlyingCarpet` used by L1/L4/L5), it goes to `art/shared-art.js`
or the character file of its "home" level and is called cross-file by name.

## The registry (replacing `if (level === N)`)

`initLevel` (5083) and the `level === N` chains in `love.update`/`love.draw`/`updatePlayer`
become a table each level file self-registers into:

```js
// at the bottom of levels/level5.js
RTS.levels[5] = {
  name: 'The Lava Caverns',
  plats: plats5, checkpoints: checkpoints5,
  init: initEnts5, update: updateEnts5, draw: drawEnts5,
  background: drawBackground5, overlay: drawL5Overlay,
  // optional scripted-beat hooks so the engine stays generic:
  updateOverride: updateL5Special,  // wake cutscene + carpet flight bypass
};
```

`core/91-engine.js` then does `const L = RTS.levels[level]; L.update(dt)` etc. The handful of
genuinely level-specific special-cases inside `updatePlayer` (e.g. the L5 lava-death branch)
stay in `player.js` guarded by `level === N` for now — untangling those is out of scope for a
behaviour-preserving refactor and can be a later pass.

## Migration steps (incremental, verify after each)

Do this as a sequence of small, independently-verifiable commits — **never one big cut**:

1. **Scaffold** `src/`, add `core/00-namespace.js` (`window.RTS`, `lg`, `DEBUG`). Wrap the current
   `game.js` body by removing the IIFE and re-exposing it as `src/legacy.js` loaded as one classic
   script. Update `index.html` to load `00-namespace.js` then `legacy.js`. **Verify the game is
   byte-for-behaviour identical.** This proves the "no-IIFE shared scope" mechanism before any
   real cutting.
2. **Extract leaf modules with no forward deps first**: `01-constants.js`, `02-utils.js`,
   `04-particles.js`, `art/shared-art.js`. Move code out of `legacy.js` into each, add the file to
   `index.html` in order, verify after each move.
3. **Extract characters**: `player.js`, then `enemies-l2/3/5.js`, `cast-l4.js`.
4. **Extract levels**: `level1..level5.js`, moving each `lN`/data/triad and self-registering into
   `RTS.levels`.
5. **Extract core engine/render**: `05-physics.js`, `06-camera-save.js`, `03-audio.js`,
   `90-render.js`, `91-engine.js`. Convert `initLevel` + dispatch chains to use `RTS.levels`.
6. **Delete `legacy.js`** once empty. Final `index.html` loads the full ordered list. Bump the
   `?v=` cache-bust string (and `BUILD` in constants) as the code does today.

Each step keeps the game runnable; if a step breaks, it is a ~200-line move to inspect, not 6,300.

## Verification (reuse the harness from the flight fix)

The game already exposes read-only hooks (`love._debug`, `love._game`) — the same ones used to
verify the carpet-flight fix. After every extraction step:

1. `python3 -m http.server 8791` in `return-of-the-shadow/`, open `index.html?debug=1` in Chrome.
2. Run a boot smoke test per level:
   ```js
   const L = window.love, d = L._debug;
   const report = {};
   for (const n of [1,2,3,4,5]) {
     try { L.initLevel(n); for (let f=0; f<120; f++) L.update(1/60); report[n]='ok'; }
     catch(e) { report[n]='THREW: '+e; }
   }
   report;   // expect {1:'ok',2:'ok',3:'ok',4:'ok',5:'ok'}
   ```
3. Spot-check the carpet flight death path still works (the script used in the flight-fix
   verification: set up `l5.flight`, force hits, assert it reaches `phase==='fall'` → `gameOver`
   with no throw).
4. Screenshot each level to confirm rendering is unchanged.
5. `node --check` every new file.

## Risks & rollback

- **Load-order bug (TDZ / undefined at load)** → symptom is a console error on boot; fix by
  reordering the `<script>` list. Mitigated by the numeric `core/` prefixes and by extracting
  runtime-only code (safe in any order) before load-time code.
- **Duplicate `const` across files** → a hard throw at load, caught immediately by the boot smoke
  test. Mechanical cuts make this unlikely.
- **`editor.js` / `touch.js` coupling** → both only use the `love` global, which is untouched; no
  changes needed there.
- **Rollback** is trivial per step: each step is one commit that only moves code, so `git revert`
  restores the previous working file set.

## Explicitly out of scope (behaviour-preserving refactor only)

- Converting the procedural characters to sprite sheets (there are none today — all art is math).
- Untangling the level-specific branches still embedded in `updatePlayer`.
- Any gameplay/tuning change.
