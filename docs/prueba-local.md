# Prueba local del Workspace con datos ficticios

Esta instalación es independiente del servidor privado, de Gmail y de WireGuard. Se ejecuta en el ordenador donde se clona el repositorio. No requiere esperar una autorización de alta: un comando administrativo local crea una cuenta y una empresa exclusivamente ficticias. No concede administración global de la plataforma.

## Requisitos y alcance

- Git y acceso al repositorio de la entrega.
- Node.js 24 y OpenSSL en el equipo. En Windows se admite el OpenSSL incluido con Git for Windows en su ruta habitual.
- Docker Engine local con Docker Compose **v2**, o Docker Desktop iniciado en modo **contenedores Linux**. No se admiten contextos Docker remotos.
- Conexión a Internet para descargar las imágenes y dependencias en la primera construcción. No hay que instalar las dependencias de frontend/backend en el host.
- Puerto `127.0.0.2:9445` libre. MongoDB y el backend no publican puertos en el host.
- Solo la web participa en la red de entrada de Docker. Las redes de base de datos y comunicación con el backend siguen siendo internas. La publicación HTTPS está vinculada a loopback, no a todas las interfaces del ordenador.
- Las imágenes están fijadas para `linux/amd64`. Otras arquitecturas necesitan emulación y no están verificadas. Como previsión inicial, disponer de 4 GB libres para Docker y varios GB de disco; no es una medición de requisitos mínimos.

Este perfil no publica la aplicación en Internet ni sirve para producción. No introduzcas documentación, clientes o contraseñas reales. No copies `.env`, certificados, copias de Mongo ni secretos del servidor.

## 1. Obtener la versión de entrega

Clona la URL y selecciona la referencia exacta indicadas en el README definitivo de la entrega. Abre una terminal **en la raíz del clon**, donde están `backend`, `frontend`, `infra` y `scripts`. Estos archivos deben estar integrados en esa referencia; una propuesta o paquete de trabajo no equivale a una publicación en GitHub.

Comprueba los requisitos:

```sh
node --version
docker version
docker compose version
```

`docker version` debe mostrar cliente y servidor sin errores de permisos. No utilices un Docker remoto. En Linux, si Docker requiere `sudo`, usa el mismo usuario administrativo de forma consistente para todos los comandos siguientes (`sudo node ...`). No cambies permisos del socket de Docker para sortear el requisito.

## 2. Arrancar

```sh
node scripts/local-demo.cjs start
```

El primer arranque construye la web y el backend, genera claves aleatorias y un certificado HTTPS local, inicia MongoDB como réplica de un nodo con usuario de aplicación limitado y comprueba API, HTTPS y varios rechazos de acceso. Puede tardar varios minutos. Los siguientes arranques conservan los datos.

Al terminar debe aparecer `VERIFICADO: HTTPS local...`. La dirección es:

**https://127.0.0.2:9445/espacio-de-trabajo**

No uses HTTP, `localhost`, otro puerto ni la IP del servidor. No hace falta mantener esta terminal abierta: Docker ejecuta los contenedores en segundo plano; sí debe seguir iniciado Docker.

Si falla, no borres `.runtime` ni los volúmenes y no vuelvas a crear claves para intentarlo de nuevo. Conserva el mensaje y consulta el diagnóstico con quien mantiene la entrega. Un puerto ocupado no autoriza detener otra instalación.

## 3. HTTPS local

El certificado lo firma una CA creada **en este clon**. El lanzador valida esa CA, el nombre y la caducidad, pero no cambia la confianza del sistema ni del navegador. Por eso el navegador puede avisar de un emisor desconocido.

Para una prueba estable, importa únicamente el certificado público `.runtime/local-demo/tls/ca.crt` generado por este arranque en el almacén de autoridades de confianza de tu usuario o de un perfil de navegador dedicado, siguiendo el procedimiento de tu navegador/sistema. No importes una CA recibida de terceros ni las claves `ca.key` o `server.key`. Si tu equipo está gestionado y no permite hacerlo, pide autorización al responsable; no desactives la validación TLS globalmente.

En Windows, abre `ca.crt` → **Instalar certificado** → **Usuario actual** → **Colocar todos los certificados en el siguiente almacén** → **Entidades de certificación raíz de confianza**. Confirma solo si corresponde a la CA que acabas de generar. Algunos navegadores administran su propio almacén. En Linux importa la CA en el almacén del navegador utilizado para esta prueba; los nombres exactos del menú dependen del navegador. Reinicia el navegador si no recoge el cambio.

Si en Linux arrancaste con `sudo`, el navegador de tu usuario no puede leer la carpeta privada `.runtime`. Desde la raíz del clon, exporta **solo el certificado público** a la carpeta de salidas, que está excluida de Git:

```sh
sudo install -D -m 644 -- .runtime/local-demo/tls/ca.crt outputs/local-demo-ca.crt
```

Importa entonces `outputs/local-demo-ca.crt`. No cambies los permisos de `.runtime`, no copies ningún `.key` y no abras el navegador como administrador. Este paso no instala por sí mismo la confianza ni expone las claves privadas.

