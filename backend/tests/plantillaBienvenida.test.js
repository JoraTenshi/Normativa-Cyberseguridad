'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearPlantillaBienvenida } = require('../utils/plantillaBienvenida');
const base = 'https://10.77.77.1:8443';
const link = `${base}/verify-email#token=${'a'.repeat(64)}`;

test('confirmación describe cuenta y acceso, no funciones normativas del producto anterior', () => {
  const mail = crearPlantillaBienvenida('Ana', link, { appUrl: base, vigenciaHoras: 48 });
  assert.match(mail.subject, /Confirma tu dirección/);
  for (const content of [mail.text, mail.html]) {
    assert.ok(content.includes(link));
    assert.ok(content.includes(`${base}/auth`));
    assert.match(content, /48 horas/);
    assert.match(content, /no inicia sesión automáticamente ni concede acceso a una organización/);
    assert.match(content, /WireGuard/);
    assert.match(content, /Si no has solicitado/);
    assert.doesNotMatch(content, /cuestionarios|ponderad|\bISO\b|\bINCIBE\b|\bLOPDGDD\b|\bRGPD\b|\bPDS\b|autoevaluación/i);
  }
});

test('HTML escapa el nombre y las URLs sin convertir datos en etiquetas', () => {
  const mail = crearPlantillaBienvenida('<img src=x onerror="alert(1)"> & Ana', `${link}&extra="x"`);
  assert.ok(mail.html.includes('&lt;img'));
  assert.doesNotMatch(mail.html, /<img|onerror="alert/);
  assert.ok(mail.html.includes('&amp;extra='));
});

test('solo permite HTTPS, sin credenciales y con una misma instalación para ambos enlaces', () => {
  for (const bad of ['http://example.test/verify', 'javascript:alert(1)', 'https://u:p@example.test/verify']) {
    assert.throws(() => crearPlantillaBienvenida('Ana', bad));
  }
  for (const appUrl of ['https://other.test', `${base}/?x=1`, `${base}/#token=x`]) {
    assert.throws(() => crearPlantillaBienvenida('Ana', link, { appUrl }));
  }
  for (const vigenciaHoras of [0, 169, '24', NaN]) {
    assert.throws(() => crearPlantillaBienvenida('Ana', link, { vigenciaHoras }));
  }
});
