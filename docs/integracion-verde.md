# Integración verde: qué funciona y qué no queda cerrado

Esta matriz describe el contrato backend incorporado al corte, no acredita por sí sola que la pantalla esté terminada o que se haya desplegado. La interfaz en integración debe reutilizarlo, no simular persistencia.

## Contratos disponibles

Todas las rutas públicas llevan `/api`; el proxy retira ese prefijo antes de Express. Se usa la sesión real, cookies protegidas, comprobación de origen y el control de permisos del backend. La sesión conserva los límites acordados:8horas absolutas y30minutos de inactividad.

| Tema | Rutas principales | Regla y límite |
| --- | --- | --- |
| Identidad | `/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/2fa/verify`, `/auth/session`, `/auth/logout` | No sustituir registro por creación directa en Mongo. MFA y expiración controlados por backend. |
| Recuperación | `/auth/forgot-password`, `/auth/reset-password` | Requiere correo real en producción; no mostrar tokens al usuario por falta de SMTP. |
| Empresas y altas | `/me/organizaciones`, `/me/solicitudes-organizacion`, `/plataforma/solicitudes-organizacion` | Gestión de altas de plataforma separada de los permisos dentro de una empresa. No aprobar la solicitud propia. |
| Contexto y operaciones | `/organizaciones/:org/contexto`, `/operaciones`, `/alcances` bajo la organización | Versionado, decisiones y materialización explícitos. Una propuesta no es una aprobación. |
| Organización del trabajo | `/organizaciones/:org/subespacios` | Compartimentación existente; no confundir con el futuro gestor de tareas colaborativas. |
| PDF corporativos | `/organizaciones/:org/documentos` y versiones/archivo | Admin gestiona y comparte; destinatarios autorizados leen/descargan. Versiones y acceso privados. |
| Histórico | `/organizaciones/:org/actividad`, `/actividad/exportar` | Admin: organización. Coordinador: unidades permitidas. Filtros y exportación sujetos a su alcance. |
| Revisión normativa | `/organizaciones/:org/normativa/{catalogo,sistemas,requisitos,actuaciones,evidencias,revisiones,sujetos-funcionales,designaciones}` | Primera versión reservada al administrador activo, también la lectura. Las funciones ENS no conceden roles de la aplicación. |

Las rutas abreviadas de la tabla no sustituyen los contratos detallados de `docs/norm-c2-api.md` y los routers. Para actuar sobre una organización no basta conocer su ID.

## Actuaciones reales: interfaz sin campos inventados

En `/organizaciones/:org/normativa/actuaciones` existen listado, detalle, alta, modificación e historial de versiones. La modificación exige el cuerpo completo y la versión esperada. Campos: `titulo`, `descripcion`, `estado`, `requisitos`, `responsableMembresiaId`, `motivo`; para editar se añade `version`.

Los estados son `pendiente`, `en_curso`, `terminada`, `archivada`. No se crea una actuación archivada; el archivado requiere que esté terminada. Terminar una actuación no aprueba un requisito. El responsable se elige mediante `/normativa/responsables` y su `membresiaId`, no mediante un usuario o correo arbitrario. Asignarle la actuación no le concede por sí mismo permisos normativos.

Ante409, conservar el borrador y explicar el conflicto; no reintentar silenciosamente con la versión nueva. Evidencias y revisiones quedan vinculadas a las versiones explícitamente registradas. No se detectan automáticamente cambios de hechos externos o de documentos no vinculados.

No existen aún en este contrato vencimientos, comentarios de tarea, seguimiento de horas ni colaboración por grupos. Ocultar o marcar pendientes esos controles; no guardarlos solo en memoria y dar apariencia de éxito.

## Catálogo aceptado en este corte

Se mantienen las dos fichas previas (política ENS y contrato de encargado RGPD28) y las tres fichas ENS de funciones, separación y punto de contacto, aceptadas enENS3R1. Sus siete rutas alternativas pertenecen a tres requisitos, no a siete obligaciones independientes. No se ha incorporado el resto de propuestas editoriales de privacidad.

La revisión favorable necesita los criterios y evidencias correspondientes. Ausencia, incertidumbre y conflicto no son intercambiables. El historial no se reescribe para adaptar una conclusión pasada; las nuevas conclusiones se añaden.

## Verificación registrada antes de integrar la nueva interfaz

- Regresión backend:1087/1087.
- ENS con Mongo temporal:98grupos en réplica,1negativo standalone y865peticiones.
- Recorrido normativoC2R3:23grupos en réplica y1negativo standalone.
- Altas:26grupos en réplica y1negativo standalone; sesiones persistentes y login/MFA porHTTP.

Son ejecuciones aisladas, sin correo externo ni despliegue. Los nuevos tests de configuración/identidad/plan de actualización se registran en el recibo de este corte. La integración verde requiere además pruebas propias del frontend y navegación con API real.

## Legado y limpieza

| Elementos | Decisión en este corte | Condición de retirada |
| --- | --- | --- |
| README/Makefile/Compose raíz anteriores | Sustituidos como entrada; ya no arrancan CyberAudit ni generan secretos/seed | Fuente anterior recuperable en Git y checkpoint verificado |
| Dockerfile backend por defecto | Mismo perfil privado endurecido que Dockerfile.private | Sin ruta alternativa que ejecute server.js con .env implícito |
| `infra/integration`, Dockerfile.integration, scripts de laboratorio | Conservados, no entrada principal | Reconciliar instalación Kali y pruebas dependientes antes de retirar |
| Resultados, cuestionarios, scoring, PDS y licitaciones antiguos | Conservados como compatibilidad histórica, no nueva metodología | Comprobar consumidores e históricos antes de retirar funciones |
| Entrega227 del servidor | Retención temporal obligatoria | Retirar dependencia del montaje Mongo y probar reinicio/persistencia; validar nueva entrega |
| Ramas/carpeta de equipo/copias únicas | No se borran en esta integración | Inventario, reconciliación, validación y publicación final en main |

## Lo que sigue pendiente

Gestor de tareas compartidas por unidades y equipos, votaciones, avisos en tiempo real, métricas basadas en requisitos revisados, PDS del nuevo modelo e IA local. También la configuración SMTP y la primera cuenta real, una vez aceptada la entrega. Ninguno de estos pendientes se considera resuelto por el cambio de aspecto.
