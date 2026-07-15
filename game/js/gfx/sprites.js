/* ============================================================
   SPRITES — tutta la pixel art del gioco, disegnata "a mano"
   come griglie di caratteri. Ogni carattere = 1 pixel.
   '.' = trasparente. Le lettere sono mappate nella PALETTE.

   PER MODIFICARE LA GRAFICA: cambia i caratteri nelle griglie
   qui sotto, come se disegnassi su carta quadrettata. Nessun
   file immagine esterno, nessun tool richiesto.
   ============================================================ */

const PALETTE = {
  // pelle / faccia
  'S': '#e8b088', 's': '#c48a5e', 'D': '#7a4a30',
  // occhi/bocca/capelli
  'K': '#181820', 'R': '#d83838', 'A': '#4a9ae8',
  // WC grigio (modello skibidi)
  'C': '#c0c4cc', 'c': '#8a8e98', 'd': '#565a64',
  // porcellana bianca (non piu' usata dal player, utile per varianti)
  'W': '#f4f4f0', 'w': '#c8c8d4', 'G': '#6a6e78',
  // acqua
  'B': '#4a8ad8', 'b': '#8ac4ec',
  // siren head scheletrico (modello marrone)
  'M': '#2c2118', 'h': '#6a543c', 'i': '#8a7050',
  'L': '#ffd83a', // luce sirena
  // masso
  'T': '#8a7a68', 't': '#b0a08c', 'U': '#5c503f',
  // moneta
  'Y': '#ffd83a', 'y': '#e8a020', 'O': '#a86818', 'Q': '#fff8c8',
  // terreno / piattaforme erbose
  'E': '#3a9a4a', 'e': '#67c85f', 'F': '#8a5a34', 'f': '#6e4426', 'V': '#4e2f1a',
  // traliccio di ferro (Torre Eiffel)
  'I': '#7a6448', 'J': '#4a3a26',
  // cartello traguardo
  'P': '#d8a020', 'p': '#8a6010', 'N': '#e84848', 'n': '#f4f4f0', 'X': '#204898',
};

/* ---- SKIBIDI (dal modello: capelli neri, occhi azzurri, naso
        giallo, ghigno, WC grigio) — 2 frame camminata + salto, 16x18 ---- */
const SPR_PLAYER_1 = [
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '..KKSSSSSSSSKK..',
  '..KSSASSSSASSK..',
  '..KSSSSYYSSSSK..',
  '...SSKKKKKKSS...',
  '...SSSKKKKSSS...',
  '....SSSSSSSS....',
  '..CCSSSSSSSSCC..',
  '..CcSSSSSSSScC..',
  '..CccSSSSSSccC..',
  '.CCCCCCCCCCCCCC.',
  '.CccccccccccccC.',
  '..cCCCCCCCCCCc..',
  '...cCCCCCCCCc...',
  '....dcccccccd...',
  '....dcccccccd...',
  '...ddddddddddd..',
];
const SPR_PLAYER_2 = [
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '..KKSSSSSSSSKK..',
  '..KSSASSSSASSK..',
  '..KSSSSYYSSSSK..',
  '...SSKKKKKKSS...',
  '...SSSKKKKSSS...',
  '....SSSSSSSS....',
  '..CCSSSSSSSSCC..',
  '..CcSSSSSSSScC..',
  '..CccSSSSSSccC..',
  '.CCCCCCCCCCCCCC.',
  '.CccccccccccccC.',
  '..cCCCCCCCCCCc..',
  '...cCCCCCCCCc...',
  '...dcccccccd....',
  '....dcccccccd...',
  '..ddddddddddd...',
];
const SPR_PLAYER_JUMP = [
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '..KKSSSSSSSSKK..',
  '..KSAASSSSAASK..',
  '..KSSSSYYSSSSK..',
  '...SSKKKKKKSS...',
  '...SSKKKKKKSS...',
  '....SSSSSSSS....',
  '..CCSSSSSSSSCC..',
  '..CcSSSSSSSScC..',
  '..CccSSSSSSccC..',
  '.CCCCCCCCCCCCCC.',
  '.CccccccccccccC.',
  '..cCCCCCCCCCCc..',
  '...cCCCCCCCCc...',
  '...dcccccccccd..',
  '...dcccccccccd..',
  '..dddddddddddd..',
];

