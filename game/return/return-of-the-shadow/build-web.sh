#!/usr/bin/env bash
# build-web.sh — versione browser (WebAssembly) di THE RETURN OF THE SHADOW
#
# Requisiti: Node.js >= 16 (consigliato >= 18). Usa love.js (port Emscripten).
#
# Uso:
#   ./build-web.sh          -> crea dist/web/ con index.html + gioco
#   cd dist/web && python3 -m http.server 8000
#   apri http://localhost:8000
#
# NOTE:
# - dist/web va servita da un server statico: da file:// il .wasm non carica.
# - Modalita' "compatibility" (-c): funziona ovunque senza header speciali.
# - L'audio parte al primo click/tasto (regola dei browser sull'autoplay).
set -euo pipefail
cd "$(dirname "$0")"

./build.sh

# --- controlli ambiente --------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "ERRORE: serve Node.js (>= 16). Installa da https://nodejs.org o con nvm." >&2
  exit 1
fi
NODE_MAJ=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJ" -lt 14 ]; then
  echo "ERRORE: Node.js $(node -v) e' troppo vecchio per love.js." >&2
  echo "Il blocco su 'rollbackFailedOptional' e' il sintomo tipico di npm 5/6" >&2
  echo "(incluso in Node <= 10). Aggiorna Node, ad esempio con nvm:" >&2
  echo "  nvm install --lts && nvm use --lts" >&2
  echo "oppure con il gestore pacchetti del sistema / https://nodejs.org" >&2
  exit 1
fi

mkdir -p dist
rm -rf dist/web

# --- love.js: binario globale se installato, altrimenti npx --------------
# (se npx si blocca comunque, installa una volta:  npm install -g love.js )
if command -v love.js >/dev/null 2>&1; then
  LOVEJS="love.js"
else
  LOVEJS="npx --yes love.js"
fi

# registry esplicito e niente audit/fund: evita gli stalli di rete di npm
export npm_config_registry="https://registry.npmjs.org/"
export npm_config_audit=false
export npm_config_fund=false

# --- memoria WASM -------------------------------------------------------
# Il default di love.js e' 16 MB: troppo pochi per questo gioco (audio
# procedurale, canvas pixel-art, geometrie) e causa l'errore
# "RuntimeError: memory access out of bounds". Allochiamo 256 MB.
WASM_MEM=268435456

$LOVEJS dist/return-of-the-shadow.love dist/web \
  --title "THE RETURN OF THE SHADOW" -c --memory "$WASM_MEM"

echo
echo "Creato: dist/web/"
echo "Prova con:  cd dist/web && python3 -m http.server 8000"
echo "Poi apri:   http://localhost:8000"
