# Decisiones por operación y recorrido conectado de prueba

Estado: NORM-B1f, 10/10/2026. Código local en Kali, rama backend sobre fb99b0adde243d3473b8e2198f0a55d08604e7f0 más cambios sin commit. No publicación/despliegue en la instalación habitual. El Workspace Windows incorpora su modo API por un encargo separado a Frontend.

## 1. Qué se ha cerrado

Una operación ya podía guardar respuestas/versiones. Ahora puede guardar una decisión de aplicabilidad calculada con una regla publicada, referida a SU revisión exacta, y consultar decisiones anteriores. La conclusión histórica no se reescribe si cambia la operación, la regla o su periodo. Se muestran indicadores de revisión por separado.

El catálogo productivo continúa vacío. Eso NO quiere decir que no apliquen obligaciones: todavía no se ha publicado una regla jurídica en este nuevo motor. El primer contenido RGPD28 es un borrador consultable, no una regla activada.

El laboratorio permite probar ambos recorridos sin mezclarlos:

- Una regla SINTÉTICA, DEMO_CONDICION, para verificar decisiones pendientes/aplica/no_aplica y su persistencia real. No es una interpretación legal ni contractual real.
- Preguntas y contraste del BORRADOR RGPD28, sobre respuestas guardadas en una operación, sin publicar obligaciones ni persistir una decisión jurídica de ese borrador.

## 2. Código y responsabilidad

Bajo /home/kali/Documents/practica3/normativa_check/backend:

- models/DecisionOperacion.js: colección decisiones_operacion, separada de decisiones_aplicabilidad generales. Guarda referencia a Operacion y RevisionOperacion. Los campos internos revision_contexto/version_contexto se refieren al contexto DE ESA OPERACIÓN.
- services/decisionesOperacion.js: autorización, selección de regla de servidor, cálculo, snapshot, antecedente, idempotencia, transacción, lectura e indicadores de revisión. Reutiliza validador y motor existentes, sin modificar el servicio de decisiones generales.
- routes/decisionesOperacion.js: catálogo y decisiones bajo una operación real, montadas desde routes/operaciones.js.
- services/propuestasOperacion.js: carga una revisión autorizada de la operación y devuelve preguntas/inspección de borrador. No admite respuestas sueltas, catálogo ni resultado desde el navegador.
- models/EventoOrganizacion.js y services/consultaActividad.js / exportarActividad.js: familia de decisiones de operación con referencias y filtrado propios.
- scripts/check-decisiones-operacion-mongo.js y run-decisiones-operacion-mongo.js: pruebas HTTP en Mongo temporal con reglas exclusivamente sintéticas.
- scripts/run-workspace-demo.js: entrada SOLO de laboratorio. No se importa desde app.js/server.js ni se añade login de demo a producción.

## 3. API de decisiones

Base pública: /api/organizaciones/:organizacionId/operaciones/:operacionId. Express no incluye el prefijo /api; nginx o el proxy del laboratorio lo retira.

- GET /reglas: {operacionId,reglas,sinReglasPublicadas,aviso}. Solo reglas revisadas que admitan operación. Recurso inexistente/ajeno no ofrece catálogo.
- POST /decisiones: Idempotency-Key y JSON {versionContexto,reglaId,versionRegla,motivo}. Nueva decisión:201; reintento idéntico:200.
- GET /decisiones: filtros limite(1..100), antes(número de decisión exclusivo), reglaId. Resúmenes sin snapshot.
- GET /decisiones/:decisionId: detalle con decisión y snapshot reproducible.

Respuesta en {ok:true,data}. DTO:

~~~js
{
  id, numero, operacionId,
  revisionContextoId, versionContexto, versionContextoActual,
  reglaId, versionRegla, anteriorId,
  autorId, membresiaAutorId, motivo, registradoEn, fechaEvaluacion,
  estado, temporal, revisionDecision: 'automatica_orientativa',
  sha256, repetida, horaServidor,
  revision: {
    contextoCambiado, reglaCambiada, reglaDisponible, periodoCambiado,
    relojAnteriorAlCalculo, requiereNuevaDecision
  },
  // Solo en detalle/creación:
  decision, snapshot
}
~~~

