const express   = require('express');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const Usuario   = require('../models/Usuario');
const { requireAuth } = require('../middleware/auth');
const { encryptTotpSecret, readTotpSecret } = require('../utils/totpEncryption');
const { pasoDelCodigo, consumirPaso, MENSAJE_CODIGO_USADO } = require('../utils/totpPaso');

const { esBDNoDisponible } = require('../utils/bd');
const router = express.Router();
const { esPersistente, OPCIONES_COOKIE, COOKIE, PENDING } = require('../services/accesoSesion');

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
        {
          _id: usuario._id,
          twoFactorEnabled: false,
          twoFactorPendingSecret: usuario.twoFactorPendingSecret ?? null
        },
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
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
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

    const paso = pasoDelCodigo(readTotpSecret(usuario.twoFactorPendingSecret, usuario._id), token);
    if (paso === null) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }

    // Solo se activa el mismo secreto que se acaba de verificar y si nadie lo ha cambiado entretanto.
    const activado = await Usuario.findOneAndUpdate(
      {
        _id: usuario._id,
        twoFactorEnabled: false,
        twoFactorPendingSecret: usuario.twoFactorPendingSecret,
        twoFactorPendingExpiresAt: { $gt: new Date() },
        ...(esPersistente(req) ? { sessionVersion:usuario.sessionVersion ?? 0 } : {})
      },
      {
        $set: {
          twoFactorSecret:           usuario.twoFactorPendingSecret,
          twoFactorEnabled:          true,
          twoFactorPendingSecret:    null,
          twoFactorPendingExpiresAt: null,
          // El código de activación queda gastado: no sirve después para iniciar sesión.
          twoFactorLastStep:         paso
        },
        ...(esPersistente(req) ? { $inc:{ sessionVersion:1 } } : {})
      }
    );
    if (!activado) {
      return res.status(409).json({ ok: false, error: 'La configuración 2FA ha cambiado; vuelve a empezar' });
    }

    if (esPersistente(req)) {
      res.clearCookie(COOKIE, OPCIONES_COOKIE);
      res.clearCookie(PENDING, OPCIONES_COOKIE);
    }
    res.json({ ok: true, ...(esPersistente(req) ? { requiereReautenticacion:true } : {}) });
  } catch (err) {
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
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

    const paso = pasoDelCodigo(readTotpSecret(usuario.twoFactorSecret, usuario._id), token);
    if (paso === null) {
      return res.status(401).json({ ok: false, error: 'Código incorrecto' });
    }
    // Un código ya usado (por ejemplo, el del inicio de sesión) no sirve para desactivar el 2FA.
    if (!(await consumirPaso(Usuario, { _id: usuario._id, twoFactorEnabled: true }, paso))) {
      return res.status(401).json({ ok: false, error: MENSAJE_CODIGO_USADO });
    }

    if (esPersistente(req)) {
      const resultado = await Usuario.updateOne({
        _id:usuario._id, sessionVersion:usuario.sessionVersion ?? 0,
        twoFactorEnabled:true, twoFactorSecret:usuario.twoFactorSecret
      }, {
        $set:{ twoFactorEnabled:false, twoFactorSecret:null, twoFactorPendingSecret:null, twoFactorPendingExpiresAt:null },
        $inc:{ sessionVersion:1 }
      });
      if (resultado.matchedCount !== 1) return res.status(409).json({ ok:false, error:'La cuenta cambió; vuelve a identificarte' });
    } else {
      await usuario.updateOne({
        twoFactorEnabled:false, twoFactorSecret:null, twoFactorPendingSecret:null, twoFactorPendingExpiresAt:null
      });
    }
    if (esPersistente(req)) {
      res.clearCookie(COOKIE, OPCIONES_COOKIE);
      res.clearCookie(PENDING, OPCIONES_COOKIE);
    }
    res.json({ ok: true, ...(esPersistente(req) ? { requiereReautenticacion:true } : {}) });
  } catch (err) {
    if (esBDNoDisponible(err)) return res.status(503).json({ ok: false, error: 'Servicio no disponible temporalmente' });
    res.status(500).json({ ok: false, error: 'Error al desactivar 2FA' });
  }
});

module.exports = router;
