// ============================================================
// Reusable job list / cards with status badges, progress and actions.
// ============================================================
import { Link } from 'react-router-dom';
import { fileUrl, downloadUrl, retryJob } from '../api.js';

const STATUS_STYLES = {
  pending: 'bg-slate-700 text-slate-200',
  processing: 'bg-amber-500/20 text-amber-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </span>
  );
}

/** Progress bar reflecting the batch completion ratio. */
export function BatchProgress({ jobs }) {
  if (!jobs?.length) return null;
  const done = jobs.filter((j) => j.status === 'completed' || j.status === 'failed').length;
  const pct = Math.round((done / jobs.length) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>
          {done} / {jobs.length} processed
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function JobList({ jobs, onChange }) {
  const handleRetry = async (id) => {
    await retryJob(id);
    onChange?.();
  };

  if (!jobs?.length) {
    return <p className="text-sm text-slate-500">No jobs yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <div key={job.id} className="card flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-200" title={job.source}>
              {job.source}
            </span>
            <StatusBadge status={job.status} />
          </div>

          <div className="checkerboard mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg">
            {job.status === 'completed' && job.outputFile ? (
              <img
                src={fileUrl(job.outputFile)}
                alt={job.source}
                className="max-h-full max-w-full object-contain"
              />
            ) : job.status === 'failed' ? (
              <span className="px-3 text-center text-xs text-red-300">{job.error}</span>
            ) : (
              <span className="text-xs text-slate-400">
                {job.status === 'processing' ? 'Processing…' : 'Queued…'}
              </span>
            )}
          </div>

          {job.quality && (
            <p className="mb-2 text-xs text-slate-400">
              Readiness:{' '}
              <span className="font-semibold text-slate-200">
                {job.quality.printReadinessScore}/100
              </span>
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2">
            {job.status === 'completed' && (
              <>
                <Link to={`/output/${job.id}`} className="btn-secondary flex-1">
                  Open
                </Link>
                <a href={downloadUrl(job.outputFile)} className="btn-primary flex-1">
                  Download
                </a>
              </>
            )}
            {job.status === 'failed' && (
              <button onClick={() => handleRetry(job.id)} className="btn-secondary flex-1">
                Retry
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
