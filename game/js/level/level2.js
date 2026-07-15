/* ============================================================
   LEVEL 2 — Scala la Torre Eiffel.

   Livello VERTICALE: si sale dal basso verso l'alto per
   raggiungere la bandiera in cima. Il Siren Head incombe
   dal lato sinistro e lancia massi orizzontalmente.

   La torre si stringe salendo. Le piattaforme sono a ZIGZAG
   regolare, larghe e con ampia sovrapposizione orizzontale
   con la successiva: sempre saltabili con un salto pieno.

   Convenzione: y=0 in alto. Livello alto 90 tile (1440 px),
   pavimento a riga 88.

   Formati:
   ground:      [colonnaInizio, larghezzaInTile]
   platforms:   [colonna, riga, larghezzaInTile]
   coins:       [colonna, riga]
   coinRows:    [colonna, riga, quante]
   playerStart: [x_px, y_px]  ( y_px null => sopra il pavimento )
   flag:        [colonna, riga]
   ============================================================ */
const LEVEL_2 = {
  widthTiles: 40,
  heightTiles: 90,
  vertical: true,

  playerStart: [180, null],

  ground: [
    [0, 40],
  ],

  // Zigzag regolare: piattaforme larghe 8 tile alla base che si
  // restringono a 5 in cima. Distanza verticale 3 righe (48 px).
  // Sovrapposizione orizzontale con la successiva: almeno 3 tile.
  platforms: [
    // === base (tile larghi 8) ===
    [4, 84, 8],                        // L (x=64-192)
    [12, 81, 8],                       // R (x=192-320, sovrappone L per 0)
    [4, 78, 8],                        // L
    [12, 75, 8],                       // R
    [5, 72, 7],                        // L (x=80-192)
    [13, 69, 7],                       // R (x=208-320)
    [6, 66, 6],                        // L (x=96-192)
    [14, 63, 6],                       // R (x=224-320)
    [7, 60, 6],                        // L
    [14, 57, 6],                       // R
    [8, 54, 6],                        // L
    [14, 51, 6],                       // R
    [9, 48, 5],                        // L (x=144-224)
    [14, 45, 5],                       // R (x=224-304)
    [10, 42, 5],                       // L
    [14, 39, 5],                       // R
    [10, 36, 5],                       // L
    [14, 33, 5],                       // R
    [11, 30, 5],                       // L
    [14, 27, 5],                       // R
    [12, 24, 5],                       // L (x=192-272)
    [14, 21, 5],                       // R (x=224-304)
    [13, 18, 5],                       // L (x=208-288)
    [14, 15, 5],                       // R (x=224-304)
    [14, 12, 5],                       // centrata (x=224-304)
    // Piattaforma finale con la bandiera
    [14, 8, 6],                        // (x=224-320)
  ],

  coins: [
    [8, 83], [16, 80], [8, 77], [16, 74],
    [9, 71], [17, 68], [10, 65], [17, 62],
    [11, 59], [17, 56], [12, 53], [17, 50],
    [12, 47], [17, 44], [13, 41], [17, 38],
    [13, 35], [17, 32], [14, 29], [17, 26],
    [15, 23], [17, 20], [16, 17], [17, 14],
    [17, 11],
    // 4 monete finali attorno alla bandiera
    [15, 6], [16, 6], [18, 6], [19, 6],
  ],

  coinRows: [
    [6, 87, 5], [29, 87, 5],
  ],

  // Bandiera in cima alla torre
  flag: [17, 8],
};
