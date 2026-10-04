# Registro de trabajo para la auditoría de seguridad

Este registro conserva los hallazgos, decisiones, cambios y comprobaciones que fundamentarán el informe de auditoría final de Normativa Check. No contiene secretos ni sustituye las pruebas de integración del producto.

## Reparto de trabajo confirmado por el usuario

El usuario lleva, con apoyo de Codex, toda la parte de identidad y autenticación, aunque esté implementada en el backend: registro, verificación de cuentas y correo, inicio de sesión, 2FA y QR, cifrado de secretos y recuperación de contraseña. Jorge lleva el resto del backend. Esta precisión se confirmó el 1 de octubre de 2026 y corrige una atribución anterior errónea.

## Procedencia de la información anterior a este registro

- Según el resumen aportado por el usuario, se implementaron registro, bienvenida y verificación por correo, bloqueo del acceso antes de verificar, recuperación de contraseña, límites de intentos y 2FA con interfaz.
- El usuario comunicó comprobaciones manuales de registro `201`, acceso previo a la verificación `403`, verificación `200` y acceso posterior `200`. También comunicó que se revisaron los límites separados y la persistencia del secreto 2FA al refrescar. Estas comprobaciones se conservan como resultados comunicados; este registro todavía no contiene sus trazas reproducibles.
- Los cambios siguen sin commit ni push por decisión del usuario. El Word pedagógico se redactará después de publicar el trabajo en GitHub.

## SEG-001: clave de firma JWT inestable o de ejemplo

Fecha: 30 de septiembre de 2026. Estado: corregido en código y configuración local; arranque Docker y salud de la API comprobados; inicio de sesión manual comunicado por el usuario.

**Hallazgo comprobado por lectura.** `backend/utils/initSecrets.js` generaba otra clave si faltaba `JWT_SECRET` o tenía menos de 32 caracteres. Si no podía escribir `backend/.env`, el servidor seguía arrancando con una clave válida solo durante ese proceso. Además, el `.env` local contenía exactamente el texto público de `backend/.env.example` como clave. No se registró ni mostró ningún otro valor del archivo.

**Riesgo.** Una clave pública o predecible debilita la firma de sesiones. Una clave temporal invalida las sesiones al reiniciar y puede dar resultados distintos entre instancias.

**Decisión y cambio.** `backend/utils/initSecrets.js` exige al arrancar una cadena hexadecimal de al menos 32 bytes y longitud par. Ya no crea ni escribe claves automáticamente. `backend/.env.example` deja `JWT_SECRET` vacío e indica cómo generarlo. Se sustituyó solo el marcador de ejemplo del `.env` local por 32 bytes aleatorios, sin mostrar su valor y conservando permisos `0600`. Las pruebas de autenticación usan una clave aleatoria de prueba. Una forma hexadecimal válida no demuestra por sí sola que una clave elegida por una persona sea aleatoria; la generación segura sigue siendo un requisito de operación.

**Pruebas ejecutadas.** `npm test` en `backend`: 5 pruebas superadas, incluidas las de rechazo de clave ausente, de ejemplo y mal formada, y aceptación de claves aleatorias de 32 y 64 bytes. `node --check` pasó para el validador y su nueva prueba. `git diff --check` pasó. La configuración local pasó una carga real de `dotenv` seguida del validador, sin iniciar MongoDB ni imprimir la clave.

**Límite de la evidencia.** El arranque y la salud del conjunto Docker se han comprobado. El inicio de sesión se conserva como prueba manual comunicada por el usuario, sin captura de red ni reproducción automatizada en este registro. Las sesiones firmadas con la clave de ejemplo anterior dejarán de ser válidas.

**Intento de arranque y comprobación del 30 de septiembre de 2026.** `docker compose config --quiet` pasó. El servicio Docker rechazó el acceso al socket (`permission denied`); `sudo -n` indicó que se requiere la contraseña local. La web y `/api/health` de los contenedores que ya estaban en ejecución respondieron `200`, y la API informó `db: connected`. El proceso `node server.js` de esos contenedores se inició antes de modificar `initSecrets.js`; su lista de rutas tampoco incluye las rutas nuevas. Por ello, esos resultados solo probaban que la versión anterior seguía activa.

**Reconstrucción comunicada por el usuario.** El usuario ejecutó `sudo docker compose up -d --build` e indicó que terminó correctamente. La inspección posterior mostró un proceso nuevo `node server.js`, pero Nginx respondió `502` tanto para `/` como para `/api/health`. El proceso maestro de Nginx era anterior a la reconstrucción. Se plantea como hipótesis que Nginx conserva direcciones antiguas de los servicios reconstruidos; se ha solicitado reiniciar solo Nginx y repetir las consultas. El `502` está observado; la causa todavía no está confirmada.

**Aislamiento del fallo.** Mediante consultas directas desde el anfitrión a la red interna de Docker, el frontend nuevo respondió `200` y el backend nuevo respondió `200` en `/health`, con `db: connected`. El índice de la API nueva incluye las rutas de verificación de correo y recuperación de contraseña. Esto confirma que ambos servicios responden y acota el `502` a la ruta que pasa por Nginx.

**Verificación posterior al reinicio comunicado por el usuario.** El usuario indicó que reinició el servidor. Se observó un proceso nuevo de Nginx y, por HTTPS, `/` devolvió `200`, `/api/health` devolvió `200` con `ok: true` y `db: connected`, y `/api/me` sin sesión devolvió `401`. El índice de la API servido por Nginx incluye las rutas nuevas. El `502` quedó resuelto tras reiniciar Nginx, lo que es compatible con la hipótesis de direcciones antiguas retenidas por el proxy; no se inspeccionaron sus registros internos para confirmar la causa exacta. La consulta HTTPS local usó `curl -k`, por lo que no verifica la confianza pública del certificado.

**Inicio de sesión manual comunicado por el usuario.** Después de arrancar los servicios y reiniciar Nginx, el usuario indicó: «Funciona bien. He iniciado sesión». No se solicitaron ni registraron credenciales, cookies o tokens. Una consulta adicional de solo lectura confirmó que `/api/health` seguía en `200` con MongoDB conectado y que la web seguía en `200`.

## Hallazgos y controles en seguimiento

- **Imagen Docker.** `backend/.dockerignore` ya excluye `.env` del contexto de construcción; se comprobó por lectura. No se considerará un fallo. Referencia: https://docs.docker.com/build/concepts/context/.
- **Secreto 2FA.** `backend/models/Usuario.js` y `backend/routes/twoFactor.js` muestran que el secreto TOTP se guarda como texto en MongoDB. Una fuga de la base de datos podría exponerlo. Falta diseñar y comprobar la protección del dato y la gestión separada de su clave.
- **Límites de intentos.** `backend/server.js` usa limitadores en memoria del proceso. Falta evaluar su eficacia cuando haya reinicios o varias instancias.
- **Permisos del contenedor.** `backend/Dockerfile` no declara un usuario de ejecución no privilegiado. Antes de cambiarlo hay que resolver la dependencia del montaje de `backend/.env` en `docker-compose.yml` y verificar el arranque.
- **Publicación y pruebas de integración.** Nginx está enlazado a `127.0.0.1` en `docker-compose.yml`. Falta definir el despliegue de producto y comprobar la ruta completa de red, base de datos, correo y navegador.

Los puntos en seguimiento son trabajo pendiente. Su presencia aquí no equivale a una vulnerabilidad explotada ni a una prueba completada.

## SEG-002: cambio parcial del cifrado 2FA

Fecha: 30 de septiembre de 2026. Estado: bloqueo de revisión; ámbito de identidad y autenticación a cargo del usuario con apoyo de Codex, según la aclaración del 1 de octubre de 2026.

**Cambio observado.** El usuario sustituyó el valor guardado en `backend/routes/twoFactor.js` por `encryptTotpSecret(generated.base32)`. La búsqueda en el proyecto no encontró ninguna declaración ni importación de `encryptTotpSecret`, función de descifrado o clave de cifrado configurada. El resto del flujo sigue usando `usuario.twoFactorSecret` directamente para construir el QR, devolverlo al navegador y comprobar los códigos en `twoFactor.js` y `auth.js`.

**Consecuencia deducida del código.** Si una cuenta sin secreto abre la configuración 2FA con el archivo actual cargado, JavaScript intentará llamar a una función inexistente antes de actualizar MongoDB. El bloque `catch` responderá `500`. La línea no cifra ningún dato. Si se añadiera después una función que guardase texto cifrado sin adaptar las lecturas, el QR y la verificación de códigos dejarían de funcionar. Los secretos de cuentas existentes seguirían en texto hasta migrarlos.

**Evidencia y límite.** `npm test` en `backend` volvió a pasar 5/5 y `CI=true npm run build` en `frontend` compiló correctamente; no hay una prueba 2FA que ejercite este caso. `git diff --check` pasó. El proceso backend desplegado se inició antes de la modificación local de `twoFactor.js`, así que el inicio de sesión manual anterior no valida este cambio. No se ejecutó la ruta de configuración en la aplicación activa ni se alteraron cuentas o secretos existentes.

**Criterios para cerrar el hallazgo.** En el trabajo de identidad del usuario se debe completar una función de cifrado autenticado con clave independiente de la base de datos y de `JWT_SECRET`, definir dónde se guarda y respalda esa clave, descifrar solo en los puntos necesarios, migrar los secretos antiguos sin romper las cuentas y probar configuración, activación, acceso con 2FA, desactivación y fallo por datos alterados. Después se requiere reconstruir los contenedores y comprobar el flujo real desde la interfaz. Referencia técnica: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html.

**Unidad de clave separada, 1 de octubre de 2026.** `backend/utils/initSecrets.js` exige ahora `TOTP_ENCRYPTION_KEY` de 32 bytes expresados con 64 caracteres hexadecimales y rechaza que coincida con `JWT_SECRET`, incluso si solo cambia el uso de mayúsculas. `backend/.env.example` documenta la variable sin asignarle valor. Se generó una clave aleatoria independiente en el `.env` local, excluido de Git y con permisos `0600`; no se mostró ni se copió su valor al registro. Se ejecutaron 7 pruebas del backend y todas pasaron, incluidas las de clave 2FA ausente, mal formada, repetida y válida. Una carga local de `dotenv` seguida de `initSecrets` también pasó. `git diff --check` y la comprobación de sintaxis pasaron. Todavía no hay función de cifrado ni se ha reconstruido la imagen Docker; el cambio local de `encryptTotpSecret(...)` sigue incompleto. Antes de cifrar datos persistentes hay que definir un respaldo seguro de la clave, pues su pérdida impediría descifrar los secretos 2FA.

