# Aceptación docente y correspondencia con la memoria

Actualización documental del 17 de octubre de 2026. Complementa la memoria original; **no modifica sus resultados históricos ni afirma el cierre completo del producto**. Su finalidad es identificar qué aplicación se probó, qué puede reproducir un profesor y qué faltaba antes de considerar final la publicación. La observación remota de las 08:38 UTC es histórica; para la entrega actual, consulta la [etiqueta v1.0-practica3](https://github.com/JoraTenshi/Normativa-Cyberseguridad/tree/v1.0-practica3) y verifica su commit.

## 1. Identidad de los materiales

| Material | Referencia comprobada |
| --- | --- |
| Memoria original | 51 páginas, fechada el 16/10/2026; describe R3 `2f52aac139a7d606d9102d55e95005be5e58949e`. |
| Fuentes de la aceptación local | Commit `1e3a4f62fd0cca6927a97fc42fb9f86e847a6eb5`, árbol `905ee9b0d947302943caf0b26c737b2d48b66a1e`. |
| ZIP utilizado en el ensayo | SHA-256 `56ec5d780dd5c0ce53ce1aacbd012a6321cb491ddc5749d7c6183d665621162d`. |
| ZIP docente de entrega, revisión documental 2 | `NormativaCheck-profesores-1e3a4f62-validado-kali.zip`; SHA-256 `20638994c996b7cfe11113555dc1f085bd61483852bb1f3b91c16f234437564f`. |
| Código de ambos ZIP | 593 archivos de aplicación iguales; la revisión final añade/actualiza documentación y evidencias externas a `aplicacion/`. |
| Publicación remota observada durante esta revisión | API GitHub consultada el 17/10/2026 a las 08:38 UTC: `main` seguía en R3, árbol `23bf166762ddfdb1e7e06c84dced2db496a61dc4`; no se devolvió `refs/tags/v1.0-practica3`. |

El responsable del paquete comprobó la identidad con Git y la comparación de 43 archivos entre R3 y el candidato. Entregable 3 contrastó por lectura el acta y el recibo estructurado, calculó de nuevo el SHA-256 del ZIP final, comprobó su integridad y comparó sus **593 archivos de aplicación con el candidato local: cero diferencias**. Esa comprobación propia no fue una segunda instalación ni una ejecución propia de las pruebas de navegador.

La revisión documental del ZIP no repitió todo el ensayo: conserva las mismas fuentes que lo superaron. Esta ampliación posterior del README tampoco pertenece retroactivamente al ZIP de la tabla. Si se genera otro paquete, debe tener su nueva identidad, manifiesto y relación con el código aceptado.

## 2. Entorno y recorrido aceptado

Recibo del 17/10/2026, 08:29:35 UTC (10:29:35 Europe/Madrid). El campo `acceptedAtUtc` del recibo JSON contiene un valor con desplazamiento `+02:00`; aquí se expresa su instante equivalente en UTC, sin tratar ese valor local como si ya tuviera zona Z.

- Kali Linux amd64; Node 24.19.0 y Docker Linux con Compose 2.40.3-3.
- Firefox 140.12.0 controlado por Selenium, sin interfaz visible (*headless*).
- CA de la instalación importada en un perfil NSS exclusivo del ensayo; `acceptInsecureCerts=false`. No se omitió la validación HTTPS.
- Extracción nueva, sin `.runtime` o dependencias del host prestadas de otra copia. La construcción descargó dependencias en contenedores y pudo reutilizar capas Docker locales: no se afirma que todo el equipo o la caché Docker estuvieran vacíos.
- Datos y cuentas ficticios, sin SMTP externo, sin usar credenciales del servidor privado.

El responsable de la demo registró las siguientes comprobaciones:

| Paso | Resultado observado | Alcance |
| --- | --- | --- |
| `start` normal desde ZIP extraído | Construcción y arranque de web/API/Mongo, verificaciones del operador satisfactorias. | Instalación local de esa base. |
| `account` normal en TTY | Cuenta y empresa ficticias propias de la instalación. | Alta administrativa local prevalidada, no registro por correo. |
| HTTPS y login por interfaz | Sesión real autenticada y selección de empresa. | Navegador conectado a API/Mongo, no un mock. |
| Crear servicio por interfaz | Servicio persistido, con ID concreto. | Un caso básico de espacio de trabajo. |
| Recargar y consultar historial | Mismo servicio y evento exacto `subespacio_creado`. | No solo una respuesta HTTP 200 de un listado. |
| `stop`, `start`, `verify` normales | Instalación recuperada con datos conservados. | Reinicio de los contenedores del ensayo, no reinicio del VPS ni del sistema operativo. |
| Nuevo navegador y sesión | Mismo servicio y mismo evento después del reinicio. | Persistencia autenticada. |
| Logout por interfaz | Sesión y recurso privado devuelven 401; abrir/recargar la ruta privada exige login. | Sesión actual del navegador; no es una prueba de reproducción de cookies antiguas. |
| Restablecer disponibilidad de la demo previa | El responsable confirmó la demo anterior restaurada y datos de ambas copias conservados. | Operación de laboratorio, no publicación o actualización de Hetzner. |

La evidencia correlaciona el servicio sintético `6ad3303676087ceac1fd8d8b` con el evento `6ad3303676087ceac1fd8d8d`. Estos identificadores no son credenciales ni se reutilizan como datos iniciales de otra instalación.

Se conservan los intentos incompletos del automatismo: un control no interactuable durante creación y una espera agotada al localizar el login después del reinicio. Las correcciones fueron del arnés de navegador, sin cambios en el código de aplicación. Las repeticiones satisfactorias no borran esas primeras evidencias ni convierten un intento incompleto en aprobado.

## 3. Lo que no acredita este resultado

No se ha probado en este ensayo:

- Instalación nativa Windows, macOS o ARM, ni cualquier versión de Node/Compose distinta de las documentadas.
- El registro por interfaz con correo real, entrega SMTP externa, recuperación de contraseña, MFA o designación de un gestor global.
- La cadena completa perfil → alcance → sistema/operación → requisito → actuación → PDF/evidencia → revisión, ni todas sus variantes y roles.
- Todos los recorridos RAT, finalidades, flujos, transparencia, derechos, EIPD o categorización ENS.
- Despliegue, restauración o reinicio real de Hetzner; exposición pública o disponibilidad continua.
- Una instalación autónoma realizada por una persona ajena al grupo sin asistencia.
- Publicación de `1e3a4f62`, del README actualizado o de `v1.0-practica3` en GitHub.
- Corrección de los hallazgos de seguridad recogidos en la memoria, auditoría de todas las dependencias o ausencia absoluta de secretos en el historial.

El paquete incluye un caso ficticio ampliado y un PDF de apoyo, pero **no trae un expediente completo precargado y no declara ese guion como ejecutado**. La cuenta local tiene administración de una empresa ficticia, no administración de plataforma; cada instalación genera su propia contraseña.

## 4. Cómo se relaciona con la memoria completa

Se han leído las 51 páginas de `Memoria_tecnica_original_referencia.pdf` y contrastado especialmente arquitectura, datos, acceso, seguridad, pruebas y anexos de instalación con las fuentes de la base. Se ha inspeccionado además la presentación visual de las páginas 14, 29 y 44. No se altera ese PDF ni se ocultan los pendientes que describe.

| Memoria original | Qué se conserva | Actualización posterior documentada |
| --- | --- | --- |
| Páginas 3 y 5: referencia R3 y resumen | Identidad, alcance y resultados de su fecha. | El paquete probado usa `1e3a4f62`, no R3. Publicación y despliegue requieren evidencia independiente. |
| Capítulos 3-4, páginas 6-13 | Evolución de cuestionarios/PDS a revisión contextualizada; RF y RNF, diferidos y límites. | El instalador y este README no entregan IA, un corpus completo ni las funciones aplazadas. |
| Capítulo 5, páginas 14-18 | React/Express/Mongo, Nginx/Docker, PDF binario versionado y conflictos. | El README concreta la receta local y señala las plantillas de `infra/integration` todavía reutilizadas. |
| Capítulo 6, páginas 19-26 | Diferencias entre tarea, documento, evidencia, revisión, tiempo y unidades ENS/DP. | Se añade una guía docente desde una empresa vacía, sin atribuirle una ejecución integral. |
| Capítulo 7, páginas 27-31 | Controles y hallazgos H01-H06, privacidad y dependencias. | No existe retest de seguridad en la aceptación básica que permita declarar esos riesgos corregidos. |
| Capítulos 8-9, páginas 32-39 | Pruebas R3/TEMP-01, sus IDs, datos, fechas y limitaciones. | La nueva aceptación respalda **parte de RF07 y el recorrido básico de PR09/PR10 en Kali**, no todos los PR ni todos los entornos. |
| Capítulo 10, página 40 | Trabajo pendiente y separación producto/entrega. | Se resuelve el recorrido local básico descrito; vídeo, GitHub, todos los módulos y operación privada no se cierran por esa prueba. |
| Capítulos 11-12, páginas 41-42 | Autorías, estimaciones pendientes de validar y uso de IA. | No se fabrican contribuciones ni se cuentan horas de agentes como horas personales. Esta revisión documental también utiliza asistencia de IA y verificación de fuentes. |
| Anexo 13.A, página 43 | Comandos de obtención y QA de la referencia histórica R3. | Elegir R3 sigue reproduciendo ese antecedente, no el instalador posterior. La receta actual exige la versión de entrega identificada. |
| Anexo 13.A2, página 44 | Requisitos y operador local, inicialmente en un candidato previo. | La base `1e3a4f62` ya incorpora el instalador; el ZIP no necesita completar un checkout con nueve archivos sueltos. |
| Anexo 13.A3, página 45 | Recorrido de cuenta, servicio, recarga, persistencia y logout. | Ahora hay aceptación de ese recorrido básico en Kali con evidencia de API y navegador. |
| Anexo 13.A4, página 46 | Separación de GitHub, VPS, QA, seguridad y candidato portátil. | Añadir el entorno docente de la base posterior con el alcance de esta acta; no sustituir la identidad de los otros entornos. |
| Anexos restantes, páginas 47-51 | Mapa de código, fuentes, glosario y guion de vídeo. | El mapa se amplía con el instalador y la evidencia actual; los minutos previstos no se convierten en vídeo entregado. |

El catálogo activo continúa siendo diez fichas acotadas, no diez marcos normativos completos. Los 11 marcos/98 bloques/343 preguntas mencionados al describir P1 son una fotografía histórica distinta. La fecha de consulta tampoco se convierte en una revisión editorial diaria de fuentes legales.

## 5. Evidencias de código, separadas de la aceptación

Los recibos de QA de la misma base identifican:

- Backend: suite completa de 1.382 pruebas; ensayo adicional de 15 casos con réplica Mongo temporal; siete casos de SMTP/TLS local. Son tres ámbitos, no una suma E2E.
- Frontend: 47 suites y 525 pruebas, compilación y smoke local. La primera ejecución no pudo cargar suites por un problema de caché/EPERM; su resultado permanece registrado. Parte del smoke utilizó una API simulada y no acredita acceso real.
- La aceptación Kali posterior sí utiliza navegador, API y Mongo reales, pero únicamente el recorrido básico descrito en esta nota.

Los archivos fuente de evidencia son `Acta_de_aceptacion_Kali.txt`, `Comprobacion-del-paquete-validado-kali.json` y `Aceptacion_Kali.json`, con capturas de los intentos y de las fases satisfactorias. El ZIP docente los conserva en `documentacion/` y `documentacion/evidencias/`, junto con `Correspondencia_con_la_memoria.txt`. Esta nota es un resumen sanitizado para el repositorio; no inventa URLs públicas de recibos locales ni distribuye contraseñas, cookies, certificados o volúmenes del ensayo.

La revisión documental propia comprobó el SHA del ZIP, integridad, correspondencia de los 593 archivos y los comandos/contratos descritos. No ejecutó Git, Docker, cuentas, migraciones, despliegues o nuevas pruebas funcionales. Las pruebas de producto siguen atribuidas a sus responsables y a sus cortes.

## 6. Condiciones para cerrar la publicación

La observación remota de la sección 1 es una instantánea fechada, no un estado perpetuo. Tras integrar esta documentación, el responsable canónico debe:

1. Identificar el commit final y confirmar que contiene todas las entregas acordadas, sin secretos ni dependencias en carpetas externas o ramas de trabajo.
2. Si solo cambia documentación, registrar la igualdad de fuentes ejecutables/lockfiles frente a la base aceptada. Si cambia código o configuración de ejecución, repetir las comprobaciones afectadas antes de trasladar la aceptación.
3. Validar enlaces y coherencia de README, guía local, esta nota y cronología; mantener los informes históricos con su contexto.
4. Publicar `main` por el flujo autorizado, comprobar el SHA remoto y la CI de ese commit y crear/verificar la etiqueta académica `v1.0-practica3` sobre la referencia realmente entregada.
5. Reproducir la obtención desde GitHub de esa referencia sin añadir archivos de otras copias, y documentar qué parte del ensayo se repitió o se mantiene por identidad comprobada.
6. Separar la limpieza condicional de ramas de la instalación y de los datos. Conservar trabajo útil, autores y commits recuperables antes de retirar referencias.

Esta nota documenta el estado anterior al recibo remoto; por sí sola **no acredita que clonar `main` reproduzca el paquete validado**. Comprueba el commit y la CI de `main` y de la etiqueta antes de usarla. Tampoco se afirma que esta revisión documental cierre el resto de condiciones académicas, las incidencias de seguridad o el entorno privado.
