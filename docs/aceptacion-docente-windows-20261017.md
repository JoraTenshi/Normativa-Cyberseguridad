# Ensayo de instalación docente en Windows — 17/10/2026

Este documento registra la revisión de la ruta Windows del README. La memoria técnica original y la etiqueta académica `v1.0-practica3` se conservan. El ensayo utiliza exclusivamente datos sintéticos y una copia extraída en una carpeta local fuera de OneDrive.

## Identidad y entorno

- Base del ZIP reproducido: código `1e3a4f62fd0cca6927a97fc42fb9f86e847a6eb5`, SHA-256 del ZIP `20638994c996b7cfe11113555dc1f085bd61483852bb1f3b91c16f234437564f`.
- Windows 11 Pro x86-64; Node.js `v24.13.0`; cliente y motor Docker `29.8.2`; Docker Compose `v5.6.0`; contexto `desktop-linux`; `docker info` devolvió `linux`.
- Docker Desktop y Git for Windows/OpenSSL ya estaban instalados. No se ensayó su instalación desde cero ni se modificó su configuración institucional.
- Revisión del operador: aceptar explícitamente Compose 2.x y 5.x en `scripts/local-demo.cjs`. El resto de servicios y de la aplicación no se alteró para este ensayo.

## Secuencia y resultado observado

| Paso del README | Prueba y resultado |
| --- | --- |
| Descarga y extracción | ZIP existente con SHA-256 coincidente; `Expand-Archive` a una carpeta local nueva fuera de OneDrive. `node herramientas/verificar-paquete.cjs` devolvió `INTEGRIDAD CORRECTA: 613 archivos` y el commit esperado. |
| Requisitos | Node 24 y Compose 5.6.0 observados. El ZIP original emitió `COMPOSE_V2_REQUIRED` al ejecutar `start`; no creó `.runtime`. |
| Arranque corregido | Con la guarda de versión adaptada, `start` construyó web y API, descargó MongoDB, inicializó réplica y usuario limitado; los tres contenedores llegaron a `healthy`. Terminó en `VERIFICADO: HTTPS local, interfaz, API/Mongo...` y mostró `https://127.0.0.2:9445/espacio-de-trabajo`. Los avisos `npm warn deprecated` no detuvieron la construcción. |
| Certificado | `Test-Path .\.runtime\local-demo\tls\ca.crt` devolvió `True` y `Get-PfxCertificate` leyó su huella. La validación HTTPS del operador usó la CA de esa instalación. El intento automatizado de importarla al almacén del usuario no terminó y se verificó que no quedó instalada. `curl.exe` con Schannel indicó que desconocía el estado de revocación; no se desactivó la validación para declararlo aprobado. No se atribuye a esto una prueba visual en Edge/Chrome. |
| Cuenta y acceso | El arnés de aceptación ejecutó dentro del backend el mismo script de creación que invoca `account`; conservó la contraseña únicamente en memoria. Pasó login HTTPS real, cookie segura/HttpOnly y lectura de la empresa ficticia. `node scripts/local-demo.cjs account` en terminal interactiva reconoció después que la cuenta ya existía y no alteró su contraseña. En una **segunda extracción limpia del ZIP revisado**, `account` inicial terminó correctamente en TTY; su contraseña se ocultó de los registros y una segunda ejecución confirmó que la cuenta existía sin restablecerla. |
| Uso y persistencia | Por la API real se creó y recuperó un servicio ficticio. El arnés comprobó acceso al historial, detuvo y volvió a iniciar contenedores, verificó de nuevo HTTPS, inició sesión, recuperó empresa/servicio y revocó la sesión al salir. `LOCAL_DEMO_REAL_DOCKER_API_PASSED`. |
| Comandos de mantenimiento | `node scripts/local-demo.cjs status`, `verify`, `stop` y `start` se ejecutaron desde PowerShell con éxito; `stop` conservó los datos y `start` terminó de nuevo en `VERIFICADO`. |

## Incidencias convertidas en instrucciones

1. El README anterior solo enlazaba Docker Desktop. Ahora describe la instalación interactiva oficial, su inicio, contenedores Linux, comprobación de cliente **y servidor**, Compose y contexto.
2. El ZIP anterior exigía Compose 2 y bloqueaba el Compose 5 incluido en el Docker Desktop instalado. Se cambió la guarda, se ensayó con 5.6.0 y se añadió un error específico para familias no aceptadas.
3. La copia de uso estaba bajo OneDrive; la guía ahora exige extraer antes de arrancar en una carpeta local estable y comprobar en qué carpeta se ejecuta cada comando.
4. Se precisaron el resultado del puerto libre, el tiempo de construcción, el significado de los avisos npm, la ruta y huella de la CA, y el carácter irrepetible de la contraseña mostrada por `account`.
5. La importación de la CA en el almacén de Windows y la navegación visual requieren una comprobación separada; un arranque HTTPS por API no demuestra que Chrome o Edge hayan confiado en ella.

## Límite de la afirmación

Este ensayo acredita la instalación y la funcionalidad básica en **esta máquina Windows**, en Docker y por API. No acredita la instalación de Docker Desktop desde cero, el acto de confiar en la CA en Edge/Chrome, el recorrido visual, todos los módulos normativos, SMTP, MFA ni una instalación limpia en otro equipo. La aceptación Kali documentada antes sí tiene recorrido básico visual con Firefox; no debe trasladarse a Windows por analogía.

La memoria técnica original describe el proyecto académico y contiene observaciones históricas. Esta revisión corrige la receta local y el operador de arranque; no modifica la memoria ni presenta pruebas parciales como aceptación normativa completa.
