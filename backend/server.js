require('dotenv').config();
require('./utils/initSecrets');
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

const app = express();
const PORT           = process.env.PORT         || 5000;
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

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas peticiones, inténtalo más tarde.' }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos de autenticación, inténtalo más tarde.' }
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersec_audit';

mongoose
  .connect(MONGODB_URI)
  .catch((err) => {
    console.error('❌ Error al conectar con MongoDB:', err.message);
    process.exit(1);
  });

app.use('/auth',         authLimiter, authRouter);
app.use('/normativas',   normativasRouter);
app.use('/resultado',    resultadosRouter);
app.use('/me',           meRouter);
app.use('/me/2fa',       authLimiter, twoFactorRouter);
app.use('/me/pds',       pdsRouter);
app.use('/licitaciones', licitacionesRouter);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API de Autoevaluación de Ciberseguridad activa',
    endpoints: [
      'GET  /health',
      'POST /auth/register',
      'POST /auth/login',
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

const server = app.listen(PORT);

function shutdown() {
  server.close(() => {
    mongoose.connection.close().then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
