// Tests unitarios


export const scopes = [
  { id: 'scope-a', name: 'Plataforma SaaS (ensayo)', description: 'Servicio de ejemplo usado en pruebas.' },
  { id: 'scope-b', name: 'Consultoría de seguridad (ensayo)', description: 'Servicio profesional de ejemplo.' },
  { id: 'scope-c', name: 'Producto restringido (ensayo)', description: 'No debe mostrarse.', restricted: true },
];

export const requirements = [
  {
    id: 'req-1', title: 'Requisito legal de ejemplo', origin: 'legal',
    source: 'Norma de ejemplo, art. 1', reviewStatus: 'pending', reviewedAt: null,
    missing: ['Confirmar si el servicio entra en el ámbito', 'Identificar al responsable'],
  },
  {
    id: 'req-2', title: 'Cláusula contractual de ejemplo', origin: 'contractual',
    source: 'Anexo de seguridad del cliente (ensayo)', reviewStatus: 'reviewed',
    reviewedAt: '2026-10-02T09:00:00Z', missing: [],
  },
  {
    id: 'req-3', title: 'Estándar voluntario de ejemplo', origin: 'voluntary',
    source: 'Estándar de ejemplo', reviewStatus: 'in_review', reviewedAt: null, missing: [],
  },
];

export const tasks = [
  {
    id: 't1', title: 'Redactar política de ejemplo', status: 'pendiente',
    owner: 'Ana (ensayo)', dueDate: '2026-11-20', notes: '', updatedAt: '2026-10-01T10:00:00Z',
    context: 'Plataforma SaaS (ensayo)', reason: 'Falta una política escrita.',
    references: [{ label: 'Requisito legal de ejemplo', source: 'Norma de ejemplo, art. 1' }],
    documents: [{ id: 'd1', name: 'borrador-politica.pdf' }],
  },
  {
    id: 't2', title: 'Revisar contrato de proveedor', status: 'en_curso',
    owner: 'Luis (ensayo)', dueDate: '2026-11-05', notes: 'Pendiente de respuesta.',
    updatedAt: '2026-10-02T10:00:00Z',
  },
  {
    id: 't3', title: 'Inventariar activos', status: 'terminada',
    owner: 'Ana (ensayo)', dueDate: null, notes: '', updatedAt: '2026-10-03T10:00:00Z',
  },
  {
    id: 't4', title: 'Formar al equipo', status: 'pendiente',
    owner: null, dueDate: null, notes: '', updatedAt: '2026-10-04T10:00:00Z',
  },
  {
    id: 't5', title: 'Tarea archivada de ensayo', status: 'terminada',
    owner: 'Luis (ensayo)', dueDate: '2026-09-01', archivedAt: '2026-10-01T00:00:00Z',
  },
];
