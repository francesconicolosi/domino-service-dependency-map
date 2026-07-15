/* ============================================================
   PLATFORM — una piattaforma solida fatta di tile 16x16.
   Il giocatore può atterrarci sopra (collisione solo dall'alto,
   stile platform classico: da sotto e di lato si passa).

   Il parametro `tileName` sceglie l'aspetto grafico dei tile:
   - 'tile'    (default) → piattaforma erbosa del livello 1
   - 'girder'            → traliccio di ferro della Torre Eiffel
   ============================================================ */
class Platform extends Entity {
  /**
   * @param {number} tx        colonna di partenza (in tile da 16px)
   * @param {number} ty        riga di partenza
   * @param {number} tilesW    larghezza in tile
   * @param {number} tilesH    altezza in tile (1 per piattaforme sospese)
   * @param {string} tileName  nome dello sprite tile ('tile' | 'girder')
   */
  constructor(tx, ty, tilesW, tilesH = 1, tileName = 'tile') {
    super(tx * 16, ty * 16, tilesW * 16, tilesH * 16);
    this.tilesW = tilesW;
    this.tilesH = tilesH;
    this.tileName = tileName;
  }

  draw(ctx, cam) {
    const spr = game.sprites.get(this.tileName);
    for (let j = 0; j < this.tilesH; j++) {
      for (let i = 0; i < this.tilesW; i++) {
        ctx.drawImage(spr, Math.round(this.x + i * 16 - cam.ox), Math.round(this.y + j * 16 - cam.oy));
      }
    }
  }
}
