/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
// B / iteration 02. Fictitious work records, real references, no applicability engine.
export const CASE_DATE = '2026-10-05';
export const WORKSPACE_KEY = 'normativacheck-home-demo-l01';
export const OWNERS = ['Sin asignar', 'Marta · Operaciones', 'Leo · Desarrollo', 'Inés · Producto'];
export const STATES = ['Pendiente', 'En curso', 'Bloqueada', 'Por revisar', 'Terminada'];
const GDPR = 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/spa';
export const REFERENCES = {
  encargo: { framework: 'RGPD', label: 'Art. 28.3', origin: 'Requisito legal', title: 'Condiciones del encargo de tratamiento', url: GDPR, version: 'Reglamento (UE) 2016/679', summary: 'El tratamiento por cuenta de un responsable debe regularse mediante contrato u otro acto jurídico vinculante, con el contenido previsto en este apartado.' },
  proveedores: { framework: 'RGPD', label: 'Arts. 28.2 y 28.4', origin: 'Requisito legal', title: 'Participación de otros encargados', url: GDPR, version: 'Reglamento (UE) 2016/679', summary: 'Recurrir a otro encargado requiere autorización escrita previa del responsable y trasladar las obligaciones de protección de datos mediante un instrumento vinculante.' },
  restauracion: { framework: 'RGPD', label: 'Art. 32.1.c–d', origin: 'Requisito legal', title: 'Restauración y evaluación de medidas', url: GDPR, version: 'Reglamento (UE) 2016/679', summary: 'Las medidas adecuadas al riesgo incluyen, cuando corresponda, recuperar disponibilidad y acceso a los datos y evaluar regularmente la eficacia de la seguridad.' },
  transferencias: { framework: 'RGPD', label: 'Art. 44', origin: 'Aplicabilidad por aclarar', title: 'Transferencias internacionales', url: GDPR, version: 'Reglamento (UE) 2016/679 · capítulo V', summary: 'Las transferencias a terceros países u organizaciones internacionales están sujetas a las condiciones del capítulo V. No basta conocer dónde se aloja el servidor.' },
  permisos: { framework: 'NIST CSF 2.0', label: 'PR.AA-05', origin: 'Marco voluntario adoptado', title: 'Permisos y mínimo privilegio', url: 'https://csrc.nist.gov/Projects/cybersecurity-framework/Filters', version: 'CSF 2.0 · 26/02/2024', summary: 'Los permisos y autorizaciones se definen, gestionan, aplican y revisan, incorporando mínimo privilegio y separación de funciones. Se usa aquí como objetivo voluntario, no como obligación legal ni certificación.' },
  sla: { framework: 'Acuerdo de servicio', label: 'Cláusula 4.2 · ficticia', origin: 'Compromiso contractual', title: 'Disponibilidad y comunicación de incidencias', url: null, version: 'Acuerdo ficticio de Trama · borrador 02', summary: 'En este escenario, la propuesta comercial prevé un compromiso de disponibilidad y un canal de incidencias. La cláusula es inventada para la demo: no procede de una norma y falta contrastar el acuerdo firmado.' },
  entrega: { framework: 'Contrato de desarrollo', label: 'Anexo II · ficticio', origin: 'Compromiso contractual', title: 'Aceptación y alcance del mantenimiento', url: null, version: 'Contrato ficticio · borrador 01', summary: 'El escenario incluye un anexo sobre aceptación de entregas y mantenimiento. Su contenido es ficticio y debe compararse con lo realmente acordado, sin presentarlo como una norma jurídica.' }
};