anteriorId es la decisión anterior de LA MISMA regla y operación, no la de otra operación. numero crece entre todas las decisiones de esa operación. El cliente no decide antecedente, autor, fecha, regla completa, estado o snapshot.

## 4. Guardado y control de cambios

1. Validar selección y clave; comprobar índices únicos reales.
2. Abrir transacción y comprobar membresía empresarial admin activa y empresa activa.
3. Resolver operación por ID Y organización. Reintento idéntico devuelve el cálculo original; cambiar cuerpo, actor u operación con la misma clave produce409.
4. Exigir versionContexto actual y versionRegla actual. La regla debe estar publicada para operación. Cargar revisión exacta y verificar integridad.
5. Calcular mediante motor, comprobar resultado reproducible y relación con antecedente.
6. Guardar decisión, snapshot y evento en la misma transacción. Un fallo revierte todo; no alternativa sin réplica.

La serialización empresarial existente evita decisiones construidas con datos mezclados durante una edición concurrente. Una versión obsoleta da409: la interfaz conserva el borrador. La huella comprueba coherencia, no certificación ni protección contra administradores de MongoDB.

Las lecturas revalidan el permiso antes de responder. La decisión histórica no se recalcula al leerla. RequiereNuevaDecision es un indicador técnico, no incumplimiento ni revisión humana.

Un subespacio archivado no borra ni oculta decisiones previas. La vinculación que tenía la operación al calcular queda en el evento; no se atribuye a su vínculo futuro.

## 5. Preguntas y vista del borrador

GET /propuestas/rgpd28, opcional ?version=N.

Devuelve {operacion,versionActual,versionContexto,revisionContextoId,contexto,horaServidor,campos,inspeccion,decisionPersistida:false,aviso}. campos contiene las diez definiciones de preguntas; inspeccion.preguntas contiene las que falta aclarar según la cobertura y respuestas.

- Cuatro preguntas delimitan el caso inicial.
- Después aparecen las cuestiones de fondo necesarias.
- Una respuesta desconocida NO se sustituye por false.
- Fuera de cobertura NO se convierte en no_aplica.
- Aunque todas las condiciones resulten verdaderas, estado=borrador_no_operativo y habilitaEvaluacion=false.
- Tipo de hecho incompatible:422 CALCULO_NO_DISPONIBLE.
- versión inválida:400; revisión inexistente:404.

Para responder: PATCH de la operación con version, motivo y cambios. Después consultar el borrador. No se acepta un POST al inspector que atribuya respuestas, permisos o conclusiones al cliente. La consulta histórica muestra hechos guardados de esa revisión; la inspección usa el borrador ACTUAL y hora actual, NO un dictamen histórico persistido. El DTO identifica la versión de propuesta consultada.

No se ha revisado jurídicamente ni publicado contenido nuevo en B1f; solo se corrigió el mensaje obsoleto de contexto pendiente.

## 6. Historial y exportación

Acción decision_operacion_creada; categoría decisiones_operacion. Referencias/filtros operacionId, decisionOperacionId y reglaId. decisionId sigue siendo el campo de decisiones GENERALES, no se reutiliza.

CSV/XLSX añade columna ID decisión de operación. Resúmenes no incluyen hechos/snapshots. Administrador ve su organización; coordinadores no reciben estos eventos generales. Nuevos filtros no conceden permisos ni simulan filtros normativos o de clientes aún no implementados.

## 7. Laboratorio navegable, separado de la instalación real

Frontend Windows ux-lab utiliza http://127.0.0.1:4190. Su proxy /api dirige a Windows127.0.0.1:4191 retirando /api. Un túnel SSH conecta exclusivamente ese loopback con Kali127.0.0.1:4191.

