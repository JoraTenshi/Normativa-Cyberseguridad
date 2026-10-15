# NORM-C2c — Contrato persistente para Frontend

14/10/2026. Código en `/home/kali/Documents/practica3/normativa_integracion`, rama `integracion/workspace-20261011`, base `519605b`. Este contrato amplía `norm-c2-contratos.md`: C2b ya no es solo núcleo puro; C2c lo conecta a Mongo y HTTP. No se ha desplegado en los contenedores habituales ni unido a la portada verde4192. No modifica la app del equipo, secretos, infraestructura o datos habituales.

## Estado y alcance

Se incorporan las dos fichas editoriales R3 de Normativa (2), con sus límites y revisión asistida por IA: ENS política de seguridad (10 criterios, ficha3/regla3) y RGPD28 formalización/contenido (14 criterios, ficha3/regla4). Son DOS requisitos concretos, no cobertura total de esas normas. Sus bytes coinciden con `outputs/norm-c2-20261014/release-v3.json`. El catálogo C2 está en `services/catalogoNormativoC2.js`; `catalogoAplicabilidad.js` y la orientación C1 conservan su comportamiento. No conectar la nueva ficha al catálogo legacy vacío.

Primera API administrativa: solo administradores activos de la organización, incluso para lectura. No se conceden accesos por rol ENS, rol global, token o `habilitaEvaluacion`. Las actuaciones C2 son trabajo administrativo ligado a requisitos; NO sustituyen el gestor colaborativo de tareas/unidades pendiente ni otorgan a su responsable un permiso de edición que todavía no existe.

## Rutas

Prefijo público HTTPS: `/api/organizaciones/:organizacionId/normativa`. Express usa `/organizaciones/...`; Nginx elimina `/api`. Usar el cliente API existente sin duplicar ese prefijo, sesión/cookies/CSRF existentes y `Cache-Control: no-store`.

- `GET /catalogo` → `{paquetes:[{ficha,regla,sha256,aviso}],permisos:{consultar,contextualizar},aviso}`.
- `GET /catalogo/:fichaId` → mismo contrato, con `paquete` singular. Desconocida: 404.
- `GET /responsables?limite=20&antes=<membresiaId>` → `{responsables:[{membresiaId,nombre,rol}],membresiaActualId,paginacion:{limite,hayMas,siguienteAntes},aviso}`. Solo admin, miembros activos inequívocos de ESTA organización, sin emails; máximo50. `membresiaActualId` procede del permiso actual del servidor, no del autor de un evento antiguo. No confundir membresiaId con usuarioId. Asignar no concede permisos. No existe todavía un CRUD general de miembros por esta ruta.
- Recursos: `/sistemas`, `/requisitos`, `/actuaciones`, `/evidencias`, `/revisiones`.
- `GET /recurso` → `{registros:[DTO],paginacion:{limite,hayMas,siguienteAntes}}`. Filtros: `limite`1–50 (20 por defecto), `antes` ID, `alcanceId` y `requisitoId`. El último identifica revisiones/actuaciones vinculadas, no sustituye permiso.
- `GET /recurso/:id` → DTO actual.
- `GET /recurso/:id/versiones` → `{id,versionActual,versiones:[{id,version,sha256,registradoEn,motivo}],paginacion}`. `antes` aquí es número de versión.
- `GET /recurso/:id/versiones/:numero` → DTO de esa versión; distinguir `version` consultada de `versionActual`.
- `POST /recurso` →201, o200 si reintento idéntico. Requiere `Idempotency-Key` estable y reutilizar cuerpo/clave si resultado incierto.
- `PATCH /recurso/:id` →200, cuerpo completo más `version` actual. No es un parche parcial: reenviar los campos completos del recurso, no borrar hechos omitidos inadvertidamente.
- `/revisiones` NO tiene PATCH ni DELETE. Una nueva revisión es un registro nuevo, no edita el juicio anterior. No hay DELETE de ningún recurso C2.

