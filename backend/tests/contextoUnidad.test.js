'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  crearServicioContextoOrganizacion,
  ErrorContextoOrganizacion
} = require('../services/contextoOrganizacion');
const {
  obtenerContextoUnidad,
  crearServicioContextoUnidad,
  ErrorContextoUnidad
} = require('../services/contextoUnidad');

const U = '100000000000000000000001';
const V = '100000000000000000000002';
const A = '200000000000000000000001';
const B = '200000000000000000000002';
const M = '300000000000000000000001';
const N = '300000000000000000000002';
const D = '400000000000000000000001';
const E = '400000000000000000000002';
const F = '400000000000000000000003';
const R = '500000000000000000000001';
const entrada = { usuarioId: U, organizacionId: A, unidadId: D };

// Ambos servicios son reales; solo se sustituyen las consultas de los modelos.
// No hay usuarios, sesiones, datos persistidos ni una conexion a Mongo.
function entorno() {
  const datos = {
    empresas: [{ _id: A, estado: 'activa' }, { _id: B, estado: 'activa' }],
    miembros: [{ _id: M, usuario: U, organizacion: A, rol: 'colaborador', estado: 'activa' }],
    unidades: [
      { _id: D, organizacion: A, estado: 'activa' },
      { _id: E, organizacion: A, estado: 'activa' },
      { _id: F, organizacion: B, estado: 'activa' }
    ],
    pertenencias: [{ _id: R, unidad: D, membresia: M, rol: 'miembro', estado: 'activa' }],
    consultas: [], fallos: {}, forzadas: {}
  };
  function consulta(tipo, filtro, resultado) {
    const llamada = { tipo, filtro };
    datos.consultas.push(llamada);
    return {
      select(campos) { llamada.campos = campos; return this; },
      read(preferencia) { llamada.preferencia = preferencia; return this; },
      limit(limite) { llamada.limite = limite; return this; },
      async lean() {
        if (datos.fallos[tipo]) throw datos.fallos[tipo];
        if (Object.hasOwn(datos.forzadas, tipo)) return datos.forzadas[tipo];
        const valor = resultado();
        return Array.isArray(valor)
          ? valor.slice(0, llamada.limite).map(item => ({ ...item }))
          : valor && { ...valor };
      }
    };
  }
  const coincide = (fila, filtro) => Object.entries(filtro)
    .every(([campo, valor]) => String(fila[campo]).toLowerCase() === String(valor).toLowerCase());
  const resolverOrganizacion = crearServicioContextoOrganizacion({
    MembresiaModel: {
      find: filtro => consulta('miembro', filtro, () => datos.miembros.filter(m => coincide(m, filtro)))
    },
    OrganizacionModel: {
      findById: id => consulta('empresa', id, () => datos.empresas.find(e => String(e._id) === id))
    }
  });
  const resolver = crearServicioContextoUnidad({
    resolverOrganizacion,
    UnidadTrabajoModel: {
      findOne: filtro => consulta('unidad', filtro, () => datos.unidades.find(u => coincide(u, filtro)))
    },
    MembresiaUnidadModel: {
      find: filtro => consulta('pertenencia', filtro, () => datos.pertenencias.filter(p => coincide(p, filtro)))
    }
  });
  return { datos, resolver, resolverOrganizacion };
}

async function rechaza(promesa, Clase, codigo, status) {
  await assert.rejects(promesa, error => {
    assert.ok(error instanceof Clase);
    assert.equal(error.codigo, codigo);
    assert.equal(error.status, status);
    return true;
  });
}
const denegado = promesa => rechaza(promesa, ErrorContextoUnidad, 'ACCESO_UNIDAD_DENEGADO', 403);
const denegadoEmpresa = promesa =>
  rechaza(promesa, ErrorContextoOrganizacion, 'ACCESO_ORGANIZACION_DENEGADO', 403);

