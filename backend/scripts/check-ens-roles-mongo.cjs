'use strict';
// Catálogo real del nuevo staging. Sesiones persistentes y MFA sintéticos.
// No lee .env ni admite una BD externa. Los documentos de este runner son fixtures.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const backend = fs.realpathSync(process.env.NC_TEST_BACKEND || '');
const req = createRequire(path.join(backend, 'package.json'));
const local = p => req(path.join(backend, p));
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const mongoose = req('mongoose'), request = req('supertest'), speakeasy = req('speakeasy');
const Org = local('models/Organizacion'), M = local('models/Membresia'), U = local('models/Usuario');
const H = local('models/RegistroNormativo'), V = local('models/VersionRegistroNormativo'), E = local('models/EventoOrganizacion');
const D = local('models/DocumentoOrganizacion'), VD = local('models/VersionDocumento');
const { catalogoNormativo } = local('services/catalogoNormativoC2');
const { validarPaquete } = local('validation/paqueteNormativo');
const { encryptTotpSecret } = local('utils/totpEncryption');
const { huella } = local('validation/aplicabilidadContextual');
const { createApp } = local('app');
const { empresa, confirmacion, conocido } = local('tests/fixtures/nexoSoftware');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const manifestPath = fs.realpathSync(process.env.NC_TEST_MANIFEST || '');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const paquetes = manifest.paquetes.map(p => {
  const bytes = fs.readFileSync(path.resolve(path.dirname(manifestPath), p.archivo));
  assert.equal(sha(bytes), p.sha256Archivo, 'Hash editorial: ' + p.id);
  const paquete = JSON.parse(bytes); assert.equal(paquete.ficha.id, p.id); return paquete;
});
assert.equal(paquetes.length, 3);
assert.equal(paquetes.reduce((n,p) => n + p.ficha.satisfaccion.rutas.length, 0), 7);
assert.equal(catalogoNormativo.listar().length, 5);
for (const p of paquetes) assert.deepEqual(catalogoNormativo.obtener(p.ficha.id), validarPaquete(p));
const informe = { iniciadoEn: new Date().toISOString(), backend, manifestSha256: sha(fs.readFileSync(manifestPath)),
  paquetes: manifest.paquetes, grupos: [], hallazgos: [], recorridos: [], peticiones: 0,
  limites: ['Datos sintéticos; revisión interna declarada, no suficiencia jurídica ni certificación.',
    'API HTTP y Mongo efímero: login y MFA de administrador reales con identidades sintéticas; sin navegador ni HTTPS.',
    'Catálogo del staging incluye cinco fichas; no despliegue en Hetzner/Kali habitual ni modificación de R3.',
    'Los instrumentos PDF se siembran como metadatos/binario sintéticos; no prueba subida ni contenido PDF.',
    'Los casos editoriales históricos se mantienen en dominio; HTTP usa reloj real y no falsifica fecha de fuentes.'] };
const clones = v => JSON.parse(JSON.stringify(v));
const archivos = ['app.js','routes/registrosNormativos.js','services/registrosNormativos.js','services/revisionRequisito.js',
  'services/catalogoNormativoC2.js','validation/registroNormativo.js','validation/designacionFuncional.js',
  'validation/paqueteNormativo.js','validation/constatacionDocumento.js','models/RegistroNormativo.js','models/VersionRegistroNormativo.js',
  'scripts/run-gestion-unidades-mongo.js','catalogo/c2/ENS_POLITICA_SEGURIDAD.v3.json','catalogo/c2/RGPD28_FORMALIZACION_CONTENIDO.v3.json'];
