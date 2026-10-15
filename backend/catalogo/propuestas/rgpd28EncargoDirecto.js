'use strict';

// Borrador de contenido, NO catálogo operativo ni endpoint. No importa Mongo,
// modelos, credenciales o proveedores. La revisión técnica no es revisión jurídica.
const { copiarJSON, validarRegla, objeto } = require('../../validation/aplicabilidadContextual');
const { evaluarAplicabilidadContextual } = require('../../services/aplicabilidadContextual');
const CONSULTA = '2026-10-09T09:35:00.000Z';
const eq = (hecho, valor = true) => ({ op: 'eq', hecho, valor });
const pregunta = (clave, texto, grupo, motivo) => ({
  clave, tipo: 'booleano', pregunta: { id: 'P_' + clave, texto, grupo, motivo }
});
const COBERTURA = Object.freeze({
  operacion_vinculada_establecimiento_es: true,
  actividad_comercial_ordinaria: true,
  cliente_actua_como_responsable: true,
  rol_determinado_por_ley: false
});
function fuente(id, editor, titulo, url, localizador) {
  return { id, version: 1, editor, titulo, url, localizador,
    consultadaEn: CONSULTA, estadoRevision: 'pendiente' };
}
function obtenerBorradorRGPD28() {
  return validarRegla({
    id: 'RGPD_ART28_ENCARGO_DIRECTO', version: 1, estado: 'borrador',
    naturaleza: 'ley_reglamento', origenes: ['legal'], tiposObjeto: ['operacion'],
    // La fecha civil del art. 99.2 es 25/05/2018. No inventamos aquí
    // un instante UTC universal ni un calendario jurídicamente aprobado.
    vigencia: { estado: 'pendiente' },
    fuentes: [
      fuente('RGPD_ORIGINAL', 'Unión Europea / BOE',
        'Reglamento (UE) 2016/679 - publicación original',
        'https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807',
        'Arts. 2, 3.1, 4.1/2/7/8, 26, 28.1/3/4/9/10 y 99.2'),
      fuente('RGPD_CORRECCION_2021', 'Unión Europea / BOE',
        'Corrección de errores del RGPD de 4 de marzo de 2021',
        'https://www.boe.es/buscar/doc.php?id=DOUE-L-2021-80264',
        'Apartados 12, 13 y 14: art. 28.1 y 28.3.b/e'),
      fuente('CEPD_ROLES_072020', 'Comité Europeo de Protección de Datos',
        'Directrices 07/2020 sobre responsable y encargado - versión final de 7/7/2021',
        'https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf',
        'Párrs. 39-41, 73-83 y 102-104; nota 42. Páginas 15-16, 25-27 y 32'),
      fuente('AEPD_RELACION_ENCARGO', 'Agencia Española de Protección de Datos',
        'Relación entre responsable y encargado del tratamiento',
        'https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0252-sobre-relacion-entre-responsable-y-encargado',
        'Relación responsable-encargado: contrato u otro acto jurídico vinculante')
    ],
    hechos: [
      pregunta('operacion_vinculada_establecimiento_es',
        '¿Esta operación se realiza en el contexto de la actividad de un establecimiento de tu empresa en España?',
        'Delimitar el caso', 'No se pregunta dónde está el servidor ni la nacionalidad del cliente. Una respuesta negativa sale de esta primera cobertura, no excluye el RGPD.'),
      pregunta('actividad_comercial_ordinaria',
        '¿Se trata de un servicio comercial ordinario, sin un régimen especial de tratamiento que deba analizarse?',
        'Delimitar el caso', 'Los ámbitos especiales del art. 2 requieren análisis separado. Si no está claro, conserva No lo sé; no presumas que la exclusión se aplica a un proveedor.'),
      pregunta('cliente_actua_como_responsable',
        '¿El cliente actúa en esta relación por sus propios fines de tratamiento, y no como intermediario que trata datos por cuenta de otra entidad?',
        'Delimitar el caso', 'Esta primera rama estudia el encargo directo. Subencargos, cadenas o un papel dudoso requieren otra rama; no quedan exentos.'),
      pregunta('rol_determinado_por_ley',
        '¿Hay una disposición legal que determine específicamente el papel de las partes en esta operación?',
        'Delimitar el caso', 'Una atribución normativa exige contrastar esa disposición; el contrato comercial no es por sí mismo esa atribución.'),
      pregunta('trata_datos_personales',
        '¿Tu empresa va a recoger, guardar, consultar o realizar otra operación sobre información de personas identificadas o identificables?',
        'Datos y tratamiento', 'Incluye contactos profesionales identificables y datos seudonimizados. No pidas nombres ni datos reales para contestar. Si la anonimización es dudosa, no respondas No por defecto.'),
      pregunta('tratamiento_automatizado_o_fichero',
        '¿El tratamiento es total o parcialmente automatizado, o los datos manuales forman o formarán parte de un fichero organizado?',
        'Datos y tratamiento', 'Permite examinar el art. 2.1; una actividad manual no queda excluida automáticamente.'),
      pregunta('entidades_distintas',
        '¿Tu empresa y quien encarga esta operación son entidades distintas?',
        'Relación entre las partes', 'Dos departamentos de la misma entidad no son dos partes de un encargo. Un grupo empresarial puede incluir entidades distintas.'),
      pregunta('cliente_decide_fines_medios_esenciales',
        '¿El cliente determina para qué se usan los datos y los elementos esenciales, como personas afectadas, datos, destinatarios y conservación?',
        'Decisiones e instrucciones', 'Elegir hardware, software o detalles de seguridad puede corresponder al proveedor sin cambiar por sí solo su papel. Las decisiones conjuntas requieren revisión.'),
      pregunta('tratamiento_por_cuenta_cliente',
        '¿Tu empresa realiza esta operación por cuenta del cliente, conforme al encargo y sus instrucciones sobre finalidad y medios esenciales?',
        'Decisiones e instrucciones', 'Valora la relación real o prevista. No conviertas la falta de contrato firmado o de instrucciones documentadas en ausencia automática de encargo.'),
      pregunta('fines_propios_misma_operacion',
        '¿Tu empresa decide utilizar los datos de esta misma operación para una finalidad propia o compartida con el cliente?',
        'Decisiones e instrucciones', 'El uso propio o conjunto requiere delimitar operaciones y revisar el papel. Cobrar por prestar el servicio no constituye por sí solo una finalidad propia de tratamiento.')
    ],
    condicion: { op: 'and', args: [
      ...Object.entries(COBERTURA).map(([clave, esperado]) => eq(clave, esperado)),
      eq('trata_datos_personales'), eq('tratamiento_automatizado_o_fichero'),
      eq('entidades_distintas'), eq('cliente_decide_fines_medios_esenciales'),
      eq('tratamiento_por_cuenta_cliente'), eq('fines_propios_misma_operacion', false)
    ] },
    // No hay un listado exhaustivo de excepciones legales modelado.
    // Los límites de producto se gestionan aparte, nunca como exenciones jurídicas.
    excepciones: []
  });
}

