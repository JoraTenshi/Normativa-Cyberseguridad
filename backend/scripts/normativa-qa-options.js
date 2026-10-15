'use strict';
// Opciones cerradas: nunca admite host, URI de Mongo o puerto habitual.
function opcionesQA(args = []) {
  let empty = false, smoke = false, port;
  const vistos = new Set();
  for (const arg of args) {
    const clave = arg.startsWith('--port=') ? '--port' : arg;
    if (vistos.has(clave)) throw Error('Opción QA repetida');
    vistos.add(clave);
    if (arg === '--empty') empty = true;
    else if (arg === '--smoke') smoke = true;
    else if (/^--port=(4282|4284|4286)$/.test(arg)) port = Number(arg.slice(7));
    else throw Error('Solo --empty, --smoke y --port=4282|4284|4286');
  }
  port ??= empty ? 4284 : 4282;
  if (empty && ![4284,4286].includes(port)) throw Error('La empresa vacía usa los puertos4284 o4286');
  if (port === 4286 && !empty) throw Error('El puerto4286 exige empresa vacía');
  return Object.freeze({ empty, smoke, port, origin: 'http://localhost:' + port });
}
function rutaBuildQA(build, normal) {
  // El llamador proporciona realpath: un enlace no permite escapar de estas rutas.
  if (build === normal || /^\/tmp\/norm-c2-front-(?:build|fix)\.[A-Za-z0-9]{6,}$/.test(build)) return build;
  throw Error('Build fuera de las rutas de QA');
}
module.exports = { opcionesQA, rutaBuildQA };