function hashes() { return Object.fromEntries(archivos.map(f => [f, sha(fs.readFileSync(path.join(backend,f)))])); }
informe.codigoAntes = hashes();
async function comprobar({uri, nombreBD, standalone=false}) {
  const u = new URL(uri);
  assert.ok(u.hostname === '127.0.0.1' && u.port !== '27017' && /^nc_org03_[a-f0-9]{24}$/.test(nombreBD));
  const casos = [], caso = async (nombre, fn) => { await fn(); casos.push(nombre); informe.grupos.push({nombre, standalone, ok:true}); console.log('OK '+nombre); };
  const key = () => crypto.randomUUID();
  const ok = (r, status=200) => { assert.equal(r.status,status,JSON.stringify(r.body)); return r.body.data; };
  const hoy = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const periodo = {desde:hoy,hasta:new Date(Date.parse(hoy+'T12:00:00Z')+86400000).toISOString().slice(0,10),calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'};
  const comprobacion = {tipo:'comprobacion',metodo:'Examen documental y comprobación operativa SINTÉTICOS',realizadaEn:new Date().toISOString(),resultado:'Contenido y ejercicio declarados por revisor ficticio',limitaciones:'Fixture sin valor de dictamen ni prueba jurídica real'};
  try {
    await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:5000});
    for (const m of Object.values(mongoose.models)) await m.init();
    const [a,b] = await Org.create([1,2].map(n=>({razon_social:'ENS HTTP FICTICIA '+n,pais:'ES',identificador_tipo:'NIF',identificador_valor:'C0000000'+n,estado:'activa'})));
    const ms = {}, cookies = {}, password = 'Prueba-ENS-Roles-4290!', secret = speakeasy.generateSecret({length:20}).base32;
    for (const [nombre,org,rol] of [['admin',a,'administrador'],['lector',a,'consulta'],['ajeno',b,'administrador']]) {
      const usuario = new mongoose.Types.ObjectId();
      await U.create({_id:usuario,nombre:'Sintético '+nombre,email:nombre+'@example.invalid',password,emailVerifiedAt:new Date(),
        ...(nombre==='admin'?{twoFactorEnabled:true,twoFactorSecret:encryptTotpSecret(secret,usuario)}:{})});
      ms[nombre] = await M.create({usuario,organizacion:org._id,rol,estado:'activa'});
    }
    const app=createApp({rateLimits:false}), raiz='/organizaciones/'+a._id;
    const cookie = (r,name='cyberaudit_token') => (r.headers['set-cookie']||[]).find(c=>c.startsWith(name+'=')&&!c.startsWith(name+'=;'))?.split(';')[0];
    for (const nombre of Object.keys(ms)) {
      let r=await request(app).post('/auth/login').set('X-Requested-With','XMLHttpRequest').send({email:nombre+'@example.invalid',password});
      assert.equal(r.status,200);
      if(nombre==='admin'){
        assert.equal(r.body.data.requires2fa,true);
        const pending=cookie(r,'cyberaudit_2fa_pending');assert.ok(pending);assert.equal(cookie(r),undefined);
        r=await request(app).post('/auth/2fa/verify').set('X-Requested-With','XMLHttpRequest').set('Cookie',pending).send({token:speakeasy.totp({secret,encoding:'base32'})});
      }
      assert.equal(r.status,200);cookies[nombre]=cookie(r);assert.ok(cookies[nombre]);
    }
    const api=(metodo,ruta,quien='admin',orgRaiz=raiz)=>{ informe.peticiones++; return request(app)[metodo](orgRaiz+ruta)
      .set('Cookie',cookies[quien])
      .set('X-Requested-With','XMLHttpRequest'); };
    const post=(ruta,d,k=key(),quien='admin')=>api('post','/normativa/'+ruta,quien).set('Idempotency-Key',k).send(d);
    const patch=(ruta,d,k=key())=>api('patch','/normativa/'+ruta).set('Idempotency-Key',k).send(d);
    const get=(ruta,quien='admin')=>api('get','/normativa/'+ruta,quien);
    const cuenta=async()=>[await H.countDocuments(),await V.countDocuments(),await E.countDocuments({accion:/^normativa_/})];
    const sujetoDatos = n => ({tipo:'persona',nombre:'Titular ficticio '+n,procedenciaOrganizativa:'Proveedor sintético ENS; no cuenta',membresiaId:null,motivo:'Identidad organizativa sin privilegios'});
    if (standalone) {
      await caso('standalone: escritura rechazada sin registros, versiones ni eventos parciales',async()=>{
        assert.equal((await post('sujetos-funcionales',sujetoDatos('negativo'))).status,503); assert.deepEqual(await cuenta(),[0,0,0]);
      }); return casos;
    }
    assert.equal(catalogoNormativo.listar().length,5);
    const perfil=empresa();
    ok(await api('post','/contexto').set('Idempotency-Key',key()).send(perfil),201);
    const prop=ok(await api('get','/contexto/propuestas'));
    const mat=ok(await api('post','/contexto/materializaciones').set('Idempotency-Key',key()).send(confirmacion(prop)),201);
    const ar=ok(await api('get','/alcances/'+mat.alcances[0].id));
    const alcance={id:ar.id,version:ar.revision.numero,sha256:ar.revision.sha256};
    const snapshots=[];
    async function persistido(tipo,dto) {
      const recuperado=ok(await get(tipo+'/'+dto.id)); assert.deepEqual(recuperado.contenido,dto.contenido);
      const v=await V.findOne({registro:dto.id,numero:dto.version}).lean();
      assert.ok(v,'Versión en Mongo'); assert.equal(v.sha256,huella(v.contenido));
      snapshots.push({tipo,id:dto.id,version:dto.version,contenido:clones(dto.contenido)});
    }
    await caso('tres fichas exactas solo en catálogo HTTP temporal; permisos y catálogos separados',async()=>{
      const listado=ok(await get('catalogo'));
      assert.equal(listado.paquetes.length,5);
      for(const p of paquetes){ assert.ok(JSON.stringify(listado).includes(p.ficha.id)); assert.deepEqual(catalogoNormativo.obtener(p.ficha.id),validarPaquete(p)); }
      assert.equal((await get('catalogo','ajeno')).status,403);
      assert.equal((await get('catalogo?organizacionId='+b._id)).status,400);
      assert.equal((await post('sujetos-funcionales',{...sujetoDatos('X'),rol:'administrador'})).status,400);
      assert.equal((await post('sujetos-funcionales',{...sujetoDatos('X'),membresiaId:String(ms.ajeno._id)})).status,404);
    });
    const recorridos=[];
    for(const p of paquetes) for(const ruta of p.ficha.satisfaccion.rutas) {
      const nombre=p.ficha.id+'/'+ruta.id;
      let sis, requisito, sujeto, des;
      const hechos = {...p.casosAplicabilidad.base,...Object.fromEntries(ruta.hechosRequeridos.map(h=>[h.clave,h.valor]))};
      let sisDatos={nombre:'Sistema '+ruta.id,descripcion:'Recorrido ENS SINTÉTICO',alcance,hechos:Object.entries(hechos).map(([k,v])=>conocido(k,v)),motivo:'Contextualización con hechos versionados'};
      const objeto=()=>({tipo:'sistema',id:sis.id,version:sis.version});
      const reqDatos=()=>({alcance,objeto:objeto(),ficha:{id:p.ficha.id,version:p.ficha.version},motivo:'Ficha editorial temporal exacta'});
      let desDatos, evs=[], primeraRevision;
      const evDatos=(tipo,soporte,titulo)=>({alcances:[alcance],tipo,titulo,procedencia:'Prueba HTTP sintética',localizador:'EXP-SINTETICO/'+ruta.id,periodo,soporte,motivo:'Registro versionado para revisión declarada'});
      const revisar=(conclusion='favorable',evidencias=evs)=>({requisito:requisito.referencia,evidencias:evidencias.map(e=>e.referencia),tipo:'interna',periodo,
        ruta:{id:ruta.id,motivo:'Alternativa elegida explícitamente por revisor ficticio'},
        criterios:ruta.requiereTodos.map((id,i)=>({criterioId:id,resultado:conclusion,motivo:'Juicio interno sintético sobre contenido, alcance y periodo',
          evidenciaIds:[evidencias[i].id],compatibilidad:{estado:conclusion==='favorable'?'compatible':'desconocida',motivo:'Compatibilidad expresamente valorada, no inferida por nombre'}})),
        conclusion,motivo:'No certificación; prueba de persistencia de revisión humana declarada'});
      await caso(nombre+': contexto, función y evidencia persistidos sin crear cuentas',async()=>{
        sis=ok(await post('sistemas',sisDatos),201); requisito=ok(await post('requisitos',reqDatos()),201);
        assert.equal(requisito.contenido.requisito.resultado.decision.estado,'aplica');
        assert.equal(requisito.contenido.requisito.ficha.sha256,huella(p.ficha));
        await persistido('sistemas',sis); await persistido('requisitos',requisito);
        const antes=[await U.countDocuments(),await M.countDocuments()];
        sujeto=ok(await post('sujetos-funcionales',sujetoDatos(ruta.id)),201);
        desDatos={alcance,objeto:objeto(),funcionId:ruta.id,estado:'identificada',motivoDelEstado:'Designación de prueba, no concesión de rol',
          titulares:[{sujeto:sujeto.referencia,delimitacion:'Responsabilidad funcional delimitada al objeto sintético'}],instrumentos:[comprobacion],periodo:{...periodo,hasta:null},motivo:'Asignación funcional sintética'};
        des=ok(await post('designaciones',desDatos),201); await persistido('sujetos-funcionales',sujeto); await persistido('designaciones',des);
        assert.deepEqual([await U.countDocuments(),await M.countDocuments()],antes);
        for(const id of ruta.requiereTodos) {
          const c=p.ficha.criterios.find(c=>c.id===id);
          const tipo=c.tiposEvidencia.includes('constatacion_documento')?'constatacion_documento':c.tiposEvidencia.find(t=>!['version_documento','designacion_versionada'].includes(t));
          assert.ok(tipo,'Tipo de evidencia no PDF para '+id);
          const soporte=clones(comprobacion);
          if(tipo==='constatacion_documento') { soporte.metodo='Examen del documento externo EXP-POC-SINTETICO versión 1, apartado 2'; soporte.resultado='Se examinó la causa documentada; fixture sin valor jurídico';
            soporte.documentoExaminado={identificador:'EXP-POC-SINTETICO',version:'1',localizador:'Repositorio externo sintético / apartado 2',contenidoExaminado:'Identificación de causa documentada y delimitación del servicio; datos ficticios'}; }
          const ev=ok(await post('evidencias',evDatos(tipo,soporte,'Evidencia '+id)),201); evs.push(ev); await persistido('evidencias',ev);
        }
        const tarea=ok(await post('actuaciones',{titulo:'Preparar pruebas '+ruta.id,descripcion:'Completar no aprueba requisitos',estado:'pendiente',requisitos:[requisito.referencia],responsableMembresiaId:String(ms.admin._id),motivo:'Prueba'}),201);
        ok(await patch('actuaciones/'+tarea.id,{titulo:'Preparar pruebas '+ruta.id,descripcion:'Completar no aprueba requisitos',estado:'terminada',requisitos:[requisito.referencia],responsableMembresiaId:String(ms.admin._id),motivo:'Prueba',version:tarea.version}));
        assert.equal(ok(await get('requisitos/'+requisito.id)).estadoRevision.satisfaccionActual,'sin_revisar');
      });
      await caso(nombre+': favorable, desfavorable y no determinado conservan revisión y autor',async()=>{
        for(const conclusion of ['no_determinado','desfavorable','favorable']) {
          const datos=revisar(conclusion), k=key(), r=ok(await post('revisiones',datos,k),201);
          assert.equal(ok(await post('revisiones',datos,k)).id,r.id);
          const rv=r.contenido.revision; assert.equal(rv.conclusion,conclusion); assert.equal(rv.ruta.id,ruta.id);
          assert.equal(rv.revisor.membresiaId,String(ms.admin._id));assert.equal(rv.esCertificacion,false);assert.equal(rv.dictamenJuridicoProfesional,false);
          assert.equal(rv.sha256,huella(Object.fromEntries(Object.entries(rv).filter(([k])=>k!=='sha256'))));
          assert.ok(rv.criteriosFueraRuta.every(c=>c.estado==='no_exigido_por_ruta'));
          assert.deepEqual(rv.ruta.hechos.map(h=>[h.clave,h.hecho.valor]),ruta.hechosRequeridos.map(h=>[h.clave,h.valor]));
          await persistido('revisiones',r); assert.equal(ok(await get('requisitos/'+requisito.id)).estadoRevision.satisfaccionActual,conclusion);
          if(conclusion==='favorable')primeraRevision=r;
        }
        const log=ok(await api('get','/actividad?categoria=normativa&registroNormativoId='+primeraRevision.id));
        assert.ok(JSON.stringify(log).includes(primeraRevision.id));
        informe.recorridos.push({ficha:p.ficha.id,ruta:ruta.id,requisito:requisito.referencia,revision:primeraRevision.referencia});
      });
      await caso(nombre+': rechaza incompletos, mezcla, no_procede y accesos indebidos',async()=>{
        const antes=await cuenta(), base=revisar();
        const incompleto=clones(base);incompleto.criterios.pop();assert.equal((await post('revisiones',incompleto)).status,400);
        const libre=clones(base);libre.criterios[0].resultado='no_procede';assert.equal((await post('revisiones',libre)).status,400);
        const conflicto=clones(base);conflicto.criterios[0].compatibilidad.estado='en_conflicto';assert.equal((await post('revisiones',conflicto)).status,400);
        const sinPrueba=clones(base);sinPrueba.criterios[0].evidenciaIds=[];assert.equal((await post('revisiones',sinPrueba)).status,400);
        const forzado=clones(base);forzado.conclusion='desfavorable';assert.equal((await post('revisiones',forzado)).status,400);
        const mezclado=clones(base);mezclado.criterios[0].criterioId=p.ficha.criterios.find(c=>!ruta.requiereTodos.includes(c.id))?.id||'CRITERIO_INVENTADO';assert.equal((await post('revisiones',mezclado)).status,400);
        for(const quien of ['lector','ajeno']) {
          assert.equal((await post('revisiones',base,key(),quien)).status,403);
          assert.equal((await get('revisiones/'+primeraRevision.id,quien)).status,403);
          assert.equal((await get('sujetos-funcionales/'+sujeto.id+'/versiones',quien)).status,403);
        }
        assert.equal((await api('get','/normativa/revisiones/'+primeraRevision.id,'ajeno','/organizaciones/'+b._id)).status,404);
        assert.equal((await post('revisiones',{...base,organizacionId:String(b._id)})).status,400);
        assert.equal((await api('post','/normativa/revisiones').set('Origin','https://ajeno.invalid').set('Idempotency-Key',key()).send(base)).status,403);
        assert.deepEqual(await cuenta(),antes);
      });
      if(ruta.id==='POC_EXCEPCION_JUSTIFICADA') await caso(nombre+': sonda de constatación documental frente a afirmación oral',async()=>{
        const oral=ok(await post('evidencias',evDatos('entrevista',{...comprobacion,metodo:'Conversación oral',resultado:'Se afirma causa; no existe documento subyacente'},'Declaración oral sintética')),201);
        assert.equal((await post('revisiones',revisar('favorable',[evs[0],oral]))).status,400);
        const antes=await cuenta();
        assert.equal((await post('evidencias',evDatos('constatacion_documento',{...comprobacion,metodo:'Conversación oral',resultado:'Se afirma causa; no existe documento subyacente'},'Oral mal etiquetada'))).status,400);
        assert.deepEqual(await cuenta(),antes);
        const anterior=evs[1], soporte=clones(anterior.contenido.evidencia.soporte);delete soporte.responsableRef;
        soporte.documentoExaminado.version='2';
        evs[1]=ok(await patch('evidencias/'+anterior.id,{...evDatos('constatacion_documento',soporte,'Examen documental actualizado'),version:anterior.version}));
        assert.equal(ok(await get('requisitos/'+requisito.id)).estadoRevision.requiereRevision,true);
        assert.deepEqual(ok(await get('revisiones/'+primeraRevision.id)).contenido,primeraRevision.contenido);
        assert.equal((await post('revisiones',revisar('favorable',[evs[0],anterior]))).status,409);
        const actual=ok(await post('revisiones',revisar()),201);await persistido('revisiones',actual);
        assert.equal(actual.contenido.revision.evidencias.find(e=>e.id===evs[1].id).soporte.documentoExaminado.version,'2');
        informe.correccionDocumental={id:'ENS-HTTP-DOC-01',estado:'negativo_y_positivo_verificados',revision:actual.referencia};
      });
      // Evidencia anclada a una designación real, aparte de comprobaciones operativas.
      if(ruta.requiereTodos.some(id=>p.ficha.criterios.find(c=>c.id===id).tiposEvidencia.includes('designacion_versionada'))) await caso(nombre+': designación exacta y cambio de instrumento conservan histórico',async()=>{
        const i=ruta.requiereTodos.findIndex(id=>p.ficha.criterios.find(c=>c.id===id).tiposEvidencia.includes('designacion_versionada'));
        const ed=evDatos('designacion_versionada',{tipo:'designacion_versionada',referencia:des.referencia},'Nombramiento sintético versionado');
        const ev=ok(await post('evidencias',ed),201), es=[...evs];es[i]=ev;
        const r=ok(await post('revisiones',revisar('favorable',es)),201);await persistido('revisiones',r);
        des=ok(await patch('designaciones/'+des.id,{...desDatos,instrumentos:[{...comprobacion,resultado:'Instrumento corregido versión 2 de prueba'}],version:des.version}));
        assert.equal(ok(await get('evidencias/'+ev.id)).vigencia.requiereRevision,true);
        assert.equal(ok(await get('requisitos/'+requisito.id)).estadoRevision.requiereRevision,true);
        assert.deepEqual(ok(await get('revisiones/'+r.id)).contenido,r.contenido);
        assert.equal((await post('evidencias',ed)).status,409);
        await patch('sujetos-funcionales/'+sujeto.id,{...sujetoDatos(ruta.id),nombre:'Titular corregido '+ruta.id,version:sujeto.version}).then(ok);
        assert.ok(ok(await get('designaciones/'+des.id)).vigencia.motivos.some(m=>m.startsWith('sujeto_designacion_modificado:')));
        assert.equal(ok(await get('designaciones/'+des.id+'/versiones/1')).contenido.designacion.titulares[0].datosSujeto.nombre,sujetoDatos(ruta.id).nombre);
      });
      for(const guarda of ruta.hechosRequeridos) for(const estado of ['opuesto','ausente','desconocido','conflictivo']) await caso(nombre+': '+guarda.clave+' '+estado+' no produce favorable ni no_aplica',async()=>{
        let hs=Object.entries(hechos).filter(([k])=>k!==guarda.clave).map(([k,v])=>conocido(k,v));
        if(estado==='opuesto')hs.push(conocido(guarda.clave,!guarda.valor));
        if(estado==='desconocido')hs.push({clave:guarda.clave,estado:'desconocido',motivo:'por_consultar'});
        if(estado==='conflictivo')hs.push({clave:guarda.clave,estado:'conflictivo',alternativas:[{valor:true},{valor:false}]});
        sisDatos={...sisDatos,hechos:hs};sis=ok(await patch('sistemas/'+sis.id,{...sisDatos,version:sis.version}));
        requisito=ok(await patch('requisitos/'+requisito.id,{...reqDatos(),version:requisito.version}));
        assert.equal(requisito.contenido.requisito.resultado.decision.estado,'aplica');
        assert.equal((await post('revisiones',revisar())).status,400);
        const r=ok(await post('revisiones',revisar('no_determinado')),201);await persistido('revisiones',r);
        assert.equal(r.contenido.revision.ruta.hechos.find(h=>h.clave===guarda.clave).estado,estado==='opuesto'?'no_coincide':estado==='conflictivo'?'en_conflicto':'desconocido');
        assert.deepEqual(ok(await get('revisiones/'+primeraRevision.id)).contenido,primeraRevision.contenido);
      });
      recorridos.push({p,ruta,sis,requisito,primeraRevision});
    }
    for(const p of paquetes) for(const c of p.casosAplicabilidad.casos.filter(c=>!c.fechaCivil)) await caso(p.ficha.id+': aplicabilidad HTTP '+c.id,async()=>{
      const hechos=Object.entries({...p.casosAplicabilidad.base,...c.cambios}).filter(([k])=>!(c.desconocidos||[]).includes(k)&&!(c.conflictivos||[]).includes(k)).map(([k,v])=>conocido(k,v));
      for(const k of c.desconocidos||[])hechos.push({clave:k,estado:'desconocido',motivo:'por_consultar'});
      for(const k of c.conflictivos||[])hechos.push({clave:k,estado:'conflictivo',alternativas:[{valor:true},{valor:false}]});
      const s=ok(await post('sistemas',{nombre:'Caso '+c.id,descripcion:'Prueba aplicabilidad',alcance,hechos,motivo:'Caso editorial exacto'}),201);
      const r=ok(await post('requisitos',{alcance,objeto:{tipo:'sistema',id:s.id,version:s.version},ficha:{id:p.ficha.id,version:p.ficha.version},motivo:'Evaluar caso'}),201);
      const d=r.contenido.requisito.resultado.decision;assert.equal(d.estado,c.esperado.estado);assert.equal(d.cobertura.estado,c.esperado.cobertura);
      if(c.esperado.habilitaEvaluacion!==undefined)assert.equal(d.habilitaEvaluacion,c.esperado.habilitaEvaluacion);
      await persistido('requisitos',r);
    });
    await caso('concurrencia y fallo del histórico hacen rollback atómico',async()=>{
      let s=ok(await post('sujetos-funcionales',sujetoDatos('concurrente')),201);
      const rs=await Promise.all(['A','B'].map(n=>patch('sujetos-funcionales/'+s.id,{...sujetoDatos(n),version:s.version})));
      assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);s=ok(rs.find(r=>r.status===200));
      const antes=await cuenta(), original=E.create;E.create=async()=>{throw Error('Fallo sintético del log');};
      try { assert.equal((await patch('sujetos-funcionales/'+s.id,{...sujetoDatos('fallo'),version:s.version})).status,503); }
      finally { E.create=original; }
      assert.deepEqual(await cuenta(),antes);assert.equal(ok(await get('sujetos-funcionales/'+s.id)).version,s.version);
    });
    await caso('documento subyacente versionado: metadatos exactos, ajeno rechazado y nueva versión exige revisión',async()=>{
      const doc=await D.create({organizacion:a._id,titulo:'Instrumento FICTICIO',categoria_documental:'legal',version_actual:1,creado_por:ms.admin._id,clave_creacion:key(),huella_creacion:'a'.repeat(64)});
      const bytes=Buffer.from('%PDF-1.4\n% FIXTURE NO VALIDACION PDF\n%%EOF');
      const crearPDF=n=>VD.create({organizacion:a._id,documento:doc._id,numero:n,nombre:'fixture-v'+n+'.pdf',tamano:bytes.length,contenido:bytes,sha256:sha(bytes),creado_por:ms.admin._id,clave:key()});
      const pdf=await crearPDF(1), s=ok(await post('sujetos-funcionales',sujetoDatos('PDF')),201), r=recorridos[0];
      const datos={alcance,objeto:{tipo:'sistema',id:r.sis.id,version:r.sis.version},funcionId:'INSTRUMENTO_PDF',estado:'identificada',motivoDelEstado:'Documento delimitado',titulares:[{sujeto:s.referencia,delimitacion:'Función sintética'}],instrumentos:[{tipo:'version_documento',documentoId:String(doc._id),versionDocumentoId:String(pdf._id)}],periodo:{...periodo,hasta:null},motivo:'Prueba documental'};
      const d=ok(await post('designaciones',datos),201);await persistido('designaciones',d);
      assert.equal(d.contenido.designacion.instrumentos[0].sha256,sha(bytes));
      assert.equal((await post('designaciones',{...datos,funcionId:'AJENO',instrumentos:[{...datos.instrumentos[0],documentoId:String(b._id)}]})).status,404);
      await crearPDF(2);await D.updateOne({_id:doc._id},{$set:{version_actual:2}});
      assert.ok(ok(await get('designaciones/'+d.id)).vigencia.motivos.some(m=>m.startsWith('instrumento_designacion_con_nueva_version:')));
      assert.deepEqual(ok(await get('designaciones/'+d.id+'/versiones/1')).contenido,d.contenido);
      assert.equal((await post('designaciones',{...datos,funcionId:'OBSOLETO'})).status,409);
    });
    await caso('cambio de alcance exige nueva revisión y conserva todas las versiones históricas',async()=>{
      const {estado,esCertificacion,...datos}=clones(ar.contenido.alcance);datos.limites='Delimitación corregida de prueba';
      ok(await api('patch','/alcances/'+ar.id).set('Idempotency-Key',key()).send({version:ar.revision.numero,contextoVersion:prop.contextoVersion,propuestaHuella:prop.propuestaHuella,datos,motivo:'Corregir delimitación'}));
      for(const r of recorridos)assert.equal(ok(await get('requisitos/'+r.requisito.id)).estadoRevision.requiereRevision,true);
      for(const s of snapshots) assert.deepEqual(ok(await get(s.tipo+'/'+s.id+'/versiones/'+s.version)).contenido,s.contenido);
      informe.versionesHistoricasComprobadas=snapshots.length;
    });
    assert.equal(catalogoNormativo.listar().length,5);
    for(const p of paquetes)assert.deepEqual(catalogoNormativo.obtener(p.ficha.id),validarPaquete(p));
    return casos;
  } finally { await mongoose.disconnect(); }
}
async function main() {
  const bin=fs.realpathSync(process.env.MONGOD_TEST_BINARY||'');assert.ok(path.isAbsolute(bin)&&fs.statSync(bin).isFile());
  const {instancia}=local('scripts/run-gestion-unidades-mongo');
  let error;
  try { informe.replica=await instancia(bin,false,comprobar);informe.standalone=await instancia(bin,true,comprobar); }
  catch(e){error=e;informe.error=e.stack;}
  finally {
    informe.codigoDespues=hashes();informe.codigoSinCambios=JSON.stringify(informe.codigoAntes)===JSON.stringify(informe.codigoDespues);
    informe.finalizadoEn=new Date().toISOString();informe.ok=!error&&informe.hallazgos.length===0&&informe.codigoSinCambios;
    const out=path.resolve(process.env.NC_TEST_REPORT||path.join(__dirname,'resultado.json'));
    fs.writeFileSync(out,JSON.stringify(informe,null,2)+'\n');console.log('INFORME '+out);
  }
  if(error)throw error;
  console.log(JSON.stringify({replica:informe.replica,standalone:informe.standalone,hallazgos:informe.hallazgos,peticiones:informe.peticiones,codigoSinCambios:informe.codigoSinCambios}));
  if(!informe.ok)process.exitCode=2;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={comprobar,main};
