// ============================================================================
//  THE RETURN OF THE SHADOW  --  Sega Master System port
//  main.c : boot, title, and Level 1 "The Ascent".
//
//  Milestone 2: tile-based collision against a real level map, climbable wall
//  faces (the ascent mechanic), stone platforms, left/right facing (mirrored
//  sprite tiles, since SMS has no hardware flip), and a goal that clears the
//  level. Single-screen for now; multi-screen vertical scroll is a later step.
// ============================================================================
#include <stdbool.h>
#include "SMSlib.h"
#include "assets.h"

// ---- VRAM tile layout -------------------------------------------------------
#define HERO_VRAM_TILE   0     // hero sprite tiles at 0..15 (4 frames x 4)
#define BG_VRAM_TILE     256   // BG tiles at 256.. (second bank; no sprite clash)

// ---- world geometry ---------------------------------------------------------
#define MAP_W   32
#define MAP_H   24
#define SCREEN_W 256
#define GROUND_Y 160   // top of the grass row (row 20)
#define HERO_W   16
#define HERO_H   24   // 16x24 sprite (2 wide x 3 tall tiles)

// ---- fixed point 8.4 (1 px = 16 units) -------------------------------------
#define FP 4
#define TO_FP(px) ((px) << FP)
#define TO_PX(v)  ((v) >> FP)

#define WALK_SPEED   TO_FP(1)
#define CLIMB_SPEED  TO_FP(1)
#define GRAVITY      2            // gentler gravity -> slower, floatier jump
#define JUMP_VEL     (-TO_FP(4))
#define MAX_FALL     TO_FP(4)

// ---- the level --------------------------------------------------------------
//  '.' sky   '*' star   'G' grass  '#' rock  'E' edge  'L' ledge
//  'C' climb wall   'X' goal
static const char level1[MAP_H][MAP_W + 1] = {
    "................................",
    "......*..............*..........",
    ".................*..............",
    "...............XX...............",
    "...............CC...............",
    "...............CC...............",
    ".......LLLL....CC...............",
    "...............CC...............",
    "...............CC...LLLL........",
    "...............CC...............",
    "...............CC...............",
    "....LLLL.......CC...............",
    "...............CC...............",
    "...............CC...............",
    "..........LLLL.CC...............",
    "...............CC...............",
    "...............CC...............",
    "...............CC.....LLLL......",
    "...............CC...............",
    "...............CC...............",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "################################",
    "################################",
    "################################",
};

// ---- hero state -------------------------------------------------------------
static int  hx, hy;          // top-left, 8.4 fixed
static int  vy;              // vertical velocity, 8.4
static bool on_ground;
static bool climbing;
static unsigned char facing;     // HERO_FACE_RIGHT / HERO_FACE_LEFT
static unsigned char walkbit;    // 0/1 run-cycle toggle
static unsigned char pose;       // HERO_POSE_IDLE / RUN0 / RUN1
static unsigned char anim_timer;

// ---- map helpers ------------------------------------------------------------
// Tile coords are unsigned char: any pixel/8 that lands outside 0..MAP_W-1 /
// 0..MAP_H-1 wraps to a large value and reads as a solid wall/floor. Using
// unsigned keeps the compiler off signed 16-bit comparisons (which some
// emulators mis-execute) and matches the tilemap-draw path that works.
static char map_char(unsigned char tx, unsigned char ty)
{
    if (ty >= MAP_H || tx >= MAP_W) return '#';   // outside = solid
    return level1[ty][tx];
}
static bool is_solid(unsigned char tx, unsigned char ty)
{
    char c = map_char(tx, ty);
    return c == '#' || c == 'G' || c == 'E' || c == 'L';
}
static bool is_climb(unsigned char tx, unsigned char ty) { return map_char(tx, ty) == 'C'; }

static unsigned int char_to_tile(char c)
{
    switch (c) {
        case '*': return BG_VRAM_TILE + BGTILE_STAR;
        case 'G': return BG_VRAM_TILE + BGTILE_GRASS_TOP;
        case '#': return BG_VRAM_TILE + BGTILE_ROCK;
        case 'E': return BG_VRAM_TILE + BGTILE_ROCK_EDGE;
        case 'L': return BG_VRAM_TILE + BGTILE_LEDGE;
        case 'C': return BG_VRAM_TILE + BGTILE_CLIMB;
        case 'X': return BG_VRAM_TILE + BGTILE_GOAL;
        default:  return BG_VRAM_TILE + BGTILE_SKY;
    }
}

static void draw_level_bg(void)
{
    unsigned int row[MAP_W];
    for (unsigned char y = 0; y < MAP_H; y++) {
        for (unsigned char x = 0; x < MAP_W; x++)
            row[x] = char_to_tile(level1[y][x]);
        SMS_loadTileMap(0, y, row, MAP_W * 2);   // bulk upload one row (64 bytes)
    }
}

