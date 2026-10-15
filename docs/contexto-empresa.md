# Contexto general de empresa — B1b
Fecha: 09/10/2026. Implementado localmente en Kali y probado con datos sintéticos.
No publicado, desplegado ni conectado todavía a pantallas. No es la guía Word definitiva.

## Para qué sirve y qué falta
El motor B1a sabe calcular una decisión a partir de hechos y una regla. Este bloque guarda de forma autorizada los hechos generales de cada empresa y conserva sus versiones. La ampliación B1c ya añade cálculo/persistencia por HTTP con catálogo cargado por el servidor; contrato en [decisiones-aplicabilidad.md](decisiones-aplicabilidad.md). El catálogo operativo sigue vacío: no se publica ninguna regla jurídica.

Se empieza por un único contexto general por organización. No hace falta crear departamentos ni subespacios. Los contextos de operaciones, servicios, productos, sistemas o contratos son un paso posterior: no se acepta un objeto arbitrario ni se simula que esas entidades existen.

Solo el administrador con membresía empresarial activa puede leer o escribir, incluidas revisiones anteriores. El rol global del usuario no sustituye ese permiso; coordinadores y otros miembros no lo reciben. El alta/invitación/membresía de la cuenta real sigue pendiente; no se crea una empresa automáticamente por iniciar sesión.

## Cómo se reparte el código
Base: /home/kali/Documents/practica3/normativa_check/backend.
- models/ContextoEmpresa.js: una cabecera por empresa, con version_actual. El índice único impide duplicarla.
- models/RevisionContextoEmpresa.js: instantánea completa de hechos, número, autor, membresía, motivo, fecha y SHA-256. Solo se insertan revisiones desde el servicio; no hay API para editarlas/borrarlas.
- validation/contextoEmpresa.js: valida el cuerpo y fusiona cambios por clave. Solo datos JSON tipados/acotados; no operadores Mongo ni atributos arbitrarios de autoría o revisión.
- services/contextoEmpresa.js: autorización, transacción, versiones, reintentos y lectura. Reutiliza transaccionOrganizacion.js, que bloquea organización/membresía para detectar cambios concurrentes de permiso.
- routes/contextoEmpresa.js: adapta HTTP; lo monta routes/organizaciones.js bajo /:organizacionId/contexto.
- EventoOrganizacion, consultaActividad y exportarActividad: incorporan esta familia de eventos al historial ya existente.
- tests/contextoEmpresa.test.js y scripts/check-contexto-empresa-mongo.js: validación y recorrido HTTP/BD temporal. scripts/run-contexto-empresa-mongo.js arranca y retira su propia base sintética.

La cabecera no contiene una copia editable y otra histórica que puedan divergir: apunta a la revisión vigente. Cada revisión guarda todos los hechos de ese momento; reconstruir la versión 2 no exige encadenar los cambios desde la 1.

## Contrato HTTP existente en el código
Prefijo público: /api/organizaciones/:organizacionId. En Express se omite /api.
Se mantienen sesión/cookie y CSRF existentes; las respuestas autenticadas son private, no-store.
Estas rutas sustituyen, PARA EL CONTEXTO GENERAL, las candidatas plurales del documento B1a. No hay alias /contextos. La API de decisiones se añade en [decisiones-aplicabilidad.md](decisiones-aplicabilidad.md).

| Método y ruta | Resultado |
| --- | --- |
| GET /contexto | Revisión vigente y metadatos; 404 CONTEXTO_NO_INICIADO si no existe. Leer no crea nada. |
| POST /contexto | Primera revisión. Requiere Idempotency-Key; 201 al crear, 200 al repetir el mismo envío. |
| PATCH /contexto | Cambios parciales por clave, con versión esperada e Idempotency-Key; devuelve 200. |
| GET /contexto/versiones?limite=20&antes=4 | Resúmenes de revisiones, descendentes por número; antes es exclusivo. No descarga todos los hechos. |
| GET /contexto/versiones/:numero | Instantánea histórica completa, con autorización actual de admin. |

