/* ============================================================
   ROCK — masso lanciato dal Siren Head. Traiettoria balistica,
   rotazione visiva, danno al contatto con qualsiasi giocatore.
   Si rompe sulle piattaforme o uscendo dal mondo.
   ============================================================ */
class Rock extends Entity {
  constructor(x, y, vx, vy) {
    super(x, y, 10, 10);
    this.vx = vx;
    this.vy = vy;
    this.angle = 0;
  }

  update(game) {
    this.vy += CONFIG.ROCK.GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    this.angle += CONFIG.ROCK.SPIN * Math.sign(this.vx || 1);

    // Colpisce un giocatore?
    for (const pl of game.players) {
      if (!pl.gone && this.overlaps(pl) && pl.hurt(CONFIG.ROCK.DAMAGE)) {
        this.dead = true;
        game.addShake(3);
        game.spawnDust(this.cx, this.cy);
        return;
      }
    }

    // Si rompe sulle piattaforme
    for (const p of game.platforms) {
      if (this.overlaps(p)) {
        this.dead = true;
        game.audio.noise(0.08, 0.08);
        game.spawnDust(this.cx, this.cy);
        return;
      }
    }

    // Fuori dal mondo (coordinate mondo, non schermo: in split screen
    // i giocatori possono essere lontani dalla camera principale)
    if (this.y > game.level.height + 120 ||
        this.x < -60 || this.x > game.level.width + 60) this.dead = true;
  }

  draw(ctx, cam) {
    const spr = game.sprites.get('rock');
    ctx.save();
    ctx.translate(Math.round(this.cx - cam.ox), Math.round(this.cy - cam.oy));
    ctx.rotate(this.angle);
    ctx.drawImage(spr, -5, -5);
    ctx.restore();
  }
}
