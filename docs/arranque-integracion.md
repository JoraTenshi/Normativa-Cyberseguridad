# Arranque aislado de la integración: HTTPS y MongoDB

> Registro técnico del perfil de integración de octubre de 2026. No es la guía para instalar la demo docente actual; para esa instalación, usa [el README](../README.md#para-el-profesorado).

Actualizado: 11 de octubre de 2026. Integración aislada arrancada: los tres contenedores Healthy y verificación Mongo/HTTPS correcta en las capturas de Jose, contrastada además por HTTPS desde Kali. Pendientes confianza del navegador, cuenta/empresa de prueba, E2E autenticado en este despliegue y persistencia tras reinicio. No es producción ni sustituye a la app del equipo.

## Qué cambia y qué permanece intacto

Todo pertenece a /home/kali/Documents/practica3/normativa_integracion, rama integracion/workspace-20261011. No se modifica el Compose heredado, los Dockerfiles del equipo, sus archivos .env, volúmenes, usuarios ni puertos. No hay commit o push.

El nuevo proyecto Compose se llama normativacheck_integracion. Solo publica https://127.0.0.2:9443, en loopback. Se elige otra dirección además de otro puerto porque las cookies no se aíslan por puerto. No se usa localhost ni 127.0.0.1 para esta instancia.

MongoDB y backend no publican puertos en Kali. MongoDB está en una red interna; el backend tiene acceso a esa red y a la de Nginx. No se añade scraper ni sincronización de licitaciones.

## Primer arranque

La preparación de claves y certificados YA se ha ejecutado. Repetirla valida lo existente, sin regenerarlo:

~~~bash
cd /home/kali/Documents/practica3/normativa_integracion
bash scripts/integracion.sh preparar
~~~

Para levantar la integración:

~~~bash
cd /home/kali/Documents/practica3/normativa_integracion
sudo bash scripts/integracion.sh arrancar
~~~

El script apunta al socket Docker local y a un único archivo Compose; no depende del .env del equipo. Primero comprueba configuración y aislamiento, construye las imágenes secuencialmente, levanta MongoDB, inicia o valida su réplica, crea o comprueba el usuario limitado, espera al backend y Nginx y ejecuta comprobaciones de Mongo/HTTPS.

Si un nombre de proyecto, volumen o puerto pertenece a otra configuración, se detiene. Si falla una comprobación, conserva los datos y muestra el fallo; no hace limpieza destructiva ni resetea contraseñas. Revisar el error antes de repetir. No ejecutar docker-compose.yml ni down -v desde esta copia.

La primera construcción descarga imágenes/dependencias y compila el frontend. Reiniciar posteriormente conserva los datos y reutiliza las capas de build que no hayan cambiado.

## Operación habitual

~~~bash
sudo bash scripts/integracion.sh estado
sudo bash scripts/integracion.sh verificar
sudo bash scripts/integracion.sh parar
sudo bash scripts/integracion.sh arrancar
~~~

parar solo detiene los tres servicios del proyecto aislado; no elimina contenedores ni volúmenes. restart: unless-stopped recupera procesos cuando Docker vuelve a iniciarse, salvo los parados expresamente. No se ha cambiado el arranque de Docker ni la configuración del sistema operativo de Kali.

Para consultar registros, siempre seleccionar el proyecto y archivo explícitos:

~~~bash
sudo docker --host unix:///var/run/docker.sock compose --env-file /dev/null \
  -p normativacheck_integracion -f infra/integration/compose.yaml \
  logs --tail 80 backend mongodb web
~~~

No publicar registros completos sin revisarlos: el arranque nuevo evita imprimir claves, pero los módulos históricos también generan registros.

## Qué hace cada pieza

- infra/integration/compose.yaml: tres servicios, dos redes, volumen de datos y volumen de configuración propios, secretos montados por servicio, límites de registros y comprobaciones de salud. Sin container_name fijo.
- scripts/integracion.sh: entrada única y acotada a esta ruta de Kali. No cambia permisos del socket Docker, no concede sudo ni modifica grupos del sistema.
- infra/integration/prepare.js: crea secretos aleatorios diferentes y certificados; exige usuario kali UID 1000. Directorios 0700 y archivos sensibles 0600. Si una preparación está incompleta o no coincide, no la sobrescribe.
- infra/integration/mongo-entrypoint.sh: adapta los permisos del keyfile dentro del contenedor y delega el arranque en la imagen oficial.
- infra/integration/mongo-ready.js y mongo-init.js: distinguen el arranque temporal de la imagen del mongod definitivo, validan la réplica y crean solo el usuario de aplicación si aún no existe.
- backend/scripts/integration/config.js y start.js: no cargan .env; construyen la conexión privada, validan claves y origen, esperan al primario y a los índices y arrancan la aplicación con su política normal.
- backend/scripts/integration/health.js: comprueba tanto API como primario MongoDB, no solo que exista un proceso.
- infra/integration/nginx.conf: sirve el build del frontend y publica /api bajo el mismo HTTPS. Rechaza otro Host, no registra query strings/cookies, no cachea las respuestas y no reintenta automáticamente escrituras fallidas.
- Dockerfile.integration y su .dockerignore, en backend y frontend: usan npm ci, lockfiles y listas de copia; no incorporan .env, secretos, bases, node_modules locales o todo el repositorio. Scripts de instalación deshabilitados, como en la preparación anterior.
- infra/integration/check-static.js: comprobación sin daemon de aislamiento, permisos y sintaxis.
- infra/integration/mongo-check.js: prueba de permisos y commit/abort con una colección técnica y documentos sintéticos propios.
- infra/integration/verify-https.js: verifica certificado/CA/dirección, frontend, salud de API, rechazo de sesión anónima, origen ajeno y Host incorrecto. No sustituye a probar login en navegador.

Las imágenes se han resuelto y fijado por digest Linux amd64 en el registro oficial: MongoDB 7.0.43, Node 24 (misma versión mayor que el entorno nativo de Kali) y Nginx stable-alpine. No se han actualizado los paquetes de la aplicación ni sus lockfiles. Revisar expresamente los digests cuando se programe una actualización de seguridad; no se actualizan solos.

## MongoDB, persistencia y documentos PDF

La base nueva se llama nc_integracion. Volúmenes propios: normativacheck_integracion_mongo_data y normativacheck_integracion_mongo_config.

La réplica nc-integration-rs tiene un único miembro, mongodb:27017. Permite transacciones; NO alta disponibilidad. Si Kali o ese nodo se detienen, la integración no tiene servicio.

nc_bootstrap solo administra MongoDB en los scripts del contenedor. El backend usa nc_app, con readWrite exclusivamente en nc_integracion. La contraseña administrativa no se monta en el backend.

El usuario de aplicación puede crear sus índices, pero no consultar la base administrativa. Las pruebas preparadas comprueban esa limitación y que una transacción confirmada se guarda y una abortada no. La colección técnica _integration_probe puede permanecer vacía; el script elimina únicamente el documento sintético que acaba de crear.

Los PDF continúan usando los modelos de versiones ya implementados: máximo 5 MiB por archivo y 100 MiB acumulados por organización. Los bytes y el evento se guardan en transacción en MongoDB; no se incorpora GridFS en este bloque. Nginx admite hasta 6 MiB para que la petición llegue a la validación específica de la API. No hay carpeta pública de documentos ni análisis externo.

Persistencia NO equivale a copia de seguridad. Antes de usar datos reales quedan por verificar backup/restauración y custodia de claves. No trasladar únicamente el volumen y perder JWT_SECRET o TOTP_ENCRYPTION_KEY.

## HTTPS local y confianza

La URL es https://127.0.0.2:9443. El certificado incluye exactamente esa IP. La CA local dura 365 días y el certificado de servidor 90; la comprobación de arranque avisa fallando cuando quedan menos de siete días.

Ruta pública de CA:
.runtime/integration/tls/ca.crt

Huella SHA-256 de la CA generada:
71:78:4A:5A:48:9C:2B:EF:62:8E:A7:E5:9A:D4:8B:21:60:0B:98:B8:AA:A1:80:B1:F4:AC:70:68:5A:86:8E:1C

No se ha instalado esta CA en ningún almacén de confianza. La verificación técnica usa la CA explícita y no desactiva validación TLS. El navegador necesitará confiar conscientemente en el certificado público; no usar excepciones ni ignorar advertencias como sustituto de la validación.

No copiar ni importar ca.key, server.key ni la carpeta secrets. Importar una CA es una decisión de confianza del equipo; debe hacerse solo tras contrastar la huella. La autoridad es exclusivamente de desarrollo local, no una certificación pública ni un sello de tiempo.

Para verla desde Windows hará falta un túnel, una vez que el servidor esté sano:

~~~powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.2:9443:127.0.0.2:9443 kali
~~~

El túnel debe permanecer abierto. No se ha configurado autoarranque del túnel ni del navegador. Se mantiene la misma URL y, por tanto, el mismo origen en Kali y Windows. El puerto no queda accesible desde la red local.

HTTPS protege navegador-Nginx. MongoDB usa autenticación y red Docker privada; no se ha incorporado TLS entre contenedores. Esta configuración local no debe publicarse en Internet sin revisar despliegue, secretos, TLS interno, dependencias, límites y controles pendientes.

## Estado de acceso y datos

La base empieza VACÍA: sin datos importados, resultados sembrados, cuentas demo o administradores automáticos. Una cuenta de la app del equipo no existe por ello aquí.

SMTP está expresamente sin configurar en esta entrada. No se envían correos ni se muestran enlaces de verificación o recuperación. Por tanto, registro y recuperación por correo no están listos para uso normal en este entorno. El frontend conectado necesita una cuenta verificada y una membresía activa; no hay alta de organización/invitaciones completa por este bloque.

Siguiente recorrido: decidir y preparar una cuenta/empresa sintéticas controladas para la prueba, o configurar correo y alta real; después validar login, MFA, caducidad, dos pestañas, PDF e historial con navegador HTTPS. No desactivar verificación de email ni introducir accesos demo en la API.

## Evidencia histórica previa al primer arranque

- Compose normalizado correctamente sin acceso al daemon: tres servicios, puerto 127.0.0.2:9443, ninguna publicación de Mongo/backend, volúmenes/nombres propios y red de base interna.
- Certificado y clave coincidentes, cadena CA y propósito/dirección verificados; secretos ignorados por Git y permisos comprobados.
- Preparación repetida sin regenerar claves.
- check-static correcto, incluida sintaxis Nginx con binario nativo 1.30.1 y rutas temporales propias; no se arrancó ni se cambió el Nginx existente.
- 848/848 pruebas backend, cero fallos/omisiones/cancelaciones; incluye tres nuevas de configuración. Es regresión, no 848 pruebas de navegador.
- Build frontend correcto con las mismas opciones usadas en el nuevo Dockerfile.
- git diff --check correcto.

Las 24 comprobaciones HTTP/Mongo y las 62 de frontend del bloque anterior no se han repetido aquí ni se presentan como prueba de este despliegue.

## Referencias técnicas

- [Docker: secretos en Compose](https://docs.docker.com/compose/how-tos/use-secrets/). Son archivos montados por servicio; no se afirma cifrado automático del secreto en el host.
- [MongoDB 7: réplica autenticada por keyfile](https://www.mongodb.com/docs/v7.0/tutorial/deploy-replica-set-with-keyfile-access-control/).
- [Nginx: resolución dinámica de upstream](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server). Permite reencontrar el backend al recrearlo sin depender de su IP anterior.

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

## Acceso desde Windows y cuenta sintética (preparado y probado)

Túnel Windows observado activo, limitado a 127.0.0.2:9443. Desde Windows, Node con CA explícita y rejectUnauthorized=true obtiene /api/health 200 con Mongo conectado. La confianza del navegador aún requiere aceptación del usuario; esta prueba no acredita el almacén de confianza de Windows ni una sesión de navegador.

La copia pública de la CA y el asistente están en C:\\Users\\jlbur\\DOCUMENTS\\Codex\\2026-09-22\\hemos-recibido-las-instrucciones-de-la\\work\\integration-access-20261011. Confiar-Certificado-Workspace.ps1 valida huella SHA-256 y vigencia, comprueba ausencia de clave privada y pide escribir CONFIAR. Importa únicamente en Cert:\\CurrentUser\\Root, no LocalMachine. No se instala automáticamente. Una CA confiada puede firmar otros certificados: no es una excepción limitada a esta URL. No compartir claves privadas. Se ha comprobado la sintaxis del asistente y la huella, no ejecutado la importación.

Para abrir el túnel cuando no esté activo, en PowerShell:

~~~powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.2:9443:127.0.0.2:9443 kali
~~~

La ventana se mantiene abierta; Ctrl+C cierra únicamente el túnel, no la app. No abrir un segundo túnel sobre el mismo puerto. Una prueba con curl/Schannel y CA explícita devolvió estado de revocación desconocido: la CA local no tiene un servicio público de revocación. No se han desactivado globalmente revocación ni validación TLS. La prueba positiva Node verifica cadena, vigencia y dirección, no revocación en línea ni confianza del navegador.

### Crear la cuenta en la terminal de Kali

~~~bash
cd /home/kali/Documents/practica3/normativa_integracion
sudo bash scripts/integracion.sh cuenta-prueba
~~~

No requiere build, reinicio ni down. El shell valida proyecto/ruta Docker y envía por stdin el código de backend/scripts/integration/create-test-workspace.js al contenedor backend ya levantado; el código no contiene claves. Se ejecuta como node, con nc_app y la configuración fija de nc_integracion, nunca nc_bootstrap. Solo se admite desde una terminal con salida directa para evitar guardar la contraseña en un log o pipeline.

Este bootstrap manual creará únicamente:

- Usuario admin.workspace@example.invalid, nombre Administrador de prueba, rol global usuario.
- Empresa de prueba - NormativaCheck, activa; identificador sintético TEST00001, no un NIF real ni validado.
- Membresía activa administrador de esa empresa.
- Recibo técnico en _integration_setup, sin contraseña, con la procedencia de prueba y la prevalidación sintética del correo. No se inventa un evento de negocio de alta que el historial aún no soporte.

Los tres registros y el recibo se insertan en una transacción. La contraseña aleatoria de 36 caracteres se muestra una sola vez al usuario, después del commit; el hook habitual la guarda con bcrypt. No se imprime en este chat, Notion o mensajes de coordinación. Guardarla en un gestor: repetir el comando no revela ni restablece contraseñas. Si la cuenta existe con relaciones coherentes, no hay cambios; si hay datos previos sin este recibo, estado incompleto o permisos revocados, se detiene sin adoptar ni reactivar nada. Si la ejecución se interrumpe tras commit, no repetir a ciegas esperando recuperar la clave: revisar estado.

La cuenta se crea prevalidada solo para poder probar sin SMTP. No se ha comprobado la propiedad de un buzón ni el flujo real de correo; no es el diseño de alta definitiva. No cambia register/login, no añade endpoint demo, no desactiva MFA, límites, sesiones persistentes, permisos o validación de email de otras cuentas. MFA de esta cuenta nueva comienza sin configurar.

URL: https://127.0.0.2:9443/espacio-de-trabajo. Acceder por el formulario normal, no Registrar. No usar credenciales de la app del equipo. Tras login debe aparecer Empresa de prueba - NormativaCheck; no hay tareas ni requisitos sembrados. Que el contexto, documentos o historial empiecen vacíos es normal.

### Evidencia y siguiente comprobación

- 3/3 nuevas pruebas unitarias: identidad/errores sin datos sensibles, rechazo del CLI fuera del contenedor y ausencia de ejecución automática.
- 6 grupos Mongo/HTTP reales con mongod 7.0.43 temporal del runner: alta y hash, repetición sin reset, login/selector con controles normales, clave errónea, no reactivación, rollback y rechazo de base preexistente. Sin .env, cuentas o base de la integración. Al terminar se eliminó solo el directorio sintético temporal del runner.
- Suite completa actual: 861/861 backend, cero fallos/omisiones/cancelaciones. Git diff y sintaxis bash correctos.
- HTTPS de Kali repetido correcto; túnel y HTTPS Windows con CA explícita correctos.

Actualización: Jose ha confirmado el primer login en el navegador y se ha comprobado la CA local en CurrentUser/Root de Windows. Esto no demuestra aún el recorrido completo de operación, evento, PDF y persistencia tras reinicio. App del equipo, puertos/volúmenes originales y ux-lab sin cambios; sin commit/push ni instalación de confianza automática.

## Recuperación visual del dashboard — 12 de octubre de 2026

La ruta /espacio-de-trabajo reutiliza ahora la estructura visual B.06 (paleta marfil/terracota, navegación, tarjetas, listado y panel lateral), conectada exclusivamente a los contratos API de la integración. No importa el modelo de demostración, sus tareas, porcentajes, referencias jurídicas o estado localStorage.

- App.js reserva todo el ancho para esta ruta y oculta en ella la cabecera/pie heredados; mantiene SessionBoundary, DraftNavigationGuard, CookieBanner y las demás rutas.
- ApiWorkspace.jsx conserva selección explícita de organización, reconfirmación de membresía y editor montado pero oculto al bloquear la sesión. Añade cuenta/cierre con confirmación del servidor y avisos de borrador.
- Dashboard.jsx consulta operaciones, documentos activos y subespacios activos, hasta 20 registros cada uno. El signo + significa que hay más páginas, no un total. Error/carga/restricción se muestran como —, nunca como cero. La búsqueda es solo sobre la página cargada.
- El detalle abre la operación seleccionada mediante initialOperationId en OperationsPage; no crea ni duplica registros. Los módulos de contexto, operaciones, documentación, subespacios e historial conservan su lógica de escritura/versiones/conflictos.
- dashboard.css adapta la estructura a escritorio y móvil, sin imponer estos estilos al inicio de sesión ni a otras rutas.
- Tareas y responsables y Normativa del alcance conservan su ubicación, pero explican su integración pendiente. No hay circuito completo de tareas/revisión, gráficos de cumplimiento o PDS conectado por este cambio. Las operaciones no se cuentan como tareas ni como requisitos satisfechos.

Verificación de este bloque: 73/73 pruebas frontend (11 nuevas), build CRA correcto, bash -n y git diff --check. Revisión visual a 1366x900 y 390x844, incluida documentación e historial. La revisión visual empleó el build real con respuestas sintéticas de solo lectura en Windows: NO acredita un E2E con Mongo, exportación o subida real de PDF. La última suite backend previa fue 861/861; no se ha repetido ni modificado la lógica de backend en este bloque.

### Publicar solo el frontend de integración

Desde la terminal de Kali:

~~~bash
cd /home/kali/Documents/practica3/normativa_integracion
sudo bash scripts/integracion.sh actualizar-web
~~~

La acción valida ruta/configuración/propiedad del proyecto Docker y exige el backend ya iniciado. Ejecuta build web y up --no-deps únicamente para web, espera su healthcheck y comprueba HTTPS. No ejecuta mongo-init, seed, cuenta-prueba, down, cambios de claves o reinicios del backend/Mongo. Requiere sudo local: su ejecución sobre Docker queda pendiente de Jose.

En Windows, mantener abierta o minimizada la terminal del túnel SSH. Cerrar esa terminal interrumpe el acceso desde Windows, no los contenedores ni sus datos. Tras actualizar web, recargar https://127.0.0.2:9443/espacio-de-trabajo y seleccionar la empresa de prueba. Cero operaciones es normal si todavía no se ha registrado ninguna.

Siguiente prueba guiada: crear una operación sintética, abrirla desde el nuevo dashboard, recargar y comprobar que se conserva, después localizar su evento en Historial de actividad. Continuar con versión documental y permisos. No dar estos recorridos por superados hasta observarlos en el HTTPS desplegado.
