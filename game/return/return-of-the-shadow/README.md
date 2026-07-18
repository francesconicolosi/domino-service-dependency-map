# THE RETURN OF THE SHADOW

Livello d'apertura di un cinematic-platformer 2D in stile anni '90 (movimenti "rotoscopici"
procedurali), interamente originale: **niente asset esterni** — grafica, animazioni, vento e
musica sono generati dal codice. Tutto il sorgente è modificabile.

Motore: **LÖVE (Love2D) 11.x** — https://love2d.org
Funziona nativamente su **Linux** e **Windows**, e sotto **Proton/Wine** (la build Windows
gira senza configurazioni particolari).

---

## Requisiti

- LÖVE 11.4 o successivo (11.x).
  - Linux: pacchetto `love` della tua distro (`apt install love`, `pacman -S love`,
    `dnf install love`) oppure AppImage dal sito ufficiale.
  - Windows: installer o zip da https://love2d.org

Nessun'altra dipendenza. Nessun asset da scaricare.

## Eseguire il gioco

Dalla cartella del progetto:

```bash
love .
```

oppure trascina la cartella del progetto sull'eseguibile di LÖVE (Windows).

## Controlli

| Azione | Tasti |
|---|---|
| Muoversi | ← → oppure A D |
| Saltare | SPAZIO / Z / K (con jump-buffer e coyote time) |
| Aggrapparsi a una sporgenza | automatico avvicinandosi in aria |
| Arrampicarsi (pareti segnate) | ↑ / ↓ vicino alla fascia con gli appigli |
| Scavalcare da appeso | ↑ |
| Lasciare la presa | ↓ oppure S |
| Colpo di spada (Livello 2) | X oppure F (dopo aver raccolto la spada) |
| Entrare nel castello | INVIO dalla title screen del prologo |
| Ricominciare il livello | R |
| Uscire | ESC |

