// ============================================================
// Quality checker panel shown before download.
// ============================================================
function Check({ ok, label }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-1.5 text-sm last:border-0">
      <span className="text-slate-300">{label}</span>
      <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>
        {ok ? '✓ OK' : '⚠ Check'}
      </span>
    </div>
  );
}

export default function QualityReport({ quality }) {
  if (!quality) return null;

  const score = quality.printReadinessScore ?? 0;
  const scoreColor =
    score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Quality Checker</h3>

      <div className="mb-4 flex items-center gap-4">
        <div className={`text-3xl font-bold ${scoreColor}`}>{score}</div>
        <div>
          <p className="text-sm font-medium text-slate-200">Print readiness score</p>
          <p className="text-xs text-slate-400">
            Similarity (placeholder): {quality.similarityScore}%
          </p>
        </div>
      </div>

      <div className="space-y-0">
        <Check ok={quality.transparentBackground} label="Transparent background" />
        <Check ok={!quality.lowResolution} label="Resolution sufficient" />
        <Check ok={!quality.blurDetected} label="Sharpness (no blur)" />
        <Check ok={!quality.fabricTextureRemaining} label="Fabric texture removed" />
        <Check ok={!quality.shadowRemaining} label="Shadows removed" />
        <Check ok={!quality.edgeQualityWarning} label="Edge quality" />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Output size: {quality.width}×{quality.height}px
      </p>

      {quality.warnings?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {quality.warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-400">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
