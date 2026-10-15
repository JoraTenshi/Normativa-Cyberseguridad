const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Membresia = require('../models/Membresia');
const Organizacion = require('../models/Organizacion');
const Usuario = require('../models/Usuario');

// Identificadores sinteticos: no se consulta ni se escribe en MongoDB.
const usuarioId = new mongoose.Types.ObjectId('100000000000000000000001');
const organizacionId = new mongoose.Types.ObjectId('200000000000000000000001');
function relacion(cambios = {}) {
  return { usuario: usuarioId, organizacion: organizacionId, rol: 'consulta', ...cambios };
}

test('empieza pendiente, sin funcion profesional y sin abrir conexion', () => {
  const membresia = new Membresia(relacion());
  assert.equal(membresia.validateSync(), undefined);
  assert.equal(membresia.estado, 'pendiente');
  assert.equal(membresia.funcion_profesional, null);
  assert.ok(membresia._id instanceof mongoose.Types.ObjectId);
  assert.equal(mongoose.connection.readyState, 0);
});

for (const campo of ['usuario', 'organizacion']) {
  test('exige la referencia ' + campo + ' sin inventar un ID', () => {
    for (const valor of [undefined, null, '']) {
      const membresia = new Membresia(relacion({ [campo]: valor }));
      assert.ok(membresia.validateSync()?.errors[campo], String(valor));
      assert.equal(membresia[campo], valor === null ? null : undefined);
    }
    assert.equal(Membresia.schema.path(campo).options.default, undefined);
  });

  test('acepta ObjectId y su cadena hexadecimal en ' + campo, () => {
    const valor = 'abcdef012345abcdef012345';
    for (const referencia of [new mongoose.Types.ObjectId(valor), valor, valor.toUpperCase()]) {
      const membresia = new Membresia(relacion({ [campo]: referencia }));
      assert.equal(membresia.validateSync(), undefined);
      assert.ok(membresia[campo] instanceof mongoose.Types.ObjectId);
      assert.equal(membresia[campo].toHexString(), valor);
    }
  });

  test('rechaza referencias mal formadas y tipos ambiguos en ' + campo, () => {
    const valid = 'abcdef012345abcdef012345';
    for (const valor of [
      'abcdefghijkl', 'g'.repeat(24), valid.slice(1), valid + 'a', ' ' + valid,
      123, true, {}, { _id: valid }, [], [valid], { $ne: null }
    ]) {
      const error = new Membresia(relacion({ [campo]: valor })).validateSync();
      assert.equal(error?.errors[campo]?.name, 'CastError', JSON.stringify(valor));
    }
  });

  test('aplica la comprobacion de ID tambien al asignar ' + campo, () => {
    const membresia = new Membresia(relacion());
    membresia.set(campo, [usuarioId.toHexString()]);
    assert.equal(membresia.validateSync()?.errors[campo]?.name, 'CastError');
  });
}

test('no asigna un rol por defecto ni admite un rol vacio', () => {
  assert.equal(Membresia.schema.path('rol').options.default, undefined);
  for (const rol of [undefined, null, '', '   ']) {
    assert.ok(new Membresia(relacion({ rol })).validateSync()?.errors.rol);
  }
});

test('admite los tres roles organizativos sin activar la membresia', () => {
  for (const rol of ['administrador', 'colaborador', 'consulta']) {
    const membresia = new Membresia(relacion({ rol }));
    assert.equal(membresia.validateSync(), undefined);
    assert.equal(membresia.rol, rol);
    assert.equal(membresia.estado, 'pendiente');
  }
});

test('rechaza roles globales, inventados o normalizados implicitamente', () => {
  for (const rol of ['admin', 'usuario', 'propietario', 'director', 'ADMINISTRADOR', ' consulta ']) {
    assert.ok(new Membresia(relacion({ rol })).validateSync()?.errors.rol);
  }
});

for (const campo of ['rol', 'estado', 'funcion_profesional']) {
  test('no convierte otros tipos a texto en ' + campo, () => {
    for (const valor of [123, true, {}, ['consulta']]) {
      const error = new Membresia(relacion({ [campo]: valor })).validateSync();
      assert.equal(error?.errors[campo]?.name, 'CastError');
    }
  });
}

test('admite los estados internos sin simular autorizacion o transiciones', () => {
  for (const estado of ['pendiente', 'activa', 'suspendida', 'revocada']) {
    assert.equal(new Membresia(relacion({ estado })).validateSync(), undefined);
  }
  // Que el valor sea valido no comprueba quien lo asigna ni el estado anterior.
});

test('rechaza estados vacios, ajenos y estados de organizacion', () => {
  for (const estado of [null, '', 'ACTIVA', 'en_preparacion', 'cerrada', 'verificada']) {
    assert.ok(new Membresia(relacion({ estado })).validateSync()?.errors.estado);
  }
});

