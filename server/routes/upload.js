// ============================================================
// Upload routes: single / bulk / zip image uploads
// ============================================================
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../utils/auth.js';
import { UPLOADS_DIR, ensureDir } from '../utils/files.js';
import { createJob } from '../services/jobStore.js';
import { enqueue } from '../services/queue.js';

const router = Router();
router.use(requireAuth);

// --- Multer storage: keep original-ish names, prefixed with a short id ------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureDir(UPLOADS_DIR)),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]+/g, '_');
    cb(null, `${uuid().slice(0, 8)}-${safe}`);
  },
});

const IMAGE_MIME = /^image\//;
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  },
});

// Separate multer instance for ZIP uploads (memory, then extract).
const zipUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB zip
});

/** Reject the request unless the legal ownership checkbox was confirmed. */
function requireConsent(req, res) {
  const confirmed =
    req.body?.confirmOwnership === 'true' ||
    req.body?.confirmOwnership === true ||
    req.body?.confirm === 'true';
  if (!confirmed) {
    res.status(400).json({
      error:
        'You must confirm that you own this design or have permission to extract and reuse it.',
    });
    return false;
  }
  return true;
}

/**
 * POST /api/upload/single
 * One image -> one job.
 */
router.post('/single', upload.single('image'), (req, res) => {
  if (!requireConsent(req, res)) return;
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  const mode = req.body.mode || 'dtf_ready';
  const job = createJob({
    source: req.file.originalname,
    sourceType: 'upload',
    mode,
    inputPath: req.file.path,
  });
  enqueue(job.id);
  res.json({ job });
});

/**
 * POST /api/upload/bulk
 * Multiple images -> one job per image, grouped by a batchId.
 */
router.post('/bulk', upload.array('images', 100), (req, res) => {
  if (!requireConsent(req, res)) return;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded.' });
  }

  const mode = req.body.mode || 'dtf_ready';
  const batchId = uuid();
  const jobs = req.files.map((file) => {
    const job = createJob({
      source: file.originalname,
      sourceType: 'upload',
      mode,
      inputPath: file.path,
      batchId,
    });
    enqueue(job.id);
    return job;
  });

  res.json({ batchId, count: jobs.length, jobs });
});

/**
 * POST /api/upload/zip
 * A ZIP archive of images -> one job per extracted image.
 */
router.post('/zip', zipUpload.single('zip'), (req, res) => {
  if (!requireConsent(req, res)) return;
  if (!req.file) return res.status(400).json({ error: 'No ZIP uploaded.' });

  const mode = req.body.mode || 'dtf_ready';
  const batchId = uuid();
  const jobs = [];

  try {
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();
    const extractDir = ensureDir(path.join(UPLOADS_DIR, `zip-${batchId}`));

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (!/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(entry.entryName)) continue;

      const safeName = path.basename(entry.entryName).replace(/[^a-zA-Z0-9.\-_]+/g, '_');
      const dest = path.join(extractDir, `${uuid().slice(0, 8)}-${safeName}`);
      fs.writeFileSync(dest, entry.getData());

      const job = createJob({
        source: path.basename(entry.entryName),
        sourceType: 'upload',
        mode,
        inputPath: dest,
        batchId,
      });
      enqueue(job.id);
      jobs.push(job);
    }

    // Clean up the uploaded zip itself.
    fs.unlink(req.file.path, () => {});

    if (jobs.length === 0) {
      return res.status(400).json({ error: 'No images found inside the ZIP archive.' });
    }
    res.json({ batchId, count: jobs.length, jobs });
  } catch (err) {
    res.status(400).json({ error: `Could not read ZIP archive: ${err.message}` });
  }
});

export default router;
