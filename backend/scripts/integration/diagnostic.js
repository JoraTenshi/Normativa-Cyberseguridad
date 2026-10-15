'use strict';
const stages=new Set(['secretos','carga_aplicacion','conexion_mongodb','replica','indices','http']);
const codes=new Set(['MODULE_NOT_FOUND','EACCES','ENOENT','EADDRINUSE','ECONNREFUSED','ETIMEDOUT','ENOTFOUND']);
const types=new Set(['Error','TypeError','MongoServerError','MongoServerSelectionError','MongoNetworkError','MongooseError']);
function diagnostic(stage,error) {
  const safeStage=stages.has(stage)?stage:'desconocida';
  const code=codes.has(error?.code)?error.code:
    (Number.isSafeInteger(error?.code)&&error.code>=0&&error.code<1000000?String(error.code):'NO_CLASIFICADO');
  const type=types.has(error?.name)?error.name:'Error';
  // Nunca serializar error, message, stack, cause, URI o variables de entorno.
  return 'etapa='+safeStage+' tipo='+type+' codigo='+code;
}
module.exports={diagnostic};
