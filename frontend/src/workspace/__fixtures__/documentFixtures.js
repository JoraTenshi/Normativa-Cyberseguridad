// DATOS DE ENSAYO. Solo para tests o una demo de desarrollo.

export const documents = [
  {
    id: 'doc-1', kind: 'guide', name: 'Política de seguridad de la información',
    purpose: 'Recoge las reglas generales de seguridad de la organización.',
    relatedTo: { type: 'requirement', label: 'Requisito legal de ejemplo' },
    provider: 'Responsable de seguridad (ensayo)',
  },
  {
    id: 'doc-2', kind: 'file', name: 'inventario-activos.xlsx',
    purpose: 'Lista de activos del alcance.',
    relatedTo: { type: 'task', label: 'Inventariar activos' },
    provider: 'Ana (ensayo)', uploadedAt: '2026-10-03T10:00:00Z',
    reviewStatus: 'reviewed', reviewedAt: '2026-10-05T09:00:00Z',
  },
  {
    id: 'doc-3', kind: 'file', name: 'contrato-proveedor.pdf',
    provider: 'Luis (ensayo)', uploadedAt: null, reviewStatus: 'pending',
  },
];

// Documentos de OTRO alcance, para probar que no quedan restos del anterior.
export const otherScopeDocuments = [
  {
    id: 'doc-9', kind: 'file', name: 'plan-continuidad-otro-alcance.pdf',
    provider: 'Marta (ensayo)', uploadedAt: '2026-09-20T10:00:00Z', reviewStatus: 'in_review',
  },
];
