# Operaciones: contexto propio, versiones y API

Estado: NORM-B1e, 10/10/2026. Implementado y probado localmente en Kali, rama backend sobre fb99b0adde243d3473b8e2198f0a55d08604e7f0 más cambios sin commit. No publicado ni desplegado. No hay interfaz nueva integrada.

## 1. Qué resuelve

Una misma empresa puede alojar datos de un cliente y gestionar sus propias facturas. Esas operaciones tienen hechos y decisiones diferentes. Este bloque permite identificarlas y conservar su contexto por separado, sin deducir que el papel de una se aplica a toda la empresa.

Una operación pertenece a una organización. Puede existir sin contexto general previo, departamento, unidad o subespacio. Opcionalmente se vincula a UN subespacio de servicio/producto de esa misma organización. No es una unidad de personas ni concede acceso a documentos.

La primera versión guarda nombre, descripción, vínculo opcional y hechos declarados. No crea un registro de clientes, catálogo de tratamientos completo, tarea, evidencia, decisión jurídica ni estado de cumplimiento. No hay archivo, restauración o borrado de operaciones todavía. No se atribuye un cliente real a partir del nombre libre de una operación.

## 2. Código y responsabilidad de cada pieza

Los archivos están bajo /home/kali/Documents/practica3/normativa_check/backend:

- models/Operacion.js: cabecera actual, con organización, nombre, descripción, vínculo opcional y version_actual. El nombre no es único: la identidad es el ID, no una coincidencia de texto.
- models/RevisionOperacion.js: instantánea de nombre, descripción, subespacioId y hechos. Conserva autor, membresía, motivo, fecha, número y huella. Solo se insertan revisiones desde el servicio; no hay ruta para sobrescribirlas.
- validation/operacion.js: lista cerrada de entradas y metadatos. Reutiliza validación de hechos de contextoEmpresa: mismos tipos, límites, desconocidos y conflictos; el cliente no puede enviar una falsa procedencia revisada.
- services/operaciones.js: autorización, lectura, guardado transaccional, reintentos, control de versión, integridad e historial.
- routes/operaciones.js: GET/POST/PATCH y consulta de versiones. Organizaciones monta el router; sesión/no-store/CSRF se conservan.
- tests/operaciones.test.js y scripts/check-operaciones-mongo.js / run-operaciones-mongo.js: validación y pruebas HTTP con base temporal.

Se adaptan EventoOrganizacion, consultaActividad y exportarActividad para referenciar y filtrar la operación. No se cambian motor de aplicabilidad, contexto general, decisiones generales, autenticación, scoring, resultados, paquetes o frontend.

## 3. Cómo funciona un guardado

1. Validar el cuerpo, la clave de reintento y, en PATCH, el ID de la operación.
2. Comprobar índices únicos reales y abrir la transacción existente. Resolver admin empresarial activo dentro de ella; el rol global del usuario no sustituye la membresía.
3. Localizar la operación por ID Y organización. Comprobar si la clave ya produjo una revisión de esa misma petición y actor.
4. Si es un cambio nuevo, comparar version con version_actual y verificar la revisión de partida.
5. Combinar respuestas por clave. Omitir una clave conserva su valor y procedencia anteriores. Desconocido/conflictivo no se transforma en sí/no.
6. Validar el vínculo final: si no es null, debe existir y estar activo en esta organización.
7. Guardar cabecera, revisión completa y evento en la MISMA transacción. Si falla cualquiera, todo se revierte.
8. Devolver la revisión guardada y la versión actual. No calcular una decisión jurídica implícita.

Se reutiliza la serialización organizativa de las transacciones actuales. Dos cambios nuevos sobre la misma versión no sobrescriben silenciosamente: uno gana y el otro recibe 409. Dos operaciones distintas mantienen secuencias independientes.

Idempotency-Key tiene 16–100 caracteres alfanuméricos, guion o guion bajo. Un reintento repite CLAVE Y CUERPO; cambiar cuerpo, actor o destino con la misma clave da CLAVE_REUTILIZADA. La unicidad de la clave se comprueba dentro del módulo de operaciones y de la organización.

Un reintento tardío devuelve la revisión original aunque ya haya otras posteriores. Puede traer contexto.version=2 y versionActual=5. El frontend no debe presentar la revisión reintentada como si fuera la vigente: consultar el GET actual.

## 4. Rutas efectivas y permisos

Prefijo público: /api/organizaciones/:organizacionId/operaciones. Dentro de Express se omite /api.

- GET /: lista resúmenes de operaciones; no incluye todos sus hechos.
- POST /: crea operación y revisión 1.
- GET /:operacionId: operación y contexto actuales.
- PATCH /:operacionId: nueva revisión de metadatos y/o respuestas.
- GET /:operacionId/versiones: historial de revisiones, sin contenidos completos.
- GET /:operacionId/versiones/:numero: operación/contexto de esa revisión concreta.

