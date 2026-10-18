# Integración de Workspace en la aplicación final

Actualizado: 11 de octubre de 2026. Estado: bloques 3 y 4 implementados y bloque 5 de infraestructura arrancado y verificado. Los tres contenedores están Healthy según la captura de Jose; Mongo real y HTTPS pasan la verificación final. Pendientes acceso confiable desde navegador y E2E autenticado de este despliegue.

Guía y evidencia histórica del bloque 5: [arranque-integracion.md](arranque-integracion.md). Documenta el perfil de integración ensayado; no es la ruta de instalación docente ni acredita una puesta en producción.

## Punto de trabajo y procedencia

La rama de integración es `integracion/workspace-20261011`, en `/home/kali/Documents/practica3/normativa_integracion`. Se creó como worktree independiente sobre `origin/practica3@519605bec16fe0bd26064150b089e9bc4ad8b3ec`, de JoraTenshi/Normativa-Cyberseguridad, verificado en el remoto.

El frontend procede de esa rama publicada. El backend ampliado se incorporó desde el árbol de trabajo de `/home/kali/Documents/practica3/normativa_check`, rama `backend@fb99b0adde243d3473b8e2198f0a55d08604e7f0`, incluyendo los módulos aún no confirmados. No es equivalente al backend publicado de GitHub.

No se han modificado los archivos de los dos checkouts de origen ni el laboratorio de Windows. El fetch actualizó la referencia remota del repositorio de backend; el worktree comparte su almacén Git, pero tiene índice, rama y archivos propios. Sin commit ni push de la integración. Los archivos nuevos figuran aún como untracked: antes de publicar habrá que revisar y añadir selectivamente todos los módulos necesarios.

Se importó código, pruebas y documentación seleccionada. No se copiaron .env, credenciales, bases de datos, volúmenes Docker ni node_modules del origen. Las dependencias se instalaron desde los lockfiles en el árbol nuevo, con scripts de instalación deshabilitados y sin actualizar versiones. No se ejecutó una auditoría completa de dependencias.

## Qué se ha unido realmente

- Backend ampliado: organizaciones, membresías y unidades, subespacios, documentación privada y versiones, historial y exportaciones, contexto de empresa, operaciones y decisiones de aplicabilidad. Su importación no equivale a verificar todo el recorrido en la nueva app.
- Autenticación persistente nueva: login y MFA crean una sesión en Mongo; el middleware comprueba su vigencia y la versión actual de credenciales.
- Frontend publicado: conserva sus pantallas. El formulario de acceso ya envía la preferencia «Mantener la sesión en este dispositivo».
- Reparación de la suite frontend: importación de API corregida en WorkspacePage.test.jsx y pruebas adaptadas a ReactDOM/jsdom ya disponibles, sin nuevas dependencias. Se conserva la cobertura de carga, vacío, filtros, errores y reintento.

La ruta /espacio-de-trabajo ya apunta a frontend/src/connected/ApiWorkspace.jsx: selector real de organizaciones y componentes conectados de contexto, operaciones/cuestiones, subespacios, documentos e historial portados desde Windows. No usa /demo/login ni una empresa suministrada manualmente. El histórico heredado sigue en /historial y su código se conserva; NO equivale al nuevo dashboard de métricas.

## Sesiones: código y decisiones

`backend/services/accesoSesion.js` une identidad y persistencia:

1. Conserva la versión de credenciales usada al comprobar la contraseña o el segundo factor.
2. Crea el registro persistente mediante sesionesUsuario.js.
3. Relee la cuenta en el primario. Si la versión, la verificación del correo o el estado MFA han cambiado, no entrega el acceso.
4. Emite una cookie HttpOnly, Secure y SameSite=Strict con un JWT de tipo propio. El identificador se almacena como SHA-256 en Mongo; la respuesta JSON no contiene el token.
5. Cada petición protegida vuelve a comprobar la cuenta y la sesión. El vencimiento no depende del reloj del navegador.

Máximo absoluto: ocho horas desde autenticación. Inactividad: treinta minutos. Conservar la cookie al cerrar el navegador no amplía estos límites. Una cookie de sesión sin persistencia tampoco garantiza que un navegador con restauración de sesiones la borre al cerrar: la protección efectiva son los límites y la revocación del servidor.

Contratos HTTP (nginx añade el prefijo público /api):

