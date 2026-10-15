# NORM-C1 — Perfil, propuestas y alcances preliminares

Fecha: 12/10/2026. Implementación en el árbol aislado `normativa_integracion`, rama `integracion/workspace-20261011`. No implica despliegue ni revisión jurídica aprobada. No se ha modificado la app del equipo ni conectado estas pantallas al frontend.

## Qué resuelve este bloque

El administrador describe la empresa y sus actividades. El servidor propone espacios de trabajo, alcances todavía preliminares y familias normativas que conviene estudiar. Después de revisar la propuesta, el administrador confirma qué crear y qué espacios existentes reutilizar. La confirmación organiza el caso; **no confirma una obligación ni una certificación**.

Se conserva la infraestructura existente: `ContextoEmpresa` y `RevisionContextoEmpresa` guardan las respuestas; `Operacion` y `RevisionOperacion` concretan casos particulares; `Subespacio` organiza servicios/productos. Las nuevas entidades son `AlcanceEvaluacion`, sus revisiones y el recibo de materialización idempotente. Un subespacio puede participar en varios alcances y un alcance puede enlazar varios subespacios.

Todas las rutas de este bloque exigen administrador activo de la organización. Ser coordinador o tener un rol global llamado admin no concede este permiso. Se heredan autenticación, CSRF y `private, no-store`. No hay endpoint de alta alternativa ni se crea una empresa por iniciar sesión.

## Cómo se reparte el código

En `/home/kali/Documents/practica3/normativa_integracion`:

- `backend/services/perfilNormativo.js`: proyecta hechos existentes, genera preguntas condicionales y propone espacios y familias. La selección no busca palabras en el nombre del producto: utiliza campos declarados y tipados. No produce decisiones jurídicas.
- `backend/catalogo/orientacionC1.js`: referencias versionadas y una definición ENS candidata, con revisión editorial y jurídica separadas. No importa reglas DEMO ni textos protegidos.
- `backend/validation/alcanceEvaluacion.js`: valida confirmación, referencias/versiones, límites y exclusiones motivadas. Rechaza campos de autor, organización, permisos o resultado suministrados por el cliente.
- `backend/services/alcancesEvaluacion.js`: aplica permisos, carga revisiones, valida la huella propuesta, ejecuta la transacción y conserva snapshots y eventos.
- `backend/models/AlcanceEvaluacion.js`: cabecera y versión actual. El único estado de este bloque es `preliminar`.
- `backend/models/RevisionAlcance.js`: contenido histórico, candidatos, fuentes, hechos, versiones, autor, fecha y huella. No tiene API para editar/borrar revisiones.
- `backend/models/MaterializacionPerfil.js`: recibo de confirmación. Impide crear de nuevo la misma propuesta incluso usando otra clave.
- `backend/routes/alcancesEvaluacion.js`: contrato HTTP; se monta en el router existente de organizaciones.
- `EventoOrganizacion`, `consultaActividad` y `exportarActividad`: eventos de creación/cambio de alcance, filtro y columna `alcanceId`, CSV/Excel.

El flujo interno es: validar entrada → autorizar y bloquear organización/membresía dentro de la transacción → comprobar revisiones y referencias → crear o reutilizar espacios → guardar alcance y snapshot → registrar eventos → confirmar todo junto. Un fallo revierte el bloque completo. No es un log criptográficamente inalterable frente a un administrador de MongoDB.

## Contrato para Frontend

Prefijo público: `/api/organizaciones/:organizacionId`. Express no incluye `/api`. Se mantiene el cliente de sesión/CSRF actual; no guardar credenciales en localStorage ni introducir un login alternativo.

1. `GET /contexto`: recuperar las respuestas. Si devuelve `CONTEXTO_NO_INICIADO`, la primera escritura explícita sigue siendo `POST /contexto`; no hay seed automático.
2. `POST /contexto` o `PATCH /contexto`: conservar el contrato existente y `Idempotency-Key`. Primera escritura: `{hechos, motivo}`. Corrección: `{version, cambios, motivo}`. Máximos existentes: 200 hechos, 50 cambios por PATCH y 40 KiB. Dividir cambios grandes en revisiones explícitas sin confirmar materializaciones intermedias.
3. `GET /contexto/propuestas`: preguntas y respuestas agrupadas, propuestas de espacios/alcances, candidatos, fuentes, contradicciones y `propuestaHuella`. No admite filtros ni crea datos. Sin actividades conocidas devuelve cero propuestas y pregunta por las actividades.
4. `POST /contexto/materializaciones`: enviar la confirmación que se detalla debajo, con `Idempotency-Key`. Devuelve 201 si crea o 200 al repetir el mismo envío.
5. `GET /alcances?limite=20&antes=<id>`: lista paginada de cabeceras; máximo 50. No presupone que los candidatos de cada cabecera sigan vigentes: abrir su detalle.
6. `GET /alcances/:id`: revisión vigente con candidatos y `vigencia.necesitaRevision`/`motivos`.
7. `PATCH /alcances/:id`: nueva revisión explícita de límites y vínculos. Requiere versiones de alcance/contexto, huella actual de propuesta e idempotencia.
8. `GET /alcances/:id/versiones?limite=20&antes=3` y `GET /alcances/:id/versiones/:numero`: historial paginado e instantánea concreta. No recalculan y sustituyen resultados anteriores.