const SAAS = [
  { id: 'encargo', code: 'TR-01', title: 'Completar el anexo de tratamiento de Trama', area: 'Protección de datos', refs: ['encargo'], applicability: 'Incluido en el caso', reason: 'El escenario presupone que Trama trata contactos y tickets por cuenta de sus empresas usuarias. Linde actúa como encargado en ese servicio; no se ha comprobado una empresa real.', gap: 'El borrador no identifica todas las categorías de datos ni cómo se devuelve o elimina la información al finalizar el servicio.', steps: ['Precisar datos, personas afectadas y operaciones del SaaS.', 'Completar el anexo y contrastarlo con las condiciones del servicio.', 'Entregar la versión identificada para revisión antes de usarla con clientes.'], document: 'Anexo de encargo de Trama', expected: 'Versión del anexo con alcance, instrucciones y condiciones de finalización identificadas.', owner: 'Marta · Operaciones', status: 'En curso', date: '2026-10-08', evidence: ['anexo-trama-borrador.pdf'] },
  { id: 'proveedor', code: 'TR-02', title: 'Confirmar quién accede desde el soporte externo', area: 'Proveedores y accesos', refs: ['proveedores', 'transferencias'], applicability: 'Parte pendiente de confirmar', reason: 'Linde utiliza un proveedor ficticio de soporte. El caso no concreta quién recibe los datos ni desde qué países se accede; no se concluye todavía que exista una transferencia internacional.', gap: 'Faltan la relación de subencargados, sus ubicaciones y la autorización correspondiente. Hay que pedir esa información al proveedor.', steps: ['Solicitar entidades, ubicaciones y operaciones del soporte.', 'Contrastar el encargo y la autorización de subencargados.', 'Con esa información, revisar si entra en juego el capítulo V.'], document: 'Mapa de proveedores y accesos', expected: 'Relación de proveedores, funciones, países de acceso y referencia al acuerdo correspondiente.', owner: 'Inés · Producto', status: 'Bloqueada', date: '2026-10-06', evidence: [] },
  { id: 'restauracion', code: 'TR-03', title: 'Probar la restauración de una copia de Trama', area: 'Continuidad del servicio', refs: ['restauracion'], applicability: 'Incluido en el caso', reason: 'Trama contiene datos personales en el escenario. La empresa declara que realiza copias, pero eso no acredita que pueda recuperar el servicio. La prueba propuesta concreta trabajo técnico según el riesgo, no una frecuencia impuesta por el artículo.', gap: 'No hay un resultado de restauración documentado ni un responsable que haya revisado la prueba.', steps: ['Preparar un entorno aislado con datos de prueba.', 'Restaurar una copia y medir el resultado sin afectar producción.', 'Registrar incidencias, resultado y revisión pendiente.'], document: 'Acta de prueba de restauración', expected: 'Fecha, copia utilizada, entorno, resultado, tiempos e incidencias de la prueba.', owner: 'Leo · Desarrollo', status: 'Pendiente', date: '2026-10-09', evidence: [] },
  { id: 'permisos', code: 'TR-04', title: 'Revisar los permisos de administración de Trama', area: 'Gestión de accesos', refs: ['permisos'], applicability: 'Adopción voluntaria del caso', reason: 'Linde ha elegido en este escenario el objetivo PR.AA-05 para ordenar sus accesos. La lista exportada incluye cuentas de soporte y desarrollo; falta justificar cuáles deben seguir siendo administradoras.', gap: 'Leo ha preparado un inventario ficticio. Marta debe contrastar las autorizaciones; el documento sigue sin revisar.', steps: ['Identificar cuentas, permisos y responsables de aprobación.', 'Justificar privilegios necesarios y proponer retiradas.', 'Conservar el resultado de la revisión y las decisiones.'], document: 'Matriz de permisos de administración', expected: 'Cuentas, privilegios, motivo de acceso, aprobación y cambios propuestos.', owner: 'Leo · Desarrollo', status: 'Por revisar', date: '2026-10-05', evidence: ['matriz-accesos-trama.pdf'] },
  { id: 'contrato', code: 'TR-05', title: 'Contrastar el compromiso de disponibilidad', area: 'Compromisos con clientes', refs: ['sla'], applicability: 'Contrato por contrastar', reason: 'El borrador comercial del ejemplo menciona disponibilidad, pero operaciones no dispone de una copia del acuerdo firmado. No debe presentarse ese compromiso como confirmado.', gap: 'La fecha interna de revisión ya ha pasado. Falta conseguir la versión vigente y comprobar el canal de comunicación de incidencias.', steps: ['Localizar el acuerdo aceptado y sus anexos.', 'Identificar compromiso, exclusiones y procedimiento de comunicación.', 'Asignar la actuación necesaria sin inventar un nivel de servicio.'], document: 'Acuerdo vigente de servicio', expected: 'Versión identificada del acuerdo y compromisos concretos pendientes de atender.', owner: 'Marta · Operaciones', status: 'En curso', date: '2026-10-04', evidence: [] },
  { id: 'bajas', code: 'TR-06', title: 'Registrar la retirada de accesos temporales', area: 'Gestión de accesos', refs: ['permisos'], applicability: 'Adopción voluntaria del caso', reason: 'En el ejemplo se retiraron las cuentas temporales de una intervención de soporte. El trabajo se da por terminado, pero la evidencia aportada todavía no ha sido revisada.', gap: 'Una tarea cerrada no demuestra por sí sola que la retirada sea completa. Falta la revisión del registro.', steps: ['Relacionar los accesos concedidos durante la intervención.', 'Registrar su retirada y las excepciones justificadas.', 'Dejar la evidencia disponible para revisión.'], document: 'Registro de bajas de acceso', expected: 'Relación de cuentas, retirada realizada y excepciones pendientes.', owner: 'Leo · Desarrollo', status: 'Terminada', date: '2026-10-02', evidence: ['bajas-soporte-trama.pdf'] }
];

