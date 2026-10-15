/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
// Shared case vocabulary and legacy B migration helpers. No variant router.
export const PEOPLE = ['Sin asignar', 'Marta · Operaciones', 'Leo · Desarrollo', 'Inés · Producto'];
export const ACTIVITIES = ['Software a medida', 'SaaS propio', 'Consultoría de ciberseguridad', 'Pentesting', 'SOC / servicios gestionados', 'Integración', 'Mantenimiento y soporte'];
export const SCOPES = {
  saas: { name: 'Trama', subtitle: 'SaaS propio', code: 'S-02', roles: 'Desarrolla, aloja y opera', clients: 'Pymes de servicios', markets: 'España y Unión Europea', description: 'Plataforma de atención a clientes. Linde mantiene la aplicación, administra su infraestructura y presta soporte.', unknown: '¿Desde qué países puede acceder el proveedor de soporte?', next: 'Aclarar el acceso del proveedor de soporte', nextDetail: 'Sin saber quién accede y desde dónde, el análisis sigue abierto.', doc: 'Mapa de proveedores y accesos', docNote: 'Borrador de operaciones. No incluye los países de acceso del soporte.', declared: 'Marta declara que el alojamiento principal está en la UE.' },
  medida: { name: 'Desarrollo a medida', subtitle: 'Servicio', code: 'S-01', roles: 'Desarrolla y mantiene', clients: 'Empresas medianas de distribución', markets: 'España', description: 'Desarrollo e integración de aplicaciones en la infraestructura del cliente. El mantenimiento puede requerir acceso temporal a producción.', unknown: '¿El equipo accede a datos reales durante el mantenimiento?', next: 'Delimitar el acceso a producción', nextDetail: 'El alcance del soporte no está descrito en el contrato de ejemplo.', doc: 'Anexo de alcance del mantenimiento', docNote: 'Aún no existe una versión aportada para este servicio.', declared: 'Leo declara que se usan datos sintéticos durante el desarrollo.' }
};
export function requirements(scope) {
  const saas = scope === 'saas';
  return [
    { id: 'datos', title: saas ? 'Delimitar el tratamiento de datos y el acceso de terceros' : 'Aclarar el acceso a datos en el mantenimiento', type: 'Obligación legal', decision: 'Aplicabilidad pendiente', why: saas ? 'El producto aloja información de clientes y permite intervención de un proveedor. Hay que aclarar datos, funciones y ubicaciones antes de concluir.' : 'El servicio podría incluir acceso a producción del cliente. Desarrollar software no permite deducir por sí solo qué obligaciones corresponden.', need: SCOPES[scope].unknown, document: SCOPES[scope].doc, action: SCOPES[scope].next, outcome: 'Un alcance documentado para revisar la aplicabilidad. No una conclusión jurídica automática.' },
    { id: 'contrato', title: saas ? 'Revisar los compromisos de disponibilidad del servicio' : 'Revisar los compromisos de entrega y mantenimiento', type: 'Exigencia contractual', decision: 'Contrato por revisar', why: saas ? 'El acuerdo ficticio con un cliente menciona continuidad y comunicación de incidencias. Falta revisar la versión firmada.' : 'La propuesta comercial ficticia incluye entregas, soporte y gestión de incidencias. No se ha aportado el acuerdo firmado.', need: '¿Qué versión del acuerdo está firmada y qué compromisos incluye?', document: saas ? 'Acuerdo de servicio y soporte' : 'Contrato y criterios de aceptación', action: 'Reunir el acuerdo vigente y sus anexos', outcome: 'Compromisos identificados y asignados para revisión.' },
    { id: 'accesos', title: saas ? 'Documentar una revisión de accesos administrativos' : 'Documentar la retirada de accesos al cerrar un proyecto', type: 'Estándar voluntario', decision: 'Práctica candidata', why: saas ? 'Linde desea ordenar su seguridad operativa. Esta práctica se explora como mejora voluntaria, sin afirmar adopción ni certificación de un estándar.' : 'El equipo quiere cerrar proyectos con un registro de accesos revocados. Se explora como mejora voluntaria, sin convertirla en obligación legal.', need: '¿Hay un procedimiento acordado y una revisión registrada?', document: saas ? 'Registro de revisión de accesos' : 'Lista de cierre de proyecto', action: saas ? 'Preparar una revisión de accesos de administración' : 'Preparar una lista de cierre de accesos', outcome: 'Procedimiento y registro disponibles para una revisión posterior.' }
  ];
}
export function createState() {
  return {
    profile: { activities: ['Software a medida', 'SaaS propio', 'Mantenimiento y soporte'], size: '14 personas', client: 'Pymes y empresas medianas', market: 'España y Unión Europea' },
    scopes: Object.fromEntries(Object.keys(SCOPES).map(scope => [scope, {
      operations: scope === 'saas' ? ['Desarrolla', 'Aloja', 'Opera', 'Mantiene'] : ['Desarrolla', 'Mantiene'],
      access: 'No lo sé todavía', clients: SCOPES[scope].clients, markets: SCOPES[scope].markets,
      questions: Object.fromEntries(requirements(scope).map(r => [r.id, { answer: 'No lo sé todavía', note: '' }])),
      actions: Object.fromEntries(requirements(scope).map((r, i) => [r.id, { status: i === 1 ? 'En curso' : 'Pendiente', owner: i === 1 ? 'Marta · Operaciones' : 'Sin asignar', date: '', evidence: [] }]))
    }])),
    history: []
  };
}
export function updateAction(state, scope, id, patch) {
  if (!SCOPES[scope] || !state.scopes[scope].actions[id]) throw new Error('Acción fuera del alcance');
  const action = { ...state.scopes[scope].actions[id], ...patch };
  return { ...state, scopes: { ...state.scopes, [scope]: { ...state.scopes[scope], actions: { ...state.scopes[scope].actions, [id]: action } } }, history: [{ scope, text: `Acción actualizada: ${requirements(scope).find(r => r.id === id).action}` }, ...state.history].slice(0, 12) };
}
export function addEvidence(state, scope, id, name) {
  const item = { name, origin: 'Documento simulado', review: 'Sin revisar' };
  return updateAction(state, scope, id, { evidence: [...state.scopes[scope].actions[id].evidence, item] });
}
export function summary(state, scope) {
  const actions = Object.values(state.scopes[scope].actions);
  return { total: actions.length, done: actions.filter(a => a.status === 'Terminada').length, unassigned: actions.filter(a => a.owner === 'Sin asignar').length, evidence: actions.reduce((n, a) => n + a.evidence.length, 0), reviewed: 0 };
}
export function validState(value) {
  return value && Array.isArray(value.history) && Array.isArray(value.profile?.activities) && value.profile.activities.length > 0 && value.profile.activities.every(x => ACTIVITIES.includes(x)) && Object.keys(SCOPES).every(s => Array.isArray(value.scopes?.[s]?.operations) && typeof value.scopes[s].access === 'string' && typeof value.scopes[s].clients === 'string' && typeof value.scopes[s].markets === 'string' && requirements(s).every(r => {
    const a = value.scopes?.[s]?.actions?.[r.id];
    const q = value.scopes?.[s]?.questions?.[r.id];
    return q && typeof q.answer === 'string' && typeof q.note === 'string' && a && ['Pendiente', 'En curso', 'Terminada'].includes(a.status) && PEOPLE.includes(a.owner) && typeof a.date === 'string' && Array.isArray(a.evidence) && a.evidence.every(e => typeof e.name === 'string' && e.review === 'Sin revisar');
  }));
}
