'use strict';
// Only dependency loading at image build; no database, account or real secret.
const crypto=require('node:crypto');
process.env.APP_URL=process.env.CORS_ORIGIN='https://10.77.77.1:9443';
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
for(const k of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM'])delete process.env[k];
require('../../utils/initSecrets');
const app=require('../../app').createApp();
if(app.locals.politicaSesiones!=='persistente'||require('mongoose').connection.readyState!==0)throw Error('IMAGE_POLICY');
console.log('PRIVATE_IMAGE_LOAD_OK; no Mongo connection');