Le pareti scalabili si riconoscono dalla fascia di roccia levigata con gli appigli
scavati: avvicinati e premi ↑ per agganciarti (l'aggancio ha priorità sul salto),
poi ↑/↓ per salire e scendere; SPAZIO fa il balzo di spinta lontano dalla parete.
In parete ogni arto afferra e molla i singoli appigli, uno alla volta; in cima
il personaggio si issa in una sequenza completa (tirata, ginocchio sul bordo,
rilascio delle mani, accovacciato, in piedi). Le travi strette si attraversano
dal basso e richiedono equilibrio.

## Livello 2 — The Witch's Keep

Dalla title screen del prologo, premi **INVIO** per entrare nel castello:
sale buie di mattoni illuminate dalle torce, scalinate, burroni e **scheletri
armati di spada** che pattugliano i corridoi. All'inizio sei disarmato: evitali.

Nella sala della trappola c'è una **piastra a pressione**: calpestala quando lo
scheletro di guardia passa sotto la **gabbia sospesa** — se lo manca, l'argano
la risolleva e puoi ritentare. Lo scheletro colpito crolla in un mucchio d'ossa
(niente sangue né ferite) e **lascia cadere la spada**: raccoglila per poter
attaccare con **X**. I fendenti non feriscono gli scheletri: li **respingono**;
spingili oltre il bordo dei burroni per eliminarli. Hai **3 cuori**: ogni colpo
di spada nemico ne toglie uno; a zero, si ricomincia dal checkpoint.

## Level Editor

Nella cartella `editor/` c'è un editor visuale con gli stessi asset del gioco:

```bash
love editor           # oppure: love dist/level-editor.love
```

Trascina sul vuoto per creare piattaforme (sottile = trave), clicca per
selezionare, trascina per spostare, trascina un bordo per ridimensionare.
`TAB` passa dal Livello 1 (la scalata, rupi al tramonto) al Livello 2 (il
castello, muratura di mattoni con i marker di trappola, pulsante, ronde degli
scheletri e porta d'uscita come riferimento). `B` trave, `C` parete scalabile,
`N` fissa la base della via al mouse, `K` checkpoint, `G` snap alla griglia,
`CTRL+S`/`F5` salva. L'editor scrive `level.lua` (Livello 1) o `level2.lua`
(Livello 2) nella sua save directory (il percorso appare a schermo dopo il
salvataggio): copia quei file accanto al `main.lua` del gioco (o dentro lo zip
del `.love`) e il gioco li caricherà automaticamente al posto dei livelli di
default. `H` mostra/nasconde l'aiuto in-editor.

## Struttura del progetto

```
return-of-the-shadow/
├── conf.lua        # configurazione finestra (1280x720, resizable, vsync, MSAA)
├── main.lua        # tutto il gioco (~900 righe, commentato in italiano)
├── assets/         # opzionale: font serif per la title screen (vedi LEGGIMI.txt)
└── build.sh        # packaging .love / .exe
```

`main.lua` è organizzato in sezioni chiaramente commentate:

1. **Costanti e palette** (in testa al file): gravità, velocità, salto, colori del
   tramonto, posizione del castello, trigger della cinematica. È il primo posto dove
   mettere le mani per modificare il feel del gioco.
2. **Livello**: la tabella `plats` definisce le piattaforme (x, y, w, h, più i flag
   `beam` per le travi strette e `climbL` per le pareti scalabili) e i checkpoint.
   Le sporgenze afferrabili sono generate automaticamente dagli spigoli.
3. **Audio procedurale**: `genWind()` (rumore filtrato con raffiche) e `genMusic()`
   (archi sintetici in Re minore, loop di 16 secondi).
4. **Sfondo**: cielo a gradiente, sole, nubi, tre catene montuose in parallasse.
5. **Castello ed emblema**: `drawCastle` e `drawEmblem` (l'emblema della strega:
   anello con tacche rituali, tre archi intrecciati, luna crescente che culla un occhio).
6. **Protagonista**: fisica AABB scritta a mano, stati (terra/aria/appeso/arrampicata/
   scavalcamento/cinematica), pose procedurali per corsa, equilibrio, salto,
   atterraggio, arrampicata; sciarpa simulata a nodi (verlet) mossa dal vento.
7. **Cinematica e title screen**: al promontorio il controllo passa al gioco, entra la
   musica orchestrale con dissolvenza e appare "THE RETURN OF THE SHADOW".

## Personalizzazione rapida

- **Grana pixel-art**: costante `PIX` in `main.lua` (2 = 640×360 in stile anni '90;
  1 = nessuna pixelatura; 3–4 = ancora più retrò).
- **Feel del salto**: `GRAV`, `JUMPV`, `COYOTE`, `JBUF` in testa a `main.lua`.
- **Palette**: tabella `COL`.
- **Livello**: tabella `plats` (aggiungi/spezza piattaforme, crepacci, pareti).
- **Font della title screen**: metti un `.ttf` serif in `assets/title.ttf`
  (caricato automaticamente se presente; altrimenti usa il font di sistema di LÖVE
  con spaziatura tra le lettere).
- **Musica/vento**: parametri in `genMusic()` e `genWind()`.

## Compilare / distribuire

### Pacchetto universale `.love`

```bash
./build.sh
```

Crea `dist/return-of-the-shadow.love`: si esegue con `love return-of-the-shadow.love`
su qualunque sistema con LÖVE installato (Linux, Windows, macOS).

### Eseguibile Windows (funziona anche sotto Proton/Wine)

1. Scarica lo zip **a 64 bit** di LÖVE per Windows e scompattalo.
2. Esegui:

   ```bash
   ./build.sh /percorso/alla/cartella/love-11.x-win64
   ```

   Lo script concatena `love.exe` con il `.love` e copia le DLL necessarie in
   `dist/windows/`. Quella cartella è il gioco completo per Windows.

   Su Windows puro l'equivalente manuale è:

   ```bat
   copy /b love.exe+return-of-the-shadow.love ReturnOfTheShadow.exe
   ```

   (poi copia tutte le `.dll` e `license.txt` accanto all'exe).

3. Sotto **Proton/Steam**: aggiungi `ReturnOfTheShadow.exe` come gioco non-Steam e
   forza una versione di Proton, oppure lancialo con Wine. Non servono override.

### Eseguire nel browser (WebAssembly)

Il gioco può girare anche nel browser tramite **love.js** (il port Emscripten
di LÖVE). Serve **Node.js 16 o più recente** (consigliato ≥ 18):

```bash
./build-web.sh
cd dist/web && python3 -m http.server 8000
# poi apri http://localhost:8000
```

Se il comando resta bloccato su uno spinner con `rollbackFailedOptional`,
il tuo Node è troppo vecchio (quel messaggio è di npm 5/6, incluso in
Node ≤ 10): aggiorna Node (`nvm install --lts && nvm use --lts` oppure da
https://nodejs.org) e rilancia. In alternativa installa love.js una volta
sola con `npm install -g love.js` e riesegui lo script, che userà il
binario globale.

Lo script alloca **256 MB di memoria WebAssembly** (`--memory`): il default
di love.js è 16 MB e con questo gioco produce l'errore
`RuntimeError: memory access out of bounds` al caricamento. Il messaggio in
console `Could not open file assets/title.ttf` è invece innocuo: è il
tentativo (facoltativo) di caricare il font personalizzato della title
screen, che in sua assenza usa il font di sistema.

Note importanti: la cartella `dist/web/` va servita da un **server statico**
(qualunque, anche `python3 -m http.server`) — aprire `index.html` da `file://`
non funziona perché i browser bloccano il caricamento del `.wasm`. Lo script
usa la modalità *compatibility* di love.js, che funziona ovunque senza header
particolari; l'**audio parte al primo click o tasto** (regola dei browser
sull'autoplay). La stessa cartella si può pubblicare così com'è su GitHub
Pages, itch.io (come "HTML playable in browser") o qualunque hosting statico.

### Linux nativo

Su Linux il modo più semplice è distribuire il `.love` (dipendenza: pacchetto `love`).
Per un binario standalone si può usare il metodo AppImage descritto sul wiki di LÖVE:
https://love2d.org/wiki/Game_Distribution

## Licenza

Codice e contenuti di questo progetto: **MIT** — usalo, modificalo e ridistribuiscilo
liberamente. LÖVE è distribuito con licenza zlib (vedi il sito ufficiale).
