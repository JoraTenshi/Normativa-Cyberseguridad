'use strict';
// Solo QA: BD creada por instancia(), loopback, identidades sintéticas y caducidad.
// No se importa desde app/server, no lee .env ni admite URI de base de datos.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const readline = require('node:readline');
const { opcionesQA, rutaBuildQA } = require('./normativa-qa-options');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
const { instancia } = require('./run-gestion-unidades-mongo');
const mongoose = require('mongoose'), express = require('express');
const { createApp } = require('../app');
const Usuario = require('../models/Usuario'), Org = require('../models/Organizacion'), M = require('../models/Membresia');
const D = require('../models/DocumentoOrganizacion'), VD = require('../models/VersionDocumento');
const { guardarOperacion } = require('../services/operaciones');
const { guardarContexto } = require('../services/contextoEmpresa');
const ambitos = require('../services/alcancesEvaluacion');
const normativa = require('../services/registrosNormativos');
const { empresa, confirmacion, conocido } = require('../tests/fixtures/nexoSoftware');
const ENS = require('../catalogo/c2/ENS_POLITICA_SEGURIDAD.v3.json');
const RGPD = require('../catalogo/c2/RGPD28_FORMALIZACION_CONTENIDO.v3.json');
const password = 'Prueba-Normativa-4282!'; // pública y exclusiva de BD efímera
async function escenario(vacio = false) {
  if (!/^nc_org03_[a-f0-9]{24}$/.test(mongoose.connection.name)) throw Error('Solo BD propia del runner');
  const org = await Org.create({ razon_social:vacio ? 'Nexo C2 — INICIO VACÍO FICTICIO' : 'Nexo C2 — FICTICIA',pais:'ES',identificador_tipo:'NIF',identificador_valor:'B00000001',estado:'activa' });
  let admin;
  for (const [nombre, rol] of [['admin','administrador'],['lectura','consulta']]) {
    const user = await Usuario.create({ nombre:'Prueba '+nombre,email:nombre+'@example.invalid',password,emailVerifiedAt:new Date() });
    const m = await M.create({usuario:user._id,organizacion:org._id,rol,estado:'activa'});
    if (nombre === 'admin') admin={ usuarioId:String(user._id),organizacionId:String(org._id),membresiaId:String(m._id) };
  }
  if (vacio) return { organizacionId:admin.organizacionId,escenario:'empresa_vacia' };
  const k = () => crypto.randomUUID(), hechos = p => Object.entries(p.casosAplicabilidad.base).map(([clave,valor])=>conocido(clave,valor));
  const op = await guardarOperacion({...admin,clave:k(),datos:{nombre:'Encargo SaaS — FICTICIO',descripcion:'Caso sintético RGPD',hechos:hechos(RGPD),motivo:'QA aislada'}});
  const perfil = empresa();perfil.hechos.push(conocido('actividad_saas_operaciones',[op.operacion.id]));
  await guardarContexto({...admin,clave:k(),datos:perfil});
  const propuesta=await ambitos.obtenerPropuestas(admin);
  const mat=await ambitos.materializar({...admin,clave:k(),datos:confirmacion(propuesta)});
  let ar;
  for(const a of mat.alcances){const x=await ambitos.obtener({...admin,alcanceId:a.id});if(x.contenido.origen.operaciones.some(o=>o.id===op.operacion.id))ar=x;}
  if(!ar)throw Error('Falta alcance sintético');
  const ref={id:ar.id,version:ar.revision.numero,sha256:ar.revision.sha256};
  const alta=(tipo,datos)=>normativa.guardar({...admin,clave:k(),datos},tipo);
  const sistema=await alta('sistema',{nombre:'Sistema ENS — FICTICIO',descripcion:'Sistema delimitado de prueba',alcance:ref,hechos:hechos(ENS),motivo:'QA aislada'});
  const ens=await alta('requisito',{alcance:ref,objeto:{tipo:'sistema',id:sistema.id,version:1},ficha:{id:ENS.ficha.id,version:3},motivo:'QA aislada'});
  const rgpd=await alta('requisito',{alcance:ref,objeto:{tipo:'operacion',id:op.operacion.id,version:1},ficha:{id:RGPD.ficha.id,version:3},motivo:'QA aislada'});
  await alta('actuacion',{titulo:'Preparar documentación — FICTICIA',descripcion:'Acción compartida sin aprobación automática',estado:'en_curso',requisitos:[ens.referencia,rgpd.referencia],responsableMembresiaId:admin.membresiaId,motivo:'QA aislada'});
  const doc=await D.create({organizacion:org._id,titulo:'PDF SINTÉTICO QA',categoria_documental:'legal',version_actual:1,creado_por:admin.membresiaId,clave_creacion:k(),huella_creacion:'a'.repeat(64)});
  const bytes=Buffer.from('%PDF-1.4\n%Solo fixture de metadatos, no documento jurídico\n%%EOF');
  const pdf=await VD.create({organizacion:org._id,documento:doc._id,numero:1,nombre:'fixture.pdf',tamano:bytes.length,contenido:bytes,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),creado_por:admin.membresiaId,clave:k()});
  const hoy=require('../services/calendarioAplicabilidad').referenciaTemporal(ENS.regla,new Date().toISOString()).fechaCivil;
  const siguiente=new Date(Date.parse(hoy+'T12:00:00.000Z')+86400000).toISOString().slice(0,10);
  const periodo={desde:hoy,hasta:siguiente,calendario:'gregoriano',jurisdiccion:'ES',zonaEvaluacion:'Europe/Madrid'}, evidencias=new Map();
  for(const tipo of new Set(ENS.ficha.criterios.map(c=>c.tiposEvidencia[0]))) evidencias.set(tipo,await alta('evidencia',{
    alcances:[ref],tipo,titulo:'Evidencia FICTICIA '+tipo,procedencia:'Simulación QA',localizador:'Fixture',periodo,
    soporte:{tipo:'version_documento',documentoId:String(doc._id),versionDocumentoId:String(pdf._id)},motivo:'QA aislada'
  }));
  const revision=await alta('revision',{requisito:ens.referencia,evidencias:[...evidencias.values()].map(e=>e.referencia),tipo:'interna',periodo,
    criterios:ENS.ficha.criterios.map(c=>({criterioId:c.id,resultado:'favorable',motivo:'Conclusión FICTICIA para probar UI, no acreditación',evidenciaIds:[evidencias.get(c.tiposEvidencia[0]).id]})),
    conclusion:'favorable',motivo:'QA sintética de estados, no revisión jurídica real'});
  return {organizacionId:admin.organizacionId,alcanceId:ar.id,sistemaId:sistema.id,operacionId:op.operacion.id,requisitoEnsId:ens.id,requisitoRgpdId:rgpd.id,revisionId:revision.id};
}
async function main() {
  const opciones = opcionesQA(process.argv.slice(2));
  process.env.CORS_ORIGIN = opciones.origin;
  const bin=process.env.MONGOD_TEST_BINARY;
  if(!bin || !path.isAbsolute(bin) || !(await fs.stat(bin)).isFile())throw Error('MONGOD_TEST_BINARY absoluto requerido');
  const build=await fs.realpath(process.env.NC_C2_FRONT_BUILD || path.resolve(__dirname,'../../frontend/build'));
  const normal=path.resolve(__dirname,'../../frontend/build');
  rutaBuildQA(build,normal);
  await fs.access(path.join(build,'index.html'));
  await instancia(bin,false,async({uri,nombreBD})=>{
    const u=new URL(uri);if(u.hostname!=='127.0.0.1'||u.port==='27017'||!/^nc_org03_[a-f0-9]{24}$/.test(nombreBD))throw Error('BD externa rechazada');
    let server,lines,timer,terminar;
    try{
      await mongoose.connect(uri,{dbName:nombreBD,serverSelectionTimeoutMS:5000});
      for(const modelo of Object.values(mongoose.models))await modelo.init();
      const info=await escenario(opciones.empty), app=express(), caduca=Date.now()+45*60000;
      app.use((req,res,next)=>{
        if(!['localhost:'+opciones.port,'127.0.0.1:'+opciones.port].includes(req.get('host')))return res.status(403).json({ok:false,error:'Solo loopback QA'});
        if(Date.now()>=caduca)return res.status(503).json({ok:false,error:'QA caducada'});
        res.set('Cache-Control','no-store');next();
      });
      app.use('/api',createApp({rateLimits:false})); // Sesión real, sin login/rol de demo.
      app.use(express.static(build));app.get('*',(req,res)=>res.sendFile(path.join(build,'index.html')));
      server=await new Promise((resolve,reject)=>{const s=app.listen(opciones.port,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
      console.log('C2_QA_READY '+JSON.stringify({url:opciones.origin,...info,pid:process.pid,expiresAt:new Date(caduca).toISOString(),build,cuentas:['admin@example.invalid','lectura@example.invalid'],password,soloDatosSinteticos:true}));
      if(opciones.smoke){
        const base=opciones.origin;
        // http.request conserva Host explícito; fetch puede reemplazarlo por el de la URL.
        const hostAjeno=await new Promise((resolve,reject)=>{
          const request=require('node:http').request(base+'/',{headers:{Host:'ajeno.invalid'}},res=>{res.resume();resolve(res.statusCode);});
          request.once('error',reject);request.end();
        });
        if(hostAjeno!==403)throw Error('Host ajeno permitido: '+hostAjeno);
        const origenAjeno=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://ajeno.invalid'},body:'{}'});if(origenAjeno.status!==403)throw Error('Origen ajeno permitido');
        const anon=await fetch(base+'/api/organizaciones/'+info.organizacionId+'/normativa/catalogo');if(anon.status!==401)throw Error('Anonimato no bloqueado');
        const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest',Origin:base},body:JSON.stringify({email:'admin@example.invalid',password})});
        if(login.status!==200)throw Error('Login QA '+login.status);
        const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
        if(opciones.empty){
          const contexto=await fetch(base+'/api/organizaciones/'+info.organizacionId+'/contexto',{headers:{Cookie:cookie}});
          const contextoBody=await contexto.json();if(contexto.status!==404||contextoBody.codigo!=='CONTEXTO_NO_INICIADO')throw Error('Contexto vacío QA '+contexto.status);
          // La prueba de inicio no debe precargar siquiera un contexto vacío.
          for(const nombre of ['ContextoEmpresa','Operacion','AlcanceEvaluacion','RegistroNormativo','DocumentoOrganizacion']){
            if(await mongoose.model(nombre).countDocuments({organizacion:info.organizacionId}))throw Error('Fixture no vacía: '+nombre);
          }
          for(const [ruta,campo] of [['operaciones','operaciones'],['normativa/requisitos','registros'],['normativa/sistemas','registros']]){
            const r=await fetch(base+'/api/organizaciones/'+info.organizacionId+'/'+ruta,{headers:{Cookie:cookie}});
            const b=await r.json();if(r.status!==200||!Array.isArray(b.data?.[campo])||b.data[campo].length)throw Error('Listado vacío QA '+ruta+' '+r.status);
          }
          console.log('C2_QA_EMPTY_SMOKE_OK sesión real; sin contexto, operaciones, alcances, registros ni documentos; no navegador');
          return ['smoke QA empresa vacía'];
        }
        const result=await fetch(base+'/api/organizaciones/'+info.organizacionId+'/normativa/requisitos/'+info.requisitoEnsId,{headers:{Cookie:cookie}});
        const body=await result.json();if(result.status!==200||body.data?.estadoRevision?.satisfaccionActual!=='favorable')throw Error('Lectura QA '+result.status);
        console.log('C2_QA_SMOKE_OK sesión real y requisito persistente releído; no navegador');return ['smoke QA'];
      }
      console.log('Escribe stop para cerrar. Caduca en45min; los datos sintéticos desaparecen al terminar.');
      await new Promise(resolve=>{terminar=resolve;timer=setTimeout(resolve,45*60000);lines=readline.createInterface({input:process.stdin});lines.on('line',line=>{if(line.trim()==='stop')resolve();});process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
      return ['QA navegador cerrada'];
    } finally {
      clearTimeout(timer);lines?.close();if(terminar){process.removeListener('SIGTERM',terminar);process.removeListener('SIGINT',terminar);}
      if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await mongoose.disconnect();
    }
  });
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
