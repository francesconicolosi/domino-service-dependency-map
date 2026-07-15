/* ============================================================
   FLAG — bandiera in cima alla Torre Eiffel. Al contatto di
   un giocatore scatta il jingle e la vittoria. Sventola
   alternando due frame.
   ============================================================ */
class Flag extends Entity {
  constructor(x, y) {
    super(x, y, 20, 34);
    this.t = 0;
    this.touched = false;
  }

  update(game) {
    this.t++;
    if (!this.touched && game.players.some(pl => !pl.gone && this.overlaps(pl))) {
      this.touched = true;
      game.audio.sfxGoal();
      game.audio.stopMusic();
      setTimeout(() => game.levelComplete(), 900);
    }
  }

  draw(ctx, cam) {
    const frame = Math.floor(this.t / 12) % 2;
    ctx.drawImage(game.sprites.get('flag' + frame),
      Math.round(this.x - cam.ox), Math.round(this.y - cam.oy));
  }
}