/* ---- SIREN HEAD (dal modello: scheletro marrone, costole in
        vista, braccia lunghissime con manone, due altoparlanti
        neri sulla testa) — 30x64, disegnato in gioco a scala 2x ---- */
const SPR_SIREN = [
  '..KK..........................',
  '.KGGK.........................',
  '.KGGKKKKK.....................',
  '.KGGKKKKKKKMhhM...............',
  '.KGGKKKKKKKMhhM...........KK..',
  '.KGGKK.....MhhM.........KKGGK.',
  '..KK.......MhhM....KKKKKKKGGK.',
  '...........MhhM....KKKK..KGGK.',
  '...........MhhM..........KK...',
  '......MMMMMMhhMMMMMMMM........',
  '.....MhhhhhhhhhhhhhhhhM.......',
  '....MhhhhhhhhhhhhhhhhhhM......',
  '...MhhMMhhhhhhhhhhhhMMhhM.....',
  '...MhhM.MhhhhhhhhhhM.MhhM.....',
  '...MhhM.MihihihihiiM.MhhM.....',
  '...MhhM.MhhhhhhhhhhM.MhhM.....',
  '...MhhM.MihihihihiiM.MhhM.....',
  '...MhhM.MhhhhhhhhhhM.MhhM.....',
  '...MhhM.MihihihihiiM.MhhM.....',
  '...MhhM.MhhhhhhhhhhM.MhhM.....',
  '...MhhM.MihihihihiiM.MhhM.....',
  '..MhhM..MhhhhhhhhhhM..MhhM....',
  '..MhhM..MMhhhhhhhhMM..MhhM....',
  '..MhhM...MhhhhhhhhM...MhhM....',
  '..MhhM...MMhhhhhhMM...MhhM....',
  '..MhhM....MhhhhhhM....MhhM....',
  '..MhhM....MhhMMhhM....MhhM....',
  '.MhhM.....MhhMMhhM.....MhhM...',
  '.MhhM....MMhhhhhhMM....MhhM...',
  '.MhhM....MhhhhhhhhM....MhhM...',
  '.MhhM....MhhhhhhhhM....MhhM...',
  '.MhhM....MhhhhhhhhM....MhhM...',
  '.MhhM.....MhhMMhhM.....MhhM...',
  '.MhhM.....MhhM.MhhM....MhhM...',
  '.MhhM....MhhM...MhhM...MhhM...',
  'MhhM.....MhhM...MhhM....MhhM..',
  'MhhM.....MhhM...MhhM....MhhM..',
  'MhhM.....MhhM...MhhM....MhhM..',
  'MhhM.....MhhM...MhhM....MhhM..',
  'MhhM.....MhhM...MhhM....MhhM..',
  'MhhhM....MhhM...MhhM...MhhhM..',
  'MhhhhM...MhhM...MhhM..MhhhhM..',
  'MhhhhM...MhhM...MhhM..MhhhhM..',
  'MhhhhM...MhhM...MhhM..MhhhhM..',
  '.MhhM....MhhM...MhhM...MhhM...',
  '..MM.....MhhM...MhhM....MM....',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '.........MhhM...MhhM..........',
  '........MhhhM...MhhhM.........',
  '.......MhhhhM...MhhhhM........',
  '.......MhhhhM...MhhhhM........',
  '.......MMMMMM...MMMMMM........',
];

/* ---- MASSO — 10x10 ---- */
const SPR_ROCK = [
  '...TTTT...',
  '..TtttTT..',
  '.TtttttTU.',
  'TttTttttU.',
  'TtttttttUU',
  'TttttTttUU',
  'TtTtttttU.',
  '.TttttUU..',
  '.UTTTUU...',
  '..UUUU....',
];