Todos requieren sesión completa y admin ACTIVO de esa organización. No se amplía acceso a coordinadores, colaboradores, consulta, responsables profesionales o admin global. La lectura vuelve a validar permisos antes de emitir la respuesta.

No existen /contexto como alias dentro de la operación ni /decisiones de operación en este bloque. Las rutas antiguas /contexto y /contexto/decisiones conservan su objeto GENERAL de empresa. No enviar allí el contexto de una operación ni convertir su ID en contextoId general.

POST/PATCH exigen Idempotency-Key y la protección CSRF existente. Usuario, organización, fecha, autor, procedencia y hash los fija el servidor; el cuerpo no puede introducirlos.

## 5. Ejemplos de contrato, no comandos para la base real

Alta sin subespacio:

~~~json
{
  "nombre": "Alojamiento de contactos del cliente",
  "descripcion": "Operación del servicio SaaS que se está delimitando.",
  "hechos": [
    {
      "clave": "tratamiento_por_cuenta_cliente",
      "estado": "desconocido",
      "motivo": "por_consultar"
    }
  ],
  "motivo": "Registro inicial de la operación"
}
~~~

subespacioId puede omitirse o ser null. Si se aporta, debe ser un ID real del subespacio, no su nombre ni un ID de otro tenant. El ejemplo no presupone ya revisado el papel jurídico.

PATCH de respuestas y nombre:

~~~json
{
  "version": 1,
  "nombre": "Alojamiento de contactos comerciales",
  "cambios": [
    {
      "clave": "tratamiento_por_cuenta_cliente",
      "estado": "conocido",
      "valor": true
    }
  ],
  "motivo": "Aclaración del funcionamiento del servicio"
}
~~~

PATCH solo de metadatos:

~~~json
{
  "version": 2,
  "subespacioId": null,
  "motivo": "Separar la operación del servicio anterior"
}
~~~

No hace falta enviar cambios en un PATCH solo de metadatos. Si se envía cambios, debe contener entre 1 y 50 entradas; no usar [] como borrado. No hay borrado de hechos: utilizar desconocido con motivo cuando la información ya no pueda sostenerse. Un cuerpo sin ningún campo de cambio se rechaza.

Reafirmar un valor o metadato igual, con nueva clave y motivo, crea otra revisión explícita. El evento no finge claves de hechos cambiadas si realmente no lo están.

## 6. Respuesta y snapshots

La respuesta incluye:

- operacion: id, organizacionId, nombre, descripcion, subespacioId de la revisión devuelta.
- versionActual: número actual de la cabecera.
- contexto: id con prefijo ctx_op_, version de la revisión, organizacionId, objeto={tipo:operacion,id}, registradoEn y hechos.
- revision: id, numero, registradoEn, autorId, membresiaAutorId, motivo, sha256.
- repetida y horaServidor.

La huella de RevisionOperacion comprende metadatos Y hechos. La huella de contexto del motor es un concepto diferente: no intercambiar ambos hashes. Un cambio de nombre/vínculo también incrementa versión y queda en el historial.

contextoDeRevisionOperacion es un adaptador INTERNO: comprueba referencias, versión, contenido y huella, y produce el contexto para el motor. No autoriza ni consulta permisos; un futuro servicio de decisiones deberá resolverlos antes. No hereda hechos de la empresa, otro producto o una operación hermana.

Cada revisión conserva nombre y vínculo originales. La consulta de una revisión antigua no la rellena con metadatos actuales. El hash detecta incoherencias, pero no acredita veracidad ni protege frente a quien pueda modificar la BD y recalcular sus hashes. Fechas UTC no son sellado certificado.

## 7. Listados, enlaces e historial

GET /operaciones acepta limite (defecto 20, máximo 100), antes (ID exclusivo, orden descendente por _id) y subespacioId opcional. antes es una posición, no un permiso ni un instante. La lista se filtra por vínculos ACTUALES.

GET /:operacionId/versiones acepta limite y antes (número de versión exclusivo, descendente). La paginación devuelve hayMas y siguienteAntes. No es una instantánea transaccional entre varias peticiones.

Vincular a un subespacio archivado/ajeno/inexistente da RECURSO_NO_DISPONIBLE sin distinguir cuál de esos supuestos ocurrió. Si el subespacio se archiva posteriormente:

- Se conservan lectura e historial de la operación.
- El reintento autorizado de un guardado anterior devuelve su resultado original.
- Una edición nueva no puede conservar ese vínculo inactivo: debe retirar el vínculo, cambiarlo por uno activo o restaurar primero el subespacio mediante su flujo existente.
- Archivar un subespacio no borra ni archiva operaciones automáticamente.

El historial incorpora operacion_creada y operacion_actualizada, categoría operaciones y filtro/columna operacionId. No reutiliza contextoId, que continúa siendo contexto de empresa. Resúmenes: versión, nombre, vínculo, huella y claves de hechos cambiadas; no valores de respuestas, snapshots completos o clave de reintento.

