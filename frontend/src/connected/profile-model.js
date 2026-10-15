import { cleanFact, changedFacts } from '../api-client';

// This module only adapts the published profile contract. It decides no legal rules.
export const FUNCTIONS = ['desarrollo', 'mantenimiento', 'distribucion', 'alojamiento', 'operacion'];
const fail = message => { throw new Error(message); };
const list = value => value.split(';').map(s => s.trim()).filter(Boolean);
const equal = (a, b) => JSON.stringify(a && cleanFact(a)) === JSON.stringify(b && cleanFact(b));
export const factMap = facts => Object.fromEntries(facts.map(f => [f.clave, cleanFact(f)]));
export const activityIds = facts => facts.find(f => f.clave === 'perfil_actividades' && f.estado === 'conocido')?.valor || [];

export function answerDraft(question) {
  const fact = question.respuesta;
  return { state: fact?.estado || 'desconocido', reason: fact?.motivo || 'no_aportado',
    raw: fact?.estado === 'conocido' ? Array.isArray(fact.valor) ? fact.valor.join('; ') : String(fact.valor) : '',
    original: fact ? cleanFact(fact) : null };
}

export function parseAnswer(question, draft) {
  const clave = question.clave;
  if (draft.state === 'conflictivo') {
    if (draft.original?.estado !== 'conflictivo') fail('No se pueden inventar alternativas contradictorias.');
    return cleanFact(draft.original);
  }
  if (draft.state === 'desconocido') return { clave, estado: 'desconocido', motivo: draft.reason };
  const raw = draft.raw.trim();
  let valor = raw;
  if (question.tipo === 'booleano') {
    if (!['true', 'false'].includes(raw)) fail('Selecciona Sí o No; una respuesta vacía no equivale a No.');
    valor = raw === 'true';
  } else if (question.tipo === 'numero') {
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 1000000) fail('Indica un número entero entre 0 y 1.000.000.');
    valor = Number(raw);
  } else if (question.tipo === 'tipo') {
    if (!['servicio', 'producto'].includes(raw)) fail('Indica si se trata de un servicio o un producto.');
  } else if (['lista', 'ids', 'funciones', 'lista_identificadores'].includes(question.tipo)) {
    valor = list(raw);
    if (valor.length > (question.tipo === 'lista_identificadores' ? 8 : 20) || new Set(valor).size !== valor.length) fail('La lista tiene elementos repetidos o demasiados elementos.');
    if (valor.some(v => question.tipo === 'ids' ? !/^[a-f0-9]{24}$/.test(v) : question.tipo === 'funciones' ? !FUNCTIONS.includes(v) : question.tipo === 'lista_identificadores' ? !/^[a-z][a-z0-9]{0,15}$/.test(v) : v.length > 100)) fail('Revisa los valores de la lista.');
  } else if (question.tipo === 'texto') {
    if (!raw || raw.length > 120) fail('Escribe entre 1 y 120 caracteres o marca el dato como pendiente.');
  } else fail('Tipo de pregunta no compatible. No se enviará este dato.');
  return { clave, estado: 'conocido', valor };
}

export function contextWrite(version, previous, edited, reason) {
  const motivo = reason.trim();
  if (!motivo || motivo.length > 300) fail('Explica el motivo de esta revisión (máximo 300 caracteres).');
  const cambios = changedFacts(previous, edited);
  if (!cambios.length) fail('No hay datos modificados para guardar.');
  if (cambios.length > 50) fail('Guarda por bloques: se admiten hasta 50 datos modificados por revisión.');
  return { version, cambios, motivo };
}

// Only intentional edits are rebased. Unedited server facts are never sent back.
export function conflictingKeys(previous, edited, current) {
  const old = factMap(previous), latest = factMap(current);
  return changedFacts(previous, edited).filter(f => !equal(old[f.clave], latest[f.clave]) && !equal(f, latest[f.clave])).map(f => f.clave);
}
export function rebaseEdits(previous, edited, current, choices) {
  const conflicts = conflictingKeys(previous, edited, current);
  if (conflicts.some(k => !['mine', 'server'].includes(choices[k]))) fail('Elige qué conservar en cada dato que cambió en ambos lados.');
  return changedFacts(current, changedFacts(previous, edited).filter(f => choices[f.clave] !== 'server'));
}

export function newActivity(previous, ids, name, type) {
  if (ids.length >= 8) fail('Este primer bloque admite hasta ocho actividades.');
  if (!name.trim() || name.trim().length > 120 || !['servicio', 'producto'].includes(type)) fail('Indica el nombre y el tipo de actividad.');
  let n = 1;
  while (ids.includes('act' + n) || previous.some(f => f.clave.startsWith('actividad_act' + n + '_'))) n++;
  const id = 'act' + n;
  return [
    { clave: 'perfil_actividades', estado: 'conocido', valor: [...ids, id] },
    { clave: `actividad_${id}_nombre`, estado: 'conocido', valor: name.trim() },
    { clave: `actividad_${id}_tipo`, estado: 'conocido', valor: type }
  ];
}

export function materializationBody(proposal, selection, reason, confirmed) {
  if (!confirmed) fail('Revisa y confirma expresamente la organización del trabajo.');
  if (!proposal.espacios.length) fail('Añade al menos una actividad antes de confirmar espacios.');
  if (!reason.trim() || reason.trim().length > 300) fail('Explica el motivo de la confirmación.');
  const espacios = proposal.espacios.map(space => {
    const chosen = selection[space.actividadId];
    if (chosen?.id) {
      if (!/^[a-f0-9]{24}$/.test(chosen.id) || !Number.isSafeInteger(chosen.version) || chosen.version < 0) fail('La referencia al espacio existente no es válida.');
      return { actividadId: space.actividadId, existente: { id: chosen.id, version: chosen.version } };
    }
    if (!['servicio', 'producto'].includes(space.tipo)) fail('Completa el tipo de cada actividad antes de crear su espacio.');
    return { actividadId: space.actividadId, nuevo: { nombre: space.nombre, tipo: space.tipo, descripcion: space.descripcion } };
  });
  return { contextoVersion: proposal.contextoVersion, propuestaHuella: proposal.propuestaHuella, confirmar: true,
    espacios, alcances: proposal.alcances.map(({ clave, nombre, actividadIds, sistemas, informacion, limites, exclusiones, dependencias }) =>
      ({ clave, nombre, actividadIds, sistemas, informacion, limites, exclusiones, dependencias })), motivo: reason.trim() };
}