Respuestas de éxito: `{ok:true,data:...}`. Errores normalizados de organización: 400 datos no admitidos/incompletos; 401 sesión; 403 membresía/rol; 404 recurso/ficha no disponible; 409 versión/regla/estado/clave de reintento; 422 cálculo incompatible con el objeto/datos/regla; 503 integridad/BD/índices/transacciones. No se entregan detalles internos. Ante409 conservar borrador, volver a leer y resolver diferencias; no sobrescribir automáticamente.

## DTO común

`{id,tipo,version,versionActual,referencia:{id,version,sha256},contenido,revision:{id,numero,actorId,membresiaId,registradoEn,motivo},permisos,horaServidor,repetida}`.

`referencia.sha256` es la huella del CONTENIDO de la versión persistida. Usar `dto.referencia` para enviar referencias: NO sustituirla por la huella interna de `contenido.requisito.sha256` o de la revisión del motor.

`permisos` refleja autorización administrativa, no condiciones de negocio: `consultar:true`, `crear:true`, `actualizar:false` solo en revisión; `revisar:true` solo en requisito. Para habilitar una revisión también comprobar evaluabilidad, versión actual, estado y datos completos. El servidor vuelve a comprobar todo aunque la UI habilite el botón.

El catálogo incluye la ficha editorial completa (fuentes, criterios, actuaciones sugeridas, límites y uso). No presentar «revisada» como dictamen profesional. `regla.hechos` define los hechos admitidos; al enviar respuestas no incluir procedencia/autor: el servidor los atribuye a la membresía real.

## Escrituras por recurso

Todos los cuerpos llevan `motivo` (hasta300 caracteres, hasta2000 en revisión). Las ediciones añaden `version`. No admiten campos de actor, organización, permisos, hashes de PDF, resultado, regla o fecha del cálculo/revisión impuestos por el cliente.

### Sistema

`{nombre,descripcion,alcance:{id,version,sha256},hechos:[...],motivo}`.

El alcance debe existir en la misma organización y estar actualizado respecto de su contexto, operaciones, subespacios y orientación. Obtener su referencia mediante `GET /alcances/:id`: `{id,version:revision.numero,sha256:revision.sha256}`.

Los hechos son los mismos objetos públicos de ContextoEmpresa/Operacion: conocido `{clave,estado:'conocido',valor}`, desconocido `{clave,estado:'desconocido',motivo:'por_consultar'}`, o conflictivo con alternativas. Se admite colección vacía (quedarán preguntas pendientes). El sistema tiene ID estable y versiones propias, vinculadas explícitamente al alcance; NO hereda respuestas de empresa ni de otro sistema. La creación del sistema no cambia silenciosamente la instantánea del alcance.

### Requisito contextualizado

`{alcance:{id,version,sha256},objeto:{tipo:'sistema'|'operacion',id,version},ficha:{id,version},motivo}`.

El sistema debe estar vinculado exactamente al alcance indicado; la operación debe figurar en las operaciones del alcance real. Ficha publicada y objeto deben ser compatibles (ENS sistema, RGPD operación). El servidor fija reloj, contenido publicado, contexto y resultado. La combinación alcance+tipo/id de objeto+ficha identifica un expediente: otro POST no duplica esa combinación; para actualizar usar PATCH con su versión. No se cambia la identidad del expediente mediante PATCH.

`contenido` devuelve `{requisito,paquete,objeto,objetoSha256}`. El requisito contiene alcance exacto, ficha exacta, `decisionId` de su versión persistida, resultado y snapshot reproducible. No crea automáticamente actuaciones/evidencias/revisión favorable.

Extras del DTO:

- `estadoRevision:{conclusionHistorica,satisfaccionActual,requiereRevision,motivos,avisosCobertura,coberturaPeriodo,revisionId?,esCertificacion:false,seRefiereAVersionActual}`.
- Sin revisión: `conclusionHistorica:null`, `satisfaccionActual:'sin_revisar'` (o `requiere_revision` si cambió la base). No es porcentaje ni conclusión de cumplimiento.
- Con revisión: `favorable`, `desfavorable`, `no_determinado`, `fuera_del_periodo_revisado` o `requiere_revision`; siempre se conserva `conclusionHistorica`.
- TEMP-01 (15/10/2026): `estadoRevision.coberturaPeriodo` es `null` sin revisión; con revisión devuelve `{periodo,fechaCivilConsulta,estado,cubreFechaConsulta}`. Estados: `antes_del_periodo`, `dentro_del_periodo`, `despues_del_periodo`, usando la zona/calendario de la revisión y el intervalo desde inclusivo/hasta exclusivo. Fuera del periodo factual, `avisosCobertura` contiene `fecha_consulta_fuera_del_periodo_revisado`; dentro o sin revisión es `[]`. Ese aviso NO pertenece a `motivos` ni obliga por sí solo a repetir la revisión. Sin causas sustantivas, fuera del periodo se devuelve `satisfaccionActual:'fuera_del_periodo_revisado'`, `requiereRevision:false`, `motivos:[]`; no se proyecta la conclusión histórica como favorable/desfavorable actual.
- `motivos` contiene únicamente causas sustantivas: cambios de fundamentos o evidencias, indisponibilidad, evaluación/periodo normativo no habilitado o consulta anterior al instante de registro. Con cualquiera de ellas prevalece `satisfaccionActual:'requiere_revision'` y `requiereRevision:true`, conservando también `avisosCobertura` si concurre falta de cobertura factual. Mostrar ambos ejes, sin ocultar cambios reales tras el aviso temporal. Se mantienen todos los controles de integridad y permisos.
- La conclusión histórica, el periodo y los snapshots/huellas persistidos no se migran ni reescriben. El estado se deriva en lecturas del requisito (última revisión vinculada) y de la revisión específica. Se sigue rechazando evaluar hechos futuros; el periodo factual no es una caducidad del documento/norma, una garantía futura ni el plazo de próxima revisión. No hay planificador, validez anual o revisión diaria implícita. Los resultados de QA anteriores describen su propio corte y no acreditan esta corrección hasta repetir las pruebas afectadas.
- `evaluabilidad:{habilitaEvaluacion,fundamentosActuales,seRefiereAVersionActual}`. Para revisar: permiso + habilitación + fundamentos actuales + versión no histórica. La existencia de una revisión anterior obsoleta no impide hacer una nueva si sus fundamentos y evidencias actuales ya son correctos.
- En una consulta histórica, `estadoRevision` y `evaluabilidad` se refieren explícitamente a la versión ACTUAL del expediente, no recalculan el snapshot antiguo que se está mostrando.

Para aplicabilidad/cobertura usar `contenido.requisito.resultado.decision`: estados y calendario del contrato C2a. Un pendiente/fuera de cobertura jamás se dibuja como no_aplica; no se puede revisar favorablemente. Una decisión no_aplica solo afecta a esa vía/objeto.

### Actuación

`{titulo,descripcion,estado,requisitos:[dto.referencia,...],responsableMembresiaId,motivo}`.

Estados `pendiente`, `en_curso`, `terminada`, `archivada`. Archivar requiere estado previo terminada/archivada; no se crea directamente archivada. Responsable: membresía activa de la misma organización. Cada requisito referenciado debe ser actual y de esa empresa. Una actuación puede ligarse a varios requisitos y viceversa. La revisión de la relación conserva versiones. `contenido.efectoSobreSatisfaccion:'ninguno'`; terminar o archivar no aprueba criterios ni dispara revisión.

### Evidencia

`{alcances:[referenciaAlcance,...],tipo,titulo,procedencia,localizador,periodo,soporte,motivo}`.

`tipo` debe corresponder a alguno de los tipos que el criterio permita cuando se revise; el registro por sí solo no afirma suficiencia. `periodo:{desde:'YYYY-MM-DD',hasta:'YYYY-MM-DD',calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'}` usa hasta exclusivo. No inventar vigencia universal de documentos.

