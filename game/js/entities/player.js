/* ============================================================
   PLAYER — il protagonista (skibidi toilet). Gestisce:
   - movimento con accelerazione/attrito e salto
   - collisioni con le piattaforme (solo dall'alto)
   - 10 punti vita, invulnerabilità lampeggiante dopo un colpo
   - caduta nel vuoto: -1 vita e respawn all'ultimo checkpoint

   In modalità 2 giocatori esistono due istanze: index 0 e 1.
   Il giocatore 2 ha una skin ricolorata (WC blu) per
   distinguersi. Un giocatore a 0 HP è "gone": scompare e
   la partita continua finché resta vivo l'altro.
   ============================================================ */
class Player extends Entity {
  constructor(x, y, index = 0) {
    super(x, y, 12, 18);
    this.index = index;         // 0 = giocatore 1, 1 = giocatore 2
    this.hp = CONFIG.PLAYER.MAX_HP;
    this.gone = false;          // true quando hp=0 (fuori partita)
    this.onGround = false;
    this.facing = 1;
    this.invuln = 0;
    this.animT = 0;
    this.checkpoint = { x, y };
  }

  update(game) {
    if (this.gone) return;
    const P = CONFIG.PLAYER;
    const inp = game.input.player(this.index);

    /* --- Input orizzontale --- */
    if (inp.left)  { this.vx -= P.ACCEL; this.facing = -1; }
    if (inp.right) { this.vx += P.ACCEL; this.facing = 1; }
    if (!inp.left && !inp.right) {
      if (this.vx > 0) this.vx = Math.max(0, this.vx - P.FRICTION);
      if (this.vx < 0) this.vx = Math.min(0, this.vx + P.FRICTION);
    }
    this.vx = Math.max(-P.SPEED, Math.min(P.SPEED, this.vx));

    /* --- Salto --- */
    if (inp.jumpPressed && this.onGround) {
      this.vy = -P.JUMP_FORCE;
      this.onGround = false;
      game.audio.sfxJump();
    }
    if (!inp.jumpHeld && this.vy < -2) this.vy = -2;

    /* --- Gravità --- */
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);

    /* --- Movimento + collisioni --- */
    this.x += this.vx;
    this.x = Math.max(0, Math.min(this.x, game.level.width - this.w));

    const prevBottom = this.y + this.h;
    this.y += this.vy;
    this.onGround = false;

    for (const p of game.platforms) {
      if (this.vy >= 0 && prevBottom <= p.y + 1 && this.overlaps(p)) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
        const safeX = Math.max(p.x + 2, Math.min(this.x, p.x + p.w - this.w - 2));
        this.checkpoint = { x: safeX, y: this.y - 4 };
      }
    }

    /* --- Caduta nel vuoto --- */
    const fell = game.level.vertical
      ? this.y > this.checkpoint.y + 200
      : this.y > CONFIG.DEATH_Y;
    if (fell) {
      game.audio.sfxFall();
      this.hurt(CONFIG.FALL_DAMAGE, true);
      this.respawn();
      game.addShake(4);
    }

    if (this.invuln > 0) this.invuln--;
    this.animT += Math.abs(this.vx) * 0.25;
  }

  /**
   * Applica danno. Ritorna true se il danno è stato inflitto
   * (false se eravamo invulnerabili: il masso non si rompe).
   */
  hurt(amount, force = false) {
    if (this.gone) return false;
    if (this.invuln > 0 && !force) return false;
    this.hp -= amount;
    this.invuln = CONFIG.PLAYER.INVULN_TIME;
    game.audio.sfxHit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.gone = true;
      // Game over solo se TUTTI i giocatori sono fuori
      if (game.players.every(p => p.gone)) game.gameOver();
    }
    return true;
  }

  respawn() {
    this.x = this.checkpoint.x;
    this.y = this.checkpoint.y;
    this.vx = 0;
    this.vy = 0;
  }

  draw(ctx, cam) {
    if (this.gone) return;
    if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) return;

    let name;
    if (!this.onGround) name = 'playerJump';
    else if (Math.abs(this.vx) > 0.2) name = Math.floor(this.animT) % 2 ? 'player2' : 'player1';
    else name = 'player1';
    if (this.facing === -1) name += 'L';
    // Skin del giocatore 2 (WC blu)
    if (this.index === 1) name = 'p2_' + name;

    ctx.drawImage(game.sprites.get(name),
      Math.round(this.x - 2 - cam.ox), Math.round(this.y - cam.oy));
  }
}
