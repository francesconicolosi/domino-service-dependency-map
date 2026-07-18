#!/usr/bin/env bash
# build.sh — packaging di THE RETURN OF THE SHADOW
#
# Uso:
#   ./build.sh                          -> crea dist/return-of-the-shadow.love
#   ./build.sh /path/love-11.x-win64    -> crea anche dist/windows/ReturnOfTheShadow.exe
#                                          (la cartella deve contenere love.exe e le DLL)
set -euo pipefail
cd "$(dirname "$0")"

NAME="return-of-the-shadow"
DIST="dist"
mkdir -p "$DIST"

# ---------------------------------------------------------------- .love
LOVEFILE="$DIST/$NAME.love"
rm -f "$LOVEFILE"

# Un .love è semplicemente uno zip con main.lua alla radice.
if command -v zip >/dev/null 2>&1; then
  zip -9 -r "$LOVEFILE" main.lua conf.lua assets -x '*.gitkeep' >/dev/null
else
  # fallback senza 'zip' (richiede python3)
  python3 - "$LOVEFILE" <<'PY'
import sys, zipfile, os
out = sys.argv[1]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for item in ("main.lua", "conf.lua"):
        z.write(item)
    for root, _, files in os.walk("assets"):
        for f in files:
            p = os.path.join(root, f)
            z.write(p)
PY
fi
echo "Creato: $LOVEFILE"
echo "Esegui con: love $LOVEFILE"

# ---------------------------------------------------------------- editor .love
EDFILE="$DIST/level-editor.love"
rm -f "$EDFILE"
if [ -d editor ]; then
  ( cd editor && zip -9 -r "../$EDFILE" main.lua conf.lua >/dev/null )
  echo "Creato: $EDFILE"
  echo "Esegui con: love $EDFILE"
fi

# ---------------------------------------------------------------- .exe (opzionale)
if [ "${1:-}" != "" ]; then
  LOVEWIN="$1"
  if [ ! -f "$LOVEWIN/love.exe" ]; then
    echo "ERRORE: $LOVEWIN non contiene love.exe" >&2
    exit 1
  fi
  OUT="$DIST/windows"
  mkdir -p "$OUT"
  cat "$LOVEWIN/love.exe" "$LOVEFILE" > "$OUT/ReturnOfTheShadow.exe"
  # DLL e licenza accanto all'eseguibile
  cp "$LOVEWIN"/*.dll "$OUT"/ 2>/dev/null || true
  cp "$LOVEWIN"/license*.txt "$OUT"/ 2>/dev/null || true
  chmod +x "$OUT/ReturnOfTheShadow.exe" || true
  echo "Creato: $OUT/ReturnOfTheShadow.exe (+ DLL)"
  echo "Funziona su Windows nativo e sotto Proton/Wine."
fi
