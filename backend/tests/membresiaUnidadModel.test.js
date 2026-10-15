'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const MembresiaUnidad = require('../models/MembresiaUnidad');

const D = '400000000000000000000001';
const M = '300000000000000000000001';
const datos = cambios => ({ unidad: D, membresia: M, rol: 'miembro', ...cambios });

test('empieza pendiente y no abre conexion', () => {
  const relacion = new MembresiaUnidad(datos());
  assert.equal(relacion.validateSync(), undefined);
  assert.equal(relacion.estado, 'pendiente');
  assert.equal(mongoose.connection.readyState, 0);
});

for (const campo of ['unidad', 'membresia']) {
  test('exige referencia ' + campo + ' sin inventar ID', () => {
    for (const valor of [undefined, null, '']) {
      const relacion = new MembresiaUnidad(datos({ [campo]: valor }));
      assert.ok(relacion.validateSync()?.errors[campo]);
      assert.equal(relacion[campo], valor === null ? null : undefined);
    }
    assert.equal(MembresiaUnidad.schema.path(campo).options.default, undefined);
  });

  test('acepta ObjectId o hexadecimal en ' + campo, () => {
    const id = 'abcdef012345abcdef012345';
    for (const valor of [id, id.toUpperCase(), new mongoose.Types.ObjectId(id)]) {
      const relacion = new MembresiaUnidad(datos({ [campo]: valor }));
      assert.equal(relacion.validateSync(), undefined);
      assert.equal(relacion[campo].toHexString(), id);
    }
  });

  test('rechaza referencias ambiguas o mal formadas en ' + campo, () => {
    for (const valor of [123, true, {}, { _id: M }, [], [M], { $ne: null },
      'abcdefghijkl', 'g'.repeat(24), M.slice(1), ' ' + M]) {
      assert.equal(new MembresiaUnidad(datos({ [campo]: valor }))
        .validateSync()?.errors[campo]?.name, 'CastError');
    }
  });

  test('valida tambien asignaciones posteriores de ' + campo, () => {
    const relacion = new MembresiaUnidad(datos());
    relacion.set(campo, [M]);
    assert.equal(relacion.validateSync()?.errors[campo]?.name, 'CastError');
  });
}

test('exige rol explicito, sin elevar a nadie por defecto', () => {
  assert.equal(MembresiaUnidad.schema.path('rol').options.default, undefined);
  for (const rol of [undefined, null, '', '   ']) {
    assert.ok(new MembresiaUnidad(datos({ rol })).validateSync()?.errors.rol);
  }
});

test('admite miembro y coordinador sin activar la relacion', () => {
  for (const rol of ['miembro', 'coordinador']) {
    const relacion = new MembresiaUnidad(datos({ rol }));
    assert.equal(relacion.validateSync(), undefined);
    assert.equal(relacion.estado, 'pendiente');
  }
});

test('no confunde rol de unidad con rol empresarial o global', () => {
  for (const rol of ['admin', 'administrador', 'colaborador', 'consulta', 'director', 'COORDINADOR', ' miembro ']) {
    assert.ok(new MembresiaUnidad(datos({ rol })).validateSync()?.errors.rol);
  }
});

for (const campo of ['rol', 'estado']) {
  test('no convierte otros tipos a texto en ' + campo, () => {
    for (const valor of [123, true, {}, ['miembro']]) {
      assert.equal(new MembresiaUnidad(datos({ [campo]: valor })).validateSync()?.errors[campo]?.name, 'CastError');
    }
  });
}

test('estados de pertenencia cerrados, sin reglas de transicion implicitas', () => {
  for (const estado of ['pendiente', 'activa', 'suspendida', 'revocada']) {
    assert.equal(new MembresiaUnidad(datos({ estado })).validateSync(), undefined);
  }
  for (const estado of [null, '', 'ACTIVA', 'archivada', 'en_preparacion', ' activa ']) {
    assert.ok(new MembresiaUnidad(datos({ estado })).validateSync()?.errors.estado);
  }
});

test('declara las referencias correctas y no duplica usuario o empresa', () => {
  assert.equal(MembresiaUnidad.schema.path('unidad').options.ref, 'UnidadTrabajo');
  assert.equal(MembresiaUnidad.schema.path('membresia').options.ref, 'Membresia');
  for (const campo of ['usuario', 'organizacion', 'email', 'permisos']) {
    assert.equal(MembresiaUnidad.schema.path(campo), undefined);
    assert.throws(() => new MembresiaUnidad(datos({ [campo]: M })), { name: 'StrictModeError' });
    assert.throws(() => new MembresiaUnidad(datos()).set(campo, M), { name: 'StrictModeError' });
  }
});

test('unicidad declarada por unidad/membresia incluso tras revocacion', () => {
  const indices = MembresiaUnidad.schema.indexes();
  const unicos = indices.filter(([, opciones]) => opciones.unique === true);
  assert.equal(unicos.length, 1);
  const [campos, opciones] = unicos[0];
  assert.deepEqual(campos, { unidad: 1, membresia: 1 });
  assert.equal(opciones.unique, true);
  assert.equal(opciones.name, 'membresia_unidad_pareja_unica');
  assert.equal(opciones.partialFilterExpression, undefined);
  assert.equal(opciones.sparse, undefined);
});

test('no impone una unica unidad por persona ni un coordinador unico', () => {
  for (const relacion of [
    datos(),
    datos({ unidad: '400000000000000000000002' }),
    datos({ rol: 'coordinador' }),
    datos({ membresia: '300000000000000000000002', rol: 'coordinador' })
  ]) {
    assert.equal(new MembresiaUnidad(relacion).validateSync(), undefined);
  }
});

test('validacion aislada no comprueba duplicados ni coherencia entre empresas', () => {
  const primera = new MembresiaUnidad(datos({ estado: 'activa' }));
  const segunda = new MembresiaUnidad(datos({ estado: 'revocada' }));
  assert.equal(primera.validateSync(), undefined);
  assert.equal(segunda.validateSync(), undefined);
  assert.equal(mongoose.connection.readyState, 0);
  // El indice y el futuro servicio de escritura tendran responsabilidades propias.
});

test('coleccion, fechas y modo estricto propios', () => {
  assert.equal(MembresiaUnidad.collection.name, 'membresias_unidad');
  assert.equal(MembresiaUnidad.schema.options.timestamps, true);
  assert.equal(MembresiaUnidad.schema.options.strict, 'throw');
  for (const campo of ['createdAt', 'updatedAt']) {
    assert.equal(MembresiaUnidad.schema.path(campo).instance, 'Date');
  }
});
