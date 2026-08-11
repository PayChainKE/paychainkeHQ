import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const CHECKLIST_ITEMS = [
  { key: 'legalNameMatch', label: 'Legal business name matches registration documents' },
  { key: 'ubosIdentified', label: 'Directors / Ultimate Beneficial Owners (UBOs) identified' },
  { key: 'kraPinVerified', label: 'KRA PIN verified and active' },
  { key: 'tillVerified', label: 'M-Pesa Till / Paybill number verified against ownership docs' },
  { key: 'businessTypeCompliant', label: 'Business type compliant with PayChain acceptable use policies' },
];

const DOC_LABELS = {
  business_registration: 'Business Registration Certificate',
  kra_pin: 'KRA PIN Certificate',
  national_id: 'National ID / Passport',
  address_proof: 'Proof of Address',
};

const STATUS_META = {
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  requires_revision: { label: 'Requires Revision', pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', pill: 'bg-red-50 text-red-700 border-red-200' },
};

const Workstation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); }, []);

  const fetchApp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/officer/applications/${id}`);
      if (res.data?.success) setApp(res.data.data);
      else setError(res.data?.error || 'Could not load application.');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load application.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);

  const checklistComplete = useMemo(() => CHECKLIST_ITEMS.every((c) => app?.kybChecklist?.[c.key] === true), [app]);
  const canDecide = app && ['pending', 'requires_revision'].includes(app.kybStatus);
  const isClaimedByMe = app?.claimedBy && String(app.claimedBy._id || app.claimedBy) === String(admin?._id);

  async function handleClaim() {
    try {
      const res = await api.post(`/api/officer/applications/${id}/claim`);
      if (res.data?.success) { showToast('Claimed.'); fetchApp(); }
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not claim.'); }
  }

  async function toggleChecklist(key, value) {
    setApp((a) => ({ ...a, kybChecklist: { ...a.kybChecklist, [key]: value } })); // optimistic
    try {
      const res = await api.patch(`/api/officer/applications/${id}/checklist`, { [key]: value });
      if (!res.data?.success) throw new Error(res.data?.error);
    } catch (e) {
      showToast(e?.response?.data?.error || e?.message || 'Could not update checklist.');
      fetchApp();
    }
  }

  async function setDocStatus(docType, status) {
    try {
      const res = await api.patch(`/api/officer/applications/${id}/documents/${docType}`, { status });
      if (res.data?.success) { setApp((a) => ({ ...a, kybDocuments: res.data.data })); }
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not update document.'); }
  }

  async function submitNote() {
    const note = noteText.trim();
    if (!note) return;
    try {
      const res = await api.post(`/api/officer/applications/${id}/notes`, { note });
      if (res.data?.success) { setApp((a) => ({ ...a, kybNotes: res.data.data })); setNoteText(''); }
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not add note.'); }
  }

  async function setRiskTier(riskTier) {
    try {
      const res = await api.patch(`/api/officer/applications/${id}/risk-tier`, { riskTier });
      if (res.data?.success) setApp((a) => ({ ...a, riskTier: res.data.data.riskTier }));
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not set risk tier.'); }
  }

  async function handleApprove() {
    try {
      const res = await api.post(`/api/officer/applications/${id}/approve`);
      if (res.data?.success) { showToast('Approved and activated.'); fetchApp(); }
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not approve.'); }
  }

  async function handleRequestRevision(docTypes, message) {
    try {
      const res = await api.post(`/api/officer/applications/${id}/request-revision`, { docTypes, message });
      if (res.data?.success) { showToast('Revision requested.'); setRevisionOpen(false); fetchApp(); }
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not request revision.'); }
  }

  async function handleReject(note) {
    try {
      const res = await api.post(`/api/officer/applications/${id}/reject`, { note });
      if (res.data?.success) { showToast('Application rejected.'); setRejectOpen(false); fetchApp(); }
      else throw new Error(res.data?.error);
    } catch (e) { showToast(e?.response?.data?.error || e?.message || 'Could not reject.'); }
  }

  if (loading) return <Layout><div className="p-12 text-center text-on-surface-variant/40 text-sm">Loading application…</div></Layout>;
  if (!app) return <Layout><div className="p-12 text-center text-on-surface-variant/40 text-sm">{error || 'Application not found.'}</div></Layout>;

  const statusStyle = STATUS_META[app.kybStatus] || STATUS_META.pending;

  return (
    <Layout>
      <div className="space-y-6 pb-16 max-w-5xl">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">
          <button onClick={() => navigate('/queue')} className="hover:text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Queue
          </button>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">{app.businessName}</h1>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${statusStyle.pill}`}>{statusStyle.label}</span>
              </div>
              <p className="text-xs text-on-surface-variant/60">{app.businessType || 'Business type not set'} {app.businessNumber ? `· Reg #${app.businessNumber}` : ''}</p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <p><span className="text-on-surface-variant/50">Owner:</span> {app.name}</p>
                <p><span className="text-on-surface-variant/50">Phone:</span> {app.phone}</p>
                <p><span className="text-on-surface-variant/50">Email:</span> {app.email}</p>
                <p><span className="text-on-surface-variant/50">KRA PIN:</span> {app.kraPin || '—'}</p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              {app.claimedBy ? (
                <span className="text-2xs font-bold uppercase tracking-widest text-on-surface-variant/50">
                  {isClaimedByMe ? 'Claimed by you' : `Claimed by ${app.claimedBy.name || app.claimedBy.email}`}
                </span>
              ) : canDecide ? (
                <button onClick={handleClaim} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest hover:bg-primary/20">Claim application</button>
              ) : null}
              {app.resubmissionCount > 0 && <span className="text-2xs font-bold uppercase tracking-widest text-blue-700">Resubmitted {app.resubmissionCount}x</span>}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3">KYC Documents</p>
          {app.kybDocuments?.length === 0 ? (
            <p className="text-xs text-on-surface-variant/50">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {app.kybDocuments.map((doc) => (
                <div key={doc.type} className="flex items-center justify-between gap-3 p-3 bg-surface-container-low rounded-lg">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-on-surface">{DOC_LABELS[doc.type] || doc.type}</p>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-2xs text-primary underline">Open document</a>
                    {doc.note && <p className="text-2xs text-on-surface-variant/50 mt-0.5">{doc.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-widest border ${
                      doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      doc.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>{doc.status}</span>
                    {canDecide && (
                      <>
                        <button onClick={() => setDocStatus(doc.type, 'approved')} title="Approve document" className="text-emerald-600 hover:text-emerald-700"><span className="material-symbols-outlined text-lg">check_circle</span></button>
                        <button onClick={() => setDocStatus(doc.type, 'rejected')} title="Flag document" className="text-red-600 hover:text-red-700"><span className="material-symbols-outlined text-lg">cancel</span></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3">Business Premises Photos</p>
          {(app.businessPhotos?.length ?? 0) === 0 ? (
            <p className="text-xs text-on-surface-variant/50">No photos uploaded — optional, not required for approval.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {app.businessPhotos.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-outline-variant/20 hover:opacity-80 transition-opacity">
                  <img src={p.url} alt={`Business photo ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3">Verification Checklist</p>
          <div className="space-y-2.5">
            {CHECKLIST_ITEMS.map((c) => (
              <label key={c.key} className={`flex items-start gap-3 p-2.5 rounded-lg ${canDecide ? 'cursor-pointer hover:bg-surface-container-low' : 'opacity-70'}`}>
                <input
                  type="checkbox"
                  disabled={!canDecide}
                  checked={!!app.kybChecklist?.[c.key]}
                  onChange={(e) => toggleChecklist(c.key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <span className="text-xs text-on-surface">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial">
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3">Internal Notes</p>
          <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
            {(app.kybNotes || []).length === 0 ? (
              <p className="text-xs text-on-surface-variant/40">No notes yet.</p>
            ) : app.kybNotes.map((n, i) => (
              <div key={i} className="p-2.5 bg-surface-container-low rounded-lg">
                <p className="text-xs text-on-surface">{n.note}</p>
                <p className="text-2xs text-on-surface-variant/50 mt-1">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
          {canDecide && (
            <div className="flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Leave a note for the team…" className="flex-1 px-3 py-2 border border-outline-variant/40 rounded-lg text-xs" onKeyDown={(e) => { if (e.key === 'Enter') submitNote(); }} />
              <button onClick={submitNote} className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-2xs font-bold uppercase tracking-widest">Add</button>
            </div>
          )}
        </div>

        {canDecide && (
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 shadow-editorial space-y-4">
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Decision</p>

            <div>
              <label className="block text-2xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1.5">Risk Tier</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map((t) => (
                  <button key={t} onClick={() => setRiskTier(t)} className={`px-3 py-1.5 rounded-lg text-2xs font-bold uppercase tracking-widest border transition-all ${app.riskTier === t ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/70 border-outline-variant/30 hover:border-primary'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline-variant/10">
              <button
                onClick={handleApprove}
                disabled={!checklistComplete || !app.riskTier}
                title={!checklistComplete ? 'Complete the checklist first' : !app.riskTier ? 'Assign a risk tier first' : ''}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Approve & Activate
              </button>
              <button onClick={() => setRevisionOpen(true)} className="px-5 py-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-2xs font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">edit_note</span>
                Request Revision
              </button>
              <button onClick={() => setRejectOpen(true)} className="px-5 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-2xs font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">block</span>
                Reject
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold">{toast}</div>
        )}

        {revisionOpen && <RevisionModal onClose={() => setRevisionOpen(false)} onSubmit={handleRequestRevision} />}
        {rejectOpen && <RejectModal onClose={() => setRejectOpen(false)} onSubmit={handleReject} />}
      </div>
    </Layout>
  );
};

const RevisionModal = ({ onClose, onSubmit }) => {
  const [docTypes, setDocTypes] = useState([]);
  const [message, setMessage] = useState('');

  function toggle(type) {
    setDocTypes((arr) => arr.includes(type) ? arr.filter((t) => t !== type) : [...arr, type]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold tracking-tight text-on-surface mb-1">Request revision</h3>
        <p className="text-xs text-on-surface-variant/60 mb-4">Select which documents need fixing. The applicant gets a link to re-upload just those.</p>
        <div className="space-y-2 mb-4">
          {Object.entries(DOC_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={docTypes.includes(key)} onChange={() => toggle(key)} className="w-4 h-4 accent-primary" />
              {label}
            </label>
          ))}
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's wrong and how to fix it (e.g. 'KRA PIN certificate is blurry')" rows={3} className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-xs mb-4" />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low">Cancel</button>
          <button
            onClick={() => onSubmit(docTypes, message.trim())}
            disabled={docTypes.length === 0 || !message.trim()}
            className="px-5 py-2 rounded-lg bg-amber-600 text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Send revision request
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectModal = ({ onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold tracking-tight text-on-surface mb-1">Reject application</h3>
        <p className="text-xs text-on-surface-variant/60 mb-4">A mandatory internal note is required — it's never shown to the applicant, only kept for the audit log.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejection (internal only)" rows={4} className="w-full px-3 py-2 border border-outline-variant/40 rounded-lg text-xs mb-4" />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-2xs font-bold uppercase tracking-widest text-on-surface-variant/70 hover:bg-surface-container-low">Cancel</button>
          <button
            onClick={() => onSubmit(note.trim())}
            disabled={!note.trim()}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-2xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Confirm rejection
          </button>
        </div>
      </div>
    </div>
  );
};

export default Workstation;
