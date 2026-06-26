import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  businessName: '',
  kraPin: '',
  businessNumber: '',
};

// Human-readable activity label + colours.
const ACTIVITY_STYLE = {
  active:  { label: 'Active',  pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  idle:    { label: 'Idle',    pill: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  dormant: { label: 'Dormant', pill: 'bg-gray-100 text-gray-600 border-gray-200',          dot: 'bg-gray-400' },
};

const ACTION_META = {
  lock:   { label: 'Lock Account',   verb: 'lock',   tone: 'amber',   icon: 'lock',         copy: 'The merchant will be unable to sign in until unlocked. Funds and data remain intact.' },
  unlock: { label: 'Unlock Account', verb: 'unlock', tone: 'emerald', icon: 'lock_open',    copy: 'The merchant will regain access to their dashboard and mobile app.' },
  delete: { label: 'Delete Account', verb: 'delete', tone: 'red',     icon: 'delete_forever', copy: 'The merchant record and ALL related transactions, payouts, payees and payment links will be permanently removed. This cannot be undone.' },
};

function relativeTime(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const Merchants = () => {
  const [merchantsData, setMerchantsData] = useState([]);
  const [merchantStats, setMerchantStats] = useState({
    active: 0, locked: 0, dormant: 0, total: 0, kycVerified: 0,
  });

  // KYB detail drawer
  const [detailMerchant, setDetailMerchant] = useState(null); // full record from /merchants/:id
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Onboarding modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(null);

  // Row action menu (dropdown)
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Sensitive-action confirmation modal
  // stage: 'confirm' (read the warning) -> 'otp' (enter code) -> 'done'
  const [actionState, setActionState] = useState(null); // { merchant, action, stage, otp, error, busy }

  const fetchMerchants = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/merchants');
      if (res.data?.success) {
        const mData = res.data.data;
        setMerchantsData(mData);
        setMerchantStats({
          total: mData.length,
          active: mData.filter((m) => m.status !== 'locked' && m.activityTier === 'active').length,
          locked: mData.filter((m) => m.status === 'locked').length,
          dormant: mData.filter((m) => m.activityTier === 'dormant').length,
          kycVerified: mData.filter((m) => m.isVerified).length,
        });
      }
    } catch (err) {
      console.error('Failed to fetch merchants:', err);
    }
  }, []);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  // Close the row action menu when clicking outside it.
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    if (openMenuId) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openMenuId]);

  function openModal() {
    setForm(emptyForm); setFormError(''); setSuccess(null); setShowModal(true);
  }
  function closeModal() { if (!submitting) setShowModal(false); }
  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function validate() {
    if (!form.name.trim()) return 'Contact name is required.';
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return 'A valid email is required.';
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 9) return 'A valid phone number is required.';
    if (!form.businessName.trim()) return 'Business name is required.';
    if (form.kraPin && !/^[AP][0-9]{9}[A-Z]$/i.test(form.kraPin.trim())) return 'KRA PIN format invalid (e.g. P123456789A).';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    const v = validate();
    if (v) { setFormError(v); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        businessName: form.businessName.trim(),
        kraPin: form.kraPin.trim() || undefined,
        businessNumber: form.businessNumber.trim() || undefined,
      };
      const res = await api.post('/api/admin/merchants', payload);
      if (res.data?.success) {
        setSuccess({
          email: res.data.data.email,
          paybillAccount: res.data.data.paybillAccount,
          businessName: res.data.data.businessName,
        });
        fetchMerchants();
      } else {
        setFormError(res.data?.error || 'Could not create merchant.');
      }
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Could not create merchant.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Sensitive actions ───────────────────────────────────────────────
  function startAction(merchant, action) {
    setOpenMenuId(null);
    setActionState({ merchant, action, stage: 'confirm', otp: '', error: '', busy: false });
  }

  async function requestActionOtp() {
    if (!actionState) return;
    setActionState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const res = await api.post(`/api/admin/merchants/${actionState.merchant._id}/request-action`, {
        action: actionState.action,
      });
      if (res.data?.success) {
        setActionState((s) => ({ ...s, stage: 'otp', busy: false }));
      } else {
        setActionState((s) => ({ ...s, error: res.data?.error || 'Could not send code.', busy: false }));
      }
    } catch (e) {
      setActionState((s) => ({ ...s, error: e?.response?.data?.error || 'Could not send code.', busy: false }));
    }
  }

  async function confirmActionOtp() {
    if (!actionState) return;
    if (!/^\d{6}$/.test(actionState.otp)) {
      setActionState((s) => ({ ...s, error: 'Enter the 6-digit code.' }));
      return;
    }
    setActionState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const res = await api.post(`/api/admin/merchants/${actionState.merchant._id}/confirm-action`, {
        action: actionState.action,
        otp: actionState.otp,
      });
      if (res.data?.success) {
        setActionState((s) => ({ ...s, stage: 'done', busy: false }));
        fetchMerchants();
      } else {
        setActionState((s) => ({ ...s, error: res.data?.error || 'Verification failed.', busy: false }));
      }
    } catch (e) {
      setActionState((s) => ({ ...s, error: e?.response?.data?.error || 'Verification failed.', busy: false }));
    }
  }

  function closeAction() { if (!actionState?.busy) setActionState(null); }

  // ── KYB detail drawer ───────────────────────────────────────────────
  async function openDetail(id) {
    setDetailLoading(true);
    setDetailError('');
    setDetailMerchant({ _id: id }); // open drawer immediately with skeleton
    try {
      const res = await api.get(`/api/admin/merchants/${id}`);
      if (res.data?.success) {
        setDetailMerchant(res.data.data);
      } else {
        setDetailError(res.data?.error || 'Could not load merchant details.');
      }
    } catch (err) {
      console.error('Failed to fetch merchant detail:', err);
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error;
      setDetailError(
        apiMsg
          ? apiMsg
          : status === 404
            ? 'Endpoint not found. The backend needs to be redeployed to expose /api/admin/merchants/:id.'
            : `Could not load merchant details. ${err?.message || ''}`.trim()
      );
    } finally {
      setDetailLoading(false);
    }
  }
  function closeDetail() { setDetailMerchant(null); setDetailError(''); }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-[28px] md:text-[32px] font-bold text-on-surface tracking-tighter font-headline">Merchant Directory</h2>
            <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1">Manage all registered businesses, their activity, and account status.</p>
          </div>
          <button
            onClick={openModal}
            className="w-full sm:w-auto bg-primary text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold hover:shadow-lg transition-all active:scale-95 font-label uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Merchant
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          <StatCard label="Active" value={merchantStats.active} icon="bolt" tone="emerald" />
          <StatCard label="Locked" value={merchantStats.locked} icon="lock" tone="amber" />
          <StatCard label="Dormant" value={merchantStats.dormant} icon="schedule" tone="gray" />
          <StatCard label="Verified" value={merchantStats.kycVerified} icon="verified" tone="secondary" />
          <StatCard label="Total" value={merchantStats.total} icon="storefront" tone="primary" className="col-span-2 md:col-span-1" />
        </div>

        {/* Merchant Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden shadow-editorial">
          <div className="px-4 md:px-6 py-4 border-b border-outline-variant/10 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-[20px]">search</span>
                <input
                  className="pl-10 pr-4 py-2 bg-surface-container-low border-transparent focus:border-secondary focus:ring-0 rounded-lg text-sm w-full transition-all font-body text-on-surface"
                  placeholder="Search till, name or phone..."
                  type="text"
                />
              </div>
              <button className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high rounded-lg transition-colors font-label tracking-tight">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Filters
              </button>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <Th>#</Th>
                  <Th>Merchant</Th>
                  <Th>Contact</Th>
                  <Th>Account #</Th>
                  <Th>Activity</Th>
                  <Th>Status</Th>
                  <Th>Registered</Th>
                  <th className="py-3 px-4 border-b border-outline-variant/10 text-right"></th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {merchantsData.map((m, i) => {
                  const tier = ACTIVITY_STYLE[m.activityTier] || ACTIVITY_STYLE.dormant;
                  const locked = m.status === 'locked';
                  return (
                    <tr key={m._id || i} className={`hover:bg-secondary-container/5 transition-colors group cursor-pointer ${locked ? 'opacity-70' : ''}`} onClick={() => openDetail(m._id)}>
                      <td className="py-3 px-4 text-on-surface-variant/40 border-b border-outline-variant/5">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-3 px-4 border-b border-outline-variant/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center font-bold text-[10px] ring-2 ring-white shadow-sm uppercase">
                            {m.businessName ? m.businessName.substring(0, 2) : 'M'}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface tracking-tight">{m.businessName || 'N/A'}</p>
                            <p className="text-[11px] text-on-surface-variant/60">{m.name || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 border-b border-outline-variant/5">
                        <p className="text-on-surface-variant/80 font-medium">{m.phone}</p>
                        <p className="text-[11px] text-on-surface-variant/60">{m.email}</p>
                      </td>
                      <td className="py-3 px-4 border-b border-outline-variant/5">
                        <span className="font-mono text-[12px] font-bold text-on-surface bg-surface-container-low px-2 py-1 rounded">
                          {m.paybillAccount || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 border-b border-outline-variant/5">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase w-max ${tier.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`}></span>
                            {tier.label}
                          </span>
                          <p className="text-[10px] text-on-surface-variant/60">
                            {m.txnCount30d || 0} txns / 30d · {relativeTime(m.lastActivityAt)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 border-b border-outline-variant/5">
                        {locked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-tight uppercase bg-amber-100 text-amber-800 border-amber-200">
                            <span className="material-symbols-outlined text-[12px]">lock</span> Locked
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-tight uppercase ${
                            m.isVerified ? 'bg-secondary-container/20 text-secondary border-secondary-container/50' : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}>
                            {m.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 border-b border-outline-variant/5 text-on-surface-variant/60">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right border-b border-outline-variant/5 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === m._id ? null : m._id); }}
                          className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant/30 hover:text-secondary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                        </button>
                        {openMenuId === m._id && (
                          <div ref={menuRef} className="absolute right-3 top-10 z-20 w-52 bg-white rounded-xl shadow-xl border border-outline-variant/20 overflow-hidden">
                            <MenuItem icon="visibility" tone="blue" onClick={() => { setOpenMenuId(null); openDetail(m._id); }}>View KYB details</MenuItem>
                            <div className="h-px bg-outline-variant/20"></div>
                            {locked ? (
                              <MenuItem icon="lock_open" tone="emerald" onClick={() => startAction(m, 'unlock')}>Unlock account</MenuItem>
                            ) : (
                              <MenuItem icon="lock" tone="amber" onClick={() => startAction(m, 'lock')}>Lock account</MenuItem>
                            )}
                            <div className="h-px bg-outline-variant/20"></div>
                            <MenuItem icon="delete_forever" tone="red" onClick={() => startAction(m, 'delete')}>Delete account</MenuItem>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {merchantsData.length === 0 && (
                  <tr><td colSpan="8" className="py-8 text-center text-on-surface-variant/40">No merchants found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-surface flex items-center justify-between border-t border-outline-variant/10">
            <p className="text-xs text-on-surface-variant/60 font-body">Showing 1 to {merchantsData.length} of {merchantStats.total} merchants</p>
          </div>
        </div>
      </div>

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[fadeIn_0.18s_ease-out]" onClick={(e) => e.stopPropagation()}>
            {success ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">mark_email_read</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-1">Merchant invited</h3>
                <p className="text-sm text-on-surface-variant mb-5">
                  <strong>{success.businessName}</strong> has been onboarded.<br/>
                  A password-setup link has been emailed to <strong>{success.email}</strong>.
                </p>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-5 inline-block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">Account Number</p>
                  <p className="font-mono text-xl font-bold text-emerald-900">{success.paybillAccount}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
                  <button onClick={() => { setSuccess(null); setForm(emptyForm); }} className="px-5 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low transition-all">Add Another</button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
                  <div>
                    <h3 className="text-base font-bold text-on-surface tracking-tight">Onboard New Merchant</h3>
                    <p className="text-[11px] text-on-surface-variant/60">A setup link will be emailed to the merchant.</p>
                  </div>
                  <button onClick={closeModal} disabled={submitting} className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant/60 disabled:opacity-40">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
                  <Field label="Contact Name" required>
                    <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Jane Wanjiku" className={fieldClass} />
                  </Field>
                  <Field label="Business Name" required>
                    <input type="text" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="Wanjiku General Store" className={fieldClass} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email" required>
                      <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="merchant@example.com" className={fieldClass} />
                    </Field>
                    <Field label="Phone" required>
                      <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0712345678" className={fieldClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="KRA PIN (optional)">
                      <input type="text" value={form.kraPin} onChange={(e) => update('kraPin', e.target.value.toUpperCase())} placeholder="P123456789A" className={`${fieldClass} font-mono`} />
                    </Field>
                    <Field label="Business Reg # (optional)">
                      <input type="text" value={form.businessNumber} onChange={(e) => update('businessNumber', e.target.value)} placeholder="BN-2024-12345" className={fieldClass} />
                    </Field>
                  </div>
                  {formError && <div className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{formError}</div>}
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-[12px] text-amber-800">
                    <strong>Note:</strong> A unique 5-digit account number will be auto-assigned. The merchant receives a secure link (24h) to set their own password.
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
                    <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      {submitting ? 'Inviting…' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sensitive Action Modal (confirm → OTP → done) */}
      {actionState && (
        <ActionModal
          state={actionState}
          onClose={closeAction}
          onConfirm={requestActionOtp}
          onSubmitOtp={confirmActionOtp}
          onOtpChange={(v) => setActionState((s) => ({ ...s, otp: v }))}
        />
      )}

      {/* KYB Detail Drawer */}
      {detailMerchant && (
        <KybDrawer merchant={detailMerchant} loading={detailLoading} error={detailError} onClose={closeDetail} />
      )}
    </Layout>
  );
};

