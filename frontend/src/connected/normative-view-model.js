// View helpers only: no legal evaluation, permission inference or transport.
export function civilDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Fecha no informada';
  const [y, m, d] = value.split('-').map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!y || m < 1 || m > 12 || d < 1 || d > days[m - 1]) return 'Fecha no válida';
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}
export function sourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function recordedAt(value) {
  if (!value) return 'Fecha no informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no válida';
  return new Intl.DateTimeFormat('es-ES', {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Madrid'}).format(date)+' · Europe/Madrid';
}
export function decisionMatches(ficha, record) {
  return !!ficha && !!record?.decision && record.reglaId === ficha.reglaId &&
    record.versionRegla === ficha.versionRegla && record.decision.regla?.id === ficha.reglaId &&
    record.decision.regla?.version === ficha.versionRegla;
}
function sameRef(a, b) {
  return !!a?.id && Number.isInteger(a.version) && a.version > 0 && /^[a-f0-9]{64}$/.test(a.sha256 || '') &&
    a.id === b?.id && a.version === b.version && a.sha256 === b.sha256;
}
export function reviewMatches(ficha, record, revision, requisito) {
  return decisionMatches(ficha, record) && !!record.id && !!revision && revision.tipo === 'interna' &&
    !!requisito && requisito.decisionId === record.id &&
    sameRef(revision.requisito, requisito) && sameRef(revision.ficha, requisito.ficha) &&
    requisito.organizacionId === record.decision.organizacionId && revision.organizacionId === requisito.organizacionId &&
    revision.ficha?.id === ficha.id && revision.ficha?.version === ficha.version &&
    revision.decisionId === record.id;
}
export function recordDimensions({ ficha, decisionRecord:record, canReview = null, requisito = null, revision = null, revisionStatus = null }) {
  const matched = decisionMatches(ficha, record), d = matched ? record.decision : null;
  const statuses = {
    coverage:{ dentro_de_cobertura:'Caso dentro de cobertura', fuera_de_cobertura:'Fuera de cobertura', pendiente_de_delimitar:'Cobertura por delimitar' },
    temporal:{ en_periodo:'Dentro del periodo definido', futura:'Periodo futuro', finalizada:'Periodo finalizado', por_determinar:'Calendario por determinar' },
    applicability:{ aplica:'Aplica según esta decisión', no_aplica:'No aplica por esta vía', pendiente_de_determinar:'Aplicabilidad por determinar', candidato:'Candidato a revisión' }
  };
  const historical = reviewMatches(ficha, record, revision, requisito);
  const evaluable = d?.habilitaEvaluacion === true && d.estado === 'aplica' && d.temporal === 'en_periodo' && d.cobertura?.estado === 'dentro_de_cobertura';
  const needsReview = historical && (!evaluable || revisionStatus?.requiereRevision === true || record.revision?.requiereNuevaDecision === true);
  const satisfaction = historical && !needsReview ? ({ favorable:'Revisión interna favorable', desfavorable:'Revisión interna desfavorable', no_determinado:'Satisfacción no determinada', requiere_revision:'Requiere nueva revisión' })[revisionStatus?.satisfaccionActual] : null;
  return [
    { id:'coverage', label:'Cobertura del análisis', value:statuses.coverage[d?.cobertura?.estado] || 'Cobertura no informada', tone:d?.cobertura?.estado === 'fuera_de_cobertura' ? 'warning' : 'neutral', explanation:d?.cobertura?.descripcion || 'El análisis disponible no cubre necesariamente todos los supuestos. Estar fuera de cobertura no es una exención.' },
    { id:'temporal', label:'Temporalidad jurídica', value:statuses.temporal[d?.temporal] || 'Temporalidad no informada', tone:'neutral', explanation:'El periodo jurídico y el límite histórico de cobertura de la ficha son datos distintos.' },
    { id:'applicability', label:'Aplicabilidad al contexto', value:statuses.applicability[d?.estado] || 'Sin decisión compatible consultada', tone:'neutral', explanation:matched ? 'Resultado de esta regla y versión del contexto, no una conclusión sobre todas las normas.' : 'No se reutiliza una decisión de otra regla o versión como resultado de esta ficha.' },
    { id:'permission', label:'Permiso para revisar', value:canReview === true ? 'Autorización confirmada' : canReview === false ? 'Acción no autorizada' : 'Permiso no consultado', tone:'neutral', explanation:'Debe resolverlo el servidor para esta acción. Poder evaluar el caso no concede permisos ni convierte al usuario en certificador.' },
    { id:'satisfaction', label:'Satisfacción del requisito', value:needsReview ? 'Requiere nueva revisión' : satisfaction || 'Valoración actual no consultada', tone:needsReview ? 'warning' : 'neutral', explanation:'Solo una revisión motivada y vinculada puede sustentar esta valoración; no se calcula a partir de documentos o tareas.' }
  ];
}

