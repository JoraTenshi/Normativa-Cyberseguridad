# NormativaCheck

Aplicación web para organizar la revisión de requisitos, responsables, documentación y evidencias de pequeñas empresas españolas de ciberseguridad y software. El resultado orienta y documenta el trabajo: **no certifica cumplimiento ni sustituye una revisión profesional**.

## Estado de esta integración

Esta es la fuente común de la nueva interfaz verde y su backend real. La integración se está verificando; compilarla no equivale a tenerla desplegada. La demo pública utiliza ejemplos ficticios y debe permanecer separada de la cuenta real.

El backend dispone de sesiones persistentes, MFA, solicitudes de alta de organizaciones, permisos, contexto empresarial, operaciones, subespacios, PDF privados versionados, historial filtrable y registros normativos. El catálogo de este candidato incluye diez fichas activas, cuatro de ENS. No significa cubrir toda esa normativa. La cobertura editorial futura no está activada por existir un documento de propuesta.

El corte del 16 de octubre de 2026 incorpora RAT, finalidades y flujos, información de privacidad, solicitudes y peticiones de derechos, y detección orientativa de EIPD. Las nuevas pantallas están implementadas y compiladas; la validación final conjunta en navegador sigue pendiente. Consulta el [estado y los límites del candidato](docs/cierre-candidato-20261016.md). Su publicación en una rama de GitHub no acredita despliegue en Hetzner ni aceptación de producción.

Las actuaciones normativas permiten asignar una membresía responsable, registrar cuatro estados, enlazar evidencias, revisar y conservar versiones. **No son todavía el gestor colaborativo de tareas por equipos**. Votaciones, notificaciones en tiempo real, nuevas métricas, PDS del nuevo modelo e IA siguen pendientes. Consulta [la matriz de implementación](docs/integracion-verde.md).

## Qué ejecutar y dónde

- **Desarrollo y pruebas:** Node24, dependencias exactas mediante `npm ci` en `backend` y `frontend`. `make test-back`, `make test-front` y `make build` no despliegan. No usar credenciales ni URI de bases reales al ejecutar pruebas.
- **Servidor privado:** únicamente el perfil de `infra/private`, con HTTPS sobre WireGuard, Mongo autenticado y estado fuera del código. Lee [operación privada](docs/operacion-privada.md) antes de cualquier arranque o actualización.
- **Laboratorio anterior de Kali:** `infra/integration` y `scripts/integracion.sh` se conservan como referencia compatible con aquella instalación. No son el perfil Hetzner ni la entrada principal de esta app.

Un clon nuevo **no crea cuentas, claves, certificados o bases automáticamente**. `docker compose up` sin perfil explícito se detiene. Los antiguos `make up`, `seed`, `setup`, `cert`, `recert` y `clean` ya no ejecutan la app de cuestionarios ni cambian el estado.

No verifiques el correo ni concedas permisos modificando Mongo a mano. El registro real requiere SMTP configurado, verificación por correo y MFA. La primera capacidad de gestión de altas exige el paso administrativo explícito documentado; coincidir con una dirección de correo no concede permisos.

## Estructura y límites

- `frontend/`: una única aplicación; portada, demo identificada, autenticación y Workspace.
- `backend/`: API y reglas de negocio; todos los permisos se comprueban en el servidor.
- `infra/private/`: plantillas versionadas de la instalación privada; sin secretos.
- `scripts/private/`: preparación de configuración e identidad de entrega; no sustituye la validación operativa.
- `docs/`: contratos, decisiones, limitaciones y operación.

El código de resultados, puntuaciones, PDS y licitaciones anteriores se conserva para reconciliar dependencias e históricos. No representa la nueva metodología ni debe mostrarse como una función terminada del producto verde. No se han borrado datos ni fuentes únicas. Véase [la separación del legado](docs/integracion-verde.md#legado-y-limpieza).

No subir `.env`, claves, certificados privados, PDFs de usuarios, bases, volcados, datos QA ni paquetes de despliegue a Git. Las pruebas locales, la prueba con Mongo, la revisión en navegador y la instalación en el servidor son verificaciones distintas.
