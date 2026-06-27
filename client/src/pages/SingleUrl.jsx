// ============================================================
// Single product URL -> preview candidate images -> pick front/back -> extract.
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ModeSelect from '../components/ModeSelect.jsx';
import Consent from '../components/Consent.jsx';
import QualityReport from '../components/QualityReport.jsx';
import BeforeAfter from '../components/BeforeAfter.jsx';
import {
  previewUrl,
  submitSingleUrl,
  fetchJob,
  fileUrl,
  downloadUrl,
} from '../api.js';

export default function SingleUrl() {
  const [url, setUrl] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('dtf_ready');
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const doPreview = async () => {
    if (!url.trim()) return setError('Enter a product or image URL.');
    setError('');
    setMessage('');
    setCandidates([]);
    setSelected(null);
    setJob(null);
    setLoadingPreview(true);
    try {
      const res = await previewUrl(url.trim());
      setCandidates(res.images || []);
      if (!res.images?.length) {
        setMessage(res.message || 'No images found. Try uploading the image manually.');
      } else {
        setSelected(res.images[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const submit = async () => {
    if (!selected) return setError('Select a product image first.');
    if (!consent) return setError('Please confirm ownership before processing.');
    setError('');
    setBusy(true);
    try {
      const { job: created } = await submitSingleUrl({
        url: url.trim(),
        imageUrl: selected,
        mode,
        confirmOwnership: true,
      });
      setJob(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Poll the job.
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;
    const t = setInterval(async () => {
      try {
        const { job: latest } = await fetchJob(job.id);
        setJob(latest);
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [job]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Single Product URL</h1>
        <p className="text-sm text-slate-400">
          Paste a product page or direct image URL. We fetch the images so you can pick the
          right one (front/back), then extract the print.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            placeholder="https://store.com/products/cool-tee"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doPreview()}
          />
          <button onClick={doPreview} disabled={loadingPreview} className="btn-secondary sm:w-40">
            {loadingPreview ? 'Fetching…' : 'Fetch images'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Supports Shopify, WooCommerce, OpenGraph pages and direct image links. Amazon/Flipkart/
          Myntra are best-effort and may block scraping.
        </p>
        {message && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{message}</p>
        )}
      </div>

      {/* Candidate image picker */}
      {candidates.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-300">
            Select the correct image ({candidates.length} found)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {candidates.map((img) => (
              <button
                key={img}
                onClick={() => setSelected(img)}
                className={`overflow-hidden rounded-lg border-2 transition ${
                  selected === img ? 'border-brand-500' : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                <img src={img} alt="candidate" className="h-28 w-full bg-slate-900 object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <ModeSelect value={mode} onChange={setMode} />
            <Consent checked={consent} onChange={setConsent} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={submit} disabled={busy} className="btn-primary w-full">
              {busy ? 'Submitting…' : 'Extract Print'}
            </button>
          </div>

          <div className="space-y-4">
            {job?.status === 'completed' ? (
              <>
                <BeforeAfter beforeSrc={selected} afterSrc={fileUrl(job.outputFile)} />
                <div className="flex gap-2">
                  <a href={downloadUrl(job.outputFile)} className="btn-primary flex-1">
                    Download PNG
                  </a>
                  <Link to={`/output/${job.id}`} className="btn-secondary flex-1">
                    Open in viewer
                  </Link>
                </div>
                <QualityReport quality={job.quality} />
              </>
            ) : job ? (
              <div className="card flex h-48 items-center justify-center text-sm text-slate-400">
                {job.status === 'failed' ? `Failed: ${job.error}` : 'Processing…'}
              </div>
            ) : (
              <div className="checkerboard flex h-48 items-center justify-center rounded-xl">
                <img src={selected} alt="selected" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
