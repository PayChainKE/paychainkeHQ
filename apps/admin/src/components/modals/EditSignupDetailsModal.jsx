import React from 'react';
import api from '../../api/api';

// Same canonical list as backend/controllers/merchantAuthController.js's
// BUSINESS_TYPES (exported from there, validated against it server-side) —
// mirrored here same as Login.jsx (web) and Login.tsx (mobile) already do,
// so admin-entered values can never drift from what self-serve signup
// itself offers.
const BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Partnership',
  'Limited Liability Company (LLC)',
  'Public Limited Company (PLC)',
  'SACCO',
  'NGO/Non-Profit',
  'Cooperative Society',
  'Other',
];

// Lets an admin fill in (or correct) the signup-details fields self-serve
// registration collects — National ID, business type, county/area/ward/
// street — via PATCH /api/admin/merchants/:id/signup-details. Exists mainly
// for merchants created before these fields existed on the schema (they'd
// otherwise have no way to ever get this data into PayChain), but works for
// any merchant. County/area/ward reuse the exact same public endpoint
// self-serve signup itself calls (GET /api/auth/merchant/locations) so the
// option lists can never drift from what a new signup would see.
export default function EditSignupDetailsModal({ merchant, onClose, onSaved }) {
  const [nationalId, setNationalId] = React.useState(merchant.nationalId || '');
  const [businessType, setBusinessType] = React.useState(merchant.businessType || '');
  const [county, setCounty] = React.useState(merchant.county || '');
  const [area, setArea] = React.useState(merchant.businessArea || '');
  const [ward, setWard] = React.useState(merchant.ward || '');
  const [street, setStreet] = React.useState(merchant.street || '');

  const [areas, setAreas] = React.useState({});
  const [wards, setWards] = React.useState({});
  const [loadingLocations, setLoadingLocations] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/auth/merchant/locations');
        if (!cancelled) {
          setAreas(res.data?.areas || {});
          setWards(res.data?.wards || {});
        }
      } catch {
        if (!cancelled) setError('Could not load the county/area/ward list. You can still save National ID, business type, or street.');
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counties = Object.keys(areas).sort();
  const areaOptions = county ? (areas[county] || []) : [];
  const wardOptions = county && area ? (wards[county]?.[area] || []) : [];

  const handleCountyChange = (v) => { setCounty(v); setArea(''); setWard(''); };
  const handleAreaChange = (v) => { setArea(v); setWard(''); };

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await api.patch(`/api/admin/merchants/${merchant._id}/signup-details`, {
        nationalId: nationalId.trim(),
        businessType,
        county,
        businessArea: area,
        ward,
        street: street.trim(),
      });
      onSaved?.(res.data.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save these details.');
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">edit_location_alt</span>
        </div>
        <h3 className="text-xl font-bold text-on-surface mb-1">Edit Signup Details</h3>
        <p className="text-sm text-on-surface-variant mb-5">
          For <strong>{merchant.businessName}</strong>. Fill in whatever's missing — useful for accounts created before these fields existed, or to correct what's there. Leave a field blank to clear it.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>National ID Number</label>
            <input type="text" inputMode="numeric" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="e.g. 12345678" className={fieldClass} />
          </div>

          <div>
            <label className={labelClass}>Business Type</label>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={fieldClass}>
              <option value="">— Not set —</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>County</label>
              <select value={county} onChange={(e) => handleCountyChange(e.target.value)} disabled={loadingLocations} className={fieldClass}>
                <option value="">— Not set —</option>
                {counties.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Area / Sub-County</label>
              <select value={area} onChange={(e) => handleAreaChange(e.target.value)} disabled={loadingLocations || !county} className={fieldClass}>
                <option value="">— Not set —</option>
                {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Ward (optional)</label>
              <select value={ward} onChange={(e) => setWard(e.target.value)} disabled={loadingLocations || !area || wardOptions.length === 0} className={fieldClass}>
                <option value="">— Not set —</option>
                {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Street (optional)</label>
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. Moi Avenue" className={fieldClass} />
            </div>
          </div>
        </div>

        {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mt-4">{error}</div>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg disabled:opacity-50 transition-all">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
