"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { instancia } = require("./run-gestion-unidades-mongo");
const { comprobar } = require("./check-decisiones-aplicabilidad-mongo");
async function main() {
  if (
    !process.env.MONGOD_TEST_BINARY ||
    !path.isAbsolute(process.env.MONGOD_TEST_BINARY)
  )
    throw Error("Indica ruta absoluta MONGOD_TEST_BINARY");
  const bin = await fs.realpath(process.env.MONGOD_TEST_BINARY);
  if (!(await fs.stat(bin)).isFile()) throw Error("Binario no válido");
  const r = await instancia(bin, false, comprobar),
    s = await instancia(bin, true, comprobar);
  console.log(
    "COMPLETADO: " +
      r +
      " grupos HTTP/replica + " +
      s +
      " negativo standalone; sin Docker ni navegador.",
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  });
module.exports = { main };
