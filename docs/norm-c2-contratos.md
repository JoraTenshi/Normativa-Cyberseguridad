# NORM-C2 — Fechas, cobertura y núcleo de revisión

**Actualización C2c posterior, 14/10/2026:** el hito puro descrito más abajo se ha ampliado con persistencia/API, catálogo R3 propio, contexto de sistema, requisitos/actuaciones/evidencias/revisiones y trazabilidad. El contrato vigente está en [norm-c2-api.md](norm-c2-api.md). Verificación C2c tras corregir cobertura factual y completar responsables/versiones PDF:23 grupos HTTP/Mongo réplica +1 negativo standalone, regresión1005/1005 y smoke con sesión real en entorno efímero. Sigue sin despliegue habitual ni navegador de la UI conectada. Las afirmaciones «sin API/persistencia» de este documento describen el CORTE C2a/b anterior, no el estado actual de C2c. El catálogo legacy permanece vacío; el nuevo catálogo C2 contiene únicamente las dos fichas R3.

Corte: 14/10/2026. Encargo de Normativa (2) dentro de la autorización humana comprobada en el chat de Normativa (turnos 01a13610 y 01a13616). Registro CHG-005: https://www.notion.so/3e404e2d04ac813f81f4dad5f24e07a5.

## Estado real de este lote

Implementado en `/home/kali/Documents/practica3/normativa_integracion`, rama `integracion/workspace-20261011`, HEAD base `519605bec16fe0bd26064150b089e9bc4ad8b3ec`, con cambios locales previos preservados. No commit/push, despliegue, migración de datos, cambios en Docker/servicios habituales/secretos, app del equipo, landing 4192 o Hetzner.

**C2a, conectado a servicios existentes:** contrato de reglas v2, calendario civil explícito, guardia de cobertura material e histórica, reproducción de snapshots v1/v2, avisos de nueva decisión al cambiar de periodo. Las rutas de decisiones de organización y operación reutilizan esos servicios. Catálogo productivo vacío; no hay reglas legales activadas ni se afirma que el contenedor en 9443 esté ejecutando este código.

**C2b, núcleo de dominio preparado y probado, todavía sin API/persistencia propia:** contrato de fichas, requisito contextualizado, vínculo muchos-a-muchos con actuaciones, evidencia exacta y revisión motivada por criterio. Estos módulos son funciones internas puras. Validar IDs, declarar un permiso en una fixture o calcular hashes NO acredita que el recurso exista, que el usuario esté autorizado o que se haya guardado algo.

**No cerrado:** contexto persistente de sistema vinculado al alcance; colecciones y servicios transaccionales de requisitos/actuaciones/evidencias/revisión; permiso de revisión resuelto contra membresías vigentes; endpoints nuevos; publicación controlada del paquete; integración de ficha UI; métricas, PDS y E2E. El objetivo de Normativa (2) sigue abierto.

## 1. Regla v2: tres preguntas distintas

1. ¿Este paquete cubre el caso? Guardia declarativa `cobertura.condicion`.
2. ¿El periodo está dentro de la cobertura histórica del paquete? `cobertura.periodo`, opcional.
3. Si ambas guardias pasan, ¿se satisface la condición de aplicabilidad, con sus excepciones y vigencia? `condicion`, `excepciones`, `vigencia`.

Fuera de cobertura no significa fuera de la ley ni incumplimiento. No se ejecuta la condición jurídica mientras la guardia sea falsa/desconocida. Un valor explícitamente inválido se rechaza incluso en una rama no decisiva.

```json
{
  "contratoVersion": 2,
  "vigencia": {
    "estado": "definida",
    "tipo": "fecha_civil",
    "calendario": "gregoriano",
    "jurisdiccion": "ES",
    "zonaEvaluacion": "Europe/Madrid",
    "desde": "2022-05-05",
    "hasta": null
  },
  "cobertura": {
    "descripcion": "Descripción precisa del caso cubierto",
    "condicion": { "op": "eq", "hecho": "caso_cubierto", "valor": true },
    "periodo": {
      "desde": "2024-05-05",
      "hasta": null,
      "motivo": "Límite histórico del paquete; no fecha de entrada en vigor"
    }
  }
}
```

Es un fragmento de contrato, no una regla publicable. El campo de cobertura temporal usa el calendario, jurisdicción y zona de la vigencia civil y solo se admite con ella. `desde` se incluye y `hasta` se excluye. Se validan días reales y bisiestos. No se infiere una zona a partir del país: Madrid/Canarias pueden dar días diferentes para un mismo instante. La selección correcta para un caso sigue siendo responsabilidad del paquete y su revisión.

