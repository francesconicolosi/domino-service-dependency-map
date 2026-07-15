/* ============================================================
   ENTITY — classe base per tutti gli oggetti di gioco.
   Fornisce posizione, dimensioni, velocità e collisione AABB.
   Ogni entità implementa update(game) e draw(ctx, cam).
   ============================================================ */
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false; // se true, viene rimossa dal gioco
  }

  /** Collisione rettangolo-rettangolo. */
  overlaps(other) {
    return this.x < other.x + other.w &&
           this.x + this.w > other.x &&
           this.y < other.y + other.h &&
           this.y + this.h > other.y;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(game) {}
  draw(ctx, cam) {}
}
