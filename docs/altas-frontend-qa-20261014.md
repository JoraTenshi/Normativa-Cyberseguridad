# Alta de empresa con aprobación manual

14 de octubre de 2026. **Flujo acotado implementado y probado en navegador con API y MongoDB reales del entorno temporal QA4288. No desplegado ni habilitado para cuentas reales.**

La verificación del correo permite iniciar sesión, pero no crea una empresa ni concede una membresía. La persona presenta una solicitud; la administración de la plataforma puede pedir aclaraciones, aprobar o rechazar una versión concreta. Solo la aprobación crea el espacio y la membresía del solicitante. El rol de gestor de altas no permite acceder a los documentos o al contexto de esa empresa.

## Autoridad y versión

Decisión humana verificada en «Práctica 3. Normativa», turno `01a13c43-d974-77d1-b102-704d3a6d054f`: José aprobará las solicitudes como administrador de plataforma y verificar el correo no activará automáticamente el acceso. Seguimiento Back/Front autorizado posteriormente en el mismo chat.

Contrato: `outputs/hetzner-handoff-20261014/CONTRATO-ALTAS-v1.md`. Fuente frontend integrada en Kali: `/home/kali/Documents/practica3/normativa_integracion`, rama `integracion/workspace-20261011`, base `519605bec16fe0bd26064150b089e9bc4ad8b3ec` más cambios locales conservados. No equivale a un commit publicado.

Compilación exacta examinada: `/tmp/norm-altas-front-build.NvpG5f`.

| Recurso | SHA-256 |
|---|---|
| `main.30c6b031.js` | `70de06f9cf7b3a8bb3666b217978d4efd71a20684c56d47f8cb2e0f23338db50` |
| `main.6c23e3ac.css` | `8841b38e05fa17ef7dda23fdaf12b3059ee9e4ea592abd3485c3ba77018bad6d` |

El DOM del navegador confirmó `main.30c6b031.js`. El manifiesto de recursos se conserva junto a este informe. Los hashes del build anterior QA4286 se comprobaron intactos; no se sustituyeron el paquete de 213 archivos, la portada4192 ni la aplicación9443.

## Implementación frontend

- Entrada «Mis solicitudes» y salida clara para quien todavía no tiene empresa.
- Rutas protegidas `/solicitudes-de-alta` y `/administracion/altas`, separadas de las secciones empresariales.
- Formulario con razón social, país, NIF declarado, función y justificación. Ningún rol, estado o identificador de empresa se elige desde el formulario.
- Estados pendiente, aclaración, aprobada y rechazada; datos e historial de versiones. La nota interna no se muestra al solicitante.
- Decisión explícita con motivo público, nota interna opcional, confirmación y versión. Autoridad, MFA, autenticación reciente y posibilidad de decidir proceden del servidor.
- Borradores ocultos y bloqueados durante la revalidación de sesión, sin heredarlos al cambiar de cuenta. Conflictos requieren consultar y comparar; no se reenvían decisiones automáticamente.
- Reintento exacto con la misma clave y cuerpo cuando el resultado es incierto, incluso ante un éxito HTTP con respuesta inválida. Recuperación explícita después de una sesión caducada.
- Una solicitud aprobada ofrece «Comprobar mi acceso»: vuelve al selector de membresías vigentes. La interfaz no concede acceso por el estado de la solicitud.

Archivos nuevos: `EnrollmentPortal.jsx`, `EnrollmentViews.jsx`, `enrollment-model.js`, `enrollment.css` y sus pruebas. Cambios acotados en `App.js` y `ApiWorkspace.jsx` y prueba de entrada. Los originales se conservan en `work/alta-manual-front-20261014`.

## Verificación propia

**198/198 pruebas frontend en 17 suites.** Incluyen 33 pruebas nuevas respecto al corte165 anterior. Las pruebas de componentes simulan la API: su resultado no se presenta como198 recorridos reales. La compilación de producción pasó; no se desactivaron verificaciones para conseguirlo.

Las pruebas detectaron y permitieron corregir dos problemas: pérdida del formulario al revalidar capacidades, y pérdida de la clave de reintento si se validaba demasiado tarde una respuesta incompleta. También se retiró una directiva de lint que referenciaba una regla ausente en la configuración, sin cambiar las dependencias ni la configuración general.

### Recorrido observado en navegador y servidor real

QA4288 comenzó sin solicitudes, organizaciones ni membresías. Las cuentas y el segundo factor eran exclusivamente sintéticos. La verificación de correo utilizó el enlace de prueba preparado por Backend; no hubo envío real de correo. Las escrituras de negocio siguientes se realizaron desde la interfaz, no mediante semillas ni llamadas API manuales de Front.

| Paso | Resultado observado |
|---|---|
| Cuenta sin correo verificado | Inicio de sesión denegado con explicación. |
| Verificar correo y entrar | Cuenta autenticada, ninguna organización; opción de solicitar el alta. |
| Presentar Nexo Altas — FICTICIA QA4288 | Versión1 pendiente, sin acceso empresarial. Persiste tras recargar. |
| Entrar como gestor | Login y segundo factor de la aplicación completados antes de la revisión. |
| Pedir aclaración | Versión2 con motivo público e historial; nota interna visible al gestor y ausente de la vista del solicitante. |
| Corregir datos | Versión3 vuelve a pendiente; no se aprueba por corregir. Historial anterior conservado. |
| Aprobar versión3 explícitamente | Versión4 aprobada. El solicitante entra en la empresa tras comprobar las membresías. Nuevo login y recarga conservan el acceso. |
| Separación de roles | Gestor sigue sin organizaciones. Administrador empresarial recibe denegación en la pantalla de altas de plataforma. |
| Segunda solicitud con el mismo NIF | La solicitud puede presentarse, pero aprobarla devuelve409 `ALTA_NO_DISPONIBLE`, conserva el borrador y no duplica ni adopta la empresa. |
| Rechazar después de comparar | Decisión nueva explícita, segunda solicitudv2 rechazada. Nuevo login y recarga conservan motivo e historial, sin editar el estado terminal ni acceder a la empresa. |

