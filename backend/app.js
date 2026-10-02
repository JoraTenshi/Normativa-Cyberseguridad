const express = require('express');
const mongoose = require('mongoose');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const normativasRouter   = require('./routes/normativas');
const resultadosRouter   = require('./routes/resultados');
const authRouter         = require('./routes/auth');
const meRouter           = require('./routes/me');
const twoFactorRouter    = require('./routes/twoFactor');
const pdsRouter          = require('./routes/pds');
const licitacionesRouter = require('./routes/licitaciones');
const errorHandler       = require('./middleware/errorHandler');

const sinLimite = (req, res, next) => next();

function createApp({ rateLimits = true } = {}) {
  const app = express();
  const ALLOWED_ORIGIN = process.env.CORS_ORIGIN  || 'http://localhost:3000';

  app.set('trust proxy', 1);

  app.use(helmet({
    hsts:            false,
    frameguard:      false,
    noSniff:         false,
    referrerPolicy:  false,
    contentSecurityPolicy: false,
  }));
  app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10kb' }));

  if (rateLimits) {
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/health',
      message: { ok: false, error: 'Demasiadas peticiones, inténtalo más tarde.' }
    }));
  }

  const limitar = opciones => (rateLimits ? rateLimit(opciones) : sinLimite);

  const authLimiter = limitar({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Demasiados intentos de autenticación, inténtalo más tarde.' }
  });

  const loginLimiter = limitar({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      ok: false,
      error: 'Demasiados intentos de inicio de sesión. Inténtalo más tarde.'
    }
  });

  const twoFactorLimiter = limitar({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      ok: false,
      error: 'Demasiados intentos de verificación en dos pasos. Inténtalo más tarde.'
    }
  });

  app.use('/auth/register', authLimiter);
  app.use('/auth/resend-verification', authLimiter);
  app.use('/auth/forgot-password', authLimiter);
  app.use('/auth/reset-password', authLimiter);
  app.use('/auth/login', loginLimiter);
  app.use('/auth/2fa/verify', twoFactorLimiter);
  app.use('/auth', authRouter);
  app.use('/normativas',   normativasRouter);
  app.use('/resultado',    resultadosRouter);
  app.use('/me',           meRouter);
  app.use('/me/2fa',       twoFactorLimiter, twoFactorRouter);
  app.use('/me/pds',       pdsRouter);
  app.use('/licitaciones', licitacionesRouter);

  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      message: 'API de Autoevaluación de Ciberseguridad activa',
      endpoints: [
        'GET  /health',
        'POST /auth/register',
        'POST /auth/verify-email',
        'POST /auth/resend-verification',
        'POST /auth/login',
        'POST /auth/forgot-password',
        'POST /auth/reset-password',
        'POST /auth/logout',
        'POST /auth/2fa/verify',
        'GET  /me',
        'PUT  /me/organizacion',
        'GET  /me/historial',
        'GET  /me/historial/:id',
        'GET  /me/pds/:resultadoId',
        'GET  /me/2fa/setup',
        'POST /me/2fa/enable',
        'POST /me/2fa/disable',
        'GET  /normativas',
        'GET  /normativas/:id',
        'GET  /normativas/aplicables',
        'POST /resultado',
        'GET  /licitaciones',
        'GET  /licitaciones/status',
        'POST /licitaciones/sync'
      ]
    });
  });

  app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const db = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';
    const ok = dbState === 1;

    res.status(ok ? 200 : 503).json({
      ok,
      uptime: Math.floor(process.uptime()),
      db,
      timestamp: new Date().toISOString()
    });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