## Revisión integral previa a los commits locales

Fecha: 1 de octubre de 2026. Estado: revisión del árbol de trabajo; sin commit ni push.

**Inventario.** La rama `backend` sigue a `origin/backend`. Hay 14 archivos seguidos por Git modificados y 8 archivos nuevos sin añadir a Git. Los cambios abarcan modelo y rutas de autenticación, comprobación de sesiones, correo, configuración, frontend de acceso y 2FA, pruebas y este registro. Se revisaron el diff y los archivos nuevos sin cambiar los secretos locales.

**Funciones implementadas por lectura.** El registro crea una cuenta pendiente, envía un enlace de verificación y no abre sesión; el enlace usa un token aleatorio cuyo hash queda en la base de datos. Se añadieron verificación de un solo uso, reenvío, bloqueo de acceso hasta confirmar el correo, recuperación de contraseña, invalidación de sesiones tras el cambio de contraseña, límites separados para acceso y 2FA y las pantallas correspondientes. La interfaz deja de interpretar como HTML el parámetro `msg`, eliminando el receptor de XSS añadido anteriormente al repositorio. La clave de firma JWT y la futura clave de cifrado 2FA se validan al arrancar. Estas frases describen código presente, no certifican todo el recorrido de producto.

**Pruebas ejecutadas en la revisión.** `npm test` en `backend`: 7/7 pruebas superadas. Cubren registro y verificación de un solo uso con sustitutos de las dependencias, restablecimiento e invalidación de una sesión anterior, restauración de enlaces cuando falla el correo y validación de las dos claves. `CI=true npm run build` en `frontend`: compilación correcta, con avisos de Browserslist desactualizado y deprecación de `fs.F_OK`. `git diff --check`: correcto. Las pruebas automatizadas no cubren configuración, activación, acceso ni desactivación 2FA, ni verifican por sí solas SMTP, MongoDB y el navegador juntos. Las pruebas manuales de registro, correo, acceso y verificación consignadas al inicio fueron comunicadas por el usuario y corresponden a una construcción anterior a la línea incompleta de cifrado.

**Bloqueos antes de publicar.** La llamada a `encryptTotpSecret(...)` en `backend/routes/twoFactor.js` no tiene implementación ni importación; con el archivo actual, una configuración 2FA nueva respondería `500`. Tampoco hay descifrado en las lecturas de configuración, activación, desactivación y acceso. `TOTP_ENCRYPTION_KEY` existe solo en el `backend/.env` local y no tiene copia de recuperación acordada. `make clean` elimina ese archivo y los volúmenes de MongoDB; `make up` en una copia nueva crea claves vacías desde `.env.example`, y el arranque actual las rechaza. Hay que corregir el proceso de instalación y advertir claramente sobre la eliminación de datos y claves. Las cuentas creadas antes de añadir `emailVerifiedAt` no tienen necesariamente ese campo: la comprobación nueva de acceso y sesiones las rechazaría hasta definir y ejecutar una transición segura.

**Riesgos adicionales por revisar.** El archivo raíz `.env` tiene permisos `0664` en este equipo y contiene configuración sensible; `backend/.env` y la clave TLS local tienen `0600`. Los límites de intentos se guardan solo en memoria. Los tokens temporales de verificación y recuperación llegan en la URL: la página los retira del historial una vez cargada, pero falta comprobar los registros del servidor web y la política de referencias. Las imágenes y cabeceras de seguridad deben revisarse para el despliegue del producto.

**Dependencias.** La revisión de `npm audit --omit=dev` informó 4 hallazgos en el backend (1 alto y 3 moderados) y 51 en el árbol de dependencias del frontend (2 críticos, 25 altos, 13 moderados y 11 bajos). Entre los paquetes directos figuran Nodemailer, Mongoose, Axios y React Scripts. El resultado de auditoría describe dependencias instaladas; no demuestra que los 51 hallazgos estén presentes o sean explotables en la imagen que solo sirve archivos estáticos. Se requiere clasificación y actualización compatible antes de presentar el producto como seguro.

**Publicación.** La revisión no crea commits ni envía cambios al remoto. Primero se debe completar y probar el cifrado 2FA, resolver la recuperación de la clave y la transición de cuentas, y repetir las comprobaciones sobre una construcción nueva. Después se podrán crear commits locales revisables y, una vez acordado, publicar en GitHub. El documento Word pedagógico queda pendiente hasta que el trabajo esté terminado y publicado, conforme a la instrucción del usuario.

## SEG-003: mensajes arbitrarios en la página de acceso

Fecha: 1 de octubre de 2026. Estado: corregido en el código local; pendiente de reconstrucción y comprobación en el navegador.

**Hallazgo.** `frontend/src/pages/Auth.jsx` leía el parámetro `msg` de la URL y lo mostraba en un aviso. El uso anterior de `dangerouslySetInnerHTML` ya se había sustituido por texto de React, lo que impedía interpretar ese contenido como HTML en este punto, pero una persona externa aún podía crear enlaces que mostrasen mensajes elegidos por ella en la página real de acceso. En este fragmento no hay una ruta directa hacia SQL ni operaciones de lectura o inclusión de archivos; el riesgo residual era la suplantación de un aviso de la aplicación.

**Decisión y cambio.** Tras la explicación, el usuario confirmó que entendía el problema y pidió quitar la entrada arbitraria. Se retiraron la lectura de `msg` y el bloque visual que la presentaba. Permanecen los avisos que el propio formulario produce a partir de sus operaciones de registro y acceso. No se modificaron las páginas que leen tokens temporales para verificación y recuperación.

**Comprobación ejecutada.** `CI=true npm run build` en el frontend compiló correctamente; mostró únicamente los avisos ya conocidos de Browserslist y deprecación de `fs.F_OK`. `git diff --check` pasó. Una búsqueda en `Auth.jsx` no encontró `urlMsg`, `dangerouslySetInnerHTML` ni el uso de `msg`. La compilación no sustituye una prueba visual del frontend reconstruido.

## SEG-004: funciones aisladas de cifrado y descifrado 2FA

Fecha: 1 de octubre de 2026. Estado: funciones y pruebas completas; integración con usuarios pendiente.

**Explicación acordada.** El usuario entendió que el servidor debe recuperar el secreto legible para construir el QR durante la configuración y verificar los códigos posteriores. Se aclaró que Google Authenticator conserva su propia copia tras escanear el QR. Antes de editar se explicó la pareja `encryptTotpSecret` y `decryptTotpSecret`, el uso de AES-256-GCM, un vector de inicio aleatorio y una marca de autenticación, así como la dependencia de la clave `TOTP_ENCRYPTION_KEY`.

**Cambio.** Se añadió `backend/utils/totpEncryption.js` con cifrado AES-256-GCM mediante `node:crypto`, clave hexadecimal de 32 bytes, IV aleatorio de 12 bytes y etiqueta de autenticación de 16 bytes. El valor preparado para almacenar sigue el formato `v1:iv:etiqueta:cifrado` en hexadecimal. El descifrado comprueba formato y etiqueta; los datos alterados o cifrados con otra clave no se recuperan. Las funciones validan entradas y no muestran ni registran la clave o el secreto. Se añadió `backend/tests/totpEncryption.test.js` con pruebas de ida y vuelta, aleatoriedad, alteración, clave incorrecta y datos inválidos.

**Pruebas ejecutadas.** `npm test` en el backend: 11/11 superadas. `node --check` para el módulo y sus pruebas: correcto. `git diff --check`: correcto. Estas pruebas operan con claves aleatorias de prueba y no cifran datos reales de usuarios.

**Límite actual.** Las rutas de 2FA siguen sin importar ni utilizar el módulo. La llamada previa a `encryptTotpSecret(...)` de `backend/routes/twoFactor.js` continúa incompleta, por lo que el archivo actual sigue dando `500` al iniciar una configuración 2FA nueva. No se reconstruyeron contenedores ni se alteraron secretos existentes. Antes de integrar el cifrado en MongoDB hay que resolver el respaldo recuperable de la clave y adaptar todas las lecturas de 2FA, incluida la transición de datos antiguos.

## SEG-005: recuperación de la clave 2FA antes de guardar datos cifrados

Fecha: 1 de octubre de 2026. Estado: explicación y elección del destino pendientes; no se ha copiado la clave.

**Situación comprobada.** `TOTP_ENCRYPTION_KEY` está configurada en el `backend/.env` local con permisos `0600`, excluido de Git. No se leyó ni mostró su valor. `make clean` elimina ese archivo y los volúmenes de MongoDB. El módulo de cifrado ya existe y se probó con claves temporales de prueba, pero aún no está conectado a las rutas ni ha cifrado secretos de usuarios. Una copia en el mismo disco solo cubriría algunos borrados accidentales; no cubriría la pérdida del equipo o del disco.

**Criterio de recuperación.** La copia debe conservar exactamente la misma clave en almacenamiento protegido, independiente del repositorio y de la base de datos, con un modo comprobable de recuperarla. Se estudiará con el usuario una entrada en un gestor de contraseñas con respaldo seguro o un archivo cifrado en almacenamiento externo. En este equipo se detectó `gpg`; no se detectaron los ejecutables `keepassxc` ni `age`. Todavía no se ha elegido un destino ni se ha creado una copia. OWASP recomienda respaldar especialmente las claves de cifrado en almacenamiento separado y probar la restauración: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html.

**Destino previsto tras consultar al usuario.** El usuario dispone de una memoria USB. Se propone crear una base cifrada de KeePassXC fuera del repositorio, guardar allí una entrada con una copia exacta de `TOTP_ENCRYPTION_KEY`, copiar el archivo cifrado a la memoria USB y comprobar que la copia se abre. Todavía no se ha instalado KeePassXC, creado la base ni copiado la clave. Una comprobación de solo lectura con `lsblk` no mostró ningún USB conectado al entorno Kali; `apt` ofrece KeePassXC, pero la instalación del sistema requiere la contraseña local de `sudo` y no se ha ejecutado. No se registran aquí valores de claves ni contraseñas.

