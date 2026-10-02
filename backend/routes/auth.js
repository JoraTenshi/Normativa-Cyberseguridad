const express      = require('express');
const crypto       = require('crypto');
const bcrypt       = require('bcryptjs');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const speakeasy    = require('speakeasy');
const Usuario      = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const {
  enviarEmail,
  enviarEmailRecuperacion
} = require('../utils/mailer');

const {
  crearPlantillaBienvenida
} = require('../utils/plantillaBienvenida');

const {
  crearTokenVerificacionEmail,
  hashTokenVerificacionEmail
} = require('../utils/emailVerification');
const { readTotpSecret } = require('../utils/totpEncryption');

const { JWT_SECRET, JWT_EXPIRES, generateJti, requireAuth } = require('../middleware/auth');

const RESET_TTL_MS = 30 * 60 * 1000;
const emailVerificationTtlHours = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24);
if (!Number.isSafeInteger(emailVerificationTtlHours) || emailVerificationTtlHours < 1 || emailVerificationTtlHours > 168) {
  throw new Error('EMAIL_VERIFICATION_TTL_HOURS debe estar entre 1 y 168 horas');
}
const EMAIL_VERIFICATION_TTL_MS = emailVerificationTtlHours * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const appUrl = new URL(process.env.APP_URL || process.env.CORS_ORIGIN || 'https://localhost');
if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password || appUrl.search || appUrl.hash) {
  throw new Error('APP_URL debe ser una URL HTTPS pública sin credenciales, consulta ni fragmento');
}
const APP_URL = appUrl.toString().replace(/\/$/, '');

const hashResetToken = raw => crypto.createHash('sha256').update(raw).digest('hex');

const DUMMY_HASH = bcrypt.hashSync('cyberlaw_timing_equalizer', 12);

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const COOKIE_NAME = 'cyberaudit_token';
const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'strict'
};
const COOKIE_OPTIONS = { ...COOKIE_BASE_OPTIONS, maxAge: 24 * 60 * 60 * 1000 };

const PENDING_2FA_COOKIE   = 'cyberaudit_2fa_pending';
const PENDING_2FA_OPTIONS = { ...COOKIE_BASE_OPTIONS, maxAge: 5 * 60 * 1000 };

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, nombre: user.nombre, sessionVersion: user.sessionVersion ?? 0, jti: generateJti() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function signPending2fa(user) {
  return jwt.sign({ pending2fa: true, id: user._id.toString(), sessionVersion: user.sessionVersion ?? 0, jti: generateJti() }, JWT_SECRET, { expiresIn: '5m' });
}

function safeUser(u) {
  return { id: u._id, nombre: u.nombre, email: u.email, twoFactorEnabled: u.twoFactorEnabled, createdAt: u.createdAt };
}

router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    const nombreTrim = typeof nombre === 'string'
      ? nombre.trim()
      : '';

    if (nombreTrim === '' || nombreTrim.length > 100) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre es obligatorio y no puede superar los 100 caracteres'
      });
    }

    if (/[<>]/.test(nombreTrim)) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre contiene caracteres no permitidos'
      });
    }

    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Email inválido'
      });
    }

    if (typeof password !== 'string' || !PASSWORD_RE.test(password)) {
      return res.status(400).json({
        ok: false,
        error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'
      });
    }

    const emailNormalizado = email.toLowerCase().trim();

    const exists = await Usuario.findOne({
      email: emailNormalizado
    });

    if (exists) {
      return res.status(409).json({
        ok: false,
        error: 'El email ya está registrado'
      });
    }

    const datosVerificacion = crearTokenVerificacionEmail(
      EMAIL_VERIFICATION_TTL_MS
    );

    const usuario = await Usuario.create({
      nombre: nombreTrim,
      email: emailNormalizado,
      password,
      emailVerifiedAt: null,
      emailVerificationTokenHash: datosVerificacion.tokenHash,
      emailVerificationExpiresAt: datosVerificacion.expiresAt
    });

    const enlaceVerificacion =
      `${APP_URL}/verify-email#token=${encodeURIComponent(
        datosVerificacion.tokenPlano
      )}`;

    const plantilla = crearPlantillaBienvenida(
      usuario.nombre,
      enlaceVerificacion
    );

    let emailSent = false;

    try {
      const resultadoCorreo = await enviarEmail({
        to: usuario.email,
        subject: plantilla.subject,
        text: plantilla.text,
        html: plantilla.html
      });
      emailSent = resultadoCorreo.enviado === true;
    } catch (mailErr) {
      console.error(
        'Error al enviar email de verificación:',
        mailErr.message
      );
    }

    return res.status(201).json({
      ok: true,
      data: {
        pendingVerification: true,
        email: usuario.email,
        emailSent
      },
      message: emailSent
        ? 'Cuenta creada. Revisa tu correo para confirmar la dirección.'
        : 'Cuenta creada, pero no se pudo enviar el correo. Solicita un nuevo envío.'
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    }
    console.error('Error durante el registro:', err.message);

    return res.status(500).json({
      ok: false,
      error: 'Error interno al registrar el usuario'
    });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (typeof token !== 'string' || token.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: 'Token de verificación obligatorio'
      });
    }

    const tokenHash = hashTokenVerificacionEmail(token.trim());

    const usuario = await Usuario.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: new Date() },
        emailVerifiedAt: null
      },
      {
        $set: { emailVerifiedAt: new Date() },
        $unset: {
          emailVerificationTokenHash: '',
          emailVerificationExpiresAt: '',
          emailVerificationLastSentAt: ''
        }
      }
    );

    if (!usuario) {
      return res.status(400).json({
        ok: false,
        error: 'El enlace de verificación es inválido, ha caducado o ya fue utilizado'
      });
    }

    return res.json({
      ok: true,
      message: 'Correo confirmado correctamente. Ya puedes iniciar sesión.'
    });

  } catch (err) {
    console.error(
      'Error al verificar el correo:',
      err.stack
    );

    return res.status(500).json({
      ok: false,
      error: 'Error interno al verificar el correo'
    });
  }
});

