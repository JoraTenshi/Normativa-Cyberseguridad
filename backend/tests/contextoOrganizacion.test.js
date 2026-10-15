'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  crearServicioContextoOrganizacion,
  ErrorContextoOrganizacion
} = require('../services/contextoOrganizacion');

const U = '100000000000000000000001';
const V = '100000000000000000000002';
const A = '200000000000000000000001';
const B = '200000000000000000000002';
const M = '300000000000000000000001';
const entrada = { usuarioId: U, organizacionId: A };

function entorno() {
  const datos = {
    relaciones: [{ _id: M, usuario: U, organizacion: A, rol: 'colaborador', estado: 'activa' }],
    empresas: [{ _id: A, estado: 'activa' }, { _id: B, estado: 'activa' }],
    consultas: [], falloMembresia: null, falloEmpresa: null
  };
  function consulta(tipo, filtro, resultado) {
    const llamada = { tipo, filtro };
    datos.consultas.push(llamada);
    return {
      select(campos) { llamada.campos = campos; return this; },
      read(preferencia) { llamada.preferencia = preferencia; return this; },
      limit(limite) { llamada.limite = limite; return this; },
      async lean() {
        if (tipo === 'membresia' && datos.falloMembresia) throw datos.falloMembresia;
        if (tipo === 'empresa' && datos.falloEmpresa) throw datos.falloEmpresa;
        if (tipo === 'membresia' && Object.hasOwn(datos, 'respuestaForzada')) return datos.respuestaForzada;
        const valor = resultado();
        return Array.isArray(valor) ? valor.slice(0, llamada.limite).map(v => ({ ...v })) : valor && { ...valor };
      }
    };
  }
  const resolver = crearServicioContextoOrganizacion({
    MembresiaModel: {
      find(filtro) {
        return consulta('membresia', filtro, () => datos.relaciones.filter(m =>
          String(m.usuario) === filtro.usuario && String(m.organizacion) === filtro.organizacion));
      }
    },
    OrganizacionModel: {
      findById(id) { return consulta('empresa', id, () => datos.empresas.find(e => String(e._id) === id)); }
    }
  });
  return { datos, resolver };
}

async function rechaza(promesa, codigo, status) {
  await assert.rejects(promesa, error => {
    assert.ok(error instanceof ErrorContextoOrganizacion);
    assert.equal(error.codigo, codigo);
    assert.equal(error.status, status);
    return true;
  });
}
const denegado = promesa => rechaza(promesa, 'ACCESO_ORGANIZACION_DENEGADO', 403);

test('devuelve solo contexto minimo y congelado, sin una lista de permisos', async () => {
  const { datos, resolver } = entorno();
  datos.relaciones[0].funcion_profesional = 'Director';
  datos.empresas[0].razon_social = 'Empresa privada sintetica';
  const contexto = await resolver(entrada);
  assert.deepEqual(contexto, { usuarioId: U, organizacionId: A, membresiaId: M, rol: 'colaborador' });
  assert.equal(Object.isFrozen(contexto), true);
  assert.throws(() => { contexto.rol = 'administrador'; }, TypeError);
  assert.equal(mongoose.connection.readyState, 0);
});

test('consulta la pareja completa, campos minimos, primary y como maximo dos membresias', async () => {
  const { datos, resolver } = entorno();
  await resolver(entrada);
  assert.deepEqual(datos.consultas, [
    { tipo: 'membresia', filtro: { usuario: U, organizacion: A },
      campos: '_id usuario organizacion rol estado', preferencia: 'primary', limite: 2 },
    { tipo: 'empresa', filtro: A, campos: '_id estado', preferencia: 'primary' }
  ]);
});

test('normaliza IDs ObjectId y hexadecimales sin aceptar una identidad por defecto', async () => {
  const { datos, resolver } = entorno();
  const id = 'abcdef012345abcdef012345';
  datos.relaciones[0].usuario = id;
  for (const usuarioId of [id.toUpperCase(), new mongoose.Types.ObjectId(id)]) {
    const resultado = await resolver({ usuarioId, organizacionId: new mongoose.Types.ObjectId(A) });
    assert.equal(resultado.usuarioId, id);
    assert.equal(resultado.organizacionId, A);
  }
  await rechaza(resolver(), 'SESION_REQUERIDA', 401);
});

