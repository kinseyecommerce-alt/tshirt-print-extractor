// ============================================================
// T-shirt mockup preview.
// ------------------------------------------------------------
// Places the extracted transparent PNG on a garment silhouette (inline SVG)
// so users can preview the print on different shirt colors. Pure SVG/CSS — no
// external mockup service or API.
// ============================================================
import { useState } from 'react';

const COLORS = [
  { name: 'Navy', value: '#1f2a44' },
  { name: 'Black', value: '#15171c' },
  { name: 'White', value: '#f1f1f1' },
  { name: 'Sand', value: '#cbb893' },
  { name: 'Red', value: '#7c1d24' },
  { name: 'Forest', value: '#1f3d2b' },
];

export default function MockupPreview({ src }) {
  const [color, setColor] = useState(COLORS[0].value);
  const light = color === '#f1f1f1';

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Preview on garment</h3>

      <div className="relative mx-auto w-full max-w-sm">
        {/* Garment silhouette */}
        <svg viewBox="0 0 400 440" className="w-full" role="img" aria-label="t-shirt mockup">
          <path
            d="M140 40 L100 70 L40 110 L70 170 L110 150 L110 410 Q110 420 120 420 L280 420 Q290 420 290 410 L290 150 L330 170 L360 110 L300 70 L260 40 Q230 70 200 70 Q170 70 140 40 Z"
            fill={color}
            stroke={light ? '#d4d4d4' : '#000'}
            strokeOpacity={light ? 0.6 : 0.25}
            strokeWidth="2"
          />
          {/* collar */}
          <path
            d="M140 40 Q170 70 200 70 Q230 70 260 40"
            fill="none"
            stroke={light ? '#d4d4d4' : '#000'}
            strokeOpacity={light ? 0.6 : 0.3}
            strokeWidth="3"
          />
        </svg>

        {/* Print overlay on the chest/back area */}
        <div className="absolute inset-x-0" style={{ top: '22%', height: '52%' }}>
          <div className="mx-auto flex h-full w-[46%] items-center justify-center">
            {src && (
              <img src={src} alt="print" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      </div>

      {/* Color swatches */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            title={c.name}
            className={`h-7 w-7 rounded-full border-2 transition ${
              color === c.value ? 'border-brand-500 scale-110' : 'border-slate-600'
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Approximate preview — placement and scale vary by product.
      </p>
    </div>
  );
}
