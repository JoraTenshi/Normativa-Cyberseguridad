# Subespacios, PDF privados e historial de actividad — contrato de backend

Trabajo iniciado el 8 de octubre de 2026; comprobaciones actualizadas el 9 de octubre de 2026. Código local de Kali, rama backend, base fb99b0adde243d3473b8e2198f0a55d08604e7f0. No equivale a integración de frontend, publicación en GitHub ni verificación del despliegue real.

## Qué resuelve este bloque

La organización sigue siendo propietaria de los datos. Un subespacio describe un servicio o producto, no una unidad de personas. No exige un equipo mínimo ni sustituye membresías/unidades. Una empresa puede trabajar sin subespacios.

Solo un administrador con membresía activa en ESA organización crea, modifica, archiva y restaura subespacios. No se utiliza Usuario.rol ni un rol enviado por el navegador. No hay delegación de administración a coordinadores.

Un miembro solo ve subespacios donde tiene algún documento PDF autorizado y solo puede leer/descargar ese contenido. El proveedor de recursos autorizado implementado en este bloque es documental; no hay todavía tareas persistentes que otorguen visibilidad. Un espacio vacío es visible solo para administradores. No confundir esta limitación con permisos de tareas ya implementados.

Para documentos, Jose confirma: solo PDF; administrador crea, sube versiones y comparte; destinatarios únicamente leen/descargan. Por defecto, no hay destinatarios. Se puede compartir con membresías concretas o unidades activas de la empresa. Revocar una pertenencia o compartir deja de conceder acceso en las consultas posteriores.

## Archivos y responsabilidades

Base absoluta: /home/kali/Documents/practica3/normativa_check

- backend/models/Subespacio.js: servicio/producto, propietario, estado y versión.
- backend/models/DocumentoOrganizacion.js: título, categoría corporativa/legal, vínculos justificados a subespacios y permisos explícitos.
- backend/models/VersionDocumento.js: bytes de cada versión PDF, nombre, tamaño, SHA-256, autor y fecha; contenido excluido por defecto de consultas.
- backend/services/transaccionOrganizacion.js: exige admin empresarial vigente, verifica índices únicos y bloquea empresa/membresía dentro de una transacción; no hace fallback sin transacciones.
- backend/services/subespacios.js: crea, modifica, archiva/restaura y lista según recursos autorizados.
- backend/services/accesoDocumental.js: combina pertenencia empresarial, pertenencias activas a unidades y concesiones documentales; revalida tras las lecturas.
- backend/services/documentosOrganizacion.js: metadatos, compartición, versiones, cuota y descarga autenticada.
- backend/models/EventoOrganizacion.js: conserva familias de unidades/miembros y añade subespacios/documentos, exigiendo la referencia correspondiente.
- backend/services/consultaActividad.js: filtra solo el historial autorizado, pagina y expone capacidades reales.
- backend/services/exportarActividad.js: exporta CSV y XLSX sin convertir texto del usuario en fórmulas.
- backend/routes/organizaciones.js: contrato HTTP, requireAuth, control de caché y cuerpo PDF limitado; conserva CSRF global de app.js.

No se han montado rutas de gestión de unidades: sus requisitos posteriores de elecciones/mínimo de miembros siguen pendientes. Este bloque tampoco implementa alta empresarial ni prueba la vinculación real de la cuenta existente de Jose con una organización activa.

## Cómo se guarda una operación

1. La sesión proporciona el usuario; la URL identifica la organización solicitada, no concede acceso.
2. El servicio verifica organización y membresía activas, rol administrador y referencias de la misma empresa.
3. Una transacción guarda el cambio y su evento; si el evento falla, se revierte la operación.
4. La versión esperada impide sobrescribir cambios ajenos. Un 409 VERSION_DESACTUALIZADA exige conservar el borrador en frontend, consultar la versión actual y resolver el cambio; no reintentar automáticamente sobre la versión nueva.
5. Las creaciones y subidas requieren Idempotency-Key aleatoria de 16–100 caracteres alfanuméricos, guion o guion bajo. Reutilizarla con el MISMO contenido evita duplicados; reutilizarla con otro contenido devuelve 409. No generar otra clave para un reintento incierto de la misma operación.

El índice y el control de versión resuelven problemas distintos: no sustituir uno por el otro. Los bloqueos por organización serializan estas escrituras, aceptable para el volumen de una práctica; revisar capacidad antes de escalado.

