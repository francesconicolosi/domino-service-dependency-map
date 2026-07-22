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
| Enter the castle | ENTER on the prologue title screen |
| Restart the level | R |

On phones/tablets an on-screen control pad appears automatically (d-pad, ↑/↓,
**JUMP**, **ATK**, plus **R** and **ENTER**). Keyboard stays primary on desktop.

## Notes

- **Combat animation** — the hero's sword work is choreographed for weight and
  reach, taking motion cues from the classic *Prince of Persia* fencing: an
  en-garde guard, a committed **lunge/thrust** (front leg drives forward, back leg
  extends, torso commits along the blade), a brief held extension that "reads" the
  hit, then a weighted recovery. It's fully procedural — no sprite art is imported.
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
├── index.html     # the game
├── editor.html    # the level editor
├── love-shim.js   # LÖVE → Canvas2D / Web Audio / input compatibility layer
├── game.js        # game logic (two levels, physics, animation, audio)
├── editor.js      # the level editor
└── touch.js       # on-screen touch controls (game only)
```

## License

MIT.
