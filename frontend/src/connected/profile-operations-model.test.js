import {operationReference,operationDetail,verifyOperationLinks} from './profile-operations-model';
const org='a'.repeat(24),id='b'.repeat(24),base='/organizaciones/'+org,sha='c'.repeat(64);
const row={id,nombre:'Atención al cliente',versionActual:2,revision:{numero:2,sha256:sha}};
const detail={operacion:{id,organizacionId:org,nombre:row.nombre},contexto:{version:2},versionActual:2,revision:row.revision};
const change={clave:'actividad_act1_operaciones',estado:'conocido',valor:[id]};
test('adapts names but retains ID, exact version and hash internally',()=>{
 expect(operationReference(row)).toEqual({id,nombre:row.nombre,descripcion:'',version:2,sha256:sha});
 expect(operationDetail(detail,base,id).version).toBe(2);
});
test('rejects malformed references, foreign organization and wrong identity',()=>{
 expect(()=>operationReference({...row,revision:{numero:1,sha256:sha}})).toThrow();
 expect(()=>operationDetail({...detail,operacion:{...detail.operacion,organizacionId:'f'.repeat(24)}},base,id)).toThrow(/organización/);
 expect(()=>operationDetail(detail,base,'d'.repeat(24))).toThrow();
});
test('rechecks only intentional known links through the authorized organization path',async()=>{
 const api={get:jest.fn().mockResolvedValue(detail)};
 await verifyOperationLinks(api,base,[change],{[id]:operationReference(row)});
 expect(api.get).toHaveBeenCalledWith(base+'/operaciones/'+id);
 expect(change.valor).toEqual([id]);
});
test('does not invent a reference for unknown, conflicting or empty lists',async()=>{
 const api={get:jest.fn()};
 await verifyOperationLinks(api,base,[{...change,estado:'desconocido',valor:undefined},{...change,estado:'conflictivo',valor:undefined},{...change,valor:[]}],{});
 expect(api.get).not.toHaveBeenCalled();
});
test('stale versions and hashes stop the write; absent or foreign detail also fails',async()=>{
 const refs={[id]:operationReference(row)};
 await expect(verifyOperationLinks({get:jest.fn().mockResolvedValue({...detail,revision:{numero:2,sha256:'f'.repeat(64)}})},base,[change],refs)).rejects.toThrow(/ha cambiado/);
 await expect(verifyOperationLinks({get:jest.fn().mockResolvedValue({...detail,versionActual:3,contexto:{version:3},revision:{numero:3,sha256:sha}})},base,[change],refs)).rejects.toThrow(/ha cambiado/);
 await expect(verifyOperationLinks({get:jest.fn().mockRejectedValue(Object.assign(new Error('No disponible'),{status:404}))},base,[change],refs)).rejects.toThrow(/No disponible/);
 await expect(verifyOperationLinks({get:jest.fn()},base,[change],{})).rejects.toThrow(/actualiza/);
});