**Corrección del entorno comunicada por el usuario.** Kali se ejecuta en una máquina virtual; KeePass y la memoria USB están en el portátil anfitrión. La instrucción anterior de instalar KeePassXC en Kali suponía erróneamente que el portátil y Kali eran el mismo entorno. La VM dispone del punto de montaje de carpetas compartidas de VMware (`/mnt/hgfs`), pero en la comprobación no había carpetas expuestas. El USB tampoco está conectado a la VM. Se debe trasladar solo un archivo cifrado entre VM y anfitrión, confirmar que el KeePass del anfitrión abre su formato y verificar una copia recuperable en el USB antes de cifrar secretos de usuarios.

**Formato confirmado por el usuario.** El gestor del portátil es KeePass 2 y utiliza archivos `.kdbx`. KeePassXC en Kali puede crear ese formato; su instalación en la VM serviría únicamente para colocar la clave en un archivo cifrado antes de transferirlo. No se ha realizado aún ninguna instalación ni transferencia.

**Preparación posterior.** Tras la indicación del usuario de acelerar el trabajo sin omitir explicaciones, se comprobó que KeePassXC ya está instalado en Kali y que VMware expone ahora la carpeta compartida `/mnt/hgfs/KaliShare`. Se creó `/home/kali/Documents/Seguridad` con permisos `0700` fuera del repositorio para guardar la base cifrada de trabajo. No se ha creado aún ningún archivo `.kdbx` ni se ha leído, copiado o mostrado la clave. La contraseña maestra la elegirá el usuario directamente en la interfaz gráfica.

**Base creada por el usuario.** El usuario confirmó la creación de `/home/kali/Documents/Seguridad/NormativaCheck.kdbx`. La comprobación de solo lectura identificó un archivo KDBX 2.x, propiedad de `kali`, de 1893 bytes y con permisos `0600`, dentro de la carpeta privada `0700`. No se abrió la base ni se solicitó su contraseña maestra. Todavía no se ha guardado allí la clave ni se ha transferido nada al anfitrión o al USB.

**Incidencia al copiar al portapapeles.** El usuario mostró una captura donde `xclip` respondió `Error: Can't open display: (null)` al ejecutar el conducto de extracción de la clave en una terminal de Kali. La captura no muestra el valor de la clave. La causa observada es que esa terminal no proporcionó la variable gráfica `DISPLAY` a `xclip`; una comprobación separada y sin imprimir contenido confirmó que `DISPLAY=:0` permite acceder al portapapeles de la sesión gráfica. La orden se corregirá aplicando `DISPLAY=:0` solo al proceso `xclip`. Todavía no hay confirmación de que la clave se haya pegado o guardado en KeePassXC.

**Entrada creada y verificación preparada.** El usuario comunicó que guardó la entrada de la clave en KeePassXC. El archivo KDBX conservó permisos `0600` y su tamaño pasó de 1893 a 2181 bytes, lo que confirma una escritura pero no la exactitud del valor. Se creó fuera del repositorio `/tmp/verificar_clave_normativa_check.py` con permisos `0700`; compara la clave local y el texto copiado desde KeePassXC con `hmac.compare_digest`, imprime solo `COINCIDE` o `NO COINCIDE` y sustituye el portapapeles por un espacio al terminar. Dos comprobaciones con datos ficticios produjeron las respuestas esperadas. Aún no se ha ejecutado con la clave real ni se ha transferido el KDBX a la carpeta compartida. Se observó que `/mnt/hgfs/KaliShare` contiene archivos marcadores de ambos lados, sin abrir ni modificar su contenido.

**Comparación y traslado.** El usuario comunicó que la utilidad devolvió `COINCIDE` al comparar la entrada de KeePassXC con `backend/.env`; no se solicitó ni registró el valor. Se copió únicamente `/home/kali/Documents/Seguridad/NormativaCheck.kdbx` a `/mnt/hgfs/KaliShare/NormativaCheck.kdbx`, después de confirmar que el destino no existía. `cmp -s` devolvió 0: ambas copias son idénticas byte por byte y miden 2181 bytes. El archivo original conserva permisos `0600`; el montaje compartido muestra `0755` para la copia, cifra que no permite inferir por sí sola los permisos ACL efectivos del sistema anfitrión. Quedan pendientes abrir la copia desde KeePass 2 en el portátil, copiarla al USB y probar la apertura de la copia del USB.

**Restauración manual comunicada por el usuario.** En respuesta a la petición de abrir la copia de `KaliShare`, copiar el `.kdbx` al USB y abrirlo desde allí, el usuario indicó «Vale ya está». Se registra como confirmación comunicada de esos pasos, sin acceso de Codex al portátil o al USB para verificarla directamente. La clave en el `.env` local coincide con la entrada de KeePassXC según la prueba manual anterior. El respaldo está preparado para integrar el cifrado en código, aunque la restauración real de una aplicación completa requeriría también conservar los datos de MongoDB y la contraseña maestra de la base KeePass.

## SEG-006: integración del cifrado 2FA en las rutas

Fecha: 1 de octubre de 2026. Estado: implementado y probado con sustitutos; pendiente de reconstrucción y prueba con MongoDB real.

**Cambio.** El cifrado AES-256-GCM usa ahora como dato autenticado adicional el identificador del usuario. Un secreto cifrado para una cuenta no se puede trasladar a otra cuenta y descifrarlo allí. `backend/routes/twoFactor.js` guarda el secreto cifrado al iniciar la configuración y obtiene temporalmente el texto legible para generar el QR, activar y desactivar 2FA. `backend/routes/auth.js` obtiene el texto legible para verificar el código durante el acceso. `readTotpSecret` conserva de forma temporal la lectura de secretos antiguos de 32 caracteres Base32, para no interrumpir el acceso antes de migrarlos. Un valor cifrado alterado o que corresponda a otro usuario falla al descifrar.

**Pruebas ejecutadas.** Las pruebas unitarias verifican recuperación del secreto con la cuenta correcta y rechazo con otra cuenta. Una prueba de rutas con usuario simulado recorre configuración, actualización del QR, rechazo de un valor alterado, activación, acceso con segundo factor y desactivación; también recorre el acceso de una cuenta con secreto antiguo. `npm test` pasó 12/12 tras la integración. La prueba no usa MongoDB, SMTP ni un navegador real. El código de rutas aún no se ha desplegado en los contenedores.

## SEG-007: transición de secretos 2FA antiguos

Fecha: 1 de octubre de 2026. Estado: script y pruebas preparados; no ejecutado sobre MongoDB real.

**Cambio.** `backend/scripts/migrateTotpSecrets.js` incorpora `--dry-run` para contar secretos cifrados, antiguos e inválidos sin escribir, y `--apply` para cifrar los antiguos. La ejecución con `--apply` hace primero un análisis completo y se detiene sin escribir si encuentra datos inválidos o cifrados que la clave configurada no puede abrir. Cada actualización exige que el valor siga siendo el leído, para no sobrescribir un cambio simultáneo. La salida contiene solo contadores, nunca secretos. El script vuelve a analizar la colección al terminar y puede repetirse sin volver a cifrar registros ya migrados.

**Pruebas ejecutadas.** `backend/tests/migrateTotpSecrets.test.js` usa usuarios simulados. Confirma que el análisis no escribe, que un dato inválido bloquea la migración antes de escribir, que el secreto legible se conserva y que una segunda ejecución no vuelve a escribir. `npm test`: 15/15 pruebas superadas. `node --check` para script y prueba y `git diff --check`: correctos. No se ha probado el script contra MongoDB real.

**Corrección de la consulta antes de ejecutarla con MongoDB.** Una inspección de la proyección que Mongoose prepara para `select('_id +twoFactorSecret')` mostró que esa combinación no producía la selección pretendida. Se cambió a `select('_id twoFactorSecret')`. La misma inspección produjo `{"_id":1,"twoFactorSecret":1}`, sin el hash de contraseña. `npm test` volvió a pasar 15/15; las pruebas con sustitutos no habían detectado el problema de proyección. El análisis en seco contra MongoDB real sigue pendiente.

**Orden antes de aplicar.** Hay que reconstruir y verificar el backend nuevo, pues el anterior no sabe leer secretos cifrados. Antes de `--apply` debe existir una copia recuperable de MongoDB además del respaldo de `TOTP_ENCRYPTION_KEY`. Se debe ejecutar y revisar `--dry-run`, aplicar la migración y comprobar que los contadores finales de secretos antiguos e inválidos son cero. La lectura temporal de secretos antiguos podrá retirarse solo cuando la migración real y sus comprobaciones terminen.

**Aviso observado durante las pruebas.** Express indicó que `res.clearCookie` recibe la opción `maxAge` en `backend/routes/auth.js:441`; esa opción está obsoleta para dicha función y se ignorará en Express 5. Las pruebas pasaron, pero conviene corregir la llamada y comprobar sus opciones de cookie antes de publicar.

## SEG-008: limpieza sin borrar la clave ni MongoDB

Fecha: 1 de octubre de 2026. Estado: corregido en el código local; comando destructivo no ejecutado.

**Hallazgo.** `make clean` contenía `docker compose down -v --rmi local` y `rm -f backend/.env`. La opción `-v` borra los volúmenes de Compose, entre ellos `mongo_data`; el segundo comando borra la clave local de cifrado 2FA y los demás ajustes de autenticación. Juntos podían destruir los datos y dejar una copia de MongoDB imposible de descifrar si no se conservaba la clave correcta.

**Cambio.** `clean` usa ahora `docker compose down --rmi local` y elimina únicamente los `node_modules` locales. Conserva los volúmenes, los archivos `.env` y los certificados. El texto de ayuda se actualizó para reflejarlo. Se quitó la dependencia `clean: down` para no ejecutar dos veces `docker compose down`.

**Comprobación ejecutada.** `make -n clean` mostró las órdenes previstas sin ejecutarlas y confirmó la ausencia de `-v` y del borrado de `.env`; `git diff --check` pasó. No se ha probado una limpieza real, porque detendría la aplicación y eliminaría dependencias de trabajo.

## SEG-009: copia cifrada de MongoDB previa a la migración 2FA

