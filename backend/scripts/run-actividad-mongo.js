'use strict';
// Reutiliza el arranque/limpieza seguro del runner existente. Nunca acepta URI
// externa: cada instancia tiene puerto loopback y directorio temporal propios.
const fs = require('node:fs/promises');
const path = require('node:path');
const { comprobar } = require('./check-actividad-mongo');
const { instancia } = require('./run-gestion-unidades-mongo');
async function main() {
  const ruta = process.env.MONGOD_TEST_BINARY;
  if (!ruta || !path.isAbsolute(ruta)) throw new Error('Indica MONGOD_TEST_BINARY con ruta absoluta');
  const binario = await fs.realpath(ruta);
  if (!(await fs.stat(binario)).isFile()) throw new Error('El binario no es un archivo');
  const replica = await instancia(binario, false, comprobar);
  const standalone = await instancia(binario, true, comprobar);
  console.log('ACTIVIDAD VERIFICADA: ' + replica + ' grupos HTTP/Mongo replica y ' +
    standalone + ' standalone. No es despliegue Docker ni prueba de navegador.');
}
if (require.main === module) {
  main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { main };
