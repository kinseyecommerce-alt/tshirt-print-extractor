// ============================================================
// Bulk URLs: paste line-by-line OR upload a CSV/Excel of product URLs.
// ============================================================
import { useEffect, useState } from 'react';
import ModeSelect from '../components/ModeSelect.jsx';
import Consent from '../components/Consent.jsx';
import Dropzone from '../components/Dropzone.jsx';
import JobList, { BatchProgress } from '../components/JobList.jsx';
import { submitBulkUrls, submitCsvUrls, fetchJobs, zipUrl, reportUrl } from '../api.js';

export default function BulkUrl() {
  const [text, setText] = useState('');
  const [csv, setCsv] = useState(null);
  const [mode, setMode] = useState('dtf_ready');
  const [consent, setConsent] = useState(false);
  const [batchId, setBatchId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const urls = text.split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
    if (!urls.length && !csv) return setError('Paste some URLs or upload a CSV/Excel file.');
    if (!consent) return setError('Please confirm ownership before processing.');
    setError('');
    setBusy(true);
    try {
      let res;
      if (csv) {
        const fd = new FormData();
        fd.append('file', csv);
        fd.append('mode', mode);
        fd.append('confirmOwnership', 'true');
        res = await submitCsvUrls(fd);
      } else {
        res = await submitBulkUrls({ urls, mode, confirmOwnership: true });
      }
      setBatchId(res.batchId);
      setJobs(res.jobs);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!batchId) return;
    const load = async () => {
      try {
        const { jobs: latest } = await fetchJobs(batchId);
        setJobs(latest);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [batchId]);

  const allDone =
    jobs.length > 0 && jobs.every((j) => j.status === 'completed' || j.status === 'failed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk Product URLs</h1>
        <p className="text-sm text-slate-400">
          Paste product URLs (one per line) or upload a CSV/Excel file. Each URL becomes a job.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="label">Paste URLs (one per line)</label>
            <textarea
              className="input h-40 resize-y font-mono text-xs"
              placeholder={'https://store.com/products/a\nhttps://store.com/products/b'}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setCsv(null);
              }}
            />
          </div>
          <p className="text-center text-xs text-slate-500">— or —</p>
          <Dropzone
            accept=".csv,.xlsx,.xls"
            onFiles={(f) => {
              setCsv(f[0]);
              setText('');
            }}
            hint="Upload CSV / Excel containing URLs"
          />
          {csv && <p className="text-sm text-slate-400">File: {csv.name}</p>}

          <ModeSelect value={mode} onChange={setMode} />
          <Consent checked={consent} onChange={setConsent} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Submitting…' : 'Process URLs'}
          </button>
        </div>

        <div className="space-y-4">
          {batchId ? (
            <div className="card">
              <BatchProgress jobs={jobs} />
              {allDone && (
                <div className="mt-4 flex gap-2">
                  <a href={zipUrl(batchId)} className="btn-primary flex-1">
                    Download all (ZIP)
                  </a>
                  <a href={reportUrl(batchId)} className="btn-secondary flex-1">
                    CSV report
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="card flex h-48 items-center justify-center text-sm text-slate-500">
              Batch results will appear here.
            </div>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Batch jobs</h2>
          <JobList jobs={jobs} onChange={() => fetchJobs(batchId).then((d) => setJobs(d.jobs))} />
        </div>
      )}
    </div>
  );
}
