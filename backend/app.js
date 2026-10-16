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
const organizacionesRouter = require('./routes/organizaciones');
const solicitudesOrganizacionRouter = require('./routes/solicitudesOrganizacion');
const errorHandler       = require('./middleware/errorHandler');
const { comprobarOrigen } = require('./middleware/origen');

const sinLimite = (req, res, next) => next();

function createApp({ rateLimits = true, politicaSesiones = 'persistente' } = {}) {
  if (!['persistente','legado_pruebas'].includes(politicaSesiones)) throw new TypeError('Política de sesiones inválida');
  const app = express();
  app.locals.politicaSesiones = politicaSesiones;
  const ALLOWED_ORIGIN = process.env.CORS_ORIGIN  || 'http://localhost:3000';

  app.set('trust proxy', 1);

  // Mismos valores que nginx/nginx.conf; la API solo devuelve JSON, así que su CSP no permite nada.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:     ["'none'"],
        frameAncestors: ["'none'"],
        baseUri:        ["'none'"],
        formAction:     ["'none'"]
      }
    },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true },
    frameguard:              { action: 'deny' },
    referrerPolicy:          { policy: 'no-referrer' }
  }));
  app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
  app.use(comprobarOrigen(ALLOWED_ORIGIN));
  app.use(cookieParser());
  // ENS and RAT inventories carry bounded structured, justified entries.
  // Expand only these authenticated write routes; auth and other APIs retain 10kb.
  const ensWritePath = /^\/organizaciones\/[a-f0-9]{24}\/normativa\/(categorizaciones-ens|determinaciones-ens|revisiones-categorizacion-ens|registros-rat|revisiones-rat|unidades-dp|solicitudes-derechos|pretensiones-derechos|detecciones-eipd)(\/[a-f0-9]{24})?\/?$/;
  const ensJSON = express.json({ limit: '128kb' });
  const normalJSON = express.json({ limit: '10kb' });
  const escrituraEns = req => ['POST','PATCH'].includes(req.method) && ensWritePath.test(req.path);
  app.use((req, res, next) => {
    // Defer the larger inventory parser until after the global request limiter.
    if (escrituraEns(req)) return next();
    return normalJSON(req, res, next);
  });

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

  app.use((req, res, next) => {
    if (!escrituraEns(req)) return next();
    return require('./middleware/auth').requireAuth(req, res, error => error ? next(error) : ensJSON(req, res, next));
  });

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
  app.use('/auth', (req,res,next) => { res.set('Cache-Control','no-store'); next(); }, authRouter);
  app.use(solicitudesOrganizacionRouter);
  app.use('/normativas',   normativasRouter);
  app.use('/resultado',    resultadosRouter);
  app.use('/me',           meRouter);
  app.use('/me/2fa',       twoFactorLimiter, twoFactorRouter);
  app.use('/me/pds',       pdsRouter);
  app.use('/licitaciones', licitacionesRouter);
  app.use('/organizaciones', organizacionesRouter);

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
        'GET  /organizaciones/:organizacionId/actividad',
        'GET  /me/historial/:id',
        'GET  /me/pds/:resultadoId',
        'POST /me/2fa/setup',
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
