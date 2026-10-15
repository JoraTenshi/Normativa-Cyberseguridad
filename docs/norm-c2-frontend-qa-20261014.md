# NORM-C2c Frontend verificado en entorno aislado

Corte: 14 de octubre de 2026, 20:50 Europe/Madrid. Autor: Codex, chat Práctica 3. Frontend.

El módulo «Normativa del alcance» está conectado a API real y se ha probado en navegador con datos sintéticos. La prueba comienza con organización, contexto, operación, alcance y dos requisitos precargados. No acredita todavía un recorrido completo desde una empresa vacía ni activación en la aplicación habitual.

## Implementación y entorno

- Checkout Kali: `/home/kali/Documents/practica3/normativa_integracion`.
- Rama: `integracion/workspace-20261011`; base `519605bec16fe0bd26064150b089e9bc4ad8b3ec`, con cambios locales preexistentes conservados.
- Montaje: `frontend/src/connected/ApiWorkspace.jsx`, sección regulations, restringida al administrador empresarial.
- Módulos: `NormativeWorkspace.jsx`, `NormativeControls.jsx`, `NormativeEditors.jsx`, `NormativeRecordView.jsx`, `normative-api-model.js`, `normative-view-model.js` y estilos normativos.
- API: cliente existente, prefijo /api añadido una sola vez; catálogo C2 publicado por Backend, sin datos locales de sustitución.
- Autenticación y CSRF existentes. Guardados con idempotencia, versiones y huellas externas exactas del DTO. Un resultado incierto reintenta el mismo cuerpo y clave; un 409 conserva el borrador y no cambia silenciosamente su base.
- Catálogo consultado: ENS ficha3/regla3 con 10 criterios y RGPD ficha3/regla4 con 14. Son dos requisitos, no 24 obligaciones independientes.
- Build aislado: `/tmp/norm-c2-front-build.rKb5Ve`; JS `main.10abb8ab.js`, CSS `main.e3397fd7.css`. El navegador confirmó ese JS servido.
- CompanyProfile permanece sin cambios: SHA-256 `11b000fb24d8ee5db55a5fbdf0ce2d3d8e9178fc4c6842238b01df0fb311b02a`.
- No se modificaron landing4192, integración habitual9443, app del equipo, cuentas habituales, secretos, CA, contenedores ni infraestructura. Sin commit, push, merge ni despliegue.

## Correcciones durante la comprobación

1. Fechas civiles: sincronización de eventos nativos input/change para que el borrador conserve las fechas visibles antes del guardado.
2. Alcances seleccionados: nombre real cuando viene en contenido.alcance.nombre, sin sustituir la referencia exacta.
3. Revisión histórica: etiqueta propia de estado frente a bases actuales; no se presenta el número de versión de la revisión como si fuera el del requisito.
4. Fuentes: fecha real de consulta y tipo, fecha y autor editorial presentes en el paquete. Se distingue el análisis asistido por IA del dictamen jurídico profesional.

## Pruebas automatizadas propias

**131/131 pruebas frontend, 12 suites, sin fallos.** Incluyen 33 añadidas en C2 respecto de las 98 previas. No se suman a los recuentos de Backend ni a sus grupos HTTP.

Se probaron asociación exacta de revisión/ficha/organización/decisión, separación de dimensiones y estados históricos, fechas civiles, compatibilidad de evidencia, criterios completos, datos desconocidos/conflictivos, catálogo sin fallback, conservación de borradores ante 409 y reintento idéntico incierto. El montaje de regulations y su bloqueo para consulta tienen comprobaciones específicas.

Compilación de producción correcta. Único aviso del proceso: deprecación Node DEP0176 heredada de la herramienta de construcción.

Reproducción: desde frontend, ejecutar `CI=true npm test -- --watchAll=false --runInBand` y construir con BUILD_PATH apuntando a un directorio temporal de QA. No sobrescribir frontend/build ni recrear contenedores por este informe.

## Recorrido observado en navegador

| Comprobación | Resultado observado |
| --- | --- |
| Sesión real | Login admin sintético, selección de Nexo C2 — FICTICIA y catálogo servido por API. |
| PDF exacto | Alta «Política PDF — QA navegador», selección de ID real de VersionDocumento, periodo civil explícito y relectura persistente. |
| Descarga | Descarga autorizada de esa versión y SHA-256 cliente coincidente con el archivo recibido: 29160f513b639d26b0a179aa7c5994db2796b0d6de6ddd6dac253f7ed28bb45a. |
| Evidencia sin PDF | Alta «Comprobación interna — QA navegador» con método, fecha UTC, resultado y limitaciones; relectura con hora local correcta. |
| Actuación compartida | «Preparar documentación — FICTICIA» pasa a v2 terminada, con responsable Prueba lectura y vínculos ENS/RGPD conservados. |
| Histórico de actuación | v1 sigue en curso con responsable anterior; no hay sobrescritura. |
| No aprobación automática | Tras cerrar actuación y registrar evidencias, RGPD continúa Sin revisar. |
| Revisión RGPD | 14 juicios explícitos: 1 favorable sintético con PDF y 13 no determinados; servidor guarda conclusión no determinada, revisor y periodo. |
| Revisión ENS | 10 juicios favorables sintéticos: PDF para criterios 1–9 y comprobación interna para el 10; revisión guardada favorable con referencias exactas. |
| Cambio del fundamento | Sistema ENS v2 conserva una respuesta desconocida. El requisito exige nueva revisión y el botón de revisión queda deshabilitado. |
| Recontextualización | Requisito ENS v2 conserva la nueva duda y no resulta evaluable. v1 sigue mostrando la decisión histórica Aplica; estado actual se informa aparte. |
| Revisión anterior | Su conclusión favorable permanece; se muestra que requiere nueva revisión por cambio de bases. |
| Recarga | Tras recarga completa y nueva selección de organización permanecen requisitos, evidencias, revisiones y versiones. |
| Permisos | La cuenta consulta no puede abrir Normativa ni Perfil, aunque sea responsable de una actuación. Vuelta a admin sin alterar roles. |
| Fuentes | En el JS final se muestran consultadaEn y fecha/tipo/autor editorial recibidos de la ficha. |

