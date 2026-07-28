#!/usr/bin/env python3
# ----------------------------------------------------------------------------
#  gen_assets.py  --  tiny asset pipeline for THE RETURN OF THE SHADOW (SMS)
#
#  Turns human-editable pixel art (grids of palette indices 0-F) into the Sega
#  Master System's native 4bpp *planar* tile format and emits a C header.
#
#  This is the maintainable substitute for hand-typing 32-byte planar tiles:
#  art lives as readable 8x8 index grids here; the port's C code just includes
#  the generated `assets.h`.
#
#  SMS tile format (per 8x8 tile = 32 bytes): for each of the 8 rows, 4 bytes,
#  one per bitplane. In each byte the MSB is the leftmost pixel. Bitplane b of
#  row r packs bit b of all 8 pixels of that row.
#
#  Palette: SMS color is 6-bit  --BBGGRR  (2 bits per channel). We author colors
#  as (r,g,b) each 0..3 and pack them.
# ----------------------------------------------------------------------------
import sys, os

def sms_color(r, g, b):
    return (r & 3) | ((g & 3) << 2) | ((b & 3) << 4)

def flip_tile(rows):
    """Mirror an 8x8 tile horizontally (SMS sprites have no hardware H-flip)."""
    return [row[::-1] for row in rows]

def flip_hero(frame):
    """Mirror a 2x2 hero frame: swap L/R quadrants and flip each tile."""
    return {
        "TL": flip_tile(frame["TR"]), "TR": flip_tile(frame["TL"]),
        "BL": flip_tile(frame["BR"]), "BR": flip_tile(frame["BL"]),
    }

def tile_to_planar(rows):
    """rows: list of 8 strings, each 8 hex chars (palette index 0-F). -> 32 bytes"""
    assert len(rows) == 8, "tile must be 8 rows"
    out = bytearray()
    for r in rows:
        assert len(r) == 8, f"row must be 8 px, got {len(r)!r}"
        px = [int(c, 16) for c in r]
        for plane in range(4):
            byte = 0
            for x in range(8):
                if (px[x] >> plane) & 1:
                    byte |= (0x80 >> x)
            out.append(byte)
    return out

def emit_c_array(name, data, f, per_line=16):
    f.write(f"const unsigned char {name}[{len(data)}] = {{\n")
    for i in range(0, len(data), per_line):
        chunk = data[i:i+per_line]
        f.write("  " + ",".join(f"0x{b:02X}" for b in chunk) + ",\n")
    f.write("};\n\n")

# ----------------------------------------------------------------------------
#  PALETTES  (index 0 = transparent for sprites / backdrop for BG)
# ----------------------------------------------------------------------------
# Background palette: dusk sky, rock, grass, gold.
BG_PAL = [
    sms_color(1,1,2),  # 0 sky/backdrop (dusky blue)
    sms_color(0,0,0),  # 1 black outline
    sms_color(2,1,0),  # 2 rock mid (brown)
    sms_color(1,0,0),  # 3 rock dark
    sms_color(3,2,1),  # 4 rock light
    sms_color(0,2,0),  # 5 grass dark
    sms_color(1,3,0),  # 6 grass light
    sms_color(3,3,0),  # 7 gold
    sms_color(2,2,3),  # 8 mist
    sms_color(3,3,3),  # 9 white
    sms_color(1,1,1),  # A grey
    sms_color(2,0,0),  # B blood/dark red
    sms_color(3,1,0),  # C torch orange
    sms_color(2,2,2),  # D stone light
    sms_color(0,1,1),  # E deep teal
    sms_color(0,0,1),  # F night
]

# Sprite palette: the Shadow hero (cloak, skin, blade).
SPR_PAL = [
    0,                 # 0 transparent
    sms_color(0,0,0),  # 1 black (cloak/outline)
    sms_color(1,0,1),  # 2 shadow purple
    sms_color(2,1,2),  # 3 cloak highlight
    sms_color(3,2,2),  # 4 skin
    sms_color(3,3,3),  # 5 blade/eyes white
    sms_color(2,2,2),  # 6 steel grey
    sms_color(3,2,0),  # 7 leather/gold
    sms_color(3,0,0),  # 8 red trim
    sms_color(1,1,2),  # 9 boot blue-grey
    sms_color(2,0,0),  # A dark red
    sms_color(0,0,0),  # B (dup black)
    sms_color(3,3,0),  # C gold glint
    sms_color(1,2,3),  # D cold rim light
    sms_color(2,2,3),  # E pale
    sms_color(3,3,3),  # F white
]

