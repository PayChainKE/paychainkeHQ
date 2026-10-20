import React from 'react';
import api from '../../api/api';
import { formatKES } from '../../utils/formatCurrency';

// Batch "send remaining balance" — pays every merchant (scope 'all') or a
// selected few (scope 'selected', merchantIds) their remaining balance to
// their PRIMARY phone, minus the standard M-PESA withdrawal fee. One
// 5-letter + 1-digit code emailed to the acting admin approves the whole
// list; payouts then run one at a time server-side and this polls progress.
// See merchantBalancePayoutController.js's bulk endpoints.
//
// Pass batchId alone to open an existing batch's results (history view).

const STATUS_STYLE = {
  queued: 'bg-slate-100 text-slate-600',
  processing: 'bg-blue-50 text-blue-700',
  sent: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
};
const STATUS_LABEL = { queued: 'Queued', processing: 'Sending…', sent: 'Sent', pending: 'Awaiting NCBA', failed: 'Failed' };

export function BatchResults({ batch }) {
  const counts = batch.items.reduce((c, i) => ({ ...c, [i.status]: (c[i.status] || 0) + 1 }), {});
  const done = batch.items.filter((i) => !['queued', 'processing'].includes(i.status)).length;
  const pct = batch.items.length ? Math.round((done / batch.items.length) * 100) : 100;
  const stale = batch.status === 'running' && Date.now() - new Date(batch.updatedAt).getTime() > 10 * 60 * 1000;
  return (
    <>
      <div className="mb-4">
        <div className="flex justify-between text-xs text-on-surface-variant mb-1.5">
          <span>{done} of {batch.items.length} processed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-container overflow-hidden">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-semibold">
          {['sent', 'pending', 'failed', 'queued'].filter((k) => counts[k]).map((k) => (
            <span key={k} className={`px-2 py-0.5 rounded ${STATUS_STYLE[k]}`}>{counts[k]} {STATUS_LABEL[k].toLowerCase()}</span>
          ))}
        </div>
        {stale && (
          <p className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">
            This batch stopped making progress (likely a server restart). "Queued" rows were never sent. Check any "Sending…" row against the NCBA statement before paying that merchant again.
          </p>
        )}
      </div>
      <div className="border border-outline-variant/40 rounded-lg max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {batch.items.map((i) => (
              <tr key={String(i.merchantId)} className="border-b border-outline-variant/30 last:border-b-0">
                <td className="px-3 py-2">
                  <div className="font-semibold text-on-surface">{i.businessName || '—'}</div>
                  <div className="text-[11px] text-on-surface-variant">{i.phone}{i.reference ? ` · ${i.reference}` : ''}</div>
                  {i.error && <div className="text-[11px] text-red-600 mt-0.5">{i.error}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatKES(i.amount)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function BulkSendBalanceModal({ scope, merchantIds = [], batchId: initialBatchId = null, onClose, onFinished }) {
  const [stage, setStage] = React.useState(initialBatchId ? 'progress' : 'preview'); // preview | otp | progress
  const [quote, setQuote] = React.useState(null);
  const [loading, setLoading] = React.useState(!initialBatchId);
  const [showSkipped, setShowSkipped] = React.useState(false);
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [batchId, setBatchId] = React.useState(initialBatchId);
  const [batch, setBatch] = React.useState(null);

  const body = scope === 'all' ? { all: true } : { merchantIds };
  const otpValid = /^[A-Z0-9]{6}$/.test(otp) && (otp.match(/\d/g) || []).length === 1;

  React.useEffect(() => {
    if (initialBatchId) return;
    (async () => {
      try {
        const res = await api.post('/api/admin/merchants/balance-payout/bulk/preview', body);
        setQuote(res.data?.data || null);
      } catch (e) {
        setError(e.response?.data?.error || 'Could not load balances.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the running batch until every row is processed.
  React.useEffect(() => {
    if (!batchId) return undefined;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const res = await api.get(`/api/admin/merchants/balance-payout/bulk/${batchId}`);
        if (cancelled) return;
        const b = res.data?.data;
        setBatch(b);
        if (b?.status === 'running') timer = setTimeout(tick, 2500);
        else if (!initialBatchId) onFinished?.(b);
      } catch (e) {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function requestOtp() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/merchants/balance-payout/bulk/request', body);
      if (res.data?.success) {
        setQuote(res.data.data);
        setStage('otp');
      } else setError(res.data?.error || 'Could not send code.');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not send code.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!otpValid) return setError('The code is 6 characters: 5 letters and 1 digit.');
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/admin/merchants/balance-payout/bulk/confirm', { otp });
      setBatchId(res.data.data.batchId);
      setStage('progress');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not start the batch.');
      if (e.response?.status === 401) { setOtp(''); setStage('preview'); }
    } finally {
      setBusy(false);
    }
  }

  const running = batch?.status === 'running';
  const btnGhost = 'flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low disabled:opacity-40 transition-all';
  const btnMain = 'flex-1 py-2.5 rounded-lg text-white text-sm font-semibold uppercase tracking-widest disabled:opacity-50 transition-all bg-emerald-700 hover:bg-emerald-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={running ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-7">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">{stage === 'otp' ? 'mark_email_unread' : 'groups'}</span>
          </div>

          {stage === 'preview' && (
            <>
              <h3 className="text-xl font-bold text-on-surface mb-1">{scope === 'all' ? 'Pay Every Merchant' : `Pay ${merchantIds.length} Selected Merchant${merchantIds.length === 1 ? '' : 's'}`}</h3>
              <p className="text-sm text-on-surface-variant mb-5">
                Each merchant gets their remaining balance on their <strong>primary phone</strong>, minus the standard M-PESA withdrawal fee (the same as withdrawing it themselves). To send to a different number, use Send on that merchant's row instead.
              </p>
              {loading ? (
                <div className="text-sm text-on-surface-variant py-8 text-center">Calculating balances…</div>
              ) : quote && (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-surface-container-low/60 px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Merchants</div><div className="text-lg font-bold">{quote.items.length}</div></div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-widest text-emerald-800/70">They receive</div><div className="text-lg font-bold text-emerald-800 tabular-nums">{formatKES(quote.totalAmount)}</div></div>
                    <div className="rounded-lg bg-surface-container-low/60 px-3 py-2.5"><div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Fees</div><div className="text-lg font-bold tabular-nums">{formatKES(quote.totalFees)}</div></div>
                  </div>
                  {quote.items.length > 0 && (
                    <div className="border border-outline-variant/40 rounded-lg max-h-56 overflow-y-auto mb-3">
                      <table className="w-full text-xs">
                        <tbody>
                          {quote.items.map((i) => (
                            <tr key={i.merchantId} className="border-b border-outline-variant/30 last:border-b-0">
                              <td className="px-3 py-2"><div className="font-semibold">{i.businessName}</div><div className="text-[11px] text-on-surface-variant">{i.phone} · {i.network === 'airtel' ? 'Airtel' : 'M-PESA'}{i.cappedAtMax ? ' · capped at KES 250k' : ''}</div></td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap"><div className="font-semibold">{formatKES(i.amount)}</div><div className="text-[11px] text-on-surface-variant">fee {formatKES(i.fee)}</div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {quote.skipped.length > 0 && (
                    <div className="mb-3">
                      <button onClick={() => setShowSkipped((v) => !v)} className="text-[12px] font-semibold text-amber-700 hover:underline">
                        {quote.skipped.length} merchant{quote.skipped.length === 1 ? '' : 's'} won't be paid {showSkipped ? '▴' : '▾'}
                      </button>
                      {showSkipped && (
                        <ul className="mt-2 border border-amber-100 bg-amber-50/50 rounded-lg divide-y divide-amber-100 max-h-40 overflow-y-auto text-[12px]">
                          {quote.skipped.map((s) => (
                            <li key={s.merchantId} className="px-3 py-1.5 flex justify-between gap-3"><span className="font-medium">{s.businessName}</span><span className="text-on-surface-variant text-right">{s.reason}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
              {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
              <div className="flex gap-3">
                <button onClick={onClose} disabled={busy} className={btnGhost}>Cancel</button>
                <button onClick={requestOtp} disabled={busy || loading || !quote || quote.items.length === 0} className={btnMain}>{busy ? 'Sending…' : 'Send Code'}</button>
              </div>
            </>
          )}

          {stage === 'otp' && quote && (
            <>
              <h3 className="text-xl font-bold text-on-surface mb-1">Confirm batch payout</h3>
              <p className="text-sm text-on-surface-variant mb-4">
                Paying <strong>{quote.items.length} merchants</strong> a total of <strong>{formatKES(quote.totalAmount)}</strong>. Enter the code we emailed you: <strong>5 letters and 1 digit</strong>. It expires in 10 minutes.
              </p>
              <input
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC1DE"
                className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] px-4 py-4 border-2 border-outline-variant/40 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none mb-3 uppercase"
              />
              {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
              <div className="flex gap-3">
                <button onClick={onClose} disabled={busy} className={btnGhost}>Cancel</button>
                <button onClick={confirm} disabled={busy || !otpValid} className={btnMain}>{busy ? 'Starting…' : 'Pay Everyone Listed'}</button>
              </div>
            </>
          )}

          {stage === 'progress' && (
            <>
              <h3 className="text-xl font-bold text-on-surface mb-1">{running || !batch ? 'Paying merchants…' : 'Batch finished'}</h3>
              <p className="text-sm text-on-surface-variant mb-4">
                {running || !batch
                  ? 'Payouts go out one at a time. You can close this window — the batch keeps running, and you can reopen it from Batch history.'
                  : `Started by ${batch.createdByEmail || 'an admin'} on ${new Date(batch.createdAt).toLocaleString()}. Total approved ${formatKES(batch.totalAmount)}.`}
              </p>
              {batch ? <BatchResults batch={batch} /> : <div className="text-sm text-on-surface-variant py-8 text-center">Starting…</div>}
              <div className="flex gap-3 mt-5">
                <button onClick={onClose} className={btnGhost}>{running ? 'Close (keeps running)' : 'Done'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// List of past/running batches; picking one opens its results.
export function BatchHistoryModal({ onClose, onOpen }) {
  const [batches, setBatches] = React.useState(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    api.get('/api/admin/merchants/balance-payout/bulk')
      .then((res) => setBatches(res.data?.data || []))
      .catch((e) => setError(e.response?.data?.error || 'Could not load batches.'));
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-7">
          <h3 className="text-xl font-bold text-on-surface mb-4">Batch payout history</h3>
          {error && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mb-3">{error}</div>}
          {!batches && !error && <div className="text-sm text-on-surface-variant py-6 text-center">Loading…</div>}
          {batches && batches.length === 0 && <div className="text-sm text-on-surface-variant py-6 text-center">No batch payouts yet.</div>}
          {batches && batches.length > 0 && (
            <ul className="divide-y divide-outline-variant/30 border border-outline-variant/40 rounded-lg mb-4">
              {batches.map((b) => {
                const failed = b.items.filter((i) => i.status === 'failed').length;
                return (
                  <li key={b._id}>
                    <button onClick={() => onOpen(b._id)} className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors flex justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">{b.items.length} merchants · {formatKES(b.totalAmount)}</div>
                        <div className="text-[11px] text-on-surface-variant">{new Date(b.createdAt).toLocaleString()} · {b.createdByEmail || 'admin'} · {b.scope === 'all' ? 'everyone' : 'selected'}</div>
                      </div>
                      <div className="text-right text-[11px] font-semibold whitespace-nowrap">
                        {b.status === 'running' ? <span className="text-blue-700">Running</span> : failed ? <span className="text-red-700">{failed} failed</span> : <span className="text-emerald-700">Done</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-outline-variant/40 text-on-surface text-sm font-semibold uppercase tracking-widest hover:bg-surface-container-low transition-all">Close</button>
        </div>
      </div>
    </div>
  );
}