### Diccionario de respuestas

`perfil_actividades` es una lista de identificadores estables, entre cero y ocho, por ejemplo `["web", "producto", "saas"]`. Cada identificador empieza por letra minúscula, contiene solo letras minúsculas/números y mide como máximo 16 caracteres. No cambiarlo para renombrar una actividad: cambiar su nombre. Retirarlo de la lista no elimina espacios ni históricos.

Hechos generales: `pais_establecimiento`, `mercados`, `clientes`, `plantilla`, `publico_directo`, `cadena_publica`, `exigencia_ens`, `referencia_contrato_ens`, `voluntario_ens`, `voluntario_iso`.

Para cada actividad se utiliza `actividad_<id>_<campo>`. Campos: `nombre`, `tipo`, `funciones`, `datos_terceros`, `sistemas_terceros`, `por_cuenta_cliente`, `descargable`, `marca_propia`, `usa_ia`, `desarrolla_ia`, `papel_ia`, `finalidad_ia`, los campos ENS/ISO generales y `operaciones`.

- `tipo`: servicio o producto. `funciones`: lista de desarrollo/mantenimiento/distribucion/alojamiento/operacion.
- `operaciones`: lista de identificadores de operaciones existentes de esta organización; máximo veinte distintos en el conjunto del perfil. No se crean operaciones ficticias por nombre.
- Los campos sí/no son booleanos, no cadenas `"true"` o `"false"`. `mercados` y `clientes` son listas descriptivas, no un catálogo jurídico ni un CRM de clientes reales.
- La UI recibe texto y tipo de cada pregunta en `perfil.preguntas`. Las preguntas de papel/finalidad IA y relación de encargo se muestran según las respuestas relevantes; las incógnitas siguen siendo visibles.

Ejemplos de hechos, dentro de la escritura habitual del contexto:

```json
[
  {"clave":"perfil_actividades","estado":"conocido","valor":["web"]},
  {"clave":"actividad_web_nombre","estado":"conocido","valor":"Desarrollo web"},
  {"clave":"actividad_web_tipo","estado":"conocido","valor":"servicio"},
  {"clave":"publico_directo","estado":"conocido","valor":false},
  {"clave":"cadena_publica","estado":"desconocido","motivo":"por_consultar"}
]
```

Se conserva `conflictivo` con alternativas, y los motivos de desconocido del contexto existente. La procedencia de hechos conocidos la asigna el servidor; la revisión aporta autor/fecha también para desconocidos. La fecha proyectada identifica la revisión, **no promete ser la primera fecha de declaración de cada hecho**. La procedencia de los hechos no modificados y sus revisiones anteriores se conservan.

Las operaciones conservan respuestas propias. Si `publico_directo` es false en la empresa y true en una operación, se devuelven ambos hechos y la discrepancia. No se sustituye la respuesta particular, ni se concluye que toda la empresa está sujeta a ENS. Los datos generales que no se repiten en una operación tampoco se convierten automáticamente en hechos de esa operación.

### Confirmación de espacios y alcances

Ejemplo de estructura para un perfil con una sola actividad. Sustituir huella y versión por lo recibido; no fabricar valores.

```json
{
  "contextoVersion": 1,
  "propuestaHuella": "<huella de 64 caracteres devuelta por el servidor>",
  "confirmar": true,
  "espacios": [{
    "actividadId": "web",
    "nuevo": {"nombre":"Desarrollo web","tipo":"servicio","descripcion":"Servicio de desarrollo y mantenimiento"}
  }],
  "alcances": [{
    "clave":"web",
    "nombre":"Caso de desarrollo web",
    "actividadIds":["web"],
    "sistemas":[], "informacion":[], "limites":"",
    "exclusiones":[], "dependencias":[]
  }],
  "motivo":"Confirmación de la organización inicial del trabajo"
}
```

