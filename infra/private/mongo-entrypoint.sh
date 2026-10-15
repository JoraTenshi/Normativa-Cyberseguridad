#!/usr/bin/env bash
set -Eeuo pipefail
install -o mongodb -g mongodb -m 0400 /run/secrets/mongo_keyfile /run/mongo-private/keyfile
export MONGO_INITDB_ROOT_USERNAME=nc_bootstrap
export MONGO_INITDB_ROOT_PASSWORD
MONGO_INITDB_ROOT_PASSWORD="$(< /run/secrets/mongo_root_password)"
[[ $MONGO_INITDB_ROOT_PASSWORD =~ ^[a-f0-9]{64}$ ]] || exit 2
exec /usr/local/bin/docker-entrypoint.sh "$@"
