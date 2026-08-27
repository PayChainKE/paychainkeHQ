import React from 'react';

// Generic inline-edit control for a single text field on a merchant detail
// view — pencil icon -> input + Save/Cancel, matching the pattern first
// built for Merchants.jsx's business name edit. Shared here so it can be
// reused wherever a merchant's editable fields need to appear (currently
// the Merchants page drawer and the KYC/KYB detail page), rather than
// copy-pasted per page.
//
// `onSave(trimmedValue)` must return a Promise resolving to the new display
// value (or reject — its `.response.data.error`, if present, is shown
// inline, same convention as every other admin mutation in this app).
export default function EditableField({ value, onSave, maxLength = 80, placeholder, inputClassName, required = true }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const startEdit = () => {
    setDraft(value || '');
    setError('');
    setEditing(true);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (required && !trimmed) {
      setError('This field is required.');
      return;
    }
    if (trimmed === (value || '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{value || '—'}</span>
        <button
          onClick={startEdit}
          className="p-1 rounded-md text-on-surface-variant/50 hover:text-primary hover:bg-primary/10 transition-all"
          title="Edit"
        >
          <span className="material-symbols-outlined text-[15px]">edit</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap w-full">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus
        disabled={saving}
        className={inputClassName || 'flex-1 min-w-[180px] bg-white border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-on-surface focus:ring-0 focus:border-primary/50 outline-none'}
      />
      <button
        onClick={save}
        disabled={saving}
        className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-md disabled:opacity-50 transition-all"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={() => { setEditing(false); setError(''); }}
        disabled={saving}
        className="px-2.5 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant text-[11px] font-bold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-50 transition-all"
      >
        Cancel
      </button>
      {error && <p className="w-full text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