// ── Reusable bits ───────────────────────────────────────────────────────
const fieldClass = 'w-full px-3 py-2.5 border border-outline-variant/40 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none';

const Th = ({ children }) => (
  <th className="py-3 px-4 border-b border-outline-variant/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40">{children}</th>
);

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const StatCard = ({ label, value, icon, tone, className = '' }) => {
  const toneMap = {
    emerald:   'bg-emerald-50 text-emerald-600',
    amber:     'bg-amber-50 text-amber-600',
    red:       'bg-red-50 text-red-600',
    gray:      'bg-surface-container text-on-surface-variant/60',
    secondary: 'bg-secondary-container/20 text-secondary',
    primary:   'bg-primary/10 text-primary',
  };
  return (
    <div className={`bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-premium-glow transition-all hover:scale-[1.02] ${className}`}>
      <div>
        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{label}</p>
        <h3 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{value}</h3>
      </div>
      <div className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center ${toneMap[tone] || toneMap.gray}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  );
};

const MenuItem = ({ icon, tone, onClick, children }) => {
  const toneMap = {
    emerald: 'text-emerald-700 hover:bg-emerald-50',
    amber:   'text-amber-700 hover:bg-amber-50',
    red:     'text-red-700 hover:bg-red-50',
    blue:    'text-blue-700 hover:bg-blue-50',
  };
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left ${toneMap[tone]} transition-colors`}>
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {children}
    </button>
  );
};

const ActionModal = ({ state, onClose, onConfirm, onSubmitOtp, onOtpChange }) => {
  const meta = ACTION_META[state.action];
  const toneRing = {
    amber:   'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-600',
  }[meta.tone];
  const toneBtn = {
    amber:   'bg-amber-600 hover:bg-amber-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    red:     'bg-red-600 hover:bg-red-700',
  }[meta.tone];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {state.stage === 'confirm' && (
          <div className="p-7">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${toneRing}`}>
              <span className="material-symbols-outlined text-3xl">{meta.icon}</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">{meta.label}</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              You're about to <strong>{meta.verb}</strong> <strong>{state.merchant.businessName}</strong> ({state.merchant.email}).
            </p>
            <div className={`text-[13px] px-3 py-2.5 rounded-lg mb-5 ${meta.tone === 'red' ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
              {meta.copy}
            </div>
            <p className="text-[12px] text-on-surface-variant/70 mb-5">For security, a 6-digit verification code will be sent to your admin email to confirm this action.</p>
            {state.error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{state.error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button onClick={onConfirm} disabled={state.busy} className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all ${toneBtn}`}>
                {state.busy ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          </div>
        )}

        {state.stage === 'otp' && (
          <div className="p-7">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">Enter verification code</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              We sent a 6-digit code to your admin email. It expires in 10 minutes and only confirms this single action against <strong>{state.merchant.businessName}</strong>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={state.otp}
              onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] px-4 py-4 border-2 border-outline-variant/40 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none mb-3"
            />
            {state.error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{state.error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={state.busy} className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all">Cancel</button>
              <button onClick={onSubmitOtp} disabled={state.busy || state.otp.length !== 6} className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all ${toneBtn}`}>
                {state.busy ? 'Verifying…' : `Confirm ${meta.label}`}
              </button>
            </div>
          </div>
        )}

        {state.stage === 'done' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-1">
              {state.action === 'delete' ? 'Merchant deleted' : state.action === 'freeze' ? 'Account frozen' : 'Account reactivated'}
            </h3>
            <p className="text-sm text-on-surface-variant mb-5">
              {state.action === 'delete'
                ? `${state.merchant.businessName} and all related records have been permanently removed.`
                : state.action === 'freeze'
                  ? `${state.merchant.businessName} can no longer sign in until reactivated.`
                  : `${state.merchant.businessName} has regained dashboard access.`}
            </p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest hover:shadow-lg active:scale-95 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── KYB Detail Drawer ───────────────────────────────────────────────────
// Right-side slide-over showing every submitted field grouped by purpose so
// the admin can sight-verify the merchant's KYB submission.
const KybDrawer = ({ merchant, loading, error, onClose }) => {
  const m = merchant;
  const ready = !loading && !error && m && m.email;

  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';
  const trunc = (s, n = 10) => !s ? '—' : (s.length <= n * 2 ? s : `${s.slice(0, n)}…${s.slice(-n)}`);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="ml-auto relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl animate-[slideInRight_0.2s_ease-out]">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-outline-variant/20 px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-0.5">KYB Profile</p>
            <h3 className="text-xl font-bold text-on-surface tracking-tight">
              {ready ? m.businessName : 'Loading…'}
            </h3>
            {ready && (
              <p className="text-[12px] text-on-surface-variant/70 mt-0.5">{m.name} · {m.email}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant/60">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-on-surface-variant/60">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm">Loading merchant profile…</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">error</span>
            </div>
            <h4 className="text-base font-bold text-on-surface mb-2">Couldn't load merchant</h4>
            <p className="text-sm text-on-surface-variant max-w-sm mx-auto">{error}</p>
          </div>
        ) : !ready ? null : (
          <div className="p-6 space-y-6">
            {/* Top-line status badges */}
            <div className="flex flex-wrap gap-2">
              <Badge tone={m.status === 'locked' ? 'amber' : 'emerald'} icon={m.status === 'locked' ? 'lock' : 'check_circle'}>
                {m.status === 'locked' ? 'Locked' : 'Active'}
              </Badge>
              <Badge tone={m.isVerified ? 'emerald' : 'gray'} icon={m.isVerified ? 'verified' : 'pending'}>
                {m.isVerified ? 'Account Verified' : 'Unverified'}
              </Badge>
              <Badge tone={m.isKRAVerified ? 'emerald' : 'gray'} icon={m.isKRAVerified ? 'verified_user' : 'help'}>
                {m.isKRAVerified ? 'KRA Verified' : 'KRA Not Verified'}
              </Badge>
              <Badge tone={(ACTIVITY_STYLE[m.activityTier] || ACTIVITY_STYLE.dormant).pillTone || 'gray'} icon="bolt">
                {ACTIVITY_STYLE[m.activityTier]?.label || 'Dormant'}
              </Badge>
            </div>

            {/* Business Identity */}
            <Section title="Business Identity" icon="storefront">
              <Row label="Business Name" value={m.businessName} />
              <Row label="KRA PIN" value={m.kraPin} mono badge={m.isKRAVerified ? { tone: 'emerald', text: 'Verified' } : { tone: 'gray', text: 'Not verified' }} />
              <Row label="Business Reg #" value={m.businessNumber} mono />
              <Row label="Certificate" value={m.certificateUrl
                ? <a href={m.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline">View document ↗</a>
                : '— not uploaded —'} />
            </Section>

            {/* Contact */}
            <Section title="Primary Contact" icon="person">
              <Row label="Full Name" value={m.name} />
              <Row label="Email" value={m.email} />
              <Row label="Phone" value={m.phone} mono />
            </Section>

            {/* Account */}
            <Section title="PayChain Account" icon="account_balance_wallet">
              <Row label="Account Number" value={<span className="font-mono font-bold text-base text-on-surface bg-surface-container-low px-2 py-1 rounded">{m.paybillAccount || '—'}</span>} />
              <Row label="Paybill" value={<span className="font-mono">400200</span>} />
              <Row label="Registration Source" value={m.registrationSource === 'mobile' ? 'Mobile App' : 'Web Dashboard'} />
              <Row label="Registered" value={fmtDate(m.createdAt)} />
              {m.invitedBy?.email && <Row label="Onboarded By" value={m.invitedBy.email} />}
              {m.status === 'locked' && (
                <>
                  <Row label="Locked At" value={fmtDate(m.lockedAt)} />
                  {m.lockedBy?.email && <Row label="Locked By" value={m.lockedBy.email} />}
                </>
              )}
            </Section>

            {/* Settlement */}
            <Section title="Settlement Channels" icon="account_balance">
              <Row label="Settlement Mobile" value={m.settlementMobile} mono />
              <Row label="Bank Name" value={m.settlementBankName} />
              <Row label="Bank Account" value={m.settlementBankAccount} mono />
            </Section>

            {/* Wallet */}
            <Section title="Stellar Wallet" icon="key_visualizer">
              <Row
                label="Stellar Public Key"
                value={m.stellarPublicKey
                  ? <span className="font-mono text-[12px] break-all">{m.stellarPublicKey}</span>
                  : '— wallet not provisioned —'}
              />
              <Row label="USDC Balance" value={`${(m.usdcBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`} />
              <Row label="KES Balance" value={`KES ${(m.kesBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <Row label="Encrypted Secret" value={m.hasStellarKey ? <Badge tone="emerald" icon="check">Stored (encrypted)</Badge> : <Badge tone="gray" icon="remove">Not set</Badge>} />
            </Section>

            {/* Activity */}
            <Section title="Activity" icon="trending_up">
              <Row label="Activity Tier" value={<Badge tone={(ACTIVITY_STYLE[m.activityTier]?.dot || '').includes('emerald') ? 'emerald' : (ACTIVITY_STYLE[m.activityTier]?.dot || '').includes('amber') ? 'amber' : 'gray'}>{ACTIVITY_STYLE[m.activityTier]?.label || 'Dormant'}</Badge>} />
              <Row label="Last Login" value={fmtDate(m.lastLogin)} />
              <Row label="Login Count" value={(m.loginCount ?? 0).toLocaleString()} />
              <Row label="Last Activity" value={fmtDate(m.lastActivityAt)} />
              <Row label="Transactions (30d)" value={(m.txnCount30d ?? 0).toLocaleString()} />
              {m.lastTransaction && (
                <Row label="Last Transaction" value={
                  <span>KES {Number(m.lastTransaction.amount || 0).toLocaleString()} · <span className="text-on-surface-variant/60">{fmtDate(m.lastTransaction.createdAt)}</span> · <span className="uppercase text-[10px] font-bold tracking-widest text-on-surface-variant/60">{m.lastTransaction.status}</span></span>
                } />
              )}
            </Section>

            {/* Security flags */}
            <Section title="Security & Access" icon="shield">
              <Row label="Dashboard Password" value={<Badge tone={m.hasPassword ? 'emerald' : 'amber'} icon={m.hasPassword ? 'check' : 'pending'}>{m.hasPassword ? 'Set' : 'Not set (pending setup)'}</Badge>} />
              <Row label="Mobile App PIN" value={<Badge tone={m.hasAppPin ? 'emerald' : 'gray'} icon={m.hasAppPin ? 'check' : 'remove'}>{m.hasAppPin ? 'Configured' : 'Not set'}</Badge>} />
              <Row label="Bulk Pay PIN" value={<Badge tone={m.hasBulkPayPin ? 'emerald' : 'gray'} icon={m.hasBulkPayPin ? 'check' : 'remove'}>{m.hasBulkPayPin ? 'Configured' : 'Not set'}</Badge>} />
              <Row label="Biometrics" value={<Badge tone={m.biometricsEnabled ? 'emerald' : 'gray'} icon={m.biometricsEnabled ? 'check' : 'remove'}>{m.biometricsEnabled ? 'Enabled' : 'Disabled'}</Badge>} />
            </Section>
          </div>
        )}
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
};

const Section = ({ title, icon, children }) => (
  <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-low flex items-center gap-2">
      <span className="material-symbols-outlined text-on-surface-variant/60 text-[18px]">{icon}</span>
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/80">{title}</h4>
    </div>
    <div className="divide-y divide-outline-variant/10">{children}</div>
  </div>
);

const Row = ({ label, value, mono, badge }) => (
  <div className="px-4 py-3 grid grid-cols-3 gap-3 items-start">
    <div className="text-[12px] font-semibold text-on-surface-variant/60 uppercase tracking-wide">{label}</div>
    <div className="col-span-2 text-[14px] text-on-surface flex items-center gap-2 flex-wrap">
      <span className={mono ? 'font-mono' : ''}>{value ?? '—'}</span>
      {badge && (
        <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${
          badge.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : badge.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
        }`}>{badge.text}</span>
      )}
    </div>
  </div>
);

const Badge = ({ tone, icon, children }) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    gray:    'bg-gray-50 text-gray-600 border-gray-200',
    red:     'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${toneMap[tone] || toneMap.gray}`}>
      {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
      {children}
    </span>
  );
};

export default Merchants;
