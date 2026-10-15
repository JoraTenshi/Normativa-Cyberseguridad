'use strict';
// Proyección del ContextoEmpresa existente. Ninguna respuesta ausente se vuelve false.
const { fallo, texto } = require('./datosOrganizacion');
const { huella } = require('../validation/aplicabilidadContextual');
const { obtenerCatalogo } = require('../catalogo/orientacionC1');
const VERSION = 1, MAX_ACTIVIDADES = 8;
const generales = {
  pais_establecimiento: ['texto', '¿Dónde está establecida la empresa?'],
  mercados: ['lista', '¿En qué países presta servicios o vende productos?'],
  clientes: ['lista', '¿A qué tipos de clientes atiende?'],
  plantilla: ['numero', '¿Cuántas personas trabajan en la empresa?'],
  publico_directo: ['booleano', '¿Hay contratos directos con entidades públicas?'],
  cadena_publica: ['booleano', '¿Participa en servicios para un cliente público como subcontratista?'],
  exigencia_ens: ['booleano', '¿Algún contrato exige ENS, aunque el cliente sea privado?'],
  referencia_contrato_ens: ['texto', '¿Qué contrato o cláusula lo exige? Indica su referencia interna.'],
  voluntario_ens: ['booleano', '¿Quiere adoptar ENS de forma voluntaria?'],
  voluntario_iso: ['booleano', '¿Quiere adoptar ISO 27001 de forma voluntaria?']
};
const actividades = {
  nombre: ['texto', '¿Cómo identifica este servicio o producto?'],
  tipo: ['tipo', '¿Es un servicio o un producto?'],
  funciones: ['funciones', '¿Qué hace: desarrollar, mantener, distribuir, alojar u operar?'],
  datos_terceros: ['booleano', '¿Trata datos personales de terceros en esta actividad?'],
  sistemas_terceros: ['booleano', '¿Accede a sistemas de clientes?'],
  por_cuenta_cliente: ['booleano', '¿Trata datos por cuenta de un cliente que fija las finalidades?'],
  descargable: ['booleano', '¿Se entrega software descargable?'],
  marca_propia: ['booleano', '¿Lo comercializa bajo marca propia?'],
  usa_ia: ['booleano', '¿Utiliza o integra IA?'],
  desarrolla_ia: ['booleano', '¿Desarrolla IA o modifica sustancialmente un sistema?'],
  papel_ia: ['texto', '¿Qué papel tiene la empresa en la cadena de IA?'],
  finalidad_ia: ['texto', '¿Para qué se utiliza la IA y por quién?'],
  publico_directo: generales.publico_directo, cadena_publica: generales.cadena_publica,
  exigencia_ens: generales.exigencia_ens, referencia_contrato_ens: generales.referencia_contrato_ens,
  voluntario_ens: generales.voluntario_ens, voluntario_iso: generales.voluntario_iso,
  operaciones: ['ids', '¿Qué operaciones existentes concretan esta actividad?']
};
const slug = v => typeof v === 'string' && /^[a-z][a-z0-9]{0,15}$/.test(v);
const claveActividad = (a, k) => 'actividad_' + a + '_' + k;
function valido(v, tipo) {
  if (tipo === 'booleano') return typeof v === 'boolean';
  if (tipo === 'numero') return Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
  if (tipo === 'texto') return typeof v === 'string' && v.trim() === v && !!v && v.length <= 120;
  if (tipo === 'tipo') return ['servicio', 'producto'].includes(v);
  if (!Array.isArray(v) || v.length > 20 || new Set(v).size !== v.length) return false;
  return v.every(x => tipo === 'funciones' ? ['desarrollo', 'mantenimiento', 'distribucion', 'alojamiento', 'operacion'].includes(x) :
    tipo === 'ids' ? typeof x === 'string' && /^[a-f0-9]{24}$/.test(x) : typeof x === 'string' && x.trim() === x && !!x && x.length <= 100);
}
function proyectar(contexto, revision) {
  const mapa = new Map(contexto.hechos.map(h => [h.clave, h]));
  function leer(clave, tipo, ambito) {
    const h = mapa.get(clave) || { clave, estado: 'desconocido', motivo: 'no_aportado' };
    const valores = h.estado === 'conocido' ? [h.valor] : h.estado === 'conflictivo' ? h.alternativas.map(a => a.valor) : [];
    if (!valores.every(v => valido(v, tipo))) fallo('DATOS_INVALIDOS');
    return { ...h, ambito, origen: { contextoId: contexto.id, version: contexto.version,
      registradoEn: contexto.registradoEn, autorId: revision?.autorId || null,
      membresiaAutorId: revision?.membresiaAutorId || null, aportado: mapa.has(clave) } };
  }
  const ids = mapa.get('perfil_actividades');
  if (ids?.estado === 'conocido' && (!Array.isArray(ids.valor) || ids.valor.length > MAX_ACTIVIDADES ||
    !ids.valor.every(slug) || new Set(ids.valor).size !== ids.valor.length)) fallo('DATOS_INVALIDOS');
  const empresas = Object.entries(generales).map(([k, [t]]) => leer(k, t, 'organizacion'));
  const ofertas = (ids?.estado === 'conocido' ? ids.valor : []).map(a => ({ id: a,
    hechos: Object.entries(actividades).map(([k, [t]]) => ({ ...leer(claveActividad(a, k), t, 'actividad:' + a), campo: k })) }));
  const preguntas = [{ clave: 'perfil_actividades', grupo: 'empresa', tipo: 'lista_identificadores',
    texto: 'Enumera sus servicios y productos (máximo ocho en este bloque).',
    estado: ids?.estado || 'desconocido', respuesta: ids || null }];
  for (const h of empresas) {
    if (h.clave === 'referencia_contrato_ens' && !empresas.some(x => x.clave === 'exigencia_ens' && x.valor === true)) continue;
    preguntas.push({ clave: h.clave, grupo: 'empresa', tipo: generales[h.clave][0], texto: generales[h.clave][1], estado: h.estado, respuesta: h });
  }
  for (const a of ofertas) for (const h of a.hechos) {
    const positivo = k => a.hechos.some(x => x.campo === k && x.estado === 'conocido' && x.valor === true);
    if (['papel_ia', 'finalidad_ia'].includes(h.campo) && !positivo('usa_ia') && !positivo('desarrolla_ia')) continue;
    if (h.campo === 'por_cuenta_cliente' && !positivo('datos_terceros')) continue;
    if (h.campo === 'referencia_contrato_ens' && !positivo('exigencia_ens')) continue;
    preguntas.push({ clave: h.clave, grupo: a.id, tipo: actividades[h.campo][0], texto: actividades[h.campo][1], estado: h.estado, respuesta: h });
  }
  return { versionContrato: VERSION, empresa: empresas, actividades: ofertas, preguntas,
    aviso: 'Las respuestas son declaraciones, no hechos revisados favorablemente. Las fechas pertenecen a la revisión del contexto.' };
}
const conocido = (hs, k) => hs.find(h => (h.campo || h.clave) === k && h.estado === 'conocido')?.valor;
function analizar(perfil, operaciones = [], seleccion = perfil.actividades.map(a => a.id)) {
  const cat = obtenerCatalogo();
  const acts = perfil.actividades.filter(a => seleccion.includes(a.id));
  const hechos = [...perfil.empresa, ...acts.flatMap(a => a.hechos), ...operaciones.flatMap(o => o.contexto.hechos.map(h => ({
    ...h, ambito: 'operacion:' + o.id, origen: { contextoId: o.contexto.id, version: o.version,
      registradoEn: o.contexto.registradoEn, autorId: o.autorId, membresiaAutorId: o.membresiaAutorId, aportado: true }
  })))];
  const campo = h => h.campo || h.clave;
  for (const h of hechos) {
    const tipo = (generales[campo(h)] || actividades[campo(h)])?.[0];
    if (!tipo) continue;
    const valores = h.estado === 'conocido' ? [h.valor] : h.estado === 'conflictivo' ? h.alternativas.map(a => a.valor) : [];
    if (!valores.every(v => valido(v, tipo))) fallo('DATOS_INVALIDOS');
  }
  const seleccionar = ks => hechos.filter(h => ks.includes(campo(h)));
  const positivos = ks => seleccionar(ks).filter(h => h.estado === 'conocido' && h.valor === true);
  const contradicciones = [];
  // No se fusionan hechos. La operación conserva su propia versión y procedencia.
  for (const o of hechos.filter(h => h.ambito.startsWith('operacion:') && h.estado === 'conocido')) {
    const g = perfil.empresa.find(h => h.clave === o.clave && h.estado === 'conocido');
    if (g && huella(g.valor) !== huella(o.valor)) contradicciones.push({ campo: o.clave,
      general: { valor: g.valor, origen: g.origen }, especifico: { valor: o.valor, origen: o.origen },
      aviso: 'Concretar el alcance de ambas declaraciones; no sobrescribir la operación con el dato general.' });
  }
  const reglas = [
    ['ENS', ['publico_directo', 'cadena_publica', 'exigencia_ens', 'voluntario_ens'], 'ENS_org1_candidata'],
    ['RGPD', ['datos_terceros', 'por_cuenta_cliente'], 'RGPD_familia'],
    ['LOPDGDD', ['datos_terceros'], 'LOPDGDD_familia'],
    ['CRA', ['descargable', 'marca_propia'], 'CRA_familia'],
    ['IA', ['usa_ia', 'desarrolla_ia'], 'IA_familia'],
    ['ISO27001', ['voluntario_iso'], 'ISO27001_familia']
  ];
  const candidatos = reglas.map(([familia, claves, definicionId]) => {
    const relevantes = seleccionar(claves), pos = positivos(claves);
    const fundamentos = [];
    const agregar = (tipo, hs) => { if (hs.length) fundamentos.push({ tipo, hechos: hs.map(h => ({ clave: h.clave, ambito: h.ambito })),
      referenciaContrato: tipo === 'contractual' ? seleccionar(['referencia_contrato_ens']).filter(h => h.estado === 'conocido').map(h => ({ valor: h.valor, ambito: h.ambito })) : [],
      estado: 'por_confirmar' }); };
    agregar('legal', pos.filter(h => !['exigencia_ens', 'voluntario_ens', 'voluntario_iso'].includes(campo(h))));
    agregar('contractual', pos.filter(h => campo(h) === 'exigencia_ens'));
    agregar('adopcion_voluntaria', pos.filter(h => campo(h).startsWith('voluntario_')));
    const incertidumbres = relevantes.filter(h => h.estado !== 'conocido');
    return { id: 'candidato_' + familia, familia, definicionId, definicionVersion: 1,
      regla: { id: 'orientacion_' + familia, version: VERSION, tipo: 'seleccion_familia', claves,
        condicion: 'Señalar indicios declarados, dudas y cobertura pendiente; nunca excluir un marco completo.',
        excepciones: 'No evaluadas en esta fase', cobertura: 'Orientación inicial, no regla jurídica precisa' },
      estado: 'candidato', aplicabilidad: 'pendiente_de_determinar', satisfaccion: 'no_evaluada',
      cobertura: familia === 'ENS' ? 'borrador_parcial' : 'fuera_cobertura_evaluable',
      temporalidad: { estado: 'por_determinar', motivo: 'Revisar fechas civiles y disposiciones concretas antes de evaluar.' },
      revisionJuridica: 'pendiente', fundamentos,
      razon: pos.length ? 'Hay indicios declarados que requieren análisis específico.' : incertidumbres.length ?
        'Faltan datos o hay declaraciones contradictorias; no se descarta el marco.' :
        'Sin indicios en las preguntas delimitadas; esto no concluye no aplicabilidad.',
      hechos: relevantes, desconocidos: incertidumbres.map(h => ({ clave: h.clave, ambito: h.ambito, estado: h.estado })),
      siguientesPreguntas: perfil.preguntas.filter(p => relevantes.some(h => h.clave === p.clave && h.estado !== 'conocido')).map(p => ({ clave: p.clave, texto: p.texto })),
      localizadores: cat.definiciones.find(d => d.id === definicionId).referencias,
      alcanceTransversal: 'Revisar también obligaciones organizativas; no desaparecen por dividir servicios.' };
  });
  return { candidatos, contradicciones, catalogo: cat, decisionesJuridicas: [],
    aviso: 'No se calcula cumplimiento ni se publica una decisión jurídica. El motor preciso existente queda separado del selector de familias.' };
}
function proponer(contexto, revision, operaciones = []) {
  const perfil = proyectar(contexto, revision), analisis = analizar(perfil, operaciones);
  const referencias = operaciones.map(o => ({ id: o.id, version: o.version, sha256: o.sha256 })).sort((a,b) => a.id.localeCompare(b.id));
  const espacios = perfil.actividades.map(a => ({ actividadId: a.id,
    nombre: conocido(a.hechos, 'nombre') || 'Actividad ' + a.id,
    tipo: conocido(a.hechos, 'tipo') || null,
    descripcion: 'Espacio propuesto para ' + (conocido(a.hechos, 'nombre') || a.id),
    operaciones: conocido(a.hechos, 'operaciones') || [],
    origen: { contextoId: contexto.id, version: contexto.version, claves: a.hechos.filter(h => h.origen.aportado).map(h => h.clave) } }));
  const base = { versionContrato: VERSION, contextoId: contexto.id, contextoVersion: contexto.version,
    contextoSha256: huella(contexto.hechos), operaciones: referencias, catalogoSha256: analisis.catalogo.sha256 };
  return { ...base, propuestaHuella: huella(base), perfil, espacios,
    alcances: espacios.map(e => ({ clave: e.actividadId, nombre: e.nombre, actividadIds: [e.actividadId],
      sistemas: [], informacion: [], limites: '', exclusiones: [], dependencias: [], estado: 'preliminar' })),
    ...analisis, confirmacionNecesaria: true, esCertificacion: false };
}
function operacionesPerfil(perfil) {
  const ids = [...new Set(perfil.actividades.flatMap(a => conocido(a.hechos, 'operaciones') || []))].sort();
  if (ids.length > 20) fallo('DATOS_INVALIDOS');
  return ids;
}
module.exports = { VERSION, MAX_ACTIVIDADES, slug, generales, actividades, claveActividad, proyectar, analizar, proponer, operacionesPerfil };
