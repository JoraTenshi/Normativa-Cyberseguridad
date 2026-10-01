const express   = require('express');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const Usuario   = require('../models/Usuario');
const { requireAuth } = require('../middleware/auth');
const { encryptTotpSecret, readTotpSecret } = require('../utils/totpEncryption');

const router = express.Router();

router.get('/setup', requireAuth, async (req, res) => {
  try {
    let usuario = await Usuario.findById(req.user.id)
      .select('+twoFactorSecret');

    if (!usuario) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    if (usuario.twoFactorEnabled) {
      return res.status(409).json({ ok: false, error: '2FA ya está activado' });
    }

    if (!usuario.twoFactorSecret) {
      const generated = speakeasy.generateSecret({ length: 20 });

      const actualizado = await Usuario.findOneAndUpdate(
        {
          _id: usuario._id,
          twoFactorEnabled: false,
          twoFactorSecret: null
        },
        { $set: { twoFactorSecret: encryptTotpSecret(generated.base32, usuario._id) } },
        { new: true }
      ).select('+twoFactorSecret');

      usuario = actualizado || await Usuario.findById(req.user.id)
        .select('+twoFactorSecret');

      if (!usuario || usuario.twoFactorEnabled || !usuario.twoFactorSecret) {
        return res.status(409).json({
          ok: false,
          error: 'No se pudo iniciar la configuración 2FA'
        });
      }
    }

    const secret = readTotpSecret(usuario.twoFactorSecret, usuario._id);
    const otpauthUrl = speakeasy.otpauthURL({
      secret,
      label: `CyberAudit (${req.user.email})`,
      encoding: 'base32'
    });

    const qr = await qrcode.toDataURL(otpauthUrl);

    return res.json({
      ok: true,
      data: { qr, secret }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Error al generar el secreto 2FA'
    });
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
      secret:   readTotpSecret(usuario.twoFactorSecret, usuario._id),
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
      secret:   readTotpSecret(usuario.twoFactorSecret, usuario._id),
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