# ----------------------------------------------------------------------------
#  BACKGROUND TILES
# ----------------------------------------------------------------------------
BG_TILES = {
"sky": [
    "00000000","00000000","00000000","00000000",
    "00000000","00000000","00000000","00000000",
],
"grass_top": [  # grassy cliff edge
    "56656565","65566556","11111111","24243242",
    "42324234","23423242","34234232","24234234",
],
"rock": [  # solid rock body
    "24234234","42342342","23423423","34234232",
    "42342342","24234234","34232423","23423423",
],
"rock_edge": [  # rock with dark left cliff edge
    "13242342","13423423","13234234","13342342",
    "13423423","13242342","13234234","13423423",
],
"star": [  # night sky star fleck
    "00000000","00090000","00000000","09000900",
    "00000000","00090000","00000000","00000000",
],
"ledge": [  # solid stone platform block
    "DDDDDDDD","4A4A4A4A","A4A4A4A4","24242424",
    "42424242","A4A4A4A4","4A4A4A4A","22222222",
],
"climb": [  # climbable wall face with carved holds
    "32222223","34444443","32222223","32222223",
    "34444443","32222223","32222223","34444443",
],
"goal": [  # golden objective marker (the Shadow's sigil)
    "0C7777C0","7C7777C7","77C77C77","777CC777",
    "77C77C77","7C7777C7","0C7777C0","00000000",
],
}

# ----------------------------------------------------------------------------
#  HERO SPRITE  --  "The Shadow": a hooded human adventurer, facing right.
#  Authored as a full 16x16 grid (much easier to read as a figure than four
#  separate 8x8 quadrants); split16() cuts it into TL/TR/BL/BR tiles.
#  Palette: 1 black outline, 2 dark-purple cloak, 3 light-purple highlight,
#           4 skin, 5 white eye, 7 gold belt, 9 boot.
# ----------------------------------------------------------------------------
# Taller, less-chibi proportions: small head (~4px), visible face, long legs,
# and a red cape (8 = red, A = dark-red edge) billowing behind. Facing right,
# so the cape trails to the left; the mirror handles left-facing.
# 16x24 = 2x3 tiles. Slim, Shinobi-like proportions: small head, long legs.
# Small visible face + eye, black hair, red cape (8/A) trailing, gold belt (7).
# The walk frame swings the front arm forward and strides the legs together.
HERO_W_PX, HERO_H_PX = 16, 24
# Frames traced from the user's reference sheet (idle + two run poses),
# quantized to the SMS palette. Long black hair, dark-purple outfit, skin face,
# red cape. Authored facing right; the mirror handles left.
# Palette: 1 black, 2 dark-purple, 3 purple, 4 skin, 8 red.
# Upper body traced from the reference; eye is a white sclera (5) + black pupil
# (1); legs are hand-authored so the two run frames clearly alternate (one leg
# planted, the other swinging back / forward).
HERO_IDLE_16 = [
    "0000001111110000", "0000011111111000", "0000111111111100", "0000111114441100",
    "0001111151101100", "0001111155141100", "0001111144441000", "0001111111111000",
    "0001811222211000", "0001811222221000", "0008812213321000", "0088812213321000",
    "0888012223321000", "8888811223321000", "8880011144321100", "0080111244111100",
    "0001111211111000", "0000111221121000", "0000011211221000", "0000011221121000",
    "0000112221121000", "0000122211221000", "0000122111222100", "0000111111111100",
]
HERO_RUN0_16 = [
    "0000001111100000", "0000011111110000", "0000111111111000", "0001111144411000",
    "0001111441111000", "0011111441111000", "0011111444411000", "0011111444410000",
    "0011111111110000", "0088122222210000", "0881122222214000", "8881221222214000",
    "8881221122111000", "8801104422111000", "8001114412111000", "0011111142111000",
    "0011121222211000", "0011122222221000", "0001133112222100", "0111331101122100",
    "1223311001122100", "1221110000122210", "1211100000122210", "0110000000111100",
]
# RUN1 = RUN0 with an identical upper body/face and only the legs mirrored,
# so the stride visibly inverts while the body stays perfectly stable.
HERO_RUN1_16 = [
    "0000001111100000", "0000011111110000", "0000111111111000", "0001111144411000",
    "0001111441111000", "0011111441111000", "0011111444411000", "0011111444410000",
    "0011111111110000", "0088122222210000", "0881122222214000", "8881221222214000",
    "8881221122111000", "8801104422111000", "8001114412111000", "0011111142111000",
    "0112222121110000", "0122222221110000", "1222211331100000", "1221101133111000",
    "1221100113322100", "2221000011122100", "2221000001112100", "1111000000011000",
]

