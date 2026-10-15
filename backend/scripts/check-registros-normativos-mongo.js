'use strict';
// Datos sintéticos en Mongo propio temporal. Usa el paquete R3 real, no certifica
// que los documentos sintéticos satisfagan jurídicamente sus criterios.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), request = require('supertest');
const ExcelJS = require('exceljs');
const Org = require('../models/Organizacion'), M = require('../models/Membresia'), Usuario = require('../models/Usuario');
const H = require('../models/RegistroNormativo'), V = require('../models/VersionRegistroNormativo');
const E = require('../models/EventoOrganizacion'), D = require('../models/DocumentoOrganizacion'), VD = require('../models/VersionDocumento');
const { empresa, confirmacion, conocido } = require('../tests/fixtures/nexoSoftware');
const { huella } = require('../validation/aplicabilidadContextual');
const { createApp } = require('../app');
const ENS = require('../catalogo/c2/ENS_POLITICA_SEGURIDAD.v3.json');
const RGPD = require('../catalogo/c2/RGPD28_FORMALIZACION_CONTENIDO.v3.json');
const servicios = require('../services/registrosNormativos');
const defecto = { ...servicios };
async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || url.port === '27017' || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) throw Error('Solo Mongo temporal');
  const resultados = [], caso = async (nombre, fn) => { await fn(); resultados.push(nombre); console.log('OK ' + nombre); };
  const key = () => crypto.randomUUID(), ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body.data; };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of Object.values(mongoose.models)) await modelo.init();
    const [a, b] = await Org.create([1,2].map(n => ({ razon_social: 'Empresa C2 FICTICIA ' + n, pais: 'ES', identificador_tipo: 'NIF', identificador_valor: 'B0000000' + n, estado: 'activa' })));
    const miembros = {};
    for (const [nombre, org, rol] of [['admin',a,'administrador'],['segundo',a,'administrador'],['colaborador',a,'colaborador'],['consulta',a,'consulta'],['ajeno',b,'administrador']]) {
      const usuario = new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({ _id: usuario, nombre: 'Persona sintética', email: usuario + '@example.invalid', emailVerifiedAt: new Date(), sessionVersion: 0, rol: 'admin' });
      miembros[nombre] = await M.create({ usuario, organizacion: org._id, rol, estado: 'activa' });
    }
    const app = createApp({ rateLimits: false, politicaSesiones: 'legado_pruebas' }), raiz = '/organizaciones/' + a._id;
    const cookie = n => 'cyberaudit_token=' + jwt.sign({ id: String(miembros[n].usuario), jti: key(), sessionVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '30m' });
    const api = (m, r, n = 'admin') => request(app)[m](r.startsWith('/organizaciones/') ? r : raiz + r).set('Cookie', cookie(n)).set('X-Requested-With','XMLHttpRequest');
    const post = (ruta, d, k = key(), n = 'admin') => api('post', '/normativa/' + ruta, n).set('Idempotency-Key', k).send(d);
    const patch = (ruta, d, k = key()) => api('patch', '/normativa/' + ruta).set('Idempotency-Key', k).send(d);
    const get = ruta => api('get', '/normativa/' + ruta);
    const cuenta = async () => [await H.countDocuments(), await V.countDocuments(), await E.countDocuments({ accion: /^normativa_/ })];
    if (standalone) {
      await caso('standalone rechaza escritura C2 sin registros, eventos ni bloqueo parcial', async () => {
        const antes = (await M.findById(miembros.admin._id)).__v;
        assert.equal((await post('sistemas', { nombre:'Sistema',descripcion:'Fixture',alcance:{id:String(a._id),version:1,sha256:'a'.repeat(64)},hechos:[],motivo:'Prueba' })).status,503);
        assert.deepEqual(await cuenta(), [0,0,0]); assert.equal((await M.findById(miembros.admin._id)).__v,antes);
      }); return resultados;
    }
    await caso('catálogo R3 real, acceso administrador, anonimato y CSRF', async () => {
      assert.equal((await request(app).get(raiz + '/normativa/catalogo')).status,401);
      assert.equal((await api('post','/normativa/sistemas').set('Origin','https://ajeno.invalid').send({})).status,403);
      const cat = ok(await get('catalogo')); assert.equal(cat.paquetes.length,5);
      assert.deepEqual(cat.paquetes.filter(p=>p.ficha.schemaVersion===1).map(p=>p.ficha.criterios.length),[10,14]);
      for (const n of ['colaborador','consulta','ajeno']) assert.equal((await api('get','/normativa/catalogo',n)).status,403);
      assert.equal((await get('catalogo/DEMO')).status,404); assert.equal((await get('catalogo?regla=DEMO')).status,400);
    });
    await caso('responsables activos de la organización: paginación, identidad actual y acceso mínimo',async()=>{
      const primero=ok(await get('responsables?limite=2'));assert.equal(primero.responsables.length,2);
      assert.equal(primero.membresiaActualId,String(miembros.admin._id));assert.equal(primero.paginacion.hayMas,true);
      const segundo=ok(await get('responsables?limite=2&antes='+primero.paginacion.siguienteAntes));
      assert.equal(new Set([...primero.responsables,...segundo.responsables].map(m=>m.membresiaId)).size,4);
      assert.equal(JSON.stringify(primero).includes('@example.invalid'),false);
      for(const n of ['colaborador','consulta','ajeno'])assert.equal((await api('get','/normativa/responsables',n)).status,403);
      assert.equal((await get('responsables?organizacionId='+b._id)).status,400);
      await M.updateOne({_id:miembros.consulta._id},{$set:{estado:'suspendida'}});
      try{assert.ok(!ok(await get('responsables')).responsables.some(m=>m.membresiaId===String(miembros.consulta._id)));}
      finally{await M.updateOne({_id:miembros.consulta._id},{$set:{estado:'activa'}});}
    });
    const hechos = p => Object.entries(p.casosAplicabilidad.base).map(([k,v])=>conocido(k,v));
    const op = ok(await api('post','/operaciones').set('Idempotency-Key',key()).send({nombre:'Encargo SaaS sintético',descripcion:'Relación concreta FICTICIA',hechos:hechos(RGPD),motivo:'Fixture'}),201);
    const perfil = empresa(); perfil.hechos.push(conocido('actividad_saas_operaciones',[op.operacion.id]));
    ok(await api('post','/contexto').set('Idempotency-Key',key()).send(perfil),201);
    const propuesta = ok(await api('get','/contexto/propuestas'));
    const mat = ok(await api('post','/contexto/materializaciones').set('Idempotency-Key',key()).send(confirmacion(propuesta)),201);
    const alcances = await Promise.all(mat.alcances.map(x=>api('get','/alcances/'+x.id).then(ok)));
    const ar = alcances.find(x=>x.contenido.origen.operaciones.some(o=>o.id===op.operacion.id)); assert.ok(ar);
    const refAlcance = { id: ar.id, version: ar.revision.numero, sha256: ar.revision.sha256 };
    const sistemaDatos = { nombre:'Sistema ENS sintético',descripcion:'Sistema delimitado del servicio',alcance:refAlcance,hechos:hechos(ENS),motivo:'Declaración contextual' };
    let sistema, reqEns, reqRgpd, accion, evs, rv, datosRevision;
    await caso('sistema persiste con alcance real, hechos propios e idempotencia concurrente', async () => {
      const k=key(), rs=await Promise.all([post('sistemas',sistemaDatos,k),post('sistemas',sistemaDatos,k)]);
      assert.deepEqual(rs.map(x=>x.status).sort(),[200,201]); sistema=ok(rs.find(x=>x.status===201),201);
      assert.equal(sistema.contenido.hechos.length,6); assert.equal(sistema.contenido.alcance.id,ar.id);
      assert.ok(sistema.contenido.hechos.every(h=>h.procedencia.referencia==='membresia:'+miembros.admin._id));
      assert.equal((await post('sistemas',{...sistemaDatos,motivo:'Distinto'},k)).status,409);
      assert.deepEqual(ok(await get('sistemas/'+sistema.id)).contenido,sistema.contenido);
    });
    const reqDatos = (p,objeto) => ({ alcance:refAlcance,objeto,ficha:{id:p.ficha.id,version:p.ficha.version},motivo:'Contextualización explícita' });
    await caso('ENS por sistema y RGPD por operación: requisitos reales con snapshots y sin satisfacción automática', async () => {
      reqEns=ok(await post('requisitos',reqDatos(ENS,{tipo:'sistema',id:sistema.id,version:1})),201);
      reqRgpd=ok(await post('requisitos',reqDatos(RGPD,{tipo:'operacion',id:op.operacion.id,version:1})),201);
      for(const r of [reqEns,reqRgpd]) { assert.equal(r.contenido.requisito.resultado.decision.estado,'aplica'); assert.equal(r.estadoRevision.satisfaccionActual,'sin_revisar'); }
      assert.equal((await post('requisitos',reqDatos(ENS,{tipo:'sistema',id:sistema.id,version:1}))).status,409);
      assert.equal((await post('requisitos',reqDatos(ENS,{tipo:'operacion',id:op.operacion.id,version:1}))).status,422);
    });
    await caso('HTTP no recibe autores, permisos, snapshots ni resultados fabricados', async () => {
      for(const campo of ['actor','organizacionId','rol','resultado','permisos','fechaRevision'])
        assert.equal((await post('sistemas',{...sistemaDatos,[campo]:'inventado'})).status,400);
      assert.equal((await post('sistemas',{...sistemaDatos,alcance:{...refAlcance,version:999}})).status,409);
      assert.equal((await post('sistemas',{...sistemaDatos,alcance:{...refAlcance,id:String(b._id)}})).status,404);
    });
    await caso('dos requisitos pueden compartir una actuación; terminarla no aprueba ninguno', async () => {
      const d={titulo:'Preparar documentación',descripcion:'Actuación metodológica',estado:'terminada',requisitos:[reqEns.referencia,reqRgpd.referencia],responsableMembresiaId:String(miembros.admin._id),motivo:'Trabajo realizado'};
      accion=ok(await post('actuaciones',d),201); assert.equal(accion.contenido.relaciones.length,2);
      assert.equal(ok(await get('requisitos/'+reqEns.id)).estadoRevision.satisfaccionActual,'sin_revisar');
      const archivada=ok(await patch('actuaciones/'+accion.id,{...d,version:1,estado:'archivada'}));assert.equal(archivada.version,2);
      assert.equal((await patch('actuaciones/'+accion.id,{...d,version:1})).status,409);
      assert.equal(ok(await get('actuaciones/'+accion.id+'/versiones/1')).contenido.estado,'terminada');
    });
    // Nuevas fixtures en el día real de Madrid. No extender snapshots históricos.
    const diaMadrid=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
    const hoy=diaMadrid.format(new Date()),manana=new Date(Date.parse(hoy+'T12:00:00Z')+86400000).toISOString().slice(0,10);
    const periodo={desde:hoy,hasta:manana,calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'};
    // Buscar el límite civil evita fijar UTC+2 y romper la prueba al cambiar DST.
    function inicioDiaMadrid(dia){let a=Date.parse(dia+'T00:00:00Z')-86400000,b=a+172800000;while(a<b){const m=Math.floor((a+b)/2);if(diaMadrid.format(new Date(m))<dia)a=m+1;else b=m;}return a;}
    let doc,pdf;
    await caso('evidencias resuelven versiones PDF existentes y comprobaciones con autor servidor',async()=>{
      // Fixture de un PDF ya almacenado: este runner NO prueba la carga/antimalware.
      doc=await D.create({organizacion:a._id,titulo:'PDF FICTICIO',categoria_documental:'legal',version_actual:1,creado_por:miembros.admin._id,clave_creacion:key(),huella_creacion:'a'.repeat(64)});
      const bytes=Buffer.from('%PDF-1.4\n%fixture\n%%EOF');
      pdf=await VD.create({organizacion:a._id,documento:doc._id,numero:1,nombre:'fixture.pdf',tamano:bytes.length,contenido:bytes,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),creado_por:miembros.admin._id,clave:key()});
      const tipos=[...new Set([...ENS.ficha.criterios,...RGPD.ficha.criterios].map(c=>c.tiposEvidencia[0]))];evs=new Map();
      for(const tipo of tipos) {
        const datos={alcances:[refAlcance],tipo,titulo:'Evidencia sintética '+tipo,procedencia:'Caso de prueba, no acreditación',localizador:'Fixture',periodo,
          soporte:{tipo:'version_documento',documentoId:String(doc._id),versionDocumentoId:String(pdf._id)},motivo:'Vínculo exacto'};
        const e=ok(await post('evidencias',datos),201); assert.equal(e.contenido.evidencia.soporte.sha256,pdf.sha256);evs.set(tipo,{dto:e,datos});
      }
      const c=ok(await post('evidencias',{alcances:[refAlcance],tipo:'constatacion_revision',titulo:'Comprobación sintética',procedencia:'Prueba',localizador:'Registro',periodo,
        soporte:{tipo:'comprobacion',metodo:'Inspección sintética',realizadaEn:'2026-10-13T12:00:00.000Z',resultado:'Observación de prueba',limitaciones:'No acredita hechos reales'},motivo:'Registro'}),201);
      assert.equal(c.contenido.evidencia.soporte.responsableRef,'membresia:'+miembros.admin._id);
      const ejemplo=evs.values().next().value.datos;
      assert.equal((await post('evidencias',{...ejemplo,soporte:{...ejemplo.soporte,sha256:'f'.repeat(64)}})).status,400);
      assert.equal((await post('evidencias',{...ejemplo,soporte:{...ejemplo.soporte,documentoId:String(b._id)}})).status,404);
    });
    const payloadRevision = (req,p) => {
      const tipos=[...new Set(p.ficha.criterios.map(c=>c.tiposEvidencia[0]))];
      return { requisito:req.referencia,evidencias:tipos.map(t=>evs.get(t).dto.referencia),tipo:'interna',periodo,
        criterios:p.ficha.criterios.map(c=>({criterioId:c.id,resultado:'favorable',motivo:'Conclusión motivada FICTICIA del criterio '+c.id,evidenciaIds:[evs.get(c.tiposEvidencia[0]).dto.id]})),
        conclusion:'favorable',motivo:'Revisión interna sintética: no certificación ni dictamen profesional' };
    };
    await caso('listado documental devuelve ID real de versión utilizable por evidencia',async()=>{
      const listado=ok(await api('get','/documentos/'+doc._id+'/versiones'));
      assert.equal(listado.versiones[0].id,String(pdf._id));assert.equal(listado.versiones[0].numero,1);
      assert.equal(listado.versiones[0].sha256,pdf.sha256);
    });
    await caso('revisión motivada ENS se persiste una vez, con exactitud de versiones/revisor y estado releído',async()=>{
      datosRevision=payloadRevision(reqEns,ENS);const k=key();
      const rs=await Promise.all([post('revisiones',datosRevision,k),post('revisiones',datosRevision,k)]); assert.deepEqual(rs.map(r=>r.status).sort(),[200,201]);
      rv=ok(rs.find(r=>r.status===201),201);assert.equal(rv.contenido.revision.criterios.length,10);
      assert.equal(rv.contenido.revision.revisor.membresiaId,String(miembros.admin._id));assert.equal(rv.contenido.revision.esCertificacion,false);
      assert.equal(ok(await get('requisitos/'+reqEns.id)).estadoRevision.satisfaccionActual,'favorable');
      assert.deepEqual(ok(await get('revisiones/'+rv.id)).contenido,rv.contenido);
      assert.equal((await patch('revisiones/'+rv.id,datosRevision)).status,404);
    });
    await caso('revisión RGPD agrupa sus 14 criterios sin convertirlos en 14 requisitos',async()=>{
      const r=ok(await post('revisiones',payloadRevision(reqRgpd,RGPD)),201); assert.equal(r.contenido.revision.criterios.length,14);
      assert.equal((await H.countDocuments({tipo:'requisito'})),2);assert.equal(ok(await get('requisitos/'+reqRgpd.id)).estadoRevision.satisfaccionActual,'favorable');
    });
    await caso('fuera del periodo factual la API no proyecta favorable actual; histórico inmutable',async()=>{
      try {
        const inicio=inicioDiaMadrid(hoy),fin=inicioDiaMadrid(manana);
        for(const [instante,cubre] of [[inicio-1,false],[fin-1,true],[fin,false],[fin+6*86400000,false]]) {
          Object.assign(servicios,servicios.crearServicioRegistros({reloj:()=>new Date(instante)}));
          const r=ok(await get('requisitos/'+reqEns.id));
          assert.equal(r.estadoRevision.coberturaPeriodo.cubreFechaConsulta,cubre);
          assert.equal(r.estadoRevision.satisfaccionActual,cubre?'favorable':'requiere_revision');
          assert.equal(r.estadoRevision.conclusionHistorica,'favorable');
          const historica=ok(await get('revisiones/'+rv.id));assert.deepEqual(historica.contenido,rv.contenido);
          assert.equal(historica.estadoRevision.coberturaPeriodo.cubreFechaConsulta,cubre);
        }
      } finally { Object.assign(servicios,defecto); }
    });
    await caso('rechaza revisión incompleta, evidencia no examinada, versión obsoleta y permiso externo',async()=>{
      assert.equal((await post('revisiones',{...datosRevision,criterios:datosRevision.criterios.slice(1)})).status,400);
      assert.equal((await post('revisiones',{...datosRevision,requisito:{...datosRevision.requisito,version:9}})).status,409);
      for(const n of ['colaborador','consulta','ajeno']) {
        assert.equal((await post('revisiones',datosRevision,key(),n)).status,403);
        assert.equal((await api('get','/normativa/revisiones/'+rv.id,n)).status,403);
      }
      assert.equal((await post('revisiones',{...datosRevision,tipo:'externa'})).status,400);
    });
    await caso('evento y cambio son atómicos: fallo de log revierte revisión y puntero actual',async()=>{
      const antes=await cuenta(), original=E.create, puntero=(await H.findById(reqEns.id)).ultima_revision;
      E.create=async()=>{throw Error('Fallo de evento sintético');};
      try{assert.equal((await post('revisiones',datosRevision)).status,503);}finally{E.create=original;}
      assert.deepEqual(await cuenta(),antes);assert.equal(String((await H.findById(reqEns.id)).ultima_revision),String(puntero));
    });
    await caso('PDF posterior y evidencia modificada exigen revisión sin borrar conclusión histórica',async()=>{
      await D.updateOne({_id:doc._id},{$set:{version_actual:2}}); // simula publicación de siguiente PDF en fixture
      let r=ok(await get('requisitos/'+reqEns.id));assert.equal(r.estadoRevision.satisfaccionActual,'requiere_revision');assert.equal(r.estadoRevision.conclusionHistorica,'favorable');
      assert.equal((await post('revisiones',datosRevision)).status,409);
      await D.updateOne({_id:doc._id},{$set:{version_actual:1}});
      const t=ENS.ficha.criterios[0].tiposEvidencia[0], ev=evs.get(t);
      ev.dto=ok(await patch('evidencias/'+ev.dto.id,{...ev.datos,version:1,localizador:'Nuevo localizador'}));
      r=ok(await get('requisitos/'+reqEns.id));assert.equal(r.estadoRevision.satisfaccionActual,'requiere_revision');
      assert.ok(r.estadoRevision.motivos.some(m=>m.startsWith('evidencia_modificada')));
      assert.deepEqual(ok(await get('revisiones/'+rv.id)).contenido,rv.contenido);
    });
    await caso('edición del sistema exige nueva contextualización y conserva snapshot anterior',async()=>{
      const anterior=reqEns.contenido;
      sistema=ok(await patch('sistemas/'+sistema.id,{...sistemaDatos,version:1,descripcion:'Descripción aclarada'}));
      assert.equal(ok(await get('requisitos/'+reqEns.id)).estadoRevision.requiereRevision,true);
      assert.equal((await post('revisiones',payloadRevision(reqEns,ENS))).status,409);
      reqEns=ok(await patch('requisitos/'+reqEns.id,{...reqDatos(ENS,{tipo:'sistema',id:sistema.id,version:2}),version:1}));
      assert.equal(reqEns.version,2);assert.equal(reqEns.estadoRevision.satisfaccionActual,'requiere_revision');
      assert.deepEqual(ok(await get('requisitos/'+reqEns.id+'/versiones/1')).contenido,anterior);
      const nueva=ok(await post('revisiones',payloadRevision(reqEns,ENS)),201);assert.equal(nueva.estadoRevision.satisfaccionActual,'favorable');
    });
    await caso('guardia fuera de cobertura no es no_aplica ni habilita revisión',async()=>{
      const fuera=structuredClone(sistemaDatos);fuera.hechos.find(h=>h.clave==='cliente_sector_publico_es').valor=false;
      const sis=ok(await post('sistemas',fuera),201);
      const req=ok(await post('requisitos',reqDatos(ENS,{tipo:'sistema',id:sis.id,version:1})),201);
      assert.equal(req.contenido.requisito.resultado.decision.estado,'pendiente_de_determinar');
      assert.equal(req.contenido.requisito.resultado.decision.cobertura.estado,'fuera_de_cobertura');
      assert.equal((await post('revisiones',payloadRevision(req,ENS))).status,400);
    });
    await caso('histórico organizativo filtrable y exportación CSV incluyen referencias C2',async()=>{
      const r=ok(await api('get','/actividad?categoria=normativa&registroNormativoId='+reqEns.id));assert.equal(r.eventos.length,2);
      assert.ok(r.eventos.every(e=>e.registroNormativoId===reqEns.id));
      const csv=await api('get','/actividad/exportar?formato=csv&categoria=normativa&registroNormativoId='+reqEns.id+'&columnas=registroNormativoId,accion');
      assert.equal(csv.status,200);assert.match(csv.text||csv.body.toString(),new RegExp(reqEns.id));
    });
    await caso('exportación Excel incluye ID C2 como texto y respeta categoría y organización',async()=>{
      const x=await api('get','/actividad/exportar?formato=xlsx&categoria=normativa&registroNormativoId='+reqEns.id+'&columnas=registroNormativoId,accion')
        .buffer(true).parse((res,cb)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>cb(null,Buffer.concat(chunks)));res.on('error',cb);});
      assert.equal(x.status,200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(x.body);
      const sheet=wb.getWorksheet('Actividad');assert.equal(sheet.rowCount,3);assert.equal(sheet.getCell('A2').value,reqEns.id);
      assert.equal((await api('get','/actividad/exportar?formato=xlsx&categoria=normativa','ajeno')).status,403);
    });
    await caso('lista/histórico paginados, sin claves privadas y con no-store',async()=>{
      const l=await get('evidencias?limite=2');ok(l);assert.match(l.headers['cache-control'],/no-store/);assert.equal(l.body.data.registros.length,2);
      assert.equal(JSON.stringify(l.body).includes('clave_operacion'),false);
      assert.equal(ok(await get('requisitos/'+reqEns.id+'/versiones')).versiones.length,2);
      assert.equal((await get('evidencias?limite=100')).status,400);
    });
    await caso('revocación durante la lectura descarta la respuesta y bloquea reintentos',async()=>{
      const original=V.findOne;let inyectado=false;
      V.findOne=function(...args){const query=original.apply(this,args),exec=query.exec;query.exec=async function(...params){const r=await exec.apply(this,params);if(!inyectado){inyectado=true;await M.updateOne({_id:miembros.admin._id},{$set:{estado:'suspendida'}});}return r;};return query;};
      try{assert.equal((await get('requisitos/'+reqEns.id)).status,403);}finally{V.findOne=original;await M.updateOne({_id:miembros.admin._id},{$set:{estado:'activa'}});}
    });
    await caso('índices únicos son requisito y snapshot alterado falla cerrado',async()=>{
      const antes=await cuenta();await V.collection.dropIndex('registro_normativo_reintento_unico');
      try{assert.equal((await post('sistemas',sistemaDatos)).status,503);}finally{await V.createIndexes();}assert.deepEqual(await cuenta(),antes);
      const v=await V.findOne({registro:reqEns.id,numero:2});await V.collection.updateOne({_id:v._id},{$set:{sha256:'0'.repeat(64)}});
      try{assert.equal((await get('requisitos/'+reqEns.id)).status,503);}finally{await V.collection.updateOne({_id:v._id},{$set:{sha256:v.sha256}});}
    });
    await caso('dos ediciones concurrentes de la misma versión: una confirma y otra recibe409',async()=>{
      const d={...sistemaDatos,version:sistema.version};
      const rs=await Promise.all([patch('sistemas/'+sistema.id,{...d,descripcion:'Cambio A'}),patch('sistemas/'+sistema.id,{...d,descripcion:'Cambio B'})]);
      assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
      assert.equal(ok(await get('sistemas/'+sistema.id)).version,sistema.version+1);
      assert.equal(ok(await get('requisitos/'+reqEns.id)).estadoRevision.requiereRevision,true);
    });
    await caso('evidencia rechaza un PDF existente de otra empresa, no solo ID inventado',async()=>{
      const ajeno=await D.create({organizacion:b._id,titulo:'PDF ajeno sintético',categoria_documental:'legal',version_actual:1,creado_por:miembros.ajeno._id,clave_creacion:key(),huella_creacion:'b'.repeat(64)});
      const bytes=Buffer.from('%PDF-1.4\n%%EOF');
      const versionAjena=await VD.create({organizacion:b._id,documento:ajeno._id,numero:1,nombre:'ajeno.pdf',tamano:bytes.length,contenido:bytes,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),creado_por:miembros.ajeno._id,clave:key()});
      const datos=evs.values().next().value.datos;
      assert.equal((await post('evidencias',{...datos,soporte:{tipo:'version_documento',documentoId:String(ajeno._id),versionDocumentoId:String(versionAjena._id)}})).status,404);
    });
    return resultados;
  } finally { Object.assign(servicios,defecto); await mongoose.disconnect(); }
}
module.exports = { comprobar };
