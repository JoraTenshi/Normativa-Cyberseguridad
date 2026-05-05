require('dotenv').config();
require('./utils/initSecrets');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const normativasRouter = require('./routes/normativas');
const resultadosRouter = require('./routes/resultados');
const authRouter       = require('./routes/auth');
const meRouter         = require('./routes/me');

const app = express();
const PORT           = process.env.PORT         || 5000;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN  || 'http://localhost:3000';

// Trust the nginx reverse proxy so req.ip reflects the real client IP
// (used by express-rate-limit to apply per-user limits, not per-proxy limits)
app.set('trust proxy', 1);

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '10kb' }));

// General rate limit — 100 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas peticiones, inténtalo más tarde.' }
}));

// Stricter limit for auth endpoints — 10 req / 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos de autenticación, inténtalo más tarde.' }
});

// ─── MongoDB connection ────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersec_audit';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB correctamente'))
  .catch((err) => {
    console.error('❌ Error al conectar con MongoDB:', err.message);
    process.exit(1);
  });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth',       authLimiter, authRouter);
app.use('/normativas', normativasRouter);
app.use('/resultado',  resultadosRouter);
app.use('/me',         meRouter);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API de Autoevaluación de Ciberseguridad activa',
    endpoints: [
      'GET  /health',
      'POST /auth/register',
      'POST /auth/login',
      'GET  /me',
      'GET  /me/historial',
      'GET  /me/historial/:id',
      'GET  /normativas',
      'GET  /normativas/:id',
      'POST /resultado'
    ]
  });
});

app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
  const db = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';
  const ok = dbState === 1;

  res.status(ok ? 200 : 503).json({
    ok,
    uptime: Math.floor(process.uptime()),
    db,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    mongoose.connection.close(false).then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
