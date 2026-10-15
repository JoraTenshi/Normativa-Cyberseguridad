'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const runtime = path.join(root, '.runtime/integration');
const names = ['mongo_root_password','mongo_app_password','mongo_keyfile','jwt_secret','totp_key'];
function openssl(args) { return execFileSync('openssl', args, { encoding:'utf8', stdio:['ignore','pipe','pipe'] }); }
function regular(file) { const s=fs.lstatSync(file); if (!s.isFile() || s.isSymbolicLink()) throw Error('Archivo inesperado: '+path.basename(file)); }
function validate() {
  for (const name of names) {
    const file=path.join(runtime,'secrets',name); regular(file);
    const text=fs.readFileSync(file,'utf8').trim();
    if (!(name==='mongo_keyfile' ? /^[A-Za-z0-9+/=]{1000,1024}$/ : /^[a-f0-9]{64}$/).test(text)) throw Error('Secreto inválido: '+name);
  }
  for (const name of ['ca.crt','ca.key','server.crt','server.key']) regular(path.join(runtime,'tls',name));
  openssl(['verify','-CAfile',path.join(runtime,'tls/ca.crt'),'-purpose','sslserver','-verify_ip','127.0.0.2',path.join(runtime,'tls/server.crt')]);
  openssl(['x509','-in',path.join(runtime,'tls/server.crt'),'-checkend','604800','-noout']);
  const pubCert=openssl(['x509','-in',path.join(runtime,'tls/server.crt'),'-pubkey','-noout']);
  const pubKey=openssl(['pkey','-in',path.join(runtime,'tls/server.key'),'-pubout']);
  if(pubCert!==pubKey) throw Error('Certificado y clave no coinciden');
}
function prepare() {
  if (root !== '/home/kali/Documents/practica3/normativa_integracion' || fs.realpathSync(root)!==root) throw Error('Solo se admite el árbol aislado de Kali');
  if (process.getuid()!==1000) throw Error('Preparar como kali, sin sudo; UID 1000 requerido por el contenedor Node');
  process.umask(0o077);
  const parent=path.dirname(runtime);
  if(!fs.existsSync(parent))fs.mkdirSync(parent,{mode:0o700});
  if(!fs.lstatSync(parent).isDirectory()||fs.lstatSync(parent).isSymbolicLink())throw Error('.runtime no es un directorio ordinario');
  if(fs.existsSync(runtime)) {
    if(fs.realpathSync(runtime)!==runtime)throw Error('Runtime inesperado');
    validate(); console.log('Preparación conservada: no se han regenerado claves ni contraseñas.'); return;
  }
  fs.mkdirSync(runtime,{mode:0o700});
  for(const dir of ['secrets','tls'])fs.mkdirSync(path.join(runtime,dir),{mode:0o700});
  for(const name of names)fs.writeFileSync(path.join(runtime,'secrets',name),
    crypto.randomBytes(name==='mongo_keyfile'?756:32).toString(name==='mongo_keyfile'?'base64':'hex')+'\n',{flag:'wx',mode:0o600});
  const tls=path.join(runtime,'tls');
  openssl(['req','-x509','-newkey','rsa:3072','-nodes','-days','365','-sha256',
    '-keyout',tls+'/ca.key','-out',tls+'/ca.crt','-subj','/CN=NormativaCheck Integracion Local',
    '-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  openssl(['req','-new','-newkey','rsa:2048','-nodes','-keyout',tls+'/server.key',
    '-out',tls+'/server.csr','-subj','/CN=127.0.0.2']);
  fs.writeFileSync(tls+'/server.ext','basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.2\n',{flag:'wx',mode:0o600});
  openssl(['x509','-req','-in',tls+'/server.csr','-CA',tls+'/ca.crt','-CAkey',tls+'/ca.key',
    '-set_serial','0x'+crypto.randomBytes(16).toString('hex'),'-out',tls+'/server.crt','-days','90','-sha256','-extfile',tls+'/server.ext']);
  validate();
  console.log('Secretos y TLS creados solo en .runtime/integration. Sin cambios en el almacén de confianza.');
}
try {
  prepare();
  console.log(openssl(['x509','-in',runtime+'/tls/ca.crt','-noout','-fingerprint','-sha256']).trim());
} catch (_) {
  console.error('Preparación detenida. Revisa ruta, UID, OpenSSL, permisos o certificado. Si hay una preparación parcial, no se sobrescribe ni se borra.');
  process.exitCode=1;
}
