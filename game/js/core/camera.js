/* ============================================================
   CAMERA — segue un giocatore con inseguimento morbido (lerp)
   e non esce mai dai bordi del livello.

   viewW/viewH: dimensioni della porzione di schermo che questa
   camera inquadra. A schermo intero sono 320x224; in split
   screen ogni camera copre metà schermo (320x112 in orizzontale
   o 160x224 in verticale).
   ============================================================ */
class Camera {
  constructor(levelWidth, levelHeight = CONFIG.SCREEN_H, vertical = false,
              viewW = CONFIG.SCREEN_W, viewH = CONFIG.SCREEN_H) {
    this.x = 0;
    this.y = 0;
    this.levelWidth = levelWidth;
    this.levelHeight = levelHeight;
    this.vertical = vertical;
    this.viewW = viewW;
    this.viewH = viewH;
    this.shake = 0;

    if (vertical) this.y = Math.max(0, levelHeight - viewH);
  }

  follow(target, instant = false) {
    let dx, dy;
    if (this.vertical) {
      dx = target.x + target.w / 2 - this.viewW / 2;
      dy = target.y + target.h / 2 - this.viewH * 0.6;
    } else {
      dx = target.x + target.w / 2 - this.viewW * 0.38;
      // Anche in orizzontale seguiamo la Y: serve nello split screen,
      // dove il viewport è alto la metà del livello. Il clamp sotto
      // riporta y a 0 quando il viewport copre l'intera altezza.
      dy = target.y + target.h / 2 - this.viewH * 0.6;
    }
    if (instant) { this.x = dx; this.y = dy; }
    else {
      this.x += (dx - this.x) * CONFIG.CAMERA_LERP;
      this.y += (dy - this.y) * CONFIG.CAMERA_LERP;
    }
    this.x = Math.max(0, Math.min(this.x, this.levelWidth  - this.viewW));
    this.y = Math.max(0, Math.min(this.y, Math.max(0, this.levelHeight - this.viewH)));
    if (this.shake > 0) this.shake *= 0.85;
  }

  addShake(amount) { this.shake = Math.min(6, this.shake + amount); }

  get ox() { return Math.round(this.x + (Math.random() - 0.5) * this.shake); }
  get oy() { return Math.round(this.y + (Math.random() - 0.5) * this.shake); }
}
