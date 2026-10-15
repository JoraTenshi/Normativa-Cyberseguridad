/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
export const AUDIENCES = ['consultoras de ciberseguridad', 'empresas de software', 'proveedores de SaaS', 'equipos de SOC y servicios gestionados', 'especialistas en pentesting', 'empresas de integración y soporte'];
export const FLOW_READING_MS = 8000;
export const CASE_READING_MS = 10000;
export const anchorBehavior = reduced => reduced ? 'instant' : 'smooth';
export const TYPE_START = { word: 0, count: 0, phase: 'typing' };
export function advanceType(state, words = AUDIENCES) {
  const word = words[state.word];
  if (state.phase === 'typing') return state.count < word.length ? { ...state, count: state.count + 1 } : { ...state, phase: 'holding' };
  if (state.phase === 'holding') return { ...state, phase: 'deleting' };
  if (state.count > 0) return { ...state, count: state.count - 1 };
  return { word: (state.word + 1) % words.length, count: 0, phase: 'typing' };
}
export const typeDelay = state => state.phase === 'holding' ? 2800 : state.phase === 'deleting' ? 32 : 72;
export const isDemoHash = hash => hash === '#/demo' || hash.startsWith('#/demo/') || ['#desk-main','#demo-ayuda','#demo-task'].includes(hash);
export const STORY = [
  { label: 'Tu punto de partida', title: 'Describe tu empresa y sus servicios.', text: 'Indica qué haces, para quién trabajas y qué datos y sistemas intervienen. Puedes combinar actividades y señalar lo que todavía no sabes.', points: ['Tus productos, servicios y formas de trabajar.', 'Los datos y sistemas a los que accede tu equipo.', 'Tu documentación disponible y las dudas por resolver.'] },
  { label: 'Lo que necesitas revisar', title: 'Organiza los requisitos que necesitas revisar.', text: 'Distingue su origen y señala qué información falta para valorar cada caso. Tu plataforma con datos personales, un servicio para la Administración y un acuerdo con un cliente plantean cuestiones diferentes.', points: ['Normativa, compromisos con clientes y marcos voluntarios.', 'La referencia concreta, explicada para tu actividad.', 'Una duda no es un incumplimiento.'] },
  { label: 'Trabajo compartido', title: 'Coordina documentos, tareas y responsables.', text: 'Prepara la revisión y conserva las decisiones y los cambios. Decide quién reúne la información, qué documento necesita tu equipo y cuándo se revisará.', points: ['Un responsable y una fecha para cada tarea.', 'Documentos y evidencias vinculados a su requisito.', 'Lo preparado, lo pendiente y lo que necesita revisión.'] },
];