### Crear
Ejemplo sintético de cuerpo, NO catálogo aprobado de preguntas ni afirmación jurídica:
```json
{
  "hechos": [
    { "clave": "pais", "estado": "conocido", "valor": "ES" },
    { "clave": "vende_software", "estado": "conocido", "valor": true },
    { "clave": "actividad_por_aclarar", "estado": "desconocido", "motivo": "por_consultar" }
  ],
  "motivo": "Primera descripción de la empresa"
}
```
Se permite hechos vacío: equivale a no disponer aún de datos, no a responder todo negativamente. Las claves se validan sintácticamente; el diccionario funcional y su correspondencia con preguntas/reglas revisadas todavía no están publicados ni integrados. El motor solo utilizará los hechos definidos por la regla concreta.

### Actualizar sin borrar lo demás
Si la versión recibida es 1:
```json
{
  "version": 1,
  "cambios": [
    { "clave": "vende_software", "estado": "conocido", "valor": false }
  ],
  "motivo": "Corrección de la actividad declarada"
}
```
El servidor guarda versión 2. Mantiene pais y actividad_por_aclarar porque no se han enviado. La versión 1 conserva el true original. Un false es un dato explícito, no ausencia.

Para retirar una afirmación del contexto actual se envía esa clave como desconocido con motivo no_aportado, no_sabe o por_consultar; no se envía null ni se elimina la historia. También se admite conflictivo, con alternativas distintas, sin decidir automáticamente cuál es verdadera:
```json
{
  "clave": "vende_software",
  "estado": "conflictivo",
  "alternativas": [{ "valor": true }, { "valor": false }]
}
```

Cada guardado explícito con nueva clave y versión correcta genera una revisión, incluso para reafirmar datos idénticos. En ese caso el motivo queda registrado y claves_cambiadas puede ser vacío. Un reintento con la MISMA clave/cuerpo no genera revisión ni evento extra.

### Qué añade el servidor
Identificadores, organización, autor, membresía y fechas no se aceptan del navegador. Los hechos conocidos y sus alternativas reciben procedencia de tipo declarado y referencia a la membresía que los registra. Los hechos no modificados conservan su procedencia anterior.
No se admite que el cliente marque datos documentado/revisado, ni que subir un PDF cambie su estado. Las alternativas contradictorias de esta API son declaraciones del administrador, no atribuciones verificadas a terceras personas.

Respuesta data:
- contextoId: identificador Mongo de la cabecera.
- versionActual: versión vigente al consultar la cabecera.
- contexto: contrato del motor, con id ctx_..., version, organizacionId, objeto de tipo organizacion, registradoEn y hechos.
- revision: numero, registradoEn, autorId, membresiaAutorId, motivo y sha256.
- repetida: true únicamente si se reconoce el mismo envío ya confirmado.
- horaServidor: hora UTC de la respuesta; no sello certificado ni prueba de sincronización NTP.

En una lectura histórica o repetición tardía, contexto.version puede ser 2 mientras versionActual es 3. El front NO debe presentar esa revisión 2 como vigente; debe consultar GET /contexto. Las lecturas revalidan el permiso antes de responder, pero no prometen que otro administrador no guarde una nueva revisión después.

### Reintentos y conflictos: comportamiento del front pendiente de integrar
Generar una Idempotency-Key aleatoria por intento lógico de guardado (UUID válido). Conservarla junto al cuerpo mientras se reintenta por un fallo de red. No reutilizarla para otro cuerpo, otro actor o una operación nueva.
Si llega VERSION_DESACTUALIZADA, conservar el borrador, consultar el contexto actual, comparar y dejar que el administrador resuelva los cambios. Después enviar nueva versión y nueva clave. No recargar destructivamente ni reintentar con la nueva versión sobre el borrador viejo sin revisión.

