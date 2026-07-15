# SKIBIDI TOILET vs SIREN HEAD

Platformer 2D a scorrimento orizzontale e verticale in pixel art, stile Sega
Mega Drive / Genesis. Uno skibidi toilet (WC grigio con testa) attraversa due
livelli inseguito da un Siren Head scheletrico che gli lancia massi addosso.

**Livello 1 — Notte fuori città (scorrimento orizzontale)**
Attraversa il paesaggio raccogliendo monete, salta i burroni e tocca il
cartello girevole in fondo per finire il livello.

**Livello 2 — La Torre Eiffel (scorrimento verticale)**
Scala la torre di ferro saltando da un traliccio all'altro, evita i massi
lanciati orizzontalmente dal Siren Head accanto alla torre, arriva alla
bandiera francese in cima.

Nessun server, nessuna dipendenza, nessun tool di build:
**apri `index.html` con doppio clic** e giochi.

## Modalità di gioco

Dalla **title screen** scegli con le frecce (o il d-pad del gamepad):
- **1 GIOCATORE** — modalità classica
- **2 GIOCATORI** — co-op a schermo condiviso (solo desktop):
  il **giocatore 1 conduce la telecamera**; se il giocatore 2 esce
  dall'inquadratura lo schermo si **divide in due** (sopra/sotto nei
  livelli orizzontali, sinistra/destra sulla torre) e ognuno vede la
  propria zona. Quando i due si riavvicinano, lo schermo si riunisce.
  Il giocatore 2 ha il WC blu. Le monete sono condivise; la partita
  finisce solo quando ENTRAMBI restano senza vita.

## Controlli

**Tastiera**

| Modalità | Muoviti | Salta |
|---|---|---|
| 1 giocatore | frecce o WASD | Z / SPAZIO / ↑ / W |
| 2P — giocatore 1 | ← → | Z / ↑ |
| 2P — giocatore 2 | A D | SPAZIO / W |

Tasti globali: **M** audio on/off · **R** ricomincia · **INVIO/Z** conferma nei menu

**Gamepad USB** (Gamepad API, nessun driver necessario)
- pad #1 = giocatore 1, pad #2 = giocatore 2
- levetta sinistra o d-pad = movimento · A/B = salto · START = conferma

**Mobile (touch)**
- il gioco si gioca **solo in orizzontale** (in verticale appare
  l'invito a ruotare il telefono)
- pulsanti a schermo: ◀ ▶ per muoversi, ▲ per saltare
- la modalità 2 giocatori non è disponibile su mobile

## Regole

- **10 punti vita** (i cuori in alto a sinistra)
- perdi 1 vita se ti colpisce un **masso** o se **cadi nel vuoto**
- dopo una caduta riparti dall'**ultimo punto sicuro** su cui eri atterrato
- dopo un colpo hai ~1,5 s di **invulnerabilità** (lampeggi)
- livello 1: tocca il **cartello** in fondo per completarlo
- livello 2: tocca la **bandiera** in cima per completarlo
- completa il livello 1 → premi Z → scala la Torre Eiffel

## Struttura del progetto

```
skibidi-runner/
├── index.html            pagina di avvio (carica gli script in ordine)
├── css/style.css         scala del canvas, effetto scanline CRT
└── js/
    ├── config.js         ★ TUTTI i parametri di gameplay
    ├── main.js           avvio + game loop a 60 fps
    ├── core/
    │   ├── game.js       stato, sfondi, HUD, schermate, progressione livelli
    │   ├── camera.js     inseguimento (orizzontale + verticale)
    │   └── input.js      tastiera
    ├── gfx/
    │   └── sprites.js    ★ TUTTA la pixel art (griglie di caratteri)
    ├── audio/
    │   └── audio.js      ★ synth 8-bit: effetti + musica
    ├── entities/
    │   ├── entity.js     classe base
    │   ├── player.js     skibidi toilet: fisica, salto, vita
    │   ├── sirenhead.js  siren head: due modalità (orizzontale/verticale)
    │   ├── rock.js       massi con traiettoria balistica
    │   ├── coin.js       monete animate
    │   ├── platform.js   piattaforme (erba o traliccio)
    │   ├── goalsign.js   cartello di fine livello 1
    │   └── flag.js       bandiera di fine livello 2
    └── level/
        ├── level1.js     ★ dati del livello 1 (orizzontale)
        └── level2.js     ★ dati del livello 2 (verticale)
```

I file segnati con ★ sono quelli che toccherai più spesso.

## Modifiche rapide (ricette)

**Rendere il gioco più facile/difficile** → `js/config.js`
- `SIREN.THROW_EVERY_MIN/MAX`: frequenza dei massi
- `PLAYER.MAX_HP`, `ROCK.DAMAGE`, `FALL_DAMAGE`
- `PLAYER.JUMP_FORCE`, `PLAYER.SPEED`

**Ridisegnare uno sprite** → `js/gfx/sprites.js`
Ogni sprite è una griglia di caratteri: ogni carattere è un pixel, `.` è
trasparente, le lettere sono colori definiti in `PALETTE`. Disegna
direttamente nel testo, salva, ricarica la pagina.

Sprites disponibili: skibidi toilet (3 pose), siren head, masso, moneta
(4 frame), tile erba, tile traliccio Eiffel, cartello (3 frame), bandiera
(2 frame), cuori.

**Modificare i livelli** → `js/level/level1.js` o `js/level/level2.js`
Piattaforme, monete, posizione del traguardo sono liste di numeri
(coordinate in tile da 16 px). Aggiungi una riga → aggiungi una piattaforma.

**Cambiare la musica** → `js/audio/audio.js`
`bassLine` e `leadLine` sono sequenze di note (`'C4'`, `'A2'`, `'-'` = pausa).
Gli effetti sonori sono i metodi `sfx…()`: cambia frequenze e durate.

**Aggiungere un terzo livello**
1. duplica `level2.js` in `level3.js` e modifica i dati
2. aggiungi `<script src="js/level/level3.js">` in `index.html`
3. in `game.js` costruttore: `this.levels = [LEVEL_1, LEVEL_2, LEVEL_3];`

**Rendere un livello verticale**: aggiungi `vertical: true` e `heightTiles: N`
ai dati del livello. Il motore attiverà camera verticale e usa i tile
traliccio invece dell'erba. Aggiungi `flag: [col, riga]` per il traguardo.

## Note tecniche

- Risoluzione interna 320×224 (quella del Mega Drive), scalata 3× con
  `image-rendering: pixelated` per pixel netti.
- Fisica a passo fisso (60 tick/s), indipendente dal refresh del monitor.
- Audio 100% procedurale con Web Audio API (onde quadre e triangolari).
  Parte al primo tasto premuto (i browser bloccano l'audio prima).
- Sfondi diversi per livello: notte con colline (livello 1) o notte con
  skyline parigino (livello 2).
- Il Siren Head cambia comportamento: parallasse+massi dall'alto (livello 1)
  oppure gigante di fianco alla torre+massi orizzontali (livello 2).
- Script caricati con normali tag `<script>` (niente moduli ES): funzionano
  aprendo `index.html` direttamente da disco, senza server.

## Personaggi

Skibidi toilet e Siren Head sono interpretazioni pixel art originali
basate sui riferimenti forniti. Sentiti libero di ridisegnarli in
`sprites.js` — è un file di testo con griglie di lettere.
