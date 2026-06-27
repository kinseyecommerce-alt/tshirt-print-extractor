// ============================================================
// Job routes: list / get / retry
// ============================================================
import { Router } from 'express';
import { requireAuth } from '../utils/auth.js';
import { listJobs, getJob, listBatchJobs } from '../services/jobStore.js';
import { retry } from '../services/queue.js';

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

export default router;
