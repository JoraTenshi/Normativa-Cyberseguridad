#!/usr/bin/env bash
# Procedimiento para ESTE despliegue. Sin borrados, seed, down -v ni secretos en salida.
set -Eeuo pipefail
umask 077
raiz="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
[[ "$raiz" == "/home/kali/Documents/practica3/normativa_check" ]] || { echo "Checkout inesperado"; exit 1; }
cd "$raiz"
[[ "${EUID}" -eq 0 ]] || { echo "Requiere sudo desde tu terminal; no pegues contraseñas en el chat."; exit 1; }
if docker compose version >/dev/null 2>&1; then compose=(docker compose); else compose=(docker-compose); fi
imagen="$(docker inspect cybersec_mongo --format '{{.Image}}')"
volumen="$(docker inspect cybersec_mongo --format '{{range .Mounts}}{{if eq .Destination "/data/db"}}{{.Name}}{{end}}{{end}}')"
[[ "$volumen" == "normativa_check_mongo_data" ]] || { echo "Volumen distinto al revisado; no se cambia nada."; exit 1; }
etiqueta="$(docker inspect cybersec_mongo --format '{{.Config.Image}}')"
[[ "$etiqueta" == "mongo:7" ]] || { echo "Imagen distinta a mongo:7; revisar antes."; exit 1; }
[[ "$(docker image inspect mongo:7 --format '{{.Id}}')" == "$imagen" ]] || { echo "La etiqueta local apunta a otra imagen; no se actualiza Mongo durante esta conversión."; exit 1; }
echo "$etiqueta"
docker volume inspect "$volumen" --format '{{.Name}}'
[[ -f docker-compose.yml && -f infra/mongodb/replica.compose.yml ]] || exit 1
# Comprobar las credenciales existentes ANTES de parar servicios.
docker exec cybersec_mongo mongosh --quiet --eval 'const a=db.getSiblingDB("admin"); if(!a.auth(process.env.MONGO_INITDB_ROOT_USERNAME,process.env.MONGO_INITDB_ROOT_PASSWORD))quit(2); const h=a.runCommand({hello:1}); if(!h.ok)quit(2); print("Autenticación existente OK; Mongo responde");'
if [[ "${1:-}" != "--aplicar" ]]; then
  echo "Preflight correcto. --aplicar detiene backend/scraper/Mongo, respalda el volumen y configura replica de un nodo."
  echo "Sin seed ni borrados. Si hay fallo, conserva respaldo y requiere revisión."
  exit 0
fi
[[ ! -e docker-compose.override.yml && ! -e compose.override.yaml && ! -e compose.override.yml &&
   ! -e docker-compose.override.yaml ]] || { echo "Ya existe un override; revisar antes de continuar."; exit 1; }
docker exec cybersec_mongo mongosh --quiet --eval 'const a=db.getSiblingDB("admin"); if(!a.auth(process.env.MONGO_INITDB_ROOT_USERNAME,process.env.MONGO_INITDB_ROOT_PASSWORD))quit(2); if(a.runCommand({hello:1}).setName){print("Ya es replica; revisar, no reconvertir");quit(3);}'
runtime="$raiz/.runtime"
[[ ! -L "$runtime" ]] || { echo "Runtime no puede ser enlace"; exit 1; }
mkdir -p "$runtime"
chmod 700 "$runtime"
destino="$(mktemp -d "$runtime/mongo-respaldo-XXXXXXXX")"
chmod 700 "$destino"
echo "Respaldo privado: $destino"
docker inspect cybersec_mongo --format '{{json .Mounts}}' > "$destino/montajes.json"
cp -- docker-compose.yml "$destino/docker-compose.yml"
huella="$(sha256sum docker-compose.yml | cut -d ' ' -f1)"
echo "$huella" > "$destino/compose.sha256"
docker run --rm --network none --entrypoint sh "$imagen" -c 'command -v tar; command -v gzip; id mongodb' >/dev/null
[[ ! -e "$runtime/mongodb" ]] || { echo "Ya existe configuración privada Mongo; revisar manualmente."; exit 1; }
mkdir -m 700 "$runtime/mongodb"
openssl rand -base64 756 > "$runtime/mongodb/keyfile"
uidMongo="$(docker run --rm --network none --entrypoint id "$imagen" -u mongodb)"
gidMongo="$(docker run --rm --network none --entrypoint id "$imagen" -g mongodb)"
[[ "$uidMongo" =~ ^[0-9]+$ && "$gidMongo" =~ ^[0-9]+$ ]] || exit 1
chown "$uidMongo:$gidMongo" "$runtime/mongodb/keyfile"
chmod 400 "$runtime/mongodb/keyfile"
trap 'echo "ERROR: detenido. No borres volúmenes ni restaures encima. Respaldo/configuración en $destino; revisar el paso." >&2' ERR
docker stop cybersec_backend cybersec_scraper
docker stop --time 60 cybersec_mongo
# Copia física EN FRÍO, origen de solo lectura.
docker run --rm --network none --entrypoint tar \
  --mount "type=volume,src=$volumen,dst=/origen,readonly" \
  --mount "type=bind,src=$destino,dst=/respaldo" \
  "$imagen" -czf /respaldo/mongo-data.tar.gz -C /origen .
test -s "$destino/mongo-data.tar.gz"
gzip -t "$destino/mongo-data.tar.gz"
sha256sum "$destino/mongo-data.tar.gz" > "$destino/mongo-data.tar.gz.sha256"
# Verificación estructural de copia, NO ensayo de restauración.
cp -- infra/mongodb/replica.compose.yml docker-compose.override.yml
chmod 644 docker-compose.override.yml
"${compose[@]}" up -d --no-deps mongodb
listo=0
for ((i=0;i<60;i++)); do
  if docker exec cybersec_mongo mongosh --quiet --eval 'quit(db.adminCommand({ping:1}).ok?0:2)' >/dev/null 2>&1; then listo=1; break; fi
  sleep 1
done
[[ "$listo" == 1 ]] || { echo "Mongo no responde"; exit 1; }
docker exec -i cybersec_mongo mongosh --quiet < infra/mongodb/init-replica.js
"${compose[@]}" up -d --no-deps --build backend scraper
"${compose[@]}" up -d --no-deps --force-recreate nginx
echo "Conversión ejecutada. Respaldo: $destino"
echo "Pendiente comprobar health y recorrido real de cuenta/adjuntos desde frontend."
echo "Conserva docker-compose.override.yml: las siguientes ejecuciones Compose deben incluirlo."
