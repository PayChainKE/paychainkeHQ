import React, { useEffect, useState } from 'react'
import api from '../../api/config'
import { formatKES, formatUSDC } from '../../utils/formatCurrency'
import { EXPLORER_TX_BASE, shortHash, maskPhone } from './explorer'

// Stellar Instaward D2 — "Request Payout". Debits the merchant's Stellar
// testnet wallet on-chain and shows a SIMULATED M-PESA B2C disbursement to
// their registered phone. `rate` is KES per 1 USDC.
export default function RequestPayoutModal({ open, onClose, usdcBalance, rate, phone, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    if (open) { setAmount(''); setError(''); setReceipt(null); setLoading(false) }
  }, [open])

  if (!open) return null

  const numeric = Number(amount)
  const valid = Number.isFinite(numeric) && numeric > 0 && numeric <= usdcBalance
  const kesPreview = rate && numeric > 0 ? numeric * rate : 0

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!(numeric > 0)) return setError('Enter an amount greater than zero.')
    if (numeric > usdcBalance) return setError(`You only have ${formatUSDC(usdcBalance)} in your Stellar wallet.`)
    setLoading(true)
    try {
      const res = await api.post('/api/transactions/wallet/redeem', { usdcAmount: numeric })
      setReceipt(res.data.receipt)
      onSuccess?.(res.data.receipt)
    } catch (err) {
      setError(err.response?.data?.error || 'The payout could not be completed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Request payout">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl p-7 md:p-9 max-h-[92vh] overflow-y-auto">
        {!receipt ? (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="font-headline text-2xl text-primary tracking-tight">Request Payout</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 mt-1">Stellar → M-PESA (simulated)</p>
              </div>
              <button type="button" onClick={onClose} disabled={loading} aria-label="Close" className="text-on-surface-variant/50 hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Amount (USDC)</label>
            <div className="mt-2 flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3">
              <input
                type="number" step="0.01" min="0" inputMode="decimal" autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={loading}
                className="flex-1 bg-transparent border-none outline-none font-headline text-2xl text-primary tabular-nums p-0 focus:ring-0"
              />
              <button type="button" onClick={() => setAmount(String(usdcBalance))} disabled={loading}
                className="text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900">Max</button>
            </div>
            <p className="text-[11px] text-on-surface-variant/60 mt-2">Available: <strong>{formatUSDC(usdcBalance)}</strong></p>

            <div className="mt-6 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-variant/70">You receive (KES)</span><strong className="tabular-nums text-primary">{formatKES(kesPreview)}</strong></div>
              <div className="flex justify-between"><span className="text-on-surface-variant/70">Sent to</span><strong className="text-primary">{maskPhone(phone)}</strong></div>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 mt-3 leading-relaxed">
              Your Stellar wallet is debited on the testnet ledger. The M-PESA disbursement is a simulation — no real money moves.
            </p>

            {error && <p role="alert" className="mt-4 text-[12px] font-bold text-red-600">{error}</p>}

            <button type="submit" disabled={loading || !valid}
              className="mt-6 w-full py-4 rounded-2xl bg-primary text-white text-[12px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? (<><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Debiting your Stellar wallet…</>) : 'Request payout'}
            </button>
          </form>
        ) : (
          <div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <h3 className="font-headline text-2xl text-primary">Payout complete</h3>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mt-1">Simulation — no real money moved</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-on-surface-variant/60">Debited</dt><dd className="font-bold tabular-nums">{formatUSDC(receipt.usdcAmount)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-on-surface-variant/60">M-PESA (simulated)</dt><dd className="font-bold tabular-nums">{formatKES(receipt.kesEquivalent)} → {receipt.destinationPhoneMasked}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-on-surface-variant/60">M-PESA receipt</dt><dd className="font-mono text-[12px]">{receipt.simulatedB2C?.response?.Result?.TransactionID}</dd></div>
              <div className="flex justify-between gap-4 items-start"><dt className="text-on-surface-variant/60 shrink-0">Stellar tx</dt>
                <dd><a href={`${EXPLORER_TX_BASE}${receipt.stellarTxHash}`} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-emerald-700 underline break-all">{shortHash(receipt.stellarTxHash)}</a></dd></div>
              <div className="flex justify-between gap-4 items-start"><dt className="text-on-surface-variant/60 shrink-0">Receipt hash</dt>
                <dd className="font-mono text-[11px] break-all text-right">{shortHash(receipt.receiptHash, 12, 8)}</dd></div>
            </dl>
            <button type="button" onClick={onClose} className="mt-8 w-full py-4 rounded-2xl bg-primary text-white text-[12px] font-black uppercase tracking-widest">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
