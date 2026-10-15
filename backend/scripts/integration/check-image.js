'use strict';
// Smoke test del paquete construido, no prueba de conexión o despliegue.
// Se ejecuta durante docker build como el mismo usuario no root de runtime.
function checkImage() {
  const crypto=require('node:crypto');
  process.env.APP_URL=process.env.CORS_ORIGIN='https://127.0.0.2:9443';
  process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
  process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
  for(const key of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'])delete process.env[key];
  require('../../utils/initSecrets');
  const {createApp}=require('../../app');
  const app=createApp();
  if(app.locals.politicaSesiones!=='persistente')throw Error('Política inesperada');
  if(require('mongoose').connection.readyState!==0)throw Error('El smoke test no debe conectar a Mongo');
  console.log('IMAGE_APP_LOAD_OK: aplicación y módulos cargados; sin conexión a Mongo.');
}
if(require.main===module)checkImage();
module.exports={checkImage};
