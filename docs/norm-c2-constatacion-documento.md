# C2 — constatación de un documento externo

Contrato de backend, 14/10/2026. No publica nuevos requisitos ni certifica documentos.

## Problema y corrección

ENS-HTTP-DOC-01: el tipo `constatacion_documento` admitía una comprobación genérica sin identificar el documento subyacente. La prueba HTTP reprodujo una declaración expresamente oral mal etiquetada que podía alimentar una revisión favorable declarada.

Ahora una nueva evidencia de ese tipo admite dos soportes:

- `version_documento`: la referencia exacta a un documento almacenado y su versión, ya existente. El servidor resuelve organización, número y huella. No cambia su contrato.
- `comprobacion`: examen documentado de un documento externo, identificado de forma estructurada. No hay descarga, consulta externa, obligación de formato PDF ni copia del documento completo.

Ejemplo de la parte `soporte` del POST/PATCH de evidencia:

```json
{
  "tipo": "comprobacion",
  "metodo": "Examen del documento identificado y de su apartado indicado",
  "realizadaEn": "2026-10-14T12:00:00.000Z",
  "resultado": "Descripción breve del resultado del examen realizado",
  "limitaciones": "Comprobación interna; autenticidad y suficiencia no automatizadas",
  "documentoExaminado": {
    "identificador": "EXP-POC-2026-01",
    "version": "Edición 2 de 14/10/2026",
    "localizador": "Repositorio corporativo / apartado 3",
    "contenidoExaminado": "Objeto y delimitación del examen, sin transcribir el documento completo"
  }
}
```

El backend añade `responsableRef` desde la membresía de la sesión; el cliente no puede imponerlo. Todos los campos de `documentoExaminado` son textos no vacíos, sin campos extra ni caracteres de control. Límites: identificador 500, versión 200, localizador 1000 y contenido examinado 2000 caracteres. La versión es la del documento externo, no el entero de la evidencia almacenada. No se infiere autenticidad por que exista este texto.

La API conserva el patrón existente: POST con `Idempotency-Key`; PATCH con el cuerpo completo, `version` actual y una nueva clave de idempotencia. Una actualización genera una nueva versión de evidencia y huella. Una revisión fija la versión exacta que examinó: las referencias anteriores no se actualizan silenciosamente.

## Responsabilidad de cada archivo

- `backend/validation/constatacionDocumento.js`: contrato mínimo de la referencia documental externa y detección de registros anteriores incompletos.
- `backend/validation/registroNormativo.js`: exige ese objeto en nuevas escrituras `constatacion_documento/comprobacion`; mantiene cerrados los campos de otras comprobaciones e instrumentos.
- `backend/services/revisionRequisito.js`: incorpora los metadatos a evidencia/snapshot/huella, impide usar una constatación antigua sin documento identificado para una nueva valoración favorable y señala necesidad de revisión en la vigencia histórica.
- `backend/tests/constatacionDocumento.test.js`: positivos, negativos por campo, límites, autor no falsificable, compatibilidad PDF/schema1 y conservación de histórico.

## Histórico y límites

Una evidencia anterior sin estos datos sigue siendo legible. No se reescribe su contenido ni su huella. Su conclusión histórica permanece; la satisfacción vigente pasa a `requiere_revision` con motivo `documento_subyacente_no_identificado:<id>`. Puede documentarse una nueva revisión no determinada; no una nueva favorable apoyada en esa carencia. Para subsanar se actualiza explícitamente la evidencia y después se realiza otra revisión.

La validación comprueba la estructura de la referencia, NO que el documento exista realmente fuera de la aplicación ni que lo escrito sea verdadero, auténtico o jurídicamente suficiente. Ese examen y la compatibilidad de la evidencia siguen siendo valoraciones humanas motivadas. El permiso técnico de administrador no acredita competencia profesional.

## Reproducción del lote HTTP/Mongo

El runner `backend/scripts/check-ens-roles-mongo.cjs` recibe rutas absolutas por variables de entorno. Necesita dependencias instaladas del backend y un binario compatible `mongod`; no lee `.env`, no acepta una URI de aplicación ni usa Docker. Las tres fichas y sus hashes deben estar en el manifiesto editorial original y en su subcarpeta `paquete/`.

```bash
NC_TEST_BACKEND=/home/kali/Documents/practica3/normativa_integracion/backend \
NC_TEST_MANIFEST=/tmp/nc-ens-http.sT0ANl/entrega-roles.v1.json \
NC_TEST_REPORT=/tmp/nc-ens-http.sT0ANl/repeticion-independiente.json \
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod \
node backend/scripts/check-ens-roles-mongo.cjs
```

Las rutas temporales son las del ensayo, no requisitos permanentes; sustituirlas por las ubicaciones verificadas al repetir. La subcarpeta `paquete/` contiene exclusivamente las tres fichas del manifiesto. El catálogo se inyecta en memoria del proceso y se restaura al terminar. Las fichas no se copian a `backend/catalogo/c2`.

El runner inicia Mongo de un nodo en un puerto aleatorio de loopback y una base sintética única; después ejecuta el negativo standalone. Al finalizar detiene esos procesos y elimina únicamente su directorio temporal validado. Conserva el informe fuera de la base temporal. No usa los puertos 4282, 4284, 4192 o 9443.

El informe JSON registra cada grupo, número de peticiones, referencias sintéticas, hashes de código/fichas antes y después, resultado y límites. Código de salida 0 requiere lote completo, sin hallazgos y sin cambios en los módulos comprobados. La regresión general se ejecuta desde la raíz completa del proyecto: algunos tests leen documentación, frontend e infraestructura como fuentes y fallan por ENOENT si se copia solo backend.

No sumar estos grupos, las pruebas unitarias ni las comprobaciones de Normativa como si fueran un número de pruebas de navegador. Autenticación del runner: política `legado_pruebas` con usuarios y membresías sintéticos; no prueba login real, MFA ni el despliegue HTTPS. Los instrumentos PDF se siembran como fixtures en Mongo: no valida su carga ni su contenido PDF.

Próximo paso: interfaz de las siete rutas y de la referencia documental, prueba de navegador y revisión de publicación coordinada. Las fichas nuevas no se activan por superar este runner.
