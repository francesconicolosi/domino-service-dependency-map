/* ============================================================
   MAIN — punto di ingresso: crea l'istanza globale `game`
   e fa girare il loop con requestAnimationFrame, bloccato
   a 60 aggiornamenti al secondo per una fisica stabile.
   Attiva i controlli touch sui dispositivi mobili.
   ============================================================ */
let game;

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  game = new Game(canvas);

  // Su dispositivi touch: mostra i pulsanti a schermo e
  // l'overlay "ruota il telefono" quando in verticale.
  if (game.isMobile && document.body && document.body.classList) {
    document.body.classList.add('touch');
  }

  // Sblocca l'audio al primo gesto (regola dei browser)
  const unlock = () => { game.audio.unlock(); };
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });

  // Loop a passo fisso: la fisica gira sempre a 60 tick/s
  const STEP = 1000 / 60;
  let last = performance.now();
  let acc = 0;

  function loop(now) {
    acc += Math.min(now - last, 100);
    last = now;
    while (acc >= STEP) {
      game.update();
      acc -= STEP;
    }
    game.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
