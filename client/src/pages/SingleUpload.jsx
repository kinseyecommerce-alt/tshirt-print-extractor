// ============================================================
// Single image upload -> create job -> live preview + quality report.
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Dropzone from '../components/Dropzone.jsx';
import ModeSelect from '../components/ModeSelect.jsx';
import Consent from '../components/Consent.jsx';
import QualityReport from '../components/QualityReport.jsx';
import BeforeAfter from '../components/BeforeAfter.jsx';
import { uploadSingle, fetchJob, fileUrl, downloadUrl } from '../api.js';

export default function SingleUpload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('dtf_ready');
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickFile = (files) => {
    const f = files[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setJob(null);
    setError('');
  };

  const submit = async () => {
    if (!file) return setError('Please choose an image.');
    if (!consent) return setError('Please confirm ownership before processing.');
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('mode', mode);
      fd.append('confirmOwnership', 'true');
      const { job: created } = await uploadSingle(fd);
      setJob(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Poll the job until it finishes.
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;
    const t = setInterval(async () => {
      try {
        const { job: latest } = await fetchJob(job.id);
        setJob(latest);
      } catch {
        /* ignore transient errors */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [job]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Single Upload</h1>
        <p className="text-sm text-slate-400">
          Upload one garment image and extract the print as a transparent PNG.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: form */}
        <div className="space-y-4">
          <Dropzone onFiles={pickFile} hint="PNG, JPG, WEBP up to 25MB" />
          {preview && (
            <img
              src={preview}
              alt="preview"
              className="max-h-48 rounded-lg border border-slate-800 object-contain"
            />
          )}
          <ModeSelect value={mode} onChange={setMode} />
          <Consent checked={consent} onChange={setConsent} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Uploading…' : 'Extract Print'}
          </button>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {!job && (
            <div className="card flex h-48 items-center justify-center text-sm text-slate-500">
              Your result will appear here.
            </div>
          )}

          {job && job.status !== 'completed' && job.status !== 'failed' && (
            <div className="card flex h-48 items-center justify-center text-sm text-slate-400">
              {job.status === 'processing' ? 'Processing image…' : 'Queued…'}
            </div>
          )}

          {job?.status === 'failed' && (
            <div className="card text-sm text-red-400">Failed: {job.error}</div>
          )}

          {job?.status === 'completed' && (
            <>
              <BeforeAfter beforeSrc={preview} afterSrc={fileUrl(job.outputFile)} />
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
          )}
        </div>
      </div>
    </div>
  );
}