export function taskDefinitions(scope) {
  if (scope === 'saas') return structuredClone(SAAS);
  if (scope !== 'medida') throw new Error('Alcance desconocido');
  const edits = {
    encargo: { title: 'Delimitar el acceso a datos durante el mantenimiento', applicability: 'Pendiente de confirmar', reason: 'Linde desarrolla con datos sintéticos en el escenario. Falta saber si el mantenimiento exige tratar datos personales por cuenta del cliente; por eso el encargo del artículo 28.3 está pendiente, no se presupone.', gap: 'El alcance comercial no aclara si el equipo puede entrar en producción ni qué información vería.', steps: ['Pedir a operaciones qué incluye el mantenimiento.', 'Precisar accesos y datos que requiere ese trabajo.', 'Revisar si procede un encargo y documentar la conclusión.'], document: 'Anexo de alcance del mantenimiento', expected: 'Operaciones, sistemas, datos y responsabilidades identificados.', evidence: [] },
    proveedor: { title: 'Aclarar si intervienen terceros en el soporte', reason: 'El servicio de desarrollo no identifica subcontratistas con acceso. Hay que determinar si los hay antes de exigir autorizaciones o concluir que existen transferencias.', gap: 'Falta confirmar quién interviene y desde dónde. No hay una transferencia internacional establecida en el caso.', document: 'Relación de terceros del mantenimiento', expected: 'Intervinientes, funciones y accesos previstos; indicar expresamente lo que aún se desconoce.', steps: ['Identificar si intervienen terceros en el mantenimiento.', 'Precisar si acceden a datos personales y desde dónde.', 'Revisar las condiciones de encargo y transferencias únicamente cuando ese alcance se haya aclarado.'], applicability: 'Pendiente de confirmar' },
    restauracion: { title: 'Acordar quién recupera el entorno del cliente', reason: 'La infraestructura es del cliente en este ejemplo. No se puede asignar a Linde la restauración completa sin delimitar antes el servicio y el acceso a datos personales.', gap: 'El mantenimiento no aclara quién realiza las copias, quién restaura y cómo se coordina una prueba.', steps: ['Identificar las responsabilidades del cliente y de Linde.', 'Precisar el papel de Linde en una recuperación.', 'Proponer la prueba adecuada al servicio acordado.'], document: 'Reparto de responsabilidades de recuperación', expected: 'Reparto acordado de copias, restauración y coordinación entre el cliente y Linde; dudas aún abiertas.', applicability: 'Pendiente de confirmar' },
    permisos: { title: 'Revisar los permisos del equipo en repositorios', reason: 'Linde adopta voluntariamente PR.AA-05 para sus accesos de desarrollo. El inventario ficticio está preparado y permite revisar quién necesita mantener permisos de escritura.', gap: 'Falta contrastar los permisos de colaboradores que ya no trabajan en este servicio.', document: 'Matriz de accesos de desarrollo', expected: 'Repositorios, personas con acceso, permisos de lectura o escritura, justificación y bajas propuestas.', evidence: ['matriz-repositorios.pdf'] },
    contrato: { title: 'Concretar aceptación de entregas y mantenimiento', refs: ['entrega'], reason: 'La propuesta ficticia mezcla desarrollo y mantenimiento. Se necesita la versión aceptada para separar entregables, criterios de aceptación y soporte posterior.', gap: 'La fecha interna está vencida. Hay que localizar el anexo aceptado, sin dar el borrador por vinculante.', document: 'Contrato y anexo de mantenimiento', expected: 'Versión aceptada con entregables, criterios de aceptación, límites del mantenimiento y responsabilidades.', steps: ['Localizar la propuesta y los anexos aceptados.', 'Separar criterios de entrega, mantenimiento y exclusiones.', 'Asignar las aclaraciones pendientes y documentar la versión revisada.'] },
    bajas: { title: 'Documentar el cierre de accesos de una entrega', reason: 'En el escenario se ha cerrado una intervención de desarrollo. La retirada se ha declarado terminada y tiene un registro ficticio, todavía sin revisar.', document: 'Lista de cierre de accesos', expected: 'Cuentas y repositorios de la entrega, accesos retirados y excepciones justificadas.', evidence: ['cierre-accesos-entrega.pdf'] }
  };
  return SAAS.map(t => ({ ...structuredClone(t), ...edits[t.id], code: t.code.replace('TR-', 'DM-') }));
}

