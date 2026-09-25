import React, { useEffect, useState } from 'react'
import api from '../../api/config'
import { formatKES, formatUSDC } from '../../utils/formatCurrency'

// Stellar Instaward D1 — the merchant's settlement rule: what share of each
// incoming M-PESA payment is auto-routed to their Stellar testnet wallet, and
// what stays liquid in KES. `rate` is KES per 1 USDC (from the live-rate call).
export default function SettlementRuleCard({ rate }) {
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState({ enabled: false, stellarSharePercent: 0 })
  const [enabled, setEnabled] = useState(false)
  const [percent, setPercent] = useState(0)
  const [sample, setSample] = useState(10000)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    api.get('/api/transactions/settlement-rule')
      .then((res) => {
        if (!alive) return
        const rule = res.data?.rule || {}
        setSaved({ enabled: !!rule.enabled, stellarSharePercent: Number(rule.stellarSharePercent) || 0 })
        setEnabled(!!rule.enabled)
        setPercent(Number(rule.stellarSharePercent) || 0)
      })
      .catch((err) => alive && setError(err.response?.data?.error || 'Could not load your settlement rule.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const dirty = enabled !== saved.enabled || percent !== saved.stellarSharePercent
  const stellarKes = Math.round(((Number(sample) || 0) * percent) / 100 * 100) / 100
  const liquidKes = Math.round(((Number(sample) || 0) - stellarKes) * 100) / 100
  const usdcPreview = rate ? stellarKes / rate : 0

  async function handleSave() {
    setError(''); setMessage(''); setSaving(true)
    try {
      const res = await api.put('/api/transactions/settlement-rule', { enabled, stellarSharePercent: percent })
      const rule = res.data.rule
      setSaved({ enabled: rule.enabled, stellarSharePercent: rule.stellarSharePercent })
      setMessage(rule.enabled
        ? `Saved. From the next incoming payment, ${rule.stellarSharePercent}% goes to your Stellar wallet and ${100 - rule.stellarSharePercent}% stays liquid.`
        : 'Saved. Automatic Stellar settlement is switched off — everything stays liquid in KES.')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white p-6 md:p-10 rounded-[32px] lg:rounded-[40px] border border-outline-variant/10 shadow-2xl editorial-shadow animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h3 className="font-headline text-2xl md:text-3xl text-primary tracking-tight">Settlement Rule</h3>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">How incoming M-PESA payments are routed</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">{enabled ? 'On' : 'Off'}</span>
          <button
            type="button" role="switch" aria-checked={enabled} disabled={loading}
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
        </label>
      </div>

      <div className={`transition-opacity ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Retained liquid (KES)</p>
            <p className="font-headline text-3xl text-primary tabular-nums">{100 - percent}%</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Auto-routed to Stellar</p>
            <p className="font-headline text-3xl text-emerald-700 tabular-nums">{percent}%</p>
          </div>
        </div>
        <input
          type="range" min="0" max="100" step="5" value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          aria-label="Percentage of each payment routed to Stellar"
          className="w-full accent-emerald-600 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] font-bold text-on-surface-variant/40 mt-1">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>

        <div className="mt-8 p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-900/60 shrink-0">If a customer pays</label>
            <div className="flex items-center gap-1 bg-white rounded-lg border border-emerald-100 px-3 py-1.5">
              <span className="text-[10px] font-black text-on-surface-variant/40">KES</span>
              <input type="number" min="0" value={sample} onChange={(e) => setSample(e.target.value)}
                className="w-24 bg-transparent border-none outline-none text-sm font-bold text-primary tabular-nums p-0 focus:ring-0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">Stays liquid</p>
              <p className="font-bold text-primary tabular-nums">{formatKES(liquidKes)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">Goes to Stellar</p>
              <p className="font-bold text-emerald-700 tabular-nums">{formatKES(stellarKes)}{rate ? <span className="text-[11px] text-on-surface-variant/60"> ≈ {formatUSDC(usdcPreview)}</span> : null}</p>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-5 text-[12px] font-bold text-red-600">{error}</p>}
      {message && <p className="mt-5 text-[12px] font-bold text-emerald-700">{message}</p>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-[10px] text-on-surface-variant/50 leading-relaxed max-w-md">
          Applies to incoming M-PESA payments. The Stellar share is converted to testnet USDC after your KES is credited, so it never delays a payment notification.
        </p>
        <button
          type="button" onClick={handleSave} disabled={!dirty || saving || loading}
          className="shrink-0 px-6 py-3 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save rule'}
        </button>
      </div>
    </div>
  )
}
