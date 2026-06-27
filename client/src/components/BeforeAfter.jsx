// ============================================================
// Before/after slider. "Before" = source image, "After" = extracted PNG on a
// transparent checkerboard. Drag the handle to compare.
// ============================================================
import { useRef, useState } from 'react';

export default function BeforeAfter({ beforeSrc, afterSrc }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef(null);

  const move = (clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full select-none overflow-hidden rounded-xl border border-slate-800"
      onMouseMove={(e) => e.buttons === 1 && move(e.clientX)}
      onClick={(e) => move(e.clientX)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      {/* After (full) */}
      <div className="checkerboard absolute inset-0 flex items-center justify-center">
        {afterSrc && (
          <img src={afterSrc} alt="Extracted" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {/* Before (clipped to the left of the handle) */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-900"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {beforeSrc && (
          <img src={beforeSrc} alt="Source" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-brand-500"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 px-2 py-1 text-xs text-white">
          ⇆
        </div>
      </div>

      <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        Before
      </span>
      <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        After
      </span>
    </div>
  );
}
