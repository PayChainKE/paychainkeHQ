import React, { useState } from 'react';

export default function FileUploadCard({ label, accept = ['pdf', 'jpg', 'png'], onFile }) {
  const [file, setFile] = useState(null);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    onFile && onFile(f);
  }

  return (
    <label className="block p-4 rounded-2xl border border-white/10 bg-white/5 cursor-pointer">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-3 text-xs text-slate-300">Drag PDF/JPG/PNG or click to browse</div>
      <input type="file" accept={accept.map(a=>'.'+a).join(',')} className="hidden" onChange={handleFile} />
      {file && <div className="mt-2 text-xs text-emerald-400">{file.name} • {(file.size/1024).toFixed(1)} KB</div>}
    </label>
  );
}
