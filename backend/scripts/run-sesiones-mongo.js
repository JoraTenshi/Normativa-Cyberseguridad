'use strict';
// No carga .env, URI externa, Docker ni datos del grupo.
const fs = require('node:fs/promises');
const path = require('node:path');
const { instancia } = require('./run-gestion-unidades-mongo');
const { comprobar } = require('./check-sesiones-mongo');
async function main() {
  const ruta = process.env.MONGOD_TEST_BINARY;
  if (!ruta || !path.isAbsolute(ruta)) throw new Error('Indica ruta absoluta MONGOD_TEST_BINARY');
  const binario = await fs.realpath(ruta);
  if (!(await fs.stat(binario)).isFile()) throw new Error('Binario no válido');
  const numero = await instancia(binario, false, comprobar);
  console.log('COMPLETADO: ' + numero + ' grupos con Mongo temporal; sin login HTTP ni navegador.');
}
if (require.main === module) main().catch(error => {
  console.error(error.stack); process.exitCode = 1;
});
module.exports = { main };