test('la funcion profesional es opcional y descriptiva, no una fuente de rol', () => {
  for (const funcion_profesional of [undefined, null, '', '   ']) {
    assert.equal(new Membresia(relacion({ funcion_profesional })).validateSync(), undefined);
  }
  const membresia = new Membresia(relacion({ funcion_profesional: '  Director de Tecnología  ' }));
  assert.equal(membresia.validateSync(), undefined);
  assert.equal(membresia.funcion_profesional, 'Director de Tecnología');
  assert.equal(membresia.rol, 'consulta');
  assert.equal(membresia.estado, 'pendiente');
  assert.ok(new Membresia(relacion({ rol: undefined, funcion_profesional: 'Administrador' }))
    .validateSync()?.errors.rol);
});

test('limita la funcion profesional a 120 caracteres', () => {
  assert.equal(new Membresia(relacion({ funcion_profesional: 'a'.repeat(120) })).validateSync(), undefined);
  assert.ok(new Membresia(relacion({ funcion_profesional: 'a'.repeat(121) }))
    .validateSync()?.errors.funcion_profesional);
});

test('rechaza campos ajenos al construir y al modificar', () => {
  for (const campo of ['email', 'password', 'permisos', 'esAdmin', 'verificado', '$set']) {
    assert.throws(() => new Membresia(relacion({ [campo]: true })), { name: 'StrictModeError' });
    const membresia = new Membresia(relacion());
    assert.throws(() => membresia.set(campo, true), { name: 'StrictModeError' });
  }
});

test('declara las referencias a los modelos correctos y no incrusta sus datos', () => {
  for (const [campo, modelo] of [['usuario', 'Usuario'], ['organizacion', 'Organizacion']]) {
    assert.equal(Membresia.schema.path(campo).instance, 'ObjectId');
    assert.equal(Membresia.schema.path(campo).options.ref, modelo);
  }
  const datos = new Membresia(relacion()).toObject();
  for (const campo of ['email', 'password', 'razon_social', 'identificador_valor', 'permisos']) {
    assert.equal(Object.hasOwn(datos, campo), false);
  }
});

test('declara unicidad por pareja sin excepciones por rol o estado', () => {
  const indices = Membresia.schema.indexes();
  assert.equal(indices.length, 1);
  const [campos, opciones] = indices[0];
  assert.deepEqual(campos, { organizacion: 1, usuario: 1 });
  assert.equal(opciones.unique, true);
  assert.equal(opciones.name, 'membresia_organizacion_usuario_unica');
  assert.equal(opciones.partialFilterExpression, undefined);
  assert.equal(opciones.sparse, undefined);
  // Declaracion de esquema, NO construccion ni verificacion del indice real.
});

test('representa varios miembros y organizaciones sin imponer unicidad individual', () => {
  const relaciones = [
    relacion(),
    relacion({ usuario: new mongoose.Types.ObjectId('100000000000000000000002') }),
    relacion({ organizacion: new mongoose.Types.ObjectId('200000000000000000000002'), rol: 'colaborador' })
  ];
  for (const datos of relaciones) {
    assert.equal(new Membresia(datos).validateSync(), undefined);
  }
  // No presupone que el flujo publico permita elegir o acceder a otra empresa.
});

test('la validacion en memoria no comprueba duplicados ni existencia de referencias', () => {
  for (const estado of ['pendiente', 'revocada']) {
    const primera = new Membresia(relacion({ estado }));
    const segunda = new Membresia(relacion({ estado }));
    assert.equal(primera.validateSync(), undefined);
    assert.equal(segunda.validateSync(), undefined);
  }
  assert.equal(mongoose.connection.readyState, 0);
});

test('usa coleccion y fechas propias sin alterar los modelos anteriores', () => {
  assert.equal(Membresia.collection.name, 'membresias');
  assert.equal(Membresia.schema.options.timestamps, true);
  assert.equal(Membresia.schema.options.strict, 'throw');
  for (const campo of ['createdAt', 'updatedAt']) {
    assert.equal(Membresia.schema.path(campo).instance, 'Date');
  }
  const usuario = new Usuario({ nombre: 'Prueba', email: 'prueba@example.invalid', password: 'solo-prueba' });
  const organizacion = new Organizacion({
    razon_social: 'Empresa sintetica', pais: 'ES', identificador_tipo: 'NIF', identificador_valor: 'B00000000'
  });
  assert.equal(usuario.rol, 'usuario');
  assert.deepEqual(Usuario.schema.path('rol').enumValues, ['usuario', 'admin']);
  assert.equal(organizacion.estado, 'en_preparacion');
  const membresia = new Membresia(relacion({
    usuario: usuario._id, organizacion: organizacion._id, rol: 'administrador', estado: 'activa'
  }));
  assert.equal(membresia.validateSync(), undefined);
  assert.equal(usuario.rol, 'usuario');
  assert.equal(organizacion.estado, 'en_preparacion');
  // Demuestra el limite: no hay comprobacion cruzada ni elevacion de Usuario.
});

test('strict no sustituye la autorizacion sobre campos conocidos', () => {
  const membresia = new Membresia(relacion());
  membresia.set('rol', 'administrador');
  membresia.set('estado', 'activa');
  assert.equal(membresia.validateSync(), undefined);
  // Nunca asignar directamente req.body: la politica de acceso sigue pendiente.
});
