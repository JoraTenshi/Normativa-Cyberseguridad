#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" || -L "$1" ]]; then
  echo 'Uso: bash scripts/verify-mongodb-backup.sh /ruta/a/copia.gpg' >&2
  exit 2
fi

backup_file="$(realpath -- "$1")"
container_name="normativa_restore_check_$(date -u +%Y%m%dT%H%M%SZ)_$RANDOM"
export GPG_TTY="$(tty)"
sudo -v

cleanup() {
  status=$?
  trap - EXIT INT TERM
  sudo docker rm --force "$container_name" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT INT TERM

image_id="$(sudo docker inspect --format '{{.Image}}' cybersec_mongo)"
sudo docker run --detach --rm \
  --name "$container_name" \
  --network none \
  --tmpfs /data/db:rw,size=536870912 \
  "$image_id" mongod --bind_ip 127.0.0.1 >/dev/null

ready=false
for ((attempt = 0; attempt < 30; attempt++)); do
  if sudo docker exec "$container_name" mongosh --quiet --eval 'db.adminCommand({ping: 1}).ok' 2>/dev/null | grep -qx 1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo 'El MongoDB temporal no arrancó en 30 segundos' >&2
  exit 1
fi

gpg --quiet --decrypt -- "$backup_file" |
  sudo docker exec -i "$container_name" mongorestore --archive --gzip

sudo docker exec "$container_name" mongosh cybersec_audit --quiet --eval '
  const names = db.getCollectionNames();
  if (names.length === 0) quit(2);
  print(JSON.stringify(names.map(name => ({
    collection: name,
    documents: db.getCollection(name).countDocuments({}),
    indexes: db.getCollection(name).getIndexes().length
  }))));
'

echo 'Restauración aislada completada; se elimina el contenedor temporal.'