for (const campo of ['usuarioId', 'organizacionId']) {
  test('rechaza IDs incorrectos de ' + campo + ' antes de consultar', async () => {
    const { datos, resolver } = entorno();
    for (const valor of [undefined, null, '', 'abc', 'g'.repeat(24), 123, true, {}, [A], { $ne: null }]) {
      await rechaza(resolver({ ...entrada, [campo]: valor }),
        campo === 'usuarioId' ? 'SESION_REQUERIDA' : 'ORGANIZACION_INVALIDA',
        campo === 'usuarioId' ? 401 : 400);
    }
    assert.equal(datos.consultas.length, 0);
  });
}

test('otra empresa no obtiene acceso ni se consulta su ficha', async () => {
  const { datos, resolver } = entorno();
  await denegado(resolver({ usuarioId: U, organizacionId: B }));
  assert.equal(datos.consultas.length, 1);
  assert.equal(datos.consultas[0].tipo, 'membresia');
});

test('otro usuario no hereda la relacion del primero', async () => {
  const { resolver } = entorno();
  await denegado(resolver({ usuarioId: V, organizacionId: A }));
});

for (const estado of ['pendiente', 'suspendida', 'revocada', undefined, null, 'ACTIVA', 'inventado']) {
  test('deniega membresia con estado ' + String(estado), async () => {
    const { datos, resolver } = entorno();
    datos.relaciones[0].estado = estado;
    await denegado(resolver(entrada));
    assert.equal(datos.consultas.length, 1);
  });
}

for (const estado of ['en_preparacion', 'suspendida', 'cerrada', undefined, null, 'ACTIVA', 'inventado']) {
  test('deniega organizacion con estado ' + String(estado), async () => {
    const { datos, resolver } = entorno();
    datos.empresas[0].estado = estado;
    await denegado(resolver(entrada));
  });
}

test('deniega una organizacion inexistente aunque quede una membresia', async () => {
  const { datos, resolver } = entorno();
  datos.empresas = [];
  await denegado(resolver(entrada));
});

for (const rol of ['administrador', 'colaborador', 'consulta']) {
  test('reconoce el rol ' + rol + ' sin conferir permisos sobre recursos', async () => {
    const { datos, resolver } = entorno();
    datos.relaciones[0].rol = rol;
    assert.equal((await resolver(entrada)).rol, rol);
  });
}

test('deniega roles ausentes, desconocidos, globales y tipos incorrectos', async () => {
  const { datos, resolver } = entorno();
  for (const rol of [undefined, null, '', 'admin', 'usuario', 'coordinador', 'ADMINISTRADOR', {}, ['consulta']]) {
    datos.relaciones[0].rol = rol;
    await denegado(resolver(entrada));
  }
});

test('no permite elevar un rol por campos adicionales del llamador', async () => {
  const { datos, resolver } = entorno();
  datos.relaciones[0].rol = 'consulta';
  const contexto = await resolver({ ...entrada, rol: 'administrador', estado: 'activa', admin: true });
  assert.equal(contexto.rol, 'consulta');
  datos.relaciones = [];
  await denegado(resolver({ ...entrada, rol: 'admin', esAdmin: true }));
});

test('rechaza duplicados activos y mezcla de activa/revocada sin elegir al mas privilegiado', async () => {
  for (const estado of ['activa', 'revocada']) {
    const { datos, resolver } = entorno();
    datos.relaciones.push({ ...datos.relaciones[0], _id: '300000000000000000000002',
      rol: 'administrador', estado });
    await denegado(resolver(entrada));
    assert.equal(datos.consultas.length, 1);
  }
});

test('deniega resultados corruptos o referencias que no corresponden a la consulta', async () => {
  const { datos, resolver } = entorno();
  const correcta = { ...datos.relaciones[0] };
  for (const respuesta of [null, {}, [null], [{ ...correcta, usuario: V }],
    [{ ...correcta, organizacion: B }], [{ ...correcta, _id: null }]]) {
    datos.respuestaForzada = respuesta;
    await denegado(resolver(entrada));
  }
});

test('deniega si el repositorio devuelve otra organizacion', async () => {
  const { datos } = entorno();
  const resolver = crearServicioContextoOrganizacion({
    MembresiaModel: { find: () => ({
      select() { return this; }, read() { return this; }, limit() { return this; },
      lean: async () => datos.relaciones
    }) },
    OrganizacionModel: { findById: () => ({
      select() { return this; }, read() { return this; }, lean: async () => ({ _id: B, estado: 'activa' })
    }) }
  });
  await denegado(resolver(entrada));
});

