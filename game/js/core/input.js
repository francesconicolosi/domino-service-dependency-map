/* ============================================================
   INPUT — gestione multi-sorgente: tastiera, gamepad USB
   (Gamepad API) e touch su schermo (mobile).

   Mappatura tastiera:
   - 1 GIOCATORE : frecce + WASD, salto Z / SPAZIO / ↑ / W
   - 2 GIOCATORI : G1 = frecce + Z     G2 = WASD + SPAZIO
   Gamepad: pad #0 = giocatore 1, pad #1 = giocatore 2.
            levetta sx / d-pad = movimento, A(0)/B(1) = salto,
            START(9) = conferma nei menu.
   Touch:   pulsanti ◀ ▶ ▲ a schermo (solo 1 giocatore).
   ============================================================ */
class Input {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this.twoPlayers = false;   // impostato dal Game quando parte una partita

    // Stato touch (aggiornato dai listener dei pulsanti a schermo)
    this.touch = { left: false, right: false, jump: false };
    this.touchJumpJust = false;
    this.tapped = false;       // tap generico (per confermare nei menu)

    // Stato gamepad (aggiornato da poll() ogni frame)
    this.padState = [this._emptyPad(), this._emptyPad()];
    this.padJust  = [{}, {}];
    this._padPrev = [this._emptyPad(), this._emptyPad()];

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this._bindTouch();
  }

  _emptyPad() { return { left:false, right:false, up:false, down:false, jump:false, start:false }; }

  /** Collega i pulsanti touch (se presenti nella pagina). */
  _bindTouch() {
    const bind = (id, on, off) => {
      const el = (typeof document.getElementById === 'function') ? document.getElementById(id) : null;
      if (!el || !el.addEventListener) return;
      const start = (e) => { e.preventDefault(); on(); };
      const end   = (e) => { e.preventDefault(); off(); };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end,   { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      // supporto anche mouse (per testare da desktop)
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', () => off());
    };
    bind('tL', () => { this.touch.left = true; },  () => { this.touch.left = false; });
    bind('tR', () => { this.touch.right = true; }, () => { this.touch.right = false; });
    bind('tJ', () => {
      if (!this.touch.jump) this.touchJumpJust = true;
      this.touch.jump = true;
      this.tapped = true;
    }, () => { this.touch.jump = false; });

    // Tap sul canvas = conferma nei menu
    const cv = (typeof document.getElementById === 'function') ? document.getElementById('game') : null;
    if (cv && cv.addEventListener) {
      cv.addEventListener('touchstart', () => { this.tapped = true; }, { passive: true });
      cv.addEventListener('mousedown', () => { this.tapped = true; });
    }
  }

  /** Legge i gamepad collegati. Va chiamato una volta per frame. */
  poll() {
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads)
      ? navigator.getGamepads() : [];
    for (let i = 0; i < 2; i++) {
      const gp = pads && pads[i];
      const s = this._emptyPad();
      if (gp && gp.connected !== false) {
        const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        s.left  = ax < -0.4 || btn(14);
        s.right = ax >  0.4 || btn(15);
        s.up    = ay < -0.5 || btn(12);
        s.down  = ay >  0.5 || btn(13);
        s.jump  = btn(0) || btn(1) || btn(2);
        s.start = btn(9);
      }
      // Edge detection (per i "just pressed" del pad)
      const just = {};
      for (const k of Object.keys(s)) just[k] = s[k] && !this._padPrev[i][k];
      this.padState[i] = s;
      this.padJust[i] = just;
      this._padPrev[i] = s;
    }
  }

  /**
   * Stato di input del giocatore n (0 o 1), tenendo conto della
   * modalità (1 o 2 giocatori) e di tutte le sorgenti.
   */
  player(n) {
    const k = this.keys, j = this.justPressed;
    const pad = this.padState[n], padJ = this.padJust[n];

    if (!this.twoPlayers) {
      // 1 giocatore: tutto controlla il player 0
      if (n !== 0) return { left:false, right:false, jumpHeld:false, jumpPressed:false };
      const pad2 = this.padState[1], padJ2 = this.padJust[1];
      return {
        left:  k['ArrowLeft'] || k['KeyA'] || pad.left || pad2.left || this.touch.left,
        right: k['ArrowRight'] || k['KeyD'] || pad.right || pad2.right || this.touch.right,
        jumpHeld: k['Space'] || k['KeyZ'] || k['ArrowUp'] || k['KeyW'] || pad.jump || pad2.jump || this.touch.jump,
        jumpPressed: j['Space'] || j['KeyZ'] || j['ArrowUp'] || j['KeyW'] || padJ.jump || padJ2.jump || this.touchJumpJust,
      };
    }

    // 2 giocatori: tastiere separate + pad dedicati
    if (n === 0) {
      return {
        left:  k['ArrowLeft'] || pad.left,
        right: k['ArrowRight'] || pad.right,
        jumpHeld: k['KeyZ'] || k['ArrowUp'] || pad.jump,
        jumpPressed: j['KeyZ'] || j['ArrowUp'] || padJ.jump,
      };
    }
    return {
      left:  k['KeyA'] || pad.left,
      right: k['KeyD'] || pad.right,
      jumpHeld: k['Space'] || k['KeyW'] || pad.jump,
      jumpPressed: j['Space'] || j['KeyW'] || padJ.jump,
    };
  }

  /* ---- Navigazione dei menu (title screen, schermate) ---- */
  get menuUp()   { return this.justPressed['ArrowUp'] || this.justPressed['KeyW'] || this.padJust[0].up || this.padJust[1].up; }
  get menuDown() { return this.justPressed['ArrowDown'] || this.justPressed['KeyS'] || this.padJust[0].down || this.padJust[1].down; }
  get confirm()  {
    return this.justPressed['KeyZ'] || this.justPressed['Space'] || this.justPressed['Enter'] ||
           this.padJust[0].jump || this.padJust[0].start ||
           this.padJust[1].jump || this.padJust[1].start ||
           this.tapped;
  }

  get mute()    { return this.justPressed['KeyM']; }
  get restart() { return this.justPressed['KeyR']; }

  /** Va chiamato a fine frame per resettare i "just pressed". */
  endFrame() {
    this.justPressed = {};
    this.touchJumpJust = false;
    this.tapped = false;
  }
}