La clave privada de esta CA permite firmar certificados que tu usuario confiaría: conserva `.runtime` en tu equipo privado y no la compartas. La confianza instalada manualmente no desaparece al detener Docker. Retírala del almacén cuando termines definitivamente esta prueba, identificando exactamente esta CA; no elimines otras autoridades. El certificado del servidor dura 90 días y el operador rechaza su uso cuando queda menos de una semana. La renovación no está automatizada.

## 4. Crear la cuenta de prueba

Desde una terminal interactiva, después de arrancar:

```sh
node scripts/local-demo.cjs account
```

Se crean de forma transaccional:

- `admin.workspace@example.invalid`, con contraseña aleatoria que aparece **una sola vez** en esa terminal.
- `Empresa de prueba - NormativaCheck`, con identificador sintético `TEST00001` (no es un NIF validado).
- Una membresía de administrador de **esa empresa**, sin permisos globales de la plataforma.

Guarda la contraseña en un gestor local. No la publiques en capturas, informes ni el repositorio. Repetir el comando no revela ni cambia la contraseña, no reactiva permisos y no modifica una base que ya contiene otros usuarios u organizaciones.

La cuenta queda prevalidada exclusivamente para este ensayo. **No se envía ningún correo.** No uses «Crear cuenta», recuperación de contraseña ni Gmail como parte de este recorrido local. No se ha demostrado con ello el circuito de verificación de correo de producción.

## 5. Entrar y probar el Workspace

1. Abre la dirección HTTPS anterior e inicia sesión con el correo ficticio y la contraseña generada.
2. Selecciona `Empresa de prueba - NormativaCheck` si aparece el selector de organización.
3. Revisa las secciones del Workspace. La cuenta y la empresa existen realmente en MongoDB local: no es una sesión simulada en el navegador.
4. La instalación inicial **no rellena tareas, evidencias, evaluaciones ENS/RGPD ni conclusiones normativas**. Las vistas vacías son esperables. Crea un servicio/producto ficticio desde la sección de subespacios que presente esta versión y comprueba que aparece al actualizar la página. No interpretes un espacio vacío como una valoración favorable.
5. Utiliza los casos de prueba detallados de la entrega para continuar por requisitos, tareas, evidencias y revisión. Este instalador no sustituye esas pruebas funcionales ni declara verificadas todas las secciones.
6. Cierra sesión y comprueba que volver al área privada exige identificarte.

## 6. Detener, volver a arrancar y verificar

```sh
node scripts/local-demo.cjs status
node scripts/local-demo.cjs verify
node scripts/local-demo.cjs stop
node scripts/local-demo.cjs start
```

`stop` detiene **solo el proyecto de este clon**, sin eliminar contenedores, volúmenes, cuenta, claves ni documentos. El identificador del proyecto depende de la ruta del clon: no muevas la carpeta ni copies su `.runtime` a otra ubicación. Para comprobar persistencia, vuelve a entrar después de detener/arrancar y verifica que continúa el servicio ficticio creado.

`verify` comprueba infraestructura y rechazos básicos, no navega por la interfaz ni prueba todos los roles. Dos clones usan proyectos de datos diferentes, pero no pueden ocupar simultáneamente el mismo puerto. No hay arranque automático tras reiniciar el ordenador: inicia Docker y ejecuta `start`.

## Ensayo automatizado para mantenedores (no es el acceso normal del profesor)

```sh
node scripts/local-demo-qa.cjs
```

Solo se admite una copia sin `.runtime/local-demo`. Arranca Docker, crea cuenta/empresa sintéticas, inicia sesión por la API HTTPS real, crea y consulta un servicio ficticio, detiene/arranca sus contenedores, verifica persistencia, consulta el histórico y comprueba la revocación al cerrar sesión. Conserva los recursos y produce `.runtime/local-demo/qa-result.json` sin contraseñas ni cookies. La contraseña de este ensayo vive solo en memoria: para una demostración interactiva utiliza **otro clon** y el comando `account`, no este ensayo.

El resultado automatizado no acredita renderizado ni navegación en un navegador, envío de correo, funcionamiento en otro sistema operativo ni despliegue en Hetzner. Si falla, conserva el estado y el código de etapa; no repitas ni restablezcas la base para ocultar el fallo.

## Estado de validación de este candidato

La copia de ensayo anterior ha confirmado el arranque de los tres contenedores, HTTPS/API/Mongo y la conservación de la cuenta, empresa, membresía, servicio ficticio y su evento tras detener y arrancar los contenedores. Estas últimas comprobaciones proceden de la ejecución y capturas aportadas por el responsable del proyecto. La inspección de datos fue de solo lectura; no sustituye el acceso autenticado después del reinicio ni la navegación en el navegador.

El candidato incorpora una red de entrada solo para la web y conexiones HTTPS nuevas en cada comprobación. No necesita los scripts de recuperación utilizados durante el desarrollo. Las pruebas unitarias no demuestran por sí solas una instalación completa.

Pendiente de aceptación en esta copia limpia: completar el recorrido autenticado después del reinicio, cierre de sesión y navegación manual. Antes de entregar, repetir la receta desde el commit definitivo con el delta integrado. Una exportación del commit base con cambios superpuestos es un candidato compuesto, no la prueba de ese clon definitivo. No se ha modificado Hetzner para estas comprobaciones.
