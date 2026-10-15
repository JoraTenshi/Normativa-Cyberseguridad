'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { crearServicioGestionUnidades, ErrorGestionUnidades } = require('../services/gestionUnidades');
const EventoOrganizacion = require('../models/EventoOrganizacion');

const U = '100000000000000000000001', O = '200000000000000000000001';
const D = '400000000000000000000001', P = '500000000000000000000001';
const base = { usuarioId: U, organizacionId: O, unidadId: D };
const operaciones = {
  crearUnidad: { usuarioId: U, organizacionId: O, datos: { nombre: 'Desarrollo' } },
  actualizarUnidad: { ...base, versionUnidad: 0, datos: { nombre: 'Desarrollo' } },
  cambiarEstadoUnidad: { ...base, versionUnidad: 0, accion: 'activar' },
  crearMembresiaUnidad: { ...base, membresiaId: '300000000000000000000001', rol: 'miembro' },
  cambiarRolMembresiaUnidad: { ...base, membresiaUnidadId: P, versionMembresia: 0, rol: 'miembro' },
  cambiarEstadoMembresiaUnidad: { ...base, membresiaUnidadId: P, versionMembresia: 0, accion: 'activar' }
};

function sinBD() {
  let consultas = 0;
  const prohibida = () => { consultas++; throw new Error('No debe consultar'); };
  const modelo = { collection: { listIndexes: prohibida } };
  return { servicio: crearServicioGestionUnidades({
    conexion: { transaction: prohibida },
    modelos: { Organizacion: modelo, Membresia: modelo, MembresiaUnidad: modelo }
  }), llamadas: () => consultas };
}
async function invalido(promesa) {
  await assert.rejects(promesa, error => {
    assert.ok(error instanceof ErrorGestionUnidades);
    assert.equal(error.codigo, 'DATOS_INVALIDOS');
    assert.equal(error.status, 400);
    return true;
  });
}

for (const [operacion, valida] of Object.entries(operaciones)) {
  test(operacion + ': rechaza campos extra y cuerpo no plano antes de BD', async () => {
    const { servicio, llamadas } = sinBD();
    for (const entrada of [undefined, null, [], true, 'texto', new Date(),
      { ...valida, esAdmin: true }, { ...valida, estado: 'activa' }, { ...valida, $set: {} },
      { ...valida, [Symbol('rol')]: 'administrador' }]) {
      await invalido(servicio[operacion](entrada));
    }
    assert.equal(llamadas(), 0);
  });
  test(operacion + ': rechaza identidad y empresa ambiguas', async () => {
    const { servicio, llamadas } = sinBD();
    for (const campo of ['usuarioId', 'organizacionId']) {
      for (const valor of [undefined, null, '', 'x', 123, {}, [U], { $ne: null }]) {
        await invalido(servicio[operacion]({ ...valida, [campo]: valor }));
      }
    }
    assert.equal(llamadas(), 0);
  });
}

for (const operacion of ['crearUnidad', 'actualizarUnidad']) {
  test(operacion + ': lista cerrada de campos editables y textos limitados', async () => {
    const { servicio, llamadas } = sinBD();
    for (const datos of [undefined, null, [], {}, { estado: 'activa' }, { organizacion: O },
      { nombre: '' }, { nombre: '   ' }, { nombre: 123 }, { nombre: ['A'] },
      { nombre: 'a'.repeat(121) }, { nombre: 'A', descripcion: true },
      { nombre: 'A', descripcion: 'a'.repeat(501) }, { nombre: 'A', permisos: [] }]) {
      await invalido(servicio[operacion]({ ...operaciones[operacion], datos }));
    }
    assert.equal(llamadas(), 0);
  });
}

