'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
process.env.APP_URL='https://localhost';
const request=require('supertest'),{createApp}=require('../app');
test('ENS enlarged parser and authentication cannot bypass 300-request global limiter',async()=>{
 const app=createApp(),route='/organizaciones/'+'a'.repeat(24)+'/normativa/categorizaciones-ens';
 for(let n=0;n<300;n++){
  const response=await request(app).post(route).set('X-Requested-With','XMLHttpRequest').send({});
  assert.equal(response.status,401);
  assert.equal(response.headers['ratelimit-policy'],'300;w=900');
 }
 const blocked=await request(app).post(route).set('X-Requested-With','XMLHttpRequest').send({});
 assert.equal(blocked.status,429);
 assert.ok(Number(blocked.headers['retry-after'])>0);
});
test('el límite específico de recuperación continúa en diez intentos',async()=>{
 const app=createApp();
 for(let n=0;n<10;n++){
  const response=await request(app).post('/auth/forgot-password')
   .set('X-Requested-With','XMLHttpRequest').send({email:'no-es-email'});
  assert.equal(response.status,400);
 }
 const blocked=await request(app).post('/auth/forgot-password')
  .set('X-Requested-With','XMLHttpRequest').send({email:'no-es-email'});
 assert.equal(blocked.status,429);
});
