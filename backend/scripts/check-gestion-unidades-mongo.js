'use strict';

// Solo lo invoca run-gestion-unidades-mongo.js sobre su mongod temporal.
// No carga .env, no llama a app.js y no autentica usuarios: prueba los servicios
// posteriores a requireAuth, con identidades/empresas completamente sinteticas.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const O = require('../models/Organizacion');
const Cuenta = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const M = require('../models/Membresia');
const U = require('../models/UnidadTrabajo');
const P = require('../models/MembresiaUnidad');
const E = require('../models/EventoOrganizacion');
const gestion = require('../services/gestionUnidades');
const { obtenerContextoUnidad } = require('../services/contextoUnidad');

async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.protocol !== 'mongodb:' || url.hostname !== '127.0.0.1' ||
      !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD) || !url.port || url.port === '27017') {
    throw new Error('Se requiere el Mongo temporal creado por el runner');
  }
  const resultados = [];
  async function caso(nombre, fn) {
    await fn();
    resultados.push(nombre);
    console.log('OK ' + nombre);
  }
  const rechazo = (promesa, codigo) => assert.rejects(promesa, e => {
    assert.equal(e.codigo, codigo);
    return true;
  });
  let numero = 0;
  const hashSintetico = await bcrypt.hash('Clave solo del proceso de pruebas', 4);
  async function fixture() {
    const empresas = [];
    for (let i = 0; i < 2; i++) {
      empresas.push(await O.create({ razon_social: 'Sintetica ' + (++numero),
        pais: 'ES', identificador_tipo: 'NIF',
        identificador_valor: 'B' + String(numero).padStart(8, '0'), estado: 'activa' }));
    }
    const [a, b] = empresas;
    const miembros = {};
    for (const [nombre, empresa, rol] of [
      ['admin', a, 'administrador'], ['coord', a, 'colaborador'],
      ['empleado', a, 'colaborador'], ['consulta', a, 'consulta'],
      ['destino', a, 'colaborador'], ['adminB', b, 'administrador'], ['destinoB', b, 'colaborador']
    ]) {
      // Fixtures directas, SOLO en esta BD temporal. Hash ya calculado; no
      // ejecuta registro, correo ni login. Cuenta existente para la referencia.
      const usuario = new mongoose.Types.ObjectId();
      await Cuenta.collection.insertOne({ _id: usuario, nombre: 'Sintetico',
        email: usuario.toHexString() + '@example.invalid', password: hashSintetico,
        rol: 'usuario', emailVerifiedAt: new Date(), sessionVersion: 0, __v: 0 });
      miembros[nombre] = await M.create({ usuario, organizacion: empresa._id, rol, estado: 'activa' });
    }
    const unidad = await U.create({ organizacion: a._id, nombre: 'Desarrollo', estado: 'activa' });
    const otra = await U.create({ organizacion: a._id, nombre: 'Soporte', estado: 'activa' });
    const ajena = await U.create({ organizacion: b._id, nombre: 'Ajena', estado: 'activa' });
    const locales = {};
    for (const [nombre, rol] of [['coord', 'coordinador'], ['empleado', 'miembro'], ['consulta', 'miembro']]) {
      locales[nombre] = await P.create({
        unidad: unidad._id, membresia: miembros[nombre]._id, rol, estado: 'activa'
      });
    }
    const entrada = (actor = 'admin', u = unidad) => ({
      usuarioId: String(miembros[actor].usuario),
      organizacionId: String(miembros[actor].organizacion), unidadId: String(u._id)
    });
    return { a, b, miembros, unidad, otra, ajena, locales, entrada };
  }
  const actual = doc => U.findById(doc._id).lean();
  const miembroActual = doc => P.findById(doc._id).lean();
  const editar = (f, nombre, rev = f.unidad.__v, actor = 'admin') =>
    gestion.actualizarUnidad({ ...f.entrada(actor), datos: { nombre }, versionUnidad: rev });
  const alta = (f, actor = 'admin', destino = f.miembros.destino, rol = 'miembro', unidad = f.unidad) =>
    gestion.crearMembresiaUnidad({ ...f.entrada(actor, unidad), membresiaId: String(destino._id), rol });
  const estadoMiembro = (f, relacion, accion, actor = 'admin') =>
    gestion.cambiarEstadoMembresiaUnidad({
      ...f.entrada(actor), membresiaUnidadId: String(relacion._id || relacion.id),
      versionMembresia: relacion.__v ?? relacion.version, accion
    });
  const cambiarRol = (f, relacion, rol, actor = 'admin') =>
    gestion.cambiarRolMembresiaUnidad({
      ...f.entrada(actor), membresiaUnidadId: String(relacion._id || relacion.id),
      versionMembresia: relacion.__v ?? relacion.version, rol
    });

  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const Modelo of [O, M, U, P, E, Cuenta]) await Modelo.init();

    if (standalone) {
      await caso('Mongo standalone rechaza transaccion y no guarda unidad ni historial', async () => {
        const f = await fixture();
        const antes = await U.countDocuments(), eventos = await E.countDocuments();
        await rechazo(gestion.crearUnidad({
          usuarioId: f.entrada().usuarioId, organizacionId: String(f.a._id), datos: { nombre: 'No debe existir' }
        }), 'GESTION_NO_DISPONIBLE');
        assert.equal(await U.countDocuments(), antes);
        assert.equal(await E.countDocuments(), eventos);
      });
      return resultados;
    }

    await caso('crear unidad en preparacion y guardar actor/historial atomicamente', async () => {
      const f = await fixture();
      const doc = await gestion.crearUnidad({
        usuarioId: f.entrada().usuarioId, organizacionId: String(f.a._id),
        datos: { nombre: '  Producto  ', descripcion: '  Nueva unidad  ' }
      });
      assert.equal(doc.nombre, 'Producto');
      assert.equal(doc.estado, 'en_preparacion');
      assert.equal(doc.version, 0);
      const evento = await E.findOne({ unidad: doc.id }).lean();
      assert.equal(evento.accion, 'unidad_creada');
      assert.equal(String(evento.actor), f.entrada().usuarioId);
      assert.equal(String(evento.membresia_actor), String(f.miembros.admin._id));
      assert.equal(evento.antes, null);
      assert.equal(evento.despues.version, 0);
      assert.ok(evento.createdAt instanceof Date);
    });

    await caso('coordinador, miembro y consulta no crean, editan o archivan unidades', async () => {
      const f = await fixture();
      for (const actor of ['coord', 'empleado', 'consulta']) {
        await rechazo(gestion.crearUnidad({
          usuarioId: f.entrada(actor).usuarioId, organizacionId: String(f.a._id), datos: { nombre: 'No' }
        }), 'GESTION_DENEGADA');
        await rechazo(editar(f, 'No', 0, actor), 'GESTION_DENEGADA');
        await rechazo(gestion.cambiarEstadoUnidad({
          ...f.entrada(actor), versionUnidad: 0, accion: 'archivar'
        }), 'GESTION_DENEGADA');
      }
      assert.equal((await actual(f.unidad)).nombre, 'Desarrollo');
      assert.equal(await E.countDocuments({ organizacion: f.a._id }), 0);
    });

    await caso('edicion con version vigente y rechazo de formulario antiguo sin evento nuevo', async () => {
      const f = await fixture();
      const nueva = await editar(f, 'Nuevo nombre');
      assert.equal(nueva.version, 1);
      await rechazo(editar(f, 'Nombre antiguo'), 'VERSION_DESACTUALIZADA');
      assert.equal((await actual(f.unidad)).nombre, 'Nuevo nombre');
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 1);
    });

    await caso('archivo conserva miembros/historia; restaurar vuelve a preparacion, no activa', async () => {
      const f = await fixture();
      const miembros = await P.countDocuments({ unidad: f.unidad._id });
      let doc = await gestion.cambiarEstadoUnidad({ ...f.entrada(), versionUnidad: 0, accion: 'archivar' });
      await rechazo(editar(f, 'No', doc.version), 'TRANSICION_INVALIDA');
      await rechazo(gestion.cambiarEstadoUnidad({ ...f.entrada(), versionUnidad: doc.version, accion: 'activar' }), 'TRANSICION_INVALIDA');
      await rechazo(obtenerContextoUnidad(f.entrada('coord')), 'ACCESO_UNIDAD_DENEGADO');
      doc = await gestion.cambiarEstadoUnidad({ ...f.entrada(), versionUnidad: doc.version, accion: 'restaurar' });
      assert.equal(doc.estado, 'en_preparacion');
      await rechazo(obtenerContextoUnidad(f.entrada('coord')), 'ACCESO_UNIDAD_DENEGADO');
      doc = await gestion.cambiarEstadoUnidad({ ...f.entrada(), versionUnidad: doc.version, accion: 'activar' });
      assert.equal(doc.estado, 'activa');
      assert.equal((await obtenerContextoUnidad(f.entrada('coord'))).rolUnidad, 'coordinador');
      assert.equal(await P.countDocuments({ unidad: f.unidad._id }), miembros);
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 3);
    });

    await caso('coordinador anade miembro de su empresa; pendiente no concede acceso', async () => {
      const f = await fixture();
      let relacion = await alta(f, 'coord');
      assert.equal(relacion.estado, 'pendiente');
      assert.equal(relacion.rol, 'miembro');
      await rechazo(obtenerContextoUnidad(f.entrada('destino')), 'ACCESO_UNIDAD_DENEGADO');
      relacion = await estadoMiembro(f, relacion, 'activar', 'coord');
      assert.equal(relacion.estado, 'activa');
      assert.equal((await obtenerContextoUnidad(f.entrada('destino'))).rolUnidad, 'miembro');
      assert.equal(await E.countDocuments({ membresia_unidad: relacion.id }), 2);
    });

    await caso('coordinador cambia rol local de miembro a coordinador sin elevar rol empresarial', async () => {
      const f = await fixture();
      let relacion = await cambiarRol(f, f.locales.empleado, 'coordinador', 'coord');
      assert.equal(relacion.rol, 'coordinador');
      assert.equal((await M.findById(f.miembros.empleado._id)).rol, 'colaborador');
      assert.equal((await obtenerContextoUnidad(f.entrada('empleado'))).rolUnidad, 'coordinador');
      relacion = await cambiarRol(f, relacion, 'miembro', 'coord');
      assert.equal(relacion.rol, 'miembro');
    });

    await caso('coordinador no gestiona miembros de otra unidad ni empresa', async () => {
      const f = await fixture();
      await rechazo(alta(f, 'coord', f.miembros.destino, 'miembro', f.otra), 'ACCESO_UNIDAD_DENEGADO');
      await rechazo(alta(f, 'coord', f.miembros.destino, 'miembro', f.ajena), 'ACCESO_UNIDAD_DENEGADO');
      assert.equal(await P.countDocuments({ membresia: f.miembros.destino._id }), 0);
    });

    await caso('miembro y consulta no gestionan pertenencias de su propia unidad', async () => {
      const f = await fixture();
      for (const actor of ['empleado', 'consulta']) {
        await rechazo(alta(f, actor), 'GESTION_DENEGADA');
        await rechazo(cambiarRol(f, f.locales.coord, 'miembro', actor), 'GESTION_DENEGADA');
        await rechazo(estadoMiembro(f, f.locales.coord, 'revocar', actor), 'GESTION_DENEGADA');
      }
    });

    await caso('admin tampoco mezcla unidad o destinatario de otra empresa', async () => {
      const f = await fixture();
      await rechazo(alta(f, 'admin', f.miembros.destinoB), 'RECURSO_NO_DISPONIBLE');
      await rechazo(alta(f, 'admin', f.miembros.destino, 'miembro', f.ajena), 'RECURSO_NO_DISPONIBLE');
      await rechazo(gestion.cambiarRolMembresiaUnidad({
        ...f.entrada('admin', f.otra), membresiaUnidadId: String(f.locales.coord._id),
        versionMembresia: 0, rol: 'miembro'
      }), 'RECURSO_NO_DISPONIBLE');
    });

    await caso('consulta empresarial no se convierte en coordinador local', async () => {
      const f = await fixture();
      await rechazo(alta(f, 'admin', f.miembros.consulta, 'coordinador'), 'ROL_INCOMPATIBLE');
      await rechazo(cambiarRol(f, f.locales.consulta, 'coordinador', 'coord'), 'ROL_INCOMPATIBLE');
      assert.equal((await miembroActual(f.locales.consulta)).rol, 'miembro');
    });

    await caso('suspension, revocacion y restauracion requieren transiciones explicitas', async () => {
      const f = await fixture();
      let r = await estadoMiembro(f, f.locales.empleado, 'suspender', 'coord');
      await rechazo(obtenerContextoUnidad(f.entrada('empleado')), 'ACCESO_UNIDAD_DENEGADO');
      r = await estadoMiembro(f, r, 'activar', 'coord');
      r = await estadoMiembro(f, r, 'revocar', 'coord');
      await rechazo(estadoMiembro(f, r, 'activar', 'coord'), 'TRANSICION_INVALIDA');
      await rechazo(cambiarRol(f, r, 'coordinador', 'coord'), 'TRANSICION_INVALIDA');
      r = await estadoMiembro(f, r, 'restaurar', 'coord');
      assert.equal(r.estado, 'pendiente');
      await rechazo(obtenerContextoUnidad(f.entrada('empleado')), 'ACCESO_UNIDAD_DENEGADO');
      r = await estadoMiembro(f, r, 'activar', 'coord');
      assert.equal(r.estado, 'activa');
    });

    await caso('coordinador puede rebajarse a miembro y pierde gestion en la siguiente operacion', async () => {
      const f = await fixture();
      const r = await cambiarRol(f, f.locales.coord, 'miembro', 'coord');
      assert.equal(r.version, 1);
      await rechazo(alta(f, 'coord'), 'GESTION_DENEGADA');
    });

    await caso('revocacion de coordinador y de membresia empresarial retiran autoridad', async () => {
      const f = await fixture();
      await estadoMiembro(f, f.locales.coord, 'revocar');
      await rechazo(alta(f, 'coord'), 'ACCESO_UNIDAD_DENEGADO');
      await M.updateOne({ _id: f.miembros.admin._id }, { $set: { estado: 'revocada' } });
      await rechazo(alta(f), 'ACCESO_ORGANIZACION_DENEGADO');
    });

    await caso('retirar permisos sigue siendo posible con unidad archivada y destinatario inactivo', async () => {
      const f = await fixture();
      await gestion.cambiarEstadoUnidad({ ...f.entrada(), versionUnidad: 0, accion: 'archivar' });
      await M.updateOne({ _id: f.miembros.empleado._id }, { $set: { estado: 'revocada' } });
      const r = await estadoMiembro(f, f.locales.empleado, 'revocar');
      assert.equal(r.estado, 'revocada');
      await rechazo(alta(f), 'TRANSICION_INVALIDA');
    });

    await caso('no anade ni activa destinatarios con membresia empresarial suspendida', async () => {
      const f = await fixture();
      const r = await alta(f);
      await M.updateOne({ _id: f.miembros.destino._id }, { $set: { estado: 'suspendida' } });
      await rechazo(estadoMiembro(f, r, 'activar'), 'RECURSO_NO_DISPONIBLE');
      assert.equal((await P.findById(r.id)).estado, 'pendiente');
    });

    await caso('no concede acceso a referencia de cuenta inexistente; permite revocar el resto huerfano', async () => {
      const f = await fixture();
      const r = await alta(f);
      await Cuenta.deleteOne({ _id: f.miembros.destino.usuario }); // Solo fixture temporal.
      await rechazo(estadoMiembro(f, r, 'activar'), 'RECURSO_NO_DISPONIBLE');
      const retirada = await estadoMiembro(f, r, 'revocar');
      assert.equal(retirada.estado, 'revocada');
      assert.equal(await E.countDocuments({ membresia_unidad: r.id }), 2);
    });

    await caso('indices reales impiden duplicados de empresa, membresia y pertenencia', async () => {
      const f = await fixture();
      const r = await alta(f);
      await rechazo(alta(f), 'PERTENENCIA_EXISTENTE');
      await assert.rejects(P.create({ unidad: f.unidad._id, membresia: f.miembros.destino._id, rol: 'miembro' }), e => e.code === 11000);
      await assert.rejects(M.create({
        usuario: f.miembros.admin.usuario, organizacion: f.a._id, rol: 'consulta'
      }), e => e.code === 11000);
      await assert.rejects(O.create({
        razon_social: 'Duplicada', pais: f.a.pais,
        identificador_tipo: f.a.identificador_tipo, identificador_valor: f.a.identificador_valor
      }), e => e.code === 11000);
      assert.equal(await P.countDocuments({ _id: r.id }), 1);
    });

    await caso('falla el historial: rollback de unidad y locks, sin cambio parcial', async () => {
      const f = await fixture();
      const antes = await actual(f.unidad);
      const empresaAntes = await O.findById(f.a._id).lean();
      const actorAntes = await M.findById(f.miembros.admin._id).lean();
      const original = E.create;
      E.create = async () => { throw new Error('fallo de historial sintetico'); };
      try { await rechazo(editar(f, 'No se guarda'), 'GESTION_NO_DISPONIBLE'); }
      finally { E.create = original; }
      assert.deepEqual(await actual(f.unidad), antes);
      assert.deepEqual(await O.findById(f.a._id).lean(), empresaAntes);
      assert.deepEqual(await M.findById(f.miembros.admin._id).lean(), actorAntes);
      assert.equal(await E.countDocuments({ organizacion: f.a._id }), 0);
    });

    await caso('dos ediciones simultaneas: una guarda y otra recibe conflicto de version', async () => {
      const f = await fixture();
      const resultados = await Promise.allSettled([editar(f, 'Version A'), editar(f, 'Version B')]);
      assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(resultados.find(r => r.status === 'rejected').reason.codigo, 'VERSION_DESACTUALIZADA');
      assert.equal((await actual(f.unidad)).__v, 1);
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 1);
    });

    await caso('dos altas simultaneas de la misma pareja dejan una pertenencia y un evento', async () => {
      const f = await fixture();
      const resultados = await Promise.allSettled([alta(f), alta(f)]);
      assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(resultados.find(r => r.status === 'rejected').reason.codigo, 'PERTENENCIA_EXISTENTE');
      assert.equal(await P.countDocuments({ unidad: f.unidad._id, membresia: f.miembros.destino._id }), 1);
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 1);
    });

    // Intercala una escritura REAL tras la lectura de permisos y antes del lock.
    // Solo pausa la primera pasada; los reintentos usan el driver/Mongo reales.
    async function intercalar(Modelo, coincide, durante, trabajo) {
      const original = Modelo.findOneAndUpdate;
      let usado = false;
      Modelo.findOneAndUpdate = function (...args) {
        const consulta = original.apply(this, args);
        if (!usado && coincide(args[0])) {
          usado = true;
          const lean = consulta.lean;
          consulta.lean = function (...opciones) {
            const lectura = lean.apply(this, opciones);
            return (async () => { await durante(); return await lectura; })();
          };
        }
        return consulta;
      };
      try { await trabajo(); assert.equal(usado, true); }
      finally { Modelo.findOneAndUpdate = original; }
    }

    await caso('revocacion empresarial durante la operacion aborta y no conserva autoridad vieja', async () => {
      const f = await fixture();
      await intercalar(O, filtro => String(filtro._id) === String(f.a._id),
        () => M.updateOne({ _id: f.miembros.admin._id }, { $set: { estado: 'revocada' } }),
        () => rechazo(editar(f, 'No'), 'ACCESO_ORGANIZACION_DENEGADO'));
      assert.equal((await actual(f.unidad)).nombre, 'Desarrollo');
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 0);
    });

    await caso('revocacion local del coordinador durante la operacion impide conceder acceso', async () => {
      const f = await fixture();
      await intercalar(O, filtro => String(filtro._id) === String(f.a._id),
        () => P.updateOne({ _id: f.locales.coord._id }, { $set: { estado: 'revocada' } }),
        () => rechazo(alta(f, 'coord'), 'ACCESO_UNIDAD_DENEGADO'));
      assert.equal(await P.countDocuments({ membresia: f.miembros.destino._id }), 0);
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 0);
    });

    await caso('archivo concurrente de unidad impide anadir un miembro sobre la lectura anterior', async () => {
      const f = await fixture();
      await intercalar(O, filtro => String(filtro._id) === String(f.a._id),
        () => U.updateOne({ _id: f.unidad._id }, { $set: { estado: 'archivada' } }),
        () => rechazo(alta(f), 'TRANSICION_INVALIDA'));
      assert.equal(await P.countDocuments({ membresia: f.miembros.destino._id }), 0);
    });

    await caso('revocacion concurrente del destinatario impide guardar pertenencia nueva', async () => {
      const f = await fixture();
      await intercalar(M, filtro => String(filtro._id) === String(f.miembros.destino._id),
        () => M.updateOne({ _id: f.miembros.destino._id }, { $set: { estado: 'revocada' } }),
        () => rechazo(alta(f), 'RECURSO_NO_DISPONIBLE'));
      assert.equal(await P.countDocuments({ membresia: f.miembros.destino._id }), 0);
      assert.equal(await E.countDocuments({ unidad: f.unidad._id }), 0);
    });

    await caso('infraestructura sin indice unico no permite ninguna escritura', async () => {
      const f = await fixture();
      const antes = await actual(f.unidad);
      // Solo se toca el indice de la base temporal de este proceso.
      await P.collection.dropIndex('membresia_unidad_pareja_unica');
      try {
        await rechazo(editar(f, 'No'), 'GESTION_NO_DISPONIBLE');
        await P.collection.createIndex({ unidad: 1, membresia: 1 }, { name: 'membresia_unidad_pareja_unica' });
        await rechazo(editar(f, 'Tampoco'), 'GESTION_NO_DISPONIBLE');
        assert.deepEqual(await actual(f.unidad), antes);
      } finally {
        const indices = await P.collection.listIndexes().toArray();
        if (indices.some(i => i.name === 'membresia_unidad_pareja_unica')) {
          await P.collection.dropIndex('membresia_unidad_pareja_unica');
        }
        await P.collection.createIndex({ unidad: 1, membresia: 1 },
          { name: 'membresia_unidad_pareja_unica', unique: true });
      }
    });
    return resultados;
  } finally {
    await mongoose.disconnect();
  }
}
module.exports = { comprobar };
