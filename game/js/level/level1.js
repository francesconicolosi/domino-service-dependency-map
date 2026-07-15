/* ============================================================
   LEVEL 1 — il livello è descritto come dati, non come codice:
   così puoi ridisegnarlo cambiando solo i numeri qui sotto.

   Coordinate in TILE da 16px (schermo alto 14 tile: y=0 in alto,
   y=13 in basso). Il terreno di base sta a riga 12.

   ground:    [colonnaInizio, larghezzaInTile]  — strisce di
              pavimento a riga 12, alte 2 tile. I "buchi" tra una
              striscia e l'altra sono i burroni in cui si cade.
   platforms: [colonna, riga, larghezzaInTile]  — piattaforme sospese
   coins:     [colonna, riga]                   — monete singole
   coinRows:  [colonna, riga, quante]           — file di monete
   sign:      [colonna, riga]                   — cartello del traguardo
   ============================================================ */
const LEVEL_1 = {
  widthTiles: 220, // lunghezza del livello (220 * 16 = 3520 px)

  ground: [
    [0, 30],          // zona di partenza
    [34, 18],
    [56, 14],
    [74, 22],
    [102, 10],
    [118, 16],
    [140, 12],
    [158, 20],
    [184, 36],        // rettilineo finale
  ],

  platforms: [
    [12, 9, 4],
    [20, 7, 3],
    [30, 9, 3],       // aiuta a superare il primo burrone
    [40, 8, 4],
    [48, 6, 3],
    [60, 9, 4],
    [70, 7, 3],       // ponte sul secondo burrone
    [80, 9, 3],
    [86, 7, 4],
    [94, 5, 3],
    [99, 8, 3],       // discesa verso il burrone
    [112, 8, 4],      // ponte
    [124, 9, 3],
    [130, 7, 3],
    [136, 9, 3],      // salti sul burrone
    [146, 7, 4],
    [154, 9, 3],
    [164, 8, 3],
    [170, 6, 4],
    [178, 8, 4],      // ultimo ponte
    [192, 9, 4],
    [200, 7, 4],
  ],

  coins: [
    [14, 8], [21, 6], [31, 8],
    [49, 5], [71, 6], [95, 4],
    [131, 6], [147, 6], [171, 5],
  ],

  coinRows: [
    [8, 11, 4],       // fila a terra all'inizio
    [40, 7, 4],
    [60, 8, 4],
    [86, 6, 4],
    [112, 7, 4],
    [124, 8, 3],
    [160, 11, 5],
    [178, 7, 4],
    [192, 8, 4],
    [206, 11, 5],     // premio finale prima del cartello
  ],

  sign: [212, 12],    // il cartello poggia sul terreno finale
};

/* ------------------------------------------------------------
   Costruttore del livello: trasforma i dati in entità di gioco.
   Comune al livello 1 (orizzontale, erba, cartello) e al
   livello 2 (verticale, traliccio, bandiera).
   ------------------------------------------------------------ */
class Level {
  constructor(data) {
    this.data = data;
    this.width  = data.widthTiles  * 16;
    this.height = (data.heightTiles || 14) * 16;
    this.vertical = !!data.vertical;
    // Il tipo di tile è definito dal livello: erba (default) o traliccio
    this.tileName = data.tileName || (this.vertical ? 'girder' : 'tile');
  }

  build(game) {
    const d = this.data;
    const tn = this.tileName;

    for (const [tx, tw] of (d.ground || []))
      game.platforms.push(new Platform(tx, this.vertical ? d.heightTiles - 2 : 12, tw, 2, tn));

    for (const [tx, ty, tw] of (d.platforms || []))
      game.platforms.push(new Platform(tx, ty, tw, 1, tn));

    for (const [tx, ty] of (d.coins || []))
      game.entities.push(new Coin(tx * 16 + 3, ty * 16 + 3));

    for (const [tx, ty, n] of (d.coinRows || []))
      for (let i = 0; i < n; i++)
        game.entities.push(new Coin((tx + i) * 16 + 3, ty * 16 + 3));

    // Traguardo: cartello (livello 1) o bandiera (livello 2)
    if (d.sign) {
      const [sx, sy] = d.sign;
      game.entities.push(new GoalSign(sx * 16, sy * 16 - 26));
    }
    if (d.flag) {
      const [sx, sy] = d.flag;
      game.entities.push(new Flag(sx * 16, sy * 16 - 34));
    }
  }
}
