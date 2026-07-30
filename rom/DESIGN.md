# THE RETURN OF THE SHADOW — Sega Master System port

Design doc mapping the original **vanilla-JS / Canvas 2D** game
(`game/return/return-of-the-shadow/`) onto real SMS hardware. This is a
**ground-up reimplementation in Z80 C** (SDCC + devkitSMS), not a transpile:
the JS is the design reference, the ROM is new code and new art.

## Target hardware budget

| Resource | SMS | Consequence for the port |
|---|---|---|
| CPU | Z80 @ 3.58 MHz | No per-pixel/vector drawing. Everything is tiles + sprites moved by the VDP. |
| RAM | 8 KB | Entity structs must be tiny; no dynamic allocation. |
| VRAM | 16 KB | ~448 usable 8×8 tiles shared by BG + sprites. Tight art budget per scene. |
| Colors | 32 on-screen (2×16 palettes), 6-bit RGB | BG uses one 16-color palette, sprites the other. |
| Sprites | 64 total, **8 per scanline**, 8×8 or 8×16, **no H/V flip** | Left-facing frames need their own tiles. Wide scenes must limit stacked sprites. |
| Sound | SN76489 PSG: 3 square + 1 noise | The MP3 boss theme and Web-Audio music become 3-voice chiptune. |
| ROM | banked, 32 KB–512 KB | Plenty of space for art/music/levels via Sega mapper banking. |

## The original, and how each piece translates

The JS game is a cinematic 4-act platformer. Mapping:

| Original feature (JS / Canvas)                                                                 | SMS realization |
|------------------------------------------------------------------------------------------------|---|
| **L1 "The Ascent"** — climbing prologue, title screen, wind                                    | Tilemap cliff + climb-marked wall tiles; hero sprite physics. **(milestone 1: movement core done)** |
| **L2 "The Witch's Keep"** — patrolling skeletons, pressure-plate trap, sword combat            | Skeleton metasprites with a simple state machine; a trigger tile for the plate; attack/block/parry as animation frames + hitbox windows. |
| **L3 "Dark Halls"** — six-sword boss + witch, crouch                                           | Boss = multi-sprite composite; the six swords are individually-tracked projectile sprites (mind the 8/scanline limit — stagger their rows). |
| **L4 "Some Time Before"** — palace-balcony cutscene, moon, flying carpet, carpet-rescue finale | Cutscene = static tilemap scene + scripted sprite tweens + text box. No free-form vector art. |
| **Procedural skeletal animation** (all characters drawn from bones in code)                    | Pre-baked sprite frames authored via `tools/gen_assets.py`. The *feel* (overhead slash, guard stance, telegraph) is reproduced as keyframes. |
| **Truecolor + gradients**                                                                      | Hand-picked 16-color palettes per act; dithering with tiles where a gradient is essential (sky). |
| **MP3 boss theme + Web-Audio procedural music**                                                | PSG chiptune arrangements per act, incl. the Middle-Eastern boss battle theme, driven by PSGlib. |
| **Mobile touch pad, fullscreen, debug keys**                                                   | Dropped — SMS uses the 2-button control pad + PAUSE. |

## Controls (SMS pad)

| Action | Button |
|---|---|
| Move / climb | D-pad |
| Jump / mantle | 1 (or Up) |
| Sword strike | 2 |
| Block / parry | 1+held direction (L2+) |
| Start / advance cutscene | START |
| Back to title | PAUSE |

## Art pipeline

`tools/gen_assets.py` turns human-editable **8×8 index grids** (palette entries
`0`–`F`) into SMS 4bpp *planar* tiles and emits `src/assets.h`. This is how all
tile and sprite art enters the ROM — no hand-typed byte blobs. Colors are
authored as `(r,g,b)` each `0..3` and packed to the 6-bit `--BBGGRR` format.

**Known constraint to solve:** SMS sprites have no hardware flip, so every
directional character needs mirrored frames generated (add a `flip=True` path to
the encoder, or author both).

## Audio pipeline (deferred — milestone: PSG soundtrack)

PSGlib is the playback engine. **Blocker:** PSGlib's source fails to rebuild
under SDCC 4.6 (`error 329` at `PSGlib.c:195`, a post-preprocess artifact); the
shipped `PSGlib.lib` is the older `sdcccall(0)` ABI and won't link cleanly with
modern-ABI code. Resolve by patching PSGlib's source or isolating audio in an
`--sdcccall 0` module. Music will be authored as PSG note data (tracker export
→ VGM/PSG stream).

## Build

```bash
cd rom
make            # -> shadow.sms (32 KB)
```

Needs `sdcc` (≥4.2) and the devkitSMS checkout at `../smstoolchain/devkitSMS`
with its host tools (`ihx2sms`) and a locally-rebuilt `SMSlib.lib` (modern ABI).
Run it in any SMS emulator (Emulicious, OpenEmu, MEKA, Mednafen) or on real
hardware via flashcart.

## Roadmap / status

- [x] **M0** Toolchain: SDCC + devkitSMS, libs rebuilt for modern ABI, tools compiled.
- [x] **M1** Bootable ROM: title screen + Level-1 movement core (run/jump on tiled cliff).
- [ ] **M2** L1 full: climb-walls, ledges/mantle, camera scroll, hazards, goal.
- [ ] **M3** L2: skeletons + sword combat + block/parry + plate puzzle.
- [ ] **M4** L3–L4: dark halls, six-sword boss, cutscenes, carpet finale.
- [ ] **M5** PSG soundtrack + SFX.
