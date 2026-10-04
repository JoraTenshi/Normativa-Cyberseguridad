const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';
process.env.CORS_ORIGIN = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const Licitacion = require('../models/Licitacion');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');

const RAIZ = path.join(__dirname, '..', '..');
const USER_ID = '507f1f77bcf86cd799439011';
const app = createApp({ rateLimits: false });

// ── Estado simulado de MongoDB ────────────────────────────────────────────────
let usuario;
let fallaLecturaRol;
test.beforeEach(() => {
  usuario = { _id: USER_ID, email: 'ana@example.test', emailVerifiedAt: new Date(), sessionVersion: 0, rol: 'usuario' };
  fallaLecturaRol = false;
});
Usuario.findById = () => ({
  select: async campos => {
    if (campos === 'rol' && fallaLecturaRol) throw new Error('MongoServerSelectionError');
    return usuario;
  }
});
RevokedToken.exists = async () => null;
RevokedToken.create = async () => ({});

const sesion = (extra = {}) => `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti(), ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' }
)}`;

// ── 1. Comprobación de origen (CSRF) ──────────────────────────────────────────
// POST /auth/logout con sesión válida: 200 si pasa la comprobación, 403 si no.
for (const [caso, cabeceras, esperado] of [
  ['Origin del frontend',                      { Origin: 'https://localhost' },                                    200],
  ['Origin ajeno',                             { Origin: 'https://evil.example' },                                 403],
  ['Origin ajeno aunque traiga X-Requested-With', { Origin: 'https://evil.example', 'X-Requested-With': 'XMLHttpRequest' }, 403],
  ['Origin parecido (sufijo)',                 { Origin: 'https://localhost.evil.example' },                       403],
  ['mismo host por http',                      { Origin: 'http://localhost' },                                     403],
  ['Origin: null sin cabecera',                { Origin: 'null' },                                                 403],
  ['Origin: null con X-Requested-With',        { Origin: 'null', 'X-Requested-With': 'XMLHttpRequest' },           200],
  ['sin Origin ni cabecera (formulario, curl)', {},                                                                403],
  ['sin Origin con X-Requested-With',          { 'X-Requested-With': 'XMLHttpRequest' },                           200],
  ['X-Requested-With con otro valor',          { 'X-Requested-With': 'fetch' },                                    403],
]) {
  test(`origen: ${caso} → ${esperado}`, async () => {
    const res = await request(app).post('/auth/logout').set('Cookie', sesion()).set(cabeceras);
    assert.equal(res.status, esperado);
    if (esperado === 403) assert.equal(res.body.code, 'ORIGEN_NO_PERMITIDO');
  });
}

test('origen: los métodos seguros no se bloquean (GET con Origin ajeno)', async () => {
  const res = await request(app).get('/').set('Origin', 'https://evil.example');
  assert.equal(res.status, 200);
});

test('origen: PUT y DELETE también se comprueban', async () => {
  assert.equal((await request(app).put('/me/organizacion').set('Cookie', sesion()).send({})).status, 403);
  assert.equal((await request(app).delete('/me').set('Cookie', sesion())).status, 403);
});

// ── 2. Cabeceras de Helmet en la API ──────────────────────────────────────────
test('helmet: cabeceras de seguridad en la API, con los mismos valores que nginx', async () => {
  const res = await request(app).get('/');
  assert.equal(res.headers['content-security-policy'], "default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'");
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(res.headers['strict-transport-security'], 'max-age=63072000; includeSubDomains');
  assert.equal(res.headers['x-powered-by'], undefined);
});

// ── 3. Rol de administrador ───────────────────────────────────────────────────
let llamadasScraper;
const fetchOriginal = global.fetch;
test.before(() => {
  global.fetch = async url => { llamadasScraper.push(String(url)); return { status: 202, json: async () => ({ ok: true }) }; };
});
test.after(() => { global.fetch = fetchOriginal; });
test.beforeEach(() => { llamadasScraper = []; });

