/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import { REFERENCES, rowsFor } from './workspace-model.js';
import { SCOPES } from './model.js';
import { CASE_HISTORY, SCOPE_BRIEFS } from './case-content.js';

export const TASK_ORDERS = {
  'due-asc': 'Fecha prevista · próximas primero',
  'due-desc': 'Fecha prevista · más lejanas primero',
  'updated-desc': 'Última modificación · recientes primero',
  'updated-asc': 'Última modificación · antiguas primero'
};
export const EVENT_TYPES = { all: 'Todos los cambios', updated: 'Ediciones', completed: 'Finalizaciones', reopened: 'Reaperturas', archived: 'Archivos', restored: 'Restauraciones' };
export const INITIAL_HISTORY_FILTERS = { query: '', owner: 'Todos', from: '', to: '', kind: 'all', order: 'desc' };
const normalized = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
const stamp = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
export function chronological(items, getDate, order = 'desc') {
  return items.map((item, index) => ({ item, index, time: stamp(getDate(item)) })).sort((a, b) => {
    if (a.time === b.time) return a.index - b.index;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return order === 'asc' ? a.time - b.time : b.time - a.time;
  }).map(entry => entry.item);
}
export function sortTasks(rows, order = 'due-asc') {
  const [field, direction] = order.split('-');
  return chronological(rows, task => field === 'updated' ? task.updatedAt : task.date, direction);
}
export function madridDay(value) {
  if (stamp(value) === null) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function historyTime(value) { return stamp(value) !== null ? new Date(value).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' }) : 'Fecha no registrada'; }
export function invalidPeriod(filters) { return !!(filters.from && filters.to && filters.from > filters.to); }
function inPeriod(value, filters) {
  const day = madridDay(value);
  return !invalidPeriod(filters) && ((!filters.from && !filters.to) || (day && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)));
}
function matchesTask(task, filters) {
  return (filters.owner === 'Todos' || !filters.owner || task.owner === filters.owner) && normalized([task.code, task.title, task.area, ...task.refs.map(id => REFERENCES[id].framework + ' ' + REFERENCES[id].label)].join(' ')).includes(normalized(filters.query).trim());
}
export function archivedTasks(rows, filters = INITIAL_HISTORY_FILTERS) {
  return chronological(rows.filter(task => task.archivedAt && matchesTask(task, filters) && inPeriod(task.archivedAt, filters)), task => task.archivedAt, filters.order);
}
export function historyEvents(data, scope, filters = INITIAL_HISTORY_FILTERS) {
  const rows = rowsFor(data, scope);
  return chronological(data.activity.filter(event => {
    const task = rows.find(row => row.id === event.id);
    // Owner filter deliberately uses CURRENT assignment; old records have no actor.
    return event.scope === scope && task && matchesTask(task, filters) && inPeriod(event.time, filters) && (!filters.kind || filters.kind === 'all' || (event.kind || 'updated') === filters.kind);
  }), event => event.time, filters.order);
}
const fieldNames = { status: 'Estado', owner: 'Responsable', date: 'Fecha prevista', note: 'Nota', evidence: 'Documentación', archivedAt: 'Archivo' };
function changeValue(value, field) {
  if (field === 'evidence' && Array.isArray(value)) return value.length ? value.map(e => `${e.name} (sin revisar)`).join('; ') : 'Sin documentación';
  if (field === 'archivedAt') return value ? historyTime(value) : 'Fuera del archivo';
  return value || 'Sin indicar';
}
export function describeChanges(event) {
  return Array.isArray(event.changes) ? event.changes.map(change => `${fieldNames[change.field] || change.field}: ${changeValue(change.before, change.field)} → ${changeValue(change.after, change.field)}`) : [];
}
export function historySelection(data, scope, filters, view, mode = 'all') {
  const rows = rowsFor(data, scope);
  if (mode === 'all') return { rows, events: historyEvents(data, scope), description: 'Todo el alcance: tareas en el panel y archivadas; todos los cambios locales conservados. Sin filtros.' };
  const events = historyEvents(data, scope, filters);
  const selectedRows = view === 'archive' ? archivedTasks(rows, filters) : rows.filter(task => matchesTask(task, filters) && ((!filters.from && !filters.to && filters.kind === 'all') || events.some(e => e.id === task.id)));
  const ids = new Set(selectedRows.map(task => task.id));
  return { rows: selectedRows, events: events.filter(event => ids.has(event.id)), description: `Selección filtrada de ${view === 'archive' ? 'tareas archivadas' : 'cronología'}. Búsqueda: ${filters.query || 'ninguna'}; responsable actual: ${filters.owner}; desde: ${filters.from || 'sin límite'}; hasta: ${filters.to || 'sin límite'}; tipo de cambio: ${view === 'archive' ? 'todos' : EVENT_TYPES[filters.kind]}. El periodo filtra ${view === 'archive' ? 'la fecha de archivo y las fechas de los cambios incluidos' : 'las fechas de los cambios'}, no la fecha prevista.` };
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// Static, self-contained, escaped report. No script, remote resources or model calls.
export function buildHistoryReport(data, scope, { filters = INITIAL_HISTORY_FILTERS, view = 'timeline', mode = 'all', generatedAt = new Date().toISOString() } = {}) {
  const selection = historySelection(data, scope, filters, view, mode), e = escapeHtml;
  const rows = selection.rows, events = chronological(selection.events, event => event.time, 'asc');
  const brief = SCOPE_BRIEFS[scope];
  const count = state => rows.filter(task => task.status === state).length;
  const list = items => `<ul>${items.map(text => `<li>${e(text)}</li>`).join('')}</ul>`;
  const taskHtml = rows.map(task => `<section class="task" id="task-${e(task.code)}"><h3>${e(task.code)} · ${e(task.title)}</h3>
    <p class="meta">${e(task.status)} · ${task.archivedAt ? 'Archivada' : 'En el panel de trabajo'} · ${e(task.owner)}</p>
    <dl><dt>Fecha prevista (objetivo interno)</dt><dd>${e(task.date || 'Sin fecha')}</dd><dt>Última finalización</dt><dd>${task.completedAt ? e(historyTime(task.completedAt)) : task.status === 'Terminada' ? 'Terminada antes de este registro; fecha exacta desconocida.' : 'No figura una finalización actual.'}</dd><dt>Archivo actual</dt><dd>${task.archivedAt ? e(historyTime(task.archivedAt)) : 'No archivada'}</dd></dl>
    <h4>Por qué existe esta tarea</h4><p>${e(task.reason)}</p><p><b>Situación de partida, no recalculada:</b> ${e(task.gap)}</p>
    <h4>Resultado esperado y actuaciones</h4><p>${e(task.expected)}</p>${list(task.steps)}
    <h4>Fundamento y límites</h4><p>${e(task.applicability)}. Selección ilustrativa pendiente de contraste.</p>${list(task.refs.map(id => { const ref = REFERENCES[id]; return `${ref.origin}: ${ref.framework} · ${ref.label}. ${ref.summary}`; }))}
    ${task.refs.filter(id => REFERENCES[id].url).map(id => `<p><a href="${e(REFERENCES[id].url)}" rel="noopener noreferrer">Fuente oficial: ${e(REFERENCES[id].framework + ' ' + REFERENCES[id].label)}</a></p>`).join('')}
    <h4>Documentación y nota actual</h4>${task.evidence.length ? list(task.evidence.map(doc => `${doc.name} · simulado · sin revisar`)) : '<p>No hay evidencia aportada a esta tarea.</p>'}<p class="note">${e(task.note || 'Sin nota de trabajo.')}</p>
    <p class="limit">Estado actual a la fecha de exportación. No permite reconstruir estados previos que no se registraron; terminar o archivar no valida evidencias ni cumplimiento.</p></section>`).join('');
  const eventHtml = events.map(event => {
    const task = rows.find(task => task.id === event.id);
    return `<li><time>${e(historyTime(event.time))}</time><div><h3>${e(task.code)} · ${e(task.title)}</h3><p>${e(event.text)}</p>${list(describeChanges(event))}<p class="meta">${e(event.actor || 'Actor no registrado · versión anterior de la demo')}${event.owner ? ' · Responsable al registrar: ' + e(event.owner) : ''}</p>${!event.changes ? '<p class="limit">El registro anterior no conserva valores antes/después.</p>' : ''}</div></li>`;
  }).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Histórico de tareas · ${e(SCOPES[scope].name)}</title><style>
    *{box-sizing:border-box}body{font:16px/1.65 system-ui,sans-serif;color:#29332f;background:#f7f6f1;margin:0}main{max-width:980px;margin:36px auto;padding:48px;background:white}h1{font-size:36px;line-height:1.15;max-width:700px}h2{font-size:24px;margin-top:42px;border-bottom:1px solid #dddcd4;padding-bottom:12px}h3{font-size:19px;line-height:1.4}h4{font-size:15px;margin:22px 0 6px}p{margin:10px 0}.label,.meta,.limit{font-size:13px;color:#59675f}.label{letter-spacing:.12em;text-transform:uppercase}a{color:#855030;text-underline-offset:3px}.notice{border-left:3px solid #ad8651;background:#faf5eb;padding:15px 20px}.summary{display:flex;gap:26px;flex-wrap:wrap;padding:20px 0}.summary b{font-size:27px;display:block}.summary span{font-size:13px}nav a{margin-right:20px}dl{display:grid;grid-template-columns:1fr 2fr;gap:6px 18px;font-size:14px}dt{color:#59675f}dd{margin:0}.task{padding:14px 0 30px;border-bottom:1px solid #dddcd4}li{margin:7px 0}.timeline{list-style:none;padding:0}.timeline>li{display:grid;grid-template-columns:155px 1fr;gap:24px;padding:22px 0;border-bottom:1px solid #dddcd4}.timeline h3{margin-top:0}.timeline time{font-size:13px;color:#59675f}.note{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:40px;font-size:12px;color:#59675f}@media(max-width:650px){main{padding:24px;margin:0}h1{font-size:28px}.timeline>li{display:block}dl{display:block}dd{margin-bottom:12px}}@media print{body{background:white;font-size:11pt}main{margin:0;padding:0;max-width:none}h1{font-size:28pt}h2,h3,h4{break-after:avoid}li,dl{break-inside:avoid}a{color:inherit}nav,.screen-only{display:none}@page{margin:18mm}}
    </style></head><body><main><header><p class="label">NormativaCheck / laboratorio B.06 / datos ficticios</p><h1>Historia del trabajo y situación de las tareas</h1><p>${e(data.profile.legalName)} · ${e(SCOPES[scope].name)} · ${e(SCOPES[scope].subtitle)}</p><p class="meta">Generado: ${e(historyTime(generatedAt))} · zona horaria Europe/Madrid</p><p class="screen-only">Documento descargado, sin conexión con el servidor. Para imprimirlo, utiliza la opción Imprimir de tu navegador.</p></header>
    <nav aria-label="Índice del informe"><a href="#resumen">1. Resumen</a><a href="#tareas">2. Situación por tarea</a><a href="#cronologia">3. Cronología</a><a href="#limites">4. Cobertura y límites</a></nav>
    <section id="resumen"><h2>1. Resumen del trabajo registrado</h2><p>${e(selection.description)}</p><div class="summary"><span><b>${rows.length}</b>Tareas incluidas</span><span><b>${count('Terminada')}</b>Terminadas</span><span><b>${rows.filter(task => task.archivedAt).length}</b>Archivadas</span><span><b>${count('Bloqueada')}</b>Bloqueadas</span><span><b>${events.length}</b>Cambios conservados</span></div><p>Las archivadas son un subconjunto de las terminadas; las cifras no se suman. Las fechas previstas son objetivos internos, no plazos legales calculados.</p><p>${e(brief.introduction)}</p><p><b>Orientación de partida del caso:</b> ${e(brief.decision)}</p><h3>Cuestiones que siguen requiriendo contraste</h3>${list(brief.pending)}<p class="notice">Resumen operativo, no informe de conformidad. El diagnóstico es editorial y no se recalcula. Todas las evidencias siguen sin revisar. No se concluye que la empresa cumpla ni incumpla una obligación.</p></section>
    <section id="tareas"><h2>2. Situación actual de cada tarea incluida</h2>${taskHtml || '<p>No hay tareas que coincidan con esta selección.</p>'}</section>
    <section id="cronologia"><h2>3. Cronología de los cambios conservados</h2><p>Orden narrativo: del más antiguo al más reciente. La pantalla usa por defecto el orden inverso para facilitar la consulta diaria. Las horas proceden del reloj del navegador.</p>${events.length ? `<ol class="timeline">${eventHtml}</ol>` : '<p>No hay cambios conservados que coincidan con la selección. La ausencia de eventos no significa que la tarea nunca se haya trabajado.</p>'}
    <h3>Antecedentes editoriales del caso · no son eventos de auditoría</h3><p>Contexto fijo del alcance, fuera del filtro de eventos. No describe acciones efectuadas en esta sesión.</p>${list(CASE_HISTORY.map(entry => `${entry.date} · ${entry.actor}: ${entry.text}`))}</section>
    <section id="limites"><h2>4. Cobertura y límites</h2><p>Solo incluye ${e(SCOPES[scope].name)}, no toda la empresa. El historial local anterior a B.06 conservaba como máximo 50 cambios en total; las entradas perdidas no pueden recuperarse. Desde B.06 no se recorta el registro, pero depende del almacenamiento de este navegador y puede perderse si se reinicia el caso o se limpia ese almacenamiento.</p><p>No se inventan fechas de creación, cierre ni valores anteriores desconocidos. El informe contiene la situación actual y los cambios disponibles, no una reconstrucción íntegra. Los responsables son asignaciones ficticias; «Usuario local de la demo» no identifica a una persona autenticada.</p><p>No hay firma, revisión jurídica, persistencia de servidor ni historial inmutable. El informe panorámico de cumplimiento de toda la organización queda como propuesta futura, separada de esta descarga operativa.</p></section><footer>NormativaCheck · B.06 · muestra de UX local. No contiene documentos de una empresa real ni resultados de una IA.</footer></main></body></html>`;
  return { html, filename: `normativacheck-historico-${scope}-${madridDay(generatedAt)}.html`, selection };
}
