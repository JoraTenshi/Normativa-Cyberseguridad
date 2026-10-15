'use strict';
// Catálogo editorial de REFERENCIAS y borradores, no reglas jurídicas publicadas.
// No importa fixtures ni realiza peticiones de red. Solo texto propio y metadatos.
const { huella } = require('../validation/aplicabilidadContextual');
const usos = ['almacenamiento', 'reproduccion_literal', 'extractos', 'distribucion', 'exportacion', 'ia'];
const permisos = (url, boe = false) => ({
  estado: boe ? 'condicionado' : 'pendiente', referencia: url,
  usos: Object.fromEntries(usos.map(u => [u, boe && u !== 'ia'])),
  objeto: 'Texto original de la fuente; no afecta a los metadatos ni a nuestra explicación propia.',
  limites: boe ? 'Citar BOE y enlace; conservar actualización y condiciones; identificar elaboración propia, sin respaldo oficial. Consolidado informativo.' :
    'Sin autorización documentada no incorporar texto, tablas, traducciones, distribución, exportación ni usos de IA.'
});
const fuente = (id, titulo, editor, url, jurisdiccion, extra = {}) => ({
  id, version: 1, titulo, editor, url, tipo: 'ley_reglamento',
  edicion: 'Referencia pendiente de revisión integral', consultadaEl: '2026-10-12',
  fechas: { jurisdiccion, publicacion: null, entradaEnVigor: null, aplicaciones: [] },
  revisionEditorial: { estado: 'referencia_identificada', revisor: null, fecha: null, cobertura: 'Solo metadatos' },
  revisionJuridica: { estado: 'pendiente', revisor: null, fecha: null, cobertura: null },
  permisos: permisos(null), ...extra
});
const fuentes = [
  fuente('ENS', 'Real Decreto 311/2022', 'BOE', 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191', 'ES', {
    edicion: 'Consolidado: última actualización publicada 2024-11-06; informativo, sin valor oficial',
    fechas: { jurisdiccion: 'ES', publicacion: '2022-05-04', entradaEnVigor: '2022-05-05', aplicaciones: [] },
    permisos: permisos('https://www.boe.es/informacion/aviso_legal/index.php', true)
  }),
  fuente('RGPD', 'Reglamento (UE) 2016/679', 'Unión Europea', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj', 'UE'),
  fuente('LOPDGDD', 'Ley Orgánica 3/2018', 'BOE', 'https://www.boe.es/eli/es/lo/2018/12/05/3/con', 'ES', {
    permisos: permisos('https://www.boe.es/informacion/aviso_legal/index.php', true)
  }),
  fuente('CRA', 'Reglamento (UE) 2024/2847', 'Unión Europea', 'https://eur-lex.europa.eu/eli/reg/2024/2847/oj', 'UE'),
  fuente('IA', 'Reglamento (UE) 2024/1689', 'Unión Europea', 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', 'UE'),
  fuente('ISO27001', 'ISO/IEC 27001:2022; enmienda 1:2024 por revisar', 'ISO/IEC', 'https://www.iso.org/standard/27001', 'Internacional', {
    tipo: 'estandar', permisos: permisos('https://www.iso.org/copyright.html')
  }),
  ...['805', '808'].map(n => fuente('CCN' + n, 'CCN-STIC ' + n, 'CCN', 'https://www.ccn-cert.cni.es/es/', 'ES', {
    tipo: 'guia', edicion: 'Pendiente identificar y revisar edición y enlace documental exactos',
    permisos: permisos('https://www.ccn-cert.cni.es/es/aviso-legal.html')
  }))
];
const definiciones = [{
  id: 'ENS_org1_candidata', version: 1, estado: 'borrador', tipo: 'requisito_candidato',
  titulo: 'Política de seguridad: determinar alcance, contenido y aprobación',
  explicacionPropia: 'Revisar si corresponde una política para este sistema y cómo acreditar su contenido y aprobación. Un PDF no acredita por sí solo el requisito.',
  objeto: 'Sistema y organización dentro del ámbito justificado',
  referencias: [{ fuenteId: 'ENS', version: 1, localizadores: ['artículo 2.3', 'artículo 12', 'anexo II, sección 3.1, org.1'] }],
  criterios: [
    { id: 'contenido', origen: 'normativo_por_validar', referencia: 'ENS:artículo 12; anexo II 3.1', descripcionPropia: 'Contrastar contenido y alcance de la política con el precepto.' },
    { id: 'aprobacion', origen: 'normativo_por_validar', referencia: 'ENS:artículo 2.3', descripcionPropia: 'Identificar y acreditar la aprobación por el órgano competente para el caso.' }
  ],
  apoyos: [
    { fuenteId: 'CCN805', version: 1, relacion: 'orienta', fundamento: 'Referencia de apoyo pendiente de revisar edición, contenido y permiso.' },
    { fuenteId: 'CCN808', version: 1, relacion: 'ayuda_a_verificar', fundamento: 'Referencia de apoyo pendiente de revisión; no importa sus criterios.' }
  ],
  revisionEditorial: { estado: 'borrador', revisor: null, fecha: null },
  revisionJuridica: { estado: 'pendiente', revisor: null, fecha: null, cobertura: null }
}, ...['RGPD', 'LOPDGDD', 'CRA', 'IA', 'ISO27001'].map(f => ({
  id: f + '_familia', version: 1, estado: 'borrador', tipo: 'familia_candidata',
  titulo: f + ': análisis pendiente', explicacionPropia: 'Referencia identificada; NORM-C1 no evalúa íntegramente este marco.',
  objeto: 'Actividad y operaciones delimitadas',
  referencias: [{ fuenteId: f, version: 1, localizadores: f === 'RGPD' ? ['artículos 2, 3, 4 y 28 (borrador limitado de encargo directo separado)'] : ['Ámbito y disposiciones específicas pendientes de delimitar'] }],
  criterios: [], apoyos: [],
  revisionEditorial: { estado: 'borrador', revisor: null, fecha: null },
  revisionJuridica: { estado: 'pendiente', revisor: null, fecha: null, cobertura: null }
}))];
const catalogo = { id: 'orientacion_NORM_C1', version: 1, publicado: false, fuentes, definiciones,
  aviso: 'Propuestas y referencias, no obligaciones confirmadas ni evaluación de cumplimiento. Sin catálogo jurídico productivo.' };
// Copia defensiva: nadie puede publicar o alterar metadatos por mutación de un DTO.
function obtenerCatalogo() { return JSON.parse(JSON.stringify({ ...catalogo, sha256: huella(catalogo) })); }
function permiteUso(f, uso) {
  return usos.includes(uso) && ['autorizado', 'condicionado'].includes(f?.permisos?.estado) &&
    Boolean(f.permisos.referencia) && f.permisos.usos?.[uso] === true;
}
module.exports = { obtenerCatalogo, permiteUso };
