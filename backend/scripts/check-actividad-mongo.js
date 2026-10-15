'use strict';
// Prueba HTTP + autenticacion + Mongo REAL, solo sobre el proceso temporal del
// runner. Identidades y cookies sinteticas, sin .env, correo ni navegador.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const O = require('../models/Organizacion');
const M = require('../models/Membresia');
const U = require('../models/UnidadTrabajo');
const P = require('../models/MembresiaUnidad');
const E = require('../models/EventoOrganizacion');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { actualizarUnidad } = require('../services/gestionUnidades');

async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.protocol !== 'mongodb:' || url.hostname !== '127.0.0.1' ||
      !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD) || !url.port || url.port === '27017') {
    throw new Error('Solo admite el Mongo sintetico creado por el runner');
  }
  const resultados = [];
  async function caso(nombre, fn) {
    await fn(); resultados.push(nombre); console.log('OK ' + nombre);
  }
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of [O, M, U, P, E, Usuario, RevokedToken]) await modelo.init();
    const empresas = await O.create([
      { razon_social: 'Empresa A sintetica', pais: 'ES', identificador_tipo: 'NIF', identificador_valor: 'B00000001', estado: 'activa' },
      { razon_social: 'Empresa B sintetica', pais: 'ES', identificador_tipo: 'NIF', identificador_valor: 'B00000002', estado: 'activa' }
    ]);
    const [a, b] = empresas;
    const miembros = {};
    for (const [nombre, empresa, rol] of [
      ['admin', a, 'administrador'], ['coord', a, 'colaborador'], ['miembro', a, 'colaborador'],
      ['consulta', a, 'consulta'], ['adminB', b, 'administrador']
    ]) {
      const usuario = new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({ _id: usuario, nombre: 'Persona sintetica',
        email: usuario + '@example.invalid', password: 'fixture-no-usada-para-login',
        rol: nombre === 'miembro' ? 'admin' : 'usuario',
        emailVerifiedAt: new Date(), sessionVersion: 0 });
      miembros[nombre] = await M.create({ usuario, organizacion: empresa._id, rol, estado: 'activa' });
    }
    const unidades = await U.create([
      { organizacion: a._id, nombre: 'Desarrollo', estado: 'activa' },
      { organizacion: a._id, nombre: 'Soporte', estado: 'activa' },
      { organizacion: a._id, nombre: 'Finanzas', estado: 'activa' },
      { organizacion: a._id, nombre: 'Archivada', estado: 'archivada' },
      { organizacion: b._id, nombre: 'Otra empresa', estado: 'activa' }
    ]);
    const [d, s, f, archivada, ajena] = unidades;
    const pCoord = await P.create({ unidad: d._id, membresia: miembros.coord._id, rol: 'coordinador', estado: 'activa' });
    await P.create({ unidad: s._id, membresia: miembros.coord._id, rol: 'coordinador', estado: 'activa' });
    const pMiembro = await P.create({ unidad: d._id, membresia: miembros.miembro._id, rol: 'miembro', estado: 'revocada' });
    const fechas = ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z', '2026-01-03T10:00:00.000Z'];
    const eventos = [];
    for (let i = 0; i < 9; i++) {
      const unidad = [d, d, d, s, s, f, archivada, ajena, ajena][i];
      const empresa = i < 7 ? a : b;
      const actor = i === 1 ? miembros.coord : i < 7 ? miembros.admin : miembros.adminB;
      const miembro = i < 2;
      const dato = { organizacion: empresa._id, actor: actor.usuario, membresia_actor: actor._id,
        unidad: unidad._id, membresia_unidad: miembro ? pMiembro._id : null,
        accion: miembro ? 'miembro_revocado' : 'unidad_actualizada',
        antes: { estado: 'activa', version: 0 }, despues: { estado: 'activa', version: 1 },
        createdAt: new Date(fechas[i % 3]) };
      // Timestamps historicos solo para el fixture, sin cambiar el reloj del host.
      const validado = new E(dato); await validado.validate();
      const obj = validado.toObject();
      obj.campoPrivadoDePrueba = 'NUNCA_EN_RESPUESTA';
      await E.collection.insertOne(obj);
      eventos.push(obj);
    }
    const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' });
    const cookie = (nombre = 'admin', extras = {}) => 'cyberaudit_token=' + jwt.sign({
      id: String(miembros[nombre].usuario), jti: crypto.randomUUID(), sessionVersion: 0, ...extras
    }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const get = (filtros = {}, nombre = 'admin', empresa = a, token = cookie(nombre)) =>
      request(app).get('/organizaciones/' + empresa._id + '/actividad').query(filtros).set('Cookie', token);
    const ids = res => res.body.data.eventos.map(e => e.id);
    const esperados = arr => arr.map(e => String(e._id)).sort();

    await caso('HTTP real exige cookie completa y cuenta verificada', async () => {
      assert.equal((await request(app).get('/organizaciones/' + a._id + '/actividad')).status, 401);
      assert.equal((await get({}, 'admin', a, cookie('admin', { pending2fa: true }))).status, 401);
      assert.equal((await get({}, 'admin', a, cookie('admin', { sessionVersion: 9 }))).status, 401);
    });
    await caso('administrador solo obtiene su empresa, incluidas unidades archivadas', async () => {
      const r = await get(); assert.equal(r.status, 200);
      assert.deepEqual(ids(r).sort(), esperados(eventos.slice(0, 7)));
      assert.equal(r.text.includes('NUNCA_EN_RESPUESTA'), false);
      assert.equal((await get({}, 'admin', b)).status, 403);
      assert.deepEqual(ids(await get({}, 'adminB', b)).sort(), esperados(eventos.slice(7)));
    });
    await caso('coordinador ve todas y solo sus unidades activas', async () => {
      const r = await get({}, 'coord'); assert.equal(r.status, 200);
      assert.deepEqual(ids(r).sort(), esperados(eventos.slice(0, 5)));
      for (const unidad of [f, archivada, ajena]) {
        assert.equal((await get({ unidadId: String(unidad._id) }, 'coord')).status, 403);
      }
      assert.deepEqual(ids(await get({ unidadId: String(s._id) }, 'coord')).sort(), esperados(eventos.slice(3, 5)));
    });
    await caso('miembro, consulta y admin global sin rol empresarial adecuado se deniegan', async () => {
      assert.equal((await get({}, 'miembro')).status, 403);
      assert.equal((await get({}, 'consulta')).status, 403);
    });
    await caso('combina unidad, autor, accion, categoria y rango [desde,hasta)', async () => {
      const r = await get({ unidadId: String(d._id), actorId: String(miembros.coord.usuario),
        accion: 'miembro_revocado', categoria: 'miembros',
        desde: fechas[1], hasta: fechas[2] });
      assert.equal(r.status, 200);
      assert.deepEqual(ids(r), [String(eventos[1]._id)]);
      assert.deepEqual(ids(await get({ desde: fechas[2], hasta: '2026-01-04T00:00:00Z', unidadId: String(d._id) })),
        [String(eventos[2]._id)]);
    });
    await caso('miembro afectado no se confunde con autor e incluye relacion revocada', async () => {
      const r = await get({ miembroId: String(miembros.miembro._id) });
      assert.deepEqual(ids(r).sort(), esperados(eventos.slice(0, 2)));
      assert.deepEqual(ids(await get({ miembroId: String(miembros.adminB._id) })), []);
      assert.deepEqual(ids(await get({ actorId: String(miembros.miembro.usuario) })), []);
    });
    await caso('paginacion real asc/desc sin duplicados cuando hay fechas iguales', async () => {
      for (const orden of ['asc', 'desc']) {
        const vistos = []; let cursor;
        for (let vuelta = 0; vuelta < 8; vuelta++) {
          const r = await get({ orden, limite: '2', ...(cursor ? { cursor } : {}) });
          assert.equal(r.status, 200);
          assert.ok(ids(r).length <= 2); vistos.push(...ids(r));
          cursor = r.body.data.paginacion.siguienteCursor;
          if (!cursor) break;
        }
        const signo = orden === 'asc' ? 1 : -1;
        const esperado = eventos.slice(0, 7).sort((x, y) =>
          signo * (x.createdAt - y.createdAt || String(x._id).localeCompare(String(y._id)))).map(e => String(e._id));
        assert.deepEqual(vistos, esperado);
        assert.equal(new Set(vistos).size, 7);
      }
    });
    await caso('cursor no sirve con filtros diferentes ni otra identidad/organizacion', async () => {
      const r = await get({ limite: '2' });
      const cursor = r.body.data.paginacion.siguienteCursor;
      assert.equal((await get({ limite: '2', cursor, categoria: 'miembros' })).status, 400);
      assert.equal((await get({ limite: '2', cursor }, 'adminB', b)).status, 400);
      assert.equal((await get({ limite: '2', cursor }, 'coord')).status, 400);
      const manipulado = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      manipulado.corte = '2099-01-01T00:00:00.000Z';
      assert.equal((await get({ limite: '2', cursor: Buffer.from(JSON.stringify(manipulado)).toString('base64url') })).status, 400);
    });
    await caso('corte temporal excluye eventos posteriores durante la paginacion', async () => {
      const r = await get({ limite: '2', orden: 'asc' });
      const corte = r.body.data.paginacion.corte;
      const nuevo = { ...eventos[2], _id: new mongoose.Types.ObjectId(), createdAt: new Date(Date.parse(corte) + 60000) };
      await E.collection.insertOne(nuevo);
      let cursor = r.body.data.paginacion.siguienteCursor;
      const vistos = ids(r);
      while (cursor) {
        const pagina = await get({ limite: '2', orden: 'asc', cursor });
        assert.equal(pagina.status, 200);
        vistos.push(...ids(pagina)); cursor = pagina.body.data.paginacion.siguienteCursor;
      }
      assert.equal(vistos.includes(String(nuevo._id)), false); assert.equal(vistos.length, 7);
    });
    await caso('revocar coordinacion afecta la siguiente pagina aun con la misma cookie', async () => {
      const sesion = cookie('coord');
      const r = await get({ limite: '2' }, 'coord', a, sesion);
      await P.updateOne({ _id: pCoord._id }, { $set: { estado: 'revocada' } });
      try {
        assert.equal((await get({ limite: '2', cursor: r.body.data.paginacion.siguienteCursor }, 'coord', a, sesion)).status, 400);
        assert.deepEqual(ids(await get({}, 'coord', a, sesion)).sort(), esperados(eventos.slice(3, 5)));
      } finally { await P.updateOne({ _id: pCoord._id }, { $set: { estado: 'activa' } }); }
    });
    await caso('revocacion empresarial durante consulta descarta los resultados ya leidos', async () => {
      const original = E.find;
      E.find = function(...args) {
        const q = original.apply(this, args), lean = q.lean;
        q.lean = async function(...aLean) {
          const data = await lean.apply(this, aLean);
          await M.updateOne({ _id: miembros.admin._id }, { $set: { estado: 'revocada' } });
          return data;
        };
        return q;
      };
      try { assert.equal((await get()).status, 403); }
      finally {
        E.find = original;
        await M.updateOne({ _id: miembros.admin._id }, { $set: { estado: 'activa' } });
      }
    });
    await caso('filtros no implementados y operadores no hacen consultas silenciosas', async () => {
      for (const filtro of [{ clienteId: String(a._id) }, { normativaId: 'iso27001' },
        { estandarId: 'ens' }, { categoriaTarea: 'riesgos' }]) {
        const r = await get(filtro); assert.equal(r.status, 400);
        assert.equal(r.body.codigo, 'FILTRO_NO_IMPLEMENTADO');
      }
      const r = await request(app).get('/organizaciones/' + a._id + '/actividad?actorId%5B%24ne%5D=x').set('Cookie', cookie());
      assert.equal(r.status, 400);
    });
    await caso('indices de lectura existen en este Mongo temporal', async () => {
      const indices = await E.collection.listIndexes().toArray();
      assert.ok(indices.some(i => i.name === 'eventos_organizacion_fecha'));
      assert.ok(indices.some(i => i.name === 'eventos_actor_fecha'));
      const plan = await E.collection.find({ organizacion: a._id })
        .sort({ createdAt: -1, _id: -1 }).limit(2).explain('queryPlanner');
      assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /eventos_organizacion_fecha/);
    });
    if (!standalone) {
      await caso('evento creado por el servicio transaccional se consulta por HTTP', async () => {
        const cambio = await actualizarUnidad({
          usuarioId: String(miembros.admin.usuario), organizacionId: String(a._id),
          unidadId: String(d._id), versionUnidad: d.__v, datos: { nombre: 'Desarrollo actualizado' }
        });
        const r = await get({ unidadId: String(d._id), accion: 'unidad_actualizada' });
        assert.equal(r.status, 200);
        assert.equal(r.body.data.eventos[0].despues.nombre, cambio.nombre);
      });
    }
    await caso('consultar no crea eventos adicionales ni cambia roles', async () => {
      const antes = await E.countDocuments();
      const rol = (await M.findById(miembros.admin._id)).rol;
      await get(); await get({ categoria: 'miembros' });
      assert.equal(await E.countDocuments(), antes);
      assert.equal((await M.findById(miembros.admin._id)).rol, rol);
    });
    return resultados;
  } finally { await mongoose.disconnect(); }
}
module.exports = { comprobar };
