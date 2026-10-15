'use strict';
// Se ejecuta únicamente desde run-sesiones-mongo: base aleatoria y desechable.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Sesion = require('../models/SesionUsuario');
const { crearServicioSesiones } = require('../services/sesionesUsuario');
const { DURACION_MAXIMA_MS: MAX, INACTIVIDAD_MAXIMA_MS: IDLE } = require('../services/politicaSesion');
const hash = secreto => crypto.createHash('sha256').update(secreto).digest('hex');
async function comprobar({ uri, nombreBD }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || !url.port || url.port === '27017' ||
      url.username || url.password || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) {
    throw new Error('Solo se admite Mongo temporal del runner');
  }
  const resultados = [];
  const caso = async (nombre, fn) => { await fn(); resultados.push(nombre); console.log('OK ' + nombre); };
  const inicio = new Date('2026-10-11T08:00:00.000Z');
  const usuario = new mongoose.Types.ObjectId(), ajeno = new mongoose.Types.ObjectId();
  const versionCredenciales = 3;
  let ahora = new Date(inicio);
  const en = ms => { ahora = new Date(inicio.getTime() + ms); };
  const servicio = crearServicioSesiones({ relojPruebas: () => ahora });
  const crear = async (extras = {}) => {
    en(0);
    return servicio.crear({ usuario, versionCredenciales, ...extras });
  };
  const clave = s => ({ usuario, versionCredenciales, identificador: s.identificador });
  const leer = s => Sesion.collection.findOne({ identificadorHash: hash(s.identificador) });
  const invalida = resultado => assert.deepEqual(resultado, { valida: false, codigo: 'SESION_NO_VALIDA' });
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 3000 });
    await Sesion.init();
    await caso('índice único realmente construido y ausencia de TTL', async () => {
      const indices = await Sesion.collection.indexes();
      assert.equal(indices.find(i => i.name === 'sesion_identificador_unico').unique, true);
      assert.ok(indices.every(i => !Object.hasOwn(i, 'expireAfterSeconds')));
    });
    await caso('creación persistente: secreto aleatorio, solo huella guardada y respuesta acotada', async () => {
      const s = await crear(), otra = await crear();
      assert.equal(s.valida, true);
      assert.match(s.identificador, /^[a-f0-9]{64}$/);
      assert.notEqual(s.identificador, otra.identificador);
      const doc = await leer(s);
      assert.equal(doc.identificadorHash, hash(s.identificador));
      assert.equal(JSON.stringify(doc).includes(s.identificador), false);
      assert.equal(JSON.stringify(s).includes(doc.identificadorHash), false);
      assert.equal(doc.usuario.toString(), usuario.toString());
      assert.equal(doc.versionCredenciales, versionCredenciales);
      assert.equal(doc.expiraEn - doc.autenticadaEn, MAX);
      assert.equal(s.restanteMs, IDLE);
      assert.equal(Object.hasOwn(s.sesion, 'versionCredenciales'), false);
      const duplicado = { ...doc, _id: new mongoose.Types.ObjectId() };
      await assert.rejects(Sesion.collection.insertOne(duplicado), e => e.code === 11000);
    });
    await caso('consulta repetida no cambia actividad ni updatedAt y nunca devuelve secretos', async () => {
      const s = await crear(), antes = await leer(s);
      for (const ms of [1, 1000, IDLE - 1]) {
        en(ms);
        const r = await servicio.consultar(clave(s));
        assert.equal(r.valida, true);
        assert.equal(r.restanteMs, IDLE - ms);
        assert.equal(JSON.stringify(r).includes(s.identificador), false);
        assert.equal(JSON.stringify(r).includes(antes.identificadorHash), false);
      }
      assert.deepEqual(await leer(s), antes);
    });
    await caso('inactividad exacta: lectura y escritura rechazan sin resucitar', async () => {
      const s = await crear(), antes = await leer(s);
      for (const ms of [IDLE, IDLE + 1, IDLE * 2]) {
        en(ms); invalida(await servicio.consultar(clave(s)));
        invalida(await servicio.registrarActividad(clave(s)));
      }
      assert.deepEqual(await leer(s), antes);
    });
    await caso('actividad válida renueva solo inactividad y no el máximo absoluto', async () => {
      const s = await crear();
      for (let ms = IDLE - 1; ms < MAX; ms += IDLE - 1) {
        en(ms);
        const r = await servicio.registrarActividad(clave(s));
        assert.equal(r.valida, true);
        assert.equal(r.sesion.ultimaActividadEn.getTime(), ahora.getTime());
        assert.equal(r.sesion.expiraEn.getTime(), inicio.getTime() + MAX);
      }
      en(MAX - 1); assert.equal((await servicio.registrarActividad(clave(s))).restanteMs, 1);
      en(MAX);
      const antes = await leer(s);
      invalida(await servicio.consultar(clave(s)));
      invalida(await servicio.registrarActividad(clave(s)));
      assert.deepEqual(await leer(s), antes);
    });
    await caso('mantener sesión true/false aplica exactamente los mismos límites', async () => {
      for (const mantenerSesion of [false, true]) {
        const s = await crear({ mantenerSesion });
        assert.equal((await leer(s)).mantenerSesion, mantenerSesion);
        en(IDLE); invalida(await servicio.registrarActividad(clave(s)));
      }
    });
    await caso('identidad y versión ajenas no leen, renuevan ni revocan otra sesión', async () => {
      const s = await crear(), antes = await leer(s);
      for (const datos of [
        { ...clave(s), usuario: ajeno }, { ...clave(s), versionCredenciales: 4 },
        { ...clave(s), identificador: hash(s.identificador) },
        { ...clave(s), identificador: 'f'.repeat(64) }
      ]) {
        invalida(await servicio.consultar(datos));
        invalida(await servicio.registrarActividad(datos));
        assert.deepEqual(await servicio.revocar(datos), { ok: true });
      }
      assert.deepEqual(await leer(s), antes);
    });
    await caso('campos externos y operadores Mongo no llegan a las consultas', async () => {
      const s = await crear(), antes = await leer(s);
      for (const datos of [
        { ...clave(s), ahora: new Date() }, { ...clave(s), ultimaActividadEn: new Date() },
        { ...clave(s), rol: 'admin' }, { ...clave(s), identificador: { $ne: null } },
        { ...clave(s), versionCredenciales: '3' }
      ]) {
        invalida(await servicio.consultar(datos));
        invalida(await servicio.registrarActividad(datos));
        assert.deepEqual(await servicio.revocar(datos), { ok: false, codigo: 'SESION_NO_VALIDA' });
      }
      assert.deepEqual(await leer(s), antes);
    });
    await caso('revocación persistente e idempotente sin borrar otras sesiones', async () => {
      const s = await crear(), otra = await crear();
      en(1000); assert.deepEqual(await servicio.revocar(clave(s)), { ok: true });
      const cerrada = await leer(s);
      assert.equal(cerrada.revocadaEn.getTime(), ahora.getTime());
      en(2000); await servicio.revocar(clave(s));
      assert.deepEqual(await leer(s), cerrada);
      invalida(await servicio.consultar(clave(s)));
      invalida(await servicio.registrarActividad(clave(s)));
      assert.equal((await servicio.consultar(clave(otra))).valida, true);
    });
    await caso('logout con reloj atrasado revoca igualmente y no reaparece al recuperarlo', async () => {
      const s = await crear(); en(120000);
      assert.equal((await servicio.registrarActividad(clave(s))).valida, true);
      en(60000); await servicio.revocar(clave(s));
      assert.equal((await leer(s)).revocadaEn.getTime(), inicio.getTime() + 120000);
      en(180000); invalida(await servicio.consultar(clave(s)));
      invalida(await servicio.registrarActividad(clave(s)));
    });
    await caso('también se puede marcar revocada una sesión ya caducada', async () => {
      const s = await crear();
      en(MAX + 1); await servicio.revocar(clave(s));
      assert.equal((await leer(s)).revocadaEn.getTime(), ahora.getTime());
    });
    await caso('varias pestañas: actividad concurrente sobre una sola sesión', async () => {
      const s = await crear(); en(60000);
      const rs = await Promise.all(Array.from({ length: 12 }, () => servicio.registrarActividad(clave(s))));
      assert.ok(rs.every(r => r.valida));
      assert.equal((await leer(s)).ultimaActividadEn.getTime(), ahora.getTime());
      assert.equal(await Sesion.countDocuments({ identificadorHash: hash(s.identificador) }), 1);
    });
    await caso('petición retrasada nunca hace retroceder la última actividad', async () => {
      const s = await crear(); en(120000);
      assert.equal((await servicio.registrarActividad(clave(s))).valida, true);
      const antes = await leer(s);
      en(60000);
      invalida(await servicio.registrarActividad(clave(s)));
      assert.deepEqual(await leer(s), antes);
    });
    await caso('carreras actividad/logout terminan revocadas y no admiten escrituras posteriores', async () => {
      for (let n = 0; n < 12; n++) {
        const s = await crear(); en(60000);
        await Promise.all([servicio.registrarActividad(clave(s)), servicio.revocar(clave(s))]);
        const cerrada = await leer(s);
        assert.ok(cerrada.revocadaEn instanceof Date);
        en(120000); invalida(await servicio.registrarActividad(clave(s)));
        invalida(await servicio.consultar(clave(s)));
        assert.deepEqual(await leer(s), cerrada);
      }
    });
    await caso('revocación entre entrada al servicio y escritura: el filtro atómico la respeta', async () => {
      const s = await crear(); en(60000);
      const original = Sesion.collection.findOneAndUpdate;
      Sesion.collection.findOneAndUpdate = async function(...args) {
        await servicio.revocar(clave(s));
        return original.apply(this, args);
      };
      try { invalida(await servicio.registrarActividad(clave(s))); }
      finally { Sesion.collection.findOneAndUpdate = original; }
      const doc = await leer(s);
      assert.equal(doc.ultimaActividadEn.getTime(), inicio.getTime());
      assert.ok(doc.revocadaEn instanceof Date);
    });
    await caso('cronologías manipuladas y versión de política desconocida se rechazan sin cambios', async () => {
      for (const cambio of [
        { expiraEn: new Date(inicio.getTime() + MAX + 1) },
        { ultimaActividadEn: new Date(inicio.getTime() - 1) },
        { ultimaActividadEn: new Date(inicio.getTime() + MAX) },
        { versionPolitica: 2 }, { mantenerSesion: 'true' }
      ]) {
        const s = await crear();
        await Sesion.collection.updateOne({ identificadorHash: hash(s.identificador) }, { $set: cambio });
        const antes = await leer(s);
        invalida(await servicio.consultar(clave(s))); invalida(await servicio.registrarActividad(clave(s)));
        assert.deepEqual(await leer(s), antes);
      }
    });
    await caso('revocadaEn ausente no se interpreta como null válido', async () => {
      const s = await crear();
      await Sesion.collection.updateOne({ identificadorHash: hash(s.identificador) }, { $unset: { revocadaEn: '' } });
      invalida(await servicio.consultar(clave(s))); invalida(await servicio.registrarActividad(clave(s)));
    });
    await caso('reloj real de Mongo: creación, consulta, actividad y revocación sin reloj inyectado', async () => {
      const real = crearServicioSesiones();
      const s = await real.crear({ usuario, versionCredenciales });
      assert.ok(Math.abs(s.sesion.autenticadaEn - Date.now()) < 10000);
      assert.equal((await real.consultar(clave(s))).valida, true);
      assert.equal((await real.registrarActividad(clave(s))).valida, true);
      await real.revocar(clave(s));
      invalida(await real.consultar(clave(s)));
    });
    await caso('Mongo reevalúa caducidad en la escritura, no usa un ahora del cliente', async () => {
      const real = crearServicioSesiones();
      const s = await real.crear({ usuario, versionCredenciales });
      const original = Sesion.collection.findOneAndUpdate;
      Sesion.collection.findOneAndUpdate = async function(...args) {
        assert.ok(JSON.stringify(args[0]).includes('$$NOW'));
        assert.equal(args[1][0].$set.ultimaActividadEn, '$$NOW');
        const inicioViejo = new Date(Date.now() - 2 * IDLE);
        await Sesion.collection.updateOne({ identificadorHash: hash(s.identificador) }, { $set: {
          autenticadaEn: inicioViejo, ultimaActividadEn: inicioViejo,
          expiraEn: new Date(inicioViejo.getTime() + MAX)
        } });
        return original.apply(this, args);
      };
      try { invalida(await real.registrarActividad(clave(s))); }
      finally { Sesion.collection.findOneAndUpdate = original; }
    });
    await caso('registros caducados/revocados se conservan: no hay borrado ni upsert de desconocidos', async () => {
      const antes = await Sesion.countDocuments();
      const desconocida = { usuario, versionCredenciales, identificador: crypto.randomBytes(32).toString('hex') };
      invalida(await servicio.registrarActividad(desconocida)); await servicio.revocar(desconocida);
      assert.equal(await Sesion.countDocuments(), antes);
      assert.ok(await Sesion.countDocuments({ revocadaEn: { $type: 'date' } }) > 0);
    });
    await caso('conexión cerrada: fallo explícito 503 sin aceptar por defecto', async () => {
      const s = await crear();
      await mongoose.disconnect();
      for (const metodo of ['consultar', 'registrarActividad', 'revocar']) {
        await assert.rejects(servicio[metodo](clave(s)), { code: 'SESIONES_NO_DISPONIBLES', status: 503 });
      }
    });
    return resultados;
  } finally {
    await mongoose.disconnect();
  }
}
module.exports = { comprobar };