Soporte PDF: `{tipo:'version_documento',documentoId,versionDocumentoId}`. El listado autorizado existente `GET /documentos/:documentoId/versiones` devuelve ahora `versiones[].id` (ID real de VersionDocumento), además de numero/nombre/tamano/sha256/createdAt/analisisMalware. Usar ese `id` como `versionDocumentoId`, no deducirlo del número/hash. También se incluye en las respuestas que reutilizan versionDto, sin cambiar permisos. El servidor comprueba ambos registros reales, misma organización/documento y documento activo; fija número y SHA-256 desde VersionDocumento. La API no acepta esos valores inventados ni devuelve bytes. Reutilizar descarga documental autorizada existente. Una nueva versión del PDF o un documento archivado obliga a revisar; no se sustituye automáticamente la evidencia anterior.

Soporte comprobación: `{tipo:'comprobacion',metodo,realizadaEn:'ISO UTC con .mmmZ',resultado,limitaciones}`. El servidor fija `responsableRef` a la membresía que registra. No admite fecha futura. Es una constatación interna declarada, no certificación, sensor automático ni carga de formatos diferentes de PDF.

DTO contenido: `{evidencia,alcances}` y `vigencia:{requiereRevision,motivos,seRefiereAVersionActual}`. Un cambio de alcance también invalida la base de la evidencia. Las versiones anteriores siguen disponibles.

### Revisión interna

`{requisito:dto.referencia,evidencias:[dto.referencia,...],tipo:'interna',periodo,criterios:[{criterioId,resultado,motivo,evidenciaIds}],conclusion,motivo}`.

Resultados de criterio: `favorable`, `desfavorable`, `no_determinado`. Todos los criterios deben aparecer exactamente una vez. Favorable exige evidencia del tipo admitido y cuyo periodo abarque el revisado. Cada evidencia enviada debe estar examinada en algún criterio. No_procede libre, revisión externa y aprobación automática no están implementados. Conclusión: todos favorables→favorable; alguno desfavorable→desfavorable; resto→no_determinado.

El servidor resuelve membresía y recursos exactos, aplica permisos, evita fuentes/contextos/versiones obsoletos y fija instante de revisión. Guarda `contenido.revision` con criterio/motivo, evidencia exacta, revisor/fecha, alcance/periodo, huella y declaración no certificación/no dictamen. `estadoRevision` compara esa revisión con los fundamentos actuales sin sobrescribirla. Revisiones nuevas mantienen las anteriores; el expediente conserva un puntero transaccional a su última revisión, no lo deduce de un orden frágil de fechas.

## Persistencia, histórico y concurrencia

- `RegistroNormativo`: cabecera, tipo cerrado, identidad de negocio única, versión actual, índices de relación y puntero de última revisión.
- `VersionRegistroNormativo`: contenido validado por cada servicio, huella, autor, motivo e idempotencia; versiones append-only por la API. No hay permisos basados en campos libres del contenido.
- Todas las escrituras y su `EventoOrganizacion` se confirman en una misma transacción; utilizan el bloqueo organizativo/membresía existente, índices únicos y comparación de versiones. Un fallo del evento revierte incluso el puntero de revisión.
- Lecturas de registros coherentes en snapshot y revalidación de administrador antes de responder. No es un bloqueo eterno entre dos peticiones ni protección contra un administrador de BD malicioso.
- Historial general: `categoria=normativa`, `registroNormativoId`, actor, fechas, acción; exportación CSV/Excel existente añade columna `registroNormativoId`. Eventos C2 son organizativos, no se filtran a coordinadores como eventos de su unidad.
- Los modelos se inicializan en el arranque existente que recorre `mongoose.models`. No se han creado índices ni escrito datos en la BD habitual durante este trabajo. No se promete que una imagen Docker antigua contenga los modelos nuevos.

## Pruebas y límites actuales