test('devuelve contexto minimo congelado con roles separados, sin conceder acciones', async () => {
  const { datos, resolver } = entorno();
  datos.unidades[0].nombre = 'Nombre interno';
  datos.pertenencias[0].permisos = ['editar_todo'];
  const contexto = await resolver(entrada);
  assert.deepEqual(contexto, {
    usuarioId: U, organizacionId: A, membresiaId: M, rolOrganizacion: 'colaborador',
    unidadId: D, membresiaUnidadId: R, rolUnidad: 'miembro', origenAcceso: 'membresia_unidad'
  });
  assert.equal(Object.isFrozen(contexto), true);
  assert.throws(() => { contexto.rolUnidad = 'coordinador'; }, TypeError);
  assert.equal(mongoose.connection.readyState, 0);
});

test('consulta empresa primero y filtra la pareja empresa/unidad y unidad/membresia', async () => {
  const { datos, resolver } = entorno();
  await resolver(entrada);
  assert.deepEqual(datos.consultas.map(c => c.tipo), ['miembro', 'empresa', 'unidad', 'pertenencia']);
  assert.deepEqual(datos.consultas.slice(2), [
    { tipo: 'unidad', filtro: { _id: D, organizacion: A },
      campos: '_id organizacion estado', preferencia: 'primary' },
    { tipo: 'pertenencia', filtro: { unidad: D, membresia: M },
      campos: '_id unidad membresia rol estado', preferencia: 'primary', limite: 2 }
  ]);
});

test('no acepta identidad ni empresa incorrectas y no consulta unidades en esos casos', async () => {
  const { datos, resolver } = entorno();
  await rechaza(resolver(), ErrorContextoOrganizacion, 'SESION_REQUERIDA', 401);
  await rechaza(resolver({ ...entrada, usuarioId: [U] }),
    ErrorContextoOrganizacion, 'SESION_REQUERIDA', 401);
  await rechaza(resolver({ ...entrada, organizacionId: { $ne: null } }),
    ErrorContextoOrganizacion, 'ORGANIZACION_INVALIDA', 400);
  assert.equal(datos.consultas.length, 0);
});

test('no sustituye unidad ausente/invalida por una unidad general', async () => {
  const { datos, resolver } = entorno();
  for (const unidadId of [undefined, null, '', 'abc', 'g'.repeat(24), 123, true, {}, [D], { $ne: null }]) {
    await rechaza(resolver({ ...entrada, unidadId }), ErrorContextoUnidad, 'UNIDAD_INVALIDA', 400);
  }
  assert.equal(datos.consultas.some(c => ['unidad', 'pertenencia'].includes(c.tipo)), false);
});

test('acepta ObjectId y hexadecimal mayusculo y devuelve ID canonico', async () => {
  const { datos, resolver } = entorno();
  const id = 'abcdef012345abcdef012345';
  datos.unidades[0]._id = id;
  datos.pertenencias[0].unidad = new mongoose.Types.ObjectId(id);
  for (const unidadId of [id.toUpperCase(), new mongoose.Types.ObjectId(id)]) {
    const contexto = await resolver({ ...entrada, unidadId });
    assert.equal(contexto.unidadId, id);
  }
});

test('una pertenencia local no permite entrar en otra empresa sin membresia empresarial', async () => {
  const { datos, resolver } = entorno();
  datos.pertenencias.push({ _id: R, unidad: F, membresia: M, rol: 'coordinador', estado: 'activa' });
  await denegadoEmpresa(resolver({ ...entrada, organizacionId: B, unidadId: F }));
  assert.deepEqual(datos.consultas.map(c => c.tipo), ['miembro']);
});

test('no deja mezclar unidad de B con empresa A aunque exista una relacion local corrupta', async () => {
  const { datos, resolver } = entorno();
  datos.pertenencias[0].unidad = F;
  await denegado(resolver({ ...entrada, unidadId: F }));
  assert.equal(datos.consultas.some(c => c.tipo === 'pertenencia'), false);
});