for (const [operacion, campo] of [
  ['actualizarUnidad', 'versionUnidad'], ['cambiarEstadoUnidad', 'versionUnidad'],
  ['cambiarRolMembresiaUnidad', 'versionMembresia'], ['cambiarEstadoMembresiaUnidad', 'versionMembresia']
]) {
  test(operacion + ': exige version entera, no coercion de texto ni revision negativa', async () => {
    const { servicio, llamadas } = sinBD();
    for (const valor of [undefined, null, -1, 0.5, '0', true, NaN, Infinity, Number.MAX_SAFE_INTEGER, {}, [0]]) {
      await invalido(servicio[operacion]({ ...operaciones[operacion], [campo]: valor }));
    }
    assert.equal(llamadas(), 0);
  });
}
for (const operacion of ['crearMembresiaUnidad', 'cambiarRolMembresiaUnidad']) {
  test(operacion + ': no permite asignar administrador o un rol inventado', async () => {
    const { servicio, llamadas } = sinBD();
    for (const rol of [undefined, null, 'admin', 'administrador', 'consulta', 'COORDINADOR', ['miembro'], {}]) {
      await invalido(servicio[operacion]({ ...operaciones[operacion], rol }));
    }
    assert.equal(llamadas(), 0);
  });
}
for (const operacion of ['cambiarEstadoUnidad', 'cambiarEstadoMembresiaUnidad']) {
  test(operacion + ': accion explicita sin aceptar nombres heredados del prototipo', async () => {
    const { servicio, llamadas } = sinBD();
    for (const accion of [undefined, null, '', 'activa', 'eliminar', 'constructor', 'toString', '__proto__', {}, ['activar']]) {
      await invalido(servicio[operacion]({ ...operaciones[operacion], accion }));
    }
    assert.equal(llamadas(), 0);
  });
}

test('rechaza IDs locales invalidos antes de BD', async () => {
  const { servicio, llamadas } = sinBD();
  for (const [operacion, campo] of [
    ['actualizarUnidad', 'unidadId'], ['crearMembresiaUnidad', 'membresiaId'],
    ['cambiarEstadoMembresiaUnidad', 'membresiaUnidadId']
  ]) {
    for (const valor of [undefined, null, 'g'.repeat(24), { _id: D }, [D]]) {
      await invalido(servicio[operacion]({ ...operaciones[operacion], [campo]: valor }));
    }
  }
  assert.equal(llamadas(), 0);
});

test('exige indices unicos y no abre transaccion si no existen', async () => {
  let transacciones = 0;
  const modelo = { collection: { listIndexes: () => ({ toArray: async () => [] }) } };
  const servicio = crearServicioGestionUnidades({
    conexion: { transaction() { transacciones++; assert.fail('Sin indices'); } },
    modelos: { Organizacion: modelo, Membresia: modelo, MembresiaUnidad: modelo }
  });
  await assert.rejects(servicio.crearUnidad(operaciones.crearUnidad), error => {
    assert.equal(error.codigo, 'GESTION_NO_DISPONIBLE');
    assert.equal(error.status, 503);
    return true;
  });
  assert.equal(transacciones, 0);
});

test('fallo de infraestructura se comunica sin detalles internos', async () => {
  const { servicio } = sinBD();
  await assert.rejects(servicio.crearUnidad(operaciones.crearUnidad), error => {
    assert.equal(error.codigo, 'GESTION_NO_DISPONIBLE');
    assert.equal(error.message, 'Gestión no disponible temporalmente');
    assert.equal(error.cause.message, 'No debe consultar');
    return true;
  });
});

const evento = cambios => ({
  organizacion: O, actor: U, membresia_actor: '300000000000000000000001',
  unidad: D, accion: 'unidad_creada',
  despues: { nombre: 'Desarrollo', descripcion: null, estado: 'en_preparacion', version: 0 },
  ...cambios
});
test('evento guarda actor, ambito y resumen cerrado sin conexion', () => {
  const doc = new EventoOrganizacion(evento());
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.antes, null);
  assert.equal(doc.membresia_unidad, null);
  assert.equal(EventoOrganizacion.schema.path('updatedAt'), undefined);
  assert.equal(EventoOrganizacion.schema.options.versionKey, false);
  assert.equal(mongoose.connection.readyState, 0);
});

test('evento exige referencias y accion conocida', () => {
  for (const campo of ['organizacion', 'actor', 'membresia_actor', 'unidad']) {
    for (const valor of [undefined, null, [U], { _id: U }, 'abc']) {
      assert.ok(new EventoOrganizacion(evento({ [campo]: valor })).validateSync()?.errors[campo]);
    }
  }
  assert.ok(new EventoOrganizacion(evento({ accion: 'borrar_todo' })).validateSync()?.errors.accion);
});

test('evento no acepta datos arbitrarios ni claves de seguridad en los resumenes', () => {
  assert.throws(() => new EventoOrganizacion(evento({ password: 'no' })), { name: 'StrictModeError' });
  const doc = new EventoOrganizacion(evento({
    despues: { nombre: 'Desarrollo', version: 0, password: 'no' }
  }));
  assert.ok(doc.validateSync()?.errors.despues);
  assert.ok(new EventoOrganizacion(evento({ despues: { estado: 'activa', version: -1 } })).validateSync());
});