23 grupos HTTP/Mongo7.0.43 temporal en réplica +1 negativo standalone superados. Recorridos reales sintéticos ENS y RGPD: contexto/perfil/alcance→sistema/operación→requisito→actuación/evidencia→revisión→relectura→cambio→revisión pendiente e histórico. Incluye controles de acceso/CSRF, versiones, idempotencia concurrente, rollback de log, referencias PDF, revocación durante lectura, ausencia de índices e integridad, dos ediciones concurrentes (una200/otra409), PDF real de otra empresa rechazado y exportación CSV/Excel abierta y comprobada. Añade directorio de responsables con paginación/permisos/estado, ID documental real y lectura API antes/dentro/después del periodo factual sin mutar la revisión. Los PDF son fixtures de documentos ya almacenados: no se vuelve a demostrar carga, análisis de malware ni autenticidad documental.

Regresión backend observada:1005/1005, sin fallos/omisiones/cancelaciones (incluye14 pruebas unitarias C2c y9 nuevas sobre periodo factual; no sumar los recuentos anteriores). Las nuevas pruebas usan el paquete ENS R3 sin cambiar su vigencia normativa, comprueban extremos y días de23/25 horas por cambio horario. Corrigen un fallo descubierto después del corte996: fuera del periodo examinado se seguía proyectando favorable actual. Normativa (2) reprodujo y volvió a comprobar independientemente el dominio; esta suite y la prueba HTTP son verificaciones propias distintas.

El runner temporal de QA volvió a superar --smoke tras estas correcciones: sesión real, anónimo401 y requisito persistido releído. Su fixture genera el periodo factual del día civil actual. Sin navegador/E2E visual nuevo ni despliegue. Verificar el contrato al conectar Frontend y repetir la suite tras cualquier ajuste posterior.

Límite para seguimiento/métricas futuros: el periodo factual observado NO fija la fecha de la próxima revisión de seguimiento. No usar su final como caducidad documental, obligación de revisión diaria o incumplimiento. La última conclusión histórica, sus bases, el periodo examinado, los cambios concretos y una eventual revisión programada son conceptos distintos; no se ha implementado aquí un planificador ni un porcentaje de cumplimiento.

Falta: montaje UI y pruebas navegador/HTTPS; activación coordinada de imágenes frontend/backend; ampliación del catálogo; roles de colaboración/asignación completa; métricas y PDS. No dar por cerrado el objetivo NORM-C2 completo solo con estas pruebas.

Comandos de pruebas aisladas, desde backend:

```sh
node --test tests/registrosNormativos.test.js
MONGOD_TEST_BINARY=/ruta/absoluta/a/mongod node scripts/run-registros-normativos-mongo.js
node --test tests/*.test.js
```

## Entorno efímero para QA de Frontend

`scripts/serve-normativa-browser-check.js` crea SU Mongo temporal y datos ficticios; no recibe URI de BD ni carga .env. Sirve API y build en `http://localhost:4282`, solo loopback; caduca a45min y admite `stop` por stdin. Tiene sesión real, no ruta de acceso de demo. Al cerrarse elimina exclusivamente sus datos sintéticos y detiene su Mongo; no usar documentación/identidades reales.

```sh
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod NC_C2_FRONT_BUILD=/tmp/norm-c2-front-build.YgJHtM node scripts/serve-normativa-browser-check.js
```

La ruta del build es la salida aislada preparada por Frontend; actualizarla por otra existente `/tmp/norm-c2-front-build.*` al compilar UI nueva. También admite por defecto `frontend/build`, pero servir un build antiguo no demuestra que contenga el módulo nuevo. No compila ni despliega por sí mismo.

Cuentas SOLO del entorno temporal: `admin@example.invalid` y `lectura@example.invalid`, contraseña pública sintética `Prueba-Normativa-4282!`. El runner imprime IDs de empresa, alcance, sistema, operación, requisitos y revisión. Escenario: ENS con revisión favorable ficticia y RGPD sin revisar, evidencias exactas y actuación compartida. La primera no representa un dictamen jurídico real; sirve para probar cómo se muestra.

Añadir `--smoke` comprueba anonimato401, login mediante `/auth/login` y relectura autenticada del requisito ENS favorable, y cierra inmediatamente. Esa prueba se ha ejecutado correctamente; no equivale a navegación humana/visual ni prueba HTTPS9443/MFA.
