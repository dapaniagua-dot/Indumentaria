#!/usr/bin/env bash
#
# Inicializa todo el entorno de desarrollo de una sola pasada:
#   1. Selecciona la versión de Node de .nvmrc (nvm use / install)
#   2. Instala dependencias de la raíz y del server
#   3. Levanta la base de datos (Postgres en Docker)
#
# Importante: corré esto con `source` para que el `nvm use` afecte tu shell:
#   source scripts/setup.sh
#
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT_DIR" || return 1

# --- 1. Node via nvm ---
if command -v nvm >/dev/null 2>&1 || [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  [[ -s "$HOME/.nvm/nvm.sh" ]] && \. "$HOME/.nvm/nvm.sh"
  echo "▶ nvm use ($(cat .nvmrc))"
  nvm use || nvm install
else
  echo "⚠ nvm no encontrado; usando el node del PATH: $(node -v 2>/dev/null || echo 'no instalado')"
fi

# --- 2. Dependencias ---
echo "▶ npm install (raíz)"
npm install
echo "▶ npm install (server)"
npm install --prefix server

# --- 3. Base de datos ---
echo "▶ Levantando la base de datos"
bash scripts/db.sh up

echo ""
echo "✓ Listo. Arrancá el proyecto con:  npm run dev"
