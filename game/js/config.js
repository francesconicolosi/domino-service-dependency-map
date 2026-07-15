/* ============================================================
   CONFIG — tutti i numeri "magici" del gioco in un posto solo.
   Modifica qui per bilanciare il gameplay senza toccare le classi.
   ============================================================ */
const CONFIG = {

  // --- Schermo (risoluzione interna stile Mega Drive) ---
  SCREEN_W: 320,
  SCREEN_H: 224,

  // --- Fisica ---
  GRAVITY: 0.28,          // gravità applicata ogni frame
  MAX_FALL: 6.0,          // velocità massima di caduta

  // --- Giocatore ---
  PLAYER: {
    SPEED: 1.9,           // velocità orizzontale
    ACCEL: 0.25,          // accelerazione
    FRICTION: 0.35,       // attrito quando non premi nulla
    JUMP_FORCE: 7.0,      // spinta del salto (più alto = salta più su)
    MAX_HP: 10,           // punti vita
    INVULN_TIME: 90,      // frame di invulnerabilità dopo un colpo (60 = 1s)
    START_X: 40,
    START_Y: 140,
  },

  // --- Siren Head (il nemico sullo sfondo) ---
  SIREN: {
    THROW_EVERY_MIN: 110, // frame minimi tra un lancio e l'altro
    THROW_EVERY_MAX: 190, // frame massimi
    ROCK_SPEED_X: 1.4,    // velocità orizzontale media dei massi
    ROCK_SPEED_Y: -3.2,   // spinta verticale iniziale (negativa = verso l'alto)
    AIM_AHEAD: 60,        // quanto "anticipa" il giocatore (px)
    PARALLAX: 0.35,       // velocità di scorrimento rispetto alla camera
  },

  // --- Massi ---
  ROCK: {
    DAMAGE: 1,            // danni per colpo
    GRAVITY: 0.11,        // i massi cadono più "lenti" per essere leggibili
    SPIN: 0.08,           // rotazione visiva
  },

  // --- Cadute ---
  FALL_DAMAGE: 1,         // vita persa cadendo nel vuoto
  DEATH_Y: 260,           // sotto questa Y il giocatore è "caduto"

  // --- Camera ---
  CAMERA_LERP: 0.12,      // morbidezza inseguimento (0..1)

  // --- Audio ---
  MUSIC_BPM: 132,
  MASTER_VOLUME: 0.5,

  // --- Palette globale (ispirata ai 61 colori su schermo del Genesis) ---
  COLORS: {
    SKY_TOP: '#1b1033',
    SKY_BOTTOM: '#4a2c6e',
    HILLS_FAR: '#2c1d4d',
    HILLS_NEAR: '#3d2a63',
    FOG: '#6a4a93',
  },
};
