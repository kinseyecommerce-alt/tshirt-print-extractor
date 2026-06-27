// ============================================================
// AI mode selector. The five modes map to the backend MODE_CONFIG keys.
// ============================================================
export const MODES = [
  { key: 'dtf_ready', name: 'DTF Ready', desc: 'Sharp transparent PNG with clean edges.' },
  { key: 'clean_png', name: 'Clean PNG', desc: 'Removes fabric texture, wrinkles, shadows.' },
  { key: 'exact_crop', name: 'Exact Crop', desc: 'Keeps original print pixels as-is.' },
  { key: 'text_logo', name: 'Text / Logo', desc: 'Best for typography, logos and icons.' },
  { key: 'ai_recreate', name: 'AI Recreate', desc: 'Reconstructs unclear parts (beta).' },
];

export default function ModeSelect({ value, onChange }) {
  return (
    <div>
      <label className="label">Extraction mode</label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((mode) => {
          const active = value === mode.key;
          return (
            <button
              type="button"
              key={mode.key}
              onClick={() => onChange(mode.key)}
              className={`rounded-lg border p-3 text-left transition ${
                active
                  ? 'border-brand-500 bg-brand-600/10'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <p className="text-sm font-medium text-slate-100">{mode.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{mode.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
