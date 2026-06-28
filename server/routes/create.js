// ============================================================
// Create routes: generate brand-new print designs from text prompts.
// ============================================================
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../utils/auth.js';
import { UPLOADS_DIR, ensureDir } from '../utils/files.js';
import { createJob } from '../services/jobStore.js';
import { enqueue } from '../services/queue.js';
import { GEN_SIZES } from '../services/designGenerator.js';

const router = Router();
router.use(requireAuth);

// Disk storage for the reference image used by AI Recreate.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureDir(UPLOADS_DIR)),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || 'ref').replace(/[^a-zA-Z0-9.\-_]+/g, '_');
      cb(null, `ref-${uuid().slice(0, 8)}-${safe}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Only image files are allowed.')),
});

/** Consent guard (rights/policy confirmation before generating). */
function requireConsent(req, res) {
  const confirmed =
    req.body?.confirmOwnership === true ||
    req.body?.confirmOwnership === 'true' ||
    req.body?.confirm === 'true';
  if (!confirmed) {
    res.status(400).json({
      error:
        'You must confirm you will use the generated artwork responsibly and in line with the content policy.',
    });
    return false;
  }
  return true;
}

function normalizeSize(size) {
  return GEN_SIZES.includes(size) ? size : 'square';
}

/**
 * POST /api/create/single
 * Body: { prompt, mode?, size?, confirmOwnership }
 */
router.post('/single', (req, res) => {
  if (!requireConsent(req, res)) return;
  const { prompt, mode, size } = req.body || {};
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'A text prompt is required.' });
  }

  const job = createJob({
    kind: 'generate',
    source: prompt.trim(),
    sourceType: 'generate',
    mode: mode || 'dtf_ready',
    prompt: prompt.trim(),
    genSize: normalizeSize(size),
  });
  enqueue(job.id);
  res.json({ job });
});

/**
 * POST /api/create/bulk
 * Body: { prompts: string (newline separated) | string[], mode?, size?, confirmOwnership }
 * One design per prompt line, grouped under a batchId.
 */
router.post('/bulk', (req, res) => {
  if (!requireConsent(req, res)) return;
  let { prompts, mode, size } = req.body || {};
  if (typeof prompts === 'string') prompts = prompts.split(/\r?\n/);
  prompts = (prompts || []).map((p) => p.trim()).filter(Boolean);
  if (prompts.length === 0) {
    return res.status(400).json({ error: 'Provide at least one prompt.' });
  }

  const batchId = uuid();
  const jobs = prompts.map((prompt) => {
    const job = createJob({
      kind: 'generate',
      source: prompt,
      sourceType: 'generate',
      mode: mode || 'dtf_ready',
      prompt,
      genSize: normalizeSize(size),
      batchId,
    });
    enqueue(job.id);
    return job;
  });

  res.json({ batchId, count: jobs.length, jobs });
});

/**
 * POST /api/create/recreate  (multipart)
 * Faithfully recreate the print from an uploaded reference image (image-to-image).
 * Fields: image (file), prompt? (extra guidance), size?, mode?, confirmOwnership
 */
router.post('/recreate', upload.single('image'), (req, res) => {
  if (!requireConsent(req, res)) return;
  if (!req.file) return res.status(400).json({ error: 'A reference image is required.' });

  const { prompt, mode, size } = req.body || {};
  const job = createJob({
    kind: 'generate',
    source: prompt?.trim() || req.file.originalname,
    sourceType: 'generate',
    mode: mode || 'dtf_ready',
    prompt: prompt?.trim() || null,
    genSize: normalizeSize(size),
    referencePath: req.file.path,
  });
  enqueue(job.id);
  res.json({ job });
});

export default router;
