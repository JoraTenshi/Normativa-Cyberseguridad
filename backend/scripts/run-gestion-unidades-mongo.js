'use strict';

// Arranca SU propio mongod, sin Docker/root, en loopback y directorio temporal.
// No acepta URI externa ni carga .env. La unica entrada es la ruta al binario.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongoose').mongo;
const { comprobar } = require('./check-gestion-unidades-mongo');

const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
async function puertoLibre() {
  const servidor = net.createServer();
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });
  const puerto = servidor.address().port;
  await new Promise(resolve => servidor.close(resolve));
  return puerto;
}
async function instancia(binario, standalone, verificar = comprobar) {
  const directorio = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-org03-check-'));
  await fs.chmod(directorio, 0o700);
  let proceso, cliente, iniciado = false, cerrado;
  try {
    await fs.mkdir(path.join(directorio, 'data'));
    const puerto = await puertoLibre();
    const argumentos = ['--bind_ip', '127.0.0.1', '--port', String(puerto),
      '--dbpath', path.join(directorio, 'data'), '--logpath', path.join(directorio, 'mongod.log'),
      '--wiredTigerCacheSizeGB', '0.25'];
    if (!standalone) argumentos.push('--replSet', 'nc_org03_test');
    proceso = spawn(binario, argumentos, { stdio: ['ignore', 'ignore', 'ignore'] });
    let errorProceso = null;
    proceso.on('error', error => { errorProceso = error; });
    cerrado = new Promise(resolve => proceso.once('close', resolve));
    const uri = 'mongodb://127.0.0.1:' + puerto + '/?directConnection=true';
    cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 700 });
    const limite = Date.now() + 25000;
    while (Date.now() < limite) {
      if (errorProceso) throw errorProceso;
      if (proceso.exitCode !== null) throw new Error('mongod termino durante el arranque; revisa su compatibilidad');
      try { await cliente.connect(); await cliente.db('admin').command({ ping: 1 }); iniciado = true; break; }
      catch { await pausa(200); }
    }
    if (!iniciado) throw new Error('No arranco el Mongo temporal a tiempo');
    if (!standalone) {
      await cliente.db('admin').command({ replSetInitiate: {
        _id: 'nc_org03_test', members: [{ _id: 0, host: '127.0.0.1:' + puerto }]
      } });
      let primario = false;
      while (Date.now() < limite) {
        if ((await cliente.db('admin').command({ hello: 1 })).isWritablePrimary) { primario = true; break; }
        await pausa(200);
      }
      if (!primario) throw new Error('La replica temporal no eligio primario');
    }
    const version = (await cliente.db('admin').command({ buildInfo: 1 })).version;
    console.log('Mongo temporal ' + version + ' / ' + (standalone ? 'standalone negativo' : 'replica de un nodo, solo pruebas'));
    const resultados = await verificar({
      uri, nombreBD: 'nc_org03_' + crypto.randomBytes(12).toString('hex'), standalone
    });
    return resultados.length;
  } finally {
    if (cliente) await cliente.close().catch(() => {});
    if (proceso?.pid && proceso.exitCode === null) {
      proceso.kill('SIGTERM');
      await Promise.race([cerrado, pausa(10000)]);
      if (proceso.exitCode === null && proceso.signalCode === null) {
        proceso.kill('SIGKILL');
        await cerrado;
      }
    }
    // Solo elimina el directorio creado por ESTE proceso, tras validar la ruta
    // absoluta y haber parado su mongod. Nunca borra una BD o carpeta externa.
    const raiz = await fs.realpath(os.tmpdir());
    const resuelto = await fs.realpath(directorio);
    if (path.dirname(resuelto) !== raiz || !path.basename(resuelto).startsWith('nc-org03-check-')) {
      throw new Error('Directorio temporal inesperado: no se elimina');
    }
    await fs.rm(resuelto, { recursive: true, force: false });
    console.log('Instancia detenida; eliminados solo sus datos sinteticos temporales');
  }
}
async function main() {
  const ruta = process.env.MONGOD_TEST_BINARY;
  if (!ruta || !path.isAbsolute(ruta)) throw new Error('Indica MONGOD_TEST_BINARY con ruta absoluta a un mongod compatible');
  const binario = await fs.realpath(ruta);
  if (!(await fs.stat(binario)).isFile()) throw new Error('El binario no es un archivo');
  const replica = await instancia(binario, false);
  const standalone = await instancia(binario, true);
  console.log('COMPLETADO: ' + replica + ' grupos en replica + ' + standalone +
    ' negativo en standalone. Persistencia real; no es HTTP/navegador ni despliegue.');
}
if (require.main === module) {
  main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { main, instancia };