const sync = cookie => {
  const req = request(app).post('/licitaciones/sync').set('X-Requested-With', 'XMLHttpRequest').send({ anio: 2026, mes: 9 });
  return cookie ? req.set('Cookie', cookie) : req;
};

test('sync: sin sesión 401 y no llama al scraper', async () => {
  assert.equal((await sync()).status, 401);
  assert.equal(llamadasScraper.length, 0);
});

test('sync: usuario normal 403 y no llama al scraper', async () => {
  const res = await sync(sesion());
  assert.equal(res.status, 403);
  assert.equal(llamadasScraper.length, 0);
});

test('sync: el rol se lee de la BD, no del token (un JWT con rol "admin" no basta)', async () => {
  const res = await sync(sesion({ rol: 'admin' }));
  assert.equal(res.status, 403);
  assert.equal(llamadasScraper.length, 0);
});

test('sync: administrador llega al scraper con los parámetros validados', async () => {
  usuario.rol = 'admin';
  const res = await sync(sesion());
  assert.equal(res.status, 202);
  assert.deepEqual(llamadasScraper, ['http://scraper:8001/sync?anio=2026&mes=9']);
});

test('sync: si falla la lectura del rol, 503 y no llama al scraper', async () => {
  usuario.rol = 'admin';
  fallaLecturaRol = true;
  const res = await sync(sesion());
  assert.equal(res.status, 503);
  assert.equal(llamadasScraper.length, 0);
});

test('rol: por defecto "usuario" y solo admite "usuario" o "admin"', () => {
  const base = { nombre: 'Ana', email: 'ana@example.test', password: 'x' };
  assert.equal(new Usuario(base).rol, 'usuario');
  assert.ok(new Usuario({ ...base, rol: 'root' }).validateSync().errors.rol);
});

test('rol: el registro no permite elegirlo', async () => {
  let creado;
  const findOne = Usuario.findOne, create = Usuario.create;
  Usuario.findOne = async () => null;
  Usuario.create = async datos => { creado = datos; return { _id: USER_ID, ...datos }; };
  try {
    const res = await request(app).post('/auth/register').set('X-Requested-With', 'XMLHttpRequest')
      .send({ nombre: 'Eva', email: 'eva@example.test', password: 'Prueba123', rol: 'admin' });
    assert.equal(res.status, 201);
    assert.equal('rol' in creado, false);
  } finally {
    Usuario.findOne = findOne; Usuario.create = create;
  }
});

test('rol: actualizar el perfil de la organización no permite cambiarlo', async () => {
  let actualizacion;
  const original = Usuario.findByIdAndUpdate;
  Usuario.findByIdAndUpdate = async (id, update) => { actualizacion = update; return usuario; };
  try {
    const res = await request(app).put('/me/organizacion').set('Cookie', sesion()).set('X-Requested-With', 'XMLHttpRequest')
      .send({ sector: 'publica', rol: 'admin', 'organizacion.rol': 'admin', $set: { rol: 'admin' } });
    assert.equal(res.status, 200);
    assert.deepEqual(actualizacion, { $set: { 'organizacion.sector': 'publica' } });
  } finally {
    Usuario.findByIdAndUpdate = original;
  }
});

// ── 4. GET /licitaciones: sin operadores ni regex del cliente ────────────────
let filtro;
Licitacion.countDocuments = async f => { filtro = f; return 0; };
Licitacion.find = () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) });

const listar = query => request(app).get('/licitaciones').query(query);

test('licitaciones: ?estado[$ne]=x no llega como operador a MongoDB', async () => {
  const res = await request(app).get('/licitaciones?estado[$ne]=x&anio[$gt]=1&q[$regex]=.*');
  assert.equal(res.status, 200);
  assert.deepEqual(filtro, {});
});

