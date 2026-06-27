// ============================================================
// Bulk upload: multiple images OR a ZIP archive -> batch of jobs.
// ============================================================
import { useEffect, useState } from 'react';
import Dropzone from '../components/Dropzone.jsx';
import ModeSelect from '../components/ModeSelect.jsx';
import Consent from '../components/Consent.jsx';
import JobList, { BatchProgress } from '../components/JobList.jsx';
import { uploadBulk, uploadZip, fetchJobs, zipUrl, reportUrl } from '../api.js';

export default function BulkUpload() {
  const [files, setFiles] = useState([]);
  const [zip, setZip] = useState(null);
  const [mode, setMode] = useState('dtf_ready');
  const [consent, setConsent] = useState(false);
  const [batchId, setBatchId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!files.length && !zip) return setError('Choose images or a ZIP file.');
    if (!consent) return setError('Please confirm ownership before processing.');
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('mode', mode);
      fd.append('confirmOwnership', 'true');
      let res;
      if (zip) {
        fd.append('zip', zip);
        res = await uploadZip(fd);
      } else {
        files.forEach((f) => fd.append('images', f));
        res = await uploadBulk(fd);
      }
      setBatchId(res.batchId);
      setJobs(res.jobs);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Poll the batch until every job is done.
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
        <h1 className="text-2xl font-semibold">Bulk Upload</h1>
        <p className="text-sm text-slate-400">
          Upload many garment images or a ZIP archive. Each image becomes its own job.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Dropzone
            multiple
            onFiles={(f) => {
              setFiles(f);
              setZip(null);
            }}
            hint="Select multiple images"
          />
          <p className="text-center text-xs text-slate-500">— or —</p>
          <Dropzone
            accept=".zip,application/zip"
            onFiles={(f) => {
              setZip(f[0]);
              setFiles([]);
            }}
            hint="Upload a .zip of images"
          />
          {(files.length > 0 || zip) && (
            <p className="text-sm text-slate-400">
              {zip ? `ZIP: ${zip.name}` : `${files.length} image(s) selected`}
            </p>
          )}
          <ModeSelect value={mode} onChange={setMode} />
          <Consent checked={consent} onChange={setConsent} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Uploading…' : 'Process Batch'}
          </button>
        </div>

        <div className="space-y-4">
          {batchId ? (
            <>
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
            </>
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
