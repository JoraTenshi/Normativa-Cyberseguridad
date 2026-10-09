export function toEvaluations(data) {
  if (!Array.isArray(data)) throw new Error('Historial incompatible');
  const ids = new Set();
  return data.map(item => {
    if (!item || !/^[a-f0-9]{24}$/i.test(item.id) || ids.has(item.id)) {
      throw new Error('Identificador de evaluación inválido');
    }
    ids.add(item.id);
    const version = item.algoritmo_version ?? '1';
    const known = ['1', '2'].includes(version);
    const value = item.porcentaje;
    const valid = Number.isFinite(value) && value >= 0 && value <= 100;
    const withoutBase = item.sin_base_evaluable === true;
    const date = typeof item.createdAt === 'string'
      ? Date.parse(item.createdAt) : NaN;
    return {
      id: item.id,
      name: String(item.normativa_nombre || item.normativa || 'Sin nombre'),
      version,
      date: Number.isFinite(date) ? date : null,
      score: known && valid && !withoutBase ? value : null,
      label: !known ? 'Versión no compatible'
        : withoutBase ? 'Sin base evaluable'
        : valid ? `${value.toLocaleString('es-ES')} %` : 'Sin índice',
      formula: version === '2' ? 'Índice de autoevaluación v2'
        : version === '1' ? 'Fórmula anterior (v1)' : 'Revisar contrato',
    };
  });
}

export function selectEvaluations(items, query, version) {
  const term = query.trim().toLocaleLowerCase('es');
  return items.filter(item =>
    item.name.toLocaleLowerCase('es').includes(term) &&
    (version === 'all' || item.version === version)
  ).sort((a, b) => {
    if (a.date === b.date) return a.id.localeCompare(b.id);
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return b.date - a.date;
  });
}
