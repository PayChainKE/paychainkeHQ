import React, { useCallback, useEffect, useState } from 'react'
import api from '../../api/config'
import { formatKES, formatUSDC } from '../../utils/formatCurrency'
import { EXPLORER_TX_BASE, shortHash } from './explorer'

const STATUS = {
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  unconfirmed: { label: 'Unconfirmed', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
}
const KIND = { split_settlement: 'Auto-settlement to Stellar', redemption: 'Payout to M-PESA (simulated)' }

// Stellar Instaward D2 — reconciliation table linking every settlement and
// payout to its StellarExpert testnet hash, with a CSV statement download.
export default function ReconciliationTable({ refreshKey = 0 }) {
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/api/transactions/wallet/reconciliation')
      setEntries(res.data.entries || [])
      setTotals(res.data.totals || null)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the reconciliation statement.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  async function downloadCsv() {
    setDownloading(true)
    try {
      const res = await api.get('/api/transactions/wallet/reconciliation.csv', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `paychain-stellar-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not download the statement. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white p-6 md:p-10 rounded-[32px] lg:rounded-[40px] border border-outline-variant/10 shadow-2xl editorial-shadow animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">Settlement Statement</h3>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Reconciled against Stellar testnet</p>
        </div>
        <button type="button" onClick={downloadCsv} disabled={downloading || entries.length === 0}
          className="self-start md:self-auto flex items-center gap-2 px-5 py-3 rounded-xl border border-primary/20 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/5 disabled:opacity-40">
          <span className="material-symbols-outlined text-base">download</span>{downloading ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            ['Settled to Stellar', formatUSDC(totals.settledToStellarUsdc)],
            ['From KES', formatKES(totals.settledToStellarKes)],
            ['Paid out (USDC)', formatUSDC(totals.redeemedUsdc)],
            ['Paid out (KES, simulated)', formatKES(totals.redeemedKes)],
          ].map(([label, value]) => (
            <div key={label} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50">{label}</p>
              <p className="font-headline text-lg text-primary tabular-nums mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-[12px] font-bold text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">
              {['Date', 'Type', 'Status', 'KES', 'USDC', 'Stellar tx', 'Receipt'].map((h) => (
                <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-on-surface-variant/50">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-on-surface-variant/50">No Stellar settlements yet. Set a rule above and receive a payment, or request a payout.</td></tr>
            ) : entries.map((e) => {
              const st = STATUS[e.status] || STATUS.pending
              return (
                <tr key={e._id} className="border-t border-outline-variant/10 hover:bg-gray-50/60">
                  <td className="px-3 py-3 whitespace-nowrap text-on-surface-variant/70">{new Date(e.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{KIND[e.kind] || e.kind}{e.splitPercent ? <span className="text-on-surface-variant/50 font-normal"> · {e.splitPercent}%</span> : null}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span title={e.errorMessage || ''} className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatKES(e.kesAmount)}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatUSDC(e.usdcAmount)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {e.stellarTxHash
                      ? <a href={`${EXPLORER_TX_BASE}${e.stellarTxHash}`} target="_blank" rel="noreferrer" className="font-mono text-emerald-700 underline">{shortHash(e.stellarTxHash)}</a>
                      : <span className="text-on-surface-variant/40">—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap font-mono text-on-surface-variant/70">{e.receiptHash ? shortHash(e.receiptHash, 8, 4) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
