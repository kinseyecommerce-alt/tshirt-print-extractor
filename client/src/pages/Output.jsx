// ============================================================
// Output / download / editor page for a single completed job.
// Includes export size options, zoom preview, before/after slider, quality
// report, and placeholder editor tools (per the MVP spec).
// ============================================================
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import BeforeAfter from '../components/BeforeAfter.jsx';
import QualityReport from '../components/QualityReport.jsx';
import CropEditor from '../components/CropEditor.jsx';
import { fetchJob, fileUrl, downloadUrl, reprocessJob, sourceUrl } from '../api.js';

const SIZES = [2000, 3000, 4500, 5000];

// Editor tools still stubbed for the first version (manual crop is functional).
const EDITOR_TOOLS = [
  'Rotate',
  'Perspective correction',
  'Magic erase brush',
  'Restore brush',
  'Edge cleanup',
  'Undo / redo',
];

export default function Output() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [reprocessing, setReprocessing] = useState(false);

  const load = () =>
    fetchJob(id)
      .then((d) => setJob(d.job))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [id]);

  // While a re-process is running, poll until it settles again.
  useEffect(() => {
    if (!reprocessing) return;
    const t = setInterval(async () => {
      try {
        const { job: latest } = await fetchJob(id);
        setJob(latest);
        if (latest.status === 'completed' || latest.status === 'failed') {
          setReprocessing(false);
        }
      } catch {
        /* ignore transient errors */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [reprocessing, id]);

  const applyCrop = async (manualCrop) => {
    setReprocessing(true);
    try {
      const { job: updated } = await reprocessJob(id, { manualCrop, mode: job.mode });
      setJob(updated);
    } catch (e) {
      setError(e.message);
      setReprocessing(false);
    }
  };

  const revertToAi = async () => {
    setReprocessing(true);
    try {
      const { job: updated } = await reprocessJob(id, { manualCrop: null, mode: job.mode });
      setJob(updated);
    } catch (e) {
      setError(e.message);
      setReprocessing(false);
    }
  };

  if (error) return <p className="text-red-400">{error}</p>;
  if (!job) return <p className="text-slate-400">Loading…</p>;

  if (job.status !== 'completed') {
    return (
      <div className="space-y-4">
        <Link to="/jobs" className="text-sm text-brand-400">← Back to jobs</Link>
        <div className="card">
          This job is <strong>{job.status}</strong>
          {job.error ? `: ${job.error}` : '…'}
        </div>
      </div>
    );
  }

  const src = fileUrl(job.outputFile);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/jobs" className="text-sm text-brand-400">← Back to jobs</Link>
          <h1 className="mt-1 truncate text-2xl font-semibold" title={job.source}>
            {job.source}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Preview + zoom */}
        <div className="space-y-4 lg:col-span-2">
          {job.kind === 'generate' ? (
            <div className="checkerboard flex items-center justify-center rounded-xl border border-slate-800 p-4">
              <img src={src} alt={job.source} className="max-h-96 max-w-full object-contain" />
            </div>
          ) : (
            <BeforeAfter beforeSrc={sourceUrl(job.id)} afterSrc={src} />
          )}

          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Zoom preview</span>
              <span className="text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <div className="checkerboard mt-3 flex h-72 items-center justify-center overflow-auto rounded-lg">
              <img
                src={src}
                alt="output"
                style={{ transform: `scale(${zoom})` }}
                className="max-h-full max-w-full object-contain transition-transform"
              />
            </div>
          </div>

          {/* Functional manual crop editor (extraction jobs only) */}
          {job.kind !== 'generate' && (
            <CropEditor
              src={sourceUrl(job.id)}
              onApply={applyCrop}
              onReset={revertToAi}
              busy={reprocessing}
            />
          )}

          {/* Remaining editor tools still stubbed for this version */}
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">More editor tools</h3>
            <div className="flex flex-wrap gap-2">
              {EDITOR_TOOLS.map((tool) => (
                <button
                  key={tool}
                  disabled
                  title="Coming soon"
                  className="btn-ghost cursor-not-allowed border border-slate-800 text-xs"
                >
                  {tool}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              These tools are placeholders in this first version.
            </p>
          </div>
        </div>

        {/* Export + quality */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Export</h3>
            <a href={downloadUrl(job.outputFile)} className="btn-primary mb-3 w-full">
              Download PNG (original)
            </a>
            <p className="label">Resize on download (transparent PNG)</p>
            <div className="grid grid-cols-2 gap-2">
              {SIZES.map((size) => (
                <a
                  key={size}
                  href={`${downloadUrl(job.outputFile)}?size=${size}`}
                  className="btn-secondary"
                >
                  {size}px
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">300 DPI metadata is embedded.</p>
          </div>

          <QualityReport quality={job.quality} />

          {job.detection && (
            <div className="card text-xs text-slate-400">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">AI detection</h3>
              <p>Garment: {job.detection.garment_type}</p>
              <p>Print type: {job.detection.print_type}</p>
              <p>Confidence: {Math.round((job.detection.confidence || 0) * 100)}%</p>
              <p>Recommended mode: {job.detection.recommended_mode}</p>
              <p>Source: {job.detection.source}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
