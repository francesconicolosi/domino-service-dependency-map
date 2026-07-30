# THE RETURN OF THE SHADOW — Sega Master System port · PLAN

A ground-up reimplementation of the JS/Canvas game
(`game/return/return-of-the-shadow/`) as a real Sega Master System `.sms` ROM,
written in Z80 C (SDCC + devkitSMS). The JS game is the **design reference**;
the ROM is new code + new SMS art. See `../DESIGN.md` for the hardware mapping.

## Build

```bash
cd rom
make            # -> shadow.sms (32 KB)
```
Requires `sdcc` (>=4.2) and a devkitSMS checkout at `../smstoolchain/devkitSMS`
with `ihx2sms` built and `SMSlib.lib` rebuilt from source (modern ABI). The
toolchain folder is intentionally git-ignored (third-party).

## Verification (headless)

- **Rendering / graphics** — a JS SMS emulator (jsSMS) driven in Chrome. Reliable
  for tiles/sprites; NOT for CPU/physics (it mis-executes SDCC's signed 16-bit
  compare idiom).
- **Physics / gameplay logic** — a **host-CPU C simulation** of the actual
  functions (`test/host_physics_sim.c`). The host runs C correctly and SDCC
  compiles these functions faithfully, so rest/walk/jump/climb verified here
  hold on hardware.
- **Accurate full-system check** — mednafen / Emulicious (need a display).

## Milestones

- [x] **M0 — Toolchain.** SDCC + devkitSMS; libs rebuilt for the modern
  `sdcccall(1)` ABI; host tools (`ihx2sms`) compiled.
- [x] **M1 — Bootable ROM.** Title screen → START → Level 1 movement core.
- [x] **M2 — Level 1 "The Ascent" core.** Tile-based AABB collision vs a level
  map, climbable wall faces, stone-platform ledges, a goal that clears the level.
  - Fixed a real fall-through bug: SDCC's signed comparisons (`if (dy>0)`,
    `for(int i;i<=n;…)`) were skipping the landing branch. Rewrote collision with
    `unsigned char` tile coords + **edge-based** land/ceiling selection.
  - Stable **grounded model** (solid-tile-under-feet), no 1px jitter.
  - Jump tuned slower/floatier (gravity halved).
- [x] **Hero sprite.** 16×24, traced pixel-for-pixel from the user's reference
  sheet (idle + run), quantized to the SMS palette: long black hair, dark-purple
  tunic w/ shading, red cape, skin face + white-sclera eye, arms/hands, solid
  legs. Frames registered to a common head-center + feet-baseline (no animation
  jump). Walk = two frames with the legs mirror-inverted (identical body/face),
  slower step cadence.

## Remaining — Level 1 polish
- [ ] Multi-screen **vertical camera scroll** (currently single screen).
- [ ] **Ledge-grab / mantle**.
- [ ] Hazards.
- [ ] Wire the reference sheet's **jump** frame (airborne) and **crouch/duck**
      frames + a crouch control.

## Milestones ahead
- [ ] **M3 — Level 2 "The Witch's Keep".** Patrolling skeletons, pressure-plate
      puzzle, sword strike + block/parry combat (use the sheet's ATTACK frames).
- [ ] **M4 — Levels 3–4.** Dark halls + six-sword boss + witch (L3); palace-
      balcony cutscene "Some Time Before" + flying-carpet rescue finale (L4).
- [ ] **M5 — PSG soundtrack + SFX.** Title / level / Middle-Eastern boss themes
      as 3-voice chiptune, plus jump/sword/hit SFX.
      **Blocker:** PSGlib fails to rebuild under SDCC 4.6 (`error 329` at
      `PSGlib.c:195`); the shipped lib is old `sdcccall(0)` ABI. Resolve before
      audio linking (patch the source, or isolate audio in an `sdcccall(0)` module).

## Layout
```
rom/
  Makefile                build to shadow.sms
  DESIGN.md               hardware mapping (tiles/sprites/PSG budgets)
  README.md               build & run
  plan/PLAN.md            this file
  src/main.c              boot, title, Level-1 gameplay
  src/assets.h            GENERATED tiles/palettes (from tools/gen_assets.py)
  tools/gen_assets.py     pixel-art -> SMS 4bpp planar tile pipeline
  test/host_physics_sim.c host-CPU physics verification harness
```
