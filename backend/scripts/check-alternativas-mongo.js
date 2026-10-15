'use strict';
// Fixtures no normativas. Sustituye el catálogo SOLO en este proceso de prueba,
// con Mongo efímero; nunca publica la especificación editorial pendiente.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), request = require('supertest');
const Org = require('../models/Organizacion'), M = require('../models/Membresia'), U = require('../models/Usuario');
const H = require('../models/RegistroNormativo'), V = require('../models/VersionRegistroNormativo'), E = require('../models/EventoOrganizacion');
const D = require('../models/DocumentoOrganizacion'), VD = require('../models/VersionDocumento');
const servicios = require('../services/registrosNormativos'), originales = { ...servicios };
const { catalogoNormativo, crearCatalogoNormativo } = require('../services/catalogoNormativoC2');
const { createApp } = require('../app');
const { empresa, confirmacion, conocido } = require('../tests/fixtures/nexoSoftware');
const { paquete } = require('../tests/fixtures/alternativasRevision');
const RGPD = require('../catalogo/c2/RGPD28_FORMALIZACION_CONTENIDO.v3.json');
const p = paquete();
const catalogo = crearCatalogoNormativo([{ ficha: p.ficha, regla: p.regla }]);
async function comprobar({ uri, nombreBD, standalone = false }) {
  const u = new URL(uri);
  if (u.hostname !== '127.0.0.1' || u.port === '27017' || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) throw Error('Solo BD temporal');
  const casos = [], caso = async (n, fn) => { await fn(); casos.push(n); console.log('OK '+n); };
  const key = () => crypto.randomUUID(), ok = (r, estado = 200) => { assert.equal(r.status, estado, JSON.stringify(r.body)); return r.body.data; };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of Object.values(mongoose.models)) await modelo.init();
    const [a,b] = await Org.create([1,2].map(n => ({ razon_social: 'Empresa alternativa FICTICIA '+n, pais: 'ES', identificador_tipo:'NIF',identificador_valor:'C0000000'+n,estado:'activa' })));
    const ms = {};
    for (const [nombre, org, rol] of [['admin',a,'administrador'],['lector',a,'consulta'],['ajeno',b,'administrador']]) {
      const usuario = new mongoose.Types.ObjectId();
      await U.collection.insertOne({ _id:usuario,nombre:'Fixture',email:usuario+'@example.invalid',emailVerifiedAt:new Date(),sessionVersion:0,rol:'usuario' });
      ms[nombre] = await M.create({ usuario, organizacion:org._id, rol, estado:'activa' });
    }
    const app=createApp({ rateLimits:false,politicaSesiones:'legado_pruebas' }), raiz='/organizaciones/'+a._id;
    const api=(m,r,n='admin')=>request(app)[m](raiz+r).set('Cookie','cyberaudit_token='+jwt.sign({id:String(ms[n].usuario),jti:key(),sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'30m'})).set('X-Requested-With','XMLHttpRequest');
    const post=(ruta,d,k=key(),n='admin')=>api('post','/normativa/'+ruta,n).set('Idempotency-Key',k).send(d);
    const patch=(ruta,d,k=key())=>api('patch','/normativa/'+ruta).set('Idempotency-Key',k).send(d);
    const get=(ruta,n='admin')=>api('get','/normativa/'+ruta,n);
    const cuenta=async()=>[await H.countDocuments(),await V.countDocuments(),await E.countDocuments({accion:/^normativa_/})];
    const sujetoDatos={tipo:'persona',nombre:'Persona ficticia externa',procedenciaOrganizativa:'Cliente público ficticio (declarado)',membresiaId:null,motivo:'Identidad organizativa, no cuenta'};
    if(standalone){
      await caso('standalone rechaza sujeto funcional sin registros/eventos parciales',async()=>{
        assert.equal((await post('sujetos-funcionales',sujetoDatos)).status,503);assert.deepEqual(await cuenta(),[0,0,0]);
      }); return casos;
    }
    assert.equal(catalogoNormativo.listar().length,2);
    Object.assign(servicios,servicios.crearServicioRegistros({ catalogo }));
    const op=ok(await api('post','/operaciones').set('Idempotency-Key',key()).send({nombre:'Operación ficticia',descripcion:'Solo prueba',hechos:Object.entries(RGPD.casosAplicabilidad.base).map(([k,v])=>conocido(k,v)),motivo:'Fixture'}),201);
    const perfil=empresa();perfil.hechos.push(conocido('actividad_saas_operaciones',[op.operacion.id]));
    ok(await api('post','/contexto').set('Idempotency-Key',key()).send(perfil),201);
    const prop=ok(await api('get','/contexto/propuestas'));
    const mat=ok(await api('post','/contexto/materializaciones').set('Idempotency-Key',key()).send(confirmacion(prop)),201);
    const ar=ok(await api('get','/alcances/'+mat.alcances[0].id));
    const alcance={id:ar.id,version:ar.revision.numero,sha256:ar.revision.sha256};
    let sistemaDatos={nombre:'Sistema sintético',descripcion:'No normativo',alcance,hechos:p.entrada.contexto.hechos.map(({procedencia,...h})=>h),motivo:'Contexto de prueba'};
    let sis=ok(await post('sistemas',sistemaDatos),201);
    const objeto=()=>({tipo:'sistema',id:sis.id,version:sis.version});
    const reqDatos=()=>({alcance,objeto:objeto(),ficha:{id:p.ficha.id,version:p.ficha.version},motivo:'Contextualización sintética'});
    let req=ok(await post('requisitos',reqDatos()),201), s1,s2,des,ev,rv;
    const periodo={desde:'2026-10-14',hasta:'2026-10-15',calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'};
    const comprobacion={tipo:'comprobacion',metodo:'Acta examinada en fixture',realizadaEn:'2026-10-14T12:00:00.000Z',resultado:'Constatación declarada',limitaciones:'Sin suficiencia jurídica automática'};
    await caso('sujetos estables no crean cuentas/permisos y mantienen procedencia declarada',async()=>{
      const antes=[await U.countDocuments(),await M.countDocuments()];
      const k=key(),rs=await Promise.all([post('sujetos-funcionales',sujetoDatos,k),post('sujetos-funcionales',sujetoDatos,k)]);
      assert.deepEqual(rs.map(r=>r.status).sort(),[200,201]);s1=ok(rs.find(r=>r.status===201),201);
      s2=ok(await post('sujetos-funcionales',sujetoDatos),201);assert.notEqual(s1.id,s2.id);
      assert.deepEqual([await U.countDocuments(),await M.countDocuments()],antes);
      assert.equal(s1.contenido.sujeto.membresiaId,null);
      for(const quien of ['lector','ajeno'])assert.equal((await post('sujetos-funcionales',sujetoDatos,key(),quien)).status,403);
      assert.equal((await post('sujetos-funcionales',{...sujetoDatos,membresiaId:String(ms.ajeno._id)})).status,404);
      assert.equal((await post('sujetos-funcionales',{...sujetoDatos,rol:'administrador'})).status,400);
    });
    let desDatos={alcance,objeto:objeto(),funcionId:'FUNCION_FICTICIA',estado:'identificada',motivoDelEstado:'Nombramientos declarados con delimitación',
      titulares:[],instrumentos:[comprobacion],periodo:{...periodo,hasta:null},motivo:'Alta de asignación funcional'};
    await caso('designación permite pluralidad delimitada e instrumento no PDF sin aprobar requisito',async()=>{
      desDatos.titulares=[{sujeto:s1.referencia,delimitacion:'Información A'},{sujeto:s2.referencia,delimitacion:'Servicio B'}];
      des=ok(await post('designaciones',desDatos),201);assert.equal(des.contenido.designacion.titulares.length,2);
      assert.equal(des.contenido.designacion.instrumentos[0].responsableRef,'membresia:'+ms.admin._id);
      assert.equal((await post('designaciones',desDatos)).status,409);
      assert.equal(ok(await get('requisitos/'+req.id)).estadoRevision.satisfaccionActual,'sin_revisar');
      assert.equal((await get('designaciones/'+des.id,'lector')).status,403);
      assert.equal((await get('sujetos-funcionales/'+s1.id,'ajeno')).status,403);
    });
    const evDatos=()=>({alcances:[alcance],tipo:'designacion_versionada',titulo:'Evidencia funcional sintética',procedencia:'Fixture',localizador:'Registro delimitado',periodo,
      soporte:{tipo:'designacion_versionada',referencia:des.referencia},motivo:'Vínculo exacto'});
    const genDatos={alcances:[alcance],tipo:'constatacion_revision',titulo:'Comprobación de prueba',procedencia:'Fixture',localizador:'Acta',periodo,soporte:comprobacion,motivo:'Evidencia declarada'};
    const gen=ok(await post('evidencias',genDatos),201);
    const review=(e=ev,ruta='NORMAL',resultado='favorable')=>({requisito:req.referencia,evidencias:[e.referencia],tipo:'interna',periodo,ruta:{id:ruta,motivo:'Selección explícita de prueba'},
      criterios:p.ficha.satisfaccion.rutas.find(r=>r.id===ruta).requiereTodos.map(id=>({criterioId:id,resultado,motivo:'Valoración sintética',evidenciaIds:[e.id],compatibilidad:{estado:resultado==='favorable'?'compatible':'desconocida',motivo:'Examen humano declarado'}})),conclusion:resultado,motivo:'Revisión sintética motivada'});
    await caso('revisión2 persiste ruta/criterios/guardas/designación exacta y conserva snapshot',async()=>{
      ev=ok(await post('evidencias',evDatos()),201);rv=ok(await post('revisiones',review()),201);
      assert.equal(rv.contenido.revision.schemaVersion,2);assert.equal(rv.contenido.revision.ruta.hechos[0].hecho.valor,true);
      assert.deepEqual(ok(await get('revisiones/'+rv.id)).contenido,rv.contenido);
      assert.equal(ok(await get('requisitos/'+req.id)).estadoRevision.satisfaccionActual,'favorable');
      const count=await cuenta();const mal=review();mal.criterios[0].compatibilidad.estado='en_conflicto';
      assert.equal((await post('revisiones',mal)).status,400);assert.deepEqual(await cuenta(),count);
      assert.equal((await post('revisiones',{...review(),ruta:{id:'EXENCION_MICRO',motivo:'Inventada'}})).status,400);
    });
    async function cambiarHecho(hecho){
      sistemaDatos={...sistemaDatos,hechos:[...sistemaDatos.hechos.filter(h=>h.clave!=='via_ordinaria'),hecho]};
      sis=ok(await patch('sistemas/'+sis.id,{...sistemaDatos,version:sis.version}));
      req=ok(await patch('requisitos/'+req.id,{...reqDatos(),version:req.version}));
    }
    await caso('hechos se editan por contexto versionado; alternativa posterior no reescribe revisión',async()=>{
      await cambiarHecho(conocido('via_ordinaria',false));
      assert.equal(ok(await get('requisitos/'+req.id)).estadoRevision.requiereRevision,true);
      assert.equal((await post('revisiones',review(gen))).status,400);
      const nueva=ok(await post('revisiones',review(gen,'ALTERNATIVA')),201);
      assert.equal(nueva.contenido.revision.ruta.hechos[0].hecho.valor,false);
      assert.equal(ok(await get('revisiones/'+rv.id)).contenido.revision.ruta.hechos[0].hecho.valor,true);
      assert.equal(ok(await get('sistemas/'+sis.id+'/versiones/1')).contenido.hechos.find(h=>h.clave==='via_ordinaria').valor,true);
    });
    for(const estado of ['desconocido','conflictivo']) await caso('HTTP hecho '+estado+' bloquea favorable y guarda no_determinado sin no_aplica',async()=>{
      const hecho=estado==='desconocido'?{clave:'via_ordinaria',estado,motivo:'no_sabe'}:{clave:'via_ordinaria',estado,alternativas:[{valor:true},{valor:false}]};
      await cambiarHecho(hecho);assert.equal(req.contenido.requisito.resultado.decision.estado,'aplica');
      assert.equal((await post('revisiones',review(gen,'ALTERNATIVA'))).status,400);
      assert.equal(ok(await post('revisiones',review(gen,'ALTERNATIVA','no_determinado')),201).contenido.revision.conclusion,'no_determinado');
    });
    await caso('cambio de sujeto/designación invalida evidencia y conserva datos de personas históricos',async()=>{
      s1=ok(await patch('sujetos-funcionales/'+s1.id,{...sujetoDatos,nombre:'Nombre corregido ficticio',version:s1.version}));
      const estado=ok(await get('evidencias/'+ev.id)).vigencia;assert.equal(estado.requiereRevision,true);
      assert.ok(estado.motivos.some(m=>m.startsWith('sujeto_designacion_modificado:')));
      assert.equal((await post('evidencias',evDatos())).status,409);
      desDatos={...desDatos,objeto:objeto(),titulares:[{sujeto:s1.referencia,delimitacion:'Información A'},{sujeto:s2.referencia,delimitacion:'Servicio B'}]};
      des=ok(await patch('designaciones/'+des.id,{...desDatos,version:des.version}));
      assert.equal(ok(await get('designaciones/'+des.id+'/versiones/1')).contenido.designacion.titulares[0].datosSujeto.nombre,sujetoDatos.nombre);
      assert.ok(ok(await get('evidencias/'+ev.id)).vigencia.motivos.some(m=>m.startsWith('designacion_modificada:')));
    });
    await caso('estado de conflicto es explícito, nuevas evidencias no lo convierten en favorable',async()=>{
      await cambiarHecho(conocido('via_ordinaria',true));
      desDatos={...desDatos,objeto:objeto(),estado:'en_conflicto',motivoDelEstado:'Conflicto declarado; no por haber dos personas'};
      des=ok(await patch('designaciones/'+des.id,{...desDatos,version:des.version}));
      ev=ok(await patch('evidencias/'+ev.id,{...evDatos(),version:ev.version}));
      assert.equal((await post('revisiones',review())).status,400);
      assert.equal(ok(await post('revisiones',review(ev,'NORMAL','no_determinado')),201).contenido.revision.conclusion,'no_determinado');
    });
    await caso('versionado concurrente y fallo del log no dejan cambios parciales',async()=>{
      const rs=await Promise.all(['A','B'].map(nombre=>patch('sujetos-funcionales/'+s2.id,{...sujetoDatos,nombre:'Nombre '+nombre,version:s2.version})));
      assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);s2=ok(rs.find(r=>r.status===200));
      desDatos={...desDatos,titulares:[{sujeto:s1.referencia,delimitacion:'Información A'},{sujeto:s2.referencia,delimitacion:'Servicio B'}]};
      const antes=await cuenta(), original=E.create;E.create=async()=>{throw Error('fallo sintético');};
      try{assert.equal((await patch('designaciones/'+des.id,{...desDatos,version:des.version})).status,503);}finally{E.create=original;}
      assert.deepEqual(await cuenta(),antes);assert.equal(ok(await get('designaciones/'+des.id)).version,des.version);
    });
    await caso('instrumento PDF exacto, documento posterior invalida y archivo ajeno se rechaza',async()=>{
      const doc=await D.create({organizacion:a._id,titulo:'Instrumento ficticio',categoria_documental:'legal',version_actual:1,creado_por:ms.admin._id,clave_creacion:key(),huella_creacion:'a'.repeat(64)});
      const bytes=Buffer.from('%PDF-1.4\n%%EOF');const pdf=await VD.create({organizacion:a._id,documento:doc._id,numero:1,nombre:'fixture.pdf',tamano:bytes.length,contenido:bytes,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),creado_por:ms.admin._id,clave:key()});
      const datos={...desDatos,funcionId:'FUNCION_PDF',instrumentos:[{tipo:'version_documento',documentoId:String(doc._id),versionDocumentoId:String(pdf._id)}]};
      const d=ok(await post('designaciones',datos),201);
      await D.updateOne({_id:doc._id},{$set:{version_actual:2}});
      assert.ok(ok(await get('designaciones/'+d.id)).vigencia.motivos.some(m=>m.startsWith('instrumento_designacion_con_nueva_version:')));
      assert.equal((await post('designaciones',{...datos,funcionId:'OTRA_PDF'})).status,409);
      assert.equal((await post('designaciones',{...datos,funcionId:'OTRA_PDF',instrumentos:[{...datos.instrumentos[0],documentoId:String(b._id)}]})).status,404);
    });
    await caso('histórico exportable y catálogo real siguen separados de fixtures',async()=>{
      const h=ok(await api('get','/actividad?categoria=normativa&registroNormativoId='+des.id));
      assert.ok(JSON.stringify(h).includes(des.id));
      assert.equal(catalogoNormativo.listar().length,2);assert.equal(catalogoNormativo.obtener(p.ficha.id),null);
      assert.equal((await get('designaciones?organizacionId='+b._id)).status,400);
      assert.equal((await get('designaciones/'+des.id+'/versiones','lector')).status,403);
    });
    return casos;
  } finally { Object.assign(servicios,originales); await mongoose.disconnect(); }
}
module.exports={comprobar};
