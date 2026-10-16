'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
process.env.APP_URL='https://localhost';
const request=require('supertest'),{createApp}=require('../app');
test('ENS enlarged parser and authentication cannot bypass global request limiter',async()=>{
 const app=createApp(),route='/organizaciones/'+'a'.repeat(24)+'/normativa/categorizaciones-ens';
 for(let n=0;n<100;n++)assert.equal((await request(app).post(route).set('X-Requested-With','XMLHttpRequest').send({})).status,401);
 assert.equal((await request(app).post(route).set('X-Requested-With','XMLHttpRequest').send({})).status,429);
});