Fecha: 1 de octubre de 2026. Estado: script preparado; copia real pendiente.

**Necesidad.** El respaldo de `TOTP_ENCRYPTION_KEY` permite recuperar secretos 2FA cifrados, pero por sí solo no recupera las cuentas ni el resto de datos de MongoDB. El volcado de la base también puede contener hashes de contraseñas, tokens y secretos 2FA antiguos en texto. Debe cifrarse antes de persistirlo fuera del contenedor y comprobarse antes de migrar.

**Entorno y bloqueo comprobados.** En Kali están instalados `mongodump`, `mongorestore`, GPG y `pinentry-curses`; `/home/kali/Documents/Seguridad` pertenece a `kali` y tiene permisos `0700`. El proceso de Codex no tiene acceso a `/var/run/docker.sock`: `docker compose ps` devolvió `permission denied`. `sudo -n docker compose ps` indicó que hace falta una contraseña. No se solicitó ni mostró la contraseña de `sudo`, de MongoDB o de GPG. Se pidió al usuario comprobar en su terminal que MongoDB está ejecutándose y que el contenedor tiene `mongodump`.

**Cambio preparado.** `scripts/backup-mongodb.sh` pide `sudo` en la terminal del usuario; identifica si `backend` y `scraper` están activos, los detiene durante el volcado y procura volver a arrancar únicamente los que estaban activos, también en la salida por error. Si Docker o `sudo` fallan al restaurarlos, hará falta intervención manual. Esto evita escrituras normales de la aplicación durante la copia, a costa de una interrupción temporal del servicio. La documentación de MongoDB advierte que, sin `--oplog`, las escrituras concurrentes impiden garantizar una imagen de un único momento; el MongoDB de Compose es una instancia independiente, no un conjunto de réplicas con oplog: https://www.mongodb.com/docs/database-tools/mongodump/.

El script ejecuta `mongodump --archive --gzip` en el contenedor de MongoDB y canaliza el resultado directamente a `gpg --symmetric --cipher-algo AES256`. La contraseña de MongoDB se lee de la variable existente dentro del contenedor y se entrega a `mongodump` mediante `--config=/dev/stdin`, sin insertarla en los argumentos visibles del proceso. El script exige la contraseña hexadecimal que genera `make setup`; si el despliegue usa otro formato, se detiene sin exponerla. El resultado cifrado se guarda fuera del repositorio, en la carpeta privada. `set -euo pipefail` y un archivo temporal impiden dar por buena una copia parcial; después se prueba el descifrado hacia `/dev/null` y se muestra el hash SHA-256 del archivo cifrado. El usuario deberá guardar de forma recuperable la contraseña elegida para GPG y copiar el archivo cifrado a un almacenamiento independiente, por ejemplo su USB.

**Comprobaciones ejecutadas y límites.** `bash -n scripts/backup-mongodb.sh` y `git diff --check` pasaron. Una llamada con un argumento adicional devolvió el mensaje de uso y el código 2, sin pedir `sudo`. `shellcheck` no está instalado, por lo que no se ejecutó. Una prueba local con contraseña ficticia confirmó que `mongodump` aceptó `--config=/dev/stdin`, pero no llegó a establecer conexión con el puerto ficticio; el proceso de prueba se detuvo sin crear un volcado. No se ha ejecutado el script completo, comprobado una restauración ni creado copia real de MongoDB. Hasta entonces `migrateTotpSecrets.js --apply` sigue pendiente.

**Comprobación del contenedor comunicada por el usuario.** Una captura de su terminal muestra `mongodb` entre los servicios activos de Compose y `mongodump version: 100.18.0` dentro de ese contenedor. Codex comprobó sin imprimir el valor que el `MONGO_PASSWORD` local tiene exactamente 64 caracteres hexadecimales, formato que admite el script. La carpeta privada conserva permisos `0700`, ambos archivos `.env` tienen `0600` y el disco que alberga la carpeta muestra 36 GB disponibles. La sintaxis del script y `git diff --check` siguen correctos. Esta evidencia permite intentar la copia real desde la terminal del usuario; no demuestra todavía que el volcado y su descifrado funcionen.

**Contraseña de la copia comunicada por el usuario.** Se aclaró que GPG necesita una contraseña nueva para abrir el futuro archivo `.gpg`, distinta de la clave 2FA y de la contraseña maestra de KeePass. Se indicó crear una entrada «Contraseña copia MongoDB» en la base KeePass 2 del portátil, guardar la base y actualizar su copia en el USB antes de ejecutar el respaldo. El usuario respondió «guardado». Se consigna como confirmación comunicada; Codex no abrió la base del portátil ni el USB y no conoce ni registró esa contraseña.

**Ejecución y traslado, comunicados y comprobados.** El usuario informó «copia cifrada y comprobada, listo» tras ejecutar `bash scripts/backup-mongodb.sh` en su terminal. Codex encontró un único archivo nuevo `/home/kali/Documents/Seguridad/normativa-mongodb-20261001T200356Z.ezRyWH.gpg`, de 132626 bytes y permisos `0600`, sin archivos `.partial` restantes. Se copió solo ese `.gpg` a `/mnt/hgfs/KaliShare/`, tras comprobar que el destino no existía. `cmp -s` y SHA-256 coincidieron entre ambas copias (`6cd97dab1998bf99c4dddb7fd7f0cae525d5c797d6a550b5995f1b20bb4b6a19`). El montaje compartido muestra permisos `0755`, dato que no permite inferir por sí solo las ACL del anfitrión; el contenido permanece cifrado. No se ha copiado aún al USB ni se ha ensayado una restauración. No se ha ejecutado la migración 2FA ni modificado la base por Codex.

**Disponibilidad tras el respaldo: corrección posterior.** Una petición de solo lectura a `https://localhost/health` y otra a `https://localhost/` devolvieron HTTP 200. Se afirmó erróneamente que la primera comprobaba el backend. Una revisión posterior de `nginx/nginx.conf` y del cuerpo de la respuesta mostró que `/health` se envía al frontend y devuelve HTML. La ruta real del backend a través de Nginx es `/api/health`. Una nueva petición a `https://localhost/api/health` devolvió HTTP 200 con `{"ok":true,"db":"connected"}`. El tiempo de actividad que devolvió no permite atribuir esa respuesta a la imagen nueva; la confirmación de que el usuario ha recreado el contenedor sigue pendiente.

**Copia al USB comunicada por el usuario.** El usuario indicó «Ya está» después de solicitarle que copiara desde `KaliShare` el archivo `.gpg` al USB junto a la versión actualizada de `NormativaCheck.kdbx`. Codex no tiene acceso al USB del portátil, por lo que no puede confirmar de forma independiente su contenido ni la integridad de esa copia. La copia local y la de `KaliShare` sí se compararon byte a byte.

## SEG-011: ensayo de restauración aislada de la copia cifrada

Fecha: 1 de octubre de 2026. Estado: script preparado; ensayo real pendiente.

**Motivo y diseño.** El descifrado GPG hacia `/dev/null` realizado durante el respaldo comprueba la contraseña y la integridad del archivo cifrado, pero no demuestra que MongoDB pueda restaurar el archivo que contiene. `scripts/verify-mongodb-backup.sh` tomará una ruta `.gpg`, usará la misma imagen que el contenedor `cybersec_mongo` y creará otro contenedor con `--network none`, sin puertos publicados, y `/data/db` en `tmpfs`. El contenido descifrado circulará por una tubería hacia `mongorestore --archive --gzip` dentro de ese contenedor temporal. La prueba mostrará únicamente nombres de colecciones y cantidades de documentos e índices, y procurará eliminar el contenedor al terminar. No apunta al MongoDB de la aplicación. Referencias: https://www.mongodb.com/docs/database-tools/mongorestore/ y https://docs.docker.com/engine/storage/tmpfs/.

**Comprobaciones y límites.** `bash -n scripts/verify-mongodb-backup.sh` pasó; la invocación sin ruta devolvió el mensaje de uso y código 2, sin arrancar Docker; `git diff --check` pasó. El `.gpg` local conserva permisos `0600` y mide 132626 bytes. No se ha ejecutado aún el ensayo con datos reales, pues `sudo` y GPG necesitan interacción del usuario en su terminal. La copia del USB no se ha comparado byte a byte desde Kali.

**Resultado del ensayo comunicado con captura.** La terminal del usuario mostró «15 document(s) restored successfully. 0 document(s) failed to restore» y «Restauración aislada completada; se elimina el contenedor temporal». El resumen de la instancia temporal indicó `revokedtokens` 0 documentos/3 índices, `licitaciones` 0/4, `resultados` 2/3, `usuarios` 2/3 y `normativas` 11/2. Son 15 documentos en total. Esto prueba que el archivo local descifrado pudo restaurarse en un MongoDB separado y que sus colecciones e índices quedaron disponibles allí. El script intenta eliminar ese contenedor mediante su `trap`; Codex no pudo verificar después `docker ps` porque el acceso al socket sigue requiriendo `sudo` interactivo. La integridad de la copia del USB sigue sin comprobarse de manera independiente.

## SEG-012: análisis de cuentas antes de cambiar el backend activo

Fecha: 1 de octubre de 2026. Estado: consulta de solo lectura preparada; no ejecutada contra MongoDB.

**Riesgo que se va a medir.** El backend nuevo exige `emailVerifiedAt` para permitir acceso y sesiones. Una cuenta creada antes de la incorporación de ese campo podría carecer de él y quedar bloqueada al reconstruir el backend. La copia restaurada contiene dos documentos en `usuarios`, pero el ensayo de restauración no inspeccionó sus campos de verificación.

**Cambio preparado.** `backend/scripts/scanAuthState.js` usa `countDocuments` para contar cuentas verificadas, pendientes, sin el campo de verificación y con tipos inesperados; también cuenta formatos de secretos 2FA antiguos y cifrados. Solo imprime números agregados. No lee ni muestra direcciones de correo, contraseñas ni secretos. Está pensado para ejecutarse en el contenedor backend actual por su entrada estándar, usando la conexión `MONGODB_URI` ya configurada; no requiere reconstruir la imagen ni escribe en MongoDB.

