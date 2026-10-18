# NormativaCheck — Práctica 3

NormativaCheck es una aplicación web, desarrollada en el marco académico de la Práctica 3 y con proyección de uso profesional, que ayuda a pequeñas empresas españolas de software y ciberseguridad a organizar actividades, alcances, requisitos, tareas, documentos, evidencias y revisiones. Permite registrar qué se ha examinado, con qué información y con qué resultado razonado. El producto sigue en desarrollo: no certifica cumplimiento ni sustituye asesoramiento jurídico.

<a id="para-el-profesorado"></a>
## Para el profesorado: descarga, instalación y prueba local

**Empieza aquí.** El paquete docente instala en tu ordenador una copia funcional de la web, la API y MongoDB. Podrás iniciar sesión, crear registros ficticios y comprobar su persistencia; no es una maqueta de pantallas. La cuenta de prueba se crea ya verificada para que puedas evaluar el Workspace sin depender de un correo real, de la aprobación de altas ni del acceso al servidor del grupo.

**Por qué usar esta instalación antes que Hetzner:** el servidor de Hetzner es una instalación privada distinta, con sus propios datos, cuentas y controles de acceso. El alta normal exige confirmar el correo y el acceso a una organización requiere permisos; la disponibilidad de ese circuito depende de la configuración privada. Tu contraseña local no sirve allí. El recorrido docente se completa sin entrar en el servidor. Esta ruta de evaluación simplificada **no reduce el producto a una demo**: el proyecto desarrolla funciones para un uso profesional, aunque esta entrega es un MVP académico y no acredita una puesta en producción general. [Comparación de los tres modos](#tres-modos-que-no-deben-confundirse).

### Descargar el paquete completo

**[⬇ Descargar NormativaCheck para profesores — revisión Windows (.zip)](https://github.com/JoraTenshi/Normativa-Cyberseguridad/releases/download/v1.0-practica3-windows/NormativaCheck-profesores-windows-20261017.zip)**

| Material | Enlace y contenido |
| --- | --- |
| **Paquete recomendado para evaluar** | [ZIP docente completo, revisión Windows](https://github.com/JoraTenshi/Normativa-Cyberseguridad/releases/download/v1.0-practica3-windows/NormativaCheck-profesores-windows-20261017.zip): aplicación, instrucciones, memoria original, correspondencia de versiones, actas de pruebas, guion y PDF ficticio. |
| Página de descarga | [GitHub Release v1.0-practica3-windows](https://github.com/JoraTenshi/Normativa-Cyberseguridad/releases/tag/v1.0-practica3-windows). También contiene la [huella SHA-256 del paquete](https://github.com/JoraTenshi/Normativa-Cyberseguridad/releases/download/v1.0-practica3-windows/NormativaCheck-profesores-windows-20261017.sha256.txt). La etiqueta académica original `v1.0-practica3` permanece intacta. |
| Guía vigente | [Este README, sección para el profesorado](https://github.com/JoraTenshi/Normativa-Cyberseguridad/blob/main/README.md#para-el-profesorado). Es la referencia para seguir los pasos siguientes. |

**Todo lo necesario para esta evaluación se obtiene desde GitHub.** No hay que solicitar un ZIP por correo, recibir otro adjunto en Classroom ni esperar una autorización de alta. El paquete contiene fuentes: la primera construcción necesita Internet y los requisitos del paso 1.

> **Pruebas documentadas:** el recorrido básico se aceptó en Kali; en Windows se verificaron construcción, arranque, HTTPS/API/Mongo y operaciones autenticadas por API. La aceptación visual completa en Windows y el recorrido normativo ampliado no están acreditados por esas pruebas; consulta las [actas de aceptación](#pruebas-compilacion-y-evidencia). Utiliza únicamente datos ficticios.

**Orden de trabajo:** [1. Requisitos](#docentes-requisitos) → [2. Extraer y comprobar](#docentes-extraer) → [3. Arrancar](#docentes-arrancar) → [4. Certificado](#docentes-certificado) → [5. Cuenta y acceso](#docentes-cuenta) → [6. Probar](#docentes-probar) → [7. Recorrido ampliado](#docentes-ampliado) → [8. Parar y volver a entrar](#docentes-parar).

---

<a id="docentes-requisitos"></a>
### Paso 1. Preparar el equipo y comprobar los requisitos

| Necesitas | Qué comprobar / dónde obtenerlo |
| --- | --- |
| Ordenador x86-64 | Las imágenes usan `linux/amd64`. ARM no está validado. |
| Node.js **24.x** | [Descarga oficial de Node.js](https://nodejs.org/en/download). Selecciona la familia 24; fue la ensayada. |
| Docker local iniciado y **Compose 2.x o 5.x** | Linux: [instalación de Docker Engine](https://docs.docker.com/engine/install/). Windows: [instalación oficial de Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/), con contenedores Linux y requisitos de virtualización/WSL satisfechos. Compose viene incluido en Docker Desktop; no instales un binario `docker-compose` independiente para esta guía. |
| OpenSSL | En Linux, disponible en la terminal. En Windows, el operador también reconoce el incluido en [Git for Windows](https://git-scm.com/install/windows) en `C:\Program Files\Git\usr\bin\openssl.exe`. |
| Internet, disco y memoria disponibles | La primera construcción descarga imágenes y dependencias. Como previsión, 4 GB de memoria disponibles para Docker y 10 GB de disco dan margen; no son mínimos medidos ni una garantía. Docker Desktop tiene requisitos propios adicionales. |
| Carpeta local estable y puerto libre | Extrae preferentemente en una carpeta **no sincronizada** por OneDrive, Google Drive u otro servicio y evita unidades de red. La aplicación usará `127.0.0.2:9445`. |

#### Windows: instalar e iniciar Docker Desktop

1. Comprueba los [requisitos oficiales de Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/#system-requirements): versión de Windows admitida, virtualización de hardware, WSL 2 y memoria. Si tu equipo es administrado, consulta las condiciones de uso con su responsable.
2. En esa misma página oficial, descarga **Docker Desktop for Windows - x86_64**. Abre `Docker Desktop Installer.exe`, elige la instalación por usuario cuando sea adecuada y deja seleccionado el backend WSL 2 si el instalador lo ofrece. Sigue el asistente y reinicia Windows si lo solicita. No hace falta buscar comandos de instalación de terceros ni instalar Compose por separado.
3. Abre **Docker Desktop** desde Inicio. Completa su inicio inicial y espera a que indique que el motor está en marcha. Debe usar **contenedores Linux**; si la aplicación muestra la opción «Switch to Linux containers», selecciónala. La primera apertura y la aceptación de las condiciones de Docker son pasos del propio Docker Desktop.
4. Abre **una ventana nueva de PowerShell**, sin privilegios de administrador, y ejecuta las comprobaciones de abajo. No continúes si `docker version` muestra solo el cliente, si `docker info` no responde o si `OSType` no es `linux`.

Si Windows no cumple los requisitos de Docker Desktop, esta instalación no está validada en ese equipo; no cambies su configuración institucional a ciegas. [Docker explica la instalación interactiva, el arranque y la comprobación de WSL](https://docs.docker.com/desktop/setup/install/windows-install/).

#### Comprobaciones previas: PowerShell o terminal Linux

Ejecuta **una línea cada vez** y espera a que termine antes de pasar a la siguiente:

```sh
node --version
docker version
docker compose version
docker context show
docker info --format '{{.OSType}}'
```

**Resultado esperado:** Node `v24.x`; `docker version` muestra apartados **Client** y **Server**; Compose informa `v2.x` o `v5.x`; el contexto es local (en Docker Desktop suele ser `desktop-linux`), y `docker info` imprime `linux`. El operador rechaza conexiones a Docker remoto.

> **Si `docker` no se reconoce:** cierra y abre PowerShell tras instalar Docker Desktop y comprueba que la aplicación está iniciada. Si persiste, revisa la instalación con su guía oficial; no copies ejecutables de otra máquina. **Si aparece «Cannot connect» o «permission denied»**, comprueba primero que Docker Desktop está iniciado y que la misma terminal puede mostrar la sección **Server**; no cambies permisos del socket ni borres datos. **Si Compose indica `v5.x`**, esta revisión del operador la admite y se ha ensayado con 5.6.0; el ZIP anterior, identificado como «validado-kali», no la admite.

<details>
<summary><strong>Linux: si Docker requiere sudo</strong></summary>

Comprueba `sudo docker version` y `sudo docker compose version`. Si funcionan así, utiliza **`sudo node scripts/local-demo.cjs ...` en todos los comandos del operador**, incluidos `start`, `account`, `status`, `verify` y `stop`. Node 24 debe estar disponible también con `sudo`. No cambies los permisos del socket de Docker.

Los pasos siguientes muestran ambas variantes cuando es necesario. En Windows se utiliza `node`, sin `sudo`.

</details>

<a id="docentes-extraer"></a>
### Paso 2. Descargar, extraer y comprobar el paquete

1. Descarga el **ZIP docente completo** del enlace destacado al principio.
2. Extráelo en una carpeta local nueva. En Windows: clic derecho → **Extraer todo** y elige, por ejemplo, `C:\Users\TU_USUARIO\NormativaCheck`, comprobando que la ruta completa **no contiene `OneDrive`**. Evita también Google Drive, Escritorio sincronizado y unidades de red. La demo genera claves y configuración bajo `aplicacion/.runtime/`, y vincula la instalación a su ruta; una carpeta sincronizada puede copiar esos archivos a la nube o cambiar su disponibilidad. No ejecutes archivos dentro del ZIP. Si aún no has arrancado correctamente en una carpeta sincronizada, es preferible extraer una copia nueva fuera de ella. Si ya arrancaste, **no muevas esa instalación ni copies `.runtime`**: puede funcionar allí, pero ese arranque no valida la sincronización. Para instalarla en otra ruta, empieza con una extracción nueva y una cuenta nueva.
3. Abre una terminal en la carpeta extraída **`NormativaCheck-profesores-windows-20261017`**. Es la que contiene:

```text
NormativaCheck-profesores-windows-20261017/
├── LEEME-PRIMERO.txt
├── VERSION.json
├── MANIFEST-SHA256.json
├── aplicacion/
├── documentacion/
└── herramientas/
```

En Windows puedes abrir esa carpeta en el Explorador, escribir `powershell` en su barra de dirección y pulsar Intro. En Linux, usa **Abrir en terminal** desde el gestor de archivos.

En PowerShell, comprueba que estás en el nivel correcto antes de escribir el siguiente comando:

```powershell
Get-Location
Test-Path .\herramientas\verificar-paquete.cjs
```

El segundo comando debe imprimir `True`. Si imprime `False`, aún estás en la carpeta exterior de extracción o ya has entrado en `aplicacion`; abre la carpeta que contiene `LEEME-PRIMERO.txt`.

4. Comprueba la extracción:

```sh
node herramientas/verificar-paquete.cjs
```

**Resultado esperado: `INTEGRIDAD CORRECTA`.** Si falla, no arranques esa copia: vuelve a descargar y extraer el paquete en una carpeta nueva.

5. Entra en la carpeta de la aplicación:

```sh
cd aplicacion
```

**Desde ahora, todos los comandos se ejecutan aquí**, donde aparecen `frontend`, `backend`, `infra` y `scripts`. Conserva esa carpeta en la misma ubicación después del primer arranque.

En PowerShell, `Test-Path .\scripts\local-demo.cjs` debe imprimir `True`. Puedes utilizar `node .\scripts\local-demo.cjs start` o `node scripts/local-demo.cjs start`: ambas formas apuntan al mismo archivo.

<details>
<summary>Comprobación adicional: huella SHA-256 del ZIP descargado</summary>

La huella exacta del ZIP está en el archivo `.sha256.txt` de la misma Release. No está escrita dentro del propio ZIP, pues el archivo cambiaría su propia huella.

Desde la carpeta de descargas, en Linux:

```sh
sha256sum NormativaCheck-profesores-windows-20261017.zip
```

En PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\NormativaCheck-profesores-windows-20261017.zip'
```

Debe coincidir, ignorando mayúsculas/minúsculas. El manifiesto y esta huella detectan cambios; no son una firma digital de identidad del autor.

</details>

<details>
<summary>Alternativa para revisar código: clonar Git o descargar solo el repositorio</summary>

El [ZIP de código de v1.0-practica3-windows](https://github.com/JoraTenshi/Normativa-Cyberseguridad/archive/refs/tags/v1.0-practica3-windows.zip) y los enlaces automáticos **Source code** de la Release contienen el repositorio. **No incluyen los materiales adicionales del ZIP docente**. Para seguir esta guía por la ruta principal, descarga el archivo `NormativaCheck-profesores-windows-20261017.zip`.

Si prefieres Git:

```sh
git clone https://github.com/JoraTenshi/Normativa-Cyberseguridad.git NormativaCheck
cd NormativaCheck
git switch --detach v1.0-practica3-windows
git rev-parse HEAD
```

Comprueba que `git rev-parse HEAD` coincide con el commit de la Release Windows. En un clon o ZIP del repositorio estás directamente en la raíz de la aplicación: **no existen `herramientas/verificar-paquete.cjs` ni una subcarpeta `aplicacion`**. Continúa en el paso 3 desde donde están `frontend`, `backend`, `infra` y `scripts`.

La etiqueta `v1.0-practica3` conserva la entrega académica original; la revisión Windows tiene su propia etiqueta. `main` puede incorporar cambios posteriores. El ZIP docente incluye el código de la etiqueta Windows y documentación adicional; su huella es distinta de la del ZIP previo validado en Kali.

</details>

<a id="docentes-arrancar"></a>
### Paso 3. Arrancar y generar la configuración local

Mantén Docker Desktop abierto y el motor iniciado. Comprueba que el puerto está libre antes del primer arranque:

| Terminal | Comando |
| --- | --- |
| Linux | `ss -lnt 'sport = :9445'` |
| PowerShell | `Get-NetTCPConnection -LocalPort 9445 -State Listen -ErrorAction SilentlyContinue` |

No debe aparecer un proceso escuchando en ese puerto. En PowerShell, **no mostrar nada permite continuar con el intento, pero no garantiza que Windows deje abrirlo**. Si `start` devuelve `PORT_9445_BUSY`, sigue el diagnóstico de [Si algo falla](#si-algo-falla). Este puerto es distinto del usado por otras demos del grupo.

Desde **`aplicacion`**, ejecuta:

```sh
node scripts/local-demo.cjs start
```

Si tu Docker en Linux requiere `sudo`, utiliza **en su lugar**:

```sh
sudo node scripts/local-demo.cjs start
```

Espera a que termine; el primer arranque descarga imágenes y dependencias, construye dos imágenes y puede tardar varios minutos. No cierres PowerShell mientras se ve progreso. **Resultado esperado: `VERIFICADO: HTTPS local...` seguido de `Abre https://127.0.0.2:9445/espacio-de-trabajo`.** Los avisos `npm warn deprecated` durante la construcción no detienen por sí solos el arranque; decide por el resultado final.

El comando construye la web y la API, inicia MongoDB y crea la configuración, claves y certificado propios bajo `.runtime/local-demo/`. **No tienes que editar `.env`, introducir credenciales del grupo, configurar Gmail ni instalar las dependencias con `npm install` en el equipo.** La cuenta se crea en el paso 5.

**Si ya ves `VERIFICADO`, continúa con el paso 4 para importar el certificado de esta instalación y después con el paso 5 para crear la cuenta.** Abrir la URL antes de importar la CA puede producir un aviso HTTPS; todavía no tienes contraseña hasta ejecutar `account`.

Docker mantiene la aplicación en segundo plano. Si el comando falla, conserva el **primer error relevante**, el código final y el paso exacto; consulta [Si algo falla](#si-algo-falla). No borres datos ni generes otra configuración para ocultarlo. Si el fallo ocurrió después de crear `.runtime`, conserva esa carpeta en su sitio y consulta `node scripts/local-demo.cjs status` antes de repetir `start`.

<a id="docentes-certificado"></a>
### Paso 4. Confiar en el certificado de tu instalación

El navegador necesita confiar en la CA que acaba de generar **tu copia**. El arranque comprueba HTTPS, pero no instala automáticamente esa confianza. Importa únicamente `ca.crt`, nunca archivos `.key`.

<details>
<summary><strong>Linux con Firefox — entorno usado en el ensayo</strong></summary>

Si arrancaste con `sudo`, desde **`aplicacion`** exporta solo el certificado público:

```sh
sudo install -D -m 644 -- .runtime/local-demo/tls/ca.crt outputs/local-demo-ca.crt
```

1. Abre Firefox con tu usuario habitual.
2. En **Ajustes → Privacidad y seguridad → Certificados → Ver certificados → Autoridades → Importar**, selecciona `aplicacion/outputs/local-demo-ca.crt`.
3. Habilita la confianza para identificar sitios web y confirma. Los nombres del menú pueden variar según la versión.

Si arrancaste sin `sudo`, puedes importar directamente `aplicacion/.runtime/local-demo/tls/ca.crt`; activa la visualización de archivos ocultos si no aparece `.runtime`. No abras Firefox como administrador. Puedes utilizar un perfil de navegador dedicado al ensayo.

</details>

<details open>
<summary><strong>Windows con Edge o Chrome — procedimiento documentado, instalación completa no validada</strong></summary>

Desde **`aplicacion`**, en PowerShell, comprueba primero que el archivo existe y muestra la huella del certificado que vas a importar:

```powershell
Test-Path .\.runtime\local-demo\tls\ca.crt
(Get-PfxCertificate -FilePath .\.runtime\local-demo\tls\ca.crt).Thumbprint
```

El primer resultado debe ser `True`. Anota la huella para reconocer **esta** CA en el almacén de certificados; no publiques ni abras ningún archivo `.key`. Después ejecuta:

```powershell
Invoke-Item .\.runtime\local-demo\tls\ca.crt
```

En la ventana que se abre:

1. **Instalar certificado → Usuario actual → Siguiente**.
2. **Colocar todos los certificados en el siguiente almacén → Examinar**.
3. **Entidades de certificación raíz de confianza → Aceptar → Siguiente → Finalizar**.
4. Comprueba que es la CA recién generada por tu copia, `NormativaCheck Demo Local`, y confirma su importación.
5. Abre o reinicia Edge/Chrome. Firefox puede utilizar un almacén propio.

</details>

**Resultado esperado:** al abrir la dirección del paso 5, no aparece un aviso de emisor desconocido. Si aparece, revisa el certificado y la URL; no desactives la validación HTTPS. La confianza instalada permanece al parar Docker: retira únicamente esta CA cuando termines definitivamente la evaluación. El certificado de servidor dura 90 días, exige al menos una semana restante y no se renueva automáticamente.

<a id="docentes-cuenta"></a>
### Paso 5. Crear la cuenta de prueba y entrar

Desde **`aplicacion`**, en una terminal interactiva, ejecuta:

```sh
node scripts/local-demo.cjs account
```

Si has usado `sudo` en Linux, el comando es:

```sh
sudo node scripts/local-demo.cjs account
```

**Resultado esperado:** se crea una cuenta, una empresa ficticia y una contraseña aleatoria. **Guarda la contraseña que aparece en esa terminal: se muestra una sola vez.** No es la contraseña de Windows, Linux ni del servidor del grupo. Repetir `account` no la revela ni la restablece.

En PowerShell, escríbelo **directamente** en una terminal normal, sin canalizarlo a un archivo ni ejecutarlo desde una tarea en segundo plano: el operador exige terminal interactiva. Si el resultado dice «La cuenta de prueba ya existe», la cuenta de **esa instalación** no ha cambiado y el comando no volverá a mostrar su contraseña; no pruebes contraseñas de una copia anterior.

| Dato para acceder | Valor |
| --- | --- |
| **Dirección, en el mismo equipo que ejecuta Docker** | **[https://127.0.0.2:9445/espacio-de-trabajo](https://127.0.0.2:9445/espacio-de-trabajo)** |
| Correo | `admin.workspace@example.invalid` |
| Contraseña | La generada en tu terminal por `account`. |
| Empresa que debes seleccionar | `Empresa de prueba - NormativaCheck` |

La cuenta administra **solo esa empresa ficticia** y está prevalidada para la evaluación. **Entra mediante «Iniciar sesión»; no necesitas «Crear cuenta», verificación de correo ni recuperación de contraseña.** No se envía correo. El segundo factor (2FA) es opcional y **no hace falta para el recorrido básico**: si lo activas en **Mi cuenta → Seguridad**, necesitarás tu aplicación de códigos para los siguientes inicios de sesión y se te pedirá identificarte de nuevo. Esta instalación local no ofrece recuperación por correo ni códigos de respaldo para el 2FA; consérvalo en tu aplicación. Si pierdes la contraseña o el segundo factor, conserva el estado y solicita asistencia sin publicar secretos ni borrar la base.

No cambies la dirección por `localhost`, HTTP u otra IP. Si usas Linux dentro de una máquina virtual, abre el navegador **dentro de esa máquina**, donde corre Docker. La configuración de acceso desde otro equipo no forma parte de esta receta.

<a id="docentes-que-pueden-hacer"></a>
### Qué puede hacer el profesorado con la cuenta ficticia

No es una visita de solo lectura: la cuenta es **administradora de la empresa de prueba**, sin permisos de administración global de la plataforma. La instalación comienza con esa empresa, pero sin un expediente normativo completo. Usa únicamente nombres, datos y archivos inventados.

| Puedes... | Por dónde empezar |
| --- | --- |
| **Explorar el Workspace** y su vista general, perfil, operaciones, documentación, tareas, historial y secciones normativas. | Inicia sesión y selecciona `Empresa de prueba - NormativaCheck`. Las listas vacías al principio son normales. |
| **Crear un servicio o producto ficticio**, volver a abrirlo y comprobar que persiste tras recargar o reiniciar. | Sigue el [recorrido básico](#docentes-probar); es la prueba más sencilla y ya comprobada. |
| **Describir un caso de prueba** con perfil, actividad, alcance, sistema u operación; consultar las fichas disponibles de ENS y RGPD. | Sigue [Preparar un caso docente](#docentes-ampliado). Las fichas cubren supuestos concretos, no toda la normativa. |
| **Registrar tareas, documentos PDF y evidencias**, y consultar los cambios guardados. | El [recorrido ampliado](#recorrido-ampliado) indica qué datos previos necesita cada paso. Usa el PDF ficticio incluido; cada versión admite hasta 5 MiB. |
| **Explorar RAT, privacidad, solicitudes de derechos, detección EIPD y revisiones internas** con datos inventados. | Son módulos implementados con condiciones y dependencias propias. Una pantalla disponible no significa que exista ya un caso preparado ni que su flujo completo se haya aceptado en esta instalación. |
| **Activar 2FA** para la propia cuenta, si deseas probarlo después del recorrido básico. | En **Mi cuenta → Seguridad**. No hay recuperación local ni códigos de respaldo: conserva el autenticador. Después del cambio se exige volver a iniciar sesión y aportar el código TOTP. |

La demo guiada de la portada, **«Explorar la demo»**, es otra opción para mirar sin iniciar sesión: sus datos viven en el navegador y no son los que guardas en este Workspace. Esta cuenta no autoriza a aprobar altas de otros usuarios ni a administrar la plataforma. Las revisiones y diagnósticos son orientativos; la aplicación no emite certificados de cumplimiento.

<a id="docentes-probar"></a>
### Paso 6. Probar el recorrido básico

La cuenta nueva incluye la empresa, pero **no trae un expediente completo precargado**. Las primeras vistas vacías son esperables. Este es el recorrido que se comprobó en Kali:

| Orden | Qué hacer | Qué debes observar |
| --- | --- | --- |
| 1 | Inicia sesión y selecciona la empresa ficticia. | Se abre su Workspace. |
| 2 | Desde los espacios de trabajo, crea un servicio/producto llamado, por ejemplo, `Servicio docente`, con una descripción ficticia. | El servicio aparece en la empresa. |
| 3 | Recarga la página y vuelve al servicio. | Conserva el mismo nombre y datos. |
| 4 | Consulta el historial de ese servicio. | Aparece su evento de creación. |
| 5 | Ejecuta `stop`, después `start` y después `verify`, como explica el paso 8. | La comprobación local termina correctamente. |
| 6 | Vuelve a iniciar sesión y consulta el servicio y su historial. | Continúan el servicio y su evento de creación. |
| 7 | Cierra sesión, vuelve al área privada y recarga. | La aplicación vuelve a pedir identificación. |

**Has completado la prueba básica cuando puedes crear, recuperar y conservar el servicio tras reiniciar, y cerrar la sesión correctamente.** Esto no acredita todos los módulos ni una conclusión normativa favorable. Los datos de este Workspace se guardan en MongoDB local.

<a id="docentes-ampliado"></a>
### Paso 7. Explorar tareas, documentos, evidencias y revisiones

Continúa con el [recorrido ampliado de este README](#recorrido-ampliado). Dentro del ZIP, la carpeta **`documentacion`** incluye:

| Archivo | Para qué usarlo |
| --- | --- |
| `Preparar_caso_docente.txt` | Preparar un caso ENS: perfil, actividad, alcance, sistema y requisito. |
| `Recorrido_para_el_profesor.txt` | Continuar por tareas, documentos, evidencias y revisión. |
| `Documento_ficticio_para_el_ensayo.pdf` | Probar la carga de un documento ficticio. No acredita cumplimiento. |
| `Memoria_tecnica_original.pdf`, `Correspondencia_con_la_memoria.txt` y `Acta_de_aceptacion_Kali.txt` | Consultar el alcance académico, las versiones y las pruebas realizadas. |

**Este recorrido ampliado es una guía de uso y no una prueba integral ya superada.** Para requisitos vinculados a operaciones, sigue la precisión de la guía online: la operación debe vincularse a la actividad antes de confirmar el alcance. El caso ENS del paquete utiliza un sistema, que es otro itinerario.

Si solo quieres conocer la demo guiada de la portada, abre **[Explorar la demo](https://127.0.0.2:9445/#/demo)** con la instalación en marcha. Su contenido ficticio vive en el navegador; es independiente del Workspace conectado y no sirve para comprobar persistencia en MongoDB.

<a id="docentes-parar"></a>
### Paso 8. Detener la app y volver a usarla otro día

Desde **la misma carpeta `aplicacion`**, ejecuta únicamente el comando de la acción que necesitas:

| Acción | Comando |
| --- | --- |
| Consultar el estado | `node scripts/local-demo.cjs status` |
| Comprobar HTTPS, API y MongoDB | `node scripts/local-demo.cjs verify` |
| Detener al terminar | `node scripts/local-demo.cjs stop` |
| Volver a arrancar | `node scripts/local-demo.cjs start` |

En Linux, conserva el prefijo `sudo` si fue necesario en el primer arranque. Para probar el reinicio del paso 6, ejecuta **`stop` → espera a que termine → `start` → espera → `verify`**.

`stop` conserva cuenta, documentos, claves y volúmenes. Otro día, inicia Docker, ejecuta `start` y entra con la misma cuenta. No ejecutes `account` de nuevo. No hay arranque automático garantizado tras reiniciar el ordenador: **no muevas la carpeta ni copies `.runtime`**, porque la instalación está vinculada a su ruta y usuario.

---

## Información de la aplicación y documentación técnica

La guía anterior es la ruta de instalación para evaluar. Los apartados siguientes desarrollan finalidad, arquitectura, correspondencia con la memoria, configuración, pruebas y límites. No es necesario ejecutar sus comandos de desarrollo para seguir el recorrido docente.


## Qué problema resuelve y qué contiene

La primera versión del proyecto (P1) utilizaba cuestionarios, puntuaciones y un Plan Director de Seguridad (PDS). P3 conserva la finalidad de orientar a la empresa, pero cambia el núcleo: una valoración debe explicar los hechos examinados, el requisito, el periodo y la evidencia que la sostiene. El código y los resultados históricos anteriores se conservan; no se reinterpretan como revisiones del modelo nuevo.

<a id="tres-modos-que-no-deben-confundirse"></a>
### Tres modos que no deben confundirse

| Modo | Para qué sirve | Dónde guarda la información |
| --- | --- | --- |
| Demo pública de la portada, sin cuenta | Explicar el producto mediante una empresa y documentos ficticios, con un recorrido guiado. | Estado de demostración en el navegador; no demuestra una operación real en MongoDB. |
| Workspace local para evaluación | Probar la aplicación conectada, con cuenta ficticia ya verificada y sin envío de correo. Es la ruta del profesorado en este README. | MongoDB local en los volúmenes Docker de esa instalación. |
| Instalación privada en Hetzner | Operar una instancia separada, accesible solo por su circuito privado. El código contempla registro, verificación de correo y autorización de acceso a organizaciones; su disponibilidad efectiva depende de la configuración y aceptación de ese entorno. | Servicios y datos privados del servidor. La receta docente no instala, actualiza ni concede acceso a esta instancia. |

La demo de portada no analiza documentos reales ni ejecuta IA. La instalación local no requiere Hetzner, WireGuard, Gmail, un dominio público ni las contraseñas del equipo del proyecto. La cuenta local no existe por ello en Hetzner; las pruebas de un modo no acreditan automáticamente los demás. Que haya una ruta docente simplificada de autenticación no significa que el producto previsto se reduzca a esa demo.

### Qué significa cada pieza del trabajo

1. **Empresa y actividades:** quién trabaja y qué servicios o actividades realiza. El perfil recoge declaraciones y sus motivos; los datos desconocidos no se convierten en respuestas negativas o favorables.
2. **Alcance:** la parte concreta que se examina. Confirmar una propuesta de alcance no significa haber evaluado toda la organización.
3. **Sistema u operación:** el objeto descrito, sus hechos y sus referencias. En protección de datos puede necesitarse identificar tratamientos, finalidades y flujos.
4. **Requisito contextualizado:** una ficha del catálogo relacionada con un alcance y un objeto, con su versión y sus condiciones de aplicabilidad.
5. **Actuación o tarea:** trabajo con estado y responsable. Organiza lo pendiente; terminarlo no aprueba el requisito.
6. **Documento y versión:** el documento identifica la pieza corporativa; cada versión identifica unos bytes concretos y su huella SHA-256.
7. **Evidencia:** información con procedencia, localizador, periodo y soporte. Puede apuntar a una versión documental concreta, no simplemente al último archivo con el mismo nombre.
8. **Revisión:** valoración motivada de criterios, con evidencias y periodo examinado. Se conserva la conclusión y las referencias utilizadas.
9. **Historial:** permite consultar versiones y eventos. Una modificación posterior no debe reescribir silenciosamente la revisión histórica.

Por ejemplo, para revisar una política de seguridad primero se delimita el sistema. Después se contextualiza la ficha correspondiente, se aporta una versión documental y se registra qué acredita realmente. Un PDF de prueba no justifica marcar todos los criterios como favorables. Si falta información, la revisión debe mantener esa incertidumbre.

### Alcance normativo y límites del MVP

El catálogo de esta base contiene diez fichas activas: cuatro ENS (política, ejercicio de funciones, separación de responsabilidades y punto de contacto) y seis de protección de datos (encargo, seguridad de la operación, licitud de la finalidad, transferencias, transparencia y derechos). No es una recopilación exhaustiva de normas ni una equivalencia automática entre obligaciones de marcos diferentes.

El código incorpora también unidades de protección de datos: RAT, finalidades, flujos, información, solicitudes/peticiones de derechos y detección orientativa de necesidad de EIPD. **El detector no realiza una EIPD**, una solicitud registrada no es un derecho satisfecho y un RAT vacío no demuestra que todos los tratamientos estén inventariados. La categorización ENS conserva declaraciones, impactos y resultados de un sistema; no certifica su conformidad.

Quedan fuera del cierre del MVP la ampliación normativa completa, IA integrada, licitaciones, un nuevo PDS completo exportable, Trust Center y una API pública para integradores. Las rutas internas de la aplicación no equivalen a esa API pública. Tampoco se promete un gestor colaborativo completo, análisis antimalware de PDF o medidas de rendimiento no ensayadas.

## Versiones y correspondencia con la memoria

| Referencia | Identidad | Qué acredita |
| --- | --- | --- |
| Memoria técnica original, 16/10/2026, 51 páginas | R3: `2f52aac139a7d606d9102d55e95005be5e58949e` | Arquitectura, alcance, antecedentes, resultados y pendientes del momento en que se redactó. |
| Base del paquete aceptado en Kali | `1e3a4f62fd0cca6927a97fc42fb9f86e847a6eb5`; árbol `905ee9b0d947302943caf0b26c737b2d48b66a1e` | Base posterior a R3 con instalador local y correcciones integradas; recorrido básico aceptado en Kali. |
| Entrega académica en GitHub | Etiqueta [v1.0-practica3](https://github.com/JoraTenshi/Normativa-Cyberseguridad/tree/v1.0-practica3) | Referencia estable al commit final; verificar su SHA remoto y la CI, sin inferirlos del nombre de la etiqueta. |
| Revisión de instalación Windows | Etiqueta [v1.0-practica3-windows](https://github.com/JoraTenshi/Normativa-Cyberseguridad/tree/v1.0-practica3-windows), con identidad exacta en `VERSION.json` del ZIP | Corrige el operador para Compose 5 y documenta el ensayo Windows; no cambia la memoria original ni acredita todo el recorrido visual. |

La memoria original describe R3 y no se ha alterado. El paquete docente es posterior: añade el instalador local y correcciones documentadas, pero no reescribe los resultados ni los hallazgos de seguridad de R3. La revisión Windows admite Compose 5; sus pruebas no acreditan por sí solas correo externo, Hetzner ni todas las pruebas PR01-PR14 de la memoria. Los cambios y los límites de cada ensayo constan en la [aceptación Kali](docs/aceptacion-docente-20261017.md) y el [acta Windows](docs/aceptacion-docente-windows-20261017.md).

## Arquitectura y estructura del repositorio

React 18, compilado mediante `react-scripts` 5, presenta la interfaz. Nginx sirve sus archivos y dirige `/api` al backend Node.js/Express 4. Mongoose 8 modela los datos en MongoDB. Los `package-lock.json` de `frontend` y `backend` fijan las dependencias; no se ha migrado esta base a Vite.

```text
Navegador (React)
        | HTTPS
        v
Nginx: frontend estático + proxy /api
        |
        v
API Node.js / Express: sesión, permisos, validación y reglas
        |
        v
MongoDB: organizaciones, registros, versiones, PDF e historial
```

El navegador no accede directamente a MongoDB. Docker Compose organiza los tres servicios. El perfil docente crea una réplica Mongo de un nodo con autenticación y un usuario de aplicación limitado, necesaria para los contratos transaccionales. Solo Nginx publica el puerto local; API y MongoDB no tienen puertos publicados en el host.

Los PDF se guardan como contenido binario en `VersionDocumento`, junto con tamaño y SHA-256, con un límite de **5 MiB por versión** y una cuota de **100 MiB por organización**, contando versiones históricas. No se usa GridFS ni una carpeta compartida como almacén principal de esos documentos. La huella identifica contenido; no acredita validez jurídica ni ausencia de malware.

### Dónde encontrar cada parte

| Ruta | Responsabilidad |
| --- | --- |
| [`frontend/src/App.js`](frontend/src/App.js) | Entradas y rutas de la interfaz. |
| [`frontend/src/public-experience/`](frontend/src/public-experience/) | Portada y demostración ficticia sin cuenta. |
| [`frontend/src/connected/`](frontend/src/connected/) | Workspace conectado: `ApiWorkspace`, `CompanyProfile`, `ProfileOperations`, `NormativeWorkspace`, editores y controles. |
| [`backend/app.js`](backend/app.js), [`backend/routes/`](backend/routes/) | Composición HTTP y rutas de acceso a los casos de uso. |
| [`backend/services/`](backend/services/) | Reglas de contexto, alcance, documentos, registros, revisión, sesiones, protección de datos y ENS. |
| [`backend/models/`](backend/models/), [`backend/validation/`](backend/validation/) | Esquemas persistentes y contratos de entrada. |
| [`backend/catalogo/c2/`](backend/catalogo/c2/) | Fichas normativas versionadas. |
| [`infra/local-demo/`](infra/local-demo/), [`scripts/local-demo.cjs`](scripts/local-demo.cjs) | Perfil y operador de la instalación docente. |
| [`frontend/Dockerfile.integration`](frontend/Dockerfile.integration), [`backend/Dockerfile.integration`](backend/Dockerfile.integration) | Construcción de las imágenes utilizadas por el perfil local. |
| [`infra/integration/`](infra/integration/) | Incluye plantillas de Nginx y arranque/salud Mongo **reutilizadas por el perfil local**. Su antiguo procedimiento de laboratorio no es el instalador genérico; no borrar la carpeta. |
| [`infra/private/`](infra/private/), [`scripts/private/`](scripts/private/) | Configuración e identidad del despliegue privado; operación separada. |
| [`scripts/admin/private-demo/`](scripts/admin/private-demo/) | Herramientas administrativas fuera de la imagen backend; no se ejecutan en la instalación del profesor. |
| [`backend/tests/`](backend/tests/), pruebas `*.test.*` de frontend | Reglas, API y componentes; ver comandos más abajo. |
| [`docs/`](docs/), [CI](.github/workflows/canonical-checks.yml) | Contratos, operación, decisiones y comprobaciones automatizadas. |
| `qa-dev/`, `scraper/`, componentes y datos anteriores | Material de QA o evolución histórica; su presencia no acredita nuevas funciones del Workspace ni autoriza ejecutarlo contra producción. |

La instalación utiliza el árbol completo de la versión elegida, no archivos de otras ramas. **Independencia entre ramas no significa que se puedan eliminar carpetas del propio commit.** MongoDB, configuración y claves de una instalación son estado operativo externo al código: borrar una rama no sustituye un plan para conservarlos.

### Identidad, roles y conflictos

La API distingue autenticación, membresía de organización, permisos por rol y lectura documental. Estar registrado no concede acceso automático a una empresa. Administrar una organización no concede administración global; los cargos funcionales ENS tampoco son roles técnicos de acceso.

Los roles empresariales son `administrador`, `colaborador` y `consulta`. **El recorrido normativo descrito aquí requiere administrador de la organización**, que es el rol de la cuenta docente: contexto, operaciones, requisitos, actuaciones, revisiones y unidades ENS/DP no están abiertos a cualquier miembro. La lectura documental de otros roles depende de lectores o unidades autorizadas; el historial general tampoco se concede indiscriminadamente. La coordinación de una unidad es otra relación y no convierte al usuario en administrador. La capacidad de plataforma `revision_altas` se concede por separado y exige sus controles de correo, MFA y autenticación reciente; no se crea con `account`.

La base contiene contraseña con bcrypt, correo verificado, TOTP y controles de sesión. La política de sesión es de **8 horas absolutas y 30 minutos de inactividad**; «Mantener la sesión» no elimina esos límites. La cuenta docente prevalidada es una excepción explícita del laboratorio: su creación no prueba el envío de correo ni el 2FA, aunque este último se puede activar y usar opcionalmente con la cuenta.

Los registros y documentos tienen versiones. Una edición con una versión antigua puede devolver `HTTP 409`: se debe conservar el borrador, consultar el estado actual y decidir cómo resolverlo, no reenviar ciegamente ni sobrescribir trabajo ajeno. La [documentación de contratos](docs/) amplía los comportamientos concretos.


---

<a id="recorrido-ampliado"></a>
## Recorrido ampliado: guía, no aceptación integral

La siguiente cadena explica el funcionamiento implementado y cómo preparar un caso. **No se ha ejecutado completa en la aceptación Kali.** El paquete docente incluye `documentacion/Preparar_caso_docente.txt`, `Recorrido_para_el_profesor.txt` y un PDF ficticio de apoyo, fuera del código de aplicación.

1. **Perfil y alcance:** iniciar el perfil con motivo, añadir una actividad ficticia en el bloque de empresa y actividades y guardar ese bloque. Añadir al borrador no guarda todavía en el servidor.
2. **Propuestas de trabajo:** revisar la propuesta, asociarla al servicio creado, indicar el motivo y confirmar. Consultar el alcance guardado y sus referencias. No ignorar avisos de perfil o referencias desactualizados.
3. **Sistema, para el caso ENS del paquete:** describir el sistema delimitado y seleccionar el alcance. Responder solo a los hechos estipulados del caso; mantener «No lo sé todavía» cuando proceda. Para un requisito sobre una operación, el orden es distinto: crear la operación y vincularla a la actividad en el perfil **antes de confirmar el alcance**; no basta con crearla después ni vincularla únicamente al servicio. El requisito solo permite elegir las operaciones que quedaron incluidas en ese alcance.
4. **Requisito:** seleccionar una ficha publicada y contextualizarla con el objeto, alcance y versiones consultadas. Leer aplicabilidad, cobertura y cuestiones pendientes. Un encaje preliminar no demuestra satisfacción del requisito.
5. **Actuación:** crear una tarea vinculada, indicar la membresía responsable, descripción y estado. Los estados son pendiente, en curso, terminada y archivada; archivar exige haber terminado. Figurar como responsable no amplía los permisos de esa cuenta.
6. **Documento y evidencia:** aportar un PDF ficticio de hasta 5 MiB, identificar su versión y vincularla a una evidencia con procedencia, localizador, periodo y motivo. Descargar o comprobar una huella no certifica su contenido.
7. **Revisión:** examinar los criterios reales, indicar evidencias y motivos y delimitar el periodo. No marcar «Favorable» por defecto; usar «No determinada» con explicación cuando falte soporte. El final del intervalo está excluido.
8. **Historial y cambios:** consultar la revisión y sus referencias, registrar por separado los resultados de guardar/recargar/reiniciar. Un aviso «Fuera del periodo revisado» no cambia por sí mismo la conclusión histórica. Un cambio sustantivo de evidencia es una causa distinta de nueva revisión.

El caso ENS del paquete estipula una empresa privada que presta un servicio a una entidad pública española y un sistema delimitado sin información oficialmente clasificada. Es un supuesto didáctico para una ficha concreta, **no una conclusión de aplicabilidad para una empresa real**. No se deben inventar respuestas para habilitar botones. Si la revisión queda bloqueada, leer y documentar la causa.

Las unidades RAT, finalidades, flujos, información, derechos, EIPD y categorización ENS tienen sus propios editores y condiciones. Esta cadena no los cubre todos. La memoria, capítulos 6, 8 y 9, identifica sus pruebas anteriores y límites; no se trasladan a esta instalación por compartir pantallas.

### Demo guiada sin cuenta

Con la instalación local completa, abrir la portada del mismo origen y pulsar **Explorar la demo**, o entrar en `https://127.0.0.2:9445/#/demo`. Es un fragmento `/#/demo`, no la ruta `/demo`.

Seleccionar el servicio ficticio, consultar el diagnóstico, abrir **Tareas y responsables**, una tarea, **Fundamento** y su documento de muestra. **Ayuda → Iniciar recorrido** abre la guía. También existen `/#/demo/fundamento`, `/#/demo/documento` y `/#/demo/tarea`.

Los cambios de este modo pertenecen a la demo del navegador, no a la empresa autenticada. Sus contadores son tareas, no porcentajes de cumplimiento. No presentar su contenido precargado como si se hubiera creado y persistido en MongoDB durante la evaluación.

## Configuración y conservación de datos

| Perfil | Configuración de entrada | Límites |
| --- | --- | --- |
| Docente local | [`infra/local-demo/profile.cjs`](infra/local-demo/profile.cjs) y `scripts/local-demo.cjs` generan `.runtime/local-demo/`; `NC_LOCAL_DEMO=1` y origen local. | No carga un `.env` prestado, no activa correo externo y no instala confianza TLS automáticamente. |
| Privado | [`infra/private/profile.example.json`](infra/private/profile.example.json) y generador `scripts/private/render-profile.cjs`. | Configuración nueva de `releaseRoot`, `stateRoot`, puerto, WireGuard y modo SMTP; generar archivos no despliega ni actualiza una instalación. |
| Backend genérico | [`backend/.env.example`](backend/.env.example): URI Mongo, puerto, origen, firma JWT, cifrado TOTP y SMTP. | Ejemplo técnico separado; copiarlo no sustituye el instalador docente ni prepara una base por sí solo. |

El perfil local genera secretos Mongo, clave de réplica, firma JWT y cifrado TOTP bajo `.runtime/local-demo/secrets/`; TLS bajo `.runtime/local-demo/tls/`. También crea Compose, Nginx, un entorno vacío y la identidad de la instalación. Los datos Mongo se conservan en volúmenes Docker; los PDF versionados están dentro de MongoDB. Ni esos volúmenes ni `.runtime` deben incluirse en el ZIP o el repositorio.

El perfil privado contiene modos `disabled`, `smtp465` y `smtp587`, con secreto externo propio y validación TLS. El ensayo local **no prueba su activación, Gmail, entrega de correo, verificación de una cuenta real ni recuperación**. Leer [operación privada](docs/operacion-privada.md) para el entorno administrado; no ejecutar aquí sus operadores ni herramientas `scripts/admin/private-demo/`.

Los atajos antiguos `make up`, `seed`, `setup`, `cert`, `recert` y `clean` están deshabilitados; el Compose de raíz requiere un perfil explícito. Los scripts históricos de laboratorio no sustituyen la receta docente. Algunas de sus plantillas siguen siendo dependencias del perfil local, como muestra el mapa de carpetas.

<a id="pruebas-compilacion-y-evidencia"></a>
## Pruebas, compilación y evidencia

La instalación para profesores construye las dependencias dentro de Docker. Los comandos siguientes son **opcionales para desarrollo y revisión del código**, no pasos adicionales obligatorios del acceso docente. Ejecutarlos en otra copia, sin URI, claves, cookies o credenciales reales y sin reutilizar `node_modules` o `NODE_PATH` de otra rama.

### Backend

Desde la raíz:

```sh
cd backend
npm ci --ignore-scripts --no-audit --no-fund
npm test
cd ..
```

### Frontend

En Bash, desde la raíz:

```sh
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
CI=true npm test -- --watchAll=false --runInBand
CI=true GENERATE_SOURCEMAP=false npm run build
cd ..
```

En PowerShell, desde la raíz:

```powershell
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
$env:CI = 'true'
npm test -- --watchAll=false --runInBand
$env:GENERATE_SOURCEMAP = 'false'
npm run build
cd ..
```

El build queda en `frontend/build/` y no se versiona. [canonical-checks.yml](.github/workflows/canonical-checks.yml) define las comprobaciones de CI; no arranca Docker ni ejecuta despliegue, seed o correo real. Desactivar el audit en estos comandos no equivale a una revisión de vulnerabilidades satisfactoria.

| Evidencia y versión | Resultado | Qué no demuestra |
| --- | --- | --- |
| Suite Backend en clon propio | 1.382 pruebas aprobadas. | Navegador, instalación Docker o correo externo. |
| Ensayo adicional con réplica Mongo temporal | 15 pruebas aprobadas. | Operación del VPS ni todos los recorridos de interfaz. |
| Ensayo SMTP/TLS local | 7 pruebas aprobadas. | Gmail, entrega de mensajes o MFA real. |
| Front en clon propio | 525 pruebas en 47 suites y compilación satisfactorias. | La parte de smoke con API simulada no acredita persistencia real. |
| Aceptación docente Kali, 17/10/2026 | Instalación desde ZIP, cuenta, HTTPS confiado, login, servicio, recarga/historial, stop/start, persistencia y logout. | Windows, todos los módulos, registro por correo, MFA, GitHub o Hetzner. |
| Ensayo docente Windows, 17/10/2026 | ZIP original verificado; reproducción de `COMPOSE_V2_REQUIRED` con Compose 5.6.0; operador corregido; construcción, arranque, HTTPS/API/Mongo, cuenta, login por API, servicio, historial accesible, stop/start, persistencia y logout. Una extracción nueva del ZIP revisado pasó `start` y la primera ejecución interactiva de `account`, sin registrar la contraseña. | El login y la persistencia se ensayaron por API con contraseña retenida solo en memoria; no acreditan el recorrido visual por navegador, la instalación de Docker Desktop desde cero ni el recorrido normativo completo. Véase [acta Windows](docs/aceptacion-docente-windows-20261017.md). |

**No sumar estos recuentos como una prueba de extremo a extremo.** La [nota de aceptación](docs/aceptacion-docente-20261017.md) separa resultados delegados, verificaciones de integridad, intentos incompletos y pruebas anteriores de la memoria. La construcción pudo reutilizar capas Docker locales; no se presenta como un equipo virgen sin ninguna caché.

`scripts/local-demo-qa.cjs` es un ensayo separado para mantenedores y exige una copia sin runtime. No es el acceso normal del profesor: la contraseña del automatismo vive solo en memoria. No ejecutarlo sobre la copia de uso ni emplearlo para recuperar una cuenta. La [guía técnica local](docs/prueba-local.md) conserva el detalle y los antecedentes Kali; el [acta Windows](docs/aceptacion-docente-windows-20261017.md) identifica las pruebas nuevas y sus límites.

Los errores generales de instalación y sus comprobaciones están en [Si algo falla](#si-algo-falla). El [acta Windows](docs/aceptacion-docente-windows-20261017.md) conserva el alcance de las pruebas, no una lista de pasos adicionales.

<a id="si-algo-falla"></a>
## Si algo falla

| Mensaje o síntoma | Qué comprobar sin destruir datos |
| --- | --- |
| `NODE_24_REQUIRED` | Node 24 en el entorno que ejecuta el operador, también cuando se usa `sudo`. |
| `COMPOSE_V2_REQUIRED` | Estás usando el **ZIP anterior, validado en Kali**, cuyo operador solo admite Compose 2. Descarga la revisión Windows indicada arriba; no basta con leer un README nuevo mientras ejecutas el script viejo. |
| `COMPOSE_VERSION_UNSUPPORTED` | En esta revisión, `docker compose version --short` debe indicar 2.x o 5.x. No utilices el ejecutable separado `docker-compose`; Docker Desktop incluye `docker compose`. |
| `docker` no se reconoce | Docker Desktop puede estar instalado pero no disponible aún en la ventana de PowerShell abierta antes de instalarlo. Abre Docker Desktop, espera al motor y abre una **nueva** PowerShell. Comprueba `Get-Command docker` y vuelve al paso 1. |
| `docker version` solo muestra Client, «Cannot connect» o «permission denied» | El CLI existe, pero no llega al motor. Comprueba en Docker Desktop que el motor está iniciado y que usas contenedores Linux; vuelve a ejecutar `docker info --format '{{.OSType}}'`. No modifiques permisos de Docker ni reinstales por prueba y error. |
| `REMOTE_DOCKER_REFUSED` / `LINUX_DOCKER_REQUIRED` | Docker debe ser local y ejecutar contenedores Linux. |
| `OPENSSL_REQUIRED` | OpenSSL accesible; en Windows se contempla la ruta de Git for Windows indicada. |
| `PORT_9445_BUSY` | Windows no ha permitido abrir `127.0.0.2:9445`; **no demuestra por sí solo que haya un proceso escuchando**. En PowerShell ejecuta `Get-NetTCPConnection -LocalPort 9445 -State Listen -ErrorAction SilentlyContinue`. Si aparece una fila, anota `OwningProcess` y consulta `Get-Process -Id <PID>` sustituyendo `<PID>` por ese número; no detengas un proceso ajeno a ciegas. Si no aparece nada, cierra tus trabajos, reinicia Windows, abre Docker Desktop, espera al motor Linux y repite `node scripts/local-demo.cjs start` desde la **misma** carpeta. Si persiste, conserva la salida de ambos comandos y pide ayuda; no borres `.runtime`, volúmenes ni credenciales. |
| `COMMAND_FAILED` | Conserva las líneas **inmediatamente anteriores** al código final. Si ocurrió antes de descargar imágenes, revisa `docker version`, `docker compose version` y `docker info`. Durante una descarga, comprueba red y espacio; después, `node scripts/local-demo.cjs status`. Indica qué comando y etapa falló antes de reintentar. |
| `ACCOUNT_TTY_REQUIRED` | Ejecutar `account` directamente en una terminal interactiva, sin redirección. |
| Credenciales incorrectas | URL exacta, correo y contraseña de **esa** copia. No reutilizar la del VPS, otra demo o el sistema operativo. |
| Aviso de certificado | CA de este clon importada y dirección `127.0.0.2:9445`. No desactivar la comprobación TLS. |
| `INTEGRIDAD NO CONFIRMADA` antes del arranque | Revisa que ejecutaste el verificador desde la carpeta que contiene `herramientas`; si indica «Archivo cambiado», extrae de nuevo el ZIP **sin modificarlo** y comprueba su SHA-256. El verificador está diseñado para fallar después de editar archivos del paquete. |
| El comando se ejecuta en la carpeta equivocada | Desde la raíz del ZIP, `Test-Path .\herramientas\verificar-paquete.cjs` debe ser `True`; desde `aplicacion`, `Test-Path .\scripts\local-demo.cjs` debe ser `True`. |
| `INSTALLATION_MISMATCH` / `RUNTIME_OWNER` / `RUNTIME_PERMISSIONS` | Ruta y usuario originales; no copiar runtime ni abrir sus permisos como reparación. |
| `HTTP 409` al editar | Versión desactualizada: conservar borrador, consultar y comparar antes de decidir. No repetir el guardado a ciegas. |
| `HTTP 429` o «Sesión bloqueada» tras muchas acciones seguidas | La API limita las peticiones a 100 por cada 15 minutos, además de límites específicos para autenticación. Espera el tiempo indicado por `Retry-After` o hasta que termine esa ventana; después usa **«Volver a comprobar la sesión»**. No elijas **«Cerrar sesión y descartar el borrador»** si tienes cambios sin guardar. Evita recorrer muchas secciones rápidamente. |
| Pantalla normativa vacía o revisión no habilitada | Comprobar empresa seleccionada, alcance, datos requeridos y referencias guardadas. No equivale a cumplimiento ni autoriza inventar datos. |

Al informar de un problema, indicar sistema operativo, versión Node/Docker/Compose, commit o ZIP, paso, mensaje y resultado esperado. Omitir contraseñas, cookies, tokens, claves y datos personales. No ejecutar limpiezas de volúmenes, cambios de permisos o regeneración de secretos como primer intento.

## Seguridad, licencias y entrega

La memoria, capítulo 7, recoge tres hallazgos prioritarios en una réplica R3: equivalencia de contraseñas largas por el límite de bcrypt, pérdida de incrementos concurrentes del contador de fallos y reutilización de un TOTP entre retos. **Esta actualización documental y la aceptación básica no acreditan su corrección.** También documenta autenticación reciente para alta MFA, distinción de cuentas en el registro y validación PDF superficial, además de avisos de dependencias. No hay certificado de seguridad ni una auditoría exhaustiva de esta instalación.

Usar solo datos ficticios. La presencia de módulos de protección de datos no demuestra conformidad RGPD del producto. Quedan decisiones operativas de conservación, supresión, custodia y rotación de claves que el ensayo local no resuelve. El almacenamiento de contraseñas con hash o el uso de HTTPS no eliminan los demás riesgos.

La licencia del código original es [MIT](LICENSE). Las dependencias y recursos ajenos conservan sus licencias y avisos: consultar [terceros](docs/terceros.md). Retirar recursos del árbol actual no elimina su presencia histórica ni concede permisos retroactivos. `.gitignore` no sanea objetos ya versionados; la revisión de secretos tiene un alcance acotado, no una garantía absoluta sobre todo el historial.

El historial real del grupo debe preservarse, sin fabricar autorías o contribuciones. La entrega etiquetada `v1.0-practica3` conserva su identidad. Las mejoras posteriores de esta guía se publican en `main`, con su historial, sin mover esa etiqueta ni presentar cambios documentales como nuevas pruebas funcionales. La eliminación de ramas es una operación separada y condicionada a conservar el trabajo útil; no forma parte de instalar ni probar el README.

Las [actas de aceptación Kali](docs/aceptacion-docente-20261017.md) y [Windows](docs/aceptacion-docente-windows-20261017.md) conservan evidencias fechadas, **no instrucciones vigentes de instalación ni el estado actual del servidor**. La memoria original también se conserva. Para instalar y evaluar la aplicación, sigue la sección [Para el profesorado](#para-el-profesorado) y descarga el ZIP público; no se requiere otro adjunto académico.
