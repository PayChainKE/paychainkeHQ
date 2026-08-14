import React, { useState } from 'react'
import axios from 'axios'
import { jsPDF } from 'jspdf'
import { formatKES } from '../../utils/formatCurrency'
import { formatTxDate, formatTxTime } from '../../utils/formatDate'
import { useNotification } from '../../context/NotificationContext'
import statementLogo from '../../assets/paychain-logo-white.png'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const STATUS_LABEL = { completed: 'Completed', success: 'Completed', pending: 'Processing' }

// Shared bank-grade success card for every outbound payment flow (Send
// Money, Wallet withdrawals, and any future rail) — replaces the
// per-page ad-hoc "Transfer Sent" blocks that only showed amount +
// recipient with no transaction ID, timestamp, or way to save/download.
//
// `transaction` is the Mongoose Transaction doc most payout endpoints
// already return (`{ reference, createdAt, status }`) — reference/createdAt
// fall back to a client-generated id/now so the card still renders sanely
// if a caller doesn't have one. `recipientDisplay` is passed explicitly by
// the caller rather than read off transaction.recipient.name, since that
// field holds a UI label ("Any M-PESA Number") for mobile payouts, not an
// actual recipient — see mpesaController.js#initiateB2C.
//
// `payeeDraft` is a ready-to-POST body for /api/bulkpay/payees (reusing the
// existing BulkPay recipient book); pass null to hide the favourites button
// for a flow that can't build one yet.
export default function TransactionSuccessCard({
  amount,
  methodLabel,
  recipientDisplay,
  transaction,
  payeeDraft,
  onViewTransactions,
  onDone,
  doneLabel = 'Back to Dashboard',
}) {
  const { addNotification } = useNotification()
  const [savingFavourite, setSavingFavourite] = useState(false)
  const [savedFavourite, setSavedFavourite] = useState(false)

  const reference = transaction?.reference || '—'
  const createdAt = transaction?.createdAt || new Date().toISOString()
  const statusKey = (transaction?.status || 'completed').toLowerCase()
  const statusLabel = STATUS_LABEL[statusKey] || (statusKey.charAt(0).toUpperCase() + statusKey.slice(1))
  const isPending = statusKey === 'pending'

  const handleAddFavourite = async () => {
    if (!payeeDraft || savingFavourite || savedFavourite) return
    setSavingFavourite(true)
    try {
      const token = localStorage.getItem('paychain_merchant_token')
      await axios.post(`${API_URL}/api/bulkpay/payees`, payeeDraft, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSavedFavourite(true)
      addNotification({ type: 'success', title: 'Saved to Favourites', message: `${payeeDraft.name} added for quick reuse next time.` })
    } catch (e) {
      addNotification({ type: 'error', title: 'Could Not Save', message: e.response?.data?.message || 'Failed to save this recipient.' })
    } finally {
      setSavingFavourite(false)
    }
  }

  const handleDownloadReceipt = () => {
    const doc = new jsPDF({ unit: 'mm', format: [148, 210] }) // A5
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(22, 39, 35) // #162723
    doc.rect(0, 0, pageWidth, 40, 'F')
    const logoW = 42, logoH = logoW * (230 / 968)
    try { doc.addImage(statementLogo, 'PNG', (pageWidth / 2) - (logoW / 2), 7, logoW, logoH) } catch (_) {}
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYMENT RECEIPT', pageWidth / 2, 35, { align: 'center' })

    // Transaction ID
    doc.setTextColor(22, 39, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('TRANSACTION ID', 20, 55)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(reference, 20, 62)

    doc.setDrawColor(230, 230, 230)
    doc.line(20, 68, pageWidth - 20, 68)

    // Details grid
    const labelY = 80, valueY = 87
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('DATE & TIME', 20, labelY)
    doc.text('PAID TO', 20, labelY + 20)
    doc.text('METHOD', 20, labelY + 40)
    doc.text('STATUS', 20, labelY + 60)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text(`${formatTxDate(createdAt)}, ${formatTxTime(createdAt)}`, 20, valueY)
    doc.text(String(recipientDisplay || '—'), 20, valueY + 20)
    doc.text(String(methodLabel || '—'), 20, valueY + 40)
    doc.text(statusLabel.toUpperCase(), 20, valueY + 60)

    // Amount
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('AMOUNT PAID', 85, labelY)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text(formatKES(amount), 85, valueY + 2)

    // Verification strip
    doc.setFillColor(245, 247, 249)
    doc.rect(20, 155, pageWidth - 40, 15, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text('VERIFIED · SECURED BY PAYCHAIN', pageWidth / 2, 164, { align: 'center' })

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'italic')
    doc.text('This receipt confirms an outbound payment initiated via PayChain.', pageWidth / 2, 185, { align: 'center' })

    doc.save(`PayChain_Receipt_${reference}.pdf`)
    addNotification({ type: 'success', title: 'Receipt Downloaded', message: `Receipt for ${reference} saved.` })
  }

  return (
    <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden animate-fade-in-up">
      <div className="p-7 lg:p-9 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-lg border-4 border-emerald-200/40">
          <span className="material-symbols-outlined text-emerald-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <h2 className="font-headline text-3xl font-bold text-primary tracking-tight mb-1">Transaction Successful</h2>
        <p className="font-headline text-4xl font-bold text-[#00351D] tracking-tight mt-3 mb-4">{formatKES(amount)}</p>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          {statusLabel}
        </span>
      </div>

      <div className="mx-7 lg:mx-9 border-t border-dashed border-slate-200"></div>

      <div className="p-7 lg:p-9 space-y-4">
        {[
          { label: 'Date & Time', value: `${formatTxDate(createdAt)} · ${formatTxTime(createdAt)}` },
          { label: 'Transaction ID', value: reference, mono: true },
          { label: 'Paid To', value: recipientDisplay || '—' },
          { label: 'Method', value: methodLabel || '—' },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 shrink-0">{row.label}</span>
            <span className={`text-sm font-bold text-primary text-right truncate ${row.mono ? 'font-mono tracking-tight' : ''}`}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="mx-7 lg:mx-9 border-t border-dashed border-slate-200"></div>

      <div className="p-7 lg:p-9 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleAddFavourite}
            disabled={!payeeDraft || savingFavourite || savedFavourite}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider border-2 border-slate-100 text-primary hover:border-emerald-200 hover:bg-emerald-50/50 transition-all disabled:opacity-40 disabled:hover:border-slate-100 disabled:hover:bg-transparent"
          >
            {savingFavourite ? (
              <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-lg" style={savedFavourite ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {savedFavourite ? 'favorite' : 'favorite_border'}
              </span>
            )}
            {savedFavourite ? 'Saved' : 'Favourite'}
          </button>
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider border-2 border-slate-100 text-primary hover:border-emerald-200 hover:bg-emerald-50/50 transition-all"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Receipt
          </button>
        </div>

        {onViewTransactions && (
          <button
            onClick={onViewTransactions}
            className="w-full py-4 bg-[#00351D] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            View Transactions
          </button>
        )}
        {onDone && (
          <button
            onClick={onDone}
            className="w-full py-3 text-primary/50 font-bold text-sm hover:text-primary transition-colors"
          >
            {doneLabel}
          </button>
        )}
      </div>
    </div>
  )
}
