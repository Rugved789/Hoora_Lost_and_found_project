import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import dotenv from 'dotenv';
import { errorHandler } from './utils/errors.js';
import { requestLogger } from './utils/logger.js';
import pool from './utils/db.js';

import itemsRouter from './routes/items.js';
import claimsRouter from './routes/claims.js';
import statsRouter, { getLeaderboardHandler } from './routes/stats.js';
import userRouter from './routes/user.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting (100/min global, keyed by user id when authenticated)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.headers['x-user-id'] || req.user?.id?.toString() || req.ip,
  message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(requestLogger);

// Clerk middleware
if (process.env.AUTH_MODE !== 'mock' || (process.env.CLERK_SECRET_KEY && !process.env.CLERK_SECRET_KEY.includes('...'))) {
  try {
    app.use(clerkMiddleware());
  } catch (err) {
    console.warn('Clerk middleware skipped:', err.message);
  }
}

// Health check (also runs SELECT 1 to wake Neon)
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

// Routes
app.get('/api/leaderboard', getLeaderboardHandler);
app.use('/api/items', itemsRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/stats', statsRouter);
app.use('/api', userRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Auth mode: ${process.env.AUTH_MODE || 'clerk'}`);
  console.log(`🤖 AI enabled: ${process.env.AI_ENABLED || 'true'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Terminating existing process or change PORT in .env.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
