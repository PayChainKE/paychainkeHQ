import React from 'react';

// Generic "view / upload / replace" control for a single document field —
// shared by the Merchants page drawer's Certificate + KYC/KYB Documents
// rows and the KYC/KYB detail page, so the exact same upload UX/behavior
// doesn't have to be reimplemented per page.
//
// `onUpload(file)` must return a Promise resolving to the new document URL
// (or reject — its `.response.data.error`, if present, is shown inline).
//
// `purged`: true when the retention sweep (services/kycDocumentRetentionService.js)
// has deleted this document's underlying Cloudinary file (rejected app,
// 90+ days). `url` is still whatever sentinel the backend left behind at
// that point, which would otherwise render as a dead "View document" link
// — show an explanatory label instead. Uploading a fresh file still works
// normally (replaces the purged placeholder like any other document).
//
// `onDelete`, if given, shows a trash icon (when a real file is on file,
// i.e. not purged) that removes the file with no replacement — the file
// leaves Cloudinary immediately, unlike the 90-day retention sweep above,
// which only ever applies to rejected applications. Optional: a caller with
// no delete endpoint wired (e.g. a context where only replace makes sense)
// just omits it and nothing changes.
export default function UploadableDocRow({ url, onUpload, onDelete, label = 'Document', accept = 'image/png,image/jpeg,image/jpg,application/pdf', purged = false }) {
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
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

  const handleDelete = async () => {
    if (!window.confirm(`Delete this ${label.toLowerCase()}? This removes the file for good — there is no undo.`)) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to delete ${label.toLowerCase()}.`);
    } finally {
      setDeleting(false);
    }
  };

  const busy = uploading || deleting;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-2 flex-wrap">
        {purged
          ? <span className="text-on-surface-variant/50 text-sm italic">File purged (rejected 90+ days ago)</span>
          : url
            ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline text-sm">View document ↗</a>
            : <span className="text-on-surface-variant/50 text-sm">— not uploaded —</span>}
        <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all ${busy ? 'opacity-50 pointer-events-none' : ''} ${url ? 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low' : 'bg-primary/10 text-primary hover:bg-primary/15'}`}>
          <span className="material-symbols-outlined text-[13px]">upload</span>
          {uploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f); }}
          />
        </label>
        {onDelete && url && !purged && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            title={`Delete ${label.toLowerCase()}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-red-200 text-red-700 hover:bg-red-50 transition-all ${busy ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <span className="material-symbols-outlined text-[13px]">delete</span>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