Arranque manual desde Windows:

~~~powershell
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ConnectTimeout=5 -L 127.0.0.1:4191:127.0.0.1:4191 kali 'cd /home/kali/Documents/practica3/normativa_check/backend && MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-workspace-demo.js'
~~~

Arrancador local equivalente: output/scripts/Iniciar-Workspace-API.ps1 en el workspace Windows. Si la API ya existe no la sustituye. La ruta del mongod temporal fue comprobada en esta sesión; puede dejar de existir tras reiniciar Kali. Admite otra ruta absoluta válida, NUNCA URI de base externa. No ejecutar seed o preparar-mongodb.sh --aplicar.

El runner crea su Mongo temporal con réplica, dos empresas, cinco cuentas ficticias, una unidad de tres miembros, un subespacio y dos operaciones. Las operaciones/subespacio se crean mediante servicios reales con sus eventos. El bootstrap organizativo es fixture: NO sustituye el alta empresarial pendiente.

- GET /demo/info: modo, caducaEn, empresas/cuentas/IDs y campos de regla sintética. Sin secretos.
- POST /demo/login con {} o {cuenta}: sesión HttpOnly, SameSite=Strict, local HTTP exclusivamente. Cuentas admin, coordinador, lector, otro_admin, otra_empresa.
- Origin exacto http://127.0.0.1:4190 y X-Requested-With:XMLHttpRequest en login. Host limitado a loopback4190/4191.
- Ninguna ruta /demo existe en createApp productiva.
- En este proceso solo se permite el recorrido organizativo, /me, /health y logout. Se bloquean registro/correos y rutas ajenas.
- No límite global de navegación SOLO en demo; permanece el limitador específico de exportaciones. No se desactiva autenticación/CSRF de las rutas normales.
- Caduca tras cuatro horas; detiene servidor y Mongo y retira solo sus datos temporales. Los datos se perderán, no es el almacén definitivo del proyecto.

No subir PDF o datos reales. Una base real para pruebas no equivale a una base de clientes: la persistencia está en un Mongo de laboratorio y termina con él. El motor de decisiones sintéticas solo se sustituye por inyección de código EN ESE PROCESO, no por HTTP ni una bandera en producción.

## 8. Pruebas y evidencia

17 nuevas unitarias/HTTP; suite completa final800/800, cero fallos/canceladas/omisiones,66,09s.

Decisiones de operación:26 grupos HTTP/Mongo réplica +1negativo standalone. Regresiones: operaciones18+1; contexto general18+1; decisiones generales23+1; subespacios/documentos18+1. Incluyen transacciones, concurrencia, rollback, aislamiento, versiones, idempotencia, revocación en lectura, integridad, índices ausentes, CSV/XLSX, dos operaciones independientes y preguntas progresivas. No validan veracidad jurídica.

Desde Windows comprobados demo/info, sesión HttpOnly, listado de operaciones y borrador con API real. La evidencia de navegador del Workspace se registra por Frontend en ux-lab/QA.md; no confundir esta comprobación HTTP con una prueba visual ya terminada.

Pruebas desde backend en Kali:

~~~bash
node --test tests/decisionesOperacion.test.js
npm test
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-decisiones-operacion-mongo.js
~~~

## 9. Qué sigue pendiente en el producto

Este bloque cierra infraestructura por operación y permite probarla con un Workspace conectado de laboratorio, sujeto a su QA. No cierra el producto entero:

- Regla jurídica revisada/publicada y cobertura normativa; requisitos y PDS derivados de ella.
- Alta empresarial, invitaciones y selección de organización en el producto real.
- Tareas compartidas, grupos, avisos y votaciones conectados; no confundir acciones de demo local con auditoría del servidor.
- Clientes reales como entidades, no categorías.
- Revisión de evidencias documentales, antimalware/validación profunda de PDF y garantías de almacenamiento/retención.
- IA local o externa: no instalada ni conectada. Los textos IA de la demo visual son editoriales.
- Archivo de operaciones, retención/cuotas específicas e integración/despliegue deliberados en la aplicación habitual.

