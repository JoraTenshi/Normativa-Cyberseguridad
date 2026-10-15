# Sesiones del Workspace: modelo, política y servicio persistente

> ACTUALIZACIÓN — 11/10/2026, bloque 3: este documento conserva el registro histórico de los bloques 1 y 2 en normativa_check. En el nuevo worktree normativa_integracion ya se han conectado login, MFA y middleware al servicio persistente. El estado vigente, pruebas, contratos y pendientes están en [integracion-workspace-20261011.md](integracion-workspace-20261011.md).
>
> No confundir las afirmaciones históricas «no conectado» o «sin integración de ramas» de más abajo con el estado del worktree nuevo. La app final aún no está desplegada ni verificada de extremo a extremo.

Fecha: 11 de octubre de 2026, Europe/Madrid.

## Acuerdo y alcance

Jose aprueba ocho horas máximas desde la autenticación y treinta minutos de inactividad. Mantener la sesión conserva la cookie entre aperturas del navegador únicamente dentro de esos límites; no añade horas ni sustituye el 2FA. Quiere explicar e implementar la seguridad paso a paso antes de integrar el Workspace con la aplicación del grupo.

Estado actual: los bloques 1 y 2 están implementados y probados. Hay modelo, política temporal y servicio persistente, con índices comprobados únicamente en Mongo temporal. NO cambia login, middleware, cookies, frontend ni despliegue, ni toca datos reales. No es todavía la funcionalidad de sesión completa.

## Dónde está

Base local: /home/kali/Documents/practica3/normativa_check, rama backend, HEAD fb99b0adde243d3473b8e2198f0a55d08604e7f0 con cambios previos conservados.

- backend/models/SesionUsuario.js: forma de una sesión concreta de usuario, con huella del identificador, versión de credenciales, fechas, preferencia de persistencia y revocación.
- backend/services/politicaSesion.js: crearEstadoSesion, evaluarVigencia y prepararActividad; versión de política 1, ajena a las antiguas fórmulas de puntuación.
- backend/tests/politicaSesion.test.js y backend/tests/sesionUsuarioModel.test.js: 35 pruebas nuevas con reloj fijo y datos ficticios.

## Funcionamiento y límites

El servidor deberá crear una sesión solo después de completar la autenticación, incluido MFA cuando esté habilitado. No se guardan contraseñas, JWT completos, cookies, secretos 2FA ni permisos de organización en este modelo. identificadorHash representa una huella, no el secreto original. La identidad, autenticidad del token y permisos siguen necesitando comprobaciones independientes.

autenticadaEn fija el origen del máximo absoluto. ultimaActividadEn permite calcular el límite de inactividad. expiraEn permanece exactamente a ocho horas del inicio. La siguiente caducidad es el menor de ambos límites. Las comparaciones incluyen el instante exacto del vencimiento.

mantenerSesion solo registra la preferencia; no amplía ninguna fecha. Consultar la vigencia no modifica el registro. prepararActividad devuelve un cambio propuesto, pero no escribe en Mongo ni autoriza una petición. Los sondeos de estado y relojes no deberán registrar actividad automáticamente.

El servicio del bloque 2 comprueba y actualiza el registro en una sola operación de Mongo; se han probado persistencia y carreras de actividad/revocación con datos ficticios. No se ha conectado a las peticiones autenticadas del Workspace.

No se añade TTL ni se borran registros automáticamente. Se decidirá la retención por separado; en ningún caso la autorización puede depender de cuándo Mongo elimine un documento. La validación del esquema no demuestra existencia del usuario ni unicidad en una base real.

## Verificación realizada

En Kali:

```bash
cd /home/kali/Documents/practica3/normativa_check/backend
node --test tests/politicaSesion.test.js tests/sesionUsuarioModel.test.js
npm test
```

Registro del bloque 1: 35/35 pruebas nuevas y suite 838/838. El bloque 2 añade siete pruebas unitarias: 42 en total para estos módulos, además de 21 grupos de persistencia con Mongo temporal 7.0.43. La suite completa pasa 845/845, sin fallos, cancelaciones u omisiones. Se comprueban fronteras, campos no admitidos, revocación, reloj, caída de base y concurrencia. No son 845 pruebas de navegador. git diff --check correcto.

No se ha hecho commit, push, integración de ramas, cambio de dependencias, modificación de .env, seed ni reinicio de Docker.

## Lo que falta para poder usarlo

1. Completado en código aislado: servicio persistente de creación, comprobación, actividad y revocación; pruebas con Mongo temporal, incluida concurrencia.
2. Conexión con autenticación real y middleware, después de MFA; logout y cambios de credenciales deben invalidar accesos.
3. Transporte HTTPS y cookies adecuadas y separadas para Workspace. El runner actual es HTTP, con cuentas de demo seleccionables y vida propia de cuatro horas: no es aún una prueba de login real ni permite afirmar ocho horas operativas.
4. Casilla de persistencia, aviso/caducidad y tratamiento seguro de borradores; comprobar reapertura y sesiones en varias pestañas.
5. Reautenticación para acciones sensibles, pruebas negativas y recorrido conjunto. Acciones y ventana de autenticación reciente pendientes de concretar.

## Métricas: aclaración separada, sin implementación en este bloque

