'use strict';
// Solo fixture en Mongo temporal del runner. Sin .env, datos reales o Docker.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), request = require('supertest'), ExcelJS = require('exceljs');
const O = require('../models/Organizacion'), M = require('../models/Membresia');
const U = require('../models/UnidadTrabajo'), P = require('../models/MembresiaUnidad');
const OP = require('../models/Operacion'), R = require('../models/RevisionOperacion');
const S = require('../models/Subespacio'), E = require('../models/EventoOrganizacion');
const C = require('../models/ContextoEmpresa'), RC = require('../models/RevisionContextoEmpresa');
const Usuario = require('../models/Usuario'), Revoked = require('../models/RevokedToken');
const { createApp } = require('../app');
const { validarContexto, copiarJSON } = require('../validation/aplicabilidadContextual');
const { inspeccionarBorradorRGPD28 } = require('../catalogo/propuestas/rgpd28EncargoDirecto');
async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || url.port === '27017' || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))
    throw Error('Solo Mongo temporal');
  const resultados = [];
  const caso = async (nombre, fn) => { await fn(); resultados.push(nombre); console.log('OK ' + nombre); };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of [O, M, U, P, OP, R, S, E, C, RC, Usuario, Revoked]) await modelo.init();
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
    const sub = async (org, miembro, nombre, estado = 'activo') => S.create({
      organizacion: org._id, nombre, tipo: 'servicio', descripcion: 'Servicio ficticio', estado,
      creado_por: miembro._id, clave_creacion: crypto.randomUUID(), huella_creacion: 'a'.repeat(64)
    });
    const sa = await sub(a, miembros.admin, 'Servicio A'), sb = await sub(b, miembros.adminB, 'Servicio B'),
      archivado = await sub(a, miembros.admin, 'Servicio archivado', 'archivado');
    const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' }), raiz = '/organizaciones/' + a._id;
    const cookie = nombre => 'cyberaudit_token=' + jwt.sign({
      id: String(miembros[nombre].usuario), jti: crypto.randomUUID(), sessionVersion: 0
    }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const api = (method, path, nombre = 'admin') => request(app)[method](
      path.startsWith('/organizaciones/') ? path : raiz + path)
      .set('Cookie', cookie(nombre)).set('X-Requested-With', 'XMLHttpRequest');
    const key = () => crypto.randomUUID();
    const hecho = (valor = true) => ({ clave: 'tratamiento_por_cuenta_cliente', estado: 'conocido', valor });
    const alta = () => ({ nombre: 'Asistentes de curso', descripcion: 'Operación sintética',
      hechos: [hecho(), { clave: 'dato_propio', estado: 'conocido', valor: 'solo A' }], motivo: 'Alta de prueba' });
    const crear = (d = alta(), k = key(), quien = 'admin', prefijo = '/operaciones') =>
      api('post', prefijo, quien).set('Idempotency-Key', k).send(d);
    const modificar = (op, d, k = key(), quien = 'admin') =>
      api('patch', '/operaciones/' + op, quien).set('Idempotency-Key', k).send(d);
    const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body.data; };
    const contar = async () => [await OP.countDocuments(), await R.countDocuments(),
      await E.countDocuments({ accion: { $in: ['operacion_creada', 'operacion_actualizada'] } })];
    const binario = (res, fn) => { const partes = []; res.on('data', x => partes.push(x));
      res.on('end', () => fn(null, Buffer.concat(partes))); };
    if (standalone) {
      await caso('standalone falla cerrado sin operación/revisión/evento ni bloqueos parciales', async () => {
        const antes = await M.findById(miembros.admin._id).lean();
        assert.equal((await crear()).status, 503); assert.deepEqual(await contar(), [0, 0, 0]);
        assert.equal((await M.findById(miembros.admin._id)).__v, antes.__v);
      });
      return resultados;
    }
    await caso('auth/CSRF y políticas admin sin contexto general previo', async () => {
      assert.equal((await request(app).get(raiz + '/operaciones')).status, 401);
      assert.equal((await api('post', '/operaciones').set('Origin', 'https://ajeno.invalid')
        .set('Idempotency-Key', key()).send(alta())).status, 403);
      assert.deepEqual(ok(await api('get', '/operaciones')).operaciones, []);
      assert.equal(await C.countDocuments(), 0);
      for (const n of ['coord', 'lector', 'colaborador', 'adminB']) {
        assert.equal((await api('get', '/operaciones', n)).status, 403);
        assert.equal((await crear(alta(), key(), n)).status, 403);
        assert.equal((await api('get', '/operaciones/' + a._id, n)).status, 403);
        assert.equal((await api('get', '/operaciones/' + a._id + '/versiones', n)).status, 403);
      }
      assert.deepEqual(await contar(), [0, 0, 0]);
    });
    let actual, primera, otra, kAlta = key(), kPatch, payload;
    await caso('alta idempotente concurrente y contexto propio sin subespacio', async () => {
      const rs = await Promise.all([crear(alta(), kAlta), crear(alta(), kAlta)]);
      assert.deepEqual(rs.map(r => r.status).sort(), [200, 201]);
      actual = rs.find(r => r.status === 201).body.data; primera = structuredClone(actual);
      assert.deepEqual(await contar(), [1, 1, 1]);
      assert.equal(actual.versionActual, 1); assert.equal(actual.operacion.subespacioId, null);
      assert.equal(actual.contexto.objeto.tipo, 'operacion');
      assert.equal(actual.contexto.objeto.id, actual.operacion.id);
      assert.equal(actual.contexto.id, 'ctx_op_' + actual.operacion.id);
      assert.ok(actual.contexto.hechos.every(h => h.procedencia.referencia === 'membresia:' + miembros.admin._id));
      validarContexto(copiarJSON(actual.contexto));
      const r = await api('get', '/operaciones/' + actual.operacion.id, 'segundo');
      ok(r); assert.match(r.headers['cache-control'], /no-store/);
      assert.ok(!JSON.stringify(r.body).includes(kAlta));
      assert.ok(!JSON.stringify(r.body).includes('huella_operacion'));
    });
    await caso('dos operaciones y el contexto general no heredan datos o papeles', async () => {
      otra = ok(await crear({ ...alta(), nombre: 'Facturación propia', hechos: [hecho(false)] }), 201);
      assert.notEqual(otra.contexto.id, actual.contexto.id);
      assert.equal(otra.contexto.hechos.length, 1); assert.equal(otra.contexto.hechos[0].valor, false);
      ok(await api('post', '/contexto').set('Idempotency-Key', key())
        .send({ hechos: [{ clave: 'solo_general', estado: 'conocido', valor: 'General' }], motivo: 'Contexto general' }), 201);
      const r = ok(await api('get', '/operaciones/' + actual.operacion.id));
      assert.ok(!r.contexto.hechos.some(h => h.clave === 'solo_general'));
      assert.equal(ok(await api('get', '/contexto')).contexto.hechos.length, 1);
    });
    await caso('objetos y subespacios de otra empresa o archivados no se aceptan', async () => {
      const opB = ok(await crear(alta(), key(), 'adminB', '/organizaciones/' + b._id + '/operaciones'), 201);
      assert.equal((await api('get', '/operaciones/' + opB.operacion.id)).status, 404);
      assert.equal((await modificar(opB.operacion.id, { version: 1, nombre: 'Intrusión', motivo: 'No' })).status, 404);
      assert.equal((await api('get', '/organizaciones/' + b._id + '/operaciones/' + opB.operacion.id)).status, 403);
      for (const sid of [sb._id, archivado._id, new mongoose.Types.ObjectId()])
        assert.equal((await crear({ ...alta(), subespacioId: String(sid) })).status, 404);
      assert.equal((await modificar(actual.operacion.id, { version: 1, subespacioId: String(sb._id), motivo: 'No' })).status, 404);
      assert.equal(ok(await api('get', '/operaciones/' + actual.operacion.id)).versionActual, 1);
    });
    await caso('no permite inyectar autor, fecha, estado o procedencia; query estricta', async () => {
      for (const d of [
        { ...alta(), actor: String(miembros.segundo.usuario) }, { ...alta(), clienteId: String(a._id) },
        { ...alta(), unidadId: String(unidad._id) }, { ...alta(), createdAt: '2020-01-01' },
        { ...alta(), hechos: [{ ...hecho(), procedencia: { tipo: 'revisado', referencia: 'Yo' } }] }
      ]) assert.equal((await crear(d)).status, 400);
      assert.equal((await api('post', '/operaciones').send(alta())).status, 400);
      for (const query of ['limite=101', 'antes=0', 'limite=1&limite=2', 'subespacioId[$ne]=x', 'estado=activa'])
        assert.equal((await api('get', '/operaciones?' + query)).status, 400);
      assert.equal((await api('get', '/operaciones/' + actual.operacion.id + '/versiones/01')).status, 400);
      assert.equal((await api('get', '/operaciones/' + actual.operacion.id + '/versiones/999')).status, 404);
      assert.equal((await api('delete', '/operaciones/' + actual.operacion.id)).status, 404);
    });
    await caso('PATCH atómico de vínculo/metadatos/hechos con histórico íntegro', async () => {
      kPatch = key(); payload = { version: 1, nombre: 'Alojamiento del cliente', subespacioId: String(sa._id),
        cambios: [hecho(false)], motivo: 'Revisar operación' };
      actual = ok(await modificar(actual.operacion.id, payload, kPatch, 'segundo'));
      assert.equal(actual.versionActual, 2); assert.equal(actual.operacion.subespacioId, String(sa._id));
      const h = actual.contexto.hechos.find(h => h.clave === 'dato_propio');
      assert.equal(h.valor, 'solo A'); assert.equal(h.procedencia.referencia, 'membresia:' + miembros.admin._id);
      assert.equal(actual.contexto.hechos.find(h => h.clave === hecho().clave).procedencia.referencia, 'membresia:' + miembros.segundo._id);
      const vieja = ok(await api('get', '/operaciones/' + actual.operacion.id + '/versiones/1'));
      assert.deepEqual(vieja.contexto, primera.contexto); assert.deepEqual(vieja.operacion, primera.operacion);
      assert.equal(vieja.versionActual, 2);
      assert.equal(ok(await api('get', '/operaciones/' + otra.operacion.id)).versionActual, 1);
    });
    await caso('reintento no duplica y no se reutiliza clave entre actores/operaciones', async () => {
      assert.equal(ok(await modificar(actual.operacion.id, payload, kPatch, 'segundo')).repetida, true);
      assert.equal((await modificar(actual.operacion.id, payload, kPatch)).body.codigo, 'CLAVE_REUTILIZADA');
      assert.equal((await modificar(otra.operacion.id, payload, kPatch, 'segundo')).body.codigo, 'CLAVE_REUTILIZADA');
      assert.equal((await crear({ ...alta(), nombre: 'Otro' }, kAlta)).body.codigo, 'CLAVE_REUTILIZADA');
      assert.equal((await modificar(actual.operacion.id, payload)).body.codigo, 'VERSION_DESACTUALIZADA');
    });
    await caso('edición concurrente misma versión conserva un ganador y devuelve 409 al otro', async () => {
      const antes = await R.countDocuments({ operacion: actual.operacion.id });
      const rs = await Promise.all(['A', 'B'].map(nombre => modificar(actual.operacion.id,
        { version: 2, nombre, motivo: 'Concurrente ' + nombre })));
      assert.deepEqual(rs.map(r => r.status).sort(), [200, 409]);
      actual = ok(await api('get', '/operaciones/' + actual.operacion.id));
      assert.equal(actual.versionActual, 3);
      assert.equal(await R.countDocuments({ operacion: actual.operacion.id }), antes + 1);
      const retry = ok(await modificar(actual.operacion.id, payload, kPatch, 'segundo'));
      assert.equal(retry.contexto.version, 2); assert.equal(retry.versionActual, 3);
      assert.equal(ok(await crear(alta(), kAlta)).contexto.version, 1);
    });
    await caso('fallo del evento revierte alta/cambio y bloqueos de autorización', async () => {
      const estado = await contar(), org = await O.findById(a._id), m = await M.findById(miembros.admin._id);
      const original = E.create; E.create = async () => { throw Error('Fallo sintético'); };
      try {
        assert.equal((await crear()).status, 503);
        assert.equal((await modificar(actual.operacion.id, { version: 3, nombre: 'No guardar', motivo: 'Fallo' })).status, 503);
      } finally { E.create = original; }
      assert.deepEqual(await contar(), estado);
      assert.equal((await OP.findById(actual.operacion.id)).version_actual, 3);
      assert.equal((await O.findById(a._id)).__v, org.__v);
      assert.equal((await M.findById(m._id)).__v, m.__v);
    });
    await caso('listado por organización, paginación y filtro por subespacio sin hechos', async () => {
      const listado = ok(await api('get', '/operaciones?limite=1'));
      assert.equal(listado.operaciones.length, 1); assert.equal(listado.paginacion.hayMas, true);
      const siguiente = ok(await api('get', '/operaciones?limite=1&antes=' + listado.paginacion.siguienteAntes));
      assert.equal(siguiente.operaciones.length, 1);
      assert.notEqual(listado.operaciones[0].id, siguiente.operaciones[0].id);
      assert.ok(listado.operaciones.every(o => !o.hechos && !o.contexto));
      assert.deepEqual(ok(await api('get', '/operaciones?subespacioId=' + sb._id)).operaciones, []);
      assert.equal(ok(await api('get', '/operaciones?subespacioId=' + sa._id)).operaciones[0].id, actual.operacion.id);
      const vers = ok(await api('get', '/operaciones/' + actual.operacion.id + '/versiones?limite=2'));
      assert.deepEqual(vers.versiones.map(v => v.numero), [3, 2]);
      assert.ok(vers.versiones.every(v => !v.contenido && !v.hechos));
      assert.deepEqual(ok(await api('get', '/operaciones/' + actual.operacion.id + '/versiones?antes=2'))
        .versiones.map(v => v.numero), [1]);
    });
    await caso('subespacio archivado conserva lectura/reintento y permite desvincular', async () => {
      ok(await api('post', '/subespacios/' + sa._id + '/archivar').send({ version: 0 }));
      ok(await api('get', '/operaciones/' + actual.operacion.id));
      assert.equal(ok(await modificar(actual.operacion.id, payload, kPatch, 'segundo')).repetida, true);
      assert.equal((await modificar(actual.operacion.id, { version: 3, nombre: 'No', motivo: 'Sigue vinculado' })).status, 404);
      actual = ok(await modificar(actual.operacion.id, { version: 3, subespacioId: null, motivo: 'Retiro vínculo archivado' }));
      assert.equal(actual.operacion.subespacioId, null); assert.equal(actual.versionActual, 4);
      const historico = ok(await api('get', '/operaciones/' + actual.operacion.id + '/versiones/2'));
      assert.equal(historico.operacion.subespacioId, String(sa._id));
    });
    await caso('historial y CSV/XLSX por operación sin hechos ni accesos heredados', async () => {
      const filtro = '?categoria=operaciones&operacionId=' + actual.operacion.id;
      const r = ok(await api('get', '/actividad' + filtro));
      assert.equal(r.eventos.length, 4);
      assert.ok(r.eventos.every(e => e.operacionId === actual.operacion.id && e.unidadId === null && e.contextoId === null));
      assert.ok(r.eventos.every(e => !e.despues.hechos && !e.despues.contenido));
      assert.deepEqual(ok(await api('get', '/actividad' + filtro, 'coord')).eventos, []);
      const vinculados = ok(await api('get', '/actividad' + filtro + '&subespacioId=' + sa._id));
      assert.equal(vinculados.eventos.length, 3); // vincular, editar y desvincular.
      assert.equal((await api('get', '/actividad?clienteId=' + a._id)).body.codigo, 'FILTRO_NO_IMPLEMENTADO');
      const csv = await api('get', '/actividad/exportar' + filtro + '&formato=csv&columnas=fecha,operacionId,despues');
      assert.equal(csv.status, 200); assert.match(csv.text, /ID operación/); assert.equal(csv.headers['x-export-rows'], '4');
      const xlsx = await api('get', '/actividad/exportar' + filtro + '&formato=xlsx&columnas=fecha,operacionId')
        .buffer(true).parse(binario);
      assert.equal(xlsx.status, 200);
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xlsx.body);
      assert.equal(wb.getWorksheet('Actividad').rowCount, 5);
      assert.equal(wb.getWorksheet('Actividad').getCell('B2').value, actual.operacion.id);
      const co = await api('get', '/actividad/exportar' + filtro + '&formato=csv', 'coord');
      assert.equal(co.headers['x-export-rows'], '0');
    });
    await caso('desconocidos/conflictos y reafirmación explícita conservan procedencia', async () => {
      actual = ok(await modificar(actual.operacion.id, { version: 4, motivo: 'Pendiente',
        cambios: [{ clave: hecho().clave, estado: 'desconocido', motivo: 'no_sabe' }] }));
      actual = ok(await modificar(actual.operacion.id, { version: 5, motivo: 'Contradicción',
        cambios: [{ clave: hecho().clave, estado: 'conflictivo', alternativas: [{ valor: true }, { valor: false }] }] }));
      const cambios = [{ clave: hecho().clave, estado: 'conflictivo', alternativas: [{ valor: true }, { valor: false }] }];
      actual = ok(await modificar(actual.operacion.id, { version: 6, motivo: 'Reafirmación', cambios }));
      const evento = await E.findOne({ operacion: actual.operacion.id, 'despues.version': 7 }).lean();
      assert.deepEqual(evento.despues.claves_cambiadas, []);
      assert.equal(actual.contexto.hechos.find(h => h.clave === hecho().clave).estado, 'conflictivo');
    });
    await caso('revocación durante lectura/listado descarta datos ya consultados', async () => {
      for (const [metodo, ruta] of [['findOne', '/operaciones/' + actual.operacion.id], ['find', '/operaciones']]) {
        const original = R[metodo];
        R[metodo] = function(...args) {
          const q = original.apply(this, args), exec = q.exec;
          q.exec = async function(...params) {
            const r = await exec.apply(this, params);
            await M.updateOne({ _id: miembros.admin._id }, { $set: { estado: 'suspendida' } }); return r;
          }; return q;
        };
        try { const r = await api('get', ruta); assert.equal(r.status, 403); assert.equal(r.body.data, undefined); }
        finally { R[metodo] = original; await M.updateOne({ _id: miembros.admin._id }, { $set: { estado: 'activa' } }); }
      }
    });
    await caso('suspensión impide escrituras y reintentos; rol global no concede acceso', async () => {
      await M.updateOne({ _id: miembros.segundo._id }, { $set: { estado: 'suspendida' } });
      try {
        assert.equal((await modificar(actual.operacion.id, payload, kPatch, 'segundo')).status, 403);
        assert.equal((await api('get', '/operaciones', 'segundo')).status, 403);
      } finally { await M.updateOne({ _id: miembros.segundo._id }, { $set: { estado: 'activa' } }); }
      await O.updateOne({ _id: a._id }, { $set: { estado: 'suspendida' } });
      try {
        assert.equal((await api('get', '/operaciones')).status, 403);
        assert.equal((await crear()).status, 403);
      } finally { await O.updateOne({ _id: a._id }, { $set: { estado: 'activa' } }); }
    });
    await caso('sin índice único real falla sin escrituras parciales', async () => {
      const antes = await contar();
      await R.collection.dropIndex('revision_operacion_numero_unico');
      try {
        assert.equal((await crear()).status, 503);
        assert.equal((await modificar(actual.operacion.id, { version: 7, nombre: 'No', motivo: 'Índice' })).status, 503);
      } finally { await R.createIndexes(); }
      assert.deepEqual(await contar(), antes);
    });
    await caso('corrupción de revisión o cabecera no se propaga a lectura/lista/actualización', async () => {
      const r = await R.findOne({ operacion: actual.operacion.id, numero: 7 }).lean();
      await R.collection.updateOne({ _id: r._id }, { $set: { sha256: '0'.repeat(64) } });
      try {
        assert.equal((await api('get', '/operaciones/' + actual.operacion.id)).status, 503);
        assert.equal((await api('get', '/operaciones')).status, 503);
        assert.equal((await modificar(actual.operacion.id, { version: 7, nombre: 'No', motivo: 'Corrupción' })).status, 503);
      } finally { await R.collection.updateOne({ _id: r._id }, { $set: { sha256: r.sha256 } }); }
      const o = await OP.findById(actual.operacion.id).lean();
      await OP.collection.updateOne({ _id: o._id }, { $set: { nombre: 'Cabecera alterada' } });
      try { assert.equal((await api('get', '/operaciones/' + actual.operacion.id)).status, 503); }
      finally { await OP.collection.updateOne({ _id: o._id }, { $set: { nombre: o.nombre } }); }
    });
    await caso('contexto persistido sirve al borrador sin activar catálogo', async () => {
      const r = inspeccionarBorradorRGPD28({ organizacionId: String(a._id), contexto: actual.contexto,
        fechaEvaluacion: new Date().toISOString() });
      assert.equal(r.estado, 'borrador_no_operativo'); assert.equal(r.habilitaEvaluacion, false);
      assert.equal(r.cobertura, 'pendiente_de_delimitar');
      assert.equal((await api('post', '/operaciones/' + actual.operacion.id + '/decisiones')
        .set('Idempotency-Key', key()).send({})).status, 400);
      assert.equal(ok(await api('get', '/contexto/reglas')).sinReglasPublicadas, true);
      assert.equal(ok(await api('get', '/contexto')).contexto.hechos[0].clave, 'solo_general');
    });
    return resultados;
  } finally { await mongoose.disconnect(); }
}
module.exports = { comprobar };
