# NormativaCheck - Práctica 3

NormativaCheck es una aplicación web académica para ayudar a pequeñas empresas españolas de software y servicios de ciberseguridad a **organizar qué necesitan revisar, sobre qué actividad o sistema, con qué documentos y con qué resultado razonado**. Reúne contexto empresarial, alcances, requisitos, tareas, documentos versionados, evidencias, revisiones e historial.

No es un certificador ni un asesor jurídico automático. Su catálogo es acotado: **no cubre todo el ENS ni toda la normativa de protección de datos**. Subir un PDF o terminar una tarea no acredita cumplimiento. Debe utilizarse con datos ficticios durante la evaluación: la memoria documenta límites y hallazgos de seguridad cuya corrección no queda acreditada por instalar esta demo.

**Referencia para la evaluación:** [v1.0-practica3](https://github.com/JoraTenshi/Normativa-Cyberseguridad/tree/v1.0-practica3). Comprueba en GitHub que la etiqueta existe y apunta al mismo commit que la entrega publicada; si no, detén la instalación. El código funcional `1e3a4f62fd0cca6927a97fc42fb9f86e847a6eb5` superó una instalación limpia y un recorrido básico real en Kali Linux. Esto no equivale a probar todos los módulos ni Windows. La memoria original describe R3, un commit anterior. La consulta remota de las 08:38 UTC del 17 de octubre, recogida en la nota de aceptación, fue una fotografía anterior a la publicación final, no su estado actual.

Para evaluar: leer primero **Versiones**, después **Instalación local**, **Primer uso** y **Pruebas y límites**. La [nota de aceptación y correspondencia](docs/aceptacion-docente-20261017.md) conserva las identidades, los resultados y la relación con la memoria.

## 1. Qué problema resuelve y qué contiene

La primera versión del proyecto (P1) utilizaba cuestionarios, puntuaciones y un Plan Director de Seguridad (PDS). P3 conserva la finalidad de orientar a la empresa, pero cambia el núcleo: una valoración debe explicar los hechos examinados, el requisito, el periodo y la evidencia que la sostiene. El código y los resultados históricos anteriores se conservan; no se reinterpretan como revisiones del modelo nuevo.

### Tres modos que no deben confundirse

| Modo | Para qué sirve | Dónde guarda la información |
| --- | --- | --- |
| Demo pública de la portada, sin cuenta | Explicar el producto mediante una empresa y documentos ficticios, con un recorrido guiado. | Estado de demostración en el navegador; no demuestra una operación real en MongoDB. |
| Workspace local para evaluación | Instalar web, API y MongoDB propios; crear una cuenta ficticia y probar el funcionamiento conectado. | MongoDB local en los volúmenes Docker de esa instalación. Es la receta principal de este README. |
| Instalación privada | Uso en un entorno administrado, con identidades, configuración y permisos propios. | Servicios y datos del entorno privado. No se instala ni se actualiza mediante la receta docente. |

La demo de portada no analiza documentos reales ni ejecuta IA. La instalación local no requiere Hetzner, WireGuard, Gmail, un dominio público ni las contraseñas del equipo del proyecto. Las pruebas de uno de estos modos no se trasladan automáticamente a los otros.

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

## 2. Versiones y correspondencia con la memoria

| Referencia | Identidad | Qué acredita |
| --- | --- | --- |
| Memoria técnica original, 16/10/2026, 51 páginas | R3: `2f52aac139a7d606d9102d55e95005be5e58949e` | Arquitectura, alcance, antecedentes, resultados y pendientes del momento en que se redactó. |
| Código del paquete docente probado | `1e3a4f62fd0cca6927a97fc42fb9f86e847a6eb5`; árbol `905ee9b0d947302943caf0b26c737b2d48b66a1e` | Base posterior a R3 con instalador local y correcciones integradas; recorrido básico aceptado en Kali. |
| Entrega académica en GitHub | Etiqueta [v1.0-practica3](https://github.com/JoraTenshi/Normativa-Cyberseguridad/tree/v1.0-practica3) | Referencia estable al commit final; verificar su SHA remoto y la CI, sin inferirlos del nombre de la etiqueta. |

R3 es antecesor de la base docente: la comparación documentada afecta a 43 archivos. Se añadieron el perfil portátil, mejoras de navegación, textos de recuperación/privacidad, transporte SMTP privado, documentación/licencia y herramientas administrativas separadas; se retiraron cuatro archivos del árbol actual. **No son el mismo commit.** El ensayo local no prueba el correo externo ni borra los hallazgos de seguridad de la memoria.

La memoria original no se ha alterado. Se lee junto con la [actualización de aceptación](docs/aceptacion-docente-20261017.md), que explica qué pendientes de instalación básica se han resuelto y cuáles siguen abiertos. Las referencias RF/PR de la memoria conservan su significado. El ensayo nuevo no convierte en aprobadas todas sus pruebas PR01-PR14.

Una integración que solo añada documentación producirá otro commit y otro árbol Git. El responsable de publicación debe identificarlo y verificar que las fuentes ejecutables y los lockfiles permanecen iguales a la base probada; si cambia código, deben repetirse las pruebas afectadas. No se presenta la aceptación de `1e3a4f62` como una prueba de cualquier `main` posterior.

## 3. Arquitectura y estructura del repositorio

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

La base contiene contraseña con bcrypt, correo verificado, TOTP y controles de sesión. La política de sesión es de **8 horas absolutas y 30 minutos de inactividad**; «Mantener la sesión» no elimina esos límites. La cuenta docente prevalidada es una excepción explícita del laboratorio y no prueba correo ni MFA.

Los registros y documentos tienen versiones. Una edición con una versión antigua puede devolver `HTTP 409`: se debe conservar el borrador, consultar el estado actual y decidir cómo resolverlo, no reenviar ciegamente ni sobrescribir trabajo ajeno. La [documentación de contratos](docs/) amplía los comportamientos concretos.

## 4. Instalación local para evaluación

### 4.1. Entorno comprobado y requisitos

El recorrido básico se ejecutó en **Kali Linux x86-64, Node 24.19.0, Docker Linux, Compose 2.40.3-3 y Firefox 140.12.0** mediante navegador automatizado sin interfaz visible, con TLS validado. No se ha acreditado instalación nativa Windows, macOS ni ARM. Kali no es un requisito del producto: es el entorno de esta evidencia.

Necesitas:

- Node.js **24.x** y OpenSSL en el equipo. El operador admite Node de versión mayor o igual a 24, pero esta entrega solo aporta evidencia de Node 24. En Windows también reconoce el OpenSSL de Git for Windows en `C:\Program Files\Git\usr\bin\openssl.exe`.
- Docker **local**, iniciado, con contenedores Linux y **Compose 2.x**. El operador rechaza Compose 1, 3, 4 o 5 y los contextos remotos; no basta con instalar una versión reciente de Docker Desktop sin comprobar su Compose.
- Arquitectura `linux/amd64`: las imágenes están fijadas a esa plataforma y a sus digest. Otras arquitecturas no están validadas.
- Internet para la primera descarga de imágenes y dependencias. No hace falta instalar `node_modules` en el host para esta receta Docker.
- Puerto **`127.0.0.2:9445`** libre y una carpeta local estable, fuera de sincronización con la nube. No moverla después de arrancar.
- Recursos para Docker. Como previsión, 4 GB de memoria disponibles y varios GB de disco; reservar 10 GB de disco da margen, **no es un mínimo medido ni una garantía**. El equipo anfitrión y Docker Desktop tienen requisitos adicionales propios.
- Git si se obtiene la entrega por clon; no hace falta Git para extraer el ZIP docente, salvo que se utilice su instalación de OpenSSL en Windows.

Comprobar en la terminal:

```sh
node --version
docker version
docker compose version
```

Se espera Node 24.x, cliente **y servidor** Docker accesibles y Compose v2.x. Si Linux necesita `sudo` para Docker, comprobar `sudo docker version` y `sudo docker compose version` y usar **`sudo node ...` de forma consistente** en los pasos del operador. No abrir permisos del socket, cambiar arbitrariamente de usuario ni copiar secretos para evitar ese control.

En un equipo administrado, la instalación de requisitos y la confianza en una CA pueden necesitar autorización. No se pide desactivar los controles del sistema. Las instrucciones Windows siguientes son una ruta documentada, **no una instalación Windows ya aceptada**.

### 4.2. Obtener una copia nueva de la versión correcta

**Desde GitHub, con la etiqueta de entrega verificada:**

```sh
git clone https://github.com/JoraTenshi/Normativa-Cyberseguridad.git NormativaCheck
cd NormativaCheck
git switch --detach v1.0-practica3
git rev-parse HEAD
```

El último comando debe coincidir con el SHA del recibo final de publicación. Esta secuencia de obtención no formó parte de la aceptación desde ZIP. **Si la etiqueta no existe o no coincide con el commit publicado, detenerse.** No completar un clon antiguo copiando archivos de otra rama. La consulta remota previa a este cierre queda fechada en la [nota de aceptación](docs/aceptacion-docente-20261017.md).

**Alternativa disponible para la evaluación: ZIP docente entregado por el grupo.** La revisión documental 2 se identifica como:

```text
NormativaCheck-profesores-1e3a4f62-validado-kali.zip
SHA-256: 20638994c996b7cfe11113555dc1f085bd61483852bb1f3b91c16f234437564f
```

No se inventa aquí un enlace de descarga público: el grupo debe proporcionar ese archivo y su huella por el canal académico. Se puede comprobar con `sha256sum NOMBRE.zip` en Linux o `Get-FileHash -Algorithm SHA256 -LiteralPath 'NOMBRE.zip'` en PowerShell, sustituyendo `NOMBRE.zip` por el nombre anterior. La huella detecta diferencias respecto del archivo recibido; no es una firma de identidad del remitente.

Extraer el ZIP en una carpeta nueva. En Windows, **Extraer todo**, no ejecutar dentro del ZIP. Abrir una terminal en `NormativaCheck-profesores-1e3a4f62`, donde están `VERSION.json`, `aplicacion`, `documentacion` y `herramientas`, y ejecutar:

```sh
node herramientas/verificar-paquete.cjs
cd aplicacion
```

Debe aparecer `INTEGRIDAD CORRECTA`. Los 593 archivos de `aplicacion` corresponden a `1e3a4f62`; los documentos externos complementan esa base. Esta revisión del README es posterior y no se presume incluida retroactivamente en el ZIP con la huella anterior.

**Desde aquí todos los comandos se ejecutan en la raíz de la aplicación**, donde están `frontend`, `backend`, `infra` y `scripts`. No copiar `.env`, `.runtime`, certificados, bases, cuentas ni dependencias de otra instalación.

### 4.3. Comprobar el puerto y arrancar

En Linux:

```sh
ss -lnt 'sport = :9445'
```

En PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 9445 -State Listen -ErrorAction SilentlyContinue
```

Si hay un servicio escuchando, resolver la colisión antes de continuar. No detener una instalación ajena ni modificar el puerto del paquete para ocultar el conflicto.

```sh
node scripts/local-demo.cjs start
```

En Linux con Docker administrativo, el equivalente es:

```sh
sudo node scripts/local-demo.cjs start
```

El operador construye web/backend desde sus fuentes y lockfiles, genera claves y certificados propios, inicia MongoDB y verifica HTTPS/API/Mongo y varios rechazos básicos. Esperar **`VERIFICADO: HTTPS local...`** y la finalización del comando. Puede tardar varios minutos. No ejecutar `npm install`, un `seed` manual o un `docker compose up` genérico como sustitución.

El origen es **https://127.0.0.2:9445**, en el mismo equipo que ejecuta Docker. No sustituirlo por `localhost`, HTTP o la dirección del servidor privado. Docker puede seguir en segundo plano al cerrar la terminal; debe continuar iniciado.

### 4.4. Confiar en la CA de esta instalación

La CA se genera en esta copia. El operador valida el certificado, pero **no cambia automáticamente la confianza del navegador**. Importar solo su certificado público, nunca una clave `.key` ni una CA descargada de otro usuario. Preferir un perfil de navegador dedicado al ensayo.

**Linux/Firefox:** si el arranque se hizo con `sudo`, exportar únicamente el certificado público:

```sh
sudo install -D -m 644 -- .runtime/local-demo/tls/ca.crt outputs/local-demo-ca.crt
```

En el navegador de tu usuario, abrir los ajustes de certificados/autoridades e importar `outputs/local-demo-ca.crt` para identificar sitios web. Si el arranque no necesitó `sudo`, se puede importar `.runtime/local-demo/tls/ca.crt` directamente. Los nombres del menú dependen del navegador. No abrir el navegador como administrador ni cambiar permisos de toda `.runtime`.

**Windows (procedimiento no aceptado de extremo a extremo en este ensayo):**

```powershell
Invoke-Item .\.runtime\local-demo\tls\ca.crt
```

Elegir **Instalar certificado → Usuario actual → Colocar todos los certificados en el siguiente almacén → Entidades de certificación raíz de confianza**. Comprobar que corresponde a la CA recién generada de esta instalación, `NormativaCheck Demo Local`. Reiniciar Edge/Chrome si no recoge el cambio; Firefox puede utilizar un almacén propio.

La confianza en Windows afecta al usuario, no solo a una pestaña. No desactivar TLS, aceptar todos los certificados ni compartir `.runtime`. Al terminar definitivamente, retirar únicamente la CA de este ensayo del almacén donde se importó; detener Docker no retira esa confianza. El certificado del servidor dura 90 días y el operador exige al menos una semana restante; no hay renovación automática.

### 4.5. Crear la cuenta ficticia e iniciar sesión

En una terminal **interactiva**, sin redirigir la salida:

```sh
node scripts/local-demo.cjs account
```

Mantener `sudo node ...` si se utilizó en el arranque Linux. El comando crea una cuenta `admin.workspace@example.invalid`, la organización `Empresa de prueba - NormativaCheck` y una contraseña aleatoria **propia de esa instalación**, que aparece una sola vez. Guardarla localmente; no enviarla por chat, incluirla en capturas ni escribirla en GitHub.

Repetir `account` no revela ni restablece la contraseña, no reactiva permisos y no sirve para completar una base con usuarios u organizaciones previos. Si se perdió, conservar el estado y pedir asistencia; no borrar datos para recuperarla.

Abrir **https://127.0.0.2:9445/espacio-de-trabajo**, iniciar sesión y seleccionar la empresa ficticia. La cuenta tiene administración de esa empresa, no de la plataforma. Está prevalidada exclusivamente para el laboratorio: **no utilizar Crear cuenta, recuperación de contraseña o MFA como parte de esta receta**. No se envía correo ni se prueba el registro de producción.

### 4.6. Estado, parada, reinicio y persistencia

```sh
node scripts/local-demo.cjs status
node scripts/local-demo.cjs verify
node scripts/local-demo.cjs stop
node scripts/local-demo.cjs start
```

Usar el mismo usuario/permisos y la misma carpeta que en el primer arranque. `stop` conserva contenedores, volúmenes, claves, cuenta y documentos; no equivale a desinstalar. La identidad del proyecto depende de la ruta del clon: **no mover la carpeta ni copiar `.runtime`**.

Después de reiniciar el ordenador, iniciar Docker y ejecutar `start`; no se promete arranque automático. `verify` comprueba infraestructura y accesos básicos, no todos los formularios ni los roles. Para comprobar persistencia hay que volver a iniciar sesión y leer los mismos datos, como indica el recorrido siguiente. Si falla, conservar mensaje y estado: no borrar volúmenes ni regenerar claves.

## 5. Primer uso y recorrido docente

### 5.1. Recorrido básico comprobado en Kali

1. Entrar con la cuenta generada y seleccionar `Empresa de prueba - NormativaCheck`.
2. Crear un servicio/producto ficticio desde la sección de espacios de trabajo. Usar un nombre reconocible, por ejemplo `Servicio docente`, y una descripción sin información real.
3. Recargar y comprobar que aparece el mismo servicio. Consultar su evento de creación en el historial: no basta con que la pantalla de historial abra.
4. Ejecutar `stop`, `start` y `verify` desde la raíz de esa copia.
5. Volver a iniciar sesión y comprobar el mismo servicio y su evento de creación.
6. Cerrar sesión. Volver al área privada y recargar: debe pedir identificación de nuevo.

La aceptación correlacionó navegador y lecturas de API con el mismo ID de servicio y evento. Se ejecutó con Firefox automatizado y TLS confiado, no mediante respuestas simuladas. **No fue una instalación autónoma realizada por un profesor ajeno al equipo** ni acredita todo el producto.

La cuenta nueva solo trae empresa y membresía. **No hay un expediente completo precargado:** faltan actividades, alcances, tareas, documentos, evidencias y revisiones hasta que se creen. Una vista vacía no significa que un requisito esté satisfecho.

### 5.2. Recorrido ampliado: guía, no aceptación integral

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

### 5.3. Demo guiada sin cuenta

Con la instalación local completa, abrir la portada del mismo origen y pulsar **Explorar la demo**, o entrar en `https://127.0.0.2:9445/#/demo`. Es un fragmento `/#/demo`, no la ruta `/demo`.

Seleccionar el servicio ficticio, consultar el diagnóstico, abrir **Tareas y responsables**, una tarea, **Fundamento** y su documento de muestra. **Ayuda → Iniciar recorrido** abre la guía. También existen `/#/demo/fundamento`, `/#/demo/documento` y `/#/demo/tarea`.

Los cambios de este modo pertenecen a la demo del navegador, no a la empresa autenticada. Sus contadores son tareas, no porcentajes de cumplimiento. No presentar su contenido precargado como si se hubiera creado y persistido en MongoDB durante la evaluación.

## 6. Configuración y conservación de datos

| Perfil | Configuración de entrada | Límites |
| --- | --- | --- |
| Docente local | [`infra/local-demo/profile.cjs`](infra/local-demo/profile.cjs) y `scripts/local-demo.cjs` generan `.runtime/local-demo/`; `NC_LOCAL_DEMO=1` y origen local. | No carga un `.env` prestado, no activa correo externo y no instala confianza TLS automáticamente. |
| Privado | [`infra/private/profile.example.json`](infra/private/profile.example.json) y generador `scripts/private/render-profile.cjs`. | Configuración nueva de `releaseRoot`, `stateRoot`, puerto, WireGuard y modo SMTP; generar archivos no despliega ni actualiza una instalación. |
| Backend genérico | [`backend/.env.example`](backend/.env.example): URI Mongo, puerto, origen, firma JWT, cifrado TOTP y SMTP. | Ejemplo técnico separado; copiarlo no sustituye el instalador docente ni prepara una base por sí solo. |

El perfil local genera secretos Mongo, clave de réplica, firma JWT y cifrado TOTP bajo `.runtime/local-demo/secrets/`; TLS bajo `.runtime/local-demo/tls/`. También crea Compose, Nginx, un entorno vacío y la identidad de la instalación. Los datos Mongo se conservan en volúmenes Docker; los PDF versionados están dentro de MongoDB. Ni esos volúmenes ni `.runtime` deben incluirse en el ZIP o el repositorio.

El perfil privado contiene modos `disabled`, `smtp465` y `smtp587`, con secreto externo propio y validación TLS. El ensayo local **no prueba su activación, Gmail, entrega de correo, verificación de una cuenta real ni recuperación**. Leer [operación privada](docs/operacion-privada.md) para el entorno administrado; no ejecutar aquí sus operadores ni herramientas `scripts/admin/private-demo/`.

Los atajos antiguos `make up`, `seed`, `setup`, `cert`, `recert` y `clean` están deshabilitados; el Compose de raíz requiere un perfil explícito. Los scripts históricos de laboratorio no sustituyen la receta docente. Algunas de sus plantillas siguen siendo dependencias del perfil local, como muestra el mapa de carpetas.

## 7. Pruebas, compilación y evidencia

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

| Evidencia del código base `1e3a4f62` | Resultado | Qué no demuestra |
| --- | --- | --- |
| Suite Backend en clon propio | 1.382 pruebas aprobadas. | Navegador, instalación Docker o correo externo. |
| Ensayo adicional con réplica Mongo temporal | 15 pruebas aprobadas. | Operación del VPS ni todos los recorridos de interfaz. |
| Ensayo SMTP/TLS local | 7 pruebas aprobadas. | Gmail, entrega de mensajes o MFA real. |
| Front en clon propio | 525 pruebas en 47 suites y compilación satisfactorias. | La parte de smoke con API simulada no acredita persistencia real. |
| Aceptación docente Kali, 17/10/2026 | Instalación desde ZIP, cuenta, HTTPS confiado, login, servicio, recarga/historial, stop/start, persistencia y logout. | Windows, todos los módulos, registro por correo, MFA, GitHub o Hetzner. |

**No sumar estos recuentos como una prueba de extremo a extremo.** La [nota de aceptación](docs/aceptacion-docente-20261017.md) separa resultados delegados, verificaciones de integridad, intentos incompletos y pruebas anteriores de la memoria. La construcción pudo reutilizar capas Docker locales; no se presenta como un equipo virgen sin ninguna caché.

`scripts/local-demo-qa.cjs` es un ensayo separado para mantenedores y exige una copia sin runtime. No es el acceso normal del profesor: la contraseña del automatismo vive solo en memoria. No ejecutarlo sobre la copia de uso ni emplearlo para recuperar una cuenta. La [guía técnica local](docs/prueba-local.md) conserva el detalle y los antecedentes, con actualización de estado enlazada al acta actual.

## 8. Si algo falla

| Mensaje o síntoma | Qué comprobar sin destruir datos |
| --- | --- |
| `NODE_24_REQUIRED` | Node 24 en el entorno que ejecuta el operador, también cuando se usa `sudo`. |
| `COMPOSE_V2_REQUIRED` | `docker compose version`: esta receta solo admite la familia 2.x. No borrar Docker ni cambiar su configuración institucional para sortearlo. |
| `REMOTE_DOCKER_REFUSED` / `LINUX_DOCKER_REQUIRED` | Docker debe ser local y ejecutar contenedores Linux. |
| `OPENSSL_REQUIRED` | OpenSSL accesible; en Windows se contempla la ruta de Git for Windows indicada. |
| `PORT_9445_BUSY` | Hay otro proceso escuchando. No pararlo sin identificar su propietario ni modificar el paquete. |
| `COMMAND_FAILED` | Leer las líneas anteriores; comprobar Docker, permisos, red y espacio. Conservar la etapa del fallo. |
| `ACCOUNT_TTY_REQUIRED` | Ejecutar `account` directamente en una terminal interactiva, sin redirección. |
| Credenciales incorrectas | URL exacta, correo y contraseña de **esa** copia. No reutilizar la del VPS, otra demo o el sistema operativo. |
| Aviso de certificado | CA de este clon importada y dirección `127.0.0.2:9445`. No desactivar la comprobación TLS. |
| `INSTALLATION_MISMATCH` / `RUNTIME_OWNER` / `RUNTIME_PERMISSIONS` | Ruta y usuario originales; no copiar runtime ni abrir sus permisos como reparación. |
| `HTTP 409` al editar | Versión desactualizada: conservar borrador, consultar y comparar antes de decidir. No repetir el guardado a ciegas. |
| Pantalla normativa vacía o revisión no habilitada | Comprobar empresa seleccionada, alcance, datos requeridos y referencias guardadas. No equivale a cumplimiento ni autoriza inventar datos. |

Al informar de un problema, indicar sistema operativo, versión Node/Docker/Compose, commit o ZIP, paso, mensaje y resultado esperado. Omitir contraseñas, cookies, tokens, claves y datos personales. No ejecutar limpiezas de volúmenes, cambios de permisos o regeneración de secretos como primer intento.

## 9. Seguridad, licencias y entrega

La memoria, capítulo 7, recoge tres hallazgos prioritarios en una réplica R3: equivalencia de contraseñas largas por el límite de bcrypt, pérdida de incrementos concurrentes del contador de fallos y reutilización de un TOTP entre retos. **Esta actualización documental y la aceptación básica no acreditan su corrección.** También documenta autenticación reciente para alta MFA, distinción de cuentas en el registro y validación PDF superficial, además de avisos de dependencias. No hay certificado de seguridad ni una auditoría exhaustiva de esta instalación.

Usar solo datos ficticios. La presencia de módulos de protección de datos no demuestra conformidad RGPD del producto. Quedan decisiones operativas de conservación, supresión, custodia y rotación de claves que el ensayo local no resuelve. El almacenamiento de contraseñas con hash o el uso de HTTPS no eliminan los demás riesgos.

La licencia del código original es [MIT](LICENSE). Las dependencias y recursos ajenos conservan sus licencias y avisos: consultar [terceros](docs/terceros.md). Retirar recursos del árbol actual no elimina su presencia histórica ni concede permisos retroactivos. `.gitignore` no sanea objetos ya versionados; la revisión de secretos tiene un alcance acotado, no una garantía absoluta sobre todo el historial.

El historial real del grupo debe preservarse, sin fabricar autorías o contribuciones. Antes de cerrar GitHub se debe comprobar la integración completa, la identidad remota de `main` y `v1.0-practica3`, la CI correspondiente y cualquier diferencia respecto de las fuentes aceptadas. La eliminación de ramas es una operación separada y condicionada a conservar el trabajo útil; no forma parte de instalar ni probar el README.

La [cronología de entrega](docs/entrega-practica3.md) conserva resultados anteriores. La [nota del 17/10](docs/aceptacion-docente-20261017.md) actualiza únicamente la identidad y aceptación básica docente que están documentadas. No sustituye la memoria original, el vídeo, sus minutos de trazabilidad ni la entrega efectiva en el campus.
