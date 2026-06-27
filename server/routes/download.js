// ============================================================
// Download routes: single file / batch ZIP / batch CSV report
// ============================================================
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { requireAuth } from '../utils/auth.js';
import { OUTPUTS_DIR, resolveInside } from '../utils/files.js';
import { listBatchJobs, getJob } from '../services/jobStore.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/download/:filename[?size=2000]
 * Download a single generated PNG from the outputs folder. When a `size`
 * query is provided the PNG is resized (longest side) to that width on the
 * fly, keeping transparency and 300 DPI metadata.
 */
router.get('/download/:filename', async (req, res, next) => {
  try {
    const filePath = resolveInside(OUTPUTS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const size = parseInt(req.query.size, 10);
    const allowed = [2000, 3000, 4500, 5000];
    if (size && allowed.includes(size)) {
      const base = req.params.filename.replace(/\.png$/i, '');
      const buffer = await sharp(filePath)
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: false })
        .png({ compressionLevel: 9 })
        .withMetadata({ density: 300 })
        .toBuffer();
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${base}_${size}px.png"`,
      });
      return res.send(buffer);
    }

    res.download(filePath);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/download-zip/:batchId
 * Bundle every completed output of a batch (or a single job id) into a ZIP.
 */
router.get('/download-zip/:batchId', (req, res, next) => {
  try {
    const { batchId } = req.params;

    // Allow passing either a batchId or a single job id.
    let jobs = listBatchJobs(batchId);
    if (jobs.length === 0) {
      const single = getJob(batchId);
      if (single) jobs = [single];
    }

    const completed = jobs.filter((j) => j.status === 'completed' && j.outputFile);
    if (completed.length === 0) {
      return res.status(404).json({ error: 'No completed outputs to download yet.' });
    }

    const zip = new AdmZip();
    for (const job of completed) {
      const filePath = path.join(OUTPUTS_DIR, job.outputFile);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      }
    }

    const buffer = zip.toBuffer();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="prints-${batchId}.zip"`,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/report/:batchId
 * CSV report for a batch: source, status, output file, error message.
 */
router.get('/report/:batchId', (req, res, next) => {
  try {
    const { batchId } = req.params;
    const jobs = listBatchJobs(batchId);
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'No jobs found for this batch.' });
    }

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['source', 'status', 'output_file', 'print_readiness', 'error'];
    const lines = [header.join(',')];
    for (const j of jobs) {
      lines.push(
        [
          esc(j.source),
          esc(j.status),
          esc(j.outputFile || ''),
          esc(j.quality?.printReadinessScore ?? ''),
          esc(j.error || ''),
        ].join(',')
      );
    }

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="report-${batchId}.csv"`,
    });
    res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
