# Operación privada: instalación, arranque y actualización

## Una aplicación, tres servicios, estado separado

El perfil privado sirve la web a través de WireGuard en el puerto elegido por el operador. La instalación comprobada por Servidor el 16 de octubre de 2026 utiliza `https://10.77.77.1:8443/`; el puerto 9443 de las plantillas o del laboratorio histórico no identifica esa instalación vigente. Mongo y backend no publican puertos. Proyecto Compose: `normativacheck_private`; base: `nc_private`; réplica: `nc-private-rs`. La aplicación usa `nc_app` con `readWrite` solo en esa base, no la cuenta de inicialización.

Esta guía conserva el alcance del perfil R3. El estado de la entrega académica, las comprobaciones acreditadas y los cambios todavía no integrados se distinguen en [entrega-practica3.md](entrega-practica3.md). No ejecutar herramientas históricas o propuestas posteriores sobre la instalación activa sin la revisión específica de Servidor.

El código pertenece a una entrega inmutable bajo `/srv/normativacheck/releases/`. Secretos y TLS están bajo `/srv/normativacheck/state/`. Los volúmenes de Mongo no pertenecen al directorio de código. Actualizar una entrega no autoriza regenerar claves, vaciar volúmenes ni crear una segunda base.

## Qué está preparado y qué falta

Las fuentes del perfil ya probado se incorporan aquí para que el repositorio sea autosuficiente. La generación de configuración es reproducible y no inicia servicios. El nuevo procedimiento de actualización está en preparación: **no ejecutar el generador encima de la instalación activa ni interpretar sus pruebas como un despliegue**.

En el servidor actual el montaje `/private` del contenedor Mongo apunta a la entrega anterior. Esa entrega debe conservarse mientras exista esta dependencia. Un cambio de ruta del frontend no es motivo para recrear Mongo.

## Generar configuración, sin instalarla

1. Parte de `infra/private/profile.example.json`. Introduce la ruta exacta de la nueva entrega, el estado existente, el puerto privado y la unidad WireGuard. No incluyas secretos.
2. Ejecuta `node scripts/private/render-profile.cjs PERFIL_JSON DIRECTORIO_NUEVO_ABSOLUTO`. El directorio de salida no puede existir. Genera Compose, nginx, una unidad propuesta y un manifiesto. No los copia al servidor.
3. El operador revisa las rutas y la identidad de la entrega antes de instalar. `NC_PRIVATE_COMPOSE=/ruta/al/compose.yaml make config` solo valida la sintaxis; `make status` solo consulta. El despacho Compose de la raíz requiere versión2.20.3 o posterior y un perfil explícito.

No instalar la unidad systemd hasta probar el reinicio supervisado con WireGuard. La plantilla se vincula a esa unidad, no expone la web en la IP pública y no reconstruye imágenes durante un reinicio.

## Actualizar una instalación existente

Orden exigido antes de activar otra entrega:

1. Congelar fuente, dependencias, build y manifiesto; comprobar `release.json` sin información sensible.
2. Inspeccionar los contenedores actuales, imágenes por digest/ID, montajes, redes y rutas de secretos; no imprimir valores secretos.
3. Comparar modelos, índices declarados y catálogo. La igualdad de modelos no garantiza compatibilidad semántica con un catálogo anterior.
4. Preparar imágenes sin sustituir contenedores. Acordar una ventana breve de mantenimiento.
5. Detener solo los escritores de la aplicación. Crear una copia privada recuperable y probar su restauración en un entorno aislado. Definir su custodia antes de incluir datos reales.
6. Comprobar que la base no cambió durante la copia. Activar solo backend/web por identidad fijada, manteniendo Mongo, claves, TLS y volúmenes.
7. Comprobar salud, HTTPS, permisos negativos, hashes de lo servido y un recorrido funcional en navegador. Solo entonces aceptar la nueva entrega.

El núcleo de planificación incluido en `update-policy.cjs` no ejecuta estos pasos: no es todavía un actualizador operativo. Requiere evidencias obtenidas por el adaptador del operador. Nunca ejecutar `down -v`, `prune`, un seed o restauración automática como paso de actualización.

## Volver atrás no es restaurar datos

No ofrecer vuelta automática al candidato anterior227 después de registrar datos ENS3. Aunque los modelos sean iguales, aquel catálogo no contiene las nuevas fichas. Una reversión de código exige demostrar compatibilidad y ausencia de cambios incompatibles; una restauración de datos exige una decisión separada. El plan conservador deniega la reversión cuando cambia el catálogo o cualquier contenido de la base.

## Correo y primera cuenta: después de la validación

SMTP está deshabilitado por defecto. Cuando se habilite, `smtp_config` se introducirá directamente como secreto del servidor, nunca por chat, historial de comandos ni Git. El perfil admite TLS implícito465 y el backend no muestra enlaces de recuperación al no disponer de correo.

José registrará `normativacheck@gmail.com`, verificará el correo y activará MFA de la app. Después se ejecutará el paso explícito `backend/scripts/private/designar-gestor-altas.js` sobre esa cuenta concreta. No crea una organización ni permite aprobar la solicitud propia. La política de alta de la empresa de José requiere resolver esa separación, no eludirla con una segunda cuenta.