## Contrato HTTP

A través de nginx todas las rutas llevan /api. Directamente en Express no llevan ese prefijo. Todas exigen cookie de sesión vigente; escrituras mantienen Origin permitido o X-Requested-With: XMLHttpRequest.

### Subespacios

- GET /api/organizaciones/:org/subespacios — filtros estado=activo|archivado, limite=1..100 y despues (ID recibido como siguiente).
- GET /api/organizaciones/:org/subespacios/:id — consulta autorizada, no descubre espacios por adivinar IDs.
- POST /api/organizaciones/:org/subespacios — Idempotency-Key; JSON nombre, tipo=servicio|producto, descripcion (alcance).
- PATCH /api/organizaciones/:org/subespacios/:id — JSON version y datos con campos modificados.
- POST /api/organizaciones/:org/subespacios/:id/archivar o /restaurar — JSON version.

Ejemplo conceptual de actualización, con identificadores reales obtenidos de la API:

```json
{
  "version": 2,
  "datos": {
    "descripcion": "SaaS de reservas ofrecido a empresas españolas; revisión del alcance declarada."
  }
}
```

Archivar conserva documentos, vínculos y versiones; no los borra ni mueve. No se permite modificar el espacio archivado salvo restauración. No se ha implementado una comprobación de tareas abiertas: no existe aún ese modelo y esa regla específica no estaba cerrada. No afirmar que el archivo complete tareas ni acredite cumplimiento.

### Documentación corporativa/legal

- POST /api/organizaciones/:org/documentos — Idempotency-Key; JSON titulo, categoriaDocumental=corporativa|legal; opcionales lectores (IDs de Membresia, no Usuario), unidadesLectoras y vinculos.
- Cada vínculo contiene subespacioId y motivo. Un documento puede estar en contexto general (sin vínculos) o relacionado con varios subespacios sin duplicar sus bytes. Es una relación de trabajo, no una aceptación normativa de evidencia.
- GET /api/organizaciones/:org/documentos — filtros subespacioId, estado, limite, despues.
- GET /api/organizaciones/:org/documentos/:id — solo contenido autorizado; los destinatarios no reciben las listas de permisos de otros miembros.
- PATCH /api/organizaciones/:org/documentos/:id — JSON version y datos; solo admin; permite cambiar metadatos, vínculos y destinatarios.
- POST .../:id/archivar o /restaurar — JSON version; se conservan versiones históricas.
- POST .../:id/versiones?version=N&nombre=archivo.pdf — Idempotency-Key; Content-Type: application/pdf; cuerpo binario del PDF, NO multipart ni base64 JSON.
- GET .../:id/versiones — lista paginada de versiones, parámetro antes para continuar.
- GET .../:id/versiones/:numero/archivo — descarga como attachment, no incrustación automática; vuelve a comprobar permisos antes de devolver bytes.

Después de subir una versión, refrescar metadatos para obtener version actualizada antes de otra modificación. version es el control de concurrencia del registro; versionActual es el número de versión del PDF. No son lo mismo.

### Límites y seguridad documental

Máximo 5 MiB por PDF y 100 MiB acumulados por organización, contando todas sus versiones. Son límites técnicos de esta primera versión, no requisitos normativos; archivar no libera cuota. Una versión es un documento BSON por debajo del límite de MongoDB. No hace falta GridFS para este tamaño; documentos grandes exigirían otro diseño. Los bytes y el evento se guardan en la misma transacción.

Se comprueban tipo de contenido, tamaño, extensión, cabecera PDF y marca final; esto NO es análisis antivirus, validación integral del formato, firma digital, autenticidad ni revisión jurídica. La API devuelve analisisMalware=no_realizado. No se ejecuta ni se envía el archivo a proveedores externos. Debe conservarse esta advertencia en la interfaz; descargas no garantizan inocuidad.

Los documentos no tienen URL pública y los listados no contienen bytes. Esto no constituye cifrado de disco: no se ha verificado cifrado en reposo del host ni protección frente al administrador de MongoDB. Copias de seguridad contienen datos sensibles y se guardan privadas fuera de Git.

## Historial de actividad y exportación

GET /api/organizaciones/:org/actividad

Filtros combinables: unidadId, subespacioId, documentoId, actorId, miembroId, categoria, accion, desde, hasta, orden, limite y cursor.

