require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth.routes');
const moduleRoutes = require('./routes/module.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

{
  const raw = process.env.TRUST_PROXY_HOPS;
  let trust = 1;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    trust = Number.isFinite(n) ? n : 1;
  }
  app.set('trust proxy', trust);
}

function normalizeCorsOrigin(entry) {
  const s = String(entry).trim();
  if (!s) return null;
  try {
    const withProto = /:\/\//.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s.replace(/\/$/, '') || null;
  }
}

function loadAllowedOrigins() {
  const raw = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  return [...new Set(raw.split(',').map(normalizeCorsOrigin).filter(Boolean))];
}

const allowedOrigins = loadAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    // Don't hardcode allowedHeaders: browsers may send Cache-Control/Pragma/etc in preflight.
    // Let the middleware reflect Access-Control-Request-Headers instead.
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.redirect(302, '/api/docs');
});

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MET Academy API Docs',
  })
);

app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api/auth', authRoutes);
app.use('/api/modules', moduleRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
