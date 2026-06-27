// ============================================================
// Create Design: generate a brand-new print from a text prompt (text -> PNG).
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ModeSelect from '../components/ModeSelect.jsx';
import QualityReport from '../components/QualityReport.jsx';
import { createDesign, fetchJob, fileUrl, downloadUrl } from '../api.js';

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
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('dtf_ready');
  const [size, setSize] = useState('square');
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!prompt.trim()) return setError('Describe the design you want to create.');
    if (!consent) return setError('Please accept the content/usage confirmation.');
    setError('');
    setBusy(true);
    setJob(null);
    try {
      const { job: created } = await createDesign({
        prompt: prompt.trim(),
        mode,
        size,
        confirmOwnership: true,
      });
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
          Generate a brand-new print from a text description — exported as a transparent PNG
          ready for DTF printing. (No garment needed.)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: form */}
        <div className="space-y-4">
          <div>
            <label className="label">Describe your design</label>
            <textarea
              className="input h-28 resize-y"
              placeholder="e.g. A roaring lion head with a crown, bold line art, black and gold"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
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
            {busy ? 'Generating…' : 'Generate Design'}
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
