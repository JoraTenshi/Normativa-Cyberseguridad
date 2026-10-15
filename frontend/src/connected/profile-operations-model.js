import { resourceId } from '../api-client';

export function operationReference(row) {
  const version=row.versionActual, sha256=row.revision?.sha256;
  if (!/^[a-f0-9]{24}$/.test(row.id) || !row.nombre || !Number.isSafeInteger(version) || version<1 || row.revision?.numero!==version || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('No se puede verificar la referencia de una operación. Actualiza el listado.');
  return {id:row.id,nombre:row.nombre,descripcion:row.descripcion||'',version,sha256};
}
export function operationDetail(data, base, id) {
  const org=base.split('/').filter(Boolean).pop();
  if (data.operacion?.id!==id || data.operacion?.organizacionId!==org || data.contexto?.version!==data.versionActual) throw new Error('La operación no corresponde a esta organización o a su revisión actual.');
  return operationReference({...data.operacion,versionActual:data.versionActual,revision:data.revision});
}
// The profile fact stays a list of IDs. The server freezes exact references only
// on explicit materialization, guarded by contextoVersion + propuestaHuella.
export async function verifyOperationLinks(api,base,changes,references) {
  const ids=[...new Set(changes.filter(f=>/^actividad_[a-z][a-z0-9]{0,15}_operaciones$/.test(f.clave) && f.estado==='conocido').flatMap(f=>f.valor))];
  for (const id of ids) {
    const expected=references[id];
    if (!expected) throw new Error('Revisa las operaciones seleccionadas y actualiza el listado antes de guardar.');
    const current=operationDetail(await api.get(base+'/operaciones/'+resourceId(id)),base,id);
    if (current.version!==expected.version || current.sha256!==expected.sha256) throw new Error('Una operación seleccionada ha cambiado. Actualiza el listado, revisa su nombre y revisión y vuelve a guardar. Tu borrador se conserva.');
  }
}