El evento relaciona los subespacios anterior y nuevo. Así, al filtrar la actividad del servicio anterior, sigue apareciendo la desvinculación. Eso no concede acceso: estos eventos generales solo los ve el admin. El coordinador mantiene su ámbito de unidades y no ve eventos de operaciones.

CSV/XLSX reutilizan la misma autorización, filtros y defensas del exportador existente. clienteId, normativaId, estandarId y categoriaTarea siguen sin productores y devuelven FILTRO_NO_IMPLEMENTADO.

## 8. Límites y respuestas de error

Se reutilizan 200 hechos como máximo, 50 cambios por PATCH, hasta 40 KiB de hechos finales, clave de hecho de 80 caracteres y límites de tipos/listas. Metadatos: nombre 120, descripción 500, motivo 300. Versiones 1–999999999; no son __v ni aceptan texto numérico. La entrada JSON HTTP conserva el límite existente de 10 KiB.

- 400 DATOS_INVALIDOS: campo desconocido, tipo, tamaño, clave o formato inválido.
- 401: sin sesión válida/completa.
- 403: sin membresía/admin autorizado; una membresía suspendida también pierde reintentos.
- 404 RECURSO_NO_DISPONIBLE: operación/revisión/vínculo no disponible en ese ámbito.
- 409 VERSION_DESACTUALIZADA: conservar borrador, consultar cambios y resolver conscientemente.
- 409 CLAVE_REUTILIZADA: esa clave no corresponde a la misma petición.
- 503 SERVICIO_NO_DISPONIBLE: transacción, índice o integridad no disponibles. No guarda parcialmente.

Sin cuotas globales de operaciones/revisiones ni política de retención en este bloque. No sustituir este límite de alcance por una promesa de escalabilidad sin evaluar uso real.

## 9. Pruebas y cómo ejecutarlas

Desde Kali:

~~~bash
cd /home/kali/Documents/practica3/normativa_check/backend
node --test tests/operaciones.test.js
npm test
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-operaciones-mongo.js
~~~

La última ruta del binario se comprobó disponible para esta ejecución; si la carpeta temporal ya no existe, indicar otro mongod compatible mediante ruta absoluta. NO apuntar a una URI de Mongo real.

El runner arranca su propia instancia en loopback/puerto dinámico y base aleatoria, sin .env, Docker, credenciales o clientes reales. Al finalizar detiene la instancia y retira exclusivamente su directorio temporal, no datos del proyecto.

Evidencia de este bloque: 48 pruebas nuevas; suite completa 783/783, cero fallos/omisiones, 60,92 s. Operaciones: 18 grupos HTTP/réplica + 1 standalone negativo. Incluye aislamiento, permisos/CSRF, idempotencia concurrente, versiones, rollback, revisión histórica, metadatos/vínculos, exportación, revocación durante lectura/lista, índices ausentes, integridad y compatibilidad con el borrador interno.

Regresiones adicionales aprobadas tras el bloque: contexto general 18 grupos réplica + 1 standalone negativo; decisiones generales 23 grupos réplica + 1 standalone negativo. Ejecutores existentes run-contexto-empresa-mongo.js y run-decisiones-aplicabilidad-mongo.js con el mismo binario temporal.

El recorrido usa cuentas, operaciones y bases ficticias. No equivale a despliegue, UI, login organizativo real o revisión jurídica.

## 10. Siguiente bloque

La entidad y el contexto por operación ya están implementados. Falta persistir decisiones de aplicabilidad REFERIDAS A ESA OPERACIÓN mediante una capa autorizada, guardando revisión exacta, snapshot, antecedente y evento, sin modificar las decisiones generales existentes.

Después: preguntas progresivas integradas y revisión/publicación explícita de la primera regla. RGPD_ART28_ENCARGO_DIRECTO sigue en borrador, fuera del catálogo productivo. Se ha probado que acepta internamente el contexto recién guardado, NO que una API permita ejecutar/publicar esa regla.

Siguen pendientes clientes reales, permisos de revisores no admin, requisitos/tareas/evidencias/PDS, ciclo de archivo de operaciones e integración con Frontend. No activar una regla mediante un cambio aislado de etiqueta. No repetir la conversión de Mongo ni ejecutar seed para usar estas pruebas.

## 11. Actualización B1f: decisiones e inspección conectables

La tarea de decisiones por operación del apartado anterior ya está implementada. Contrato, pruebas y laboratorio en decisiones-operacion-workspace.md. Nueva API /:operacionId/reglas y /decisiones (listado, creación y detalle), más consulta autorizada /:operacionId/propuestas/rgpd28 sobre revisiones guardadas.

El borrador sigue sin publicarse. La demo aislada utiliza una regla contractual ficticia para comprobar persistencia/estados, sin incorporarla al catálogo productivo. Frontend recibió encargo explícito de conectar el Workspace de ejemplo; no confundirlo con el frontend desplegado.