test('relee estado y rol en llamadas sucesivas sin cache ni escalada por contexto anterior', async () => {
  const { datos, resolver } = entorno();
  assert.equal((await resolver(entrada)).rol, 'colaborador');
  datos.relaciones[0].rol = 'consulta';
  assert.equal((await resolver(entrada)).rol, 'consulta');
  datos.relaciones[0].estado = 'revocada';
  await denegado(resolver(entrada));
  assert.equal(datos.consultas.filter(c => c.tipo === 'membresia').length, 3);
});

test('relee el estado de la organizacion en llamadas sucesivas', async () => {
  const { datos, resolver } = entorno();
  await resolver(entrada);
  datos.empresas[0].estado = 'suspendida';
  await denegado(resolver(entrada));
});

test('usa el rol de cada empresa y no arrastra el de otra membresia', async () => {
  const { datos, resolver } = entorno();
  datos.relaciones.push({ _id: '300000000000000000000002', usuario: U,
    organizacion: B, rol: 'consulta', estado: 'activa' });
  assert.equal((await resolver(entrada)).rol, 'colaborador');
  assert.equal((await resolver({ usuarioId: U, organizacionId: B })).rol, 'consulta');
});

for (const campo of ['falloMembresia', 'falloEmpresa']) {
  test('fallo de consulta ' + campo + ' rechaza con error generico, sin datos internos', async () => {
    const { datos, resolver } = entorno();
    const causa = new Error('detalle interno sintetico que no debe devolverse');
    datos[campo] = causa;
    await assert.rejects(resolver(entrada), error => {
      assert.equal(error.status, 503);
      assert.equal(error.codigo, 'CONTEXTO_NO_DISPONIBLE');
      assert.equal(error.message, 'Servicio no disponible temporalmente');
      assert.equal(error.cause, causa);
      return true;
    });
  });
}

test('los rechazos por pertenencia o estado no exponen cual comprobacion fallo', async () => {
  const errores = [];
  for (const preparar of [
    datos => { datos.relaciones = []; },
    datos => { datos.relaciones[0].estado = 'revocada'; },
    datos => { datos.empresas = []; },
    datos => { datos.empresas[0].estado = 'cerrada'; }
  ]) {
    const { datos, resolver } = entorno();
    preparar(datos);
    try { await resolver(entrada); assert.fail('Debe rechazar'); }
    catch (error) { errores.push([error.status, error.codigo, error.message]); }
  }
  for (const error of errores) assert.deepEqual(error, errores[0]);
});

test('el servicio real construye consultas casteables con Mongoose, sin conexion ni ejecucion en Mongo', async t => {
  const consultas = [];
  t.mock.method(mongoose.Query.prototype, 'exec', async function () {
    // Se conserva la construccion y el casting reales; solo se sustituye la E/S.
    this.cast(this.model);
    const modelo = this.model.modelName;
    consultas.push(modelo);
    assert.equal(this.getOptions().readPreference.mode, 'primary');
    assert.equal(this.mongooseOptions().lean, true);
    if (modelo === 'Membresia') {
      const filtro = this.getFilter();
      assert.deepEqual(Object.keys(filtro).sort(), ['organizacion', 'usuario']);
      assert.ok(filtro.usuario instanceof mongoose.Types.ObjectId);
      assert.ok(filtro.organizacion instanceof mongoose.Types.ObjectId);
      assert.equal(filtro.usuario.toHexString(), U);
      assert.equal(filtro.organizacion.toHexString(), A);
      assert.equal(this.getOptions().limit, 2);
      assert.deepEqual(this.projection(), { _id: 1, usuario: 1, organizacion: 1, rol: 1, estado: 1 });
      return [{ _id: M, usuario: U, organizacion: A, rol: 'consulta', estado: 'activa' }];
    }
    assert.equal(modelo, 'Organizacion');
    assert.ok(this.getFilter()._id instanceof mongoose.Types.ObjectId);
    assert.equal(this.getFilter()._id.toHexString(), A);
    assert.deepEqual(this.projection(), { _id: 1, estado: 1 });
    return { _id: A, estado: 'activa' };
  });
  const { obtenerContextoOrganizacion } = require('../services/contextoOrganizacion');
  assert.equal((await obtenerContextoOrganizacion(entrada)).rol, 'consulta');
  assert.deepEqual(consultas, ['Membresia', 'Organizacion']);
  assert.equal(mongoose.connection.readyState, 0);
});
