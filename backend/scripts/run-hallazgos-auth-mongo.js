'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { comprobar } = require('./check-hallazgos-auth-mongo');
const { instancia } = require('./run-gestion-unidades-mongo');
async function main() {
  const ruta = process.env.MONGOD_TEST_BINARY;
  if (!ruta || !path.isAbsolute(ruta)) throw Error('Indica ruta absoluta MONGOD_TEST_BINARY');
  const bin = await fs.realpath(ruta); if (!(await fs.stat(bin)).isFile()) throw Error('Binario inválido');
  const n = await instancia(bin, false, comprobar);
  console.log('COMPLETADO: ' + n + ' casos de los hallazgos de autenticación sobre Mongo temporal.');
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { main };