Jose quiere porcentajes, cifras y gráficos interactivos basados en trabajo revisado favorablemente que satisface requisitos del corpus aplicable; no fórmulas heredadas ni eliminación de código. La propuesta técnica es vincular tareas, evidencias y revisión a requisitos y evitar contar varias tareas de una obligación como varias obligaciones cumplidas. Fórmula exacta, granularidad, responsables, criterios, denominador y visualización siguen pendientes. El agregado deberá declarar alcance/fecha/cobertura y no equivaler a una certificación. No se construye ahora el dashboard.

Fuentes técnicas:
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://www.mongodb.com/docs/manual/core/index-ttl/

## Bloque 2: qué aporta y cómo se usa

Nuevo servicio: backend/services/sesionesUsuario.js. Expone crearServicioSesiones y cuatro métodos internos:

- crear: recibe usuario y versión de credenciales resueltos por el servidor después de autenticar. Genera 32 bytes aleatorios y devuelve el identificador una sola vez al código llamador. Guarda su SHA-256, no el secreto. En la ejecución normal obtiene la hora de Mongo y valida el modelo antes de guardar.
- consultar: comprueba identidad, versión y límites sin modificar la sesión. La respuesta usa una lista de campos permitidos; no incluye identificadores secretos ni hashes.
- registrarActividad: filtro y actualización atómicos. Exige una sesión válida y no revocada, limita ocho horas absolutas y treinta minutos de inactividad, y solo escribe ultimaActividadEn y updatedAt. No existe upsert. Un sondeo, reloj o refresco automático no debe llamar a este método.
- revocar: marca la sesión de forma irreversible y repetible sin borrar registros ni afectar a otro dispositivo. También revoca si caducó. Si el reloj retrocede, conserva una fecha coherente con la actividad anterior, sin dejar la sesión abierta.

Las consultas y actualizaciones normales usan $$NOW, el tiempo de Mongo dentro de la operación; no toman una fecha enviada por el navegador. relojPruebas es una dependencia inyectada al construir el servicio exclusivamente para comprobar fronteras temporales sin esperar ocho horas. No se publica en HTTP ni se lee de .env.

El servicio compara el usuario y versionCredenciales facilitados por el llamador con los de la sesión. NO consulta por sí mismo la cuenta ni valida contraseña, JWT, MFA o membresías. El siguiente bloque debe obtener la versión actual de Usuario.sessionVersion, no fiarse de una versión vieja del token. Debe resolver también los cambios de contraseña concurrentes con un login. No se considera implementada la revocación global de credenciales por haber añadido este servicio.

El módulo devuelve SESION_NO_VALIDA para sesiones desconocidas/no vigentes y lanza SESIONES_NO_DISPONIBLES con status 503 ante errores de base. Son resultados internos: el futuro controlador deberá traducirlos a HTTP. Si la base falla, no hay permiso por defecto. No se exponen detalles del driver.

La atomicidad se refiere a un documento de sesión. Si una petición ya fue autorizada antes del cierre, este bloque no cancela retrospectivamente su trabajo. Las acciones sensibles y las transacciones de negocio necesitan controles específicos. No se han probado failover multinodo ni alta disponibilidad.

## Repetir la comprobación aislada

Nuevos archivos de prueba:

- backend/tests/sesionesUsuario.test.js: siete pruebas unitarias, sin conexión.
- backend/scripts/check-sesiones-mongo.js: 21 grupos contra Mongo temporal; incluye índices reales, huella sin secreto, límites exactos, otra identidad/versión, sondeos sin renovación, revocación y actividad concurrentes, reloj atrasado y conexión cerrada.
- backend/scripts/run-sesiones-mongo.js: reutiliza el ejecutor temporal existente, sin .env ni URI externa, con puerto loopback aleatorio y directorio propio. Al terminar detiene su proceso y elimina únicamente sus datos sintéticos temporales.

Comandos en Kali:

```bash
cd /home/kali/Documents/practica3/normativa_check/backend
node --test tests/politicaSesion.test.js tests/sesionUsuarioModel.test.js tests/sesionesUsuario.test.js
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod node scripts/run-sesiones-mongo.js
npm test
```

La ruta del binario se verificó en esta sesión, pero está en /tmp y puede desaparecer tras un reinicio. No es una dependencia permanente del producto. Si no existe, hay que localizar un mongod compatible; NO sustituirla por la URI de la base del equipo.

No se ha cambiado app.js, auth, frontend, dependencias, .env, Docker ni ramas por este bloque. Sin commit o push. Los únicos consumidores del nuevo servicio son sus comprobaciones; no se está aplicando al login real.

## Métricas dinámicas: petición posterior de Jose

Jose propone poder filtrar porcentajes o puntuaciones por tareas, requisitos y temáticas para consultar distintos puntos de vista. Se recoge como dirección funcional, sin implementar ahora cálculo ni dashboard. La propuesta técnica es separar avance de tareas de requisitos con revisión favorable, mostrar numerador/denominador/alcance del filtro, no duplicar requisitos por número de tareas y distinguir revisión pendiente de aplicabilidad sin resolver. Fórmulas, etiquetas y criterios concretos siguen por cerrar.

Fuentes del bloque 2:
- https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
