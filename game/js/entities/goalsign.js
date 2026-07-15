/* ============================================================
   GOALSIGN — il cartello di fine livello 1. Quando un
   giocatore lo tocca, gira su se stesso e fa partire il
   jingle di vittoria, poi la schermata di completamento.
   ============================================================ */
class GoalSign extends Entity {
  constructor(x, y) {
    super(x, y, 18, 26);
    this.spinning = false;
    this.spinT = 0;
    this.frame = 0;
    this.done = false;
  }

  update(game) {
    if (!this.spinning && game.players.some(pl => !pl.gone && this.overlaps(pl))) {
      this.spinning = true;
      game.audio.sfxGoal();
      game.audio.stopMusic();
    }
    if (this.spinning && !this.done) {
      this.spinT++;
      const speed = this.spinT < 90 ? 4 : 10;
      this.frame = Math.floor(this.spinT / speed) % 4;
      if (this.spinT > 150) {
        this.frame = 0;
        this.done = true;
        game.levelComplete();
      }
    }
  }

  draw(ctx, cam) {
    const map = [0, 1, 2, 1];
    ctx.drawImage(game.sprites.get('sign' + map[this.frame]),
      Math.round(this.x - cam.ox), Math.round(this.y - cam.oy));
  }
}
