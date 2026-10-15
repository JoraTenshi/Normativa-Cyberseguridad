import { parseCapabilities, parseRequest, parseList, requestView, requestBody, requestPath } from './enrollment-model';
const datos = { razonSocial:'Empresa QA', pais:'ES', nif:'B00000001', funcionProfesional:'Responsable técnico', justificacion:'Solicito el espacio de mi empresa.' };
const row = () => ({ id:'a'.repeat(24), version:1, estado:'pendiente_revision', datos, organizacion:null });
test('capabilities require all three booleans, without inferring authority from email or role',()=>{
 expect(parseCapabilities({gestionarAltas:false,requiereMfa:false,requiereAutenticacionReciente:false,rol:'administrador'}).gestionarAltas).toBe(false);
 for (const value of [null,{}, {gestionarAltas:'true',requiereMfa:false,requiereAutenticacionReciente:false}]) expect(()=>parseCapabilities(value)).toThrow('estado de alta válido');
});
test('unknown states, malformed identities and absent versions fail closed',()=>{
 for(const change of [{estado:'activa'},{id:'../otra'},{version:0},{version:1.5},{datos:{}}]) expect(()=>parseRequest({...row(),...change})).toThrow();
 expect(parseRequest(row()).organizacion).toBeNull();
});
test('administrative DTO requires explicit applicant verification and decision permission',()=>{
 expect(()=>parseRequest(row(),true)).toThrow();
 expect(()=>parseRequest({...row(),solicitante:{nombre:'QA',email:'qa@example.invalid',emailVerificado:true}},true)).toThrow();
 const admin={...row(),solicitante:{nombre:'QA',email:'qa@example.invalid',emailVerificado:false},puedeDecidir:false};
 expect(requestView(parseRequest(admin,true)).emailVerified).toBe(false);
 expect(requestView(admin).justification).toBe(datos.justificacion);
});
test('list validates pagination and every request, not just the first',()=>{
 expect(parseList({solicitudes:[row()],siguiente:null}).solicitudes).toHaveLength(1);
 expect(()=>parseList({solicitudes:[row(),{...row(),estado:'inventado'}]})).toThrow();
 expect(()=>parseList({solicitudes:[],siguiente:'../otro'})).toThrow();
});
test('request body contains exactly declared fields, never authority or memberships',()=>{
 expect(requestBody({...datos,nif:'b00000001',razonSocial:' Empresa QA ',rol:'administrador',organizacionId:'x',estado:'aprobada'})).toEqual(datos);
 expect(requestPath(false,'A'.repeat(24))).toBe('/me/solicitudes-organizacion/'+'a'.repeat(24));
 expect(()=>requestPath(true,'../otro')).toThrow();
});
test.each([{pais:'US'},{nif:'B0001'},{razonSocial:''},{funcionProfesional:'x'.repeat(121)},{justificacion:'x'.repeat(1001)}])('invalid or overlong declared field is rejected: %j',change=>{
 expect(()=>requestBody({...datos,...change})).toThrow('Revisa');
});
