#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 0 ]]; then
  echo 'Uso: bash scripts/backup-mongodb.sh' >&2
  exit 2
fi

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$HOME/Documents/Seguridad"
cd -- "$repo_dir"

if [[ ! -d "$backup_dir" || ! -O "$backup_dir" || "$(stat -c '%a' "$backup_dir")" != 700 ]]; then
  echo "El directorio privado $backup_dir debe existir, pertenecer al usuario y tener permisos 700" >&2
  exit 1
fi

umask 077
export GPG_TTY="$(tty)"
sudo -v

running_services="$(sudo docker compose ps --services --status running)"
stopped_services=()
for service in backend scraper; do
  if grep -qx "$service" <<< "$running_services"; then
    stopped_services+=("$service")
  fi
done

partial=''
restore_services() {
  status=$?
  trap - EXIT INT TERM
  if ((${#stopped_services[@]})); then
    sudo docker compose start "${stopped_services[@]}" || status=1
  fi
  if [[ -n "$partial" ]]; then rm -f -- "$partial"; fi
  exit "$status"
}
trap restore_services EXIT INT TERM

if ((${#stopped_services[@]})); then
  sudo docker compose stop "${stopped_services[@]}"
fi

partial="$(mktemp "$backup_dir/normativa-mongodb-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX.partial")"
final="${partial%.partial}.gpg"

sudo docker compose exec -T mongodb sh -ec '
  : "${MONGO_INITDB_ROOT_USERNAME:?Falta el usuario de MongoDB}"
  : "${MONGO_INITDB_ROOT_PASSWORD:?Falta la contraseña de MongoDB}"
  case "$MONGO_INITDB_ROOT_PASSWORD" in
    *[!0123456789abcdefABCDEF]*)
      echo "La contraseña de MongoDB no tiene el formato hexadecimal generado por make setup" >&2
      exit 1
      ;;
  esac
  printf "password: %s\n" "$MONGO_INITDB_ROOT_PASSWORD" |
    mongodump --config=/dev/stdin \
      --username "$MONGO_INITDB_ROOT_USERNAME" \
      --authenticationDatabase admin \
      --db cybersec_audit --archive --gzip
' | gpg --symmetric --cipher-algo AES256 --output - > "$partial"

test -s "$partial"
gpg --quiet --decrypt --output /dev/null "$partial"
mv -- "$partial" "$final"
partial=''

if ((${#stopped_services[@]})); then
  sudo docker compose start "${stopped_services[@]}"
  stopped_services=()
fi
trap - EXIT INT TERM

echo "Copia cifrada y comprobada: $final"
sha256sum -- "$final"
