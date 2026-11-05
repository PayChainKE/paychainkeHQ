import React from 'react';
import api from '../../api/api';
import InboundBlockReasonPicker, { DEFAULT_REASON } from './InboundBlockReasonPicker';

// Block or allow incoming payments for every selected merchant, or message the
// ones already blocked. One 6-digit code emailed to the acting admin approves
// the whole list. See merchantInboundBlockController.js.
const MODE_COPY = {
  block: { title: 'Block Incoming Payments', confirm: 'Block', doneTitle: 'Incoming payments blocked', icon: 'block' },
  allow: { title: 'Allow Incoming Payments', confirm: 'Allow', doneTitle: 'Incoming payments allowed', icon: 'payments' },
  notify: { title: 'Notify Blocked Merchants', confirm: 'Notify', doneTitle: 'Notices are going out', icon: 'campaign' },
};

export default function BulkInboundBlockModal({ merchantIds, mode, onClose, onDone }) {
  const [stage, setStage] = React.useState('review'); // review | otp | done
  const [preview, setPreview] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showSkipped, setShowSkipped] = React.useState(false);
  const [reason, setReason] = React.useState(DEFAULT_REASON);
  const [notifyExternal, setNotifyExternal] = React.useState(true);
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    api.post('/api/admin/merchants/inbound-block/preview', { merchantIds, mode })
      .then((res) => setPreview(res.data?.data || null))
      .catch((e) => setError(e.response?.data?.error || 'Could not load the selected merchants.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = preview?.items.length || 0;
  const plural = count === 1 ? '' : 's';
  const copy = MODE_COPY[mode];
  const block = mode === 'block';
  const doneCount = result?.changed ?? count;
  const donePlural = doneCount === 1 ? '' : 's';

  async function requestOtp() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/admin/merchants/inbound-block/request', { merchantIds, mode, reason, notifyExternal });
      setStage('otp');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not send code.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/merchants/inbound-block/confirm', { otp });
      setResult(res.data?.data || null);
      setStage('done');
      onDone?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Verification failed.');
      if (e.response?.status === 401) { setOtp(''); setStage('review'); }
    } finally {
      setBusy(false);
    }
  }

  const tone = mode === 'allow'
    ? { ring: 'bg-emerald-50 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700' }
    : { ring: 'bg-amber-50 text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700' };
  const btnGhost = 'flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low transition-colors';
  const btnMain = `flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all ${tone.btn}`;
  const errorBox = error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-7">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${stage === 'done' ? 'bg-emerald-50 text-emerald-700' : stage === 'otp' ? 'bg-blue-50 text-blue-600' : tone.ring}`}>
            <span className="material-symbols-outlined text-3xl">{stage === 'done' ? 'check_circle' : stage === 'otp' ? 'mark_email_unread' : copy.icon}</span>
          </div>

          {stage === 'review' && (
            <>
              <h3 className="text-xl font-bold text-on-surface mb-1">{copy.title}</h3>
              {loading ? (
                <div className="text-sm text-on-surface-variant py-8 text-center">Checking the selected merchants…</div>
              ) : preview && (
                <>
                  <p className="text-sm text-on-surface-variant mb-4">
                    {mode === 'block' && <>No customer will be able to pay <strong>{count} merchant{plural}</strong> through payment links, checkout pages, QR/Pay Account, invoices, Request Money or the API. They can still sign in and withdraw their balance.</>}
                    {mode === 'allow' && <>Customers will be able to pay <strong>{count} merchant{plural}</strong> again through every channel.</>}
                    {mode === 'notify' && <><strong>{count} blocked merchant{plural}</strong> will get an SMS, an email and an in-app notice with this reason. Their in-app banner updates to match. Nothing else about their account changes.</>}
                  </p>
                  {block && (
                    <div className="text-[13px] px-3 py-2.5 rounded-lg mb-4 bg-amber-50 text-amber-800 border border-amber-100">
                      Direct paybill deposits can't be refused before they're sent: M-PESA takes the money first. They're held (not credited) and flagged to admins to refund.
                    </div>
                  )}
                  {count > 0 && (
                    <ul className="border border-outline-variant/40 rounded-lg max-h-40 overflow-y-auto mb-3 divide-y divide-outline-variant/30 text-[13px]">
                      {preview.items.map((i) => <li key={i.merchantId} className="px-3 py-1.5 font-medium text-on-surface">{i.businessName}</li>)}
                    </ul>
                  )}
                  {preview.skipped.length > 0 && (
                    <div className="mb-4">
                      <button onClick={() => setShowSkipped((v) => !v)} className="text-[12px] font-semibold text-amber-700 hover:underline">
                        {preview.skipped.length} selected merchant{preview.skipped.length === 1 ? '' : 's'} won't change {showSkipped ? '▴' : '▾'}
                      </button>
                      {showSkipped && (
                        <ul className="mt-2 border border-amber-100 bg-amber-50/50 rounded-lg divide-y divide-amber-100 max-h-40 overflow-y-auto text-[12px]">
                          {preview.skipped.map((s) => (
                            <li key={s.merchantId} className="px-3 py-1.5 flex justify-between gap-3"><span className="font-medium">{s.businessName}</span><span className="text-on-surface-variant text-right">{s.reason}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {mode !== 'allow' && count > 0 && <InboundBlockReasonPicker value={reason} onChange={setReason} />}
                  {mode !== 'notify' && count > 0 && (
                    <label className="flex items-start gap-2.5 text-[13px] text-on-surface mb-4 cursor-pointer">
                      <input type="checkbox" checked={notifyExternal} onChange={(e) => setNotifyExternal(e.target.checked)} className="mt-0.5 accent-emerald-700" />
                      <span>Also send each merchant an SMS and email. The in-app notice always goes out.</span>
                    </label>
                  )}
                </>
              )}
              {errorBox}
              <div className="flex gap-3">
                <button onClick={onClose} disabled={busy} className={btnGhost}>Cancel</button>
                <button onClick={requestOtp} disabled={busy || loading || count === 0} className={btnMain}>{busy ? 'Sending…' : 'Send Code'}</button>
              </div>
            </>
          )}

          {stage === 'otp' && (
            <>
              <h3 className="text-xl font-bold text-on-surface mb-1">Enter verification code</h3>
              <p className="text-sm text-on-surface-variant mb-5">
                We sent a 6-digit code to your admin email. It expires in 10 minutes and only approves this list of <strong>{count} merchant{plural}</strong>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] px-4 py-4 border-2 border-outline-variant/40 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none mb-4"
              />
              {errorBox}
              <div className="flex gap-3">
                <button onClick={onClose} disabled={busy} className={btnGhost}>Cancel</button>
                <button onClick={confirm} disabled={busy || otp.length !== 6} className={btnMain}>{busy ? 'Verifying…' : `${copy.confirm} ${count}`}</button>
              </div>
            </>
          )}

          {stage === 'done' && (
            <>
              <h3 className="text-xl font-bold text-on-surface mb-1">{copy.doneTitle}</h3>
              <p className="text-sm text-on-surface-variant mb-5">
                {mode === 'block' && `${doneCount} merchant${donePlural} can no longer be paid. Their notices are going out now.`}
                {mode === 'allow' && `${doneCount} merchant${donePlural} can receive payments again.`}
                {mode === 'notify' && `${doneCount} merchant${donePlural} will get their SMS and email over the next few minutes.`}
              </p>
              <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold uppercase tracking-widest">Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