Para reutilizar: sustituir `nuevo` por `existente: {id, version}`. No enviar ambos. El nombre/tipo del espacio existente no se modifica desde esta confirmación. La propuesta puede corregirse antes de confirmar: nombres/descripciones, agrupación de actividades, sistemas, información, límites y dependencias. Una exclusión exige `{elemento, motivo}`; no implica aceptación jurídica de la exclusión.

La confirmación debe mapear cada actividad declarada a un espacio y cubrirla en algún alcance. Cada alcance puede contener varias `actividadIds`, y una actividad puede aparecer en varios alcances. También pueden reutilizarse espacios comunes. Los vínculos de operación proceden del perfil versionado, no de identificadores arbitrarios añadidos a la confirmación.

Respuesta: `espacios[{actividadId,id,version,creado}]`, `alcances[{clave,id,version,revisionId,sha256}]`, huella, versión de contexto y aviso. Un recibo repetido identifica la confirmación original: no afirma que sus recursos no hayan cambiado después. Consultar los detalles actuales.

`409 VERSION_DESACTUALIZADA`: conservar el borrador, volver a cargar la propuesta/versión y mostrar diferencias antes de reenviar. `409 CLAVE_REUTILIZADA`: misma clave con otro cuerpo/actor, o propuesta ya materializada con otra clave. No crear automáticamente otra propuesta para eludirlo. Usar los alcances guardados y su PATCH.

### Cambiar un alcance

Enviar `{version, contextoVersion, propuestaHuella, datos, motivo}`. `datos` contiene `nombre`, `actividadIds`, `subespacios:[{id,version}]`, `sistemas`, `informacion`, `limites`, `exclusiones`, `dependencias`. La primera versión de un alcance es 1; la versión de subespacio es su `__v` expuesto como `version`, inicialmente 0. No confundirlas.

Esto registra una revisión nueva; conserva la anterior, recalcula **candidatos de orientación**, no decisiones jurídicas, y registra el evento. El alcance permanece preliminar aunque todos los campos estén rellenos.

La lectura señala cambios de contexto, alcance, versión de catálogo, operaciones o subespacios. No cambia el contenido histórico. Un error en una referencia nueva del perfil no bloquea la consulta del histórico ya creado. No se promete una instantánea transaccional entre varias peticiones de lectura.

## Qué puede representar cada candidato

`contenido.candidatos` enlaza selector de familia/versiones, hechos con procedencia, definición/versiones, referencias/localizadores y fundamentos. `contenido.catalogo` conserva la versión editorial utilizada. Los identificadores candidatos son locales al alcance: identificar el objeto con **organización + alcanceId + revisión + candidato.id**, no solo `candidato_ENS`.

Todos siguen siendo candidatos, con aplicabilidad `pendiente_de_determinar` y satisfacción `no_evaluada`. `cobertura`, `temporalidad` y `revisionJuridica` son dimensiones separadas. Sin indicios en las preguntas no significa «no aplica». No disponer de texto autorizado tampoco significa exención. No hay categoría ENS inferida, clasificación automática de riesgo IA ni porcentaje.

La ficha ENS candidata referencia artículo 2.3, artículo 12 y anexo II 3.1 org.1 del RD 311/2022. Es un borrador parcial: sus dos criterios iniciales **no son una lista exhaustiva suficiente para aprobar org.1**. CCN-STIC 805/808 son apoyos con edición y permisos pendientes; no se ha copiado su contenido. Referencia primaria: https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191 (consolidado informativo, actualización publicada 06/11/2024).

RGPD, LOPDGDD, CRA, IA e ISO aparecen como familias con cobertura evaluable pendiente. El borrador `backend/catalogo/propuestas/rgpd28EncargoDirecto.js` sigue separado y sin publicar: NORM-C1 no lo amplía ni activa. Para ISO se mantienen separados requisitos de sistema de gestión y controles; este bloque no incorpora tablas, cláusulas ni equivalencias sustitutivas.

**Segunda etapa:** el motor determinista preciso ya existente sigue siendo quien evalúa una regla dentro de una cobertura definida. No se ha sustituido por el selector de familias. `catalogoAplicabilidad.js` continúa vacío en producción. Las reglas sintéticas únicamente se cargan desde tests/runners aislados; ninguna ruta permite al navegador publicar o suministrar reglas.

## Fuentes, fechas y contenido protegido