**Comprobaciones y límites.** `node --check` pasó. Una ejecución local sin `MONGODB_URI` devolvió el error previsto y no intentó acceder a una base. Una inspección del script solo encontró llamadas `countDocuments`, sin operaciones de escritura; `git diff --check` pasó. Aún falta ejecutar la consulta en el contenedor activo y decidir una transición para cuentas antiguas si aparecen.

**Resultado del análisis comunicado con captura.** La ejecución en el contenedor backend activo devolvió `total=2`, `verified=2`, `missingVerificationField=0`, `pendingVerification=0` e `invalidVerificationField=0`. Las dos cuentas existentes tienen fecha de verificación; este bloqueo concreto no requiere una migración de cuentas en esta base. También devolvió `storedTotp=2`, `legacyTotp=2`, `encryptedTotp=0` y `unknownTotpFormat=0`: los dos secretos 2FA persistidos siguen en texto Base32 y necesitan migración después de cargar código capaz de leer el formato cifrado. El resumen contiene solo cantidades. `npm test` volvió a pasar 15/15 y `git diff --check` pasó; el aviso conocido de `res.clearCookie` con `maxAge` sigue apareciendo.

## SEG-013: borrado efectivo de cookies de sesión y 2FA pendiente

Fecha: 1 de octubre de 2026. Estado: corregido y probado localmente; pendiente de reconstrucción y navegador.

**Hallazgo.** `backend/routes/auth.js` entregaba a `res.clearCookie` las mismas opciones que a `res.cookie`, incluida `maxAge`. La documentación oficial de Express 4 indica que `maxAge` y `expires` deben omitirse al borrar; de lo contrario, el navegador puede no eliminar la cookie. Esta advertencia aparecía al ejecutar las pruebas. Referencia: https://expressjs.com/en/4x/api/response/.

**Cambio.** Se extrajeron `httpOnly`, `secure` y `sameSite` a `COOKIE_BASE_OPTIONS`; las opciones de creación añaden su duración con `maxAge`, mientras que las cuatro llamadas de borrado usan solo las opciones base. No se cambiaron nombres, duración ni atributos de seguridad de las cookies al crearlas.

**Prueba ejecutada.** La prueba de rutas ahora inspecciona `Set-Cookie` tras verificar 2FA y tras cerrar sesión. Comprueba que cada cookie enviada para borrar contiene `Expires` y no contiene `Max-Age`. `npm test` pasó 15/15 sin el aviso anterior; `node --check` y `git diff --check` pasaron. La prueba usa un servidor Express real y datos de usuario simulados, pero no un navegador ni el backend reconstruido.

## SEG-014: análisis 2FA con la imagen nueva sin sustituir el backend activo

Fecha: 1 de octubre de 2026. Estado: comando preparado; ejecución y resultado pendientes.

**Preparación.** La copia cifrada de MongoDB se abrió y restauró en un contenedor aislado; el análisis del backend actual encontró dos secretos 2FA antiguos, cero cifrados y cero de formato desconocido. Antes de reconstruir para la prueba se comprobó que `backend/.dockerignore` excluye `.env`, por lo que el `COPY . .` de `backend/Dockerfile` no debe incorporar ese archivo de claves a la imagen. Esta conclusión se basa en la lectura de los archivos; todavía no se ha inspeccionado la imagen resultante.

**Comando propuesto al usuario.** `sudo docker compose run --rm --no-deps --build backend node scripts/migrateTotpSecrets.js --dry-run` construye una imagen con el código local y ejecuta un contenedor de una sola vez, sin reemplazar el servicio backend activo. `--dry-run` analiza y valida los secretos sin modificarlos; el resultado esperado a partir de la consulta previa es `encrypted=0`, `legacy=2`, `invalid=0`. La documentación de Docker describe `compose run` como ejecución en contenedor nuevo: https://docs.docker.com/reference/cli/docker/compose/run/. No se ha ejecutado aún este comando ni `--apply`.

**Resultado comunicado con captura.** El usuario ejecutó el comando anterior. La salida mostró la construcción de la imagen del backend y el JSON `{"encrypted":0,"legacy":2,"invalid":0}`. El análisis de la imagen nueva pudo clasificar ambos secretos antiguos sin encontrar valores inválidos; `--dry-run` no escribió datos. El servicio backend activo aún no se ha reemplazado y `--apply` sigue pendiente.

## SEG-015: despliegue local del backend capaz de leer ambos formatos 2FA

Fecha: 1 de octubre de 2026. Estado: preparado; ejecución pendiente.

**Razón del orden.** La base contiene dos secretos 2FA en formato antiguo. El backend actual no sabe leer secretos cifrados. El nuevo `readTotpSecret` sí sabe descifrar los valores `v1:` y, durante la transición, aceptar los antiguos Base32. Por eso debe estar activo y saludable antes de ejecutar la migración que cambia los datos. Las dos cuentas tienen `emailVerifiedAt` válido, así que el bloqueo de acceso por correo no debería afectarles por falta del campo.

**Paso propuesto.** `sudo docker compose up -d --no-deps --force-recreate --wait backend` reemplazará únicamente el contenedor backend con la imagen ya construida, mantendrá MongoDB y los demás servicios en ejecución y esperará a que el backend pase su comprobación de salud. `backend/server.js` responde correctamente en `/health` solo si Mongoose está conectado a MongoDB. `--force-recreate` evita conservar por accidente el contenedor anterior; `-d` deja el servicio en segundo plano. La documentación de Docker confirma que `up` recrea el servicio cuando cambia la imagen y conserva los volúmenes montados: https://docs.docker.com/reference/cli/docker/compose/up/. No se ha ejecutado aún el paso ni `--apply`.

**Despliegue comunicado y comprobación externa.** El usuario mostró la salida «Container cybersec_backend Healthy» tras ejecutar el comando. Codex solicitó `https://localhost/api/health`: respondió HTTP 200 con `ok=true`, `db=connected` y un tiempo de actividad de 33 segundos. El tiempo breve, junto con la salida de Compose, respalda que el backend fue recreado y conectado a MongoDB. `git diff --check` pasó. Todavía falta comprobar manualmente un acceso 2FA con un secreto antiguo y ejecutar la migración; la salud del servicio no demuestra por sí sola que ese flujo funcione.

**Acceso manual previo a la migración.** Tras pedirle cerrar sesión y volver a entrar con contraseña y código de Google Authenticator, el usuario respondió «Perfectamente. Funciona. No hay errores a la vista». Se registra como prueba manual comunicada por el usuario del flujo con el backend nuevo y un secreto antiguo. Codex no conoce ni recibió la contraseña o el código, ni observó el navegador directamente. Los dos valores persistidos siguen en formato antiguo hasta ejecutar `--apply`.

## SEG-016: migración aplicada a los secretos 2FA de la base local

Fecha: 1 de octubre de 2026. Estado: aplicada y acceso posterior comprobado manualmente.

**Ejecución comunicada con captura.** El usuario ejecutó `sudo docker compose exec -T backend node scripts/migrateTotpSecrets.js --apply`. El script informó `before={encrypted:0, legacy:2, invalid:0}`, `migrated=2`, `changedConcurrently=0` y `after={encrypted:2, legacy:0, invalid:0}`. La segunda lectura de `scanUsers` no solo contó el prefijo `v1:`, sino que intentó descifrar cada secreto con la clave configurada y el identificador de la cuenta; de no poder hacerlo, habría sumado `invalid`. Por tanto, el resultado respalda que ambos valores cifrados son recuperables por el backend actual. Codex no recibió ni mostró los secretos en texto o la clave.

**Comprobación externa y límites.** `https://localhost/api/health` respondió HTTP 200 con `ok=true` y `db=connected` después de la migración. `git diff --check` pasó. Todavía falta que el usuario cierre sesión y vuelva a entrar con Google Authenticator para verificar el flujo completo después del cambio de datos. La copia cifrada de MongoDB se creó antes de la migración; si alguna vez se restaura, contendrá los secretos antiguos y requerirá repetir la transición o mantener un lector compatible.

**Acceso manual posterior a la migración.** El usuario comunicó que cerró sesión, introdujo su correo y contraseña, utilizó un código nuevo de la misma entrada de Google Authenticator y pudo iniciar sesión sin problemas visibles. Esto comprueba manualmente, en su navegador y con su cuenta, que el backend nuevo descifra el secreto persistido y verifica un código TOTP después de migrar. Codex no vio ni solicitó la contraseña ni el código. La prueba no sustituye la revisión de los demás flujos de autenticación ni una inspección directa del USB.

## SEG-017: retirada de la lectura temporal de secretos 2FA en texto

Fecha: 1 de octubre de 2026. Estado: cambio desplegado y acceso 2FA comprobado manualmente.

**Motivo.** El script de migración informó `legacy=0` y `encrypted=2`; el usuario confirmó un acceso real con la misma entrada de Google Authenticator tras cifrar. Ya no se necesita que las rutas normales acepten secretos Base32 sin cifrar. Mantener esa ruta facilitaría que datos antiguos en texto reaparecieran sin detectarse como un error de operación.

**Cambio.** `readTotpSecret` delega ahora directamente en `decryptTotpSecret` y rechaza valores sin el formato cifrado `v1:` o que no superen su autenticación. `isLegacyTotpSecret` permanece disponible únicamente para el script de migración, necesario si se restaura la copia de MongoDB anterior a la transición. En tal restauración, se deberá ejecutar la migración antes de permitir inicios de sesión 2FA con el backend actualizado.

**Pruebas ejecutadas antes del despliegue.** Se adaptaron las pruebas para confirmar que un secreto antiguo se reconoce para migración, pero se rechaza durante el acceso y no genera una cookie de sesión. `npm test`: 15/15 superadas. `node --check` en el módulo y las pruebas y `git diff --check`: correctos. Esta prueba usa datos simulados para la ruta; en ese momento faltaba reconstruir el backend y repetir una prueba manual.

**Despliegue del lector estricto.** El usuario ejecutó `sudo docker compose up -d --no-deps --build --force-recreate --wait backend` y confirmó que el contenedor terminó en estado `Healthy`. Codex comprobó desde fuera del contenedor `https://localhost/api/health`: HTTP 200, `ok=true`, `db=connected` y tiempo de actividad de 84 segundos. `git diff --check` pasó.

