#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
[[ "$ROOT" == /home/kali/Documents/practica3/normativa_integracion ]] || { echo "Ruta no autorizada para integración"; exit 1; }
CONFIG="$ROOT/infra/integration/compose.yaml"
export COMPOSE_PARALLEL_LIMIT=1
d() { docker --host unix:///var/run/docker.sock "$@"; }
c() { d compose --env-file /dev/null --project-name normativacheck_integracion --file "$CONFIG" "$@"; }
check_config() {
  [[ -s "$ROOT/.runtime/integration/tls/server.crt" ]] || { echo "Primero: bash scripts/integracion.sh preparar (sin sudo)"; exit 1; }
  c config --quiet
  openssl verify -CAfile "$ROOT/.runtime/integration/tls/ca.crt" -purpose sslserver -verify_ip 127.0.0.2 "$ROOT/.runtime/integration/tls/server.crt"
  openssl x509 -in "$ROOT/.runtime/integration/tls/server.crt" -checkend 604800 -noout
}
check_docker() {
  d info --format '{{.ServerVersion}}' >/dev/null 2>&1 || { echo "No hay acceso al Docker local. Ejecuta esta acción con sudo; no cambies permisos del socket."; exit 1; }
  local id source volume owner
  for id in $(d ps -aq --filter label=com.docker.compose.project=normativacheck_integracion); do
    source="$(d inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$id")"
    [[ "$source" == "$CONFIG" ]] || { echo "Nombre de proyecto ocupado por otra configuración; no se toca."; exit 1; }
  done
  for volume in normativacheck_integracion_mongo_data normativacheck_integracion_mongo_config; do
    if d volume inspect "$volume" >/dev/null 2>&1; then
      owner="$(d volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "$volume")"
      [[ "$owner" == normativacheck_integracion ]] || { echo "Volumen ajeno detectado; no se toca."; exit 1; }
    fi
  done
}
case "${1:-ayuda}" in
  preparar) node "$ROOT/infra/integration/prepare.js"; check_config ;;
  config) check_config ;;
  arrancar)
    check_config; check_docker
    if [[ -z "$(c ps --status running --quiet web)" ]]; then
      node -e 'const s=require("net").createServer();s.once("error",()=>{console.error("Puerto 127.0.0.2:9443 ocupado; no se detiene ningún servicio.");process.exit(1)});s.listen(9443,"127.0.0.2",()=>s.close())'
    fi
    c build backend web
    c up --detach mongodb
    ready=0
    for ((i=0; i<60; i++)); do
      if c exec -T mongodb mongosh --quiet --norc --file /integration/mongo-ready.js >/dev/null 2>&1; then ready=1; break; fi
      sleep 2
    done
    [[ "$ready" == 1 ]] || { echo "Mongo aún no está listo. Datos conservados; revisa estado y registros."; exit 1; }
    c exec -T mongodb mongosh --quiet --norc --file /integration/mongo-init.js
    c up --detach --wait --wait-timeout 180 backend web
    c exec -T mongodb mongosh --quiet --norc --file /integration/mongo-check.js
    node "$ROOT/infra/integration/verify-https.js"
    c ps
    echo "Integración: https://127.0.0.2:9443 (CA local pendiente de confiar en el navegador)."
    ;;
  verificar)
    check_config; check_docker
    c exec -T mongodb mongosh --quiet --norc --file /integration/mongo-check.js
    node "$ROOT/infra/integration/verify-https.js"
    ;;
  actualizar-web)
    check_config; check_docker
    [[ -n "$(c ps --status running --quiet backend)" ]] || { echo "El backend de integración debe estar iniciado; no se arranca ni modifica desde esta acción."; exit 1; }
    c build web
    c up --detach --no-deps --wait --wait-timeout 120 web
    node "$ROOT/infra/integration/verify-https.js"
    echo "Frontend de integración actualizado. Mongo y backend no se han reiniciado."
    ;;
  cuenta-prueba)
    [[ $# == 1 ]] || { echo "Esta acción no acepta parámetros."; exit 1; }
    [[ -t 1 ]] || { echo "Ejecuta desde tu terminal, sin redirigir ni registrar la contraseña."; exit 1; }
    check_config; check_docker
    echo "Creará solo una cuenta y empresa ficticias en nc_integracion si la base está vacía."
    echo "La contraseña aleatoria se mostrará una vez. No crea un admin global ni envía correo."
    # El código viaja por stdin; no contiene claves y usa los secretos ya montados.
    # No hace falta reconstruir/reiniciar el backend para esta operación local.
    c exec -T --env NC_INTEGRATION_TEST_ACCOUNT=1 backend node < "$ROOT/backend/scripts/integration/create-test-workspace.js"
    ;;
  estado) check_docker; c ps ;;
  parar) check_docker; c stop; echo "Solo integración detenida; contenedores y datos conservados." ;;
  *) echo "Uso: bash scripts/integracion.sh preparar|config|arrancar|actualizar-web|verificar|cuenta-prueba|estado|parar"
     echo "Preparar sin sudo. Acciones Docker con sudo si el usuario no tiene acceso."
     echo "No usar el docker-compose.yml heredado ni down -v." ;;
esac
