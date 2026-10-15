'use strict';
// Solo datos sintéticos en el Mongo temporal del ejecutor. Nunca .env ni Docker.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), request = require('supertest'), ExcelJS = require('exceljs');
const O = require('../models/Organizacion'), M = require('../models/Membresia');
const U = require('../models/UnidadTrabajo'), P = require('../models/MembresiaUnidad');
const C = require('../models/ContextoEmpresa'), R = require('../models/RevisionContextoEmpresa');
const E = require('../models/EventoOrganizacion'), Usuario = require('../models/Usuario');
const Revoked = require('../models/RevokedToken');
const { validarContexto, copiarJSON } = require('../validation/aplicabilidadContextual');
const { createApp } = require('../app');
async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || url.port === '27017' || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))
    throw Error('Solo Mongo temporal');
  const resultados = [];
  const caso = async (nombre, fn) => { await fn(); resultados.push(nombre); console.log('OK ' + nombre); };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of [O, M, U, P, C, R, E, Usuario, Revoked]) await modelo.init();
    const [a, b] = await O.create([1, 2].map(n => ({
      razon_social: 'Empresa sintética ' + n, pais: 'ES', identificador_tipo: 'NIF',
      identificador_valor: 'B0000000' + n, estado: 'activa'
    })));
    const miembros = {};
    for (const [nombre, org, rol] of [
      ['admin', a, 'administrador'], ['segundo', a, 'administrador'],
      ['coord', a, 'colaborador'], ['lector', a, 'consulta'], ['colaborador', a, 'colaborador'],
      ['adminB', b, 'administrador']
    ]) {
      const usuario = new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({ _id: usuario, nombre: 'Persona sintética',
        email: usuario + '@example.invalid', emailVerifiedAt: new Date(), sessionVersion: 0, rol: 'admin' });
      miembros[nombre] = await M.create({ usuario, organizacion: org._id, rol, estado: 'activa' });
    }
    const unidad = await U.create({ organizacion: a._id, nombre: 'Unidad sintética', estado: 'activa' });
    await P.create({ unidad: unidad._id, membresia: miembros.coord._id, rol: 'coordinador', estado: 'activa' });
    const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' }), raiz = '/organizaciones/' + a._id;
    const cookie = nombre => 'cyberaudit_token=' + jwt.sign({
      id: String(miembros[nombre].usuario), jti: crypto.randomUUID(), sessionVersion: 0
    }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const api = (method, path, nombre = 'admin') => request(app)[method](
      path.startsWith('/organizaciones/') ? path : raiz + path)
      .set('Cookie', cookie(nombre)).set('X-Requested-With', 'XMLHttpRequest');
    const key = () => crypto.randomUUID();
    const hecho = (valor = false) => ({ clave: 'vende_software', estado: 'conocido', valor });
    const alta = () => ({ hechos: [hecho(), { clave: 'pais', estado: 'conocido', valor: 'ES' }],
      motivo: 'Contexto inicial de prueba' });
    const cambios = version => ({ version, cambios: [hecho(true)], motivo: 'Actualización de prueba' });
    const guardar = (d, k = key(), nombre = 'admin') => api('patch', '/contexto', nombre).set('Idempotency-Key', k).send(d);
    const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body.data; };
    const contar = async () => [await C.countDocuments(), await R.countDocuments(), await E.countDocuments()];
    const binario = (res, fn) => {
      const partes = []; res.on('data', x => partes.push(x));
      res.on('end', () => fn(null, Buffer.concat(partes)));
    };
    if (standalone) {
      await caso('standalone rechaza contexto, revisión y evento sin escrituras parciales', async () => {
        const antes = await M.findById(miembros.admin._id).lean();
        assert.equal((await api('post', '/contexto').set('Idempotency-Key', key()).send(alta())).status, 503);
        assert.deepEqual(await contar(), [0, 0, 0]);
        assert.equal((await M.findById(miembros.admin._id)).__v, antes.__v);
      });
      return resultados;
    }
    let actual, primera, kAlta = key();
    await caso('autenticación, CSRF y falta de contexto no generan datos', async () => {
      assert.equal((await request(app).get(raiz + '/contexto')).status, 401);
      const sinContexto = await api('get', '/contexto');
      assert.equal(sinContexto.status, 404); assert.equal(sinContexto.body.codigo, 'CONTEXTO_NO_INICIADO');
      assert.equal((await api('post', '/contexto').set('Origin', 'https://ajeno.invalid').send(alta())).status, 403);
      assert.deepEqual(await contar(), [0, 0, 0]);
    });
    await caso('ni coordinador ni rol global admin sustituyen membresía empresarial admin', async () => {
      for (const nombre of ['coord', 'lector', 'colaborador', 'adminB']) {
        assert.equal((await api('get', '/contexto', nombre)).status, 403);
        assert.equal((await api('post', '/contexto', nombre).set('Idempotency-Key', key()).send(alta())).status, 403);
        assert.equal((await guardar(cambios(1), key(), nombre)).status, 403);
        assert.equal((await api('get', '/contexto/versiones', nombre)).status, 403);
        assert.equal((await api('get', '/contexto/versiones/1', nombre)).status, 403);
      }
    });
    await caso('creación concurrente con misma clave solo guarda una revisión y un evento', async () => {
      const respuestas = await Promise.all([1, 2].map(() => api('post', '/contexto').set('Idempotency-Key', kAlta).send(alta())));
      assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 201]);
      actual = ok(await api('get', '/contexto')); primera = structuredClone(actual);
      assert.equal(actual.versionActual, 1);
      assert.equal(actual.contexto.hechos.find(h => h.clave === 'vende_software').valor, false);
      assert.equal(actual.contexto.organizacionId, String(a._id));
      assert.ok(actual.contexto.hechos.every(h => h.procedencia.referencia === 'membresia:' + miembros.admin._id));
      assert.deepEqual(await contar(), [1, 1, 1]);
      validarContexto(copiarJSON(actual.contexto));
    });
    await caso('lectura privada sin claves de reintento y disponible para otro admin', async () => {
      const r = await api('get', '/contexto', 'segundo');
      ok(r); assert.match(r.headers['cache-control'], /no-store/);
      assert.ok(!JSON.stringify(r.body).includes('clave_operacion'));
      assert.ok(!JSON.stringify(r.body).includes('huella_operacion'));
      assert.ok(!JSON.stringify(r.body).includes(kAlta));
      assert.equal(ok(await api('post', '/contexto').set('Idempotency-Key', kAlta).send(alta())).repetida, true);
      assert.equal((await api('post', '/contexto').set('Idempotency-Key', key()).send(alta())).status, 409);
      assert.equal((await api('post', '/contexto').set('Idempotency-Key', kAlta).send({ ...alta(), motivo: 'Distinto' })).status, 409);
    });
    await caso('dos empresas mantienen contextos separados; ruta y cuerpo no amplían permisos', async () => {
      const raizB = '/organizaciones/' + b._id;
      const ctxB = ok(await api('post', raizB + '/contexto', 'adminB').set('Idempotency-Key', key())
        .send({ hechos: [], motivo: 'Empresa B' }), 201);
      assert.notEqual(ctxB.contextoId, actual.contextoId);
      assert.equal((await api('get', raizB + '/contexto', 'admin')).status, 403);
      assert.equal((await guardar({ ...cambios(1), organizacionId: String(b._id) })).status, 400);
    });
    await caso('rechaza falsas procedencias, reloj cliente, campos desconocidos y operadores', async () => {
      for (const d of [
        { ...cambios(1), createdAt: '2020-01-01T00:00:00.000Z' },
        { ...cambios(1), actor: String(miembros.segundo.usuario) },
        { ...cambios(1), cambios: [{ ...hecho(), procedencia: { tipo: 'revisado', referencia: 'yo' } }] },
        { ...cambios(1), cambios: [{ ...hecho({ $ne: true }) }] },
        { ...cambios(1), version: '1' }
      ]) assert.equal((await guardar(d)).status, 400);
      assert.equal((await api('patch', '/contexto').send(cambios(1))).status, 400);
      assert.equal((await api('get', '/contexto?actor=otra')).status, 400);
      assert.equal((await api('get', '/contexto/versiones?limite[$gt]=1')).status, 400);
      assert.equal((await api('get', '/contexto/versiones/01')).status, 400);
      assert.equal((await api('get', '/contexto/versiones/999')).status, 404);
    });
    let kCambio = key(), payloadCambio = cambios(1);
    await caso('PATCH fusiona sin borrar lo omitido y conserva exacta la primera revisión', async () => {
      actual = ok(await guardar(payloadCambio, kCambio, 'segundo'));
      assert.equal(actual.versionActual, 2);
      assert.equal(actual.contexto.hechos.find(h => h.clave === 'pais').valor, 'ES');
      assert.equal(actual.contexto.hechos.find(h => h.clave === 'pais').procedencia.referencia, 'membresia:' + miembros.admin._id);
      assert.equal(actual.contexto.hechos.find(h => h.clave === 'vende_software').procedencia.referencia, 'membresia:' + miembros.segundo._id);
      assert.deepEqual(ok(await api('get', '/contexto/versiones/1')).contexto, primera.contexto);
      assert.equal((await guardar(cambios(1))).body.codigo, 'VERSION_DESACTUALIZADA');
      assert.equal(ok(await guardar(payloadCambio, kCambio, 'segundo')).repetida, true);
    });
    await caso('concurrencia con misma versión: un ganador y un 409 sin doble evento', async () => {
      const antes = await R.countDocuments({ organizacion: a._id });
      const respuestas = await Promise.all(['A', 'B'].map(v => guardar({
        version: 2, cambios: [{ clave: 'otra_respuesta', estado: 'conocido', valor: v }], motivo: 'Concurrente ' + v
      })));
      assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
      actual = ok(await api('get', '/contexto')); assert.equal(actual.versionActual, 3);
      assert.equal(await R.countDocuments({ organizacion: a._id }), antes + 1);
      assert.equal(await E.countDocuments({ organizacion: a._id, accion: 'contexto_actualizado' }), 2);
      const retry = ok(await guardar(payloadCambio, kCambio, 'segundo'));
      assert.equal(retry.contexto.version, 2); assert.equal(retry.versionActual, 3); assert.equal(retry.repetida, true);
      assert.equal((await guardar(payloadCambio, kCambio, 'admin')).body.codigo, 'CLAVE_REUTILIZADA');
    });
    await caso('fallo del evento revierte revisión, cabecera y bloqueos de autorización', async () => {
      const estado = await contar(), org = await O.findById(a._id), m = await M.findById(miembros.admin._id);
      const original = E.create;
      E.create = async () => { throw Error('Fallo sintético'); };
      try { assert.equal((await guardar(cambios(actual.versionActual))).status, 503); }
      finally { E.create = original; }
      assert.deepEqual(await contar(), estado);
      assert.equal((await C.findById(actual.contextoId)).version_actual, actual.versionActual);
      assert.equal((await O.findById(a._id)).__v, org.__v);
      assert.equal((await M.findById(m._id)).__v, m.__v);
    });
    await caso('listar revisiones pagina por número, sin duplicados ni volcar todos los hechos', async () => {
      const primeraPagina = ok(await api('get', '/contexto/versiones?limite=2'));
      assert.deepEqual(primeraPagina.versiones.map(v => v.numero), [3, 2]);
      assert.equal(primeraPagina.paginacion.siguienteAntes, 2);
      assert.ok(primeraPagina.versiones.every(v => !Object.hasOwn(v, 'hechos')));
      const segunda = ok(await api('get', '/contexto/versiones?limite=2&antes=2'));
      assert.deepEqual(segunda.versiones.map(v => v.numero), [1]); assert.equal(segunda.paginacion.hayMas, false);
      for (const query of ['limite=101', 'antes=0', 'limite=2&limite=3', 'cursor=abc'])
        assert.equal((await api('get', '/contexto/versiones?' + query)).status, 400);
    });
    await caso('contextos se filtran y exportan, sin revelar hechos en el historial', async () => {
      const filtro = '?categoria=contextos&contextoId=' + actual.contextoId;
      const r = ok(await api('get', '/actividad' + filtro));
      assert.equal(r.eventos.length, 3); assert.ok(r.eventos.every(e => e.contextoId === actual.contextoId));
      assert.ok(r.eventos.every(e => !e.unidadId && e.categoria === 'contextos'));
      assert.ok(r.eventos.every(e => !Object.hasOwn(e.despues, 'hechos')));
      assert.deepEqual(ok(await api('get', '/actividad' + filtro, 'coord')).eventos, []);
      assert.equal((await api('get', '/actividad' + filtro, 'colaborador')).status, 403);
      assert.equal((await api('get', '/actividad?normativaId=' + a._id)).body.codigo, 'FILTRO_NO_IMPLEMENTADO');
      const csv = await api('get', '/actividad/exportar' + filtro + '&formato=csv&columnas=fecha,categoria,contextoId,despues');
      assert.equal(csv.status, 200); assert.match(csv.text, /ID contexto de empresa/);
      assert.equal(csv.headers['x-export-rows'], '3');
      const xlsx = await api('get', '/actividad/exportar' + filtro + '&formato=xlsx&columnas=fecha,categoria,contextoId')
        .buffer(true).parse(binario);
      assert.equal(xlsx.status, 200);
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx.body);
      assert.equal(wb.getWorksheet('Actividad').rowCount, 4);
      assert.equal(wb.getWorksheet('Actividad').getCell('C2').value, actual.contextoId);
      const coord = await api('get', '/actividad/exportar' + filtro + '&formato=csv', 'coord');
      assert.equal(coord.headers['x-export-rows'], '0');
    });
    await caso('desconocidos y conflictos se conservan sin decidir por el administrador', async () => {
      actual = ok(await guardar({
        version: actual.versionActual,
        cambios: [{ clave: 'vende_software', estado: 'desconocido', motivo: 'por_consultar' }],
        motivo: 'Respuesta pendiente'
      }));
      assert.equal(actual.contexto.hechos.find(h => h.clave === 'vende_software').estado, 'desconocido');
      actual = ok(await guardar({
        version: actual.versionActual,
        cambios: [{ clave: 'vende_software', estado: 'conflictivo', alternativas: [{ valor: true }, { valor: false }] }],
        motivo: 'Declaraciones contradictorias'
      }));
      const h = actual.contexto.hechos.find(h => h.clave === 'vende_software');
      assert.equal(h.estado, 'conflictivo'); assert.equal(h.alternativas.length, 2);
      assert.deepEqual(ok(await api('get', '/contexto/versiones/1')).contexto, primera.contexto);
    });
    await caso('reafirmar datos iguales crea revisión explícita sin fingir claves cambiadas', async () => {
      const h = actual.contexto.hechos.find(h => h.clave === 'vende_software');
      actual = ok(await guardar({
        version: actual.versionActual, motivo: 'Reafirmo que sigue pendiente resolver el conflicto',
        cambios: [{ clave: h.clave, estado: h.estado, alternativas: h.alternativas.map(a => ({ valor: a.valor })) }]
      }));
      const evento = await E.findOne({ contexto: actual.contextoId, 'despues.version': actual.versionActual }).lean();
      assert.deepEqual(evento.despues.claves_cambiadas, []);
    });
    await caso('membresía suspendida pierde lectura, escritura e incluso reintento', async () => {
      await M.updateOne({ _id: miembros.segundo._id }, { $set: { estado: 'suspendida' } });
      try {
        assert.equal((await api('get', '/contexto', 'segundo')).status, 403);
        assert.equal((await guardar(payloadCambio, kCambio, 'segundo')).status, 403);
      } finally { await M.updateOne({ _id: miembros.segundo._id }, { $set: { estado: 'activa' } }); }
    });
    await caso('revocación durante lectura descarta respuesta ya consultada', async () => {
      const original = R.findOne;
      R.findOne = function(...args) {
        const q = original.apply(this, args), exec = q.exec;
        q.exec = async function(...params) {
          const r = await exec.apply(this, params);
          await M.updateOne({ _id: miembros.admin._id }, { $set: { estado: 'suspendida' } });
          return r;
        };
        return q;
      };
      try {
        const r = await api('get', '/contexto'); assert.equal(r.status, 403); assert.equal(r.body.data, undefined);
      } finally {
        R.findOne = original;
        await M.updateOne({ _id: miembros.admin._id }, { $set: { estado: 'activa' } });
      }
    });
    await caso('organización suspendida bloquea acceso y no deja escribir', async () => {
      await O.updateOne({ _id: a._id }, { $set: { estado: 'suspendida' } });
      try {
        assert.equal((await api('get', '/contexto')).status, 403);
        assert.equal((await guardar(cambios(actual.versionActual))).status, 403);
      } finally { await O.updateOne({ _id: a._id }, { $set: { estado: 'activa' } }); }
    });
    await caso('sin índice único real falla cerrado sin mutar contexto', async () => {
      const antes = await contar();
      await R.collection.dropIndex('revision_contexto_unica');
      try { assert.equal((await guardar(cambios(actual.versionActual))).status, 503); }
      finally { await R.createIndexes(); }
      assert.deepEqual(await contar(), antes);
    });
    await caso('huella inconsistente falla sin propagar contexto corrupto', async () => {
      const r = await R.findOne({ contexto: actual.contextoId, numero: actual.versionActual });
      await R.collection.updateOne({ _id: r._id }, { $set: { sha256: '0'.repeat(64) } });
      try {
        assert.equal((await api('get', '/contexto')).status, 503);
        assert.equal((await guardar(cambios(actual.versionActual))).status, 503);
      } finally { await R.collection.updateOne({ _id: r._id }, { $set: { sha256: r.sha256 } }); }
    });
    return resultados;
  } finally { await mongoose.disconnect(); }
}
module.exports = { comprobar };