- POST /auth/login: email, password y mantenerSesion booleano opcional, falso por defecto.
- POST /auth/2fa/verify: solo token TOTP. La preferencia de persistencia queda ligada al desafío de contraseña, no se puede cambiar en este segundo paso.
- GET /auth/session: estado temporal de la sesión, sin modificar actividad.
- POST /auth/session/actividad: cuerpo vacío {}, cookie y protección de origen. El servidor fija la fecha. No se debe llamar desde un temporizador sin interacción real.
- POST /auth/logout: revoca la sesión concreta y cancela el desafío MFA pendiente. Si Mongo falla, devuelve 503; no simula un cierre correcto.
- La recuperación de contraseña incrementa sessionVersion y hace inválidas las sesiones anteriores. Activar o desactivar MFA también incrementa esa versión y exige volver a acceder.

El servidor normal usa `createApp()`, cuya política por defecto es persistente y rechaza tokens heredados. La opción `legado_pruebas` solo se declara al construir fixtures y runners históricos; no puede seleccionarse mediante una petición o variable de entorno. Estas pruebas antiguas NO acreditan por sí solas el nuevo login.

El control de caducidad protege los endpoints y el frontend ya consulta la sesión, comunica actividad real, avisa y bloquea con conservación del borrador en memoria. El bloque 4 se detalla más abajo. La reautenticación reciente para acciones sensibles sigue pendiente de definir e implementar; no declarar completo el cierre de seguridad ni el despliegue.

## Verificación histórica del bloque 3 (véase actualización del bloque 4)

En el árbol de integración:

- Backend: 845/845 pruebas de regresión. Los fixtures históricos de autenticación usan explícitamente la política de legado.
- Nueva autenticación: 19 grupos HTTP contra MongoDB 7.0.43 temporal, sin credenciales reales ni SMTP. Incluyen cookies, persistencia, contraseña, MFA, replay y concurrencia, reset concurrente, caducidad, revocación individual, aislamiento entre organizaciones y fallo de almacenamiento.
- Frontend: 28/28 pruebas, tres suites.
- Build frontend: compilación de producción correcta.
- git diff --check: correcto.

Los 19 grupos nuevos usan la política persistente por defecto, contraseña real de cuentas sintéticas, TOTP y Mongo; no fabrican un token para saltarse el login. Las pruebas manejan manualmente cookies en HTTP de laboratorio: no prueban el comportamiento de cookies Secure/SameSite, reapertura ni múltiples pestañas en un navegador HTTPS. No hay E2E conjunto ni despliegue.

Los 21 grupos Mongo del servicio de sesiones se documentaron en el bloque anterior, no se suman a las pruebas ejecutadas de nuevo aquí.

Comandos repetibles:

```bash
cd /home/kali/Documents/practica3/normativa_integracion/backend
npm test
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-acceso-sesion-mongo.js

cd /home/kali/Documents/practica3/normativa_integracion/frontend
CI=true npm test -- --watchAll=false --runInBand
npm run build

cd /home/kali/Documents/practica3/normativa_integracion
git diff --check
```

El binario de prueba está en /tmp: puede desaparecer tras un reinicio. Si no existe, hay que localizar un mongod compatible. No sustituirlo por la URI de una base real. El runner restringe su uso a su propia instancia loopback temporal y elimina solo los datos sintéticos que crea.

## Orden de los próximos bloques

1. Infraestructura aislada completada y verificada. Continuar con confianza de CA, túnel si se usa Windows y cuenta/empresa sintéticas para el navegador. Comprobar después persistencia tras reinicio. No ejecutar el Compose heredado.
2. Cerrar reautenticación reciente de acciones sensibles y revisión de seguridad de rutas heredadas, límites/dependencias y acceso organizativo. La protección de generación/X-Session-User de Axios cubre /me y /organizaciones; el cuestionario público heredado /resultado requiere revisión específica de su flujo anónimo/autenticado antes de exposición final.
3. Completar E2E con HTTPS: MFA en navegador, restauración tras cerrar/reabrir, permisos revocados durante edición, conflictos concurrentes, subida/descarga/compartición PDF, fallos de red y cierre incierto. El bloque 4 solo cubre el recorrido acotado que se enumera abajo.
4. Unificar portada, navegación y lenguaje del producto: la portada conserva mensajes de puntuación antiguos; no presentarla como propuesta definitiva. Mejorar selectores por nombre para compartir documentos y distinguir claramente historial de actividad de evaluaciones heredadas.
5. Revisar el diff y añadir selectivamente archivos nuevos, confirmar/publicar cambios y planificar promoción a rama final. Sin borrar código o datos históricos por inferencia.