Otros errores:
- 400 DATOS_INVALIDOS: estructura, tipos, campos, límites o parámetros inválidos.
- 401: sesión ausente/no válida.
- 403: sin membresía admin activa de la organización o denegación CSRF.
- 404 CONTEXTO_NO_INICIADO / RECURSO_NO_DISPONIBLE: contexto aún no creado o revisión inexistente.
- 409 CONTEXTO_YA_EXISTE / CLAVE_REUTILIZADA: creación duplicada o clave asociada a otro envío.
- 413: cuerpo JSON superior a 10 KiB, rechazado antes de procesar la ruta.
- 503: infraestructura/índices/transacción/integridad no disponibles. No guardar parcialmente como alternativa.

Límites técnicos: JSON HTTP 10 KiB existentes; hasta 200 hechos, 50 cambios por PATCH, 40 KiB de hechos normalizados acumulados por revisión; texto de valor 400 caracteres, lista de hasta 50 textos de 100 caracteres, números finitos hasta 1e12, motivo 300 caracteres. Una petición puede alcanzar 10 KiB antes que otros límites. Paginación 1–100, por defecto 20; versiones positivas hasta 999999999. No se han definido todavía cuota comercial o retención del historial.

## Atomicidad, aislamiento y log
Dentro de una misma transacción se revalida al admin, se bloquea la organización/membresía, se comprueba la versión, se inserta revisión, se mueve la cabecera y se crea evento. Si falla el evento, no queda contexto ni revisión parcial. Índices únicos reales comprobados; no se sustituye la transacción con escrituras sueltas cuando Mongo está en standalone.

Nuevas acciones contexto_creado y contexto_actualizado. Eventos generales, sin unidad ficticia: solo los admins los ven en el historial. Coordinadores mantienen su historial de unidades; filtrar categoría contextos no les concede acceso.

GET /actividad admite categoria=contextos, contextoId y las acciones nuevas, combinables con autor/fechas y paginación. CSV/XLSX admiten contextoId como columna. El evento conserva versiones/huellas y claves cambiadas, NO el cuerpo completo de hechos ni la clave de reintento. Para estudiar valores concretos, el admin consulta las revisiones.

clienteId, normativaId, estandarId y categoriaTarea siguen con FILTRO_NO_IMPLEMENTADO. Esta ampliación NO completa el historial normativo, el seguimiento de tareas ni la evolución del cumplimiento.
SHA-256 detecta incoherencias accidentales; no es firma, evidencia de veracidad ni protección contra quien puede modificar los datos y recalcular la huella en MongoDB.

## Comprobación reproducible y límites de verificación
Desde /home/kali/Documents/practica3/normativa_check/backend:
```bash
node --test tests/contextoEmpresa.test.js
npm test
MONGOD_TEST_BINARY=/ruta/absoluta/a/mongod node scripts/run-contexto-empresa-mongo.js
```
La ruta de mongod se comprueba antes de ejecutar. El runner solo admite su Mongo temporal de loopback/puerto dinámico y nombre de base aleatorio, usa cookies ficticias, no carga .env y elimina únicamente sus datos temporales al terminar. No apuntarlo a la base real ni copiar la URI del despliegue.

Resultado de este bloque: 56 nuevas pruebas unitarias; suite completa 642/642; contexto por HTTP/Mongo temporal 18 grupos en replica set y 1 negativo standalone; regresión documental/subespacios 18+1 grupos. Sin fallos en las ejecuciones completas.
La réplica real nc-rs y /api/health se comprobaron previamente en lectura. No se repite --aplicar. Este bloque NO prueba la cuenta real, una transacción de negocio desplegada, el navegador o restaurar la copia de seguridad.

## Siguiente paso
La persistencia/API de decisiones ya está implementada y probada con fixtures sintéticas en B1c; véase decisiones-aplicabilidad.md. El catálogo operativo sigue vacío. Lo siguiente es contrastar y cerrar una regla jurídica real con fuentes, alcance, fechas, excepciones y preguntas, antes de activarla.
Después, conectar preguntas progresivas y el recorrido de la cuenta real. No sustituir todavía scoring/resultados/PDS anteriores, ni iniciar IA o extraer PDFs.
