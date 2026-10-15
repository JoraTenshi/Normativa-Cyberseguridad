const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Organizacion = require('../models/Organizacion');
const Usuario = require('../models/Usuario');

// Datos sinteticos. Estas pruebas no conectan con MongoDB, SMTP ni proveedores.
function ficha(cambios = {}) {
  return {
    razon_social: 'Empresa de prueba interna',
    pais: 'ES',
    identificador_tipo: 'NIF',
    identificador_valor: 'B00000000',
    ...cambios
  };
}

test('una ficha nueva empieza en preparacion y no abre una conexion', () => {
  const organizacion = new Organizacion(ficha());
  assert.equal(organizacion.validateSync(), undefined);
  assert.equal(organizacion.estado, 'en_preparacion');
  assert.ok(organizacion._id instanceof mongoose.Types.ObjectId);
  assert.equal(mongoose.connection.readyState, 0);
});

test('normaliza espacios exteriores y mayusculas sin alterar la razon social', () => {
  const organizacion = new Organizacion(ficha({
    razon_social: '  Desarrollo Ágil & Servicios, S.L.  ',
    pais: ' es ',
    identificador_tipo: ' nif ',
    identificador_valor: ' b00000000 '
  }));
  assert.equal(organizacion.validateSync(), undefined);
  assert.equal(organizacion.razon_social, 'Desarrollo Ágil & Servicios, S.L.');
  assert.equal(organizacion.pais, 'ES');
  assert.equal(organizacion.identificador_tipo, 'NIF');
  assert.equal(organizacion.identificador_valor, 'B00000000');
});

for (const campo of ['razon_social', 'pais', 'identificador_tipo', 'identificador_valor']) {
  test('exige ' + campo + ' sin inferir datos ausentes', () => {
    for (const valor of [undefined, null, '', '   ']) {
      const error = new Organizacion(ficha({ [campo]: valor })).validateSync();
      assert.ok(error?.errors[campo], campo + ': ' + String(valor));
    }
  });
}

test('limita la razon social a 200 caracteres', () => {
  assert.equal(new Organizacion(ficha({ razon_social: 'a'.repeat(200) })).validateSync(), undefined);
  assert.ok(new Organizacion(ficha({ razon_social: 'a'.repeat(201) })).validateSync()?.errors.razon_social);
});

test('no presenta cobertura de otros paises o identificadores', () => {
  for (const pais of ['FR', 'España', 'ZZ']) {
    assert.ok(new Organizacion(ficha({ pais })).validateSync()?.errors.pais);
  }
  for (const identificador_tipo of ['VAT', 'CIF', 'REGISTRO']) {
    assert.ok(new Organizacion(ficha({ identificador_tipo })).validateSync()?.errors.identificador_tipo);
  }
});

test('exige nueve caracteres alfanumericos sin corregir separadores internos', () => {
  for (const valor of ['B0000000', 'B000000000', 'B-0000000', 'B 0000000', 'B0000000Ñ', 'B000\n0000']) {
    assert.ok(new Organizacion(ficha({ identificador_valor: valor })).validateSync()?.errors.identificador_valor);
  }
});

for (const campo of ['razon_social', 'pais', 'identificador_tipo', 'identificador_valor', 'estado']) {
  test('no convierte otros tipos a texto en ' + campo, () => {
    for (const valor of [123456789, true, {}, ['ES']]) {
      const error = new Organizacion(ficha({ [campo]: valor })).validateSync();
      assert.equal(error?.errors[campo]?.name, 'CastError');
    }
  });
}

test('admite los estados del modelo sin confundirlos con autorizacion de una ruta', () => {
  for (const estado of ['en_preparacion', 'activa', 'suspendida', 'cerrada']) {
    assert.equal(new Organizacion(ficha({ estado })).validateSync(), undefined);
  }
  // El enum no impide que codigo interno asigne activa: la autorizacion y
  // las transiciones controladas pertenecen al futuro servicio, no al modelo.
});

test('rechaza estados nulos, vacios o no definidos', () => {
  for (const estado of [null, '', 'verificada', 'aprobada', 'ACTIVA']) {
    assert.ok(new Organizacion(ficha({ estado })).validateSync()?.errors.estado);
  }
});

test('rechaza campos ajenos y no crea roles ni pertenencias', () => {
  for (const campo of ['rol', 'administrador', 'usuario', 'miembros', 'verificado', '$set']) {
    assert.throws(
      () => new Organizacion(ficha({ [campo]: 'valor no permitido' })),
      { name: 'StrictModeError' }
    );
  }
  const guardable = new Organizacion(ficha()).toObject();
  for (const campo of ['rol', 'administrador', 'usuario', 'miembros', 'verificado']) {
    assert.equal(Object.hasOwn(guardable, campo), false);
  }
});

test('rechaza tambien campos ajenos cuando se utiliza set', () => {
  const organizacion = new Organizacion(ficha());
  assert.throws(() => organizacion.set('rol', 'admin'), { name: 'StrictModeError' });
});

test('declara un indice unico por pais, tipo y valor normalizados', () => {
  const indices = Organizacion.schema.indexes();
  assert.equal(indices.length, 1);
  const [campos, opciones] = indices[0];
  assert.deepEqual(campos, { pais: 1, identificador_tipo: 1, identificador_valor: 1 });
  assert.equal(opciones.unique, true);
  assert.equal(opciones.name, 'organizacion_identificador_unico');
  // Comprueba la declaracion, NO un indice construido en MongoDB.
});

test('usa coleccion propia y fechas, sin mezclar la entidad con el perfil del usuario', () => {
  assert.equal(Organizacion.collection.name, 'organizaciones');
  assert.equal(Organizacion.schema.options.timestamps, true);
  assert.equal(Organizacion.schema.options.strict, 'throw');
  assert.equal(Organizacion.schema.path('createdAt').instance, 'Date');
  assert.equal(Organizacion.schema.path('updatedAt').instance, 'Date');
  const perfil = Usuario.schema.path('organizacion').schema;
  assert.ok(perfil.path('sector'));
  assert.equal(perfil.path('identificador_valor'), undefined);
});

test('aceptar la forma no acredita un NIF, una empresa ni su unicidad real', () => {
  const primero = new Organizacion(ficha({ identificador_valor: 'ZZZZZZZZZ' }));
  const segundo = new Organizacion(ficha({ identificador_valor: 'ZZZZZZZZZ' }));
  assert.equal(primero.validateSync(), undefined);
  assert.equal(segundo.validateSync(), undefined);
  assert.equal(primero.estado, 'en_preparacion');
  assert.equal(mongoose.connection.readyState, 0);
  // La validacion completa de NIF, la consulta externa y la activacion no
  // estan implementadas; los duplicados los rechazara el indice real.
});
