// ============================================================
// Manual crop editor.
// ------------------------------------------------------------
// Shows the original source image and lets the user drag a rectangle over the
// print area. On apply, the displayed-pixel selection is converted to source
// image pixel coordinates and handed back via onApply({x,y,width,height}).
// Used as a fallback / correction when AI detection misses the print.
// ============================================================
import { useRef, useState } from 'react';

export default function CropEditor({ src, onApply, onReset, busy }) {
  const imgRef = useRef(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [sel, setSel] = useState(null); // { x, y, w, h } in displayed px
  const drag = useRef(null);

  // Pointer position relative to the image's top-left, clamped to its bounds.
  const relativePoint = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    return { x, y };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const p = relativePoint(e);
    drag.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const p = relativePoint(e);
    const start = drag.current;
    setSel({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const apply = () => {
    if (!sel || !natural || sel.w < 5 || sel.h < 5) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = natural.w / rect.width;
    const scaleY = natural.h / rect.height;
    onApply({
      x: Math.round(sel.x * scaleX),
      y: Math.round(sel.y * scaleY),
      width: Math.round(sel.w * scaleX),
      height: Math.round(sel.h * scaleY),
    });
  };

  return (
    <div className="card">
      <h3 className="mb-1 text-sm font-semibold text-slate-200">Manual crop</h3>
      <p className="mb-3 text-xs text-slate-500">
        Drag a box around the print, then apply. Use this if AI detection missed the design.
      </p>

      <div
        className="relative inline-block max-w-full touch-none select-none overflow-hidden rounded-lg border border-slate-800"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt="source"
          draggable={false}
          onLoad={(e) =>
            setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })
          }
          className="block max-h-[420px] w-auto max-w-full"
        />
        {sel && sel.w > 0 && (
          <div
            className="pointer-events-none absolute border-2 border-brand-500 bg-brand-500/20"
            style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={apply}
          disabled={busy || !sel || sel.w < 5}
          className="btn-primary"
        >
          {busy ? 'Re-extracting…' : 'Apply crop & re-extract'}
        </button>
        <button onClick={() => setSel(null)} disabled={busy} className="btn-secondary">
          Clear selection
        </button>
        <button onClick={onReset} disabled={busy} className="btn-ghost border border-slate-800">
          Revert to AI detection
        </button>
      </div>
    </div>
  );
}