- actorId identifica Usuario autor; miembroId identifica Membresia empresarial afectada, no autor.
- Categorías actuales: unidades, miembros, subespacios, documentos.
- Desde inclusivo/hasta exclusivo; instantes UTC ISO 8601 con Z. Front convierte la zona seleccionada a UTC respetando cambios de horario.
- Orden asc/desc por fecha e ID. Máximo 100 filas por página; cambiar filtros exige reiniciar cursor.
- Administrador: toda su organización. Coordinador: eventos de sus unidades activas. Eventos generales de documentos/subespacios no se publican automáticamente a coordinadores por tener acceso a un archivo. El resto no accede al historial general.
- Los eventos de documentos conservan antes/después de destinatarios y vínculos para seguimiento administrativo; no incluyen bytes.

GET /api/organizaciones/:org/actividad/exportar?formato=csv|xlsx

Mismos filtros salvo cursor/limite; columnas seleccionables con nombres separados por comas (por ejemplo fecha,accion,documentoId). Máximo 5000 eventos: por encima responde 422 y exige acotar búsqueda; nunca exporta parcialmente sin avisar. Exportación limitada a cinco por minuto por IP, además del límite global.

CSV: UTF-8 con BOM, separador punto y coma, escapado de comillas y neutralización de fórmulas. XLSX: celdas de texto, cabecera inmovilizada, autofiltro y hoja Contexto con fecha/corte/filtros/alcance. Se usa ExcelJS 4.4.0 con override acotado de uuid 11.1.1; proxy-addr actualizado a versión corregida. npm audit de producción no notificó vulnerabilidades conocidas en esta ejecución; no es garantía de ausencia de fallos.

Los permisos se revalidan después de leer y después de generar el archivo. Corte temporal/cursor NO equivalen a snapshot transaccional entre peticiones, registro inmutable certificado ni sello de tiempo. No hay API para editar/borrar eventos, pero el administrador de la base conserva capacidad técnica de alterar datos.

### Lo que no debe aparentar cobertura

clienteId, normativaId, estandarId y categoriaTarea siguen devolviendo FILTRO_NO_IMPLEMENTADO: sus módulos no producen eventos organizativos. Los campos no se habilitan fingiendo que una consulta vacía acredita ausencia de actividad. CSV/Excel cubren lo registrado, no todo el historial futuro deseado.

Este historial es de actividad. NO es el nuevo histórico de evolución del cumplimiento solicitado desde Frontend ni una cronología de tareas. Tampoco sustituye /me/historial de evaluaciones de P1.

## MongoDB: procedimiento y estado

Preparados infra/mongodb/replica.compose.yml, infra/mongodb/init-replica.js y scripts/preparar-mongodb.sh. El Compose principal no se convierte hasta ejecutar el procedimiento. No se ha concedido acceso Docker al usuario remoto ni cambiado sudoers.

Jose aportó capturas de mongo:7, volumen normativa_check_mongo_data, red normativa_check_cybersec-net y preflight inicial correcto. Tras indicar que ya había enviado el resultado, el 09/10 se comprobó directamente y sin cambios: existen docker-compose.override.yml/.runtime; hello de la instancia real devuelve nc-rs, primario activo y un nodo mongodb:27017; la API /api/health devuelve ok=true y db=connected. La réplica real ya está operativa a nivel de topología y conectividad. No seguir pidiendo repetir la conversión. Esta lectura no acredita por sí sola integridad/restauración del respaldo, despliegue exacto de todos los cambios ni el recorrido autenticado/documental.

Referencia del procedimiento, NO repetir --aplicar en la instalación actual, que ya responde como nc-rs:

```bash
sudo bash /home/kali/Documents/practica3/normativa_check/scripts/preparar-mongodb.sh
sudo bash /home/kali/Documents/practica3/normativa_check/scripts/preparar-mongodb.sh --aplicar
```

Sin --aplicar verifica imagen/volumen/autenticación y no modifica el despliegue. Con --aplicar: comprueba credenciales y topología; genera clave privada; detiene backend/scraper y Mongo; guarda copia física en frío y SHA-256; comprueba gzip; activa override; inicia nc-rs de un nodo autenticado; prueba y aborta una transacción; reconstruye backend y reinicia scraper/nginx. No elimina volúmenes, no ejecuta seed ni desactiva autenticación.