**Acceso manual posterior al despliegue.** Tras reconstruir el backend con el lector estricto, el usuario confirmó que cerró sesión, volvió a entrar y utilizó sin problema un código nuevo de Google Authenticator. Es una prueba manual de ese recorrido con su cuenta; Codex no observó el código ni la contraseña. No equivale a probar todas las cuentas o todos los flujos de identidad.

## SEG-010: permisos de los archivos de configuración local

Fecha: 1 de octubre de 2026. Estado: corregido en el equipo y en `Makefile` para nuevas ejecuciones.

**Hallazgo.** El `.env` raíz, que contiene la contraseña de MongoDB, tenía permisos `0664`; un usuario del mismo grupo podía leerlo. `backend/.env` ya tenía permisos `0600` y está excluido de Git.

**Cambio.** `make setup` aplica `chmod 600 .env`, incluso si el archivo ya existía. La regla que copia `backend/.env.example` a `backend/.env` también aplica `chmod 600` inmediatamente después de la copia. Se corrigió el permiso del `.env` raíz existente con `chmod 600 .env`, sin leer ni mostrar su contenido.

**Comprobación ejecutada.** `stat` confirmó `600` para ambos archivos locales. `make -n setup` mostró los cambios de permisos previstos sin ejecutar la generación de contraseñas; `git diff --check` pasó. No se han cambiado los valores de configuración ni reiniciado servicios.

## SEG-018: comprobación de claves antes de `make up`

Fecha: 1 de octubre de 2026. Estado: cambio probado y registrado en `e2cb8e5d`.

**Hallazgo.** En una copia nueva, `make up` crea `backend/.env` desde el ejemplo, con `JWT_SECRET` y `TOTP_ENCRYPTION_KEY` vacías. `initSecrets.js` impide correctamente que el backend arranque, pero la espera de salud de `make up` puede continuar mientras el servicio se reinicia. Tampoco conviene generar automáticamente una clave 2FA nueva para una base existente: los secretos cifrados con la anterior quedarían ilegibles.

**Cambio.** Antes de iniciar Docker, `Makefile` ejecuta `scripts/check-backend-secrets.js backend/.env`. El script exige exactamente una asignación de cada clave, coloca esos valores solo en su propio proceso y llama al mismo `backend/utils/initSecrets.js` que utiliza el servidor. La salida informa del resultado sin imprimir valores. El archivo local y las copias de KeePass/USB no se modificaron.

**Pruebas ejecutadas.** Cinco casos con archivos temporales: claves válidas aceptadas; claves vacías, iguales, duplicadas y clave 2FA mal formada rechazadas. Una ejecución de `make up` en una copia temporal aislada, con ambas claves vacías, terminó con error antes de construir o iniciar contenedores. `make -n up` mostró el verificador antes de `docker compose up`; este comando muestra las acciones sin ejecutarlas. El `backend/.env` local superó la comprobación sin revelar valores. `node --check` y `git diff --check` pasaron. No se ejecutó `make up` en el proyecto real ni se sustituyó la aplicación en marcha para esta prueba.

## SEG-019: fragmentos en los enlaces de verificación y recuperación

Fecha: 1 de octubre de 2026. Estado: cambio desplegado y lectura de fragmentos comprobada manualmente.

**Hallazgo.** Los enlaces enviados por correo incluían `?token=`. La solicitud inicial de la página puede quedar en el registro de acceso de Nginx, cuyo formato predeterminado incluye la petición y `Referer`. La política `strict-origin-when-cross-origin` configurada puede transmitir ruta y consulta en solicitudes al mismo origen. Borrar el token de la barra mediante React ocurre después de que el navegador haya solicitado la página y sus recursos. Referencias: https://nginx.org/en/docs/http/ngx_http_log_module.html y https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy.