router.post('/resend-verification', async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({
      ok: false,
      error: 'Email inválido'
    });
  }

  const respuesta = {
    ok: true,
    message: 'Si existe una cuenta pendiente para ese correo, enviaremos un nuevo enlace.'
  };

  try {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() - RESEND_COOLDOWN_MS);
    const token = crearTokenVerificacionEmail(EMAIL_VERIFICATION_TTL_MS);

    const usuario = await Usuario.findOneAndUpdate(
      {
        email,
        emailVerifiedAt: null,
        $or: [
          { emailVerificationLastSentAt: null },
          { emailVerificationLastSentAt: { $lt: limite } }
        ]
      },
      {
        $set: {
          emailVerificationTokenHash: token.tokenHash,
          emailVerificationExpiresAt: token.expiresAt,
          emailVerificationLastSentAt: ahora
        }
      }
    ).select('+emailVerificationTokenHash +emailVerificationExpiresAt +emailVerificationLastSentAt');

    if (!usuario) return res.json(respuesta);

    const enlace = `${APP_URL}/verify-email#token=${encodeURIComponent(token.tokenPlano)}`;
    const plantilla = crearPlantillaBienvenida(usuario.nombre, enlace);

    try {
      const resultadoCorreo = await enviarEmail({
        to: usuario.email,
        subject: plantilla.subject,
        text: plantilla.text,
        html: plantilla.html
      });
      if (!resultadoCorreo.enviado) throw new Error('SMTP_NO_CONFIGURADO');
    } catch (errorCorreo) {
      console.error(
        'No se pudo reenviar el correo de verificación:',
        errorCorreo.code || 'SMTP'
      );

      await Usuario.updateOne(
        {
          _id: usuario._id,
          emailVerificationTokenHash: token.tokenHash
        },
        {
          $set: {
            emailVerificationTokenHash: usuario.emailVerificationTokenHash ?? null,
            emailVerificationExpiresAt: usuario.emailVerificationExpiresAt ?? null,
            emailVerificationLastSentAt: usuario.emailVerificationLastSentAt ?? null
          }
        }
      ).catch(() => {
        console.error('No se pudo liberar el reenvío tras el fallo de correo');
      });
    }

    return res.json(respuesta);
  } catch (error) {
    console.error('Error al preparar el reenvío:', error.message);

    return res.status(500).json({
      ok: false,
      error: 'No se pudo procesar la solicitud'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ ok: false, error: 'Email y contraseña son obligatorios' });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase().trim() });

    if (!usuario) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }

    if (usuario.isLocked()) {
      return res.status(429).json({ ok: false, error: 'Cuenta bloqueada temporalmente. Inténtalo más tarde.' });
    }

    const valid = await usuario.verificarPassword(password);
    if (!valid) {
      await usuario.recordFailedLogin();
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }

    await usuario.resetLoginAttempts();

    if (!usuario.emailVerifiedAt) {
      return res.status(403).json({
        ok: false,
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Confirma tu correo antes de iniciar sesión'
      });
    }

    if (usuario.twoFactorEnabled) {
      res.cookie(PENDING_2FA_COOKIE, signPending2fa(usuario), PENDING_2FA_OPTIONS);
      return res.json({ ok: true, data: { requires2fa: true } });
    }

    res.cookie(COOKIE_NAME, signToken(usuario), COOKIE_OPTIONS);
    res.json({ ok: true, data: { usuario: safeUser(usuario) } });

  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al iniciar sesión' });
  }
});

