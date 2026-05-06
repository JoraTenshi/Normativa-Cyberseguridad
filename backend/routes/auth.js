const express      = require('express');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const speakeasy    = require('speakeasy');
const Usuario      = require('../models/Usuario');
const RevokedToken = require('../models/RevokedToken');
const { JWT_SECRET, JWT_EXPIRES, generateJti, requireAuth } = require('../middleware/auth');

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const COOKIE_NAME = 'cyberaudit_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'strict',
  maxAge:   24 * 60 * 60 * 1000
};

const PENDING_2FA_COOKIE   = 'cyberaudit_2fa_pending';
const PENDING_2FA_OPTIONS  = {
  httpOnly: true,
  secure:   true,
  sameSite: 'strict',
  maxAge:   5 * 60 * 1000
};

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, nombre: user.nombre, jti: generateJti() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function signPending2fa(userId) {
  return jwt.sign({ pending2fa: true, id: userId.toString(), jti: generateJti() }, JWT_SECRET, { expiresIn: '5m' });
}

function safeUser(u) {
  return { id: u._id, nombre: u.nombre, email: u.email, twoFactorEnabled: u.twoFactorEnabled, createdAt: u.createdAt };
}

router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    }
    if (typeof password !== 'string' || !PASSWORD_RE.test(password)) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' });
    }

    const exists = await Usuario.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    }

    const usuario = await Usuario.create({ nombre: nombre.trim(), email, password });
    res.cookie(COOKIE_NAME, signToken(usuario), COOKIE_OPTIONS);
    res.status(201).json({ ok: true, data: { usuario: safeUser(usuario) } });

  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al registrar el usuario' });
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

    if (usuario.twoFactorEnabled) {
      res.cookie(PENDING_2FA_COOKIE, signPending2fa(usuario._id), PENDING_2FA_OPTIONS);
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

    if (!payload.pending2fa) {
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

    if (payload.jti) {
      const alreadyUsed = await RevokedToken.exists({ jti: payload.jti });
      if (alreadyUsed) return res.status(401).json({ ok: false, error: 'Sesión de verificación ya utilizada' });
    }

    const valid = speakeasy.totp.verify({
      secret:   usuario.twoFactorSecret,
      encoding: 'base32',
      token:    totpToken,
      window:   1
    });

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    if (payload.jti) {
      await RevokedToken.create({ jti: payload.jti, expiresAt: new Date(payload.exp * 1000) });
    }

    res.clearCookie(PENDING_2FA_COOKIE, PENDING_2FA_OPTIONS);
    res.cookie(COOKIE_NAME, signToken(usuario), COOKIE_OPTIONS);
    res.json({ ok: true, data: { usuario: safeUser(usuario) } });

  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al verificar 2FA' });
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
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno al cerrar sesión' });
  }
});

module.exports = router;
