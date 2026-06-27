// ============================================================
// Create Design: generate a brand-new print from a text prompt (text -> PNG).
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ModeSelect from '../components/ModeSelect.jsx';
import QualityReport from '../components/QualityReport.jsx';
import Dropzone from '../components/Dropzone.jsx';
import { createDesign, recreateDesign, fetchJob, fileUrl, downloadUrl } from '../api.js';

const SIZES = [
  { key: 'square', label: 'Square (1:1)' },
  { key: 'portrait', label: 'Portrait (2:3)' },
  { key: 'landscape', label: 'Landscape (3:2)' },
];

const EXAMPLES = [
  'Vintage motorcycle with flames, retro 80s style',
  'Minimal mountain range line art, single color',
  'Cute cartoon astronaut riding a skateboard',
  'Bold typographic quote: STAY WILD, grunge texture',
];

export default function CreateDesign() {
  const [tab, setTab] = useState('generate'); // 'generate' | 'recreate'
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('dtf_ready');
  const [size, setSize] = useState('square');
  const [consent, setConsent] = useState(false);
  const [refFile, setRefFile] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickRef = (files) => {
    setRefFile(files[0]);
    setRefPreview(URL.createObjectURL(files[0]));
  };

  const submit = async () => {
    if (!consent) return setError('Please accept the content/usage confirmation.');
    if (tab === 'recreate' && !refFile) return setError('Upload the print image to recreate.');
    if (tab === 'generate' && !prompt.trim())
      return setError('Describe the design you want to create.');
    setError('');
    setBusy(true);
    setJob(null);
    try {
      let created;
      if (tab === 'recreate') {
        const fd = new FormData();
        fd.append('image', refFile);
        if (prompt.trim()) fd.append('prompt', prompt.trim());
        fd.append('mode', mode);
        fd.append('size', size);
        fd.append('confirmOwnership', 'true');
        ({ job: created } = await recreateDesign(fd));
      } else {
        ({ job: created } = await createDesign({
          prompt: prompt.trim(),
          mode,
          size,
          confirmOwnership: true,
        }));
      }
      setJob(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Poll until the generation finishes.
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
        <h1 className="text-2xl font-semibold">Create Design</h1>
        <p className="text-sm text-slate-400">
          Generate a brand-new print from text, or recreate an existing print from an image —
          exported as a transparent PNG ready for DTF printing.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
        {[
          ['generate', 'Generate new'],
          ['recreate', 'Recreate from image'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setError('');
              setJob(null);
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === key ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: form */}
        <div className="space-y-4">
          {tab === 'recreate' && (
            <div>
              <label className="label">Print image to recreate</label>
              <Dropzone onFiles={pickRef} hint="Upload the garment/print image (a tight crop of just the print works best)" />
              {refPreview && (
                <img
                  src={refPreview}
                  alt="reference"
                  className="mt-2 max-h-40 rounded-lg border border-slate-800 object-contain"
                />
              )}
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Recreate uses AI image editing and requires an OpenAI API key. Only recreate
                designs you own or are licensed to use.
              </p>
            </div>
          )}

          <div>
            <label className="label">
              {tab === 'recreate' ? 'Extra guidance (optional)' : 'Describe your design'}
            </label>
            <textarea
              className="input h-28 resize-y"
              placeholder={
                tab === 'recreate'
                  ? 'Optional: e.g. keep the text crisp, black and white only'
                  : 'e.g. A roaring lion head with a crown, bold line art, black and gold'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            {tab === 'generate' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setPrompt(ex)}
                    className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-brand-500 hover:text-slate-200"
                  >
                    {ex.length > 32 ? ex.slice(0, 32) + '…' : ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Canvas shape</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSize(s.key)}
                  className={`rounded-lg border px-3 py-2 text-xs transition ${
                    size === s.key
                      ? 'border-brand-500 bg-brand-600/10 text-slate-100'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <ModeSelect value={mode} onChange={setMode} />

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-300">
              I will use this generated artwork responsibly and in line with the content policy.
            </span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={busy} className="btn-primary w-full">
            {busy
              ? tab === 'recreate'
                ? 'Recreating…'
                : 'Generating…'
              : tab === 'recreate'
                ? 'Recreate Print'
                : 'Generate Design'}
          </button>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {!job && (
            <div className="card flex h-64 items-center justify-center text-sm text-slate-500">
              Your generated design will appear here.
            </div>
          )}

          {job && job.status !== 'completed' && job.status !== 'failed' && (
            <div className="card flex h-64 flex-col items-center justify-center gap-2 text-sm text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-brand-500" />
              Generating your design…
            </div>
          )}

          {job?.status === 'failed' && (
            <div className="card text-sm text-red-400">Failed: {job.error}</div>
          )}

          {job?.status === 'completed' && (
            <>
              <div className="checkerboard flex items-center justify-center rounded-xl border border-slate-800 p-4">
                <img
                  src={fileUrl(job.outputFile)}
                  alt={job.source}
                  className="max-h-80 max-w-full object-contain"
                />
              </div>
              {job.detection?.source === 'placeholder' && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  No OpenAI key configured — this is a typographic placeholder. Set
                  <code className="mx-1">OPENAI_API_KEY</code> for real AI artwork.
                </p>
              )}
              <div className="flex gap-2">
                <a href={downloadUrl(job.outputFile)} className="btn-primary flex-1">
                  Download PNG
                </a>
                <a
                  href={`${downloadUrl(job.outputFile)}?size=4500`}
                  className="btn-secondary flex-1"
                >
                  Download 4500px
                </a>
              </div>
              <Link to={`/output/${job.id}`} className="btn-ghost w-full border border-slate-800">
                Open in viewer
              </Link>
              <QualityReport quality={job.quality} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