Se conserva .runtime/mongo-respaldo-XXXXXXXX (modo privado) y .runtime/mongodb/keyfile. Ambos y el override local quedan ignorados en Git. El override debe acompañar ejecuciones posteriores de Compose. Imagen local debe coincidir con la del contenedor: el script no mezcla conversión con actualización de MongoDB.

Copia comprobada estructuralmente no equivale a restauración ensayada. Si falla, no reintentar ni restaurar encima: leer primer error y estado actual. Una eventual restauración debe ensayarse primero en OTRO volumen, con la imagen exacta, manteniendo el original. Un único nodo permite transacciones, pero NO añade redundancia ni alta disponibilidad. La recuperación operacional ante fallo de conversión requiere revisión; no hay rollback automático destructivo.

## Cómo repetir las pruebas

```bash
cd /home/kali/Documents/practica3/normativa_check/backend
npm test
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-actividad-mongo.js
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-subespacios-mongo.js
```

La ruta de mongod es temporal de esta sesión, no requisito permanente del despliegue. Los ejecutores solo levantan su proceso loopback y datos sintéticos, que limpian al acabar. No leen .env ni conectan a la base real.

Evidencia actual: 494/494 pruebas unitarias/HTTP simuladas; 15 grupos de historial en replica set y 14 en standalone; 18 grupos de subespacios/documentos/exports con HTTP y Mongo real temporal más un negativo standalone. Regresión de gestión anterior: 25 grupos replica set y un negativo standalone; no valida las reglas posteriores de votación/mínimo de tres miembros. Se han probado aislamiento entre empresas, admin frente a coordinador/miembro, CSRF, reintentos, concurrencia, rollback de subespacio y también de subida PDF si falla el evento, versiones, descarga, revocación durante lectura, filtros y archivos CSV/XLSX. Los PDF de prueba son sintéticos; las comprobaciones de firma/tamaño no validan el formato completo. No se ha realizado una prueba visual en frontend ni un pentest.

## Prioridad siguiente: evolución de requisitos, distinta de logs

Frontend traslada una prioridad expresa de Jose: evolución de la situación de requisitos de cada empresa y PDS exportable como foto fechada. No se implementa por añadir eventos a esta colección.

Existe Resultado con snapshot normativo y datos de evaluación; la ruta PDS deriva acciones de un resultado. Falta contrastar su integración con organización/alcance y diseñar decisiones versionadas de aplicabilidad/evaluación/revisión, conservando hechos previos. Completar una tarea o adjuntar un archivo nunca cambiará automáticamente un requisito a cumplido. Primer bloque propuesto: pocos requisitos revisados con fuente, perfil/alcance versionado y decisión justificada; después evidencia/revisión/evolución/exportación. Requiere acordar quién revisa, qué acredita evidencia y reglas iniciales con Normativa. No se instala IA ni se inventan vigencias.

Fuentes técnicas:
- https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/
- https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/
- https://www.mongodb.com/docs/manual/reference/limits/#bson-documents
- https://mongoosejs.com/docs/8.x/docs/transactions.html
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- https://github.com/exceljs/exceljs

## Actualización NORM-B1f (10/10/2026)

Las secciones anteriores registran el bloque documental al 9 de octubre. Se han añadido contexto general versionado, operaciones independientes, decisiones generales y por operación, preguntas progresivas de borrador y sus eventos. Contrato completo y pruebas actuales: docs/decisiones-operacion-workspace.md. El catálogo jurídico productivo sigue vacío.

El historial amplía categorías con contextos, operaciones, decisiones_aplicabilidad y decisiones_operacion; filtros contextoId, operacionId, decisionId (general), decisionOperacionId y reglaId. No cambia el ámbito de permisos. Los cuatro filtros de clientes/normativa/estándar/categoría de tarea continúan pendientes: no se simula cobertura.

Por encargo expreso de Jose, Frontend integra estos recursos en un modo API separado dentro del Workspace de ejemplo Windows, no en el frontend real de Juanjo. La demo local anterior conserva tareas y almacenamiento; la demo API usa cuentas sintéticas y Mongo temporal. Backend supera suite803/803 y regresión documental18 grupos en réplica+1negativo standalone. El cierre de QA visual se documenta en ux-lab/QA.md; las notas anteriores de ausencia de interfaz no describen por sí solas ese estado posterior. Este avance no añade revisión jurídica/antivirus de PDF, votaciones ni tareas persistentes.