El catálogo guarda editor, identificador, versión, enlace, edición, consulta, publicación, entrada en vigor y aplicaciones diferenciadas. Se conservan fechas civiles con jurisdicción, no se les añade una medianoche UTC inventada. Cuando no se ha validado el calendario, aparece pendiente: no se deduce del año o del título del reglamento.

Los permisos describen el texto original y diferencian almacenamiento, literal, extractos, distribución, exportación e IA. El estado desconocido/pendiente no concede nada. BOE queda condicionado a su aviso; ISO/CCN quedan pendientes. Los booleanos no eliminan los límites de la autorización. En este bloque no existe endpoint de carga/importación editorial, reproducción de norma, fetch de URL ni conexión IA.

La subida general de PDF corporativos **no es un canal para ingerir normas protegidas**; NORM-C1 no inspecciona semánticamente ni concede licencias a PDFs subidos. No se ha alterado esa funcionalidad ni conectado sus archivos a IA. No prometer un bloqueo automático capaz de identificar cualquier obra protegida.

Condiciones a revisar para cada incorporación: BOE https://www.boe.es/informacion/aviso_legal/index.php ; ISO https://www.iso.org/copyright.html ; CCN https://www.ccn-cert.cni.es/es/aviso-legal.html . Los enlaces EUR-Lex son referencias editoriales, no garantía de revisión integral de versiones/calendarios ni de vigencia de todos los preceptos.

## Pruebas seguras y límites de verificación

Los comandos siguientes se ejecutan en el checkout aislado. No hacen seed en la base normal, no necesitan Docker, no cambian certificados y no envían correo. El ejecutor inicia su propio mongod en loopback y puerto aleatorio, crea una base sintética, y al terminar detiene y elimina exclusivamente sus datos temporales.

```bash
cd /home/kali/Documents/practica3/normativa_integracion/backend
node --test tests/perfilNormativo.test.js
MONGOD_TEST_BINARY=/ruta/absoluta/al/mongod node scripts/run-perfil-normativo-mongo.js
npm test
```

La ruta del binario es una dependencia local de pruebas, no una variable de producción. En la verificación del 12/10 se utilizó MongoDB 7.0.43. No copiar una URI habitual a este runner: no la admite. La fixture completa está en `tests/fixtures/nexoSoftware.js`, nunca importada por el código productivo. El runner autentica identidades sintéticas con el modo legado exclusivo de pruebas; valida permisos, HTTP, transacciones y persistencia, **no el login HTTPS/MFA persistente ni el navegador**.

Resultados comprobados del cierre: 31/31 pruebas específicas nuevas; suite completa 892/892, cero fallos/omisiones/cancelaciones; runner NORM-C1, 19 grupos HTTP/réplica y un negativo standalone; regresión del runner de decisiones de aplicabilidad existente, 23 grupos HTTP/réplica y un negativo standalone. No se suman grupos a pruebas unitarias como si fueran una misma métrica. `git diff --check` correcto. No se ha repetido una prueba frontend ni un build Docker porque no se han modificado ni desplegado esas capas.

Aceptación cubierta por las pruebas: tres propuestas; retry y versión obsoleta; reutilización y muchos-a-muchos; duda ENS; separación de fundamentos; desconocidos/contradicciones; licencias/temporalidad/cobertura sin falsa exención; cadena de referencias; histórico y revisión pendiente; tenant/roles/forja; catálogo vacío y fixtures aisladas; ausencia de puntuaciones favorables. Además se prueban rollback de evento, réplica ausente, índice único ausente, revocación durante lectura, corrupción de snapshot y exportación CSV/XLSX.

## Punto de parada y siguiente bloque

No hay creación de tareas, evaluación favorable, porcentajes, PDS ni interfaz NORM-C1 en este encargo. La API puede ser integrada después por Frontend, pero no se afirma que ya esté publicada en la URL de la demo. No se han ejecutado build/restart de contenedores, commit ni push.

El siguiente paso es revisar jurídicamente una regla precisa del caso ENS y sus criterios, delimitando cobertura, excepciones, fuentes y fechas. Solo después se publicaría mediante el proceso editorial acordado. El siguiente bloque funcional relacionará requisito contextualizado y versión con medidas/tareas (muchos-a-muchos), evidencia documental/versionada y revisión motivada con revisor/fecha/tipo y desencadenantes de nueva revisión. Subir un documento o terminar una tarea no aprobará el requisito. Las entidades aún no implementadas no reciben IDs ficticios ni estados favorables.
