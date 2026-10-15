'use strict';
// Solo fixture Nexo y Mongo temporal. Nunca carga .env ni conecta la BD habitual.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), request = require('supertest'), ExcelJS = require('exceljs');
const Org = require('../models/Organizacion'), Miembro = require('../models/Membresia'), Usuario = require('../models/Usuario');
const U = require('../models/UnidadTrabajo'), MU = require('../models/MembresiaUnidad');
const C = require('../models/ContextoEmpresa'), RC = require('../models/RevisionContextoEmpresa');
const A = require('../models/AlcanceEvaluacion'), R = require('../models/RevisionAlcance');
const Mat = require('../models/MaterializacionPerfil'), E = require('../models/EventoOrganizacion'), S = require('../models/Subespacio');
const { combinar } = require('../validation/contextoEmpresa');
const { huella } = require('../validation/aplicabilidadContextual');
const { empresa, confirmacion, conocido } = require('../tests/fixtures/nexoSoftware');
const { createApp } = require('../app');
async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || url.port === '27017' || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)) throw Error('Solo Mongo temporal');
  const resultados = [], caso = async (nombre, fn) => { await fn(); resultados.push(nombre); console.log('OK ' + nombre); };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of Object.values(mongoose.models)) await modelo.init();
    const [a,b] = await Org.create([1,2].map(n => ({ razon_social: n===1?'Nexo Software DEMO':'Otra empresa DEMO',
      pais:'ES',identificador_tipo:'NIF',identificador_valor:'B0000000'+n,estado:'activa' })));
    const miembros = {};
    for(const [nombre,org,rol] of [['admin',a,'administrador'],['segundo',a,'administrador'],['coord',a,'colaborador'],['lector',a,'consulta'],['adminB',b,'administrador']]) {
      const usuario=new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({_id:usuario,nombre:'Persona sintética',email:usuario+'@example.invalid',emailVerifiedAt:new Date(),sessionVersion:0,rol:'admin'});
      miembros[nombre]=await Miembro.create({usuario,organizacion:org._id,rol,estado:'activa'});
    }
    const unidad=await U.create({organizacion:a._id,nombre:'Unidad ficticia',estado:'activa'});
    await MU.create({unidad:unidad._id,membresia:miembros.coord._id,rol:'coordinador',estado:'activa'});
    const app=createApp({rateLimits:false,politicaSesiones:'legado_pruebas'}), raiz='/organizaciones/'+a._id;
    const cookie=n=>'cyberaudit_token='+jwt.sign({id:String(miembros[n].usuario),jti:crypto.randomUUID(),sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'15m'});
    const api=(m,r,n='admin')=>request(app)[m](r.startsWith('/organizaciones/')?r:raiz+r).set('Cookie',cookie(n)).set('X-Requested-With','XMLHttpRequest');
    const key=()=>crypto.randomUUID(), ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body.data;};
    const guardar=(d,k=key(),n='admin')=>api('post','/contexto/materializaciones',n).set('Idempotency-Key',k).send(d);
    const cuenta=async()=>[await S.countDocuments({organizacion:a._id}),await A.countDocuments(),await R.countDocuments(),await Mat.countDocuments(),await E.countDocuments()];
    let p,d,resultado,inicial,actual,k=key(),contextoVersion=1;
    if(standalone) {
      const ctx=await C.create({organizacion:a._id,version_actual:1});
      const hechos=combinar([],empresa().hechos,String(miembros.admin._id));
      await RC.create({organizacion:a._id,contexto:ctx._id,numero:1,hechos,actor:miembros.admin.usuario,
        membresia_actor:miembros.admin._id,motivo:'Fixture aislada standalone',sha256:huella(hechos),clave_operacion:key(),huella_operacion:'a'.repeat(64)});
      p=ok(await api('get','/contexto/propuestas'));d=confirmacion(p);
      await caso('standalone rechaza materialización sin espacios, revisiones, eventos ni bloqueos parciales',async()=>{
        const m=await Miembro.findById(miembros.admin._id);assert.equal((await guardar(d)).status,503);
        assert.deepEqual(await cuenta(),[0,0,0,0,0]); assert.equal((await Miembro.findById(m._id)).__v,m.__v);
      });return resultados;
    }
    await caso('autenticación y CSRF antes de crear datos',async()=>{
      assert.equal((await request(app).get(raiz+'/contexto/propuestas')).status,401);
      assert.equal((await api('post','/contexto/materializaciones').set('Origin','https://ajeno.invalid').send({})).status,403);
      assert.equal((await api('get','/contexto/propuestas')).body.codigo,'CONTEXTO_NO_INICIADO');
    });
    await caso('perfil reutiliza ContextoEmpresa y genera tres propuestas con trazabilidad',async()=>{
      ok(await api('post','/contexto').set('Idempotency-Key',key()).send(empresa()),201);
      p=ok(await api('get','/contexto/propuestas'));d=confirmacion(p);
      assert.equal(p.espacios.length,3);assert.equal(p.candidatos.length,6);
      assert.equal(p.candidatos.find(c=>c.familia==='ENS').aplicabilidad,'pendiente_de_determinar');
      assert.equal(p.propuestaHuella,ok(await api('get','/contexto/propuestas')).propuestaHuella);
      assert.equal(await S.countDocuments(),0);assert.equal(await A.countDocuments(),0);
    });
    await caso('coordinador, lector y admin ajeno no leen ni materializan aunque su rol global sea admin',async()=>{
      for(const nombre of ['coord','lector','adminB']) {
        assert.equal((await api('get','/contexto/propuestas',nombre)).status,403);
        assert.equal((await guardar(d,key(),nombre)).status,403);
      }
    });
    await caso('cliente no falsifica estado, actor, reglas, licencia, organización o versión',async()=>{
      for(const campo of ['actor','organizacionId','estado','reglaPublicada','permisos']) assert.equal((await guardar({...d,[campo]:String(b._id)})).status,400);
      assert.equal((await guardar({...d,contextoVersion:999})).status,409);
      assert.equal((await guardar({...d,propuestaHuella:'0'.repeat(64)})).status,409);
      assert.equal((await guardar({...d,confirmar:false})).status,400);
      assert.equal((await api('get','/contexto/propuestas?regla=otra')).status,400);
      assert.equal(await A.countDocuments(),0);
    });
    let existente;
    await caso('referencias ajenas y versiones de subespacio obsoletas se rechazan',async()=>{
      existente=ok(await api('post','/subespacios').set('Idempotency-Key',key()).send({nombre:'Servicio ya creado',tipo:'servicio',descripcion:'Reutilizable'}),201);
      const ajeno=ok(await api('post','/organizaciones/'+b._id+'/subespacios','adminB').set('Idempotency-Key',key()).send({nombre:'Ajeno',tipo:'servicio',descripcion:'No visible'}),201);
      const malo=structuredClone(d);malo.espacios[0]={actividadId:'web',existente:{id:ajeno.id,version:ajeno.version}};
      assert.equal((await guardar(malo)).status,404);
      malo.espacios[0].existente={id:existente.id,version:99};assert.equal((await guardar(malo)).status,409);
      d.espacios[0]={actividadId:'web',existente:{id:existente.id,version:existente.version}};
      d.alcances[0].actividadIds.push('producto');
    });
    await caso('fallo de evento revierte TODO el bloque sin duplicados ni cambios parciales',async()=>{
      const antes=await cuenta(), crear=E.create;
      E.create=async()=>{throw Error('Fallo sintético de evento');};
      try {assert.equal((await guardar(d)).status,503);}finally{E.create=crear;}
      assert.deepEqual(await cuenta(),antes);
    });
    await caso('confirmación concurrente misma clave: una creación y un reintento, muchos-a-muchos',async()=>{
      const rs=await Promise.all([guardar(d,k),guardar(d,k)]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,201]);
      resultado=ok(rs.find(r=>r.status===201),201);
      assert.equal(await S.countDocuments({organizacion:a._id}),3);assert.equal(await A.countDocuments(),3);
      assert.equal(await R.countDocuments(),3);assert.equal(await Mat.countDocuments(),1);
      const uno=ok(await api('get','/alcances/'+resultado.alcances[0].id));
      const dos=ok(await api('get','/alcances/'+resultado.alcances[1].id));
      assert.equal(uno.contenido.alcance.subespacios.length,2);
      assert.ok(uno.contenido.alcance.subespacios.some(s=>s.id===dos.contenido.alcance.subespacios[0].id));
      inicial=uno;actual=uno;assert.equal(uno.vigencia.necesitaRevision,false);
    });
    await caso('misma propuesta con otra clave o cuerpo distinto no duplica el caso',async()=>{
      const antes=await cuenta();assert.equal((await guardar(d)).status,409);
      assert.equal((await guardar({...d,motivo:'otro'},k)).status,409);
      assert.equal((await guardar(d,k,'segundo')).status,409);
      assert.equal(ok(await guardar(d,k)).repetida,true);assert.deepEqual(await cuenta(),antes);
    });
    await caso('alcances e histórico privados: tenant, roles y caché',async()=>{
      for(const n of ['coord','lector','adminB']) {
        for(const path of ['/alcances','/alcances/'+actual.id,'/alcances/'+actual.id+'/versiones','/alcances/'+actual.id+'/versiones/1'])
          assert.equal((await api('get',path,n)).status,403);
      }
      const r=await api('get','/alcances/'+actual.id,'segundo');ok(r);assert.match(r.headers['cache-control'],/no-store/);
      assert.ok(!JSON.stringify(r.body).includes('clave_operacion'));
      assert.equal(ok(await api('get','/alcances?limite=2')).alcances.length,2);
      assert.equal((await api('get','/alcances?limite=999')).status,400);
      assert.equal((await api('get','/alcances/'+a._id)).status,404);
    });
    await caso('eventos filtrados y exportados CSV/Excel; coordinador no ve eventos generales',async()=>{
      const filtro='?categoria=alcances&alcanceId='+actual.id;
      const ev=ok(await api('get','/actividad'+filtro));assert.equal(ev.eventos.length,1);
      assert.equal(ev.eventos[0].alcanceId,actual.id);assert.equal(ev.eventos[0].categoria,'alcances');
      assert.deepEqual(ok(await api('get','/actividad'+filtro,'coord')).eventos,[]);
      const csv=await api('get','/actividad/exportar'+filtro+'&formato=csv&columnas=alcanceId,accion');assert.equal(csv.status,200);assert.match(csv.text,new RegExp(actual.id));
      const xlsx=await api('get','/actividad/exportar'+filtro+'&formato=xlsx&columnas=alcanceId').buffer(true).parse((res,fn)=>{
        const ps=[];res.on('data',p=>ps.push(p));res.on('end',()=>fn(null,Buffer.concat(ps)));});
      assert.equal(xlsx.status,200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(xlsx.body);assert.equal(wb.getWorksheet('Actividad').getCell('A2').value,actual.id);
    });
    await caso('cambio de contexto preserva candidatos históricos y marca nueva revisión',async()=>{
      ok(await api('patch','/contexto').set('Idempotency-Key',key()).send({version:contextoVersion++,cambios:[conocido('publico_directo',true)],motivo:'Cambio sintético'}));
      const r=ok(await api('get','/alcances/'+actual.id));assert.deepEqual(r.contenido,inicial.contenido);assert.ok(r.vigencia.motivos.includes('contexto_modificado'));
      assert.equal(ok(await guardar(d,k)).repetida,true);assert.equal((await guardar(d)).status,409);
    });
    const datosAlcance=()=>{const {estado,esCertificacion,...datos}=actual.contenido.alcance;return datos;};
    const editar=async(datos,k2=key(),nombre='admin')=>api('patch','/alcances/'+actual.id,nombre).set('Idempotency-Key',k2).send(datos);
    await caso('editar alcance con versión antigua/actor falso falla; actualización concurrente tiene un ganador',async()=>{
      const nueva=ok(await api('get','/contexto/propuestas'));
      const payload={version:1,contextoVersion,propuestaHuella:nueva.propuestaHuella,datos:{...datosAlcance(),sistemas:['Sistema web sintético'],informacion:['Datos ficticios'],limites:'Entorno de prueba'},motivo:'Delimitar'};
      assert.equal((await editar({...payload,actor:String(miembros.admin.usuario)})).status,400);
      assert.equal((await editar(payload,key(),'coord')).status,403);
      const rs=await Promise.all([editar(payload),editar({...payload,motivo:'Concurrente'})]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
      actual=ok(rs.find(r=>r.status===200));assert.equal(actual.versionActual,2);
      assert.deepEqual(ok(await api('get','/alcances/'+actual.id+'/versiones/1')).contenido,inicial.contenido);
      assert.ok(ok(await api('get','/alcances/'+actual.id+'/versiones/1')).vigencia.motivos.includes('alcance_modificado'));
      assert.equal(ok(await api('get','/alcances/'+actual.id+'/versiones?limite=1')).siguienteAntes,2);
    });
    let op;
    await caso('operación específica contradice empresa sin sobrescribirla y queda vinculada a su versión',async()=>{
      op=ok(await api('post','/operaciones').set('Idempotency-Key',key()).send({nombre:'Contrato público sintético',descripcion:'Operación de prueba',subespacioId:null,
        hechos:[conocido('publico_directo',false)],motivo:'Contradicción deliberada'}),201);
      ok(await api('patch','/contexto').set('Idempotency-Key',key()).send({version:contextoVersion++,cambios:[conocido('actividad_web_operaciones',[op.operacion.id])],motivo:'Vincular operación'}));
      const nueva=ok(await api('get','/contexto/propuestas'));assert.equal(nueva.contradicciones.length,1);
      const payload={version:actual.versionActual,contextoVersion,propuestaHuella:nueva.propuestaHuella,datos:datosAlcance(),motivo:'Revisar con operación'};
      const idem=key();actual=ok(await editar(payload,idem));assert.equal(actual.contenido.origen.operaciones[0].version,1);
      assert.equal(ok(await editar(payload,idem)).repetida,true);
      assert.equal(actual.contenido.contradicciones[0].especifico.valor,false);
    });
    await caso('cambio de operación invalida propuesta previa y marca snapshot sin reescribir',async()=>{
      const anterior=structuredClone(actual.contenido),propuestaVieja=ok(await api('get','/contexto/propuestas'));
      ok(await api('patch','/operaciones/'+op.operacion.id).set('Idempotency-Key',key()).send({version:1,cambios:[conocido('publico_directo',true)],motivo:'Corrección sintética'}));
      const r=ok(await api('get','/alcances/'+actual.id));assert.deepEqual(r.contenido,anterior);assert.ok(r.vigencia.motivos.includes('operacion_modificada:'+op.operacion.id));
      assert.equal((await editar({version:actual.versionActual,contextoVersion,propuestaHuella:propuestaVieja.propuestaHuella,datos:datosAlcance(),motivo:'Antigua'})).status,409);
    });
    await caso('perfil no puede enlazar operaciones de otra organización',async()=>{
      const opB=ok(await api('post','/organizaciones/'+b._id+'/operaciones','adminB').set('Idempotency-Key',key()).send({nombre:'Operación B',descripcion:'Ajena',subespacioId:null,hechos:[],motivo:'Prueba'}),201);
      ok(await api('patch','/contexto').set('Idempotency-Key',key()).send({version:contextoVersion++,cambios:[conocido('actividad_saas_operaciones',[opB.operacion.id])],motivo:'Referencia inválida'}));
      assert.equal((await api('get','/contexto/propuestas')).status,404);
      // Una nueva respuesta inválida no debe hacer inaccesible el histórico previo.
      assert.deepEqual(ok(await api('get','/alcances/'+inicial.id+'/versiones/1')).contenido,inicial.contenido);
      ok(await api('patch','/contexto').set('Idempotency-Key',key()).send({version:contextoVersion++,cambios:[conocido('actividad_saas_operaciones',[])],motivo:'Corregir referencia'}));
    });
    await caso('revocación durante lectura descarta información cargada',async()=>{
      const original=R.findOne;
      R.findOne=function(...args){const query=original.apply(this,args),exec=query.exec;query.exec=async function(...params){const r=await exec.apply(this,params);await Miembro.updateOne({_id:miembros.admin._id},{$set:{estado:'suspendida'}});return r;};return query;};
      try{assert.equal((await api('get','/alcances/'+actual.id)).status,403);}finally{R.findOne=original;await Miembro.updateOne({_id:miembros.admin._id},{$set:{estado:'activa'}});}
      await Miembro.updateOne({_id:miembros.admin._id},{$set:{estado:'suspendida'}});
      try{assert.equal((await guardar(d,k)).status,403);}finally{await Miembro.updateOne({_id:miembros.admin._id},{$set:{estado:'activa'}});}
    });
    await caso('sin índice único real las escrituras fallan sin modificar nada',async()=>{
      const antes=await cuenta();await Mat.collection.dropIndex('perfil_propuesta_unica');
      try{assert.equal((await guardar(d,k)).status,503);}finally{await Mat.createIndexes();}
      assert.deepEqual(await cuenta(),antes);
    });
    await caso('corrupción de snapshot se detecta, no se entrega ni se sustituye silenciosamente',async()=>{
      const r=await R.findOne({alcance:actual.id,numero:actual.versionActual});
      await R.collection.updateOne({_id:r._id},{$set:{sha256:'0'.repeat(64)}});
      try{assert.equal((await api('get','/alcances/'+actual.id)).status,503);}finally{await R.collection.updateOne({_id:r._id},{$set:{sha256:r.sha256}});}
    });
    await caso('catálogo productivo vacío, sin reglas DEMO, puntuaciones ni aprobación por documentos',async()=>{
      const reglas=ok(await api('get','/contexto/reglas'));assert.deepEqual(reglas.reglas,[]);
      const r=ok(await api('get','/alcances/'+actual.id));assert.ok(r.contenido.candidatos.every(c=>c.satisfaccion==='no_evaluada'));
      assert.equal(r.contenido.catalogo.publicado,false);assert.equal(r.contenido.enlacesFuturos.metricas,'no_implementado');
    });
    return resultados;
  } finally {await mongoose.disconnect();}
}
module.exports={comprobar};
