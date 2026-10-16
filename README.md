# NormativaCheck — Práctica 3

Aplicación web para organizar requisitos de seguridad, responsables, documentos, evidencias y revisiones de pequeñas empresas españolas de software y ciberseguridad. Es una herramienta de apoyo al trabajo: **no certifica cumplimiento, no cubre todo el ENS o el RGPD y no sustituye una revisión profesional**.

## Qué contiene esta entrega

El producto distingue dos espacios:

- **Demostración sin cuenta:** empresa ficticia Linde Studio, documentos de muestra y cambios conservados en el navegador. No analiza documentos reales ni ejecuta un análisis de IA.
- **Espacio de trabajo autenticado:** API y MongoDB, permisos de organización, contexto empresarial, operaciones, documentación PDF versionada, revisiones, actuaciones e historial. Requiere cuenta habilitada y membresía; registrarse no concede acceso a una organización.

El catálogo incluye diez fichas activas, cuatro de ENS. Su cobertura es parcial. La detección orientativa de necesidad de EIPD no constituye una EIPD. Los resultados históricos se conservan y no se reinterpretan como resultados del modelo actual.

La referencia académica de entrega es la etiqueta `v1.0-practica3`, que debe apuntar al commit comprobado. Consulta [el estado de la entrega](docs/entrega-practica3.md) para distinguir código, pruebas, publicación e instalación. La existencia de este README en un candidato local no acredita que la etiqueta esté publicada: el recibo de cierre debe identificar el SHA y la referencia remota verificados.

## Requisitos previos

Para compilar y ejecutar las pruebas: Git, Node.js 24 y npm, conexión para descargar las dependencias fijadas por los dos `package-lock.json`, y un navegador actualizado. No hace falta GNU Make para los comandos de este documento.

Para la aplicación completa se necesitan además MongoDB con réplica y autenticación, configuración y claves propias, HTTPS y el perfil de despliegue revisado. El despliegue privado utiliza Docker Compose; la entrada de la raíz requiere Compose 2.20.3 o posterior y un perfil explícito. **El entorno de pruebas de código no equivale a instalar esos servicios.**

## Obtener el código y comprobarlo

Ejemplo para una carpeta nueva, sin reutilizar `.env`, dependencias ni archivos de otra rama:

```bash
git clone https://github.com/JoraTenshi/Normativa-Cyberseguridad.git
cd Normativa-Cyberseguridad
git switch --detach v1.0-practica3
git rev-parse HEAD
```

El último comando debe mostrar el SHA del recibo final de entrega. Si la etiqueta todavía no está publicada, la entrega no está cerrada: no sustituirla por R3 ni por una rama diferente, ni completar el clon con archivos prestados de otras copias.

### Backend: instalar dependencias y ejecutar pruebas

Desde la raíz del clon:

```bash
cd backend
npm ci --ignore-scripts --no-audit --no-fund
npm test
cd ..
```

Estas pruebas no deben recibir URI, claves o credenciales de una instalación real. No son una prueba completa de navegador ni de entrega de correo.

### Frontend: instalar dependencias, probar y compilar

En Bash, desde la raíz:

```bash
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
CI=true npm test -- --watchAll=false --runInBand
CI=true GENERATE_SOURCEMAP=false npm run build
cd ..
```

En PowerShell, después de entrar en `frontend` e instalar las dependencias:

```powershell
$env:CI = 'true'
npm test -- --watchAll=false --runInBand
$env:GENERATE_SOURCEMAP = 'false'
npm run build
```

El resultado de compilación queda en `frontend/build/`; es generado y no se sube al repositorio. La definición de referencia de las comprobaciones está en [canonical-checks.yml](.github/workflows/canonical-checks.yml). Un resultado satisfactorio de CI no acredita por sí solo SMTP, un acceso docente o el despliegue en Hetzner.

## Probar la demostración sin cuenta

Con las dependencias del frontend instaladas, en una terminal nueva desde la raíz del clon, iniciar el servidor de desarrollo **solo en loopback**:

