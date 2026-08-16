import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const DOC_TYPES = [
  { key: 'business_registration', label: 'Business Registration Certificate' },
  { key: 'kra_pin', label: 'KRA PIN Certificate' },
  { key: 'national_id', label: 'National ID / Passport' },
  { key: 'address_proof', label: 'Proof of Address' },
];

// Mirrors the backend multer limit (backend/utils/cloudinary.js) — checking
// client-side gives an immediate, specific error instead of letting an
// oversized file reach the server and bounce back as a raw non-JSON
// MulterError the submit handler's generic catch can't explain.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Mirrors backend/utils/kraPinValidator.js — same shape check (one leading
// A/P, 9 digits, one trailing letter) plus the same obviously-fake-pattern
// rejection (all nine digits identical, or a strictly ascending/descending
// run like 123456789). This only saves the officer a round trip to the
// server before it's submitted — the backend validator is the actual
// source of truth and rejects the application either way.
const KRA_PIN_SHAPE_REGEX = /^([AP])(\d{9})([A-Z])$/i;
function isValidKraPin(raw) {
  const match = KRA_PIN_SHAPE_REGEX.exec(String(raw || ''));
  if (!match) return false;
  const digits = match[2].split('').map(Number);
  if (digits.every((n) => n === digits[0])) return false;
  let ascending = true, descending = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) ascending = false;
    if (digits[i] !== digits[i - 1] - 1) descending = false;
  }
  return !ascending && !descending;
}

const NewApplication = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', businessName: '', businessType: '', kraPin: '', businessNumber: '' });
  const [files, setFiles] = useState({});
  const [businessPhotos, setBusinessPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function setField(key, value) { setForm((f) => ({ ...f, [key]: value })); }
  function setFile(key, file) { setFiles((f) => ({ ...f, [key]: file })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.kraPin && !isValidKraPin(form.kraPin)) {
      setError('Enter a real KRA PIN — format A/P + 9 digits + a letter, e.g. P051892647A — or leave it blank.');
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) data.append(k, v); });
      Object.entries(files).forEach(([k, f]) => { if (f) data.append(k, f); });
      businessPhotos.forEach((f) => data.append('business_photos', f));

      const res = await api.post('/api/officer/applications', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        navigate(`/applications/${res.data.data._id}`);
      } else {
        setError(res.data?.error || 'Could not submit application.');
      }
    } catch (e2) {
      setError(e2?.response?.data?.error || 'Could not submit application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12 max-w-3xl">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.3em] text-primary/60 mb-1">New KYC Application</p>
          <h1 className="text-2xl md:text-4xl font-bold text-on-surface tracking-tighter font-headline">Onboard a merchant</h1>
          <p className="text-on-surface-variant/60 mt-1 text-sm">Enter the business's details. Documents are optional — you can upload a file, take a photo, or submit without any and add them later.</p>
        </div>

        <form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Owner Name" required>
              <input required value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Owner Email" required>
              <input type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Owner Phone" required>
              <input required value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputClass} placeholder="07XXXXXXXX" />
            </Field>
            <Field label="Business Type">
              <input value={form.businessType} onChange={(e) => setField('businessType', e.target.value)} className={inputClass} placeholder="e.g. Sole Proprietorship" />
            </Field>
            <Field label="Business (Trading) Name" required>
              <input required value={form.businessName} onChange={(e) => setField('businessName', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Business Registration Number">
              <input value={form.businessNumber} onChange={(e) => setField('businessNumber', e.target.value)} className={inputClass} />
            </Field>
            <Field label="KRA PIN">
              <input value={form.kraPin} onChange={(e) => setField('kraPin', e.target.value.toUpperCase())} className={inputClass} placeholder="P051892647A" />
            </Field>
          </div>

          <div className="border-t border-outline-variant/10 pt-5">
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">KYC Documents</p>
            <p className="text-2xs text-on-surface-variant/50 mb-3">Optional — none of these are required to submit. Add what you have now; the rest can be uploaded later.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOC_TYPES.map((d) => (
                <DocUploadField key={d.key} label={d.label} file={files[d.key]} onChange={(f) => setFile(d.key, f)} />
              ))}
            </div>
          </div>

          <div className="border-t border-outline-variant/10 pt-5">
            <p className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Proof of Business Existence</p>
            <p className="text-2xs text-on-surface-variant/50 mb-3">Optional. If the business has a physical location, take a few photos of the shop/premises — used only for admin due diligence, no approval is gated on it.</p>
            <BusinessPhotosField photos={businessPhotos} onChange={setBusinessPhotos} />
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/10">
            <button type="button" onClick={() => navigate('/queue')} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low transition-all">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-lg bg-primary text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">send</span>
              {busy ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

const inputClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';

// Two hidden file inputs behind styled buttons: one plain file picker, one
// with capture="environment" which mobile browsers open directly to the
// camera. Both feed the same onChange — the resulting File is identical
// either way, so the backend/API layer never needs to know which was used.
const DocUploadField = ({ label, file, onChange }) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [sizeError, setSizeError] = useState('');

  const handleSelect = (picked) => {
    if (picked && picked.size > MAX_FILE_SIZE_BYTES) {
      setSizeError(`File is too large (max 10MB). "${picked.name}" is ${(picked.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }
    setSizeError('');
    onChange(picked);
  };

  return (
    <div>
      <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all">
          <span className="material-symbols-outlined text-sm">upload_file</span>
          Upload
        </button>
        <button type="button" onClick={() => cameraInputRef.current?.click()} className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all">
          <span className="material-symbols-outlined text-sm">photo_camera</span>
          Take Photo
        </button>
        {file && (
          <button type="button" onClick={() => { setSizeError(''); onChange(null); }} title="Remove" className="p-2 text-on-surface-variant/40 hover:text-red-600 transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={(e) => handleSelect(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleSelect(e.target.files?.[0] || null)}
        className="hidden"
      />
      {sizeError ? (
        <p className="text-2xs text-red-600 mt-1.5">{sizeError}</p>
      ) : (
        <p className="text-2xs text-on-surface-variant/60 mt-1.5 truncate">{file ? file.name : 'No document selected yet'}</p>
      )}
    </div>
  );
};

// Multi-photo picker for the optional business-premises evidence field.
// "Take Photo" opens the device camera directly (mobile browsers); tapping
// it repeatedly appends another shot. "Upload" accepts a multi-select from
// the file picker for officers working off pre-taken photos.
const BusinessPhotosField = ({ photos, onChange }) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const MAX_PHOTOS = 6;
  const [sizeError, setSizeError] = useState('');

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const oversized = incoming.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setSizeError(`File is too large (max 10MB). "${oversized.name}" is ${(oversized.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }
    setSizeError('');
    onChange([...photos, ...incoming].slice(0, MAX_PHOTOS));
  }
  function removeAt(index) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">upload_file</span>
          Upload
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">photo_camera</span>
          Take Photo
        </button>
        <span className="text-2xs text-on-surface-variant/50">{photos.length}/{MAX_PHOTOS}</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        className="hidden"
      />
      {sizeError && (
        <p className="text-2xs text-red-600 mt-1.5">{sizeError}</p>
      )}
      {photos.length === 0 ? (
        <p className="text-2xs text-on-surface-variant/60 mt-1.5">No photos added — optional, skip if not applicable</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((f, i) => (
            <div key={i} className="relative group">
              <img src={URL.createObjectURL(f)} alt={`Business photo ${i + 1}`} className="w-full h-16 object-cover rounded-lg border border-outline-variant/40" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                title="Remove"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

export default NewApplication;
