#!/usr/bin/env bash
set -Eeuo pipefail
# El secreto original sigue siendo solo lectura; mongod exige 0400 y su UID.
install -o mongodb -g mongodb -m 0400 /run/secrets/mongo_keyfile /run/mongo-private/keyfile
# La imagen oficial baja a UID mongodb antes de leer *_FILE.
# Leer como root evita hacer legible la contraseña administrativa para otros UID.
export MONGO_INITDB_ROOT_USERNAME=nc_bootstrap
export MONGO_INITDB_ROOT_PASSWORD
MONGO_INITDB_ROOT_PASSWORD="$(< /run/secrets/mongo_root_password)"
exec /usr/local/bin/docker-entrypoint.sh "$@"
