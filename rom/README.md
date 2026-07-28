# The Return of the Shadow — SMS ROM

A ground-up **Sega Master System** port of the cinematic platformer, written in
Z80 C (SDCC + devkitSMS). See [`DESIGN.md`](DESIGN.md) for how the original
JS/Canvas game maps onto SMS hardware and the milestone roadmap.

## Build

```bash
cd rom
make                 # produces shadow.sms (32 KB)
make DEVKITSMS=/path/to/devkitSMS   # if devkitSMS lives elsewhere
```

Requirements:
- **SDCC ≥ 4.2** (`brew install sdcc`)
- **devkitSMS** at `../smstoolchain/devkitSMS`, with:
  - the `ihx2sms` host tool compiled (`cc -O2 ihx2sms/src/ihx2sms.c -o ihx2sms/ihx2sms`)
  - `SMSlib.lib` rebuilt from source with your SDCC (modern ABI):
    `cd SMSlib/src && make SMSlib.lib && cp SMSlib.lib ..`

## Run

Open `shadow.sms` in any SMS emulator:

```bash
# examples
open -a OpenEmu shadow.sms          # macOS GUI
mednafen shadow.sms                 # if installed
# or Emulicious (Java): java -jar Emulicious.jar shadow.sms
```

Real hardware: flash `shadow.sms` to an Everdrive/flashcart.

## Milestone 1 (current)

- Title screen → **START** → Level 1 "The Ascent".
- Move the Shadow with the D-pad; **jump** with button 1 / Up.
- **PAUSE** returns to the title.

## Layout

```
rom/
  Makefile            build to shadow.sms
  DESIGN.md           hardware mapping + roadmap
  src/main.c          boot, title, Level-1 movement core
  src/assets.h        GENERATED tiles/palettes (do not edit)
  tools/gen_assets.py pixel-art -> SMS 4bpp planar tile pipeline
```

Edit art in `tools/gen_assets.py` (8×8 grids of palette indices `0`–`F`), then
`make assets` to regenerate `src/assets.h`.