router.post('/2fa/verify', async (req, res) => {
  try {
    const pendingToken = req.cookies?.[PENDING_2FA_COOKIE];
    if (!pendingToken) {
      return res.status(401).json({ ok: false, error: 'Sesión de verificación no encontrada o expirada' });
    }

    let payload;
    try { payload = jwt.verify(pendingToken, JWT_SECRET, { algorithms: ['HS256'] }); }
    catch { return res.status(401).json({ ok: false, error: 'Sesión de verificación expirada' }); }

    if (!payload.pending2fa || typeof payload.jti !== 'string' || payload.jti === '') {
      return res.status(401).json({ ok: false, error: 'Token inválido' });
    }

    const { token: totpToken } = req.body;
    if (typeof totpToken !== 'string') {
      return res.status(400).json({ ok: false, error: 'El código 2FA es obligatorio' });
    }

    const usuario = await Usuario.findById(payload.id).select('+twoFactorSecret');
    if (!usuario || !usuario.twoFactorEnabled || !usuario.twoFactorSecret) {
      return res.status(401).json({ ok: false, error: 'Autenticación en dos pasos no configurada' });
    }

    if ((payload.sessionVersion ?? 0) !== (usuario.sessionVersion ?? 0)) {
      res.clearCookie(PENDING_2FA_COOKIE, COOKIE_BASE_OPTIONS);
      return res.status(401).json({ ok: false, error: 'Sesión de verificación expirada' });
    }

    if (!usuario.emailVerifiedAt) {
      res.clearCookie(PENDING_2FA_COOKIE, COOKIE_BASE_OPTIONS);
      return res.status(403).json({
        ok: false,
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Confirma tu correo antes de iniciar sesión'
      });
    }

    const alreadyUsed = await RevokedToken.exists({ jti: payload.jti });
    if (alreadyUsed) return res.status(401).json({ ok: false, error: 'Sesión de verificación ya utilizada' });

    const valid = speakeasy.totp.verify({
      secret:   readTotpSecret(usuario.twoFactorSecret, usuario._id),
      encoding: 'base32',
      token:    totpToken,
      window:   1
    });

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    try {
      await RevokedToken.create({ jti: payload.jti, expiresAt: new Date(payload.exp * 1000) });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(401).json({ ok: false, error: 'Sesión de verificación ya utilizada' });
      }
      throw err;
    }

    res.clearCookie(PENDING_2FA_COOKIE, COOKIE_BASE_OPTIONS);
    res.cookie(COOKIE_NAME, signToken(usuario), COOKIE_OPTIONS);
    res.json({ ok: true, data: { usuario: safeUser(usuario) } });

  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al verificar 2FA' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    }

    const respuestaGenerica = {
      ok: true,
      message: 'Si el email está registrado, recibirás un enlace de recuperación.'
    };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const usuario = await Usuario.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        $set: {
          resetPasswordToken: tokenHash,
          resetPasswordExpires: new Date(Date.now() + RESET_TTL_MS)
        }
      }
    ).select('+resetPasswordToken +resetPasswordExpires');
    if (!usuario) return res.json(respuestaGenerica);

    const resetUrl = `${APP_URL}/reset-password#token=${rawToken}`;
    try {
      const resultadoCorreo = await enviarEmailRecuperacion(usuario.email, resetUrl);
      if (!resultadoCorreo.enviado) throw new Error('SMTP_NO_CONFIGURADO');
    } catch (mailErr) {
      console.error('Error al enviar email de recuperación:', mailErr.message);
      await Usuario.updateOne(
        { _id: usuario._id, resetPasswordToken: tokenHash },
        {
          $set: {
            resetPasswordToken: usuario.resetPasswordToken ?? null,
            resetPasswordExpires: usuario.resetPasswordExpires ?? null
          }
        }
      ).catch(() => console.error('No se pudo restaurar el enlace de recuperación anterior'));
    }

    res.json(respuestaGenerica);
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al solicitar la recuperación' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== 'string' || token.trim() === '') {
      return res.status(400).json({ ok: false, error: 'Token inválido' });
    }
    if (typeof password !== 'string' || !PASSWORD_RE.test(password)) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const resultado = await Usuario.updateOne(
      {
        resetPasswordToken: hashResetToken(token),
        resetPasswordExpires: { $gt: new Date() }
      },
      {
        $set: { password: passwordHash, loginAttempts: 0, lockUntil: null },
        $unset: { resetPasswordToken: '', resetPasswordExpires: '' },
        $inc: { sessionVersion: 1 }
      }
    );

    if (resultado.matchedCount === 0) {
      return res.status(400).json({ ok: false, error: 'El enlace de recuperación es inválido o ha caducado' });
    }

    res.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al restablecer la contraseña' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    const payload = req.user;
    if (payload?.jti) {
      await RevokedToken.create({
        jti:       payload.jti,
        expiresAt: new Date(payload.exp * 1000)
      });
    }
    res.clearCookie(COOKIE_NAME, COOKIE_BASE_OPTIONS);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al cerrar sesión' });
  }
});

module.exports = router;
