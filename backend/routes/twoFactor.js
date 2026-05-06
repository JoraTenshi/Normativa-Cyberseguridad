const express   = require('express');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const Usuario   = require('../models/Usuario');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/setup', requireAuth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ length: 20, name: `CyberAudit (${req.user.email})` });
    const qr = await qrcode.toDataURL(secret.otpauth_url);

    await Usuario.findByIdAndUpdate(req.user.id, { twoFactorSecret: secret.base32 });

    res.json({ ok: true, data: { qr, secret: secret.base32 } });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al generar el secreto 2FA' });
  }
});

router.post('/enable', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (typeof token !== 'string') {
      return res.status(400).json({ ok: false, error: 'El código es obligatorio' });
    }

    const usuario = await Usuario.findById(req.user.id).select('+twoFactorSecret');
    if (!usuario?.twoFactorSecret) {
      return res.status(400).json({ ok: false, error: 'Primero llama a GET /me/2fa/setup' });
    }
    if (usuario.twoFactorEnabled) {
      return res.status(409).json({ ok: false, error: '2FA ya está activado' });
    }

    const valid = speakeasy.totp.verify({
      secret:   usuario.twoFactorSecret,
      encoding: 'base32',
      token,
      window:   1
    });
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    await usuario.updateOne({ twoFactorEnabled: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al activar 2FA' });
  }
});

router.post('/disable', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (typeof token !== 'string') {
      return res.status(400).json({ ok: false, error: 'El código es obligatorio' });
    }

    const usuario = await Usuario.findById(req.user.id).select('+twoFactorSecret');
    if (!usuario?.twoFactorEnabled) {
      return res.status(409).json({ ok: false, error: '2FA no está activado' });
    }

    const valid = speakeasy.totp.verify({
      secret:   usuario.twoFactorSecret,
      encoding: 'base32',
      token,
      window:   1
    });
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    await usuario.updateOne({ twoFactorEnabled: false, twoFactorSecret: null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al desactivar 2FA' });
  }
});

module.exports = router;
