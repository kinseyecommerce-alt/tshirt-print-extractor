// ============================================================
// Drag-and-drop file picker. Works for single or multiple files.
// ============================================================
import { useRef, useState } from 'react';

export default function Dropzone({ multiple = false, accept = 'image/*', onFiles, hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(multiple ? files : [files[0]]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
        dragging
          ? 'border-brand-500 bg-brand-600/10'
          : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
      }`}
    >
      <div className="mb-2 text-3xl">⬆️</div>
      <p className="text-sm font-medium text-slate-200">
        Drag &amp; drop {multiple ? 'files' : 'a file'} here, or click to browse
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
