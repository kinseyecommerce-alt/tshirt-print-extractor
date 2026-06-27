// ============================================================
// URL routes: single URL / bulk URLs / CSV-Excel of URLs
// ============================================================
import { Router } from 'express';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../utils/auth.js';
import { createJob } from '../services/jobStore.js';
import { enqueue } from '../services/queue.js';
import { extractImagesFromUrl } from '../services/scraper.js';

const router = Router();
router.use(requireAuth);

// CSV/Excel uploads are parsed from memory.
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Shared consent guard (legal ownership checkbox). */
function requireConsent(req, res) {
  const confirmed =
    req.body?.confirmOwnership === true ||
    req.body?.confirmOwnership === 'true' ||
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
 * POST /api/url/preview
 * Fetch candidate images for a single product URL WITHOUT creating a job, so
 * the user can pick the correct front/back image first.
 */
router.post('/preview', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'A url is required.' });
    const result = await extractImagesFromUrl(url.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/url/single
 * Create a job from a single image URL (or a chosen image from a product page).
 * Body: { url, imageUrl?, mode, confirmOwnership }
 */
router.post('/single', async (req, res, next) => {
  try {
    if (!requireConsent(req, res)) return;
    const { url, imageUrl, mode } = req.body || {};
    const target = imageUrl || url;
    if (!target) return res.status(400).json({ error: 'A url is required.' });

    const job = createJob({
      source: target,
      sourceType: 'url',
      mode: mode || 'dtf_ready',
      inputUrl: target,
    });
    enqueue(job.id);
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/url/bulk
 * Body: { urls: string (newline separated) | string[], mode, confirmOwnership }
 * For each URL we resolve the best image (first candidate) and create a job.
 */
router.post('/bulk', async (req, res, next) => {
  try {
    if (!requireConsent(req, res)) return;
    let { urls, mode } = req.body || {};
    if (typeof urls === 'string') {
      urls = urls.split(/\r?\n/);
    }
    urls = (urls || []).map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return res.status(400).json({ error: 'No URLs provided.' });

    const batchId = uuid();
    const jobs = await createJobsFromUrls(urls, mode || 'dtf_ready', batchId);
    res.json({ batchId, count: jobs.length, jobs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/url/csv
 * A CSV or Excel file whose first column (or a "url" column) holds product URLs.
 */
router.post('/csv', memUpload.single('file'), async (req, res, next) => {
  try {
    if (!requireConsent(req, res)) return;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const urls = extractUrlsFromSheet(req.file);
    if (urls.length === 0) {
      return res.status(400).json({ error: 'No URLs found in the uploaded file.' });
    }

    const batchId = uuid();
    const mode = req.body.mode || 'dtf_ready';
    const jobs = await createJobsFromUrls(urls, mode, batchId);
    res.json({ batchId, count: jobs.length, jobs });
  } catch (err) {
    next(err);
  }
});

// --- Helpers ----------------------------------------------------------------

/**
 * For each URL, resolve a usable image and create a job. Product pages resolve
 * to their first candidate image; failures still create a "failed" job so the
 * batch report is complete.
 */
async function createJobsFromUrls(urls, mode, batchId) {
  const jobs = [];
  for (const url of urls) {
    try {
      const { images } = await extractImagesFromUrl(url);
      const imageUrl = images[0];
      if (!imageUrl) {
        // Create the job then mark failed so it shows in history/reports.
        const job = createJob({ source: url, sourceType: 'url', mode, batchId });
        job.status = 'failed';
        job.error = 'No image found at URL.';
        jobs.push(job);
        continue;
      }
      const job = createJob({
        source: url,
        sourceType: 'url',
        mode,
        inputUrl: imageUrl,
        batchId,
      });
      enqueue(job.id);
      jobs.push(job);
    } catch (err) {
      const job = createJob({ source: url, sourceType: 'url', mode, batchId });
      job.status = 'failed';
      job.error = err.message;
      jobs.push(job);
    }
  }
  return jobs;
}

/** Pull URL-looking strings out of a CSV or Excel buffer. */
function extractUrlsFromSheet(file) {
  const name = (file.originalname || '').toLowerCase();
  let rows = [];

  if (name.endsWith('.csv')) {
    const records = parseCsv(file.buffer.toString('utf8'), {
      skip_empty_lines: true,
      relax_column_count: true,
    });
    rows = records;
  } else {
    // xlsx / xls
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }

  const urls = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const val = String(cell || '').trim();
      if (/^https?:\/\//i.test(val)) urls.push(val);
    }
  }
  return Array.from(new Set(urls));
}

export default router;