```bash
cd frontend
HOST=127.0.0.1 BROWSER=none npm start
```

Equivalente en PowerShell, desde `frontend`:

```powershell
$env:HOST = '127.0.0.1'
$env:BROWSER = 'none'
npm start
```

Abrir la dirección que muestre el servidor (normalmente `http://127.0.0.1:3000/`) y pulsar **Explorar la demo**, o añadir `/#/demo` al origen. No es `/demo`: la demostración se resuelve en el fragmento de la portada. Este modo no inicia el backend ni habilita el Workspace real. La capa de sesión puede intentar consultar la API ausente; no debe presentarse como una instalación completa sin incidencias de red.

Recorrido básico de la demo:

1. Elegir el servicio ficticio, por ejemplo Trama, SaaS propio.
2. Consultar el diagnóstico de partida y sus fuentes.
3. Abrir **Tareas y responsables** y una tarea del caso.
4. Leer **Fundamento** y el documento de muestra relacionado.
5. Cambiar el estado o responsable del caso ficticio y consultar **Histórico de tareas**.
6. Usar **Ayuda → Iniciar recorrido** para la guía integrada.

También existen las entradas `/#/demo/fundamento`, `/#/demo/documento` y `/#/demo/tarea`. No introducir información personal, confidencial o documentos de la empresa. Los contadores son tareas, no porcentajes de cumplimiento; terminar una tarea no demuestra conformidad normativa.

## Aplicación completa y acceso de prueba

El acceso autenticado utiliza `/auth` y `/espacio-de-trabajo`. Una cuenta con correo verificado no obtiene automáticamente una organización ni permisos. La aprobación de altas de organizaciones exige una capacidad de plataforma distinta de ser administrador de una organización, además de los controles de autenticación correspondientes.

No hay una contraseña compartida publicada en este repositorio. La demostración anterior no requiere credenciales. El acceso al servidor privado necesita identidades confirmadas, roles limitados y concesión expresa; no se da por habilitado por la existencia de este README. El ensayo local descrito a continuación es distinto: utiliza una cuenta ficticia generada en el equipo del evaluador, sin acceso al servidor.

### Instalación local para evaluación

El operador `scripts/local-demo.cjs` y la guía pertenecen al perfil portátil incorporado al candidato local `5ab82da81fd02503a34a424a7ca504ca75964f7d`. El corte de entrega debe contenerlos junto con las correcciones posteriores verificadas. No están en R3 y no debe completarse un clon R3 copiando archivos de otras ramas. Preparar un clon limpio no acredita por sí solo arranque Docker o aceptación autenticada: consultar el recibo del corte final.

Seguir [Prueba local del Workspace](docs/prueba-local.md). Requiere Node.js 24, OpenSSL y Docker local con Compose v2 y contenedores Linux. Las imágenes están fijadas para `linux/amd64`; otras arquitecturas no están verificadas. Puerto `127.0.0.2:9445` libre. No requiere WireGuard ni correo real, y no publica backend o MongoDB en puertos del host.

Comprobar primero que Docker local responde sin errores. En Linux, si requiere `sudo`, utilizar consistentemente `sudo node ...` para todos los comandos del operador de ese clon, como indica la guía. No cambiar permisos del socket ni de `.runtime` para evitar ese control.

Desde la raíz de un clon nuevo de la referencia final, sin copiar `.env`, `.runtime`, datos o certificados de otra instalación:

1. Iniciar Docker y ejecutar `node scripts/local-demo.cjs start`. Esperar la comprobación satisfactoria, no solo contenedores saludables.
2. Seguir la guía para confiar expresamente en el certificado público de la CA generada en ese clon. Si se arrancó con `sudo` en Linux, utilizar la exportación del certificado público descrita allí; no cambiar permisos de `.runtime` ni abrir el navegador como administrador. No importar claves privadas ni desactivar globalmente la validación HTTPS.
3. Ejecutar `node scripts/local-demo.cjs account` en una terminal interactiva. Se crea `admin.workspace@example.invalid`, una empresa ficticia y una contraseña aleatoria que se muestra una sola vez. Guardarla en un gestor local; no publicarla en el README, capturas o informes.
4. Abrir **https://127.0.0.2:9445/espacio-de-trabajo**, iniciar sesión y seleccionar la empresa ficticia. Crear un servicio/producto ficticio y comprobarlo al recargar. La instalación no precarga tareas, documentos o conclusiones normativas; una vista vacía no es un resultado favorable.

