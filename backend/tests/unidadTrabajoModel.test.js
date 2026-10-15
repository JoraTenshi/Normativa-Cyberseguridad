'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const UnidadTrabajo = require('../models/UnidadTrabajo');
const Organizacion = require('../models/Organizacion');
const Membresia = require('../models/Membresia');

const A = '200000000000000000000001';
const datos = cambios => ({ organizacion: A, nombre: 'Desarrollo', ...cambios });

test('la unidad empieza en preparacion y no abre conexion ni inventa miembros', () => {
  const unidad = new UnidadTrabajo(datos());
  assert.equal(unidad.validateSync(), undefined);
  assert.equal(unidad.estado, 'en_preparacion');
  assert.equal(unidad.descripcion, null);
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(Object.hasOwn(unidad.toObject(), 'miembros'), false);
});

test('exige empresa sin inventar referencias', () => {
  for (const valor of [undefined, null, '']) {
    const unidad = new UnidadTrabajo(datos({ organizacion: valor }));
    assert.ok(unidad.validateSync()?.errors.organizacion);
    assert.equal(unidad.organizacion, valor === null ? null : undefined);
  }
});

test('acepta referencia ObjectId o hexadecimal, normalizada por Mongoose', () => {
  const id = 'abcdef012345abcdef012345';
  for (const organizacion of [id, id.toUpperCase(), new mongoose.Types.ObjectId(id)]) {
    const unidad = new UnidadTrabajo(datos({ organizacion }));
    assert.equal(unidad.validateSync(), undefined);
    assert.equal(unidad.organizacion.toHexString(), id);
  }
});

test('rechaza referencias ambiguas, objetos, arrays y operadores', () => {
  for (const organizacion of [123, true, {}, { _id: A }, [], [A], { $ne: null },
    'abcdefghijkl', 'g'.repeat(24), A.slice(1), ' ' + A]) {
    const unidad = new UnidadTrabajo(datos({ organizacion }));
    assert.equal(unidad.validateSync()?.errors.organizacion?.name, 'CastError');
  }
});

test('el setter de referencia tambien valida modificaciones', () => {
  const unidad = new UnidadTrabajo(datos());
  unidad.set('organizacion', [A]);
  assert.equal(unidad.validateSync()?.errors.organizacion?.name, 'CastError');
});

test('nombre obligatorio, recortado y limitado a 120 caracteres', () => {
  for (const nombre of [undefined, null, '', '   ', 'a'.repeat(121)]) {
    assert.ok(new UnidadTrabajo(datos({ nombre })).validateSync()?.errors.nombre);
  }
  const unidad = new UnidadTrabajo(datos({ nombre: '  Desarrollo  ' }));
  assert.equal(unidad.validateSync(), undefined);
  assert.equal(unidad.nombre, 'Desarrollo');
  assert.equal(new UnidadTrabajo(datos({ nombre: 'a'.repeat(120) })).validateSync(), undefined);
});

test('descripcion opcional, recortada y limitada a 500 caracteres', () => {
  for (const descripcion of [undefined, null, '', ' ', 'a'.repeat(500)]) {
    assert.equal(new UnidadTrabajo(datos({ descripcion })).validateSync(), undefined);
  }
  const unidad = new UnidadTrabajo(datos({ descripcion: '  Equipo de producto  ' }));
  assert.equal(unidad.descripcion, 'Equipo de producto');
  assert.ok(new UnidadTrabajo(datos({ descripcion: 'a'.repeat(501) })).validateSync()?.errors.descripcion);
});

for (const campo of ['nombre', 'descripcion', 'estado']) {
  test('no convierte otros tipos a texto en ' + campo, () => {
    for (const valor of [123, true, {}, ['activa']]) {
      assert.equal(new UnidadTrabajo(datos({ [campo]: valor })).validateSync()?.errors[campo]?.name, 'CastError');
    }
  });
}

test('estados cerrados sin activar ni archivar una unidad por haber validado datos', () => {
  for (const estado of ['en_preparacion', 'activa', 'archivada']) {
    assert.equal(new UnidadTrabajo(datos({ estado })).validateSync(), undefined);
  }
  for (const estado of [null, '', 'ACTIVA', 'cerrada', 'revocada', ' activa ']) {
    assert.ok(new UnidadTrabajo(datos({ estado })).validateSync()?.errors.estado);
  }
});

test('rechaza campos desconocidos al crear y modificar', () => {
  for (const campo of ['usuario', 'miembros', 'coordinador', 'permisos', 'esAdmin', '$set']) {
    assert.throws(() => new UnidadTrabajo(datos({ [campo]: true })), { name: 'StrictModeError' });
    assert.throws(() => new UnidadTrabajo(datos()).set(campo, true), { name: 'StrictModeError' });
  }
});

test('declara referencia, coleccion, fechas y modo estricto propios', () => {
  assert.equal(UnidadTrabajo.schema.path('organizacion').options.ref, 'Organizacion');
  assert.equal(UnidadTrabajo.collection.name, 'unidades_trabajo');
  assert.equal(UnidadTrabajo.schema.options.timestamps, true);
  assert.equal(UnidadTrabajo.schema.options.strict, 'throw');
  for (const campo of ['createdAt', 'updatedAt']) {
    assert.equal(UnidadTrabajo.schema.path(campo).instance, 'Date');
  }
});

test('declara indice de consulta por empresa/estado, no unicidad del nombre', () => {
  const indices = UnidadTrabajo.schema.indexes();
  assert.equal(indices.length, 1);
  const [campos, opciones] = indices[0];
  assert.deepEqual(campos, { organizacion: 1, estado: 1 });
  assert.equal(opciones.name, 'unidad_organizacion_estado');
  assert.equal(opciones.unique, undefined);
});

test('empresa y membresia empresarial siguen siendo validas sin ninguna unidad', () => {
  const empresa = new Organizacion({
    razon_social: 'Microempresa sintetica', pais: 'ES',
    identificador_tipo: 'NIF', identificador_valor: 'B00000000'
  });
  const miembro = new Membresia({
    usuario: '100000000000000000000001', organizacion: empresa._id, rol: 'administrador'
  });
  assert.equal(empresa.validateSync(), undefined);
  assert.equal(miembro.validateSync(), undefined);
  for (const modelo of [Organizacion, Membresia]) {
    assert.equal(modelo.schema.path('unidad'), undefined);
    assert.equal(modelo.schema.path('unidades'), undefined);
  }
});

test('validar un esquema no acredita existencia de empresa ni autoriza un alta', () => {
  const unidad = new UnidadTrabajo(datos({ estado: 'activa' }));
  assert.equal(unidad.validateSync(), undefined);
  assert.equal(mongoose.connection.readyState, 0);
  // No se consulta la empresa ni se verifica quien asigna un campo conocido.
});
