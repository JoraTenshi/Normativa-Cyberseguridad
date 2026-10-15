'use strict';
// HTTP y transacciones en Mongo temporal. Las reglas DEMO nunca salen de este archivo de pruebas.
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const assert = require('node:assert/strict'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), request = require('supertest'), ExcelJS = require('exceljs');
const O = require('../models/Organizacion'), M = require('../models/Membresia');
const U = require('../models/UnidadTrabajo'), P = require('../models/MembresiaUnidad');
const C = require('../models/ContextoEmpresa'), R = require('../models/RevisionContextoEmpresa');
const D = require('../models/DecisionAplicabilidad'), E = require('../models/EventoOrganizacion');
const Usuario = require('../models/Usuario'), Revoked = require('../models/RevokedToken');
const servicios = require('../services/decisionesAplicabilidad');
const defecto = { ...servicios };
const { crearCatalogo } = require('../services/catalogoAplicabilidad');
const { entrada } = require('../tests/fixtures/aplicabilidadContextual');
const { evaluarAplicabilidadContextual, reproducirSnapshot } = require('../services/aplicabilidadContextual');
const { referenciaTemporal } = require('../services/calendarioAplicabilidad');
const { verificarResultado } = require('../validation/decisionAplicabilidad');
const { createApp } = require('../app');
async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (url.hostname !== '127.0.0.1' || url.port === '27017' || !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))
    throw Error('Solo Mongo temporal');
  const resultados = [], caso = async (nombre, fn) => { await fn(); resultados.push(nombre); console.log('OK ' + nombre); };
  try {
    await mongoose.connect(uri, { dbName: nombreBD, serverSelectionTimeoutMS: 5000 });
    for (const modelo of [O, M, U, P, C, R, D, E, Usuario, Revoked]) await modelo.init();
    const [a,b] = await O.create([1,2].map(n => ({ razon_social: 'Empresa ficticia ' + n, pais: 'ES',
      identificador_tipo: 'NIF', identificador_valor: 'B0000000' + n, estado: 'activa' })));
    const miembros = {};
    for (const [nombre, org, rol] of [
      ['admin', a, 'administrador'], ['admin2', a, 'administrador'], ['coord', a, 'colaborador'],
      ['lector', a, 'consulta'], ['adminB', b, 'administrador']
    ]) {
      const usuario = new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({ _id: usuario, nombre: 'Persona ficticia', email: usuario + '@example.invalid',
        emailVerifiedAt: new Date(), sessionVersion: 0, rol: 'admin' });
      miembros[nombre] = await M.create({ usuario, organizacion: org._id, rol, estado: 'activa' });
    }
    const unidad = await U.create({ organizacion: a._id, nombre: 'Unidad ficticia', estado: 'activa' });
    await P.create({ unidad: unidad._id, membresia: miembros.coord._id, rol: 'coordinador', estado: 'activa' });
    const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' }), raiz = '/organizaciones/' + a._id;
    const cookie = nombre => 'cyberaudit_token=' + jwt.sign({
      id: String(miembros[nombre].usuario), jti: crypto.randomUUID(), sessionVersion: 0
    }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const api = (method, ruta, nombre = 'admin') => request(app)[method](
      ruta.startsWith('/organizaciones/') ? ruta : raiz + ruta).set('Cookie', cookie(nombre))
      .set('X-Requested-With', 'XMLHttpRequest');
    const key = () => crypto.randomUUID();
    const ok = (r,status=200) => { assert.equal(r.status,status,JSON.stringify(r.body)); return r.body.data; };
    let avance = 1500;
    const reloj = () => new Date(Date.now() + avance);
    const regla = entrada().regla;
    regla.revision.fecha = '2020-01-01T00:00:00.000Z';
    regla.fuentes[0].consultadaEn = '2020-01-01T00:00:00.000Z';
    regla.vigencia.desde = '2020-01-01T00:00:00.000Z';
    const usar = reglas => Object.assign(servicios, servicios.crearServicioDecisiones({ catalogo: crearCatalogo(reglas), reloj }));
    const crearContexto = (org = a, nombre = 'admin') => api('post', '/organizaciones/' + org._id + '/contexto', nombre)
      .set('Idempotency-Key',key()).send({ hechos: [
        { clave: 'a', estado: 'conocido', valor: true },
        { clave: 'b', estado: 'desconocido', motivo: 'por_consultar' }
      ], motivo: 'Descripción ficticia' });
    const payload = (vc = 1, vr = 1) => ({ versionContexto: vc, reglaId: regla.id, versionRegla: vr, motivo: 'Cálculo de prueba' });
    const guardar = (datos=payload(),k=key(),nombre='admin') =>
      api('post','/contexto/decisiones',nombre).set('Idempotency-Key',k).send(datos);
    const cambiar = async (version,valor) => ok(await api('patch','/contexto').set('Idempotency-Key',key())
      .send({ version, cambios: [{ clave: 'b', estado: 'conocido', valor }], motivo: 'Cambio de prueba' }));
    const contar = async () => [await D.countDocuments(), await E.countDocuments({accion:'decision_aplicabilidad_creada'})];
    if (standalone) {
      // Preparar únicamente fixtures por API de modelos, sin fingir que la escritura HTTP funcionó.
      const c = await C.create({organizacion:a._id,version_actual:1});
      await R.create({organizacion:a._id,contexto:c._id,numero:1,hechos:[],actor:miembros.admin.usuario,
        membresia_actor:miembros.admin._id,motivo:'Fixture standalone',sha256:'a'.repeat(64),
        clave_operacion:key(),huella_operacion:'b'.repeat(64)});
      usar([regla]);
      await caso('standalone rechaza cálculo sin guardar decisión, evento ni bloqueos',async()=>{
        const m = await M.findById(miembros.admin._id);
        assert.equal((await guardar()).status,503); assert.deepEqual(await contar(),[0,0]);
        assert.equal((await M.findById(m._id)).__v,m.__v);
      });
      return resultados;
    }
    await caso('sin sesión o con origen ajeno no hay cálculo',async()=>{
      assert.equal((await request(app).get(raiz+'/contexto/decisiones')).status,401);
      assert.equal((await api('post','/contexto/decisiones').set('Origin','https://ajeno.invalid').send(payload())).status,403);
      assert.deepEqual(await contar(),[0,0]);
    });
    await caso('catálogo real vacío: lectura explícita y ninguna regla DEMO disponible',async()=>{
      const catalogo = ok(await api('get','/contexto/reglas'));
      assert.deepEqual(catalogo.reglas,[]); assert.equal(catalogo.sinReglasPublicadas,true);
      ok(await crearContexto(),201);
      assert.equal((await guardar()).body.codigo,'REGLA_NO_DISPONIBLE');
      assert.deepEqual(await contar(),[0,0]);
    });
    usar([regla]);
    await caso('roles de unidad/global no conceden acceso a reglas ni decisiones',async()=>{
      for(const nombre of ['coord','lector','adminB']) {
        for(const ruta of ['/contexto/reglas','/contexto/decisiones','/contexto/decisiones/'+a._id])
          assert.equal((await api('get',ruta,nombre)).status,403);
        assert.equal((await guardar(payload(),key(),nombre)).status,403);
      }
      assert.equal(ok(await api('get','/contexto/reglas')).reglas[0].id,regla.id);
    });
    let primera, actual, kPrimera=key(), original;
    await caso('mismo envío concurrente guarda una sola decisión y evento con snapshot completo',async()=>{
      const rs=await Promise.all([1,2].map(()=>guardar(payload(),kPrimera)));
      assert.deepEqual(rs.map(r=>r.status).sort(),[200,201]);
      primera=rs[0].body.data; actual=primera; original=structuredClone(primera.snapshot);
      assert.equal(primera.estado,'pendiente_de_determinar');
      assert.equal(primera.decision.preguntasPendientes[0].clave,'b');
      assert.equal(primera.decision.revisionDecision,'automatica_orientativa');
      assert.deepEqual(await contar(),[1,1]);
      const reproducido=evaluarAplicabilidadContextual({organizacionId:String(a._id),contexto:primera.snapshot.contexto,
        regla:primera.snapshot.regla,fechaEvaluacion:primera.snapshot.fechaEvaluacion});
      assert.deepEqual(reproducido.decision,primera.decision);
      assert.equal(JSON.stringify(primera).includes('clave_operacion'),false);
      const r=await api('get','/contexto/decisiones/'+primera.id,'admin2');
      assert.match(r.headers['cache-control'],/no-store/);ok(r);
    });
    await caso('no acepta regla, decisión, fecha ni revisión impuestas desde HTTP',async()=>{
      for(const campo of ['regla','decision','snapshot','fechaEvaluacion','organizacionId','actor','estado','revision']) {
        assert.equal((await guardar({...payload(),[campo]:'falso'})).status,400);
      }
      assert.equal((await api('post','/contexto/decisiones').send(payload())).status,400);
      assert.equal((await guardar({...payload(),versionRegla:2})).body.codigo,'REGLA_DESACTUALIZADA');
      assert.equal((await guardar({...payload(),reglaId:'OTRA'})).body.codigo,'REGLA_NO_DISPONIBLE');
      assert.equal((await guardar({...payload(),motivo:'Otro'},kPrimera)).body.codigo,'CLAVE_REUTILIZADA');
      assert.equal((await guardar(payload(),kPrimera,'admin2')).body.codigo,'CLAVE_REUTILIZADA');
      assert.deepEqual(await contar(),[1,1]);
    });
    await caso('cambio de contexto señala revisión pendiente sin reescribir la decisión original',async()=>{
      await cambiar(1,false);
      const r=ok(await api('get','/contexto/decisiones/'+primera.id));
      assert.equal(r.revision.contextoCambiado,true);assert.equal(r.revision.requiereNuevaDecision,true);
      assert.deepEqual(r.snapshot,original);assert.deepEqual(r.decision,primera.decision);
      assert.equal((await guardar()).body.codigo,'VERSION_DESACTUALIZADA');
      const repetida=ok(await guardar(payload(),kPrimera));assert.equal(repetida.id,primera.id);
      assert.equal(repetida.repetida,true);assert.equal(repetida.revision.contextoCambiado,true);
      actual=ok(await guardar(payload(2)),201);
      assert.equal(actual.estado,'no_aplica');assert.equal(actual.anteriorId,primera.id);
      assert.equal(actual.numero,2);assert.equal(actual.versionContexto,2);
    });
    await caso('decisión sucesora con otro resultado conserva las anteriores',async()=>{
      await cambiar(2,true);actual=ok(await guardar(payload(3)),201);
      assert.equal(actual.estado,'aplica');assert.equal(actual.decision.habilitaEvaluacion,true);
      assert.equal(await D.countDocuments({contexto:actual.contextoId}),3);
      assert.deepEqual(ok(await api('get','/contexto/decisiones/'+primera.id)).snapshot,original);
    });
    await caso('mismo id/versión de regla con contenido distinto no genera sucesora',async()=>{
      const alterada=structuredClone(regla);alterada.fuentes[0].titulo='Alteración sin versión';
      usar([alterada]);
      assert.equal(ok(await api('get','/contexto/decisiones/'+actual.id)).revision.reglaCambiada,true);
      const antes=await contar();
      assert.equal((await guardar(payload(3))).body.codigo,'CALCULO_NO_DISPONIBLE');
      assert.deepEqual(await contar(),antes);usar([regla]);
    });
    let v2;
    await caso('nueva regla versionada exige selección actual y conserva la fuente anterior',async()=>{
      v2=structuredClone(regla);v2.version=2;v2.fuentes[0].version=2;v2.fuentes[0].titulo='Fuente ficticia v2';
      v2.vigencia.desde=new Date(reloj().getTime()+60000).toISOString();
      usar([regla,v2]);
      assert.equal(ok(await api('get','/contexto/decisiones/'+actual.id)).revision.reglaCambiada,true);
      assert.equal((await guardar(payload(3,1))).status,409);
      actual=ok(await guardar(payload(3,2)),201);
      assert.equal(actual.estado,'aplica');assert.equal(actual.temporal,'futura');
      assert.equal(actual.decision.habilitaEvaluacion,false);
      assert.equal(actual.snapshot.regla.fuentes[0].version,2);
      assert.equal(ok(await api('get','/contexto/decisiones/'+primera.id)).snapshot.regla.fuentes[0].version,1);
    });
    await caso('cambio de periodo por paso del tiempo se indica sin mutar el snapshot',async()=>{
      const anterior=actual, copia=structuredClone(actual.snapshot);
      avance+=120000;
      const r=ok(await api('get','/contexto/decisiones/'+actual.id));
      assert.equal(r.temporal,'futura');assert.equal(r.revision.periodoCambiado,true);
      assert.deepEqual(r.snapshot,copia);
      actual=ok(await guardar(payload(3,2)),201);
      assert.equal(actual.temporal,'en_periodo');assert.equal(actual.anteriorId,anterior.id);
    });
    await caso('regla retirada o desaparecida bloquea nuevos cálculos pero deja leer/reintentar historia',async()=>{
      for(const reglas of [[regla,{...v2,version:3,estado:'retirada'}],[]]) {
        usar(reglas);const r=ok(await api('get','/contexto/decisiones/'+actual.id));
        assert.equal(r.revision.reglaDisponible,false);
        assert.equal((await guardar(payload(3,2))).body.codigo,'REGLA_NO_DISPONIBLE');
        assert.equal(ok(await guardar(payload(),kPrimera)).id,primera.id);
      }
      usar([regla,v2]);
    });
    await caso('cálculos distintos concurrentes conservan ambas decisiones y secuencia',async()=>{
      const base=actual.numero;
      const rs=await Promise.all(['A','B'].map(m=>guardar({...payload(3,2),motivo:'Cálculo '+m})));
      const ds=rs.map(r=>ok(r,201)).sort((x,y)=>x.numero-y.numero);
      assert.deepEqual(ds.map(d=>d.numero),[base+1,base+2]);
      assert.equal(ds[1].anteriorId,ds[0].id);actual=ds[1];
    });
    await caso('fallo de evento revierte decisión y contadores auxiliares',async()=>{
      const antes=await contar(), m=await M.findById(miembros.admin._id), o=await O.findById(a._id);
      const fn=E.create;E.create=async()=>{throw Error('Fallo sintético');};
      try{assert.equal((await guardar(payload(3,2))).status,503);}finally{E.create=fn;}
      assert.deepEqual(await contar(),antes);
      assert.equal((await M.findById(m._id)).__v,m.__v);assert.equal((await O.findById(o._id)).__v,o.__v);
    });
    await caso('paginación estable, filtros cerrados y resúmenes sin snapshot',async()=>{
      const r=ok(await api('get','/contexto/decisiones?limite=2&reglaId='+regla.id));
      assert.equal(r.decisiones.length,2);assert.ok(r.decisiones.every(d=>!d.snapshot&&!d.decision));
      const r2=ok(await api('get','/contexto/decisiones?limite=2&antes='+r.paginacion.siguienteAntes));
      assert.ok(r2.decisiones.every(d=>d.numero<r.paginacion.siguienteAntes));
      for(const q of ['limite=101','antes=0','reglaId[$ne]=x','estado=aplica','limite=2&limite=3'])
        assert.equal((await api('get','/contexto/decisiones?'+q)).status,400);
      assert.equal((await api('get','/contexto/decisiones/no-id')).status,400);
      assert.equal((await api('get','/contexto/decisiones/'+new mongoose.Types.ObjectId())).status,404);
    });
    await caso('aislamiento empresarial por URL, id y listado',async()=>{
      ok(await crearContexto(b,'adminB'),201);
      assert.equal((await api('get','/organizaciones/'+b._id+'/contexto/decisiones/'+actual.id,'adminB')).status,404);
      assert.equal((await api('get','/contexto/decisiones/'+actual.id,'adminB')).status,403);
      assert.deepEqual(ok(await api('get','/organizaciones/'+b._id+'/contexto/decisiones','adminB')).decisiones,[]);
    });
    await caso('historial de decisiones admin con filtros y exportaciones CSV/XLSX',async()=>{
      const q='?categoria=decisiones_aplicabilidad&reglaId='+regla.id+'&decisionId='+actual.id;
      const r=ok(await api('get','/actividad'+q));assert.equal(r.eventos.length,1);
      assert.equal(r.eventos[0].decisionId,actual.id);assert.equal(r.eventos[0].unidadId,null);
      assert.equal(r.eventos[0].despues.regla_id,regla.id);
      assert.equal(JSON.stringify(r).includes('hechosUtilizados'),false);
      assert.deepEqual(ok(await api('get','/actividad'+q,'coord')).eventos,[]);
      assert.equal((await api('get','/actividad?normativaId='+a._id)).body.codigo,'FILTRO_NO_IMPLEMENTADO');
      const csv=await api('get','/actividad/exportar'+q+'&formato=csv&columnas=decisionId,reglaId');
      assert.equal(csv.status,200);assert.equal(csv.headers['x-export-rows'],'1');assert.match(csv.text,/DEMO_CONDICION/);
      const xlsx=await api('get','/actividad/exportar'+q+'&formato=xlsx&columnas=decisionId,reglaId').buffer(true)
        .parse((res,fn)=>{const partes=[];res.on('data',x=>partes.push(x));res.on('end',()=>fn(null,Buffer.concat(partes)));});
      assert.equal(xlsx.status,200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(xlsx.body);
      assert.equal(wb.getWorksheet('Actividad').getCell('A2').value,actual.id);
    });
    await caso('suspensión del admin bloquea también reintentos históricos',async()=>{
      await M.updateOne({_id:miembros.admin._id},{$set:{estado:'suspendida'}});
      try{
        assert.equal((await api('get','/contexto/decisiones/'+actual.id)).status,403);
        assert.equal((await guardar(payload(),kPrimera)).status,403);
      }finally{await M.updateOne({_id:miembros.admin._id},{$set:{estado:'activa'}});}
    });
    await caso('revocación durante consulta descarta el snapshot ya leído',async()=>{
      const fn=D.findOne;
      D.findOne=function(...args){const q=fn.apply(this,args),exec=q.exec;
        q.exec=async function(...params){const d=await exec.apply(this,params);
          await M.updateOne({_id:miembros.admin._id},{$set:{estado:'suspendida'}});return d;};return q;};
      try{const r=await api('get','/contexto/decisiones/'+actual.id);assert.equal(r.status,403);assert.equal(r.body.data,undefined);}
      finally{D.findOne=fn;await M.updateOne({_id:miembros.admin._id},{$set:{estado:'activa'}});}
    });
    await caso('índice único ausente falla cerrado sin escritura parcial',async()=>{
      const antes=await contar();await D.collection.dropIndex('decision_contexto_numero_unico');
      try{assert.equal((await guardar(payload(3,2))).status,503);}
      finally{await D.createIndexes();}assert.deepEqual(await contar(),antes);
    });
    await caso('decisión alterada no se entrega ni se usa de base para otra',async()=>{
      await D.collection.updateOne({_id:new mongoose.Types.ObjectId(actual.id)},{$set:{'resultado.decision.estado':'no_aplica'}});
      try{
        assert.equal((await api('get','/contexto/decisiones/'+actual.id)).status,503);
        assert.equal((await guardar(payload(3,2))).status,503);
      }finally{await D.collection.updateOne({_id:new mongoose.Types.ObjectId(actual.id)},{$set:{'resultado.decision.estado':actual.estado}});}
    });
    await caso('tipo incompatible de hecho no genera cálculo ni evento',async()=>{
      await cambiar(3,'true');const antes=await contar();
      assert.equal((await guardar(payload(4,2))).body.codigo,'CALCULO_NO_DISPONIBLE');
      assert.deepEqual(await contar(),antes);
    });
    await caso('cambio de contexto concurrente no produce una decisión con datos mezclados',async()=>{
      await cambiar(4,true);
      const [r]=await Promise.all([guardar(payload(5,2)),cambiar(5,false)]);
      assert.ok([201,409].includes(r.status),JSON.stringify(r.body));
      if(r.status===201){
        const d=ok(r,201), leida=ok(await api('get','/contexto/decisiones/'+d.id));
        assert.equal(d.versionContexto,5);assert.equal(d.estado,'aplica');
        assert.equal(leida.revision.contextoCambiado,true);assert.equal(leida.versionContextoActual,6);
      }else assert.equal(r.body.codigo,'VERSION_DESACTUALIZADA');
    });
    await caso('retroceso del reloj se indica y no genera una decisión cronológicamente incoherente',async()=>{
      const previo=avance, antes=await contar();avance=-86400000;
      try{
        const r=ok(await api('get','/contexto/decisiones/'+actual.id));
        assert.equal(r.revision.relojAnteriorAlCalculo,true);
        assert.equal(r.revision.requiereNuevaDecision,true);
        assert.equal((await guardar(payload(6,2))).body.codigo,'CALCULO_NO_DISPONIBLE');
        assert.deepEqual(await contar(),antes);
      }finally{avance=previo;}
    });
    let civil, calculoCivil, claveCivil = key();
    await caso('C2: transición v1 a v2 por HTTP preserva históricos y distingue fuera de cobertura', async()=>{
      civil = structuredClone(regla); civil.version = 3; civil.contratoVersion = 2;
      civil.vigencia = {estado:'definida',tipo:'fecha_civil',calendario:'gregoriano',jurisdiccion:'ES',
        zonaEvaluacion:'Europe/Madrid',desde:'2020-01-01',hasta:null};
      civil.cobertura = {descripcion:'Cobertura sintética por hecho a',condicion:{op:'eq',hecho:'a',valor:false}};
      civil.condicion = {op:'eq',hecho:'b',valor:true};
      usar([regla,v2,civil]);
      calculoCivil=ok(await guardar(payload(6,3),claveCivil),201);
      assert.equal(calculoCivil.cobertura.estado,'fuera_de_cobertura');
      assert.equal(calculoCivil.estado,'pendiente_de_determinar');
      assert.equal(calculoCivil.decision.traza,null); assert.equal(calculoCivil.habilitaEvaluacion,false);
      assert.equal(calculoCivil.snapshot.motorVersion,'aplicabilidad-contextual/2');
      assert.deepEqual(reproducirSnapshot(calculoCivil.snapshot).decision,calculoCivil.decision);
      assert.deepEqual(verificarResultado({decision:calculoCivil.decision,snapshot:calculoCivil.snapshot}).decision,calculoCivil.decision);
      assert.deepEqual(ok(await api('get','/contexto/decisiones/'+primera.id)).snapshot,original);
      assert.equal(ok(await api('get','/contexto/reglas')).reglas[0].contratoVersion,2);
      const listado=ok(await api('get','/contexto/decisiones?limite=1')).decisiones[0];
      assert.equal(listado.cobertura.estado,'fuera_de_cobertura'); assert.equal(listado.habilitaEvaluacion,false);
    });
    await caso('C2: reintento v2 guarda una sola fila y rechaza testigo/calendario del cliente',async()=>{
      const antes=await contar(); const r=ok(await guardar(payload(6,3),claveCivil));
      assert.equal(r.id,calculoCivil.id); assert.deepEqual(r.snapshot,calculoCivil.snapshot);
      for(const campo of ['referenciaTemporal','cobertura','zonaEvaluacion','contratoVersion'])
        assert.equal((await guardar({...payload(6,3),[campo]:'falso'})).status,400);
      assert.deepEqual(await contar(),antes);
    });
    await caso('C2: fuera del periodo de cobertura no cambia vigencia ni genera no_aplica',async()=>{
      civil={...structuredClone(civil),version:4};
      civil.cobertura.condicion.valor=true;
      const hoy=referenciaTemporal(civil,reloj().toISOString()).fechaCivil;
      const manana=new Date(Date.parse(hoy+'T12:00:00.000Z')+86400000).toISOString().slice(0,10);
      civil.cobertura.periodo={desde:manana,hasta:null,motivo:'Límite de prueba, no fecha legal'};
      usar([civil]);
      const fuera=ok(await guardar(payload(6,4)),201);
      assert.equal(fuera.temporal,'en_periodo'); assert.equal(fuera.cobertura.temporal,'fuera_de_periodo');
      assert.equal(fuera.estado,'pendiente_de_determinar'); assert.equal(fuera.decision.traza,null);
      const antes=avance;
      try {
        avance+=86400000;
        const lectura=ok(await api('get','/contexto/decisiones/'+fuera.id));
        assert.equal(lectura.revision.periodoCambiado,false);
        assert.equal(lectura.revision.coberturaPeriodoCambiado,true);
        assert.equal(lectura.revision.requiereNuevaDecision,true); assert.deepEqual(lectura.snapshot,fuera.snapshot);
        const dentro=ok(await guardar(payload(6,4)),201);
        assert.equal(dentro.cobertura.estado,'dentro_de_cobertura'); assert.equal(dentro.estado,'no_aplica');
        assert.equal(dentro.anteriorId,fuera.id);
      } finally {avance=antes;}
    });
    return resultados;
  } finally {Object.assign(servicios,defecto);await mongoose.disconnect();}
}
module.exports={comprobar};
