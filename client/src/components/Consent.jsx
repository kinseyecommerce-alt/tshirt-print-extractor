// ============================================================
// Legal/safety ownership checkbox. Processing is blocked until checked.
// ============================================================
export default function Consent({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-sm text-slate-300">
        I confirm I own this design or have permission to extract and reuse it.
      </span>
    </label>
  );
}