Las valoraciones son deliberadamente ficticias para comprobar el circuito técnico, no juicios sobre una empresa real. El PDF del runner es una muestra mínima de bytes y metadatos, no un documento jurídico ni una prueba de renderizado de PDF válido. La descarga y huella sí se comprobaron.

Normativa (2) comunicó además una comprobación independiente de catálogo/ficha/revisión/evidencia y la creación de otra actuación v1→v2 con recarga e histórico, sin alterar los registros anteriores. Ese es un reporte independiente, no una ampliación del recuento propio.

## Estado temporal para comprobación independiente

- URL: http://localhost:4282/espacio-de-trabajo
- Runner: backend/scripts/serve-normativa-browser-check.js, sesión propia 89160 con túnel loopback; MongoDB temporal exclusivo.
- Inicio aproximadamente 20:33 Madrid; caducidad automática 45 minutos después, alrededor de 21:18. La URL no es un despliegue permanente.
- Organización: Nexo C2 — FICTICIA, ID `6acfcaf5d705ef989e47fdce`.
- Alcance: Análisis documental SaaS, ID `6acfcaf7d705ef989e47fe30`.
- ENS: requisito `6acfcaf8d705ef989e47fe81`, v2; sistema `6acfcaf7d705ef989e47fe64`, v2.
- RGPD: requisito `6acfcaf8d705ef989e47fea9`, v1; operación `6acfcaf7d705ef989e47fde1`.
- Revisión ENS creada en UI: `6acfcc5ad705ef989e480620`, v1.
- Actuación independiente de Normativa: `6acfccb8d705ef989e480bd2`, v2.
- Credenciales sintéticas comunicadas directamente a Backend y Normativa. No copiar claves a Notion.
- No reiniciar mientras se estén comprobando los escenarios. Al expirar, sus datos desaparecen por diseño. La sesión anterior ya había terminado; no se afirmó haber recuperado sus datos.

Después de este QA, Backend comunicó traslado de capacidades nuevas a las fuentes, sin reiniciar el proceso R3 ni cambiar el build. Este informe no valida esas capacidades en un proceso nuevo.

## Primer hueco del recorrido desde una organización vacía

Confirmado mediante lectura de código y pantalla, sin cambiar el perfil: CompanyProfile.jsx:55–73 presenta «¿Qué operaciones existentes concretan esta actividad?» como textbox de identificadores separados por punto y coma. No hay selector por nombre en ese paso.

El materializador puede generar alcances preliminares sin operaciones. A su vez, el editor de requisito RGPD solo ofrece operaciones presentes en el origen del alcance. Por tanto, no está resuelto el itinerario de vinculación sin IDs manuales.

Siguiente lote propuesto y comunicado a Normativa: selector autorizado de operaciones existentes, conservando sus IDs internamente y sin asumir la última versión; después, variante de runner con organización vacía separada para probar inicio de contexto, actividad, operación, propuesta, confirmación, sistema y requisito. No reiniciar ni vaciar el escenario actual para prepararla.

## Límites y pendientes

- Gestor colaborativo de tareas, métricas y PDS no se integran por este bloque de actuaciones administrativas.
- No cobertura completa ENS/RGPD ni dictamen/certificación. No contenido protegido nuevo.
- El contrato histórico aporta principalmente IDs de revisor/objeto/alcance. No se inventan nombres ni se presenta un nombre actual como histórico.
- Persistencia probada por relectura y recarga, no por reinicio del Mongo efímero.
- 409/reintentos y asociaciones incompatibles tienen pruebas automatizadas; no se simularon fallos de red ni concurrencia en el navegador de esta sesión.
- No se ha vuelto a probar MFA, HTTPS9443, una instalación limpia ni responsividad móvil completa. En la vista de escritorio observada no se detectó desbordamiento horizontal del documento.
- Activación conjunta y recorrido desde organización vacía continúan pendientes. Este hito no cierra el objetivo general.

## Evidencia visual

Las capturas muestran la aplicación ejecutada, no una maqueta:

- revision-historica.jpg: revisión conservada y aviso de nueva revisión.
- fuentes-editoriales.jpg: fuentes y fechas consultadas.
- Las capturas independientes de Normativa están en outputs/norm-c2-20261014/pruebas.

La documentación operativa canónica se actualiza en «05 — Contexto de Frontend» de Notion y se comunica al chat coordinador de Normativa.