test('otro usuario no hereda la membresia ni las unidades del primero', async () => {
  const { resolver } = entorno();
  await denegadoEmpresa(resolver({ ...entrada, usuarioId: V }));
});

test('otra membresia de la misma empresa tampoco hereda la pertenencia local', async () => {
  const { datos, resolver } = entorno();
  datos.miembros.push({ _id: N, usuario: V, organizacion: A, rol: 'colaborador', estado: 'activa' });
  await denegado(resolver({ ...entrada, usuarioId: V }));
});

test('la relacion local con una membresia de otra empresa no sirve', async () => {
  const { datos, resolver } = entorno();
  datos.miembros.push({ _id: N, usuario: U, organizacion: B, rol: 'colaborador', estado: 'activa' });
  datos.pertenencias[0].membresia = N;
  await denegado(resolver(entrada));
});

test('membresia empresarial ausente o revocada prevalece sobre coordinador local activo', async () => {
  for (const preparar of [
    d => { d.miembros = []; },
    d => { d.miembros[0].estado = 'revocada'; },
    d => { d.miembros[0].estado = 'suspendida'; },
    d => { d.miembros[0].estado = 'pendiente'; }
  ]) {
    const { datos, resolver } = entorno();
    datos.pertenencias[0].rol = 'coordinador';
    preparar(datos);
    await denegadoEmpresa(resolver(entrada));
    assert.equal(datos.consultas.some(c => c.tipo === 'unidad'), false);
  }
});

test('empresa ausente o no activa prevalece sobre la unidad y pertenencia activas', async () => {
  for (const estado of [null, 'en_preparacion', 'suspendida', 'cerrada']) {
    const { datos, resolver } = entorno();
    if (estado === null) datos.empresas = [];
    else datos.empresas[0].estado = estado;
    await denegadoEmpresa(resolver(entrada));
    assert.equal(datos.consultas.some(c => c.tipo === 'unidad'), false);
  }
});

test('unidad ausente o archivada no permite acceso ordinario ni al administrador', async () => {
  for (const rol of ['colaborador', 'administrador']) {
    for (const estado of [null, 'en_preparacion', 'archivada', undefined, 'ACTIVA', 'inventado']) {
      const { datos, resolver } = entorno();
      datos.miembros[0].rol = rol;
      if (estado === null) datos.unidades = [];
      else datos.unidades[0].estado = estado;
      await denegado(resolver(entrada));
      assert.equal(datos.consultas.some(c => c.tipo === 'pertenencia'), false);
    }
  }
});

test('sin pertenencia local un colaborador o una cuenta de consulta no accede', async () => {
  for (const rol of ['colaborador', 'consulta']) {
    const { datos, resolver } = entorno();
    datos.miembros[0].rol = rol;
    datos.pertenencias = [];
    await denegado(resolver(entrada));
  }
});

for (const estado of ['pendiente', 'suspendida', 'revocada', undefined, null, 'ACTIVA', 'inventado']) {
  test('deniega pertenencia local con estado ' + String(estado), async () => {
    const { datos, resolver } = entorno();
    datos.pertenencias[0].estado = estado;
    await denegado(resolver(entrada));
  });
}

test('reconoce al coordinador solo en su unidad, sin elevar su rol empresarial', async () => {
  const { datos, resolver } = entorno();
  datos.pertenencias[0].rol = 'coordinador';
  const contexto = await resolver(entrada);
  assert.equal(contexto.rolUnidad, 'coordinador');
  assert.equal(contexto.rolOrganizacion, 'colaborador');
  await denegado(resolver({ ...entrada, unidadId: E }));
  datos.pertenencias.push({ _id: '500000000000000000000002',
    unidad: E, membresia: M, rol: 'miembro', estado: 'activa' });
  assert.equal((await resolver({ ...entrada, unidadId: E })).rolUnidad, 'miembro');
});