Identidades técnicas del caso: primera solicitud `6acff682bdd5233f581ae98a`; organización creada `6acff6fbbdd5233f581aeb90`; segunda solicitud `6acff72fbdd5233f581aecde`. El NIF declarado es ficticio y no se comprobó su existencia jurídica.

Se llegó a «Perfil y alcance» de la nueva empresa vacía, sin crear contexto, tareas, documentos ni resultados normativos en este bloque. No se repite ni se suma el recorrido normativo de QA4286.

### Contraste independiente de Backend

Backend informó una lectura final API de las21:43:42Z: primera solicitudv4 aprobada con historiav1–4; segunda solicitudv2 rechazada; una organización para el primer solicitante y ninguna para la cuenta rechazada, el gestor ni la cuenta recién verificada. Confirmó403 para gestor contra contexto empresarial y solicitantes contra plataforma, y ausencia de notas internas en el DTO propio.

Backend también reportó1084/1084 pruebas,26 grupos HTTP/Mongo réplica y un grupo standalone. Son pruebas de Backend, no ejecuciones realizadas por Front ni un total sumable a198. Front leyó el archivo final `outputs/altas-backend-20261014/qa-final-1792014226008.json`, contrastó las organizaciones, estados y negativas403, y comprobó su SHA256 `b0c3088674accd743194edaaa516202038e0262a268c2894979ff259752f1547`. La ejecución de esas llamadas API corresponde a Backend.

## Evidencias visuales

Las capturas01–12 de esta carpeta corresponden al mismo build y a datos ficticios. Las principales son03pendiente,04decisión explícita,05aclaración,08acceso aprobado tras recarga,09denegación del administrador empresarial,10conflicto y12bandeja final.

![Bandeja final de altas con datos ficticios](C:/Users/jlbur/DOCUMENTS/Codex/2026-09-22/hemos-recibido-las-instrucciones-de-la/outputs/alta-manual-front-20261014/12-bandeja-final.jpg)

La inspección de consola al final del recorrido no devolvió errores o advertencias capturados. Se cerró la sesión de prueba por la interfaz, se confirmó el formulario de acceso y se cerró únicamente la pestaña QA4288. Backend detuvo el runner y su túnel; Front comprobó después ausencia del PID3209592 y del puerto4288 en Kali, y ausencia de escucha local4288 en Windows. Backend informó retirada de los datos sintéticos de esa instancia; las evidencias se conservan fuera del runner.

## Límites y siguiente entrega

Este cierre valida el flujo acotado de alta manual, no una comprobación jurídica de representación ni la aplicación completa. Continúan separados el registro real con correo saliente, el permiso real de José, la configuración de MFA de su cuenta, HTTPS y persistencia/recuperación del destino, despliegue y cobertura normativa. No se han otorgado privilegios a cuentas reales, aceptado términos, cambiado secretos ni instalado esta versión en Hetzner.

Los conflictos concurrentes, el resultado incierto, la caducidad/recencia de la sesión y la conservación del borrador tienen pruebas automatizadas frontend y/o Backend; no todos esos escenarios se reprodujeron además en este navegador. El navegador sí comprobó el conflicto real por NIF, login/MFA, roles y persistencia tras recarga.

Matiz de texto pendiente no bloqueante: ante la colisión de NIF, el mensaje específico del servidor es correcto, pero el bloque genérico409 dice «El estado o la versión han cambiado». Debe ajustarse en un siguiente corte para no atribuir siempre el conflicto a una versión. No se modificó el código ni el bundle durante esta prueba para ocultar esa diferencia.

## Nuevo candidato entregado

Backend preparó el paquete nuevo de227 archivos bajo `outputs/hetzner-handoff-20261014`, separado del candidato QA4286. Front verificó localmente el hash del archivo y del manifiesto, la identidad JS/CSS probada y la coincidencia individual de sus nueve archivos de código/pruebas/estilo cambiados con el manifiesto. La comprobación integral por extracción de los227 archivos es evidencia de Backend, no una segunda ejecución de Front.

| Archivo | SHA-256 |
|---|---|
| `normativacheck-altas-qa4288-source-build.tar.gz` | `660bc02ec68ae0504d15454ae79e71b8e01a40da7c3cb1a551bac07feb6ebbbc` |
| `MANIFEST-ALTAS-source-build.json` | `cbe7f515c28eed2e851b696e7323549329c0544d4a0c54e4caffc4cacedc606a` |

Este informe y sus capturas son evidencia adicional. La copia a `docs/altas-frontend-qa-20261014.md` es posterior al empaquetado y no se atribuye al candidato227. El perfil de instalación está separado y sigue sin validarse en contenedores o destino. No reutilizar el paquete QA4286 como si contuviera este flujo ni atribuir el despliegue a la compilación local.
