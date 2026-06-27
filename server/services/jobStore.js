// ============================================================
// In-memory job store
// ------------------------------------------------------------
// Keeps track of every extraction job. For the Replit MVP this is an
// in-process Map; swapping it for a database or Redis later only requires
// re-implementing these functions.
// ============================================================
import { v4 as uuid } from 'uuid';

/** @typedef {'pending'|'processing'|'completed'|'failed'} JobStatus */

// jobId -> job object
const jobs = new Map();

/**
 * Create and store a new job.
 * @param {object} data
 * @param {string} data.source        - original filename or URL
 * @param {'upload'|'url'} data.sourceType
 * @param {string} data.mode          - AI mode key
 * @param {string} [data.inputPath]   - local path to the source image (if any)
 * @param {string} [data.inputUrl]    - remote image URL (if any)
 * @param {string} [data.batchId]     - groups bulk jobs together
 */
export function createJob(data) {
  const id = uuid();
  const now = new Date().toISOString();
  const job = {
    id,
    source: data.source,
    sourceType: data.sourceType,
    mode: data.mode || 'dtf_ready',
    inputPath: data.inputPath || null,
    inputUrl: data.inputUrl || null,
    batchId: data.batchId || null,
    status: /** @type {JobStatus} */ ('pending'),
    error: null,
    outputFile: null, // filename within outputs/
    detection: null, // OpenAI / heuristic detection result
    quality: null, // quality-checker report
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(id, job);
  return job;
}

/** Return all jobs, newest first. */
export function listJobs() {
  return Array.from(jobs.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/** Return all completed jobs for a given batch. */
export function listBatchJobs(batchId) {
  return listJobs().filter((j) => j.batchId === batchId);
}