/* ---- MONETA — 4 frame di rotazione, 10x10 ---- */
const SPR_COIN = [
  [
    '...YYYY...',
    '..YyyyyY..',
    '.YyQQQQyY.',
    '.YyQYYQyO.',
    '.YyQYYQyO.',
    '.YyQYYQyO.',
    '.YyQQQQyO.',
    '.YyyyyyOO.',
    '..YOOOOO..',
    '...OOOO...',
  ],
  [
    '....YY....',
    '...YyyY...',
    '..YyQQyY..',
    '..YyQYyO..',
    '..YyQYyO..',
    '..YyQYyO..',
    '..YyQQyO..',
    '..YyyyOO..',
    '...YOOO...',
    '....OO....',
  ],
  [
    '.....Y....',
    '....Yy....',
    '....YQ....',
    '....YQ....',
    '....YQ....',
    '....YQ....',
    '....YQ....',
    '....YO....',
    '....YO....',
    '.....O....',
  ],
  [
    '....YY....',
    '...YyyY...',
    '..YyQQyY..',
    '..OyYQyY..',
    '..OyYQyY..',
    '..OyYQyY..',
    '..OyQQyY..',
    '..OOyyyY..',
    '...OOOY...',
    '....OO....',
  ],
];

/* ---- TILE piattaforma erbosa — 16x16 ---- */
const SPR_TILE = [
  'eeeeEeeeeeEeeeee',
  'EEEEEEEEEEEEEEEE',
  'EEeEEEEEeEEEEEeE',
  'FFFFFFFFFFFFFFFF',
  'FfFFFfFFFFfFFFfF',
  'FFFFFFFFFFFFFFFF',
  'FFfFFFFfFFFFFfFF',
  'fFFFFfFFFFfFFFFf',
  'FFFFFFFFFFFFFFFF',
  'FfFFFfFFFFfFFFfF',
  'VFFFFFFFFFFFFFFV',
  'FVFFfFFFVFFfFFVF',
  'FFVFFFFVFVFFFVFF',
  'VFFVFFVFFFVFVFFV',
  'VVFVVVFVVVFVFVVV',
  'VVVVVVVVVVVVVVVV',
];

/* ---- TILE traliccio di ferro (Torre Eiffel) — 16x16
        L'interno è trasparente: si vede il cielo attraverso
        la struttura, come in un vero traliccio. ---- */
const SPR_GIRDER = [
  'IIIIIIIIIIIIIIII',
  'IJIIJIIJIIJIIJII',
  'JJJJJJJJJJJJJJJJ',
  'JII..........IIJ',
  'J.II........II.J',
  'J..II......II..J',
  'J...II....II...J',
  'J....IIIIII....J',
  'J....IIIIII....J',
  'J...II....II...J',
  'J..II......II..J',
  'J.II........II.J',
  'JII..........IIJ',
  'JJJJJJJJJJJJJJJJ',
  'IJIIJIIJIIJIIJII',
  'IIIIIIIIIIIIIIII',
];

/* ---- CARTELLO TRAGUARDO — 3 frame di rotazione, 18x26 ---- */
const SPR_SIGN = [
  [ // frontale
    'PPPPPPPPPPPPPPPPPP',
    'PnnnnnnnnnnnnnnnnP',
    'PnXXXXXXXXXXXXXXnP',
    'PnXnnXnnXnnXnnXXnP',
    'PnXXXXXXXXXXXXXXnP',
    'PnXXXXXNNXXXXXXXnP',
    'PnXXXXNNNNXXXXXXnP',
    'PnXXNNNNNNNNXXXXnP',
    'PnXXXXNNNNXXXXXXnP',
    'PnXXXNNXXNNXXXXXnP',
    'PnXXXXXXXXXXXXXXnP',
    'PnnnnnnnnnnnnnnnnP',
    'PPPPPPPPPPPPPPPPPP',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '.......pppp.......',
    '......pppppp......',
  ],
  [ // di taglio
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........PP........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '.......pppp.......',
    '......pppppp......',
  ],
  [ // retro
    'PPPPPPPPPPPPPPPPPP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PppppppppppppppppP',
    'PPPPPPPPPPPPPPPPPP',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '........pp........',
    '.......pppp.......',
    '......pppppp......',
  ],
];