La nueva métrica de cumplimiento y su dashboard no se implementan en este bloque. Se conserva el acuerdo de derivar la valoración de requisitos revisados favorablemente, con alcance/denominador visibles y sin equipararla a una certificación.

## No arrancar todavía el Compose heredado en este checkout

docker-compose.yml sigue usando nombres fijos cybersec_* y Mongo sin la configuración nueva de replica set. No se ha editado ni ejecutado. Arrancarlo ahora puede colisionar con el entorno del equipo y no demuestra que las transacciones funcionen.

El bloque 5 separó nombres/puertos/volúmenes y preparó secretos/TLS y una réplica propia; se arrancó únicamente el nuevo Compose infra/integration/compose.yaml. No se copió .env ni se conectó a volúmenes del equipo. No se han aplicado migraciones ni realizado seeds sobre datos existentes.

## Bloque 4 — sesión frontend y Workspace conectado (11/10/2026)

### Qué hace cada pieza

- frontend/src/session/session-machine.js mantiene el estado de sesión. Solo acepta identidad de GET /auth/session; ni localStorage ni la respuesta de login por sí sola autentican la pantalla. Usa tiempo de pared y monotónico para no prolongar el contador al suspender el equipo o atrasar el reloj. La decisión definitiva sigue en Mongo.
- frontend/src/context/AuthContext.jsx une ese estado a React: sondeo de solo lectura, eventos reales visibles de teclado/puntero/entrada/rueda con límite de una comunicación por minuto, comprobación al volver a la pestaña y BroadcastChannel con señales sin credenciales. El sondeo no renueva actividad.
- frontend/src/session/SessionBoundary.jsx oculta sin desmontar el formulario al bloquear; muestra reidentificación y conserva la clave del árbol para la misma cuenta. Otra cuenta cambia esa clave y destruye el árbol anterior. El cierre solo borra identidad tras confirmación del servidor; un 503 mantiene el bloqueo y avisa.
- frontend/src/session/DraftNavigationGuard.jsx usa useBlocker y el data router de React Router ya instalado (sin actualizar paquetes). Protege enlaces internos, navegación programática y Atrás/Adelante dentro de la app. Su diálogo permite seguir editando o descartar explícitamente. beforeunload cubre las salidas de documento que el navegador permita advertir. No hay garantía de recuperación tras cerrar, recargar, caída o cierre forzoso: los borradores no se persisten.
- frontend/src/session/session-bridge.js, transport.js, services/api.js y api-client.js coordinan HTTP con la sesión. El middleware comprueba X-Session-User en los recursos protegidos; el cliente descarta respuestas de una generación anterior. Un resultado tardío de escritura se trata como incierto y conserva su clave idempotente, no como permiso para repetir una operación nueva.
- frontend/src/connected/ApiWorkspace.jsx lista membresías desde GET /me/organizaciones; no crea empresas ni concede permisos. Recomprueba membresías tras reidentificación. Los demás componentes conectados reutilizan permisos, control de versiones, documentos y trazabilidad del backend.
- backend/routes/me.js incorpora el selector paginado con solo id, nombre y rol: empresas activas y membresías válidas del usuario autenticado, sin aceptar un ID de usuario suministrado. El rol global no sustituye membresía.

La ruta pública de los contratos usa /api. GET /auth/session y POST /auth/session/actividad devuelven ahora usuario mínimo (id, nombre, email, MFA y fecha de creación), además de los límites. No hay JWT en JSON ni borradores en almacenamiento web.

Un código TOTP incorrecto al configurar MFA se presenta como error del segundo factor, no como sesión caducada. Un sondeo/foco/bloqueo de pestaña no cancela un logout ya enviado.

### Pruebas repetidas

