/* ============================================================
   COIN — moneta collezionabile. Ruota (4 frame) e fluttua.
   Può essere raccolta da qualsiasi giocatore vivo; il
   contatore delle monete è condiviso.
   ============================================================ */
class Coin extends Entity {
  constructor(x, y) {
    super(x, y, 10, 10);
    this.baseY = y;
    this.t = Math.random() * 100;
  }

  update(game) {
    this.t += 0.12;
    this.y = this.baseY + Math.sin(this.t) * 2;

    for (const pl of game.players) {
      if (!pl.gone && this.overlaps(pl)) {
        this.dead = true;
        game.coins++;
        game.audio.sfxCoin();
        game.spawnSparkle(this.cx, this.cy);
        break;
      }
    }
  }

  draw(ctx, cam) {
    const frame = Math.floor(this.t * 1.5) % 4;
    ctx.drawImage(game.sprites.get('coin' + frame),
      Math.round(this.x - cam.ox), Math.round(this.y - cam.oy));
  }
}
