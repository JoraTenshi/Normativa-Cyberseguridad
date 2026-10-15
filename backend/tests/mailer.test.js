const assert = require('node:assert/strict');
const test = require('node:test');
const nodemailer = require('nodemailer');

test('el correo de recuperación indica diez minutos en texto y HTML', async t => {
  const config = {
    SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587',
    SMTP_USER: 'cuenta-ficticia', SMTP_PASS: 'clave-ficticia',
    SMTP_FROM: 'no-reply@example.test'
  };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  const modulePath = require.resolve('../utils/mailer');
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[modulePath];
  });
  Object.assign(process.env, config);
  const sent = [];
  // Intercepta el transporte antes de cargar mailer: no abre conexiones SMTP.
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async mail => { sent.push(mail); }
  }));
  delete require.cache[modulePath];
  const { enviarEmailRecuperacion } = require('../utils/mailer');
  const url = 'https://localhost/reset-password#token=token-ficticio';
  const result = await enviarEmailRecuperacion('destino@example.test', url);
  assert.deepEqual(result, { enviado: true, simulado: false });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'destino@example.test');
  for (const content of [sent[0].text, sent[0].html]) {
    assert.match(content, /válido durante 10 minutos/);
    assert.doesNotMatch(content, /30 minutos/);
    assert.ok(content.includes(url));
  }
});