// Inspección pura de un BORRADOR. La ruta externa debe autorizar y cargar el contexto.
// No persiste decisiones ni puede activar evaluaciones o declarar no_aplica.
function inspeccionarBorradorRGPD28(entrada) {
  const datos = copiarJSON(entrada);
  objeto(datos, ['organizacionId', 'contexto', 'fechaEvaluacion']);
  const regla = obtenerBorradorRGPD28();
  const { decision, snapshot } = evaluarAplicabilidadContextual({ ...datos, regla });
  const hechos = new Map(snapshot.contexto.hechos.map(h => [h.clave, h]));
  const pendientes = [], fuera = [];
  for (const [clave, esperado] of Object.entries(COBERTURA)) {
    const h = hechos.get(clave);
    if (!h || h.estado !== 'conocido') pendientes.push(clave);
    else if (h.valor !== esperado) fuera.push(clave);
  }
  const cobertura = fuera.length ? 'fuera_de_cobertura'
    : pendientes.length ? 'pendiente_de_delimitar' : 'dentro_del_caso_inicial';
  const necesarias = fuera.length ? [] : pendientes.length ? pendientes : decision.traza.necesarios;
  const preguntas = necesarias.map(clave => ({
    clave, ...regla.hechos.find(h => h.clave === clave).pregunta
  }));
  return {
    propuesta: { id: regla.id, version: regla.version },
    estado: 'borrador_no_operativo', cobertura, fuera, pendientesCobertura: pendientes,
    requiereRevisionJuridica: true, habilitaEvaluacion: false,
    mensaje: fuera.length
      ? 'Este caso necesita otro análisis; estar fuera de esta cobertura no significa que el RGPD no sea aplicable.'
      : 'Borrador técnico pendiente de revisión jurídica y publicación. No determina cumplimiento ni publica obligaciones.',
    // La traza sirve para revisar la propuesta. Ni true ni false constituyen
    // aquí una conclusión jurídica. No se expone como decision.estado.
    contraste: { valor: decision.traza.valor, incidencias: decision.incidencias },
    preguntas, fuentes: decision.fuentes
  };
}
module.exports = { obtenerBorradorRGPD28, inspeccionarBorradorRGPD28 };