V2 admite también vigencia definida de `tipo: instante_utc` con `desde`/`hasta` ISO UTC, o `{estado: pendiente}`. La cobertura temporal civil no se mezcla con un calendario pendiente ni con instantes UTC.

El cálculo sigue recibiendo `fechaEvaluacion` del reloj del servidor; HTTP no acepta fechas, autores, reglas, resultados ni testigos impuestos por el cliente. Una revisión/consulta de fuente posterior al cálculo hace que el cálculo falle. No se antedatan fuentes para aparentar una evaluación histórica.

### Salidas

- `estado`: `aplica`, `no_aplica`, `pendiente_de_determinar`, `candidato` (borrador/retirada).
- `temporal`: `en_periodo`, `futura`, `finalizada`, `por_determinar` — vigencia de la regla, NO cobertura.
- `cobertura.estado`: `dentro_de_cobertura`, `fuera_de_cobertura`, `pendiente_de_delimitar`.
- `cobertura.temporal`: `en_periodo` o `fuera_de_periodo` — cobertura histórica del paquete.
- `cobertura.descripcion`, `traza` y `periodo` explican la guardia.
- Fuera de cobertura: `estado: pendiente_de_determinar`, `traza: null`, `habilitaEvaluacion: false`. El motivo diferencia cobertura material, pendiente o temporal.
- Dentro de cobertura, una condición falsa puede producir `no_aplica` SOLO para esa regla/objeto. No descarta la familia normativa completa ni otras vías.

Los listados de decisiones v2 exponen cobertura, motivo y habilitación además del detalle. `revision.coberturaPeriodoCambiado` activa `requiereNuevaDecision` aunque la vigencia legal no haya cambiado.

### Compatibilidad y reproducción

Reglas sin `contratoVersion` conservan contrato/motor `aplicabilidad-contextual/1`, sin insertar nuevos campos ni cambiar hashes. V2 utiliza `aplicabilidad-contextual/2`. No se acepta una regla v2 etiquetada como motor v1. La transición exige incrementar la versión de la regla.

La referencia temporal v2 almacena fecha civil observada, desplazamiento en segundos, zona, jurisdicción, calendario y versiones ICU/tzdb. La reproducción usa la observación guardada en el snapshot y protegida por su hash, no vuelve a convertir el pasado con otra versión de datos horarios. Se valida su coherencia interna con el instante. No es sello certificado ni protección frente a un administrador de BD que reescriba todos los datos y hashes. Las nuevas evaluaciones y avisos de actualidad usan la zona explícita y los datos horarios instalados.

