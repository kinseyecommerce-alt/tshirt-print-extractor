// ============================================================
// Simple in-memory job queue
// ------------------------------------------------------------
// A lightweight FIFO worker that processes one job at a time. This keeps the
// Replit deployment dependency-free (no Redis). The public API mirrors what a
// BullMQ-backed queue would expose, so it can be swapped later.
// ============================================================
import { updateJob, getJob } from './jobStore.js';
import { processJob } from './imageProcessor.js';

const queue = [];
let running = false;

/** Add a job id to the processing queue. */
export function enqueue(jobId) {
  queue.push(jobId);
  drain();
}

/** Re-run a job that previously failed. */
export function retry(jobId) {
  const job = getJob(jobId);
  if (!job) return null;
  updateJob(jobId, { status: 'pending', error: null });
  enqueue(jobId);
  return getJob(jobId);
}

/**
 * Re-run a job with new options (a manual crop and/or a different mode).
 * Passing `manualCrop: null` clears a previous crop and reverts to AI detection.
 * @param {string} jobId
 * @param {{mode?:string, manualCrop?:object|null}} opts
 */
export function reprocess(jobId, opts = {}) {
  const job = getJob(jobId);
  if (!job) return null;
  const patch = { status: 'pending', error: null };
  if (opts.mode) patch.mode = opts.mode;
  if ('manualCrop' in opts) patch.manualCrop = opts.manualCrop;
  updateJob(jobId, patch);
  enqueue(jobId);
  return getJob(jobId);
}

/** Process queued jobs sequentially. */
async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const jobId = queue.shift();
      const job = getJob(jobId);
      if (!job) continue;

      updateJob(jobId, { status: 'processing' });
      try {
        const result = await processJob(job);
        updateJob(jobId, {
          status: 'completed',
          outputFile: result.outputFile,
          detection: result.detection,
          quality: result.quality,
          error: null,
        });
      } catch (err) {
        console.error(`[queue] job ${jobId} failed:`, err.message);
        updateJob(jobId, { status: 'failed', error: err.message });
      }
    }
  } finally {
    running = false;
  }
}