test('licitaciones: la búsqueda se escapa (una regex del cliente se busca como texto literal)', async () => {
  await listar({ q: '(a+)+$' });
  assert.equal(filtro.$or[0].titulo.$regex, '\\(a\\+\\)\\+\\$');
  assert.ok(new RegExp(filtro.$or[0].titulo.$regex).test('(a+)+$'));
});

test('licitaciones: la búsqueda se limita a 100 caracteres y los números deben ser enteros', async () => {
  await listar({ q: 'x'.repeat(500), anio: '2025', mes: '9x', estado: '  Adjudicada  ' });
  assert.equal(filtro.$or[0].titulo.$regex.length, 100);
  assert.equal(filtro.anio, 2025);
  assert.equal('mes' in filtro, false);
  assert.equal(filtro.estado, 'Adjudicada');
});

// ── 5. Configuración que no debe retroceder ──────────────────────────────────
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

test('nginx: CSP estricta en el servidor, sin unsafe-inline ni unsafe-eval', () => {
  const conf = leer('nginx/nginx.conf');
  const csp = conf.match(/add_header Content-Security-Policy\s+"([^"]+)"\s+always;/)?.[1];
  assert.ok(csp, 'falta la CSP');
  assert.doesNotMatch(csp, /unsafe-(inline|eval)/);
  for (const d of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
    assert.ok(csp.includes(d), `falta ${d}`);
  }
});

test('nginx: ningún location define add_header (perdería las cabeceras del servidor)', () => {
  const lineas = leer('nginx/nginx.conf').split('\n').map(l => l.replace(/#.*$/, ''));
  const pila = [];
  for (const [i, l] of lineas.entries()) {
    const bloque = l.match(/^\s*(\w+)[^{;]*\{/);
    if (bloque) pila.push(bloque[1]);
    if (/^\s*add_header\b/.test(l)) {
      assert.equal(pila.includes('location'), false, `add_header dentro de location en la línea ${i + 1}`);
      assert.equal(pila.at(-1), 'server', `add_header fuera de server en la línea ${i + 1}`);
    }
    for (const _ of l.match(/\}/g) ?? []) pila.pop();
  }
});

test('frontend: compatible con la CSP (sin script ni estilos en línea)', () => {
  assert.match(leer('frontend/Dockerfile'), /^ENV INLINE_RUNTIME_CHUNK=false$/m);
  const pendientes = [path.join(RAIZ, 'frontend', 'src')];
  while (pendientes.length) {
    const dir = pendientes.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) { pendientes.push(ruta); continue; }
      if (!/\.(jsx?|html)$/.test(e.name)) continue;
      const src = fs.readFileSync(ruta, 'utf8');
      assert.doesNotMatch(src, /<style[\s>]/, `${ruta}: <style> en línea`);
      assert.doesNotMatch(src, /dangerouslySetInnerHTML|\beval\(|new Function\(/, `${ruta}: código dinámico`);
    }
  }
  assert.match(leer('frontend/src/services/api.js'), /'X-Requested-With': 'XMLHttpRequest'/);
});

test('frontend: tras iniciar sesión solo se redirige a rutas internas', () => {
  const auth = leer('frontend/src/pages/Auth.jsx');
  assert.match(auth, /const from\s*=\s*esRutaInterna\(location\.state\?\.from\) \? location\.state\.from : '\/';/);
  const regex = auth.match(/esRutaInterna = destino =>\s*typeof destino === 'string' && (\/.+\/)\.test\(destino\);/)?.[1];
  assert.ok(regex, 'falta esRutaInterna');
  const esRutaInterna = d => typeof d === 'string' && new RegExp(regex.slice(1, -1)).test(d);
  for (const ok of ['/', '/settings', '/historial/64b0']) assert.equal(esRutaInterna(ok), true, ok);
  for (const malo of ['//evil.example', '/\\evil.example', 'https://evil.example', 'evil.example', '/a b', undefined]) {
    assert.equal(esRutaInterna(malo), false, String(malo));
  }
});
