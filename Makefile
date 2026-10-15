.PHONY: help test test-back test-front build config status up down seed setup cert recert clean
.DEFAULT_GOAL := help

help:
	@echo "NormativaCheck — fuente canónica de la aplicación verde"
	@echo "make test-back  Pruebas unitarias backend (sin Mongo ni SMTP reales)"
	@echo "make test-front Pruebas frontend (requiere npm ci en frontend)"
	@echo "make build      Compila frontend; NO instala ni despliega"
	@echo "make config     Valida un perfil elegido con NC_PRIVATE_COMPOSE"
	@echo "make status     Consulta ese proyecto privado; no crea servicios"
	@echo "Operación/actualización: docs/operacion-privada.md"

test: test-back test-front
test-back:
	cd backend && npm test
test-front:
	cd frontend && CI=true npm test -- --watchAll=false --runInBand
build:
	cd frontend && npm run build
config:
	@test -n "$(NC_PRIVATE_COMPOSE)" || { echo "Falta NC_PRIVATE_COMPOSE: ruta del perfil revisado, no un secreto."; exit 2; }
	docker --host unix:///var/run/docker.sock compose --env-file /dev/null --project-name normativacheck_private --file "$(NC_PRIVATE_COMPOSE)" config --quiet
status:
	@test -n "$(NC_PRIVATE_COMPOSE)" || { echo "Falta NC_PRIVATE_COMPOSE: consulta docs/operacion-privada.md."; exit 2; }
	docker --host unix:///var/run/docker.sock compose --env-file /dev/null --project-name normativacheck_private --file "$(NC_PRIVATE_COMPOSE)" ps

# Old shortcuts must not silently start a different product or regenerate state.
up down seed setup cert recert clean:
	@echo "Atajo antiguo deshabilitado. No se ha cambiado nada."
	@echo "En una instalación existente usa el procedimiento revisado de docs/operacion-privada.md."
	@exit 2