- Backend: 845/845 regresiones; cero fallos, omisiones y cancelaciones. Una prueba estática de destino tras login se ajustó de / a /espacio-de-trabajo, manteniendo los casos negativos de redirección externa.
- Autenticación persistente: 24 grupos HTTP + MongoDB 7.0.43 temporal, incluidos cinco nuevos para identidad mínima, selector/estados/paginación/revocación, cuenta cambiada y operación con historial.
- Frontend: 62/62 pruebas, siete suites. Incluyen máquina de estados, conservación real del input React, cierre fallido, cambio de cuenta, selector y bloqueo de navegación.
- Build de producción correcto (main JS 118,32 kB gzip); sin nuevas dependencias. CRA/Node sigue mostrando un aviso de deprecación fs.F_OK: no impidió compilar ni equivale a una auditoría de dependencias.
- git diff --check correcto.

### Recorrido de navegador verificado con datos sintéticos

Se sirvió el build CRA y la API real con sesión persistente, bajo un mismo origen loopback mediante túnel SSH. El runner backend/scripts/serve-workspace-browser-check.js crea SU propia réplica Mongo temporal y cuentas ficticias; no carga .env ni admite la base del equipo. Desactiva rate limits solo en este fixture. No incluye endpoint HTTP de login demo; se entra por el formulario normal.

Comprobado: login y selección de organización; rechazo del guardado tras forzar vencimiento solo en la fixture; diálogo bloqueado; reidentificación de la misma cuenta con los tres campos del formulario intactos; guardado posterior explícito de operación; consulta del evento correspondiente; filtro por operaciones; descarga CSV y Excel con nombre/acción de prueba comprobados en los archivos; restauración de sesión al recargar; logout desde segunda pestaña y bloqueo de la primera; otra cuenta sin heredar el borrador y sin controles administrativos habilitados.

Esto es E2E PARCIAL sobre HTTP localhost: la aceptación de una cookie Secure en localhost NO acredita TLS ni SameSite en el despliegue final. No se probó cierre/reapertura completa del navegador, móvil, MFA visual ni el recorrido completo PDF/conflictos/revocación de membresía. No es una aplicación final desplegada ni una certificación del producto.

El runner tiene límite de 45 minutos; al detenerlo finaliza su mongod y elimina solo su directorio temporal sintético. El puerto 4280 fue exclusivo de QA. No usar estas cuentas ni la desactivación de rate limits en despliegue.

### Estado del alcance

Contexto, operaciones, subespacios, PDF privado e historial están conectados en código; no todos han recibido E2E en este bloque. Las cuestiones RGPD se muestran como borrador técnico pendiente de revisión/publicación. Tareas colaborativas, PDS y métricas revisadas NO se implementan por portar el Workspace. Compartir documentos aún utiliza IDs de miembros/unidades; falta un selector legible.

No hay commit/push, migraciones, cambio de Docker/.env, datos reales o modificación de los checkouts originales/ux-lab. Los cambios se encuentran únicamente en normativa_integracion; ejecutar la app antigua no los muestra.

Referencia del bloqueo de navegación: https://reactrouter.com/6.30.1/hooks/use-blocker

## Cierre del bloque 5: infraestructura verificada

La captura final de Jose confirma que sudo bash scripts/integracion.sh verificar termina correctamente: certificado válido, usuario de aplicación sin privilegios administrativos, commit y abort reales y comprobaciones HTTPS positivas. Otra captura previa muestra MongoDB, backend y web Healthy. La comprobación HTTPS se ejecutó también desde SSH contra los contenedores reales, con CA explícita y sin desactivar TLS.

Los comprobadores de Mongo y HTTPS verifican transacciones, nombre TLS y rechazo del `Host` incorrecto sin imprimir credenciales en sus diagnósticos.

Verificación actual:

- 13/13 pruebas dirigidas: siete de configuración/paquete/diagnóstico y seis del comprobador Mongo con dobles. Estos dobles no se presentan como pruebas de Mongo real.
- 858/858 pruebas backend en la regresión completa más reciente; cero fallos, omisiones o cancelaciones. No son pruebas de navegador.
- HTTPS real: frontend 200, API 200 con Mongo conectado, sesión anónima 401, origen ajeno 403 y Host incorrecto 421. Nombre TLS ajeno rechazado.
- Mongo real: evidencia de ejecución de Jose con el usuario limitado y commit/abort correctos.
- Comprobaciones estáticas Compose/Nginx y git diff --check correctos.

Esta verificación histórica no sustituye la aceptación docente. En este perfil seguían pendientes la confianza de la CA en el navegador, el E2E autenticado y la prueba de persistencia tras reinicio. SMTP continuaba deshabilitado.