/* ---- BANDIERA (traguardo del livello 2) — 2 frame di
        sventolio, tricolore, 20x34 ---- */
const SPR_FLAG = [
  [
    '..dd................',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXXnnnnNNNNN..',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '.dddd...............',
  ],
  [
    '..dd................',
    '..ddXXXXXnnnnNNNN...',
    '..ddXXXXXnnnnNNNNN..',
    '..dd.XXXXnnnnNNNNNN.',
    '..dd.XXXXXnnnnNNNNN.',
    '..ddXXXXXnnnnNNNNN..',
    '..ddXXXXnnnnNNNNN...',
    '..ddXXXXXnnnnNNNN...',
    '..ddXXXXXnnnnNNNNN..',
    '..dd.XXXXnnnnNNNNNN.',
    '..ddXXXXXnnnnNNNNN..',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '..dd................',
    '.dddd...............',
  ],
];

/* ---- CUORE per l'HUD — 7x6 ---- */
const SPR_HEART = [
  '.RR.RR.',
  'RRRRRRR',
  'RRRRRRR',
  '.RRRRR.',
  '..RRR..',
  '...R...',
];
const SPR_HEART_EMPTY = [
  '.KK.KK.',
  'K..K..K',
  'K.....K',
  '.K...K.',
  '..K.K..',
  '...K...',
];

/* ============================================================
   Sprites: classe di utilità che converte le griglie di testo
   in canvas fuori schermo, pronti da disegnare velocemente.
   ============================================================ */
class Sprites {
  constructor() {
    this.cache = {};
  }

  /** Converte una griglia di caratteri in un canvas.
      remap (opzionale): {carattere: '#colore'} per generare
      varianti ricolorate della stessa griglia (es. skin P2). */
  build(name, grid, flip = false, remap = null) {
    const h = grid.length, w = grid[0].length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = grid[y][flip ? w - 1 - x : x];
        if (ch === '.') continue;
        const col = (remap && remap[ch]) || PALETTE[ch];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
    this.cache[name] = cv;
    return cv;
  }

  /** Costruisce tutti gli sprite del gioco (chiamato una volta all'avvio). */
  buildAll() {
    this.build('player1', SPR_PLAYER_1);
    this.build('player2', SPR_PLAYER_2);
    this.build('playerJump', SPR_PLAYER_JUMP);
    this.build('player1L', SPR_PLAYER_1, true);
    this.build('player2L', SPR_PLAYER_2, true);
    this.build('playerJumpL', SPR_PLAYER_JUMP, true);

    // Skin del GIOCATORE 2: stesso disegno ma WC blu.
    // Cambia i colori qui per personalizzare la skin P2.
    const P2_SKIN = { 'C': '#9ab8e8', 'c': '#5a7ab8', 'd': '#324e80' };
    this.build('p2_player1', SPR_PLAYER_1, false, P2_SKIN);
    this.build('p2_player2', SPR_PLAYER_2, false, P2_SKIN);
    this.build('p2_playerJump', SPR_PLAYER_JUMP, false, P2_SKIN);
    this.build('p2_player1L', SPR_PLAYER_1, true, P2_SKIN);
    this.build('p2_player2L', SPR_PLAYER_2, true, P2_SKIN);
    this.build('p2_playerJumpL', SPR_PLAYER_JUMP, true, P2_SKIN);

    this.build('siren', SPR_SIREN);
    this.build('rock', SPR_ROCK);
    SPR_COIN.forEach((f, i) => this.build('coin' + i, f));
    this.build('tile', SPR_TILE);
    this.build('girder', SPR_GIRDER);
    SPR_SIGN.forEach((f, i) => this.build('sign' + i, f));
    SPR_FLAG.forEach((f, i) => this.build('flag' + i, f));
    this.build('heart', SPR_HEART);
    this.build('heartEmpty', SPR_HEART_EMPTY);
  }

  get(name) { return this.cache[name]; }
}
