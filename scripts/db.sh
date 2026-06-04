#!/usr/bin/env bash
#
# Maneja el Postgres local de desarrollo (vía Docker).
# Lee las credenciales desde DATABASE_URL en .env, así que nunca se desincroniza.
#
# Uso:
#   ./scripts/db.sh up      -> levanta el contenedor y espera a que acepte conexiones
#   ./scripts/db.sh down     -> detiene el contenedor (los datos se conservan)
#   ./scripts/db.sh logs     -> tail de los logs
#   ./scripts/db.sh psql     -> abre una shell psql contra la base
#   ./scripts/db.sh reset    -> BORRA el contenedor y su volumen (datos incluidos) y vuelve a crear
#   ./scripts/db.sh status   -> estado del contenedor
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
CONTAINER="indumentaria-db"
VOLUME="indumentaria-db-data"
IMAGE="postgres:16"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ No se encontró $ENV_FILE" >&2
  exit 1
fi

# --- Parsear DATABASE_URL del .env ---
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
if [[ -z "${DATABASE_URL:-}" || "$DATABASE_URL" != postgres* ]]; then
  echo "✗ DATABASE_URL en .env no es un Postgres (usás SQLite, no hace falta este script)." >&2
  exit 1
fi

# postgresql://USER:PASS@HOST:PORT/DBNAME
proto_stripped="${DATABASE_URL#*://}"
creds="${proto_stripped%@*}"
hostpart="${proto_stripped#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
DB_NAME="${hostpart##*/}"
hostport="${hostpart%%/*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport##*:}"
[[ "$DB_PORT" == "$DB_HOST" ]] && DB_PORT=5432

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ Docker no está instalado o no está en el PATH." >&2
  exit 1
fi

container_exists() { docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; }
container_running() { docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; }

wait_ready() {
  echo -n "⏳ Esperando a Postgres"
  for _ in $(seq 1 30); do
    if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      echo " ✓ listo en ${DB_HOST}:${DB_PORT}/${DB_NAME}"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo ""
  echo "✗ Postgres no respondió a tiempo. Revisá: ./scripts/db.sh logs" >&2
  exit 1
}

up() {
  if container_running; then
    echo "✓ '$CONTAINER' ya está corriendo."
    wait_ready
    return
  fi
  if container_exists; then
    echo "▶ Arrancando contenedor existente '$CONTAINER'..."
    docker start "$CONTAINER" >/dev/null
  else
    echo "▶ Creando contenedor '$CONTAINER' ($IMAGE)..."
    docker run -d \
      --name "$CONTAINER" \
      -e POSTGRES_USER="$DB_USER" \
      -e POSTGRES_PASSWORD="$DB_PASS" \
      -e POSTGRES_DB="$DB_NAME" \
      -p "${DB_PORT}:5432" \
      -v "${VOLUME}:/var/lib/postgresql/data" \
      "$IMAGE" >/dev/null
  fi
  wait_ready
}

case "${1:-up}" in
  up)     up ;;
  down)   docker stop "$CONTAINER" >/dev/null && echo "■ '$CONTAINER' detenido (datos conservados)." ;;
  logs)   docker logs -f "$CONTAINER" ;;
  psql)   docker exec -it "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" ;;
  status) docker ps -a --filter "name=$CONTAINER" ;;
  reset)
    echo "⚠ Esto BORRA todos los datos de '$DB_NAME'."
    read -r -p "¿Seguro? (escribí 'si'): " ans
    [[ "$ans" == "si" ]] || { echo "Cancelado."; exit 0; }
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker volume rm "$VOLUME" >/dev/null 2>&1 || true
    echo "🗑  Borrado. Recreando..."
    up ;;
  *)
    echo "Uso: $0 {up|down|logs|psql|status|reset}" >&2
    exit 1 ;;
esac
