const nodemailer = require('nodemailer');
const { opcionesSmtp, errorCorreoSeguro } = require('./smtpTransport');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const smtpConfigurado = process.env.NC_MAIL_MODE !== 'disabled' &&
  Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

const transporter = smtpConfigurado
  ? nodemailer.createTransport(opcionesSmtp({
      host: SMTP_HOST, port: Number(SMTP_PORT),
      username: SMTP_USER, password: SMTP_PASS
    }))
  : null;

const REMITENTE = SMTP_FROM || SMTP_USER || 'no-reply@cyber-law.app';

async function enviarEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.warn('[mailer sin configurar] correo no enviado; configure SMTP');
    return { enviado: false, simulado: true };
  }
  try {
    await transporter.sendMail({ from: REMITENTE, to, subject, text, html });
  } catch (error) {
    throw errorCorreoSeguro(error);
  }
  return { enviado: true, simulado: false };
}

async function enviarEmailRecuperacion(to, resetUrl) {
  const subject = 'Recuperación de contraseña — NormativaCheck';
  const text =
    `Has solicitado restablecer tu contraseña en NormativaCheck.\n\n` +
    `Abre el siguiente enlace para elegir una nueva contraseña ` +
    `(válido durante 10 minutos):\n\n${resetUrl}\n\n` +
    `Si no has solicitado este cambio, ignora este mensaje: tu contraseña no se modificará.`;
  const html =
    `<p>Has solicitado restablecer tu contraseña en <strong>NormativaCheck</strong>.</p>` +
    `<p>Pulsa el siguiente enlace para elegir una nueva contraseña (válido durante 10 minutos):</p>` +
    `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
    `<p>Si no has solicitado este cambio, ignora este mensaje: tu contraseña no se modificará.</p>`;
  return enviarEmail({ to, subject, text, html });
}

module.exports = { enviarEmail, enviarEmailRecuperacion, smtpConfigurado };
