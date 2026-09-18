require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { prisma } = require('./db');
const { seedIfNeeded } = require('./seed');
const authRouter = require('./routes/auth');
const farmersRouter = require('./routes/farmers');
const lotsRouter = require('./routes/lots');
const marketsRouter = require('./routes/markets');
const buyersRouter = require('./routes/buyers');
const recommendationsRouter = require('./routes/recommendations');
const offersRouter = require('./routes/offers');
const transactionsRouter = require('./routes/transactions');
const dashboardRouter = require('./routes/dashboard');
const aiRouter = require('./routes/ai');
const legacyRouter = require('./routes/legacy');

const app = express();
const PORT = process.env.PORT || 8002;

app.use(morgan('tiny'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Health
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'krishisetu-node', db: 'up', demoMode: process.env.DEMO_MODE === 'true' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'down', error: e.message });
  }
});

app.get('/api/', (_req, res) => {
  res.json({ message: 'KrishiSetu API ready', version: '1.0-node' });
});

// Backwards-compat legacy routes first so the pre-migration UI keeps working
// (anonymous /api/dashboard, /api/analyze, /api/offers, /api/assistant/chat, /api/role/:role)
app.use('/api', legacyRouter);

// New v1 API (persisted, authed endpoints)
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/farmers', farmersRouter);
app.use('/api/v1/lots', lotsRouter);
app.use('/api/v1/markets', marketsRouter);
app.use('/api/v1/buyers', buyersRouter);
app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/offers', offersRouter);
app.use('/api/v1/transactions', transactionsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/ai', aiRouter);
// Convenience aliases so any client that expects /api/auth still works
app.use('/api/auth', authRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.publicMessage || err.message || 'Internal error' });
});

async function start() {
  try {
    await prisma.$connect();
    await seedIfNeeded();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[krishisetu-node] listening on :${PORT}`);
    });
  } catch (e) {
    console.error('[krishisetu-node] startup failed', e);
    process.exit(1);
  }
}

start();