test('consulta mas miembro conserva el rol de consulta, sin permiso de escritura', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'consulta';
  const contexto = await resolver(entrada);
  assert.equal(contexto.rolOrganizacion, 'consulta');
  assert.equal(contexto.rolUnidad, 'miembro');
  assert.equal(Object.hasOwn(contexto, 'permisos'), false);
});

test('deniega combinacion contradictoria consulta mas coordinador sin elevar privilegios', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'consulta';
  datos.pertenencias[0].rol = 'coordinador';
  await denegado(resolver(entrada));
});

test('roles locales vacios, empresariales, globales y tipos incorrectos se rechazan', async () => {
  const { datos, resolver } = entorno();
  for (const rol of [undefined, null, '', 'administrador', 'admin', 'consulta', 'COORDINADOR', {}, ['miembro']]) {
    datos.pertenencias[0].rol = rol;
    await denegado(resolver(entrada));
  }
});

test('administrador empresarial supervisa su unidad sin pertenencia local ficticia', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'administrador';
  datos.pertenencias = [];
  // Esa consulta no debe ejecutarse ni condicionar la responsabilidad empresarial.
  datos.fallos.pertenencia = new Error('no deberia consultar membresias locales');
  const contexto = await resolver(entrada);
  assert.deepEqual(contexto, {
    usuarioId: U, organizacionId: A, membresiaId: M, rolOrganizacion: 'administrador',
    unidadId: D, membresiaUnidadId: null, rolUnidad: null, origenAcceso: 'administracion_organizacion'
  });
  assert.equal(Object.isFrozen(contexto), true);
  assert.equal(datos.consultas.some(c => c.tipo === 'pertenencia'), false);
});

test('revocar pertenencia local no retira la responsabilidad de administrador empresarial', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'administrador';
  datos.pertenencias[0].estado = 'revocada';
  assert.equal((await resolver(entrada)).origenAcceso, 'administracion_organizacion');
  datos.miembros[0].estado = 'revocada';
  await denegadoEmpresa(resolver(entrada));
});

test('administrador empresarial no accede a unidades de otra empresa', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'administrador';
  await denegado(resolver({ ...entrada, unidadId: F }));
  await denegadoEmpresa(resolver({ ...entrada, organizacionId: B, unidadId: F }));
});

test('no acepta roles, membresias ni contextos aportados por el llamador', async () => {
  const { datos, resolver } = entorno();
  const falsificado = {
    ...entrada, rol: 'administrador', rolOrganizacion: 'administrador',
    rolUnidad: 'coordinador', membresiaId: N, membresiaUnidadId: R,
    contextoOrganizacion: { rol: 'administrador', organizacionId: B },
    origenAcceso: 'administracion_organizacion', esAdmin: true
  };
  assert.equal((await resolver(falsificado)).rolUnidad, 'miembro');
  datos.pertenencias = [];
  await denegado(resolver(falsificado));
  datos.miembros = [];
  await denegadoEmpresa(resolver(falsificado));
});

test('no reconoce un rol global admin como administrador empresarial', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'admin';
  await denegadoEmpresa(resolver(entrada));
});

test('deniega duplicados empresariales antes de mirar unidades', async () => {
  const { datos, resolver } = entorno();
  datos.miembros.push({ ...datos.miembros[0], _id: N, rol: 'administrador' });
  await denegadoEmpresa(resolver(entrada));
  assert.equal(datos.consultas.some(c => c.tipo === 'unidad'), false);
});

test('deniega dos pertenencias locales aunque una este revocada', async () => {
  for (const estado of ['activa', 'revocada']) {
    const { datos, resolver } = entorno();
    datos.pertenencias.push({ ...datos.pertenencias[0],
      _id: '500000000000000000000002', rol: 'coordinador', estado });
    await denegado(resolver(entrada));
  }
});

