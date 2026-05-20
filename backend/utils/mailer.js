const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const smtpConfigurado = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

const transporter = smtpConfigurado
  ? nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth:   { user: SMTP_USER, pass: SMTP_PASS }
    })
  : null;

const REMITENTE = SMTP_FROM || SMTP_USER || 'no-reply@cyber-law.app';

async function enviarEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.log('[mailer sin configurar] correo simulado');
    console.log(`   De:     ${REMITENTE}`);
    console.log(`   Para:   ${to}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   ----\n${text}\n   ----`);
    return { enviado: false, simulado: true };
  }
  await transporter.sendMail({ from: REMITENTE, to, subject, text, html });
  return { enviado: true, simulado: false };
}

async function enviarEmailRecuperacion(to, resetUrl) {
  const subject = 'Recuperación de contraseña — NormativaCheck';
  const text =
    `Has solicitado restablecer tu contraseña en NormativaCheck.\n\n` +
    `Abre el siguiente enlace para elegir una nueva contraseña ` +
    `(válido durante 30 minutos):\n\n${resetUrl}\n\n` +
    `Si no has solicitado este cambio, ignora este mensaje: tu contraseña no se modificará.`;
  const html =
    `<p>Has solicitado restablecer tu contraseña en <strong>NormativaCheck</strong>.</p>` +
    `<p>Pulsa el siguiente enlace para elegir una nueva contraseña (válido durante 30 minutos):</p>` +
    `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
    `<p>Si no has solicitado este cambio, ignora este mensaje: tu contraseña no se modificará.</p>`;
  return enviarEmail({ to, subject, text, html });
}

module.exports = { enviarEmail, enviarEmailRecuperacion, smtpConfigurado };
