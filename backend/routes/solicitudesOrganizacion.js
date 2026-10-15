'use strict';
const express = require('express');
const {requireAuth} = require('../middleware/auth');
const servicio = require('../services/solicitudesOrganizacion');
const router = express.Router();
// No elegir política desde cliente ni aceptar la compatibilidad JWT de pruebas.
router.use(['/me/altas-capacidades','/me/solicitudes-organizacion','/plataforma/solicitudes-organizacion'],
  (req,res,next)=>{res.set('Cache-Control','private, no-store');next();},requireAuth,(req,res,next)=>{
  if(!req.claveSesion)return res.status(401).json({ok:false,codigo:'SESION_NO_VALIDA',error:'Se requiere una sesión persistente completa.'});
  next();
});
const wrap=fn=>async(req,res)=>{try{res.json({ok:true,data:await fn(req)});}catch(e){
  const conocido=e instanceof servicio.ErrorAlta;
  res.status(conocido?e.status:503).json({ok:false,codigo:conocido?e.codigo:'ALTAS_NO_DISPONIBLES',error:conocido?e.message:'La gestión de altas no está disponible temporalmente.'});
}};
function sinQuery(req){if(Object.keys(req.query).length)throw new servicio.ErrorAlta('DATOS_INVALIDOS');}
router.get('/me/altas-capacidades',wrap(req=>{sinQuery(req);return servicio.capacidades(req.claveSesion);}));
for(const [prefijo,admin] of [['/me/solicitudes-organizacion',false],['/plataforma/solicitudes-organizacion',true]]){
  router.get(prefijo,wrap(req=>servicio.listar(req.claveSesion,req.query,admin)));
  router.get(prefijo+'/:id',wrap(req=>{sinQuery(req);return servicio.obtener(req.claveSesion,req.params.id,admin);}));
}
const escritura=accion=>wrap(req=>{sinQuery(req);return servicio.escribir({acceso:req.claveSesion,clave:req.get('Idempotency-Key'),accion,solicitudId:req.params.id,body:req.body});});
router.post('/me/solicitudes-organizacion',escritura('crear'));
router.put('/me/solicitudes-organizacion/:id',escritura('corregir'));
router.post('/plataforma/solicitudes-organizacion/:id/decision',escritura('decidir'));
module.exports=router;