// ----------------------------------------------------------------------------
//  A full-screen text card (reloads the font). Waits for a START press-edge.
// ----------------------------------------------------------------------------
static void wait_start(void)
{
    while (SMS_getKeysStatus() & PORT_A_KEY_START) SMS_waitForVBlank();
    while (!(SMS_getKeysStatus() & PORT_A_KEY_START)) SMS_waitForVBlank();
}

static void title_screen(void)
{
    SMS_displayOff();
    SMS_VRAMmemsetW(0, 0x0000, 16384);
    SMS_autoSetUpTextRenderer();
    SMS_printatXY(6,  7, "THE  RETURN  OF");
    SMS_printatXY(11, 9, "THE  SHADOW");
    SMS_printatXY(4, 14, "a Sega Master System port");
    SMS_printatXY(9, 18, "PRESS  START");
    SMS_displayOn();
    wait_start();
}

static void cleared_screen(void)
{
    SMS_displayOff();
    SMS_VRAMmemsetW(0, 0x0000, 16384);
    SMS_autoSetUpTextRenderer();
    SMS_printatXY(8,  9, "THE  ASCENT");
    SMS_printatXY(11, 11, "CLEARED");
    SMS_printatXY(6, 16, "the climb is only");
    SMS_printatXY(8, 17, "the beginning");
    SMS_printatXY(9, 20, "PRESS  START");
    SMS_displayOn();
    wait_start();
}

// ----------------------------------------------------------------------------
static void level1_setup(void)
{
    SMS_displayOff();
    SMS_VRAMmemsetW(0, 0x0000, 16384);
    SMS_loadBGPalette(bg_palette);
    SMS_loadSpritePalette(sprite_palette);
    SMS_loadTiles(hero_tiles, HERO_VRAM_TILE, sizeof(hero_tiles));
    SMS_loadTiles(bg_tiles,   BG_VRAM_TILE,   sizeof(bg_tiles));
    SMS_useFirstHalfTilesforSprites(true);
    draw_level_bg();

    hx = TO_FP(3 * 8);
    hy = TO_FP(GROUND_Y - HERO_H);   // feet rest on the grass row (row 20)
    vy = 0;
    on_ground = true;
    climbing = false;
    facing = HERO_FACE_RIGHT;
    walkbit = 0;
    anim_timer = 0;

    SMS_initSprites();
    SMS_copySpritestoSAT();
    SMS_displayOn();
}

// Solid check spanning the hero's height at a given pixel column edge.
static bool solid_col(int px_edge, int py_top)
{
    unsigned char col = (unsigned char)(px_edge >> 3);
    unsigned char top = (unsigned char)(py_top >> 3);
    unsigned char bot = (unsigned char)((py_top + HERO_H - 1) >> 3);
    for (unsigned char ty = top; ty <= bot; ty++)
        if (is_solid(col, ty)) return true;
    return false;
}
// Solid check spanning the hero's width at a given pixel row edge.
static bool solid_row(int py_edge, int px_left)
{
    unsigned char row = (unsigned char)(py_edge >> 3);
    unsigned char left = (unsigned char)(px_left >> 3);
    unsigned char right = (unsigned char)((px_left + HERO_W - 1) >> 3);
    for (unsigned char tx = left; tx <= right; tx++)
        if (is_solid(tx, row)) return true;
    return false;
}

// ---- collision-resolved horizontal move ------------------------------------
static void move_x(int dx)
{
    hx += dx;
    if (hx < 0) hx = 0;
    if (hx > TO_FP(SCREEN_W - HERO_W)) hx = TO_FP(SCREEN_W - HERO_W);

    int px = TO_PX(hx);
    int py = TO_PX(hy);
    if (dx > 0) {
        if (solid_col(px + HERO_W - 1, py)) {
            px = (((px + HERO_W - 1) >> 3) << 3) - HERO_W;
            hx = TO_FP(px);
        }
    } else if (dx < 0) {
        if (solid_col(px, py)) {
            px = ((px >> 3) + 1) << 3;
            hx = TO_FP(px);
        }
    }
}

// ---- collision-resolved vertical move --------------------------------------
//  Branch on which EDGE is solid rather than on the sign of the velocity: some
//  emulators mis-execute SDCC's signed 16-bit comparisons, which silently
//  skipped the old `if (dy > 0)` landing branch and let the hero fall through.
static void move_y(int dy)
{
    hy += dy;
    int px = TO_PX(hx);
    int py = TO_PX(hy);
    bool feet_solid = solid_row(py + HERO_H - 1, px);
    bool head_solid = solid_row(py, px);

    if (feet_solid && !head_solid) {               // landed on ground
        py = (((py + HERO_H - 1) >> 3) << 3) - HERO_H;
        hy = TO_FP(py);
        vy = 0;
        on_ground = true;
    } else if (head_solid && !feet_solid) {        // bonked a ceiling
        py = ((py >> 3) + 1) << 3;
        hy = TO_FP(py);
        vy = 0;
    }
}

