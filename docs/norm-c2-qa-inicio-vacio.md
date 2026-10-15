# QA de Normativa desde una empresa vacía

Este runner no es el arranque habitual de la aplicación. Sirve exclusivamente para comprobar el onboarding sin bases precargadas. Crea MongoDB temporal propio y dos usuarios ficticios, y lo detiene al finalizar. No lee .env, no acepta una URI de Mongo externa ni modifica Docker9443 o landing4192.

## Contrato

`backend/scripts/serve-normativa-browser-check.js` admite:

- Sin argumentos: escenario R3 precargado, puerto loopback4282, comportamiento anterior.
- `--empty`: organización y membresías sintéticas; sin contexto, operaciones, alcances, registros normativos ni PDF. Puerto exclusivo4284.
- `--smoke`: comprobación HTTP de sesión y datos, termina sin esperar interacción. No es una prueba de navegador.
- `--port=4284`: permite probar el escenario precargado de manera separada sin ocupar4282. No admite otros puertos salvo4282/4284, y una empresa vacía nunca usa4282.

Ejecutar desde backend, con el binario Mongo de pruebas y el build QA de Front, ambos verificados. Ejemplo del corte14oct2026, sustituyendo el build únicamente por otro `/tmp/norm-c2-front-build.*` que Front haya entregado:

```sh
MONGOD_TEST_BINARY=/tmp/nc-org03-mongo.edcKZu/bin/mongod \
NC_C2_FRONT_BUILD=/tmp/norm-c2-front-build.rKb5Ve \
node scripts/serve-normativa-browser-check.js --empty
```

La consola devuelve el ID nuevo y credenciales públicas exclusivas de la prueba. Usar `http://localhost:4284`, no un origen diferente. Si se accede desde Windows requiere un túnel loopback de ese mismo puerto; no abrir un puerto público ni cambiar certificados o red. No reutilizar cuentas habituales. La sesión web se comparte por hostname entre puertos: finalizar las comprobaciones del otro runner antes de iniciar sesión en el vacío, o coordinar el cambio de sesión.

Caduca a los45min; `stop` en su entrada finaliza antes. Cada ejecución tiene su propia base de datos. Su finalización elimina solo datos sintéticos propios, no permite recuperar esos escenarios. No reiniciar una prueba de otro chat para reutilizar su puerto. No dejar varias instancias en el mismo puerto.

## Qué comprueba el smoke vacío

Host ajeno403, origen ajeno403, anónimo401 y login con origen permitido. Sin documentos en las colecciones de contexto, operaciones, alcances, registros normativos o documentos de esa organización. ContextoHTTP404 con `codigo=CONTEXTO_NO_INICIADO`. Listas autorizadas de operaciones, requisitos y sistemas200 vacías. El modo precargado comprueba además relectura de su requisito favorable ficticio.

## Recorrido de navegador que falta comprobar

Desde la organización vacía: iniciar contexto, crear actividad y operación con nombres, vincularlas sin IDs manuales, obtener propuesta, confirmar alcance y sus referencias exactas, crear sistema y contextualizar requisitos. Luego actuación, responsable, evidencia, revisión y evento. Recargar, consultar versiones y probar permisos y referencias obsoletas/ajenas. No afirmar que este recorrido funciona por pasar el smoke.

El selector de actividad conserva una lista de IDs en el hecho `actividad_<id>_operaciones`; no cambia el contrato a objetos. GET operaciones devuelve nombre, versionActual y revision.sha256. La propuesta resuelve versiones en servidor y su huella se vuelve a comprobar al materializar. `origen.operaciones` del alcance conserva `{id,version,sha256}`. Un409 obliga a revisar la nueva propuesta, no a confirmar silenciosamente la última versión.

## Corte de verificación

Preparado junto con el backend de alternativas/designaciones, pero el recorrido R3 vivo4282 no fue reiniciado. Los nuevos paquetes ENS schema2 de Normativa no se publican por este runner. El informe de Front R3 continúa limitado a una organización precargada; el lote del selector de operaciones y su build posterior requieren su propia prueba.

Resultado final de esta preparación: tres tests de opciones, smoke vacío y smoke precargado en4284 correctos; regresión general1053/1053, sin fallos, omitidos ni cancelados. Ambas instancias de smoke se cerraron y retiraron solo sus datos sintéticos. Comprobado después:4282 seguía escuchando con su proceso previo y4284 estaba libre. Estas pruebas no demuestran aún el recorrido de navegador desde cero.
