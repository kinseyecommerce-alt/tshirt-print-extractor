// ============================================================
// AI Print Extractor SaaS - Express server entry point
// ============================================================
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { UPLOADS_DIR, OUTPUTS_DIR, ensureDir } from './utils/files.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import urlRoutes from './routes/url.js';
import createRoutes from './routes/create.js';
import jobRoutes from './routes/jobs.js';
import downloadRoutes from './routes/download.js';

// Load environment variables from .env (no-op if file is missing).
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Make sure runtime storage folders exist before any request comes in.
ensureDir(UPLOADS_DIR);
ensureDir(OUTPUTS_DIR);

// --- Core middleware ---------------------------------------------------------
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// In development the React dev server runs on a different origin, so we need
// CORS with credentials. In production the client is served from this origin.
if (!isProduction) {
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  app.use(cors({ origin: origins, credentials: true }));
}

// Trust the Replit/Heroku-style proxy so secure cookies work behind TLS.
app.set('trust proxy', 1);

// --- Session-based authentication -------------------------------------------
app.use(
  session({
    name: 'ape.sid',
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // requires HTTPS in production
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Health check (public — must be registered before authed route mounts)
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- API routes --------------------------------------------------------------
app.use('/api', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/url', urlRoutes);
app.use('/api/create', createRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api', downloadRoutes);

// --- Static serving of generated output files --------------------------------
// Outputs are also downloadable via the authenticated /api/download route, but
// previews are served statically for convenience.
app.use('/files/outputs', express.static(OUTPUTS_DIR));
app.use('/files/uploads', express.static(UPLOADS_DIR));

// --- Serve the built React client in production ------------------------------
if (isProduction) {
  const clientDist = path.join(ROOT_DIR, 'client', 'dist');
  app.use(express.static(clientDist));
  // SPA fallback: anything that is not an API/file route returns index.html.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/files')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --- Centralized error handler ----------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  AI Print Extractor SaaS`);
  console.log(`  Server listening on http://0.0.0.0:${PORT}`);
  console.log(`  Mode: ${isProduction ? 'production' : 'development'}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log('  [warn] OPENAI_API_KEY not set - using heuristic print detection.');
  }
  console.log('');
});