La cuenta es administradora únicamente de la empresa de prueba, no de toda la plataforma. Su prevalidación es exclusiva de este laboratorio y no acredita entrega de correo; registro público y recuperación de contraseña no forman parte de este recorrido.

Para detener, volver a iniciar y comprobar la instalación:

```sh
node scripts/local-demo.cjs stop
node scripts/local-demo.cjs start
node scripts/local-demo.cjs verify
```

`stop` está diseñado para conservar datos, claves y cuenta. No mover la carpeta ni copiar `.runtime`. Después de volver a iniciar, comprobar también en el navegador el servicio ficticio y que cerrar sesión impide volver al área privada sin identificarse. `verify` comprueba infraestructura y rechazos básicos: no sustituye ese recorrido autenticado. Si falla, conservar el estado y pedir diagnóstico; no borrar volúmenes ni restablecer cuentas para repetirlo.

La cronología, pruebas y pendientes se conservan en [el estado de la entrega](docs/entrega-practica3.md). Los 20 controles seleccionados iniciales no son una regresión completa; las pruebas de otra copia no se trasladan automáticamente al corte final. El recibo de aceptación debe identificar las fuentes probadas y distinguir tests de código, navegador, persistencia autenticada y publicación. El ensayo automatizado opcional de mantenedores no es el acceso normal del profesor.

Para la instalación privada, leer [operación privada](docs/operacion-privada.md) y [los pendientes de reproducibilidad](docs/entrega-practica3.md). El perfil está en `infra/private/`; `scripts/private/render-profile.cjs` genera configuración en un directorio nuevo, pero **no instala ni actualiza la aplicación**. La plantilla no contiene los secretos de la instalación. No ejecutar el generador sobre la configuración activa ni copiar valores de producción a un laboratorio.

El procedimiento de `infra/integration/` se conserva como laboratorio histórico: está ligado a una ruta, usuario y entorno concretos de Kali. **No es una receta portátil de instalación nueva ni el procedimiento de Hetzner.** No debe sustituir el candidato portátil anterior ni usarse para dar por probado su arranque.

Un `docker compose up` sin perfil explícito se detiene. Los atajos antiguos `make up`, `seed`, `setup`, `cert`, `recert` y `clean` están deshabilitados; no deben sustituirse por comandos improvisados que borren o regeneren datos.

## Configuración

Cada perfil tiene una entrada distinta; no combinar sus ejemplos:

| Perfil | Entrada y configuración | Alcance |
|---|---|---|
| Local del profesor | `scripts/local-demo.cjs` genera `.runtime/local-demo/` y no carga un `.env` copiado. Fija `NODE_ENV=production`, `NC_LOCAL_DEMO=1` y `APP_URL`/`CORS_ORIGIN` al origen HTTPS local. | Cuenta y empresa ficticias, sin correo real. Configuración derivada de `infra/local-demo/profile.cjs`; no editar manualmente el runtime. |
| Privado WireGuard | `infra/private/profile.example.json`: `releaseRoot`, `stateRoot`, `port`, `wireguardUnit`, `smtpMode`; el generador deriva `NC_HTTPS_ORIGIN`, `APP_URL`, `CORS_ORIGIN` y `NC_MAIL_MODE`. | Rutas y puerto se ajustan solo por el operador para una instalación nueva; la plantilla no reproduce automáticamente el estado de Hetzner. |
| Entrada genérica del backend | `backend/.env.example`: `MONGODB_URI`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`, `APP_URL`, `EMAIL_VERIFICATION_TTL_HOURS` y campos `SMTP_*`. | Ejemplo técnico separado, no configuración del instalador local ni del perfil privado. No es una instalación completa soportada por copiar este archivo. |
| Laboratorio histórico | `infra/integration/`, con guardas de ruta/usuario y origen propios. | No sustituye el instalador docente ni las operaciones de Hetzner. |

En el perfil local, las contraseñas Mongo, la clave de réplica, la firma JWT y el cifrado TOTP se generan en archivos separados bajo `.runtime/local-demo/secrets/`; TLS se genera bajo `.runtime/local-demo/tls/`. El operador también crea la configuración Compose, `nginx.conf`, un archivo de entorno vacío y la identidad del clon. No se necesitan secretos de otro equipo ni valores manuales para iniciar este perfil. No versionar, compartir ni copiar su runtime entre clones.

El perfil privado integrado admite `disabled`, `smtp465` y `smtp587`. Los dos modos SMTP requieren un archivo secreto `smtp_config` con las claves `host`, `port`, `username`, `password` y `from`, y el puerto correspondiente: 465 con TLS desde el inicio o 587 con STARTTLS obligatorio. Ambos validan el certificado del servidor; no se admite degradar a texto claro. El archivo secreto se monta como solo lectura y no pertenece al repositorio. Integrar este transporte no lo activa en una instalación existente: requiere una operación revisada y comprobación separada. La autenticación SMTP satisfactoria tampoco demuestra entrega de correo. No inferir registro o recuperación completados a partir de una respuesta HTTP genérica.

Esta correspondencia se ha inspeccionado en las fuentes del candidato; debe revalidarse tras integrar el corte final. No publicar claves reales, certificados privados, URI con contraseñas ni datos personales. Las claves de firma y cifrado deben generarse y custodiarse por separado; perderlas puede impedir recuperar sesiones o MFA.

## Estructura

- `frontend/`: aplicación React, portada, demo y espacio autenticado.
- `backend/`: API, permisos, modelos, reglas de negocio y pruebas.
- `infra/private/` y `scripts/private/`: perfil privado y herramientas de configuración e identidad de entrega.
- `infra/integration/`: laboratorio histórico, no instalador genérico.
- `infra/local-demo/` y `scripts/local-demo.cjs`: instalación local aislada para evaluación, con datos ficticios y sin correo real.
- `scripts/admin/private-demo/`: herramientas administrativas acotadas, externas a la imagen de producción; no se ejecutan durante instalación, arranque o CI. Su README describe los controles y pruebas adicionales exigidos.
- `docs/`: contratos, operación, decisiones y límites.
- `.github/workflows/`: comprobaciones automatizadas.
- `qa-dev/`: herramientas de QA específicas; no son un instalador ni deben ejecutarse contra producción por defecto.

## Historial, licencias y seguridad del repositorio

Debe conservarse el historial real del grupo. No se crean autores o commits artificiales para simular participación. El código legado se mantiene cuando es necesario para dependencias e históricos; que exista una ruta histórica no significa que sea la experiencia principal del producto P3.

La licencia elegida para el código original de NormativaCheck es **MIT**, con el texto en [LICENSE](LICENSE). Permite reutilización, modificación y distribución, también comercial, conservando los avisos de autoría y licencia. La autoría real permanece reflejada en el historial; la licencia no la sustituye ni fabrica contribuciones.

Las dependencias, recursos y contenidos de terceros conservan sus propias licencias y atribuciones; no se relicencian mediante el archivo del proyecto. El [inventario de terceros](docs/terceros.md) identifica las dependencias directas revisadas, los avisos que deben conservarse y el tratamiento de los recursos retirados. La retirada del árbol final no elimina su presencia en commits históricos ni les atribuye retrospectivamente permisos o licencia MIT.

`.gitignore` excluye secretos, dependencias y varios artefactos generados; no elimina archivos ya versionados ni limpia el historial. El estado de la entrega documenta el alcance y los límites de la revisión de secretos, sin garantizar su ausencia absoluta. Si se identifica un secreto real, no basta con borrarlo del último commit: su revocación y el saneamiento requieren un procedimiento separado, sin difundir el valor.
