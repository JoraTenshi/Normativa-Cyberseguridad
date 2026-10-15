# C2 — Contrato de alternativas y designaciones funcionales

14/10/2026. Extensión compatible del contrato `norm-c2-api.md`. No publica las tres propuestas ENS ni modifica los dos paquetes R3 existentes. El contenido normativo definitivo debe adaptarse, pasar su segundo control y probarse antes de incorporarlo al catálogo del servidor. No se declara cobertura de todos los arts. 11/13, ni se implementan aquí métricas, PDS o una interfaz nueva.

## 1. Diferencia respecto a R3

La ficha `schemaVersion:1` conserva el formato anterior: revisión de todos sus criterios, sin ruta implícita ni campos añadidos al snapshot. La revisión histórica sigue siendo schema1 y conserva su hash. El requisito continúa schema1 porque su estructura no cambia: su referencia de ficha y huella fijan el contrato concreto. No se cambia el motor de aplicabilidad v1/v2 ni la regla de fechas.

La ficha `schemaVersion:2` exige, además de los mismos campos editoriales/fuentes:

```json
{
  "satisfaccion": {
    "tipo": "rutas_cerradas",
    "hechos": [{
      "clave": "hecho_revisable", "tipo": "booleano",
      "pregunta": {"id":"P_HECHO","texto":"Pregunta concreta","grupo":"Revisión","motivo":"Razón de pedirla"}
    }],
    "rutas": [{
      "id": "RUTA_A", "titulo": "Alternativa definida", "explicacion": "Fundamento y límite de esta ruta",
      "requiereTodos": ["CRITERIO_A", "CRITERIO_B"],
      "hechosRequeridos": [{"clave":"hecho_revisable","valor":true}]
    }]
  }
}
```

Tipos admitidos: booleano, numero, texto. Guardas: únicamente igualdad tipada, no expresiones/código del navegador. Cada clave se declara y utiliza; si coincide con una clave de la regla de aplicabilidad debe tener el mismo tipo. Cada criterio pertenece al menos a una ruta. No IDs repetidos ni rutas vacías. La unión de rutas cubre los criterios, pero una revisión NO mezcla criterios de rutas diferentes.

Los hechos de satisfacción no se añaden artificialmente a la condición de aplicabilidad. Se registran en el contexto real versionado del sistema/operación y se congelan en el snapshot del requisito. La ficha declara preguntas posteriores a contextualizar/seleccionar ruta: no una batería inicial universal. Datos conocidos conservan procedencia atribuida por servidor; desconocidos y conflictos usan el contrato existente de contexto.

## 2. Guardar y cambiar hechos sin duplicar el contexto

Para sistema: GET `/sistemas/:id`, construir el cuerpo completo de sistema existente y PATCH `/sistemas/:id` con `version` actual y motivo. Mantener los hechos no modificados; no mandar solo la guardia nueva y perder el resto. El servidor genera procedencia. Para operación, reutilizar las rutas y contrato de operaciones, no crear un sistema espejo.

Después, PATCH `/requisitos/:id` con versión actual, alcance/ficha exactos y nueva versión del objeto; si el alcance depende de una operación cambiada, actualizar primero sus bases mediante el flujo existente de perfil/alcance. No ignorar un409. Esto crea una nueva contextualización y conserva la anterior. La siguiente revisión referenciará su `dto.referencia` exacta. No se acepta una fecha, un resultado calculado o una instantánea procedente del navegador.

Ejemplos completos sintéticos de ficha+regla, sistema, sujeto, designación y revisión: `norm-c2-alternativas-ejemplo.json`. Los IDs/huellas ilustran el contrato: deben sustituirse por referencias reales de las respuestas; no es un script de siembra ni contenido ENS.

## 3. Revisión schema2 en la API existente

POST `/revisiones`, misma sesión/admin/CSRF/Idempotency-Key, mismo cuerpo existente más:

