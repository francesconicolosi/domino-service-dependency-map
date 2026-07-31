# THE RETURN OF THE SHADOW

A cinematic 2D platformer — **The Ascent** (a climbing prologue with a cinematic
and title screen) and **The Witch's Keep** (a castle with patrolling skeletons, a
pressure-plate trap, and sword combat). Everything — graphics, skeletal animation,
wind and music — is generated **procedurally in code**: no external assets.

Written in **vanilla JavaScript + Canvas 2D**. No frameworks, no build step, no
runtime dependencies. It runs by opening a single HTML file.

> This is a hand-written port of an original Love2D game. The game logic runs on a
> small **LÖVE-compatibility shim** (`love-shim.js`) that maps `love.graphics` onto
> Canvas 2D, `love.sound`/`love.audio` onto Web Audio, and `love.math` onto a
> seeded PRNG + ear-clipping triangulator.

## Run it

Open **`index.html`** — it works straight from `file://` (double-click), no server
required. Or serve the folder statically:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Audio starts on the first key press / tap (browser autoplay policy).

## Desktop downloads (macOS / Windows / Linux / Steam Deck)

Native desktop builds are published to the repo's **[GitHub Releases](../../releases)**.
They wrap the exact web game in a window (Electron) — see [`desktop/`](desktop/) and the
`Desktop Release (Electron)` GitHub Action. A release is cut by pushing a `vX.Y.Z` tag; each
release carries a macOS `.dmg`, Windows installer + portable `.exe`, and a Linux `.AppImage`
+ `.tar.gz`.

The builds are **unsigned**, so the OS shows a one-time warning the first time you run them:

- **macOS** — right-click the app → **Open** (or run `xattr -dr com.apple.quarantine "Return of the Shadow.app"`).
- **Windows** — SmartScreen → **More info** → **Run anyway** (or just run the portable `.exe`).
- **Linux** — `chmod +x *.AppImage && ./Return*.AppImage`.

**Steam Deck:** download the Linux `.AppImage`, mark it executable, and add it to Steam as a
**non-Steam game** (runs natively). Alternatively add the Windows portable `.exe` and run it
through **Proton** (Properties → Compatibility).

Build locally from `desktop/`: `npm install` then `npm start` (run) or `npm run build`
(package for your current OS into `desktop/dist/`).

## Controls

| Action | Keys |
|---|---|
| Move | ← → or A D |
| Jump | SPACE / Z / K (jump-buffer + coyote time) |
| Grab a ledge | automatic while airborne near an edge |
| Climb marked walls | ↑ / ↓ near the carved holds |
| Mantle over from a hang | ↑ |
| Let go | ↓ or S |
| Sword strike (Level 2) | X or F (after picking up the sword) |
| Block / parry (Level 2) | C — face the attacker; a well-timed block negates the hit |
| Enter the castle | ENTER on the prologue title screen |
| Restart the level | R |

A **successful parry** (blocking while facing the attacker) takes no damage,
recoils the enemy, and grants a brief **riposte**: your next strikes chain
instantly (a double attack) and hit with **double knockback** — ideal for
shoving skeletons off the ledges. Skeletons telegraph with a raised-sword
wind-up, so watch for it and press **C**.

On phones/tablets an on-screen control pad appears automatically (d-pad, ↑/↓,
**JUMP**, **ATK**, **BLK**, plus **R** and **ENTER**). Keyboard stays primary on desktop.

## Notes

- **Combat animation** — the sword work is fully procedural (no sprite art). On
  the ground the hero commits to a **spectacular overhead slash**: a deep,
  wide-legged lunge with a big sweeping motion-trail and an impact flash at the
  contact frame. In the air the same swing plays without the lunge. Skeletons
  telegraph and strike with the **same** overhead-slash choreography. Blocking
  raises the blade to a deflect guard; a successful parry pops a shield burst and
  a golden riposte glow.
- **Procedural detail** — mountain/rock silhouettes, cracks and grass use a seeded
  JS PRNG, so the art style and gameplay are deterministic; only the random
  decoration is generated at load.
- **Pixel-art pipeline** — the world renders to a low-res canvas and is
  nearest-neighbor upscaled with letterboxing, for the '90s look.

## Level editor

Open **`editor.html`**. Drag on empty space to create a platform (thin = beam),
click to select, drag to move, drag an edge to resize; `TAB` switch level,
`B` beam, `C` climbable wall, `N` climb-route bottom, `K` checkpoint, right-click a
flag to remove it, `X`/`DEL` delete, `G` grid snap, `H` help, wheel/middle-drag to
zoom/pan, `CTRL+S`/`F5` save, `CTRL+L` load.

**Saving** writes the layout to the browser's `localStorage` — the game
(`index.html`) then **auto-loads it** on next launch — and also downloads a
`level.lua` / `level2.lua` file.

To revert the game to its built-in levels, clear the saved layouts from the browser
console:

```js
localStorage.removeItem('rots:level.lua');
localStorage.removeItem('rots:level2.lua');
```

## Files

```
return-of-the-shadow/
├── index.html          # the game (loads the src/ scripts in order)
├── editor.html         # the level editor
├── love-shim.js        # LÖVE → Canvas2D / Web Audio / input compatibility layer
├── editor.js           # the level editor
├── touch.js            # on-screen touch controls (game only)
└── src/                # game.js was split into ordered classic scripts:
    ├── core/           #   namespace, constants, utils, level-data, particles, engine
    ├── art/            #   shared-art (rock/masonry, emblem, castle, flying carpet)
    ├── characters/     #   player, enemies-l2, enemies-l3, enemies-l5, cast-l4
    └── levels/         #   level1 … level5 (state, logic, scenario)
```

> The scripts are plain classic `<script>`s loaded in order; they share one
> top-level scope (no bundler / no ES modules). See
> `plans/modularization-refactor.md`.

## License

MIT.
