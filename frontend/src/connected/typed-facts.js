import { changedFacts, cleanFact } from '../api-client';

export const factLabel = field => typeof field.pregunta === 'string' ? field.pregunta : field.pregunta?.texto || field.clave;
export const factHelp = field => field.ayuda || field.pregunta?.motivo || '';
export const valueLabel = value => ({ responsable: 'Responsable', encargado: 'Encargado', corresponsable_delimitado: 'Corresponsable · función delimitada', subencargado_delimitado: 'Subencargado · función delimitada', prevista: 'Prevista · no iniciada', activa: 'Activa', residual: 'Residual · se conservan o tratan datos', finalizada: 'Finalizada · comprobar conservación residual' })[value] || String(value);

export function validTypedValue(field, value) {
  if (field.tipo === 'booleano') return typeof value === 'boolean';
  if (field.tipo === 'numero') return typeof value === 'number' && Number.isFinite(value) && (!field.entero || Number.isSafeInteger(value)) && (field.minimo == null || value >= field.minimo) && (field.maximo == null || value <= field.maximo);
  if (field.tipo === 'texto') return typeof value === 'string' && !!value.trim() && (!field.valores || field.valores.includes(value)) && (field.formato !== 'fecha_civil' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value));
  return false;
}

export function typedFactError(field, fact) {
  if (!fact) return null;
  if (fact.estado === 'desconocido') return ['no_aportado', 'no_sabe', 'por_consultar'].includes(fact.motivo) ? null : 'Indica por qué queda pendiente.';
  if (fact.estado === 'conocido') return validTypedValue(field, fact.valor) ? null : 'Selecciona o introduce un valor válido; si no lo conoces, déjalo pendiente.';
  if (fact.estado === 'conflictivo') {
    const values = fact.alternativas?.map(a => a.valor) || [];
    return values.length >= 2 && values.length <= 5 && values.every(v => validTypedValue(field, v)) && new Set(values.map(v => JSON.stringify(v))).size === values.length ? null : 'Indica entre dos y cinco alternativas válidas y distintas, sin elegir una automáticamente.';
  }
  return 'Estado del dato no reconocido.';
}

export function replaceTypedFact(facts, fact) {
  return facts.some(f => f.clave === fact.clave) ? facts.map(f => f.clave === fact.clave ? fact : f) : [...facts, fact];
}

export function validateContract(contract) {
  if (contract?.id !== 'OPERACION_DP_E11' || contract.version !== 1 || !Array.isArray(contract.campos) || !contract.campos.length || new Set(contract.campos.map(f => f.clave)).size !== contract.campos.length || contract.campos.some(f => !f.clave || !['booleano', 'texto', 'numero'].includes(f.tipo))) throw new Error('El contrato de tratamientos no es compatible. No se pueden guardar respuestas con un diccionario distinto.');
  return contract;
}

export function treatmentChanges(contract, previous, edited, reason) {
  validateContract(contract);
  if (!reason.trim()) throw new Error('Indica el motivo de esta revisión.');
  const changes = changedFacts(previous, edited);
  if (!changes.length) throw new Error('No hay respuestas modificadas para guardar.');
  if (changes.length > contract.limites.cambiosPorPeticion) throw new Error('Demasiados cambios en una revisión.');
  changes.forEach(fact => {
    const field = contract.campos.find(f => f.clave === fact.clave);
    if (!field) throw new Error('El dato no pertenece al contrato consultado.');
    const issue = typedFactError(field, fact);
    if (issue) throw new Error(factLabel(field) + ': ' + issue);
  });
  return changes.map(cleanFact);
}
