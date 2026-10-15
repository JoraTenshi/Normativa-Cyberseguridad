# NORM-C2 — presentación preparada, conexión pendiente

Propiedad confirmada por Backend el 14/10/2026: Frontend asume `ApiWorkspace.jsx` solo en `regulations` y módulos propios; Backend no edita frontend en este lote. Se conserva `CompanyProfile` y el diseño conectado B.06. No se modifica landing-lab, servicios, infraestructura, datos habituales ni despliegue.

Destino vivo: `/home/kali/Documents/practica3/normativa_integracion/frontend/src/connected/`, rama `integracion/workspace-20261011`, base `519605bec16fe0bd26064150b089e9bc4ad8b3ec` con cambios locales preexistentes. Esta carpeta Windows es únicamente preparación de los archivos nuevos, no un checkout alternativo de la aplicación.

## Corte implementado

- `NormativeRecordView.jsx`: presentación pura y de solo lectura de ficha, criterios, cinco dimensiones separadas, actuaciones sugeridas, fundamento por precepto/fuente, evidencia y revisión interna motivada. Sin transporte, sin guardado, sin datos de demostración en producción.
- `normative-view-model.js`: traducción de estados conocidos a lenguaje de interfaz, tratamiento de fechas civiles sin conversión de zona, enlaces HTTPS y rechazo de asociaciones de revisión con otra organización, decisión o versión de requisito/ficha.
- `normative-record.css`: estilos limitados al Workspace conectado.
- `NormativeRecordView.test.jsx` y `__fixtures__/*.v3.json`: pruebas con fichas entregadas por Normativa y referencias empresariales sintéticas exclusivas de test. Los fixtures no se importan en componentes de producción.

No se importa todavía el componente desde `ApiWorkspace.jsx`. No existe un contrato HTTP probado de ficha/requisito/revisión ni permiso efectivo por acción: montarlo o inventar rutas excedería la información disponible.

## Datos de entrada: NO son un contrato HTTP nuevo

`ficha` corresponde a la ficha v3 recibida de Normativa. `decisionRecord` usa la envoltura de GET detalle de las rutas existentes de decisiones. `requisito`, `revision` y `revisionStatus` representan las estructuras del núcleo puro C2b inspeccionado; el futuro adaptador debe relacionarlas con la respuesta autorizada y probada del servidor. `canReview` permanece `null` hasta autorización explícita del servidor para esa acción: no derivarlo de `habilitaEvaluacion`, del rol administrador ni de la existencia de documentos. `onOpenDocumentVersion` es una devolución de referencias exactas al adaptador, no una ruta ni una descarga inventada.

El estado de revisión de fuentes es editorial y no se presenta como revisión profesional del caso. ENS tiene 10 criterios; RGPD, 14 dentro de un requisito contextualizado por operación/relación. No hay porcentaje global, aprobación por PDF, aprobación por tarea cerrada ni inferencia de obligaciones que no estén en la ficha.

## Continuación acordada con Backend

1. Cerrar DTO/rutas de fichas y requisitos contextualizados: organización, alcance y versión, operación/relación, decisión exacta y ficha exacta.
2. Confirmar permiso efectivo por acción y respuestas 401/403/404; separar autorización de evaluabilidad.
3. Cerrar actuaciones, evidencia exacta y revisión motivada: DTO de vigencia/histórico, control de concurrencia, idempotencia y errores 409/422.
4. Añadir adaptador de API y catálogo/ficha en `ApiWorkspace.regulations`, sin duplicar Perfil y alcance ni fallback local. Mientras catálogo vacío, no concluir «no aplica».
5. Pruebas aisladas API/Mongo/navegador con recarga y relectura, revocación de permisos, cambio de contexto, cambio de documento y conservación histórica. No usar datos habituales ni considerar los tests sintéticos como E2E.

Las rutas existentes `/contexto/{reglas,decisiones}` y `/operaciones/:operacionId/{reglas,decisiones}` se verificaron en el checkout, pero el catálogo productivo permanece vacío. C2a temporalidad/cobertura está conectado a decisiones; C2b aún no tiene persistencia/rutas. La interfaz preparada no equivale a una integración completa ni a un despliegue.

## Verificación de este corte, 14/10/2026

- Archivos preparados y añadidos al frontend vivo de Kali tras la confirmación expresa de propiedad por Backend.
- 15 pruebas nuevas de presentación/modelo (incluidas las fichas ENS 10 y RGPD 14, fechas civiles, fuentes seguras, separación de dimensiones, versiones exactas, rechazo de asociaciones incompatibles y conservación de conclusión histórica).
- Regresión frontend ejecutada en Kali: **113/113**, 11 suites, sin fallos. Este recuento incluye las 15 nuevas, no es una prueba E2E ni de permisos HTTP.
- Compilación de la aplicación existente correcta con salida aislada en `/tmp/norm-c2-front-build.YgJHtM`; no sobrescribe `frontend/build` ni actualiza ningún contenedor. Al no montar el componente nuevo, esa compilación acredita regresión de la aplicación, mientras sus pruebas ejercitan el componente nuevo.
- `ApiWorkspace.jsx` y `CompanyProfile.jsx` no se han editado. No se ha introducido transporte, importación del catálogo en producción ni escrituras empresariales.
- Pendientes: validación visual en navegador una vez montado con el contrato HTTP real, autorización/revocación real, escritura/relectura persistente y E2E. No se presenta una pantalla con fixtures como integración operativa.

Backend anunció C2c bajo un prefijo propuesto `/organizaciones/:org/normativa`, todavía en implementación y sin contrato probado. No se han construido llamadas ni escrituras a partir de esa propuesta. El cliente existente añade `/api`; el futuro adaptador no deberá duplicarlo.