def flip_grid(grid):
    """Mirror a full character grid horizontally (SMS sprites have no H-flip)."""
    return [row[::-1] for row in grid]

def split_tiles(grid):
    """Cut a 16-wide x N*8-tall grid into 8x8 tiles, row-major (L then R)."""
    h = len(grid)
    tiles = []
    for rb in range(0, h, 8):
        for cb in (0, 8):
            tiles.append([grid[rb + r][cb:cb + 8] for r in range(8)])
    return tiles

def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "src")
    out_path = os.path.abspath(os.path.join(out_dir, "assets.h"))
    with open(out_path, "w") as f:
        f.write("// AUTO-GENERATED by tools/gen_assets.py -- do not edit by hand.\n")
        f.write("#ifndef ASSETS_H\n#define ASSETS_H\n\n")

        emit_c_array("bg_palette", BG_PAL, f)
        emit_c_array("sprite_palette", SPR_PAL, f)

        # BG tiles in a fixed order; expose indices as #defines.
        bg_order = ["sky","grass_top","rock","rock_edge","star",
                    "ledge","climb","goal"]
        bg_data = bytearray()
        for i, name in enumerate(bg_order):
            bg_data += tile_to_planar(BG_TILES[name])
            f.write(f"#define BGTILE_{name.upper()} {i}\n")
        f.write("\n")
        emit_c_array("bg_tiles", bg_data, f)
        f.write(f"#define BG_TILE_COUNT {len(bg_order)}\n\n")

        # Hero frames: 16x24 => 6 tiles each, row-major (TL,TR, ML,MR, BL,BR).
        # Per facing: pose 0 = idle, 1 = run-0, 2 = run-1. Right-facing poses
        # first (offset 0), then the mirrored left-facing poses (offset 3).
        # Left frames are software-mirrored (SMS sprites have no H-flip).
        right = [HERO_IDLE_16, HERO_RUN0_16, HERO_RUN1_16]
        frame_grids = right + [flip_grid(g) for g in right]
        hero_data = bytearray()
        for g in frame_grids:
            for t in split_tiles(g):
                hero_data += tile_to_planar(t)
        emit_c_array("hero_tiles", hero_data, f)
        f.write("#define HERO_TILE_BASE 0\n")
        f.write("#define HERO_FRAME_TILES 6   // 2 wide x 3 tall\n")
        f.write("#define HERO_FRAME_COUNT 6   // idle,run0,run1 x 2 facings\n")
        f.write("#define HERO_POSE_IDLE 0\n")
        f.write("#define HERO_POSE_RUN0 1\n")
        f.write("#define HERO_POSE_RUN1 2\n")
        f.write(f"#define HERO_W_PX {HERO_W_PX}\n")
        f.write(f"#define HERO_H_PX {HERO_H_PX}\n")
        f.write("#define HERO_FACE_RIGHT 0\n")
        f.write("#define HERO_FACE_LEFT  3   // pose offset for left-facing\n\n")

        f.write("#endif // ASSETS_H\n")
    print(f"wrote {out_path}  ({len(bg_data)+len(hero_data)} tile bytes)")

if __name__ == "__main__":
    main()
