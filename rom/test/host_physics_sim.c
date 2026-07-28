#include <stdio.h>
#include <stdbool.h>
#define MAP_W 32
#define MAP_H 24
#define SCREEN_W 256
#define HERO_W 16
#define HERO_H 16
#define FP 4
#define TO_FP(px) ((px)<<FP)
#define TO_PX(v)  ((v)>>FP)
#define WALK_SPEED  TO_FP(1)
#define GRAVITY 3
#define JUMP_VEL (-TO_FP(4))
#define MAX_FALL TO_FP(6)
#define PORT_A_KEY_UP 0x01
#define PORT_A_KEY_DOWN 0x02
#define PORT_A_KEY_LEFT 0x04
#define PORT_A_KEY_RIGHT 0x08
#define PORT_A_KEY_1 0x10
#define PORT_A_KEY_2 0x20
static const char level1[MAP_H][MAP_W+1] = {
"................................","......*..............*..........",
".................*..............","...............XX...............",
"...............CC...............","...............CC...............",
".......LLLL....CC...............","...............CC...............",
"...............CC...LLLL........","...............CC...............",
"...............CC...............","....LLLL.......CC...............",
"...............CC...............","...............CC...............",
"..........LLLL.CC...............","...............CC...............",
"...............CC...............","...............CC.....LLLL......",
"...............CC...............","...............CC...............",
"GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG","################################",
"################################","################################",
};
static int hx,hy,vy; static bool on_ground,climbing; static unsigned char facing,walkbit,anim_timer;
static char map_char(unsigned char tx,unsigned char ty){ if(ty>=MAP_H||tx>=MAP_W) return '#'; return level1[ty][tx]; }
static bool is_solid(unsigned char tx,unsigned char ty){ char c=map_char(tx,ty); return c=='#'||c=='G'||c=='E'||c=='L'; }
static bool is_climb(unsigned char tx,unsigned char ty){ return map_char(tx,ty)=='C'; }
static bool solid_col(int px_edge,int py_top){ unsigned char col=(unsigned char)(px_edge>>3),top=(unsigned char)(py_top>>3),bot=(unsigned char)((py_top+HERO_H-1)>>3);
  for(unsigned char ty=top;ty<=bot;ty++) if(is_solid(col,ty)) return true; return false; }
static bool solid_row(int py_edge,int px_left){ unsigned char row=(unsigned char)(py_edge>>3),left=(unsigned char)(px_left>>3),right=(unsigned char)((px_left+HERO_W-1)>>3);
  for(unsigned char tx=left;tx<=right;tx++) if(is_solid(tx,row)) return true; return false; }
static void move_x(int dx){ hx+=dx; if(hx<0)hx=0; if(hx>TO_FP(SCREEN_W-HERO_W))hx=TO_FP(SCREEN_W-HERO_W);
  int px=TO_PX(hx),py=TO_PX(hy);
  if(dx>0){ if(solid_col(px+HERO_W-1,py)){ px=(((px+HERO_W-1)>>3)<<3)-HERO_W; hx=TO_FP(px);} }
  else if(dx<0){ if(solid_col(px,py)){ px=((px>>3)+1)<<3; hx=TO_FP(px);} } }
static void move_y(int dy){ hy+=dy; int px=TO_PX(hx),py=TO_PX(hy);
  bool fs=solid_row(py+HERO_H-1,px), hs=solid_row(py,px);
  if(fs&&!hs){ py=(((py+HERO_H-1)>>3)<<3)-HERO_H; hy=TO_FP(py); vy=0; on_ground=true; }
  else if(hs&&!fs){ py=((py>>3)+1)<<3; hy=TO_FP(py); vy=0; } }
static void hero_update(unsigned int keys){
  bool moving=false;
  if(keys&PORT_A_KEY_LEFT){ move_x(-WALK_SPEED); facing=2; moving=true; }
  if(keys&PORT_A_KEY_RIGHT){ move_x(WALK_SPEED); facing=0; moving=true; }
  int cx=(TO_PX(hx)+HERO_W/2)>>3, cy=(TO_PX(hy)+HERO_H/2)>>3;
  bool on_face=is_climb(cx,cy);
  if(!climbing&&on_face&&(keys&(PORT_A_KEY_UP|PORT_A_KEY_DOWN))) climbing=true;
  if(climbing){
    if(!on_face) climbing=false;
    else if(keys&(PORT_A_KEY_1|PORT_A_KEY_2)){ climbing=false; vy=JUMP_VEL; }
    else { vy=0; if(keys&PORT_A_KEY_UP) move_y(-TO_FP(1)); if(keys&PORT_A_KEY_DOWN) move_y(TO_FP(1));
      if(is_solid((TO_PX(hx)+HERO_W/2)>>3,(TO_PX(hy)+HERO_H)>>3)) on_ground=true; }
  }
  if(!climbing){
    unsigned char below=(unsigned char)((TO_PX(hy)+HERO_H)>>3);
    unsigned char fl=(unsigned char)(TO_PX(hx)>>3), fr=(unsigned char)((TO_PX(hx)+HERO_W-1)>>3);
    bool grounded=is_solid(fl,below)||is_solid(fr,below);
    if(grounded&&(keys&(PORT_A_KEY_1|PORT_A_KEY_2|PORT_A_KEY_UP))){ vy=JUMP_VEL; on_ground=false; move_y(vy); }
    else if(grounded){ vy=0; on_ground=true; hy=TO_FP(((int)below<<3)-HERO_H); }
    else { on_ground=false; vy+=GRAVITY; if(vy>MAX_FALL)vy=MAX_FALL; move_y(vy); }
  }
  (void)moving;
}
int main(){
  hx=TO_FP(3*8); hy=TO_FP(18*8); vy=0; on_ground=true; climbing=false;
  int f=0;
  while(((TO_PX(hx)+HERO_W/2)>>3) < 15 && f<400){ hero_update(PORT_A_KEY_RIGHT); f++; }
  printf("reached wall in %d frames: px=%d centerCol=%d py=%d\n", f, TO_PX(hx), (TO_PX(hx)+HERO_W/2)>>3, TO_PX(hy));
  printf("--- hold UP to climb ---\n");
  for(int i=0;i<44;i++){ hero_update(PORT_A_KEY_UP); if(i%4==0) printf("i%d py=%d climbing=%d\n", i, TO_PX(hy), climbing); }
  int gx=(TO_PX(hx)+HERO_W/2)>>3, gy=(TO_PX(hy)+HERO_H/2)>>3;
  printf("final center tile (%d,%d)='%c'  (goal='X')\n", gx, gy, level1[gy][gx]);
  return 0;
}
