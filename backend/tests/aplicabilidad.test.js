const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.APP_URL = 'https://localhost';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { evaluarAplicabilidad, ESTADOS, REGLAS } = require('../services/aplicabilidad');
const { cargarNormativas } = require('../seed/seed');

const normativas = cargarNormativas();
const porId = Object.fromEntries(normativas.map(n => [n.id, n]));
const AHORA = new Date('2026-10-04T12:00:00Z');

// ── Casos de docs/aplicabilidad.md (la tabla del documento es la fuente) ─────
const NOMBRE_A_ID = {
  'RGPD': 'rgpd', 'LOPDPyGDD': 'lopdpygdd', 'ISO/IEC 27001': 'iso27001', 'ISO/IEC 27002': 'iso27002',
  'Cybersecurity Act': 'cybersecurity_act', 'ENS': 'ens', 'ENI': 'eni', 'NIS2': 'nis2',
  'LSSI-CE': 'lssi_ce', 'CRA': 'cra', 'Reglamento de IA': 'ia_act'
};

function casosDelDocumento() {
  const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'aplicabilidad.md'), 'utf8');
  const seccion = doc.split('## Casos de prueba')[1].split('\n## ')[0];
  return seccion.split('\n')
    .filter(l => /^\|\s*\d+\s*\|/.test(l))
    .map(l => {
      const [num, sector, tamano, nombre, estado, detalle] = l.split('|').slice(1, -1).map(c => c.trim());
      const vacio = v => (v === '—' ? undefined : v);
      return { num, sector: vacio(sector), tamano: vacio(tamano), id: NOMBRE_A_ID[nombre], nombre, estado, detalle };
    });
}

const casos = casosDelDocumento();

test('el documento tiene casos y todos nombran una normativa conocida', () => {
  assert.ok(casos.length >= 20);
  for (const c of casos) assert.ok(c.id, `caso ${c.num}: normativa "${c.nombre}" desconocida`);
});

for (const c of casos) {
  test(`caso ${c.num}: ${c.nombre} con sector=${c.sector ?? '—'} tamaño=${c.tamano ?? '—'} → ${c.estado}`, () => {
    const r = evaluarAplicabilidad(porId[c.id], { sector: c.sector, tamano: c.tamano }, AHORA);
    assert.equal(r.estado, c.estado);
    assert.equal(typeof r.motivo, 'string');
    assert.ok(r.motivo.length > 0);

    const faltan = c.detalle.match(/^faltan: (.+)$/);
    if (faltan) assert.deepEqual(r.faltan, faltan[1].split(',').map(s => s.trim()));
    const desde = c.detalle.match(/aplicable_desde (\S+)/);
    assert.equal(r.aplicable_desde, desde ? desde[1] : undefined);
  });
}

// ── Reglas generales ──────────────────────────────────────────────────────────
test('las 11 normativas del seed tienen regla propia', () => {
  for (const n of normativas) assert.ok(REGLAS[n.id], `falta regla para ${n.id}`);
});

test('con el perfil vacío ninguna normativa sale "no_aplica"', () => {
  for (const n of normativas) {
    assert.notEqual(evaluarAplicabilidad(n, {}, AHORA).estado, ESTADOS.NO_APLICA, n.id);
    assert.notEqual(evaluarAplicabilidad(n, undefined, AHORA).estado, ESTADOS.NO_APLICA, n.id);
  }
});

test('una normativa sin regla da "puede_aplicar" con motivo', () => {
  const r = evaluarAplicabilidad({ id: 'nueva_norma' }, { sector: 'privada', tamano: 'grande' }, AHORA);
  assert.equal(r.estado, ESTADOS.PUEDE_APLICAR);
  assert.match(r.motivo, /no hay una regla/);
});

test('aplicable_desde desaparece cuando la fecha ya ha pasado', () => {
  assert.equal(evaluarAplicabilidad(porId.cra, {}, new Date('2028-01-01')).aplicable_desde, undefined);
});

// ── Endpoint ──────────────────────────────────────────────────────────────────
const Normativa = require('../models/Normativa');
const Usuario = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { createApp } = require('../app');
const { generateJti } = require('../middleware/auth');

const USER_ID = '64b000000000000000000001';
let organizacion;
Usuario.findById = () => ({
  organizacion,
  select: async () => ({ emailVerifiedAt: new Date(), sessionVersion: 0 })
});
RevokedToken.exists = async () => null;
Normativa.find = async () => normativas;

const app = createApp({ rateLimits: false });
const sesion = `cyberaudit_token=${jwt.sign(
  { id: USER_ID, sessionVersion: 0, jti: generateJti() }, process.env.JWT_SECRET, { expiresIn: '1h' }
)}`;

test('GET /normativas/aplicables con perfil vacío: devuelve las 11, con "perfil_incompleto" y no ocultas', async () => {
  organizacion = {};
  const res = await request(app).get('/normativas/aplicables').set('Cookie', sesion);
  assert.equal(res.status, 200);
  assert.equal(res.body.perfil_completo, false);
  assert.equal(res.body.data.length, 11);
  const ens = res.body.data.find(n => n.id === 'ens');
  assert.equal(ens.aplicabilidad.estado, 'perfil_incompleto');
  assert.deepEqual(ens.aplicabilidad.faltan, ['sector']);
});

test('GET /normativas/aplicables con perfil público completo: ENS, ENI y NIS2 aplican', async () => {
  organizacion = { sector: 'publica', tamano: 'grande' };
  const res = await request(app).get('/normativas/aplicables').set('Cookie', sesion);
  assert.equal(res.body.perfil_completo, true);
  const estado = id => res.body.data.find(n => n.id === id).aplicabilidad.estado;
  for (const id of ['ens', 'eni', 'nis2', 'rgpd']) assert.equal(estado(id), 'aplica', id);
});

test('GET /normativas/aplicables sin sesión da 401', async () => {
  assert.equal((await request(app).get('/normativas/aplicables')).status, 401);
});
