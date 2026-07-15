/* ============================================================
   GAME — stato, entità, aggiornamento, rendering e progressione.

   Novità di questa versione:
   - Title screen "SKIBIDI TOILET vs SIREN HEAD" con menu
     1 GIOCATORE / 2 GIOCATORI (2P non disponibile su mobile)
   - Modalità 2 giocatori a schermo condiviso: il GIOCATORE 1
     conduce la telecamera; se il giocatore 2 esce
     dall'inquadratura, lo schermo si DIVIDE in due viewport
     (sopra/sotto nei livelli orizzontali, sinistra/destra in
     quelli verticali) e si riunisce quando i due si riavvicinano.
   - Rendering rifattorizzato: drawScene() disegna il mondo in
     un viewport arbitrario con una camera arbitraria.
   ============================================================ */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.sprites = new Sprites();
    this.sprites.buildAll();
    this.audio = new ChipAudio();
    this.input = new Input();

    // Rilevamento mobile/touch: su mobile la modalità 2P è nascosta
    this.isMobile = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
                    (typeof window !== 'undefined' && 'ontouchstart' in window);

    this.levels = [LEVEL_1, LEVEL_2];
    this.currentLevel = 0;

    this.twoPlayers = false;
    this.menuIndex = 0;         // voce selezionata nel menu del titolo

    this.state = 'title'; // 'title' | 'play' | 'over' | 'win' | 'levelDone'
    this.reset();
  }

  /** (Ri)costruisce il mondo dal livello corrente. */
  reset() {
    const data = this.levels[this.currentLevel];
    this.level = new Level(data);
    this.camera = new Camera(this.level.width, this.level.height, this.level.vertical);

    // Camere per lo split screen (create al bisogno)
    this.split = false;
    this.camP1 = null;
    this.camP2 = null;

    this.platforms = [];
    this.entities = [];
    this.rocks = [];
    this.particles = [];

    // Posizioni di partenza
    let px = CONFIG.PLAYER.START_X, py = CONFIG.PLAYER.START_Y;
    if (this.level.vertical) {
      const [sx, sy] = data.playerStart || [this.level.width / 2 - 6, null];
      px = sx;
      const groundY = (data.heightTiles - 2) * 16;
      py = sy !== null ? sy : groundY - 20;
    }
    this.players = [new Player(px, py, 0)];
    if (this.twoPlayers) this.players.push(new Player(px + 20, py, 1));

    this.siren = new SirenHead();
    this.level.build(this);

    this.coins = 0;
    this.finished = false;
    this.time = 0;
  }

  /** Comodo alias: il "giocatore principale" (per compatibilità). */
  get player() { return this.players[0]; }

  /** Tremolio su tutte le camere attive. */
  addShake(amount) {
    this.camera.addShake(amount);
    if (this.camP1) this.camP1.addShake(amount);
    if (this.camP2) this.camP2.addShake(amount);
  }

  /* ------------------ Eventi di gioco ------------------ */

  levelComplete() {
    this.finished = true;
    this.state = (this.currentLevel < this.levels.length - 1) ? 'levelDone' : 'win';
  }

  gameOver() {
    this.audio.stopMusic();
    this.finished = true;
    this.state = 'over';
  }

  startPlay() {
    this.currentLevel = 0;
    this.input.twoPlayers = this.twoPlayers;
    this.reset();
    this.state = 'play';
    this.audio.unlock();
    this.audio.startMusic();
  }

  nextLevel() {
    this.currentLevel++;
    this.reset();
    this.state = 'play';
    this.audio.startMusic();
  }

  /* ------------------ Particelle ------------------ */

  spawnSparkle(x, y) {
    for (let i = 0; i < 6; i++) this.particles.push({
      x, y, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2 - 1,
      life: 20, color: '#ffd83a',
    });
  }

  spawnDust(x, y) {
    for (let i = 0; i < 8; i++) this.particles.push({
      x, y, vx: (Math.random() - .5) * 2.5, vy: (Math.random() - .5) * 2.5,
      life: 18, color: '#b0a08c',
    });
  }

  /* ------------------ Update ------------------ */

  update() {
    this.input.poll(); // legge i gamepad

    if (this.input.mute) this.audio.toggle();
    if (this.input.restart && this.state === 'play') this.startPlay();

    if (this.state !== 'play') {
      this.updateMenus();
      this.input.endFrame();
      this.time++;
      return;
    }

    this.time++;
    for (const pl of this.players) pl.update(this);
    this.siren.update(this);

    for (const e of this.entities) e.update(this);
    for (const r of this.rocks) r.update(this);

    this.entities = this.entities.filter(e => !e.dead);
    this.rocks = this.rocks.filter(r => !r.dead);

    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    this.updateCameras();
    this.input.endFrame();
  }

  /** Navigazione dei menu (titolo e schermate di passaggio). */
  updateMenus() {
    if (this.state === 'title') {
      const options = this.menuOptionCount();
      if (this.input.menuUp)   this.menuIndex = (this.menuIndex + options - 1) % options;
      if (this.input.menuDown) this.menuIndex = (this.menuIndex + 1) % options;
      if (this.input.confirm) {
        this.twoPlayers = (this.menuIndex === 1) && !this.isMobile;
        this.startPlay();
      }
      return;
    }
    // over / win / levelDone
    if (this.input.confirm) {
      if (this.state === 'levelDone') this.nextLevel();
      else { this.state = 'title'; this.menuIndex = 0; }
    }
  }

  menuOptionCount() { return this.isMobile ? 1 : 2; }

  /** Logica della camera: singola (P1 conduce) o split dinamico. */
  updateCameras() {
    const p1 = this.players[0];
    const p2 = this.players[1];

    // La camera principale segue SEMPRE il giocatore 1
    this.camera.follow(p1.gone && p2 && !p2.gone ? p2 : p1);

    if (!this.twoPlayers || !p2 || p1.gone || p2.gone) {
      this.split = false;
      return;
    }

    const dx = Math.abs(p1.cx - p2.cx);
    const dy = Math.abs(p1.cy - p2.cy);

    if (!this.split) {
      // P2 è uscito dall'inquadratura della camera di P1?
      const off =
        p2.cx < this.camera.x + 8 || p2.cx > this.camera.x + CONFIG.SCREEN_W - 8 ||
        p2.cy < this.camera.y - 8 || p2.cy > this.camera.y + CONFIG.SCREEN_H + 8;
      if (off) this.enterSplit();
    } else {
      // I giocatori si sono riavvicinati abbastanza da stare in un
      // unico schermo? (con margine per evitare flip-flop continui)
      if (dx < CONFIG.SCREEN_W * 0.55 && dy < CONFIG.SCREEN_H * 0.55) {
        this.split = false;
        this.camP1 = this.camP2 = null;
        this.camera.follow(this.players[0], true);
      } else {
        this.camP1.follow(this.players[0]);
        this.camP2.follow(this.players[1]);
      }
    }
  }

  /** Attiva lo split screen creando le due mezze-camere. */
  enterSplit() {
    this.split = true;
    const L = this.level;
    let vw, vh;
    if (L.vertical) { vw = CONFIG.SCREEN_W / 2; vh = CONFIG.SCREEN_H; }  // sinistra/destra
    else            { vw = CONFIG.SCREEN_W; vh = CONFIG.SCREEN_H / 2; }  // sopra/sotto
    this.camP1 = new Camera(L.width, L.height, L.vertical, vw, vh);
    this.camP2 = new Camera(L.width, L.height, L.vertical, vw, vh);
    this.camP1.follow(this.players[0], true);
    this.camP2.follow(this.players[1], true);
  }

  /* ------------------ Draw ------------------ */

  draw() {
    const c = this.ctx, W = CONFIG.SCREEN_W, H = CONFIG.SCREEN_H;

    if (this.split && this.camP1 && this.camP2) {
      if (this.level.vertical) {
        // Verticale: split sinistra/destra
        this.drawScene(c, this.camP1, 0, 0, W / 2, H);
        this.drawScene(c, this.camP2, W / 2, 0, W / 2, H);
        c.fillStyle = '#141020';
        c.fillRect(W / 2 - 1, 0, 2, H);
        this.drawText(c, 'P1', 4, H - 12, '#ffd83a');
        this.drawText(c, 'P2', W / 2 + 4, H - 12, '#9ab8e8');
      } else {
        // Orizzontale: split sopra/sotto
        this.drawScene(c, this.camP1, 0, 0, W, H / 2);
        this.drawScene(c, this.camP2, 0, H / 2, W, H / 2);
        c.fillStyle = '#141020';
        c.fillRect(0, H / 2 - 1, W, 2);
        this.drawText(c, 'P1', 4, H / 2 - 12, '#ffd83a');
        this.drawText(c, 'P2', 4, H - 12, '#9ab8e8');
      }
    } else {
      this.drawScene(c, this.camera, 0, 0, W, H);
    }

    this.drawHUD(c);

    if (this.state === 'title')     this.drawTitle(c);
    if (this.state === 'over')      this.drawCenterText(c, 'GAME OVER', 'Z per tornare al titolo', '#e84848');
    if (this.state === 'win')       this.drawCenterText(c, 'HAI VINTO!', `monete: ${this.coins} — Z per il titolo`, '#ffd83a');
    if (this.state === 'levelDone') this.drawCenterText(c, 'LIVELLO 1 COMPLETATO', 'Z per la Torre Eiffel', '#67c85f');
  }

  /** Disegna il mondo in un viewport (vx,vy,vw,vh) con la camera data. */
  drawScene(c, cam, vx, vy, vw, vh) {
    c.save();
    c.beginPath();
    c.rect(vx, vy, vw, vh);
    c.clip();
    c.translate(vx, vy);

    if (this.level.vertical) this.drawEiffelBackground(c, cam, vw, vh);
    else this.drawBackground(c, cam, vw, vh);

    this.siren.draw(c, cam);

    for (const p of this.platforms) p.draw(c, cam);
    for (const e of this.entities) e.draw(c, cam);
    for (const r of this.rocks) r.draw(c, cam);
    for (const pl of this.players) pl.draw(c, cam);

    for (const p of this.particles) {
      c.fillStyle = p.color;
      c.globalAlpha = p.life / 20;
      c.fillRect(Math.round(p.x - cam.ox), Math.round(p.y - cam.oy), 2, 2);
    }
    c.globalAlpha = 1;

    c.restore();
  }

  /** Sfondo livello 1: notte con colline. Parametrizzato su camera e viewport. */
  drawBackground(c, cam, W, H) {
    const bands = ['#150c2a', '#1b1033', '#241546', '#2f1c58', '#3b246a', '#4a2c6e'];
    const bh = Math.ceil(H / bands.length);
    bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * bh, W, bh); });

    c.fillStyle = '#8a7ab8';
    for (let i = 0; i < 40; i++) {
      const x = (i * 53 + 17) % W, y = (i * 37 + 11) % Math.max(40, H * 0.4);
      c.fillRect(x, y, 1, 1);
    }

    c.fillStyle = '#e8e0c8';
    c.beginPath(); c.arc(W - 58, 34, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c8bfa5';
    c.fillRect(W - 64, 30, 3, 3); c.fillRect(W - 55, 38, 4, 3); c.fillRect(W - 60, 41, 2, 2);

    this.drawHills(c, cam, W, H, CONFIG.COLORS.HILLS_FAR,  0.15, H * 0.67, 55, 90);
    this.drawHills(c, cam, W, H, CONFIG.COLORS.HILLS_NEAR, 0.3,  H * 0.75, 40, 60);

    c.fillStyle = 'rgba(106,74,147,0.25)';
    c.fillRect(0, H * 0.79, W, 18);
  }

  drawHills(c, cam, W, H, color, parallax, baseY, amp, wavelen) {
    const off = cam.x * parallax;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const wx = x + off;
      const y = baseY - Math.abs(Math.sin(wx / wavelen)) * amp;
      c.lineTo(x, y);
    }
    c.lineTo(W, H);
    c.closePath();
    c.fill();
  }

  /** Sfondo livello 2: cielo parigino + silhouette città + Torre Eiffel. */
  drawEiffelBackground(c, cam, W, H) {
    const bands = ['#0a0620', '#100a2e', '#171040', '#1e1454', '#2a1c68', '#3a2680'];
    const bh = Math.ceil(H / bands.length);
    bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * bh, W, bh); });

    c.fillStyle = '#c8b8e8';
    for (let i = 0; i < 60; i++) {
      const x = (i * 47 + 13) % W;
      const y = (i * 29 + 7)  % Math.max(40, H - 40);
      c.fillRect(x, y, 1, 1);
    }

    c.fillStyle = '#f4ecd0';
    c.beginPath(); c.arc(38, 32, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c8bfa5';
    c.fillRect(34, 28, 2, 2); c.fillRect(42, 34, 3, 2);

    // Silhouette città (parallasse leggera con la camera Y)
    const cityBaseY = H - 40;
    const off = (cam.y * 0.15) % 40;
    c.fillStyle = '#0f0a26';
    for (let x = -40; x < W + 40; x += 20) {
      const h = 14 + ((x * 7 + 11) % 20);
      c.fillRect(x + off, cityBaseY - h, 16, h + 40);
      c.fillStyle = '#8a6a2a';
      for (let wy = cityBaseY - h + 3; wy < cityBaseY; wy += 4) {
        if (((x + wy) % 7) === 0) c.fillRect(x + off + 4, wy, 2, 2);
      }
      c.fillStyle = '#0f0a26';
    }

    c.fillStyle = 'rgba(80,60,140,0.2)';
    c.fillRect(0, cityBaseY - 4, W, 20);

    this.drawEiffelStructure(c, cam, H);
  }

  /** Silhouette Eiffel: gambe oblique + piani + traverse + archi. */
  drawEiffelStructure(c, cam, H) {
    const midX = this.level.width / 2;
    const camX = cam.ox, camY = cam.oy;

    function halfWidthAt(wy) {
      if (wy < 200)  return 8;
      if (wy < 400)  return 8 + (wy - 200)  / 200 * 18;
      if (wy < 800)  return 26 + (wy - 400)  / 400 * 24;
      if (wy < 1150) return 50 + (wy - 800)  / 350 * 70;
      if (wy < 1408) return 120 + (wy - 1150) / 258 * 200;
      return 320;
    }

    c.fillStyle = 'rgba(15, 8, 36, 0.75)';
    for (let sy = 0; sy < H; sy++) {
      const wy = sy + camY;
      if (wy > 1440) break;
      const hw = halfWidthAt(wy);
      c.fillRect(Math.round(midX - hw - camX), sy, Math.round(hw * 2), 1);
    }

    c.fillStyle = '#5a4478';
    for (let sy = 0; sy < H; sy++) {
      const wy = sy + camY;
      if (wy > 1440) break;
      const hw = halfWidthAt(wy);
      c.fillRect(Math.round(midX - hw - camX) - 1, sy, 4, 1);
      c.fillRect(Math.round(midX + hw - camX) - 3, sy, 4, 1);
    }

    c.fillStyle = '#463460';
    for (let ty = 120; ty < 1408; ty += 80) {
      if (Math.abs(ty - 1150) < 40 || Math.abs(ty - 800) < 40 || Math.abs(ty - 400) < 40) continue;
      const sy = ty - camY;
      if (sy < -2 || sy >= H + 2) continue;
      const hw = halfWidthAt(ty);
      c.fillRect(Math.round(midX - hw + 2 - camX), Math.round(sy), Math.round(hw * 2 - 4), 1);
    }

    c.fillStyle = '#6a5088';
    const floors = [1150, 800, 400];
    for (const fy of floors) {
      const hw = halfWidthAt(fy);
      const sy = fy - camY;
      if (sy > -6 && sy < H + 6) {
        c.fillRect(Math.round(midX - hw - camX), Math.round(sy - 3), Math.round(hw * 2), 2);
        c.fillRect(Math.round(midX - hw - camX), Math.round(sy + 1), Math.round(hw * 2), 2);
      }
    }

    c.fillStyle = '#5a4478';
    for (let ay = 0; ay < 90; ay++) {
      const wy = 1310 + ay;
      if (wy >= 1408) break;
      const sy = wy - camY;
      if (sy < 0 || sy >= H) continue;
      const t = ay / 90;
      const arcOffset = 200 * (1 - Math.sqrt(1 - t * t));
      c.fillRect(Math.round(midX - 300 + arcOffset - camX), Math.round(sy), 3, 1);
      c.fillRect(Math.round(midX + 300 - arcOffset - camX) - 2, Math.round(sy), 3, 1);
    }
  }

  /* ------------------ HUD ------------------ */

  drawHUD(c) {
    if (this.state === 'title') return;
    const W = CONFIG.SCREEN_W;

    // Cuori del giocatore 1 (in alto a sinistra)
    const p1 = this.players[0];
    for (let i = 0; i < CONFIG.PLAYER.MAX_HP; i++) {
      const spr = this.sprites.get(i < p1.hp ? 'heart' : 'heartEmpty');
      c.drawImage(spr, 6 + i * 9, 6);
    }

    // Cuori del giocatore 2 (in alto a destra, se presente)
    if (this.twoPlayers && this.players[1]) {
      const p2 = this.players[1];
      const startX = W - 6 - CONFIG.PLAYER.MAX_HP * 9;
      for (let i = 0; i < CONFIG.PLAYER.MAX_HP; i++) {
        const spr = this.sprites.get(i < p2.hp ? 'heart' : 'heartEmpty');
        c.drawImage(spr, startX + i * 9, 6);
      }
    }

    // Monete (condivise)
    c.drawImage(this.sprites.get('coin0'), 6, 16);
    this.drawText(c, 'x' + String(this.coins).padStart(2, '0'), 19, 18, '#ffd83a');

    // Timer + livello: al centro in 2P, a destra in 1P
    const secs = Math.floor(this.time / 60);
    const tstr = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    if (this.twoPlayers) {
      this.drawText(c, tstr, W / 2 - 10, 8, '#f4f4f0');
      this.drawText(c, 'LV ' + (this.currentLevel + 1), W / 2 - 10, 18, '#c8c8d4');
    } else {
      this.drawText(c, tstr, W - 34, 8, '#f4f4f0');
      this.drawText(c, 'LV ' + (this.currentLevel + 1), W - 34, 18, '#c8c8d4');
    }
  }

  drawText(c, text, x, y, color = '#fff') {
    c.font = '8px monospace';
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.fillStyle = '#141020';
    c.fillText(text, x + 1, y + 1);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  /* ------------------ Title screen ------------------ */

  drawTitle(c) {
    const W = CONFIG.SCREEN_W, H = CONFIG.SCREEN_H;
    c.fillStyle = 'rgba(10,6,20,0.78)';
    c.fillRect(0, 0, W, H);

    // I due contendenti ai lati del titolo
    c.drawImage(this.sprites.get('player1'), 34, 84, 32, 36);
    c.drawImage(this.sprites.get('siren'), 246, 44, 45, 96);

    // Titolo su tre righe
    c.textAlign = 'center';
    c.textBaseline = 'top';

    c.font = 'bold 19px monospace';
    c.fillStyle = '#141020';
    c.fillText('SKIBIDI TOILET', W / 2 + 2, 34);
    c.fillStyle = '#ffd83a';
    c.fillText('SKIBIDI TOILET', W / 2, 32);

    c.font = 'bold 11px monospace';
    c.fillStyle = '#141020';
    c.fillText('— vs —', W / 2 + 1, 58);
    c.fillStyle = '#e84848';
    c.fillText('— vs —', W / 2, 57);

    c.font = 'bold 19px monospace';
    c.fillStyle = '#141020';
    c.fillText('SIREN HEAD', W / 2 + 2, 74);
    c.fillStyle = '#9a86c8';
    c.fillText('SIREN HEAD', W / 2, 72);

    // Menu
    c.font = '10px monospace';
    if (this.isMobile) {
      // Mobile: solo 1 giocatore
      if (Math.floor(this.time / 30) % 2 === 0) {
        c.fillStyle = '#f4f4f0';
        c.fillText('TOCCA PER GIOCARE', W / 2, 140);
      }
      c.font = '7px monospace';
      c.fillStyle = '#7a6f96';
      c.fillText('2 giocatori disponibile solo su desktop', W / 2, 162);
    } else {
      const options = ['1 GIOCATORE', '2 GIOCATORI'];
      options.forEach((opt, i) => {
        const y = 136 + i * 16;
        const sel = this.menuIndex === i;
        c.fillStyle = sel ? '#ffd83a' : '#8a84a8';
        c.fillText((sel ? '> ' : '  ') + opt + (sel ? ' <' : '  '), W / 2, y);
      });
      c.font = '7px monospace';
      c.fillStyle = '#7a6f96';
      c.fillText('frecce = scegli   Z / INVIO / pad = conferma', W / 2, 176);
      c.fillText('2P: G1 frecce+Z   G2 WASD+SPAZIO   (o due gamepad)', W / 2, 188);
    }
    c.textAlign = 'left';
  }

  drawCenterText(c, big, small, color) {
    const W = CONFIG.SCREEN_W, H = CONFIG.SCREEN_H;
    c.fillStyle = 'rgba(10,6,20,0.6)';
    c.fillRect(0, H / 2 - 34, W, 66);

    c.textAlign = 'center';
    c.font = 'bold 14px monospace';
    c.fillStyle = '#141020';
    c.fillText(big, W / 2 + 1, H / 2 - 18);
    c.fillStyle = color;
    c.fillText(big, W / 2, H / 2 - 19);

    c.font = '9px monospace';
    c.fillStyle = '#c8c8d4';
    c.fillText(small, W / 2, H / 2 + 8);
    c.textAlign = 'left';
  }
}
