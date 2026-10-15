'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { instancia } = require('./run-gestion-unidades-mongo');
const { comprobar } = require('./check-registros-normativos-mongo');
async function main() {
  if (!process.env.MONGOD_TEST_BINARY || !path.isAbsolute(process.env.MONGOD_TEST_BINARY)) throw Error('Indica MONGOD_TEST_BINARY absoluto');
  const bin = await fs.realpath(process.env.MONGOD_TEST_BINARY);
  if (!(await fs.stat(bin)).isFile()) throw Error('Binario no válido');
  const r = await instancia(bin, false, comprobar), s = await instancia(bin, true, comprobar);
  console.log('COMPLETADO C2c: ' + r + ' grupos HTTP/Mongo réplica + ' + s + ' negativo standalone; sin Docker/navegador.');
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { main };
