/* ============================================================
   CHIPAUDIO — sintetizzatore 8-bit fatto con la Web Audio API.
   Niente file audio: tutto è generato con oscillatori a onda
   quadra/triangolare + rumore, come i chip sonori delle vecchie
   console (PSG del Master System / canale quadra del NES).

   PER MODIFICARE I SUONI: ogni effetto è un piccolo metodo che
   descrive frequenze e durate. La musica è una sequenza di note
   scritta come stringhe ('C4', 'E4'...) in this.bassLine e
   this.leadLine.
   ============================================================ */
class ChipAudio {
  constructor() {
    this.ctx = null;          // AudioContext (creato al primo input utente)
    this.enabled = true;      // toggle con il tasto M
    this.musicOn = false;
    this._musicTimer = null;
    this._step = 0;

    // Sequenze musicali: 16 step per battuta, '-' = pausa.
    // Cambia queste due righe per riscrivere la colonna sonora!
    this.bassLine = ['A2','-','A2','-','C3','-','A2','-','F2','-','F2','-','G2','-','G2','-'];
    this.leadLine = ['A4','C5','E5','C5','A4','-','E4','-','F4','A4','C5','A4','G4','-','B4','-'];
  }

  /** L'AudioContext può partire solo dopo un gesto dell'utente. */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; } // browser senza Web Audio: gioco muto
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() { this.enabled = !this.enabled; return this.enabled; }

  /** Converte 'C4' in frequenza (Hz). */
  noteFreq(note) {
    const NOTES = { C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11 };
    const name = note.slice(0, -1), oct = parseInt(note.slice(-1));
    return 440 * Math.pow(2, (NOTES[name] + (oct - 4) * 12 - 9) / 12);
  }

  /** Nota singola: il mattoncino di tutti i suoni. */
  beep(freq, dur, type = 'square', vol = 0.18, slide = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur);
  }

  /** Rumore bianco breve (per impatti). */
  noise(dur, vol = 0.2) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g); g.connect(this.master);
    src.start(t);
  }

  /* ------- Effetti sonori di gioco ------- */
  sfxJump()  { this.beep(220, 0.18, 'square', 0.15, +330); }
  sfxCoin()  { this.beep(988, 0.07, 'square', 0.14); setTimeout(() => this.beep(1319, 0.22, 'square', 0.14), 70); }
  sfxHit()   { this.beep(180, 0.25, 'sawtooth', 0.2, -120); this.noise(0.15, 0.15); }
  sfxThrow() { this.beep(90, 0.3, 'triangle', 0.18, -40); }
  sfxFall()  { this.beep(400, 0.5, 'square', 0.15, -350); }
  sfxSiren() { this.beep(520, 0.9, 'triangle', 0.05, +180); } // lamento lontano
  sfxGoal()  {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => setTimeout(() => this.beep(f, 0.16, 'square', 0.16), i * 110));
  }

  /* ------- Musica di sottofondo (loop) ------- */
  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const stepDur = 60 / CONFIG.MUSIC_BPM / 2 * 1000; // sedicesimi swing-free
    this._musicTimer = setInterval(() => {
      if (!this.enabled) return;
      const b = this.bassLine[this._step % 16];
      const l = this.leadLine[this._step % 16];
      if (b !== '-') this.beep(this.noteFreq(b), 0.14, 'triangle', 0.13);
      if (l !== '-') this.beep(this.noteFreq(l), 0.10, 'square', 0.05);
      // "hi-hat" di rumore ogni 2 step
      if (this._step % 2 === 0) this.noise(0.02, 0.03);
      this._step++;
    }, stepDur);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this._musicTimer);
  }
}