**Cambio.** Los enlaces nuevos de confirmación, reenvío y recuperación emplean `#token=`. El fragmento se procesa en el navegador y se separa antes de solicitar el recurso, conforme a RFC 3986 (https://www.rfc-editor.org/rfc/rfc3986.html). Las dos páginas React leen primero el fragmento y aceptan temporalmente `?token=` para enlaces ya enviados. Siguen retirando el token de la barra al cargar. El token aún llega al backend mediante el cuerpo de `POST`, donde se valida. Esta modificación no hace seguros por sí sola los enlaces antiguos que contienen la consulta; queda por revisar la configuración de registros y referencias.

**Pruebas ejecutadas antes del despliegue y límite.** `npm test` en backend: 15/15 correctas, con comprobación de la forma del enlace de registro y del enlace de recuperación. `CI=true npm run build` en frontend: compilación correcta; aparecieron avisos de Browserslist desactualizado y deprecación de `fs.F_OK`. `node --check` en la ruta y `git diff --check`: correctos. En ese momento faltaba reconstruir los contenedores y probar la página en un navegador.

**Despliegue comunicado y comprobación externa.** El usuario ejecutó `sudo docker compose up -d --no-deps --build --force-recreate --wait backend frontend` y después `sudo docker compose restart nginx`; indicó que ambas órdenes terminaron bien. Codex comprobó `https://localhost/api/health`: HTTP 200, `ok=true`, `db=connected`, tiempo de actividad 56 segundos. El HTML de la web sirvió `static/js/main.1fde6450.js`; el archivo contiene dos lecturas de `.hash.slice(1)`, coherentes con las páginas de verificación y recuperación actualizadas. Esta inspección del paquete no demuestra por sí sola que un usuario complete ambos recorridos.

**Prueba manual con token ficticio.** El usuario abrió `https://localhost/verify-email#token=PRUEBA_NO_VALIDA` y aportó una captura: la página muestra que el enlace es inválido, ha caducado o ya se utilizó; la barra queda en `https://localhost/verify-email`, sin fragmento. Esto confirma en su navegador que la página lee el fragmento y lo retira de la URL. El error es el resultado esperado para ese token ficticio; no prueba el uso de un enlace real enviado por correo. La captura muestra además «Not secure» en el navegador, un asunto de confianza del certificado TLS local que se revisará por separado.

## SEG-020: registros de Nginx y política de referencias sin tokens

Fecha: 1 de octubre de 2026. Estado: configuración desplegada y cabecera comprobada externamente.

**Motivo.** Durante su plazo de validez pueden circular enlaces anteriores con `?token=`. El formato predeterminado `combined` de Nginx incluye la petición completa y el encabezado `Referer`; la cabecera actual `strict-origin-when-cross-origin` permite enviar ruta y consulta en solicitudes al mismo origen. Además, cualquier URL arbitraria con consultas sensibles podría quedar en el registro. Referencias: https://nginx.org/en/docs/http/ngx_http_log_module.html y https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy.

**Cambio.** `nginx/nginx.conf` define `safe_access` con IP, hora, método, ruta sin consulta, protocolo, estado y tamaño de respuesta, omitiendo `$request`, `$args`, `$request_uri` y `$http_referer`. Se aplica ese formato al registro de acceso y la cabecera `Referrer-Policy` pasa a `no-referrer`. Se conserva información suficiente para diagnosticar rutas y códigos HTTP sin registrar parámetros de URL en el acceso de Nginx. Esta configuración no controla los registros de otros procesos o servidores de correo.

**Prueba ejecutada antes del despliegue.** El primer `nginx -t` local informó que la sintaxis era correcta, pero falló al intentar crear `/var/lib/nginx/body` sin permisos; esto pertenece al Nginx instalado en Kali, no a la configuración Docker. Con las rutas de certificados, servicios y directorios temporales adaptadas en una copia de prueba, `nginx -t` pasó. Un Nginx temporal recibió `GET /verify-email?token=TOKEN_FICTICIO_PRUEBA`: devolvió `Referrer-Policy: no-referrer` y su registro contenía `GET /verify-email HTTP/1.1` sin el token ni `token=`. La respuesta HTTP fue 502 porque el upstream de prueba no estaba arrancado; la prueba verifica la cabecera y el formato de registro, no el funcionamiento de la web. `git diff --check` pasó. En ese momento faltaba reiniciar Nginx real para que adoptase la cabecera nueva.

**Despliegue comunicado y comprobación externa.** El usuario reinició Nginx después de reconstruir backend y frontend. `https://localhost/verify-email` respondió HTTP 200 con `Content-Type: text/html` y `Referrer-Policy: no-referrer`. `git diff --check` pasó. Codex no leyó los registros internos del contenedor real; el formato de acceso sin consulta se comprobó con la misma configuración en un Nginx temporal.

## SEG-021: confianza del certificado HTTPS local

Fecha: 1 de octubre de 2026. Estado: hallazgo registrado; corrección fuera de esta unidad de tokens.

**Evidencia.** En la captura de la prueba de verificación con token ficticio, el navegador muestra «Not secure» junto a `https://localhost`. `openssl x509` identificó un certificado cuyo emisor y sujeto son ambos `localhost` de la organización local CyberAudit, válido entre el 24 de septiembre de 2026 y el 24 de septiembre de 2027. Una petición `curl` sin `-k` falló con código 60 y «self-signed certificate». Las comprobaciones HTTPS anteriores utilizaron `-k`, que omite la comprobación de confianza; por eso no demostraban que el navegador confiase en el certificado.

**Alcance y siguiente trabajo.** El certificado local permite establecer HTTPS, pero el navegador no puede verificar su identidad con una autoridad de confianza instalada. Se revisará la generación y la confianza del certificado para la demostración local; un despliegue público requerirá un certificado apropiado para su dominio. Este hallazgo no cambia el resultado de las pruebas de fragmentos o del backend y no se considera resuelto.

## Cierre local del bloque de identidad y protección de tokens

Fecha: 1 de octubre de 2026. Estado: cambios comprometidos localmente; sin `push`.

**Commits preparados con Conventional Commits 1.0.0.** `e2cb8e5d` (`feat(auth)!`) reúne verificación de correo, recuperación de contraseña, sesiones, cifrado y migración 2FA, pantallas, claves y pruebas; el marcador `!` y el pie `BREAKING CHANGE` describen los requisitos de configuración y transición. `a445542b` (`feat(ops)`) añade el respaldo cifrado y el ensayo de restauración. `0e79e921` (`fix(proxy)`) protege el registro de acceso de Nginx y limita a `127.0.0.1` los puertos publicados por Compose. Referencia de formato: https://www.conventionalcommits.org/es/v1.0.0/.

**Límite de la validación.** En la aplicación local se comprobaron la salud de la API, el acceso 2FA tras migrar y retirar el lector antiguo, la nueva cabecera de Nginx y la lectura del fragmento con un token ficticio. La prueba del token ficticio no sustituye abrir un enlace real nuevo de verificación o recuperación. El USB del portátil y los registros internos del Nginx real no fueron inspeccionados directamente por Codex.

**Pendientes para el trabajo siguiente.** La captura mostró un certificado HTTPS local autofirmado no confiable para el navegador (SEG-021). También siguen abiertos para una auditoría de producto los límites de intentos en memoria, los permisos del proceso del contenedor y la revisión de dependencias y cabeceras generales, enumerados antes en este registro. Ninguno de estos puntos se presenta como resuelto ni como prueba de seguridad absoluta del producto.

## SEG-022: cabeceras de seguridad y CSP del frontend

Fecha: 4 de octubre de 2026. Estado: cambiado y comprobado con Nginx y Chromium locales; pendiente de comprobar en Docker.

**Evidencia.** `nginx/nginx.conf` enviaba HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`, pero ninguna `Content-Security-Policy`. El backend tenía Helmet con HSTS, `frameguard`, `noSniff`, `referrerPolicy` y CSP desactivados. Para que una CSP estricta no rompiera la aplicación se revisó el frontend: el `index.html` compilado no contiene `<script>` en línea; la API es del mismo origen (`/api`); las imágenes son ficheros; los QR del 2FA son `data:`; `App.css` importa Google Fonts, y `components/useJoseEE.jsx` insertaba un `<style>` en línea que además redefinía la animación global `fadeIn` de `App.css`.

**Cambio.** Nginx añade, a nivel de `server`, `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`, sin `unsafe-inline` ni `unsafe-eval`. Ningún `location` define `add_header` (si lo hiciera dejaría de heredar todas las cabeceras del servidor). En `/api/` se ocultan con `proxy_hide_header` las cabeceras que también envía el backend, para que cada una salga una vez. Helmet vuelve a estar activo en `backend/app.js` con los mismos valores que Nginx y una CSP de API `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. Las animaciones del easter egg pasan a `App.css` como `ee-fade-in` y `ee-floating`. `frontend/Dockerfile` fija `INLINE_RUNTIME_CHUNK=false`.

**Prueba.** Con la configuración del proyecto (cambiando solo puertos, rutas de certificados y direcciones de los servicios; `nginx -t` correcto) delante del backend real y del build real: en `/`, `/auth`, `/historial`, un fichero estático, `/api/`, `/api/health`, `/api/normativas` y `/.well-known/security.txt` cada cabecera aparece exactamente una vez y no hay `X-Powered-By`; en la API hay dos CSP (la de la API y la del sitio), que el navegador aplica a la vez. En Chromium 149 headless, `/`, `/auth`, `/cuestionario/lssi_ce` y `/settings` cargaron su contenido sin ninguna violación de CSP; un `<script>` en línea de prueba fue bloqueado (prueba de que la CSP se aplica) y una imagen `data:` cargó. Firefox 140 ESR, sobre una copia HTTP del bloque `server` (mismas cabeceras y CSP salvo `upgrade-insecure-requests`, que no bloquea nada), tampoco registró ninguna violación en `/`, `/auth`, `/cuestionario/lssi_ce`, `/forgot-password` ni `/settings`; un control con un `<script>` en línea y una imagen externa fue bloqueado y notificado en ambos navegadores. `backend/tests/seguridad.test.js` comprueba las cabeceras de la API y que la configuración no retroceda (CSP sin `unsafe-*`, `add_header` solo en `server`, `INLINE_RUNTIME_CHUNK=false`, sin `<style>` ni `dangerouslySetInnerHTML` en `frontend/src`).

## SEG-023: comprobación de origen en peticiones que cambian datos (CSRF)

Fecha: 4 de octubre de 2026. Estado: cambiado y comprobado con Chromium y Firefox locales.

**Motivo.** Las cookies `SameSite=Strict` son la defensa principal; la comprobación de origen es una segunda capa. Con `Referrer-Policy: no-referrer`, la especificación Fetch permite que un `POST` del mismo origen lleve `Origin: null`, así que exigir sin más que `Origin` coincida podría bloquear la propia aplicación. Se midió: Chromium 149 y Firefox envían el origen real en un `POST` del mismo origen (con `fetch` y con XHR) bajo `no-referrer`.

**Cambio.** `backend/middleware/origen.js`, aplicado a `POST`, `PUT`, `PATCH` y `DELETE`: si llega un `Origin` real debe ser `CORS_ORIGIN`; si no llega o vale `null`, se exige `X-Requested-With: XMLHttpRequest`, que otra web no puede añadir sin una petición previa CORS. Si no, `403 ORIGEN_NO_PERMITIDO`. El cliente `axios` del frontend envía siempre esa cabecera.

**Prueba.** A través de Nginx, con sesión válida: origen ajeno, origen ajeno con la cabecera, origen parecido (`https://localhost:8443.evil.example`), mismo host por `http`, `Origin: null` sin cabecera y formulario sin `Origin` dieron 403; el origen propio y `null` con cabecera, 200; los `GET` no se bloquean. En Chromium, una página de otro origen lanzó contra una sesión iniciada un formulario `POST` a `/api/auth/logout` y un `fetch` con credenciales a `/api/resultado`: el registro del backend muestra ambas peticiones **sin cookie** (SameSite) **y con 403** (comprobación de origen). Las peticiones del propio frontend (inicio de sesión, `GET /api/me`, `POST /resultado`, cierre de sesión) funcionaron. Las cookies llegan al navegador a través de Nginx sin cambios: `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`. Cubierto por 12 pruebas en `backend/tests/seguridad.test.js`.

## SEG-024: rol de administrador en `POST /licitaciones/sync`

Fecha: 4 de octubre de 2026. Estado: cambiado y probado.

**Evidencia.** Cualquier usuario con sesión podía lanzar una sincronización del scraper.

**Cambio.** `Usuario.rol` (`usuario` por defecto, o `admin`), que ninguna ruta modifica: el registro y `PUT /me/organizacion` solo copian campos concretos. `requireAdmin` lee el rol de MongoDB en cada petición, no del JWT, para que retirarlo surta efecto al momento; si la lectura falla responde 503. `POST /licitaciones/sync` exige `requireAuth` y `requireAdmin`. El rol se asigna directamente en la base de datos (ver README).

**Prueba.** Sin sesión 401, usuario normal 403, JWT con `rol: "admin"` y usuario normal en la BD 403, administrador 202 con los parámetros validados, fallo de BD 503; en ninguno de los casos rechazados se llama al scraper. El registro y la actualización del perfil ignoran `rol` y `$set` enviados por el cliente.

## SEG-025: operadores y expresiones regulares del cliente en `GET /licitaciones`

Fecha: 4 de octubre de 2026. Estado: cambiado y probado. Hallazgo nuevo de esta revisión.

**Evidencia.** El listado público pasaba `req.query.estado` a MongoDB sin comprobar su tipo (Express convierte `?estado[$ne]=x` en un objeto, inyectando un operador) y `req.query.q` a `$regex` sin escapar (expresiones costosas como `(a+)+$` y consultas arbitrarias).

**Cambio.** Solo se aceptan textos (recortados a 100 caracteres) y enteros de hasta 4 cifras; la búsqueda se escapa para que sea literal.

**Prueba.** `?estado[$ne]=x&anio[$gt]=1&q[$regex]=.*` produce un filtro vacío; `q=(a+)+$` llega escapado y solo coincide con ese texto literal; la longitud y los enteros se limitan. Con el código anterior estas pruebas fallan.

## SEG-026: redirección tras iniciar sesión

Fecha: 4 de octubre de 2026. Estado: defensa añadida y comprobada en Chromium.

**Motivo.** `react-router` < 7.18 tiene un aviso de redirección abierta con barras invertidas en `<Link>`/`useNavigate`. El único destino de navegación que no es fijo es `from` en `Auth.jsx`, que viene de la ruta protegida que se intentaba abrir.

**Prueba antes del cambio.** Con sesión iniciada y `from` de atacante (`//host`, `/\host`, `/\\host`, `/%5C%5Chost`) el navegador no salió del sitio: el servidor atacante no recibió ninguna visita, mientras el control `from=/settings` sí llegó a Ajustes.

**Cambio.** `Auth.jsx` solo usa `from` si es una ruta interna (empieza por una sola `/`, sin `//` ni barras invertidas); si no, va a `/`. Repetida la prueba con el build nuevo: los destinos de atacante acaban en la página de inicio y el servidor atacante no recibe visitas.

## SEG-027: análisis de dependencias (SCA)

Fecha: 4 de octubre de 2026. Estado: dependencias de ejecución sin avisos conocidos; quedan avisos en herramientas de compilación.

**Backend.** `npm audit` informaba de 8 avisos. Corregidos: `mongoose` 8.24.4 (contaminación de prototipo), `body-parser` 1.20.8, `express` 4.22.3, que pasa a `qs` ~6.16.0 (denegación de servicio en el analizador de consultas, alcanzable de forma remota) y `nodemailer` 10.0.14 (versión mayor: analizador de direcciones con coste cuadrático, lecturas de ficheros y validación de dominios). Se comprobó el envío real con `nodemailer` 10 contra un servidor SMTP local: autenticación, remitente, destinatario, asunto UTF-8 y mensaje texto + HTML con el enlace de recuperación. `npm audit --omit=dev`: 0 avisos. Queda `braces` a través de `nodemon` (solo desarrollo). `backend/Dockerfile` usa `npm ci --omit=dev`: versiones exactas del lockfile y sin `nodemon` ni `supertest` en la imagen; la aplicación carga con esa instalación.

**Frontend.** De 91 avisos, se actualizaron dentro de los rangos `axios` 1.20.0 y `react-router-dom` 6.30.6 (`@remix-run/router` 1.23.4). Recorriendo el árbol de dependencias de ejecución (`axios`, `react`, `react-dom`, `react-router-dom`), solo quedan 2 avisos de `react-router` que llegan al navegador: hidratación SSR (no aplica: la aplicación no usa SSR) y la redirección con barras invertidas (ver SEG-026). Los otros 71 están en `react-scripts` (Jest, webpack, Babel, SVGO…), que solo se ejecuta al compilar y no forma parte del paquete servido. `react-scripts` no tiene versión corregida; eliminarlos exige migrar a otra herramienta de compilación (fuera del alcance de la Práctica 3).

**Scraper.** `pip-audit` 2.10.1 encontró dos avisos en `requests==2.32.3`: fuga de credenciales `.netrc` con URL manipuladas (corregido en 2.32.4) y fichero temporal predecible en `extract_zipped_paths()` (2.33.0). `scraper/requirements.txt` pasa a `requests==2.34.2`; `pip-audit` ya no encuentra avisos y `descargar_zip_mes()` descargó y guardó un ZIP válido con esa versión. `pymongo==4.10.1` no tiene avisos.

## SEG-028: certificados TLS en el historial de Git

Fecha: 4 de octubre de 2026. Estado: no se encontró ninguna filtración.

**Comprobación.** Se buscaron ficheros `.pem`, `.key`, `.crt`, `.p12`, `.pfx` y `.env` añadidos alguna vez, y contenido `PRIVATE KEY` o `BEGIN CERTIFICATE` en todos los commits de las ramas remotas `main`, `backend`, `frontend` y `practica3` y en el stash local. Ningún certificado ni clave del proyecto aparece en el historial: `nginx/certs/` nunca se ha confirmado. Las únicas coincidencias son documentación y datos de prueba de paquetes npm de terceros (`dotenv`, `mongodb`, `spdy`, `selfsigned`) de cuando `node_modules` se versionó por error, retirados en `1702e9df`.

**Límite.** La búsqueda cubre lo que hay en este clon y en las ramas remotas actuales; no puede ver commits eliminados con `push --force` que GitHub conserve sin rama. Si existe otra copia donde se viera el certificado, basta con regenerarlo con `make recert`: es un certificado autofirmado de `localhost` (SEG-021).

## SEG-029: certificado autofirmado de `make cert` sin `subjectAltName`

Fecha: 4 de octubre de 2026. Estado: corregido y comprobado con `make`.

**Evidencia.** Sin mkcert, `make cert` generaba un certificado con solo `CN=localhost` y sin extensión `subjectAltName`. Los navegadores actuales ignoran el CN para validar el nombre del servidor, así que ese certificado no puede validarse para `localhost` ni siquiera si el usuario lo añade como de confianza; es parte de lo observado en SEG-021. Se reprodujo con Firefox: con el certificado del arnés sin SAN marcado como de confianza en el perfil, no llegaba ninguna petición a Nginx.

**Cambio.** El comando `openssl` del `Makefile` añade `-addext 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1'`.

**Prueba.** `make cert` ejecutado con un `PATH` sin mkcert produce un certificado con `DNS:localhost, IP:127.0.0.1, IP:::1` y la clave con permisos `600`. Con mkcert instalado el `Makefile` sigue usando mkcert, que ya incluía SAN.

## SEG-030: respuesta de la API con MongoDB caído

Fecha: 4 de octubre de 2026. Estado: corregido y comprobado con MongoDB real.

**Evidencia.** Con una sesión iniciada se detuvo un MongoDB 7.0.14 real: `GET /health` respondió 503 al momento, pero `GET /me` y `POST /resultado` tardaron **30 s** en responder 503 (el tiempo de selección de servidor por defecto del controlador, igual que el `proxy_read_timeout` de Nginx, así que cualquier retraso adicional se convertiría en un 504). `POST /resultado` sin sesión respondía **500** «Error interno».

**Cambio.** `server.js` conecta con `serverSelectionTimeoutMS: 5000`. `utils/bd.js` reconoce los errores de «base de datos no disponible» y `POST /resultado` responde 503 con ellos; un fallo de código sigue siendo 500.

**Prueba.** Repetida la caída con el código nuevo: `GET /me`, `POST /resultado` con sesión y sin ella responden **503 en 5,0 s**; `GET /health`, 503 al momento. Prueba automática para los tres tipos de error y para el 500 de un fallo de código, sin crear ningún `Resultado`.

## SEG-031: scraper no disponible en `POST /licitaciones/sync`

Fecha: 4 de octubre de 2026. Estado: corregido y probado.

**Evidencia.** La ruta solo respondía «Scraper no disponible» (503) si el error era exactamente `ECONNREFUSED`. Con el contenedor del scraper parado, el DNS de Docker no resuelve `scraper` y Node informa `ENOTFOUND`; además, una conexión rechazada puede llegar envuelta sin `code`. En ambos casos respondía 500 «Error al iniciar sync».

**Cambio.** Cualquier fallo de red de `fetch` (`TypeError`) o el tiempo de espera se responde con 503; una respuesta del scraper que no es JSON sigue siendo 500.

## Verificación local de las tareas 2 a 13 con MongoDB real

Fecha: 4 de octubre de 2026. Estado: superada en local; pendiente de repetir en Docker.

**Entorno.** Sin acceso al demonio Docker, se ejecutó en local la misma arquitectura: MongoDB 7.0.14 real, `server.js` real (comprobación de claves y conexión antes de escuchar), el build real del frontend, la configuración Nginx del proyecto (solo cambian puertos, rutas de certificados y direcciones de los servicios) y un servidor SMTP local que guarda los correos. `docker compose config` valida `docker-compose.yml` (puertos publicados en `127.0.0.1`).

**Seed (tarea 2).** El validador acepta los 11 JSON; el primer seed inserta 11 normativas y el segundo se niega con código de salida 1 sin modificar nada. Tras reiniciar el backend, los usuarios, resultados y normativas siguen en la base de datos.

**Prueba de extremo a extremo (47 comprobaciones, todas superadas, a través de Nginx y con consultas directas a MongoDB).** Registro con correo de verificación de un solo uso y token guardado como hash; inicio de sesión bloqueado sin verificar; cookies `HttpOnly; Secure; SameSite=Strict`; aplicabilidad con perfil vacío y completo; el cuerpo de `PUT /me/organizacion` no cambia el rol; cuestionario incompleto o con `null` → 400 sin crear `Resultado`; cuestionario completo → índice por bloques 26 y nivel Crítico, con versión, valor exacto, nivel, cuestionario, remediaciones y cobertura guardados y sin puntos brutos; historial, detalle y PDS no cambian al modificar el catálogo; 2FA con secreto pendiente cifrado, activación, inicio de sesión en dos pasos, rechazo del token pendiente como sesión y, con el índice único real de MongoDB, dos verificaciones simultáneas → 200 y 401; recuperación de contraseña con enlace de un solo uso que invalida la sesión anterior y guarda la contraseña con bcrypt; `sync` 403 para un usuario, autorizado para un administrador y 403 de nuevo al retirar el rol en la BD con la misma sesión; `GET /licitaciones` con operadores y regex del cliente → 200; `POST` desde otro origen → 403 sin cerrar la sesión.

**Límites.** No se ha ejecutado con Docker (imágenes, red entre contenedores, `make up`), ni el scraper real contra PLACSP, ni un navegador con interacción de usuario completa (los navegadores cargaron las páginas reales; los flujos se ejecutaron por HTTP como los haría el frontend).

## Verificación en Docker (instalación desde cero)

Fecha: 4 de octubre de 2026. Estado: superada; quedan tres observaciones abiertas.

**Instalación.** En este clon no había `.env`, `backend/.env` ni certificado. Siguiendo el README: `pip install` (ya presente), `backend/.env` desde `.env.example` con permisos `600` y las dos claves generadas con el comando documentado (`check-backend-secrets.js` las acepta), `make up` (código de salida 0: genera `MONGO_PASSWORD`, certificado de confianza con mkcert, construye las imágenes y espera a MongoDB y al backend sanos) y `make seed`. Compose usa sus propios volúmenes `newnormativa_*`; los volúmenes `normativa-cyberseguridad_*` de otro clon no se tocaron.

**Imagen del backend.** Sin `nodemon` ni `supertest`; `express` 4.22.3 y `nodemailer` 10.0.14. `make up` no siembra (0 normativas); el primer `make seed` inserta 11 y el segundo se niega con error sin modificar nada.

**Nginx real.** `curl` sin `-k` confía en el certificado (resultado de verificación 0) y Chromium 149 sin `--ignore-certificate-errors` no da errores de certificado: con mkcert, lo observado en SEG-021 queda resuelto en esta máquina. Cada cabecera de seguridad aparece una vez en páginas, recursos, API y `security.txt` (dos CSP en la API, como en SEG-022); HTTP redirige a HTTPS; `index.html` sin scripts en línea; el build de Docker produce el mismo `main.71b6c148.js` que el build local. Chromium cargó `/`, `/auth`, `/cuestionario/lssi_ce` y `/forgot-password` con datos de MongoDB y sin violaciones de CSP.

**Extremo a extremo.** Las 47 comprobaciones de la verificación local, contra `https://localhost` y la base de datos del contenedor, con un SMTP de prueba temporal en la red de Compose: todas superadas. Con el contenedor del scraper parado, `POST /licitaciones/sync` como administrador responde 503 (SEG-031 con el DNS real de Docker).

**Persistencia y caída de MongoDB.** Tras `make down` y `make up` siguen el usuario, el resultado (versión 2, 26 %, Crítico), las 11 normativas y los tokens revocados; `make up` no regenera `.env` ni siembra. Con el contenedor de MongoDB parado, `POST /resultado` responde 503 en 5,0 s (SEG-030); al arrancarlo de nuevo el backend se reconecta solo y `/health` vuelve a 200 en 2 s; el usuario inicia sesión con la contraseña cambiada antes del reinicio. El SMTP de prueba se retiró y `backend/.env` volvió a los valores del README.

**Observaciones abiertas.**
- El proceso del backend se ejecuta como `root` dentro del contenedor (ya señalado en este registro como «permisos del proceso del contenedor»).
- El scraper no atiende `SIGTERM`: `docker compose stop` lo mata tras 10 s (código 137), así que cada `make down` espera ese tiempo.
- Con MongoDB caído, `POST /auth/login` (y el resto de rutas de `routes/auth.js`) responde 500 en 5 s, no 503; solo la comprobación de sesión y `POST /resultado` distinguen la base de datos no disponible.