export function createWorkspace(legacy) {
  const data = { version: 2, profile: { legalName: 'Linde Studio · empresa ficticia', country: 'España', identifier: 'Sin aportar · ejemplo ficticio', size: '14 personas', activities: ['Software a medida', 'SaaS propio', 'Mantenimiento y soporte'], ...structuredClone(legacy?.profile || {}) }, scopes: {}, activity: [] };
  for (const scope of ['saas', 'medida']) {
    data.scopes[scope] = Object.fromEntries(taskDefinitions(scope).map(t => [t.id, { owner: t.owner, status: t.status, date: t.date, note: '', evidence: t.evidence.map(name => ({ name, review: 'Sin revisar', simulated: true })) }]));
    // Preserve earlier B edits without rewriting its original storage key.
    for (const [oldId, id] of Object.entries({ datos: 'proveedor', contrato: 'contrato', accesos: 'permisos' })) {
      const old = legacy?.scopes?.[scope]?.actions?.[oldId];
      if (!old) continue;
      const initialStatus = oldId === 'contrato' ? 'En curso' : 'Pendiente';
      const initialOwner = oldId === 'contrato' ? 'Marta · Operaciones' : 'Sin asignar';
      const dest = data.scopes[scope][id];
      if (old.status !== initialStatus && STATES.includes(old.status)) dest.status = old.status;
      if (old.owner !== initialOwner && OWNERS.includes(old.owner)) dest.owner = old.owner;
      if (old.date) dest.date = old.date;
      if (old.evidence?.length) dest.evidence = old.evidence.map(e => ({ name: e.name, review: 'Sin revisar', simulated: true }));
      const q = legacy.scopes[scope].questions?.[oldId];
      if (q?.note) dest.note = q.note;
    }
  }
  return data;
}
export function validWorkspace(data) {
  return !!(data?.version === 2 && data.profile && typeof data.profile.legalName === 'string' && Array.isArray(data.profile.activities) && Array.isArray(data.activity) && ['saas', 'medida'].every(scope => taskDefinitions(scope).every(t => {
    const a = data.scopes?.[scope]?.[t.id];
    return a && STATES.includes(a.status) && OWNERS.includes(a.owner) && typeof a.date === 'string' && typeof a.note === 'string' && ['archivedAt','completedAt','updatedAt'].every(key => a[key] == null || (typeof a[key] === 'string' && Number.isFinite(Date.parse(a[key])))) && (!a.archivedAt || a.status === 'Terminada') && Array.isArray(a.evidence) && a.evidence.every(e => typeof e.name === 'string' && e.review === 'Sin revisar' && e.simulated === true);
  })));
}
export function rowsFor(data, scope) { return taskDefinitions(scope).map(t => ({ ...t, ...data.scopes[scope][t.id] })); }
export function overdue(task) { return !!task.date && task.date < CASE_DATE && task.status !== 'Terminada'; }
export function countsFor(data, scope) {
  const rows = rowsFor(data, scope);
  return { total: rows.length, active: rows.filter(t => t.status === 'En curso').length, blocked: rows.filter(t => t.status === 'Bloqueada').length, review: rows.filter(t => t.status === 'Por revisar').length, overdue: rows.filter(overdue).length, done: rows.filter(t => t.status === 'Terminada').length, documents: rows.reduce((n,t) => n+t.evidence.length,0) };
}
export function filterTasks(rows, { query = '', filter = 'all', owner = 'Todos' } = {}) {
  const needle = query.toLocaleLowerCase('es');
  return rows.filter(t => (owner === 'Todos' || owner === t.owner) && (filter === 'all' || (filter === 'active' && t.status === 'En curso') || (filter === 'blocked' && t.status === 'Bloqueada') || (filter === 'review' && t.status === 'Por revisar') || (filter === 'overdue' && overdue(t)) || (filter === 'missing' && !t.evidence.length) || t.status === filter) && `${t.code} ${t.title} ${t.area} ${t.refs.map(id => REFERENCES[id].framework+' '+REFERENCES[id].label).join(' ')}`.toLocaleLowerCase('es').includes(needle));
}
export function changeTask(data, scope, id, patch, time = new Date().toISOString()) {
  if (!data.scopes[scope]?.[id]) throw new Error('Tarea fuera del alcance');
  const previous = data.scopes[scope][id];
  if (previous.archivedAt) throw new Error('Restaura la tarea antes de modificarla');
  if (Object.keys(patch).some(key => !['status', 'owner', 'date', 'note', 'evidence'].includes(key))) throw new Error('Campo de tarea no editable');
  const next = { ...previous, ...patch };
  if (!STATES.includes(next.status) || !OWNERS.includes(next.owner)) throw new Error('Estado o responsable no válido');
  if (Object.entries(patch).every(([key,value]) => previous[key] === value)) return data;
  next.updatedAt = time;
  if (next.status !== previous.status) next.completedAt = next.status === 'Terminada' ? time : null;
  const fields = Object.keys(patch).map(k => ({ status: 'estado', owner: 'responsable', date: 'fecha', note: 'nota', evidence: 'evidencia simulada' }[k] || k));
  const kind = next.status !== previous.status ? (next.status === 'Terminada' ? 'completed' : previous.status === 'Terminada' ? 'reopened' : 'updated') : 'updated';
  const changes = Object.keys(patch).filter(key => previous[key] !== next[key]).map(field => ({ field, before: structuredClone(previous[field]), after: structuredClone(next[field]) }));
  return { ...data, scopes: { ...data.scopes, [scope]: { ...data.scopes[scope], [id]: next } }, activity: [{ scope, id, time, kind, actor: 'Usuario local de la demo', owner: next.owner, text: `Actualizado: ${fields.join(', ')}`, changes }, ...data.activity] };
}
// Archive is a reversible visibility change, never deletion or compliance approval.
export function setTaskArchived(data, scope, id, archived, time = new Date().toISOString()) {
  const previous = data.scopes[scope]?.[id];
  if (!previous) throw new Error('Tarea fuera del alcance');
  if (archived && previous.status !== 'Terminada') throw new Error('Solo se pueden archivar tareas terminadas');
  if (!!previous.archivedAt === archived) return data;
  const next = { ...previous, archivedAt: archived ? time : null, updatedAt: time };
  const event = { scope, id, time, kind: archived ? 'archived' : 'restored', actor: 'Usuario local de la demo', owner: next.owner, text: archived ? 'Tarea archivada: sale del panel activo y conserva documentos, referencias y notas.' : 'Tarea restaurada al panel: sigue terminada; no se ha reabierto.', changes: [{ field: 'archivedAt', before: previous.archivedAt || null, after: next.archivedAt }] };
  return { ...data, scopes: { ...data.scopes, [scope]: { ...data.scopes[scope], [id]: next } }, activity: [event, ...data.activity] };
}
export function simulateEvidence(data, scope, id) {
  const def = taskDefinitions(scope).find(t => t.id === id);
  if (!def) throw new Error('Tarea fuera del alcance');
  return changeTask(data, scope, id, { evidence: [...data.scopes[scope][id].evidence, { name: `${def.document} · ejemplo.pdf`, review: 'Sin revisar', simulated: true }] });
}
