'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {crearExtensionDerechos}=require('../services/expedienteDerechos'),{validar}=require('../validation/solicitudDerechos');
const {solicitud,pretension}=require('./fixtures/solicitudDerechos'),{ref,conocido}=require('./fixtures/unidadDP');
const {combinar}=require('../validation/contextoEmpresa'),{huella}=require('../validation/aplicabilidadContextual');
const {fallo}=require('../services/datosOrganizacion');
const H=require('../models/RegistroNormativo'),O=require('../models/Operacion'),RO=require('../models/RevisionOperacion');
function preparar(t){
 const org=ref('2').id,actor=ref('d').id,scope={...ref('a'),version:2},db=new Map(),ops=new Map();
 const makeOp=id=>{const contenido={nombre:'Fixture',descripcion:'Fixture',subespacioId:null,hechos:combinar([],['dp_ambito_rgpd','dp_establecimiento_es','dp_regimen_general'].map(k=>conocido(k,true)).concat(conocido('dp_rol','responsable')),actor)};
 const h={_id:id,organizacion:org,version_actual:1,nombre:'Fixture',descripcion:'Fixture',subespacio:null},v={organizacion:org,operacion:id,numero:1,contenido,sha256:huella(contenido),createdAt:'2026-10-16T00:00:00.000Z'};ops.set(id,{h,v});return {id,version:1,sha256:v.sha256};};
 const a=makeOp(ref('b').id),b=makeOp(ref('c').id);
 t.mock.method(O,'findOne',f=>f.organizacion===org?ops.get(f._id)?.h:null);t.mock.method(RO,'findOne',f=>f.organizacion===org?ops.get(f.operacion)?.v:null);
 const poner=(id,tipo,contenido,n=1)=>{const r={h:{_id:id,tipo,organizacion:org,version_actual:n},v:{numero:n,sha256:huella(contenido),contenido,createdAt:'2026-10-16T00:00:00.000Z'}};db.set(id,r);return r;};
 const referencia=(h,v)=>({id:h._id,version:v.numero,sha256:v.sha256}),rr=r=>referencia(r.h,r.v);
 const s={...solicitud(),personaReferencia:'persona_ficticia_123',recepcion:{estado:'conocida',precision:'fecha_civil',fecha:'2026-10-15',instante:null,zona:'Europe/Madrid',motivo:'Fixture'},canal:{estado:'conocido',contenido:'Fixture',motivo:''},contextoOperacion:'confirmado',inventarioPretensionesCompleto:true,operaciones:[b],alcances:[scope],hechos:combinar([],[conocido('sol_expediente_delimitado',true)],actor)};
 const parent=poner(ref('e').id,'solicitud_derechos',{solicitudDerechos:s},2),oldParent={...rr(parent),version:1,sha256:'0'.repeat(64)};
 const oldData={...pretension(),solicitud:oldParent,operacion:a,alcance:{...scope,version:1},derecho:'acceso'};delete oldData.motivo;delete oldData.confirmarBases;
 const old=poner(ref('f').id,'pretension_derecho',{pretensionDerecho:oldData});
 const next=poner(ref('1').id,'pretension_derecho',{pretensionDerecho:{...oldData,solicitud:rr(parent),operacion:b,alcance:scope}});
 t.mock.method(H,'find',()=>({sort(){return this;},limit(){return [...db.values()].filter(r=>r.h.tipo==='pretension_derecho').map(r=>r.h);}}));
 const registro=async(o,tipo,id)=>{const r=db.get(String(id));if(o!==org||!r||r.h.tipo!==tipo)fallo('RECURSO_NO_DISPONIBLE');return r;};
 const compararRef=(x,y)=>{if(huella(x)!==huella(y))fallo('VERSION_DESACTUALIZADA');};
 const ar={actual:scope,motivos:[],r:{contenido:{origen:{operaciones:[b]}}}};
 const svc=crearExtensionDerechos({registro,referenciado:async(o,tipo,r)=>{const x=await registro(o,tipo,r.id);compararRef(r,rr(x));return x;},compararRef,referencia,q:async x=>x,alcance:async()=>ar,evidenciaActual:async()=>{throw Error('NO_EVIDENCIAS');},reloj:()=>new Date('2026-10-16T10:00:00.000Z')});
 const datos=()=>({...oldData,version:old.h.version_actual,confirmarBases:false,motivo:'Corregir vínculo de operación conservando petición',sustitucion:{destino:rr(next),motivo:'La operación correcta es B; misma petición',confirmarMismaPeticion:true}});
 return {org,svc,parent,old,next,db,poner,rr,ar,datos,ctx:{contexto:{organizacionId:org,membresiaId:actor},session:null}};
}
test('error A a B corrige vínculo sin exigir bases obsoletas A ni ocultar petición',async t=>{
 const f=preparar(t),before=await f.svc.estado(f.org,f.parent.h,f.parent.v,null);
 assert.equal(before.vigenciaBases.requiereRevision,false);assert.equal(before.vigencia.requiereRevision,true);assert.equal(before.gestionDerechos.evaluabilidad.habilitaContextualizacion,false);
 const contexto=()=>f.svc.contexto(f.org,{tipo:'solicitud_derechos',id:f.parent.h._id,version:2},f.ar,null),ctxBefore=await contexto();
 const contenidoOriginal=structuredClone(f.old.v.contenido);const built=await f.svc.construir('pretension_derecho',validar('pretension_derecho',f.datos(),true),f.ctx,f.old.h,2);
 assert.deepEqual(f.old.v.contenido,contenidoOriginal);f.poner(f.old.h._id,'pretension_derecho',built.contenido,2);
 const after=await f.svc.estado(f.org,f.parent.h,f.parent.v,null);assert.equal(after.vigencia.requiereRevision,false);assert.equal(after.gestionDerechos.evaluabilidad.habilitaContextualizacion,true);
 assert.deepEqual(after.gestionDerechos.pretensiones.map(x=>x.estadoTecnico),['sustituida','activa']);
 const ctxAfter=await contexto();assert.notEqual(ctxAfter.objetoSha256,ctxBefore.objetoSha256);assert.equal(ctxAfter.contexto.hechos.find(h=>h.clave==='sol_expediente_delimitado').valor,true);
 const nuevo=structuredClone(f.next.v.contenido);nuevo.pretensionDerecho.estadoGestion='en_estudio';f.poner(f.next.h._id,'pretension_derecho',nuevo,2);
 const changed=await f.svc.estado(f.org,f.parent.h,f.parent.v,null);assert.equal(changed.vigencia.requiereRevision,true);assert.equal(changed.gestionDerechos.evaluabilidad.habilitaContextualizacion,false);assert.ok(changed.gestionDerechos.evaluabilidad.pendientes.some(m=>m.includes('sustitucion_pendiente')));
 assert.equal((await contexto()).contexto.hechos.find(h=>h.clave==='sol_expediente_delimitado').estado,'desconocido');
});
for(const [name,mutate]of [
 ['autorreferencia',(f,d)=>d.sustitucion.destino=f.rr(f.old)],
 ['reescribe petición',(f,d)=>d.peticion='Otra petición'],
 ['destino ya sustituido',(f)=>f.next.v.contenido.pretensionDerecho.sustitucion={destino:f.rr(f.old)}],
 ['otra solicitud',(f)=>f.next.v.contenido.pretensionDerecho.solicitud.id=ref('4').id],
 ['otra petición',(f)=>f.next.v.contenido.pretensionDerecho.peticion='Diferente'],
 ['otro derecho',(f)=>f.next.v.contenido.pretensionDerecho.derecho='supresion'],
 ['destino versión antigua',(f,d)=>d.sustitucion.destino.version=8]
])test('sustitución rechaza '+name,async t=>{const f=preparar(t),d=f.datos();mutate(f,d);await assert.rejects(()=>f.svc.construir('pretension_derecho',d,f.ctx,f.old.h,2));});
test('no sustitución en alta ni sin confirmar misma petición',()=>{const d={...pretension(),sustitucion:{destino:ref('f'),motivo:'Fixture',confirmarMismaPeticion:true}};assert.throws(()=>validar('pretension_derecho',d));d.version=1;d.sustitucion.confirmarMismaPeticion=false;assert.throws(()=>validar('pretension_derecho',d,true));});
