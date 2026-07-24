# THE RETURN OF THE SHADOW — 3D

A **third-person, real-time 3D** re-imagining of *The Return of the Shadow*, built
with **[Three.js](https://threejs.org/)** (WebGL). You walk a low-poly hero
through the torch-lit **Witch's Keep** past patrolling skeletons toward the
great arched door.

Like the original 2D game, **everything is generated procedurally in code** — the
hero, the skeletons, the stone/brick textures, the torches and their flickering
light. There are **no external art assets**.

## Run it

ES-module + WebGL pages must be served over HTTP (not opened as a `file://`).
From this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000  in a browser
```

Three.js is loaded from a CDN via an `<script type="importmap">`, so you need an
internet connection the first time (it then caches). Runs great in Chrome /
Safari / Firefox on an Apple-Silicon Mac.

Click **ENTER THE KEEP** to start.

## Controls

| Action | Keys |
|---|---|
| Move | **W A S D** or arrow keys (camera-relative) |
| Look around | **drag** the mouse (or one finger on touch) |
| Run | hold **Shift** |
| Jump | **Space** |

On phones/tablets a **left thumb-stick** and a **JUMP** button appear; drag
elsewhere on screen to look.

The camera trails behind you automatically when you move, or take manual control
any time by dragging.

## What's in here

```
return-of-the-shadow-3d/
├── index.html   # importmap (Three.js CDN) + HUD + touch controls
├── main.js      # the whole game: renderer, world, hero, skeletons, camera
└── README.md
```

- **Framework:** Three.js `r160` (WebGL 2). Chosen because it runs in any browser
  with no build step and no install — the simplest way to try real 3D on a Mac.
- **Hero:** a procedural low-poly figure (cloak, hood, boots, a red scarf and a
  cape that sways) with idle / walk / run / jump animation driven in code.
- **World:** a stone courtyard with brick walls, pillars, clamberable platforms,
  flickering torches (dynamic point lights), scattered rubble and a grand arched
  exit door. Soft shadows from a single moonlight directional light.
- **Enemies:** skeletons that patrol and turn to reach for you when you come near.

## Notes / possible next steps

- The character is built from primitives to stay asset-free. If you'd rather use a
  **rigged glTF model** (e.g. from Mixamo/Quaternius), it's a drop-in: load it with
  `GLTFLoader`, play its `AnimationClips`, and keep the same movement/camera code.
- Natural extensions: sword combat (port the 2D parry/riposte), the rope/plate and
  key-gate puzzles in 3D, collectibles, and audio (Web Audio, procedural like the
  2D game).

## License

MIT.
