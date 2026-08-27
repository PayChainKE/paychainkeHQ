import React from 'react';

// Generic "view / upload / replace" control for a single document field —
// shared by the Merchants page drawer's Certificate + KYC/KYB Documents
// rows and the KYC/KYB detail page, so the exact same upload UX/behavior
// doesn't have to be reimplemented per page.
//
// `onUpload(file)` must return a Promise resolving to the new document URL
// (or reject — its `.response.data.error`, if present, is shown inline).
export default function UploadableDocRow({ url, onUpload, label = 'Document', accept = 'image/png,image/jpeg,image/jpg,application/pdf' }) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to upload ${label.toLowerCase()}.`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-2 flex-wrap">
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline text-sm">View document ↗</a>
          : <span className="text-on-surface-variant/50 text-sm">— not uploaded —</span>}
        <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''} ${url ? 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low' : 'bg-primary/10 text-primary hover:bg-primary/15'}`}>
          <span className="material-symbols-outlined text-[13px]">upload</span>
          {uploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f); }}
          />
        </label>
      </div>
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