test('deniega respuesta local inconsistente o referencias ajenas a la consulta', async () => {
  const { datos, resolver } = entorno();
  const valida = datos.pertenencias[0];
  for (const respuesta of [null, {}, [null], [{ ...valida, _id: null }],
    [{ ...valida, _id: [R] }], [{ ...valida, unidad: E }], [{ ...valida, membresia: N }]]) {
    datos.forzadas.pertenencia = respuesta;
    await denegado(resolver(entrada));
  }
});

test('recomprueba las referencias de la unidad recibida, no confia solo en el filtro', async () => {
  const { datos, resolver } = entorno();
  for (const respuesta of [{ _id: E, organizacion: A, estado: 'activa' },
    { _id: D, organizacion: B, estado: 'activa' }, { _id: D, organizacion: [A], estado: 'activa' }]) {
    datos.forzadas.unidad = respuesta;
    await denegado(resolver(entrada));
  }
});

test('relee rol y revocacion locales entre llamadas, sin confiar en contexto anterior', async () => {
  const { datos, resolver } = entorno();
  const anterior = await resolver(entrada);
  datos.pertenencias[0].rol = 'coordinador';
  assert.equal((await resolver(entrada)).rolUnidad, 'coordinador');
  datos.pertenencias[0].estado = 'revocada';
  await denegado(resolver({ ...entrada, contextoUnidad: anterior }));
});

test('relee degradacion de administrador y revocacion empresarial entre llamadas', async () => {
  const { datos, resolver } = entorno();
  datos.miembros[0].rol = 'administrador';
  assert.equal((await resolver(entrada)).origenAcceso, 'administracion_organizacion');
  datos.miembros[0].rol = 'colaborador';
  assert.equal((await resolver(entrada)).origenAcceso, 'membresia_unidad');
  datos.miembros[0].estado = 'revocada';
  await denegadoEmpresa(resolver(entrada));
});

test('relee archivo de unidad y suspension empresarial entre llamadas', async () => {
  const { datos, resolver } = entorno();
  await resolver(entrada);
  datos.unidades[0].estado = 'archivada';
  await denegado(resolver(entrada));
  datos.unidades[0].estado = 'activa';
  await resolver(entrada);
  datos.empresas[0].estado = 'suspendida';
  await denegadoEmpresa(resolver(entrada));
});

test('micropyme sin unidades conserva contexto empresarial y no crea ninguna general', async () => {
  const { datos, resolver, resolverOrganizacion } = entorno();
  datos.unidades = [];
  datos.pertenencias = [];
  const contexto = await resolverOrganizacion({ usuarioId: U, organizacionId: A });
  assert.equal(contexto.organizacionId, A);
  assert.equal(Object.hasOwn(contexto, 'unidadId'), false);
  await denegado(resolver(entrada));
  assert.deepEqual(datos.unidades, []);
});

for (const tipo of ['miembro', 'empresa', 'unidad', 'pertenencia']) {
  test('fallo de consulta ' + tipo + ' conserva un error generico sin permitir acceso', async () => {
    const { datos, resolver } = entorno();
    const causa = new Error('detalle interno sintetico');
    datos.fallos[tipo] = causa;
    await assert.rejects(resolver(entrada), error => {
      const esEmpresa = ['miembro', 'empresa'].includes(tipo);
      assert.ok(error instanceof (esEmpresa ? ErrorContextoOrganizacion : ErrorContextoUnidad));
      assert.equal(error.status, 503);
      assert.equal(error.codigo, esEmpresa ? 'CONTEXTO_NO_DISPONIBLE' : 'CONTEXTO_UNIDAD_NO_DISPONIBLE');
      assert.equal(error.message, 'Servicio no disponible temporalmente');
      assert.equal(error.cause, causa);
      return true;
    });
  });
}