Referencias técnicas: [Node e ICU](https://nodejs.org/api/intl.html), [ECMA-402 DateTimeFormat](https://tc39.es/ecma402/#sec-intl-datetimeformat-constructor). No se ha añadido una dependencia.

## 2. Fichas: contrato editorial, sin publicación implícita

`validation/paqueteNormativo.js` exporta `validarFicha(ficha, regla)` y `validarPaquete({ficha, regla, casosAplicabilidad?})`. Comprueba:

- ID y versión exactos de ficha/regla, fuentes idénticas y referencias existentes de cada criterio.
- Criterios identificados, origen norma/metodología, tipos de evidencia y motivación obligatoria.
- Actuaciones sugeridas separadas de satisfacción; dependencias existentes y sin ciclos.
- Ausencia de aprobación automática, caducidad universal o pérdida del histórico.
- Revisión editorial identificada y sin atribuir dictamen jurídico profesional; uso del contenido declarado.
- Correspondencia entre el límite histórico de la ficha y la guardia realmente ejecutable de la regla.

La verificación estructural no decide si los criterios jurídicos están completos, ni concede licencias, ni sustituye el segundo control de fuentes. `catalogoAplicabilidad.js` permanece vacío.

Fichas examinadas, propiedad de Normativa (2), SIN modificar:

- `outputs/norm-c2-20261014/paquete/ENS_POLITICA_SEGURIDAD.v2.json`: ficha 2 / regla 2. Hash de ficha+regla `349e92292aa0f89688f4cadccb6c44ff72523736c40b44bb6c56e248423c74bd`.
- `outputs/norm-c2-20261014/paquete/RGPD28_FORMALIZACION_CONTENIDO.v2.json`: ficha 2 / regla 3. Hash de ficha+regla `c9fd30e7a18da2b5ddc1b5f016dcf2288ba9aab35fc015df5666024ad12dc446`.

Los hashes identifican lo probado, no una aprobación jurídica. Un nuevo paquete requiere repetir el contraste.

Durante el segundo control editorial, Normativa (2) corrigió la ficha ENS para incluir coordinación y resolución de conflictos (10 criterios) y revisó referencias RGPD/LOPDGDD (14 criterios). Las versiones v2 NO se publican. Se repitió el contraste de los 22 casos actuales y los 4 controles temporales sobre los paquetes v3, con resultado correcto:

- `ENS_POLITICA_SEGURIDAD.v3.json`: ficha 3 / regla 3. Hash de ficha+regla `4ae1dc40ac099e714c00f6cb77f33ece6484913a228ee41abfa61f586b01e2d0`.
- `RGPD28_FORMALIZACION_CONTENIDO.v3.json`: ficha 3 / regla 4. Hash de ficha+regla `6a9a87d86a0c5535b7610bdb092ceb87fbea0cd7384c7e2db8551874a47e3303`.

Este contraste del backend tampoco publica v3 ni sustituye la revisión de las fuentes. Se conservan versiones e identificadores para diferenciar qué contenido se ha probado.

Normativa (2) entregó después `outputs/norm-c2-20261014/release-v3.json`: segundo control editorial asistido por IA terminado para estas dos fichas, ocho fuentes oficiales capturadas y autorización editorial para integración aislada. No es dictamen profesional. Su informe comunica 14/14 controles estructurales y 51/51 comprobaciones independientes de dominio contra el código vivo; son evidencia adicional reportada por ese chat, no pruebas HTTP/Mongo ni de navegador. Ya no falta otra aprobación editorial de este paquete R3: faltan la incorporación técnica, persistencia, publicación y recorrido integrado. La ampliación del corpus seguirá necesitando su propio control.

## 3. Núcleo requisito–actuación–evidencia–revisión

`services/revisionRequisito.js` no importa Mongoose ni ofrece rutas. No debe montarse directamente como controlador HTTP.

### Requisito contextualizado

`contextualizarRequisito` recibe referencias resueltas de organización, alcance (ID/versión/hash), decisión y ficha, junto al resultado/snapshot reproducible. Devuelve un requisito versionado con huella que fija esas bases. No contiene una satisfacción favorable por defecto. El futuro servicio debe comprobar pertenencia real del objeto evaluado al alcance, actuales de todos los recursos y unicidad del expediente; este núcleo solo comprueba coherencia.

### Actuaciones

`vincularActuacion` vincula una pareja de requisito y actuación de la misma organización. Permite reutilizar una actuación entre requisitos y varias actuaciones por requisito. No crea tareas, cambia sus estados ni deduce satisfacción. La futura relación persistida debe tener unicidad por pareja y cambios versionados/auditados.

### Evidencia

`validarEvidencia` exige ID/versión, organización, alcances explícitos, tipo, procedencia, localizador y periodo factual. Soportes admitidos en el contrato:

- `version_documento`: documentoId, versionDocumentoId, número exacto y SHA-256. El repositorio deberá cargar y comprobar la fila real `VersionDocumento` y su `DocumentoOrganizacion` con permisos; no aceptar ese objeto completo del navegador.
- `comprobacion`: método, instante realizado, responsable identificado, resultado y limitaciones. Admite registros, constataciones u otras tipologías declaradas por la ficha; no implica que cualquier constatación baste para cualquier criterio.

El tipo de evidencia admisible procede del criterio. Una carga PDF no decide el tipo jurídico ni la suficiencia. No se añaden formatos de subida distintos de PDF por este contrato; una comprobación es un registro tipado, no un cargador de ficheros genérico.

### Revisión

`crearRevisionRequisito` exige selección exacta del requisito, periodo civil finito, revisión interna, todos los criterios, conclusión y motivo. El servidor aporta el revisor real y el instante; el núcleo restringe inicialmente la revisión a un permiso de administrador resuelto por el servidor. No concede acceso, rol ENS, capacidad de aprobación empresarial ni acreditación. La ampliación a coordinadores/revisores delegados requiere política y servicio propios.

Cada criterio tiene resultado `favorable`, `desfavorable` o `no_determinado`, motivo y referencias a evidencias examinadas. Favorable exige evidencia de un tipo admitido y periodo cubierto en cada criterio. Si alguno es desfavorable, la conclusión no puede ser favorable; no hay compensaciones entre criterios. `no_procede` libre se rechaza: faltan alternativas estructuradas autorizadas por una ficha. No se permite revisión externa/automatizada en este primer contrato.

La revisión conserva referencias exactas, criterio y motivo, evidencia versionada, alcance, periodo, revisor y fecha; declara `esCertificacion: false` y `dictamenJuridicoProfesional: false`. Rechaza una decisión que no habilite evaluación, un periodo fuera de vigencia/cobertura y una revisión cronológicamente incoherente.

`vigenciaRevision` compara la revisión histórica con las versiones actuales resueltas por el servidor y la fecha de consulta. Cambios de fundamento/requisito/evidencia o pérdida de habilitación temporal señalan `requiere_revision` y mantienen intacta `conclusionHistorica`. **Todavía no es una consulta a BD ni una invalidación automática montada en la aplicación.**

## 4. Verificación realizada y límites

- 48 pruebas nuevas del motor/calendario/cobertura: formato, fechas reales, límites inclusivo/exclusivo, DST de 23/25 horas, zona explícita, snapshots, cobertura material/histórica, compatibilidad exacta de hashes v1.
- 42 pruebas del núcleo de ficha/revisión con fixtures: relaciones, datos exactos, motivación, rechazo de revisión incompleta/forjada/incoherente, organizaciones/alcances distintos, cambios y conservación del histórico. No prueban autorización HTTP ni existencia real de documentos.
- Regresión global final en Kali con C2a y núcleo C2b: **982/982**, sin fallos, omisiones ni cancelaciones (42,7 s). Incluye las 90 pruebas nuevas; no sumar recuentos como si fueran recorridos E2E. La ejecución anterior de 940/940 corresponde al corte que aún no contenía C2b.
- Mongo 7.0.43 temporal en loopback y puerto aleatorio: 26 grupos HTTP/réplica + 1 negativo standalone. Incluye 3 grupos C2 de sucesora v2, reintento/campos prohibidos y cobertura temporal/lectura de histórico; conserva roles/tenant/CSRF y rollback existentes. Runner usa identidades y modo de autenticación exclusivos de pruebas, no login HTTPS/MFA real.
- Paquetes v2 y repetición con v3: 22 casos presentes (ENS 9 + RGPD 13) contrastados contra el motor con hechos sintéticos. Otros 4 son SOLO comprobaciones de calendario y rechazo de evaluaciones con fuentes futuras. No se alteraron las fechas de consulta/revisión para hacerlos pasar.
- `casos-revision-integracion.v1.json` de Normativa contiene criterios de aceptación, NO resultados: sus casos de persistencia, autorización, relectura, UI, métricas y PDS no se declaran superados por estas pruebas puras.

No navegador/E2E nuevo en este lote. Los runners detuvieron y retiraron únicamente sus propias bases sintéticas temporales; no se borraron datos habituales.

Comandos de desarrollo, desde backend de la copia aislada:

```sh
node --test tests/aplicabilidadC2.test.js tests/revisionRequisito.test.js
node --test tests/*.test.js
MONGOD_TEST_BINARY=/ruta/absoluta/a/mongod node scripts/run-decisiones-aplicabilidad-mongo.js
node scripts/check-paquetes-normativos.js /ruta/ENS_POLITICA_SEGURIDAD.v3.json /ruta/RGPD28_FORMALIZACION_CONTENIDO.v3.json
```

El último comando es de lectura y prueba de contenido; no conecta Mongo ni publica el paquete. Las rutas de datos deben ser explícitas.

## 5. Siguiente lote, todavía pendiente

1. Contexto de objeto/sistema con ID estable, organización, alcance/revisión y hechos con procedencia propios; no convertir ENS a tipo organización ni heredar todas las respuestas globales. RGPD conserva su objeto operación.
2. Requisito contextual y versiones persistentes; relaciones de actuaciones y evidencias con comprobaciones de pertenencia, referencia exacta y visibilidad.
3. Servicios transaccionales, control de versión/idempotencia, eventos y relectura; resolver revocaciones/cambios concurrentes antes del commit y de la respuesta. El núcleo puro no sustituye esto.
4. Exponer contratos HTTP reales y documentar 409/422, paginación y acciones permitidas; recién entonces conectar la ficha de Frontend. No inventar endpoints o mocks presentados como reales.
5. Incorporar la liberación editorial R3 comprobando manifiesto/hashes, publicación controlada y recorridos ENS/RGPD contra API/Mongo/navegador, conservando las limitaciones del paquete. El segundo control editorial R3 está entregado; no hay que solicitarlo de nuevo.

Frontend original tiene la propiedad de la sección Normativa de ApiWorkspace y archivos UI propios de la copia de integración; este lote no toca frontend. La portada verde4192 y el despliegue futuro permanecen separados.
