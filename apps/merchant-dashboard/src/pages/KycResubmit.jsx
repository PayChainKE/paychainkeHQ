import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/config'
import mainLogo from '../assets/signin-logo.png'

// Public, unauthenticated page the "Request Revision" email links to
// (backend/controllers/officerController.js#requestRevision builds the link
// as `${MERCHANT_DASHBOARD_URL}/kyc-resubmit?token=...`) — lets an applicant
// re-upload just the specific KYC documents an admin/officer flagged,
// against the existing public endpoints (validateResubmitToken /
// resubmitDocuments) that had no frontend page consuming them until now.
// Single-use token, 7-day expiry, enforced server-side.
const DOC_LABELS = {
  business_registration: 'Business Registration Certificate',
  kra_pin: 'KRA PIN Certificate',
  national_id: 'National ID / Passport',
  address_proof: 'Proof of Address',
}

export default function KycResubmit() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [phase, setPhase] = useState('validating') // validating | invalid | ready | done
  const [businessName, setBusinessName] = useState('')
  const [flagged, setFlagged] = useState([]) // [{ type, note }]
  const [files, setFiles] = useState({}) // { [type]: File }
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setPhase('invalid'); return }
    let cancelled = false
    api.get(`/api/officer/kyc-resubmit/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return
        if (res.data?.success) {
          setBusinessName(res.data.data.businessName)
          setFlagged(res.data.data.flagged || [])
          setPhase('ready')
        } else {
          setPhase('invalid')
        }
      })
      .catch(() => { if (!cancelled) setPhase('invalid') })
    return () => { cancelled = true }
  }, [token])

  const allSelected = flagged.length > 0 && flagged.every((f) => !!files[f.type])

  function handleFile(type, file) {
    setFiles((f) => ({ ...f, [type]: file }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!allSelected) { setErr('Select a replacement file for every document listed below.'); return }
    setSubmitting(true)
    try {
      const formData = new FormData()
      for (const f of flagged) formData.append(f.type, files[f.type])
      const res = await api.post(`/api/officer/kyc-resubmit/${encodeURIComponent(token)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (res.data?.success) {
        setPhase('done')
      } else {
        setErr(res.data?.error || 'Could not submit your documents.')
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not submit your documents.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FDFDFC] px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="bg-[#06201B] px-8 py-7 text-center">
          <img src={mainLogo} alt="PayChain" className="h-9 w-auto mx-auto object-contain" />
          <p className="mt-3 text-emerald-300 text-xs font-bold uppercase tracking-[0.2em]">Document Resubmission</p>
        </div>

        <div className="p-8">
          {phase === 'validating' && (
            <div className="text-center py-10">
              <div className="inline-block w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500 text-sm">Validating your link…</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">link_off</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h2>
              <p className="text-sm text-gray-500 mb-6">This resubmission link is no longer valid — it may have already been used, or it's past its 7-day window. Contact PayChain to request a new one.</p>
              <a href="mailto:support@paychain.co.ke" className="inline-block text-sm font-bold text-[#06201B] underline">support@paychain.co.ke</a>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Documents submitted</h2>
              <p className="text-sm text-gray-500">Thanks — your updated documents are back with the PayChain review team. You'll hear from us once they've been checked.</p>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Update your documents</h2>
              <p className="mt-1 text-sm text-gray-500">
                For <strong className="text-gray-700">{businessName}</strong> — the documents below need to be re-uploaded before review can continue.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {flagged.map((f) => (
                  <div key={f.type} className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                      {DOC_LABELS[f.type] || f.type}
                    </label>
                    {f.note && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 mb-2">{f.note}</p>}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFile(f.type, e.target.files?.[0] || null)}
                      className="block w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {files[f.type] && (
                      <p className="mt-1.5 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        {files[f.type].name}
                      </p>
                    )}
                  </div>
                ))}

                {err && (
                  <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">{err}</div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !allSelected}
                  className="w-full py-3 rounded-lg bg-[#06201B] text-white font-bold text-sm tracking-wide hover:bg-[#0a3029] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit Documents'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">This link works once and only for the documents listed above.</p>
        </div>
      </div>
    </div>
  )
}
