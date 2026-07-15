/* ============================================================
   SIRENHEAD — la creatura che incombe sullo sfondo.

   Modalità di posizionamento:
   - livello ORIZZONTALE: cammina/ondeggia sullo sfondo dietro
     al giocatore (parallasse). Massi che partono dall'alto
     dello schermo, mirati un po' davanti al giocatore.
   - livello VERTICALE (Torre Eiffel): sta al di fuori della
     torre, a un'altezza intermedia rispetto alla camera,
     grandissimo e minaccioso. Lancia massi da un lato che
     attraversano lo schermo verso il giocatore.
   ============================================================ */
class SirenHead extends Entity {
  constructor() {
    super(0, 0, 30, 64);
    this.throwTimer = 100;
    this.sirenTimer = 300;
    this.sway = 0;
    this.lightT = 0;
    this.armRaise = 0;
  }

  update(game) {
    this.sway += 0.02;
    this.lightT += 0.15;
    if (this.armRaise > 0) this.armRaise--;

    if (game.level.vertical) {
      // Sta accanto alla torre, sul lato sinistro dello schermo,
      // ben visibile ma non davanti alle piattaforme.
      this.x = game.camera.x - 8 + Math.sin(this.sway) * 4;
      this.y = game.camera.y + 40 + Math.sin(this.sway * 1.7) * 3;
    } else {
      const px = CONFIG.SIREN.PARALLAX;
      this.x = game.camera.x * px + 190 + Math.sin(this.sway) * 6;
      this.y = 28 + Math.sin(this.sway * 1.7) * 3;
    }

    if (--this.sirenTimer <= 0) {
      game.audio.sfxSiren();
      this.sirenTimer = 400 + Math.random() * 400;
    }

    if (--this.throwTimer <= 0 && !game.finished) {
      this.throwRock(game);
      this.throwTimer = CONFIG.SIREN.THROW_EVERY_MIN +
        Math.random() * (CONFIG.SIREN.THROW_EVERY_MAX - CONFIG.SIREN.THROW_EVERY_MIN);
    }
  }

  /** Calcola una traiettoria che ricade vicino a un giocatore
      scelto a caso tra quelli ancora in gioco. */
  throwRock(game) {
    this.armRaise = 30;
    game.audio.sfxThrow();

    // Bersaglio: un giocatore vivo a caso
    const alive = game.players.filter(p => !p.gone);
    if (alive.length === 0) return;
    const target = alive[Math.floor(Math.random() * alive.length)];

    let startX, startY, vx, vy;

    if (game.level.vertical) {
      // I massi arrivano da SINISTRA e volano verso il bersaglio.
      // Partono un po' sopra il bersaglio (non dalla camera: in split
      // screen i giocatori possono essere ad altezze molto diverse).
      startX = Math.max(-20, target.cx - 340);
      startY = target.cy - 60 - Math.random() * 60;

      const dx = target.cx - startX;
      const dy = target.cy - startY;
      vx = 2.2 + Math.random() * 0.6;
      const t = Math.max(20, dx / vx);
      vy = (dy - 0.5 * CONFIG.ROCK.GRAVITY * t * t) / t;
    } else {
      // Livello orizzontale: pioggia di massi dall'alto, mirati davanti
      startX = target.cx + (Math.random() * 120 - 60);
      startY = -10;
      const aimX = target.cx + Math.sign(target.vx || 1) * CONFIG.SIREN.AIM_AHEAD * Math.random();
      const dx = aimX - startX;
      vx = Math.max(-2.4, Math.min(2.4, dx / 90)) + (Math.random() * 0.6 - 0.3);
      vy = CONFIG.SIREN.ROCK_SPEED_Y * (0.3 + Math.random() * 0.3);
    }

    game.rocks.push(new Rock(startX, startY, vx, vy));
  }

  draw(ctx, cam) {
    // Nel livello verticale disegno il Siren Head molto più grande
    // (accanto alla torre) e senza scaling della camera.
    if (game.level.vertical) {
      const w = 60, h = 128; // 2x
      const sx = Math.round(this.x - cam.ox);
      const sy = Math.round(this.y - cam.oy - (this.armRaise > 0 ? 2 : 0));
      ctx.drawImage(game.sprites.get('siren'), sx, sy, w, h);
      // luci degli altoparlanti
      if (Math.sin(this.lightT) > 0) {
        ctx.fillStyle = 'rgba(255,216,58,0.85)';
        ctx.fillRect(sx + 2,  sy + 2, 6, 4);
        ctx.fillRect(sx + 44, sy + 8, 6, 4);
      }
      return;
    }

    // Livello orizzontale: parallasse + scala 2x
    const sx = Math.round(this.x - cam.ox * CONFIG.SIREN.PARALLAX);
    const sy = Math.round(this.y - (this.armRaise > 0 ? 2 : 0));
    ctx.drawImage(game.sprites.get('siren'), sx, sy, 60, 128);

    if (Math.sin(this.lightT) > 0) {
      ctx.fillStyle = 'rgba(255,216,58,0.85)';
      ctx.fillRect(sx + 2,  sy + 2, 4, 3);
      ctx.fillRect(sx + 44, sy + 8, 4, 3);
    }
  }
}