```json
{
  "ruta": {"id":"RUTA_A","motivo":"Por qué se examina esta alternativa en el caso"},
  "criterios": [{
    "criterioId":"CRITERIO_A", "resultado":"favorable", "motivo":"Valoración razonada",
    "evidenciaIds":["ID_REAL"],
    "compatibilidad":{"estado":"compatible","motivo":"Qué se ha contrastado y sus límites"}
  }]
}
```

Enviar exactamente todos los criterios de la ruta. Resultados: favorable/desfavorable/no_determinado. Compatibilidad: compatible/desconocida/en_conflicto. Favorable exige evidencia admitida, versión/periodo/ámbito correctos y compatibilidad resuelta. La conclusión favorable exige que todas las guardas de la ruta estén conocidas y coincidan. Un dato desconocido/conflictivo no se convierte en excepción o no_aplica. El backend rechaza una conclusión incoherente; no la cambia silenciosamente.

Compatibilidad es una revisión humana declarada y motivada. No es análisis semántico automático, detector de contradicciones documentales ni juicio de suficiencia jurídica de medidas compensatorias. Solo se comprueban automáticamente las coherencias expresadas en el contrato y las referencias reales. No se deduce una excepción por tamaño de empresa ni por ausencia de incidentes.

Salida guardada `contenido.revision.schemaVersion:2`: campos anteriores más `ruta:{id,motivo,requiereTodos,hechos:[{clave,esperado,hecho,estado}]}` y `criteriosFueraRuta:[{criterioId,estado:'no_exigido_por_ruta',motivo}]`. La traza de guardias distingue coincide/no_coincide/desconocido/en_conflicto. Criterios fuera de ruta NO están satisfechos, no cuentan como requisitos adicionales y no se marcan no_procede. Se conserva todo el histórico.

## 4. Sujetos funcionales: identidad de registro, no identidad civil ni acceso

Mismo prefijo `/api/organizaciones/:organizacionId/normativa`. Nuevo recurso `/sujetos-funcionales`, con GET listado/detalle/versiones, POST y PATCH completo+version. Solo administradores activos, como el resto de C2. Sin DELETE, nuevas cuentas, permisos, tokens o vinculación automática a cargos.

Cuerpo: `{tipo:'persona'|'punto_organizativo',nombre,procedenciaOrganizativa,membresiaId:null|ID_REAL,motivo}`. ID estable generado por el servidor en la organización; la procedencia organizativa es una declaración identificable, no una comprobación de competencias. No incluir DNI, correo o datos personales innecesarios. Membresía opcional solo para persona y de la misma organización, activa al vincular. Su eventual suspensión no revoca por sí sola una designación jurídica: no confundir cuenta con función. Cambiar el tipo de sujeto requiere otro registro, no convertir la misma identidad persona↔punto.

Un mismo nombre NO identifica a una persona; dos IDs o cuentas NO prueban dos personas distintas. Evitar duplicados requiere identificar el registro correcto, y la comprobación de independencia/separación sigue siendo motivada. No se infieren competencias públicas del cliente para el proveedor. Contenido de respuesta: `{sujeto:{schemaVersion:1,id,version,organizacionId,...}}` dentro del DTO común.

## 5. Designación versionada por alcance/objeto/función

Recurso `/designaciones`, mismas operaciones/permisos/versiones/transacciones/eventos. Sin colección paralela: usa RegistroNormativo/VersionRegistroNormativo. Una identidad funcional por alcance+tipo/id de objeto+funcionId. La actualización puede renovar versión de alcance/objeto, no cambiar su identidad. Varias personas/puntos delimitados pueden figurar en esa misma asignación. No exige cuatro personas ni deduce conflicto por cardinalidad.

Cuerpo completo:

```json
{
  "alcance":{"id":"ID_REAL","version":1,"sha256":"HUELLA_REAL"},
  "objeto":{"tipo":"sistema","id":"ID_REAL","version":1},
  "funcionId":"FUNCION_IDENTIFICADA",
  "estado":"identificada",
  "motivoDelEstado":"Qué se conoce y qué falta por contrastar",
  "titulares":[{"sujeto":{"id":"ID_REAL","version":1,"sha256":"HUELLA_REAL"},"delimitacion":"Información o servicio concreto del que se ocupa"}],
  "instrumentos":[{"tipo":"comprobacion","metodo":"Examen documentado","realizadaEn":"2026-10-14T12:00:00.000Z","resultado":"Constatación declarada","limitaciones":"Límites de la constatación"}],
  "periodo":{"desde":"2026-10-14","hasta":null,"calendario":"gregoriano","jurisdiccion":"ES","zonaEvaluacion":"Europe/Madrid"},
  "motivo":"Alta o justificación del cambio"
}
```

Objeto sistema u operación real del alcance; no se crea tipo libre servicio_externalizado. Las circunstancias del servicio se declaran en hechos y se evalúan según la ficha/regla correspondiente. `funcionId` no es un permiso.

Estados identificada/por_aclarar/en_conflicto, siempre explícitos y motivados. Identificada exige al menos un titular y un instrumento. Los otros admiten ausencia de titulares para registrar la incertidumbre. No deducir el conflicto del número de personas. `hasta` es exclusivo o null (fin no determinado), no caducidad documental. La comprobación no admite fecha futura y su autor se fija en servidor.

Instrumentos alternativos: comprobación documentada anterior o `{tipo:'version_documento',documentoId,versionDocumentoId}`. El servidor resuelve PDF real, organización, estado activo, versión actual, número y hash. No es exigencia legal de PDF: es uno de los soportes técnicos admitidos. No se admite una designación sin instrumentar como prueba favorable.

La salida conserva versiones exactas y snapshots de sujetos, objeto y soportes. Un cambio crea versión, no borra el nombramiento anterior ni da acceso al sujeto registrado.

## 6. Usar designación como evidencia y conservar trazabilidad

En POST/PATCH `/evidencias`, `tipo:'designacion_versionada'` y `soporte:{tipo:'designacion_versionada',referencia:DTO_REFERENCIA_DESIGNACION}`. El servidor fija el snapshot. El cliente no envía datosSujeto/designacion ni hashes documentales inventados. Esta etiqueta no puede suplirse con un PDF/comprobación sin registro de designación.

Una evidencia de este tipo queda vinculada a un único alcance. Para revisar, debe coincidir el objeto/versión del requisito, cubrir el periodo y, si se declara favorable, estar identificada. Las referencias de sujetos/instrumentos deben seguir actuales. Cambiar designación, sujeto, instrumento documental, objeto o alcance marca sus bases para revisar sin alterar la conclusión histórica. No comprueba la suficiencia jurídica del nombramiento ni el ejercicio efectivo de funciones por registrar su nombre.

Se reutilizan administración de organización, índices, transacción, bloqueo de membresía, versiones/idempotencia, eventos, histórico y exportación normativa. No se amplía la lectura de estos datos a coordinadores ni miembros.

## 7. Pruebas y estado

Capacidad implementada y probada primero en copia temporal de fuentes, independiente del QA4282. 45 pruebas nuevas de dominio/contrato, junto con51 anteriores focalizadas:96/96. Runner nuevo:11 grupos HTTP/Mongo temporal réplica+1 negativo standalone. Incluye persistencia/relectura de rutas, cambio real de hechos, desconocidos/conflictos, sujetos y designaciones sin cuentas, rollback de log, concurrencia200/409, PDF posterior e histórico. Runner R3 repetido sobre la extensión:23+1 correctos.

La primera regresión general en esa copia temporal no fue concluyente: faltaban archivos de frontend/infra/documentación que varios tests leen. Se copiaron esas dependencias de lectura sin modificar los tests ni el QA vivo. La repetición completa terminó con1050/1050 correctos, salida0 (reporter dot:1050 puntos, sin otra marca).

Sin interfaz propia de alternativas/designaciones ni publicación de las nuevas fichas ENS. El recorrido de navegador autorizado a continuación es el R3 ya conectado por Front. La comprobación de esa UI y una activación coordinada son fases distintas de estas pruebas backend.
