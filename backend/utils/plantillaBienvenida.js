'use strict';

function escaparHtml(valor) {
  const entidades = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(valor).replace(/[&<>"']/g, caracter => entidades[caracter]);
}

function urlHttps(valor) {
  const url = new URL(valor);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('El enlace debe utilizar HTTPS sin credenciales.');
  }
  return url;
}

function crearPlantillaBienvenida(nombre, enlaceVerificacion, opciones = {}) {
  const enlace = urlHttps(enlaceVerificacion);
  const app = urlHttps(opciones.appUrl || enlace.origin);
  if (app.search || app.hash || app.origin !== enlace.origin) {
    throw new Error('El acceso y la confirmación deben pertenecer a la misma instalación.');
  }
  const vigenciaHoras = opciones.vigenciaHoras ?? 24;
  if (!Number.isSafeInteger(vigenciaHoras) || vigenciaHoras < 1 || vigenciaHoras > 168) {
    throw new Error('Vigencia de confirmación inválida.');
  }
  const acceso = app.toString().replace(/\/$/, '') + '/auth';
  const enlaceValidado = enlace.toString();
  const nombreSeguro = escaparHtml(nombre);
  const enlaceSeguro = escaparHtml(enlaceValidado);
  const accesoSeguro = escaparHtml(acceso);
  const subject = 'NormativaCheck | Confirma tu dirección de correo';
  const text = `Hola, ${nombre}:

Se ha solicitado crear una cuenta de NormativaCheck con esta dirección. Para completar el registro, confirma tu correo:

Confirmar mi correo: ${enlaceValidado}

Este enlace es personal, de un solo uso y caduca en ${vigenciaHoras} horas. Si solicitas otro enlace, utiliza el más reciente. Si ha caducado, puedes solicitar uno nuevo desde la pantalla de acceso.

Después de confirmar el correo, inicia sesión con tu contraseña en esta misma instalación:
${acceso}

Si la instalación es privada, necesitas la conexión autorizada (por ejemplo, WireGuard) y la confianza del certificado configuradas. Recibir este correo no proporciona acceso a la red privada.

Confirmar el correo no inicia sesión automáticamente ni concede acceso a una organización. El Workspace mostrará únicamente los espacios y permisos que tengas autorizados. Si tienes verificación en dos pasos activada, también se te pedirá ese código al iniciar sesión.

Si no has solicitado esta cuenta, ignora este mensaje. No compartas el enlace ni tu contraseña.

El equipo de NormativaCheck`;
  const html = `<div style="font-family:Arial,sans-serif;color:#173d32;line-height:1.6;max-width:640px;margin:0 auto;padding:28px;background:#fafbf7">
  <h1 style="font-size:24px">Confirma tu correo en NormativaCheck</h1>
  <p>Hola, ${nombreSeguro}:</p>
  <p>Se ha solicitado crear una cuenta con esta dirección. Para completar el registro, confirma tu correo.</p>
  <p><a href="${enlaceSeguro}" style="display:inline-block;padding:12px 20px;background:#28664f;color:#fff;text-decoration:none;border-radius:6px">Confirmar mi correo</a></p>
  <p>Este enlace es personal, de un solo uso y caduca en <strong>${vigenciaHoras} horas</strong>. Si solicitas otro enlace, utiliza el más reciente. Si ha caducado, puedes solicitar uno nuevo desde la pantalla de acceso.</p>
  <p>Después de confirmar el correo, <a href="${accesoSeguro}">inicia sesión en esta misma instalación</a> con tu contraseña.</p>
  <p>Si la instalación es privada, necesitas la conexión autorizada (por ejemplo, WireGuard) y la confianza del certificado configuradas. Recibir este correo no proporciona acceso a la red privada.</p>
  <p>Confirmar el correo no inicia sesión automáticamente ni concede acceso a una organización. El Workspace mostrará únicamente los espacios y permisos que tengas autorizados. Si tienes verificación en dos pasos activada, también se te pedirá ese código al iniciar sesión.</p>
  <p>Si no has solicitado esta cuenta, ignora este mensaje. No compartas el enlace ni tu contraseña.</p>
  <p>El equipo de NormativaCheck</p>
</div>`;
  return { subject, text, html };
}

module.exports = { crearPlantillaBienvenida };