test('respuestas denegadas no revelan si la unidad es ajena, ausente o no habilitada', async () => {
  const errores = [];
  for (const preparar of [
    d => { d.unidades = []; },
    d => { d.unidades[0].organizacion = B; },
    d => { d.unidades[0].estado = 'archivada'; },
    d => { d.pertenencias = []; },
    d => { d.pertenencias[0].estado = 'revocada'; }
  ]) {
    const { datos, resolver } = entorno();
    preparar(datos);
    await assert.rejects(resolver(entrada), error => {
      assert.ok(error instanceof ErrorContextoUnidad);
      errores.push([error.status, error.codigo, error.message]);
      return true;
    });
  }
  for (const error of errores) assert.deepEqual(error, errores[0]);
});

test('propaga errores de organizacion sin reemplazarlos por un contexto local', async () => {
  const causa = new Error('fallo inesperado sintetico');
  const resolver = crearServicioContextoUnidad({
    resolverOrganizacion: async () => { throw causa; },
    UnidadTrabajoModel: { findOne() { assert.fail('No debe consultar'); } },
    MembresiaUnidadModel: { find() { assert.fail('No debe consultar'); } }
  });
  await assert.rejects(resolver(entrada), error => error === causa);
});

for (const rol of ['colaborador', 'administrador']) {
  test('consultas Mongoose reales de ' + rol + ' con filtros casteados y sin ejecutar Mongo', async t => {
    const consultas = [];
    t.mock.method(mongoose.Query.prototype, 'exec', async function () {
      this.cast(this.model);
      const modelo = this.model.modelName;
      const filtro = this.getFilter();
      consultas.push(modelo);
      assert.equal(this.getOptions().readPreference.mode, 'primary');
      assert.equal(this.mongooseOptions().lean, true);
      const esperaFiltro = esperado => {
        assert.deepEqual(Object.keys(filtro).sort(), Object.keys(esperado).sort());
        for (const [campo, id] of Object.entries(esperado)) {
          assert.ok(filtro[campo] instanceof mongoose.Types.ObjectId);
          assert.equal(filtro[campo].toHexString(), id);
        }
      };
      if (modelo === 'Membresia') {
        esperaFiltro({ usuario: U, organizacion: A });
        assert.equal(this.getOptions().limit, 2);
        assert.deepEqual(this.projection(), { _id: 1, usuario: 1, organizacion: 1, rol: 1, estado: 1 });
        return [{ _id: M, usuario: U, organizacion: A, rol, estado: 'activa' }];
      }
      if (modelo === 'Organizacion') {
        esperaFiltro({ _id: A });
        assert.deepEqual(this.projection(), { _id: 1, estado: 1 });
        return { _id: A, estado: 'activa' };
      }
      if (modelo === 'UnidadTrabajo') {
        assert.equal(this.op, 'findOne');
        esperaFiltro({ _id: D, organizacion: A });
        assert.deepEqual(this.projection(), { _id: 1, organizacion: 1, estado: 1 });
        return { _id: D, organizacion: A, estado: 'activa' };
      }
      assert.equal(modelo, 'MembresiaUnidad');
      assert.equal(this.op, 'find');
      esperaFiltro({ unidad: D, membresia: M });
      assert.equal(this.getOptions().limit, 2);
      assert.deepEqual(this.projection(), { _id: 1, unidad: 1, membresia: 1, rol: 1, estado: 1 });
      return [{ _id: R, unidad: D, membresia: M, rol: 'miembro', estado: 'activa' }];
    });
    const resultado = await obtenerContextoUnidad(entrada);
    const esperado = ['Membresia', 'Organizacion', 'UnidadTrabajo'];
    if (rol === 'colaborador') esperado.push('MembresiaUnidad');
    assert.deepEqual(consultas, esperado);
    assert.equal(resultado.rolOrganizacion, rol);
    assert.equal(resultado.rolUnidad, rol === 'administrador' ? null : 'miembro');
    assert.equal(mongoose.connection.readyState, 0);
  });
}