Siguiente prioridad de producto: revisar el recorrido navegable, cerrar una primera regla publicable y conectar su requisito/tarea/evidencia/PDS; no ampliar el catálogo a ciegas ni declarar cumplimiento porque se complete una tarea.

## 10. Recuperación del laboratorio y caducidad

Durante la pausa del entorno de trabajo se perdió el túnel Windows y el proceso remoto de demo continuó activo con caducaEn anterior a la hora civil, porque su temporizador monotónico no había avanzado el mismo tiempo. Se detuvo mediante SIGTERM exclusivamente el runner sintético identificado; no se tocó Mongo habitual. Su limpieza retiró los datos temporales de esa ejecución.

La entrada de laboratorio incorpora guardiaCaducidad antes de todas las rutas: al alcanzar la fecha pública responde503 LABORATORIO_CADUCADO, también si el equipo estuvo suspendido. Se mantienen cierre temporal y limpieza propios. Tres pruebas adicionales cubren antes del límite, instante exacto y salto de reloj. Suite final803/803, cero fallos/canceladas/omisiones,52,46s; las20 pruebas de decisiones/demo/caducidad también pasan por separado.

Nueva instancia comprobada lista, caduca 10/10/2026 a18:03:05 Europe/Madrid; IDs nuevos disponibles en /demo/info. No reutilizar los IDs/cookies de una instancia anterior. Solo se reinició el laboratorio; no hubo reconstrucción de Docker ni conversión adicional de Mongo habitual.

## NORM-B1f / Workspace B.07 — Cierre funcional de integración de laboratorio

Frontend comunica y documenta87/87 tests y build correctos, sin cambios adicionales necesarios de API. En navegador con base sintética nueva: guardado parcial de respuestas con desconocidos, decisión DEMO pendiente, filtros por operación/decisión de operación y limpieza, CSV/XLSX filtrados, PDF con dos versiones y descarga idéntica por SHA-256. Documento privado no visible al lector; compartido permite descarga sin edición. Lector sin historial general, coordinador limitado a unidades, otra empresa rechazada.

Conflicto de decisión con segunda pestaña: contexto cambia, servidor devuelve409, motivo conservado; consulta/aceptación explícita de versión actual antes de una decisión nueva. La sesión anterior de QA verificó también revisiones históricas, edición concurrente de operación con conservación de borrador y subespacio crear/archivar/restaurar; sus datos se reiniciaron al recuperar el laboratorio. No presentar esa base anterior como la actual.

Verificación de tamaño móvil390: ancho cliente y scroll375, sin desbordamiento horizontal observado por DOM. Las capturas finales del navegador fallan con Unable to capture screenshot; NO se declara revisión visual completa ni accesibilidad exhaustiva. Backend observó y capturó la vista general conectada en la sesión inicial (output/workspace-api-verificado-20261010.jpg, Windows); es evidencia inicial, no captura del estado final ni del móvil.

La integración es del Workspace de EJEMPLO Windows (ux-lab), separado de la demo local B.06, con API real y Mongo temporal de datos ficticios. No se ha integrado/desplegado en frontend habitual de Juanjo ni se ha publicado código. Operaciones/decisiones/documentación/historial funcionales en ese perímetro; reglas jurídicas productivas sin publicar y requisitos/tareas/evidencias revisadas/PDS del nuevo modelo aún pendientes. El código conserva el cálculo heredado sin recalcular sus históricos.

Documentación de interfaz: ux-lab/README.md y ux-lab/QA.md en Windows, bajo responsabilidad de Frontend. Backend803/803; decisiones de operación26+1 Mongo, regresiones indicadas en B1f. La observación de permisos funcionales y tests no equivale a pentest, validez jurídica o producto preparado para clientes.
