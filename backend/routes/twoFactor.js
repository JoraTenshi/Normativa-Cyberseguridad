const express   = require('express');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const Usuario   = require('../models/Usuario');
const { requireAuth } = require('../middleware/auth');
const { encryptTotpSecret, readTotpSecret } = require('../utils/totpEncryption');

const router = express.Router();

const PENDING_TTL_MS = 10 * 60 * 1000;

router.post('/setup', requireAuth, async (req, res) => {
  try {
    let usuario = await Usuario.findById(req.user.id)
      .select('+twoFactorPendingSecret +twoFactorPendingExpiresAt');

    if (!usuario) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    if (usuario.twoFactorEnabled) {
      return res.status(409).json({ ok: false, error: '2FA ya está activado' });
    }

    // Se reutiliza el secreto pendiente mientras no caduque, para que el QR no cambie si se repite la llamada.
    const vigente = usuario.twoFactorPendingSecret && usuario.twoFactorPendingExpiresAt > new Date();
    if (!vigente) {
      const generated = speakeasy.generateSecret({ length: 20 });

      usuario = await Usuario.findOneAndUpdate(
        { _id: usuario._id, twoFactorEnabled: false },
        {
          $set: {
            twoFactorPendingSecret:    encryptTotpSecret(generated.base32, usuario._id),
            twoFactorPendingExpiresAt: new Date(Date.now() + PENDING_TTL_MS)
          }
        },
        { new: true }
      ).select('+twoFactorPendingSecret +twoFactorPendingExpiresAt');

      if (!usuario) {
        return res.status(409).json({
          ok: false,
          error: 'No se pudo iniciar la configuración 2FA'
        });
      }
    }

    const secret = readTotpSecret(usuario.twoFactorPendingSecret, usuario._id);
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

    const usuario = await Usuario.findById(req.user.id)
      .select('+twoFactorPendingSecret +twoFactorPendingExpiresAt');
    if (usuario?.twoFactorEnabled) {
      return res.status(409).json({ ok: false, error: '2FA ya está activado' });
    }
    if (!usuario?.twoFactorPendingSecret || !(usuario.twoFactorPendingExpiresAt > new Date())) {
      return res.status(400).json({ ok: false, error: 'Primero llama a POST /me/2fa/setup' });
    }

    const valid = speakeasy.totp.verify({
      secret:   readTotpSecret(usuario.twoFactorPendingSecret, usuario._id),
      encoding: 'base32',
      token,
      window:   1
    });
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    // Solo se activa el mismo secreto que se acaba de verificar y si nadie lo ha cambiado entretanto.
    const activado = await Usuario.findOneAndUpdate(
      {
        _id: usuario._id,
        twoFactorEnabled: false,
        twoFactorPendingSecret: usuario.twoFactorPendingSecret
      },
      {
        $set: {
          twoFactorSecret:           usuario.twoFactorPendingSecret,
          twoFactorEnabled:          true,
          twoFactorPendingSecret:    null,
          twoFactorPendingExpiresAt: null
        }
      }
    );
    if (!activado) {
      return res.status(409).json({ ok: false, error: 'La configuración 2FA ha cambiado; vuelve a empezar' });
    }

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

    await usuario.updateOne({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorPendingExpiresAt: null
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al desactivar 2FA' });
  }
});

module.exports = router;
