// ============================================================
// Job routes: list / get / retry
// ============================================================
import { Router } from 'express';
import fs from 'fs';
import axios from 'axios';
import { requireAuth } from '../utils/auth.js';
import { listJobs, getJob, listBatchJobs } from '../services/jobStore.js';
import { retry, reprocess } from '../services/queue.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/jobs
 * Returns all jobs (newest first). Optional ?batchId= filter.
 */
router.get('/', (req, res) => {
  const { batchId } = req.query;
  const jobs = batchId ? listBatchJobs(String(batchId)) : listJobs();
  res.json({ jobs });
});

/**
 * GET /api/jobs/:id
 */
router.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job });
});

/**
 * POST /api/jobs/:id/retry
 * Re-queue a failed (or any) job.
 */
router.post('/:id/retry', (req, res) => {
  const job = retry(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job });
});

/**
 * POST /api/jobs/:id/reprocess
 * Re-run a job with a manual crop and/or a different mode.
 * Body: { mode?, manualCrop?: { x, y, width, height } | null }
 */
router.post('/:id/reprocess', (req, res) => {
  const { mode, manualCrop } = req.body || {};

  if (manualCrop) {
    const { x, y, width, height } = manualCrop;
    const valid = [x, y, width, height].every((n) => Number.isFinite(n));
    if (!valid || width <= 0 || height <= 0) {
      return res.status(400).json({ error: 'Invalid manualCrop rectangle.' });
    }
  }

  const opts = {};
  if (mode) opts.mode = mode;
  if (manualCrop !== undefined) opts.manualCrop = manualCrop;

  const job = reprocess(req.params.id, opts);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job });
});

/**
 * GET /api/jobs/:id/source
 * Stream the original source image for a job (used by the manual crop editor).
 * Works for both uploaded files and remote URLs.
 */
router.get('/:id/source', async (req, res, next) => {
  try {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    if (job.inputPath && fs.existsSync(job.inputPath)) {
      return res.sendFile(job.inputPath);
    }
    if (job.inputUrl) {
      const upstream = await axios.get(job.inputUrl, {
        responseType: 'stream',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      res.set('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
      return upstream.data.pipe(res);
    }
    res.status(404).json({ error: 'No source image available for this job.' });
  } catch (err) {
    next(err);
  }
});

export default router;