// ---- one frame of hero simulation ------------------------------------------
static void hero_update(unsigned int keys)
{
    bool moving = false;

    // horizontal
    if (keys & PORT_A_KEY_LEFT)  { move_x(-WALK_SPEED); facing = HERO_FACE_LEFT;  moving = true; }
    if (keys & PORT_A_KEY_RIGHT) { move_x( WALK_SPEED); facing = HERO_FACE_RIGHT; moving = true; }

    // climbing: engage when overlapping a climb face and pressing up/down
    int cx = (TO_PX(hx) + HERO_W / 2) >> 3;
    int cy = (TO_PX(hy) + HERO_H / 2) >> 3;
    bool on_face = is_climb(cx, cy);

    if (!climbing && on_face && (keys & (PORT_A_KEY_UP | PORT_A_KEY_DOWN)))
        climbing = true;

    if (climbing) {
        if (!on_face) {                       // stepped off the wall
            climbing = false;
        } else if (keys & (PORT_A_KEY_1 | PORT_A_KEY_2)) {  // leap off
            climbing = false;
            vy = JUMP_VEL;
        } else {
            vy = 0;
            if (keys & PORT_A_KEY_UP)   move_y(-CLIMB_SPEED);
            if (keys & PORT_A_KEY_DOWN) move_y( CLIMB_SPEED);
            // if there is solid ground under us, we've reached the bottom
            if (is_solid((TO_PX(hx) + HERO_W / 2) >> 3,
                         (TO_PX(hy) + HERO_H) >> 3))
                on_ground = true;
        }
    }

    if (!climbing) {
        // Grounded = a solid tile directly beneath either foot. This is a
        // stable, jitter-free test (the old code hovered 1px above the floor
        // and re-fell every frame, which is what broke while walking).
        unsigned char below = (unsigned char)((TO_PX(hy) + HERO_H) >> 3);
        unsigned char fl = (unsigned char)(TO_PX(hx) >> 3);
        unsigned char fr = (unsigned char)((TO_PX(hx) + HERO_W - 1) >> 3);
        bool grounded = is_solid(fl, below) || is_solid(fr, below);

        if (grounded && (keys & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_A_KEY_UP))) {
            vy = JUMP_VEL;                       // launch
            on_ground = false;
            move_y(vy);
        } else if (grounded) {
            vy = 0;                              // sit firmly on the surface
            on_ground = true;
            hy = TO_FP(((int)below << 3) - HERO_H);
        } else {
            on_ground = false;                   // airborne: fall
            vy += GRAVITY;
            if (vy > MAX_FALL) vy = MAX_FALL;
            move_y(vy);
        }
    }

    // animation: idle when still, run-cycle (2 frames) when moving/climbing
    if (moving || (climbing && (keys & (PORT_A_KEY_UP | PORT_A_KEY_DOWN)))) {
        if (++anim_timer >= 11) { anim_timer = 0; walkbit ^= 1; }  // slower step
        pose = HERO_POSE_RUN0 + walkbit;
    } else {
        pose = HERO_POSE_IDLE;
        walkbit = 0;
        anim_timer = 0;
    }
}

static bool hero_at_goal(void)
{
    int px = TO_PX(hx), py = TO_PX(hy);
    return map_char((px + HERO_W / 2) >> 3, (py + HERO_H / 2) >> 3) == 'X'
        || map_char((px + HERO_W / 2) >> 3, py >> 3) == 'X';
}

static void hero_draw(void)
{
    int px = TO_PX(hx), py = TO_PX(hy);
    unsigned char base = HERO_VRAM_TILE + (facing + pose) * HERO_FRAME_TILES;
    SMS_initSprites();
    SMS_addSprite(px,     py,      base + 0);  // TL
    SMS_addSprite(px + 8, py,      base + 1);  // TR
    SMS_addSprite(px,     py + 8,  base + 2);  // ML
    SMS_addSprite(px + 8, py + 8,  base + 3);  // MR
    SMS_addSprite(px,     py + 16, base + 4);  // BL
    SMS_addSprite(px + 8, py + 16, base + 5);  // BR
}

void main(void)
{
    for (;;) {
        title_screen();
        level1_setup();

        for (;;) {
            unsigned int keys = SMS_getKeysStatus();
            hero_update(keys);
            hero_draw();

            SMS_waitForVBlank();
            SMS_copySpritestoSAT();

            if (hero_at_goal()) { cleared_screen(); break; }
            if (SMS_queryPauseRequested()) { SMS_resetPauseRequest(); break; }
        }
    }
}

SMS_EMBED_SEGA_ROM_HEADER(9999, 0);
SMS_EMBED_SDSC_HEADER_AUTO_DATE(0, 5, "port",
    "The Return of the Shadow",
    "SMS port - M2d: taller Shinobi-proportion hero, slower jump");
