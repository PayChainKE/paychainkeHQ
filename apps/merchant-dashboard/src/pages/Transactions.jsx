import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import CalendarRangePicker from '../components/ui/CalendarRangePicker'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { formatDateISO, formatTxDate, formatTxTime } from '../utils/formatDate'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { formatAccountNumber } from '../utils/formatAccountNumber'
import { formatPhoneDisplay, formatPhoneOrDash } from '../utils/formatPhoneDisplay'
import { formatName } from '../utils/formatName'
import { drawBarcodePdf } from '../utils/barcode'
import { getAmountSign, getAmountColorClass, isCreditTransaction, isDebitTransaction, netBalanceImpact, excludeReversedDuplicates } from '../utils/transactionDirection'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useNotification } from '../context/NotificationContext'
import logo from '../assets/logo2.png'
import statementLogo from '../assets/paychain-logo-white.png'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const PAYCHAIN_PHONE = '+254 743 283 782'
const PAYCHAIN_SLOGAN = 'Collect, Pay, Protect, Grow'

export default function Transactions() {
  const { merchant, liveEventAt } = useMerchantAuth()
  const { showAmounts } = usePrivacyMode()
  const { addNotification } = useNotification()
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)
  const [liveTransactions, setLiveTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTransactions = React.useCallback(async () => {
    if (!merchant) return;
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('paychain_merchant_token');
      const res = await axios.get(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Drops any duplicate-credit + its correction entry as a matched pair
      // at the source, so every downstream total/statement/table in this
      // file is automatically clean — see excludeReversedDuplicates' doc
      // comment (utils/transactionDirection.js).
      setLiveTransactions(excludeReversedDuplicates(res.data));
    } catch (err) {
      console.error('Failed to load transactions', err);
      setLiveTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [merchant]);

  // Initial load
  useEffect(() => {
    if (merchant) {
      fetchTransactions();
    } else {
      setLiveTransactions([]);
      setIsLoading(false);
    }
  }, [merchant, fetchTransactions]);

  // Poll every 5s so the transaction list stays live without a manual
  // refresh — fallback for whatever the live push below doesn't catch.
  useEffect(() => {
    if (!merchant) return;
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, [merchant, fetchTransactions]);

  // Live push — refetch immediately the instant PayChain changes anything
  // on this account (see MerchantAuthContext's SSE connection), instead of
  // waiting up to 3s for the poll above.
  useEffect(() => {
    if (!merchant || !liveEventAt) return;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEventAt]);

  // Also refresh instantly when the user returns to the tab
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchTransactions(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchTransactions]);
  
  const filteredRows = liveTransactions.filter(t => {
    const matchesSearch = !searchQuery || 
      (t.sender?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.recipient?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reference || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'All') return matchesSearch
    if (activeTab === 'Inbound') return matchesSearch && isCreditTransaction(t.type)
    if (activeTab === 'Outbound') return matchesSearch && isDebitTransaction(t.type)
    if (activeTab === 'FX Swaps') return matchesSearch && t.type === 'fx_swap'
    return matchesSearch
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  
  const totalItems = filteredRows.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // ── Statement export: period selection ────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportPreset, setExportPreset] = useState('30d')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)

  const EXPORT_PRESETS = [
    { key: '7d',   label: 'Last 7 Days' },
    { key: '30d',  label: 'Last 30 Days' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
    { key: 'all',  label: 'All Time' },
    { key: 'custom', label: 'Custom Range' },
  ]

  const resolveExportRange = () => {
    const now = new Date()
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)

    if (exportPreset === '7d') {
      const from = new Date(now); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0)
      return { from, to: endOfToday }
    }
    if (exportPreset === '30d') {
      const from = new Date(now); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0)
      return { from, to: endOfToday }
    }
    if (exportPreset === 'month') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday }
    }
    if (exportPreset === 'year') {
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday }
    }
    if (exportPreset === 'custom') {
      const from = customFrom ? new Date(customFrom.getFullYear(), customFrom.getMonth(), customFrom.getDate(), 0, 0, 0) : null
      const to = customTo ? new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate(), 23, 59, 59) : endOfToday
      return { from, to }
    }
    return { from: null, to: null } // All Time
  }

  const formatPeriodLabel = (from, to) => {
    const fmt = (d) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    if (!from && !to) return 'All transactions'
    if (from && to) return `${fmt(from)} – ${fmt(to)}`
    if (from) return `From ${fmt(from)}`
    return `Up to ${fmt(to)}`
  }

  const confirmExport = async () => {
    const { from, to } = resolveExportRange()

    if (exportPreset === 'custom' && from && to && from > to) {
      addNotification({ type: 'error', title: 'Invalid Range', message: 'The "from" date must be before the "to" date.' })
      return
    }

    const rows = liveTransactions.filter(t => {
      const d = new Date(t.createdAt || t.timestamp)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })

    if (rows.length === 0) {
      addNotification({ type: 'error', title: 'No Transactions', message: 'No transactions were found in the selected period.' })
      return
    }

    const periodLabel = formatPeriodLabel(from, to)
    const { pdfBase64, filename } = handleExport(rows, periodLabel, to)
    setShowExportModal(false)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const token = localStorage.getItem('paychain_merchant_token')
      await axios.post(`${API_URL}/api/transactions/statement/email`, { pdfBase64, periodLabel, filename }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addNotification({ type: 'success', title: 'Statement Emailed', message: 'A copy was also sent to your registered email address.' })
    } catch (err) {
      console.error('Failed to email statement:', err)
      addNotification({ type: 'error', title: 'Email Failed', message: 'The statement downloaded fine, but we could not email you a copy.' })
    }
  }

  const handleExport = (rows, periodLabel, periodEnd) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()   // 210
    const H = doc.internal.pageSize.getHeight()  // 297
    const L = 14   // left margin
    const R = W - 14 // right margin
    const now = new Date()
    const statementId = `PC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`

    // Truncates with an ellipsis at the current font/size if `text` would
    // overflow `maxWidth` — prevents long emails/names from bleeding past
    // their column and overlapping whatever's printed next to them.
    const fitText = (text, maxWidth) => {
      let str = String(text ?? '')
      if (doc.getTextWidth(str) <= maxWidth) return str
      while (str.length > 1 && doc.getTextWidth(str + '…') > maxWidth) {
        str = str.slice(0, -1)
      }
      return str + '…'
    }

    // ── HEADER BAND ─────────────────────────────────────────────────────────
    doc.setFillColor(6, 32, 27)   // #06201B
    doc.rect(0, 0, W, 38, 'F')

    // Logo — transparent PNG, aspect-correct (source 968x230)
    const logoW = 32, logoH = logoW * (230 / 968)
    try { doc.addImage(statementLogo, 'PNG', L, (38 - logoH) / 2, logoW, logoH, undefined, 'FAST') } catch(_) {}

    // Right-side header text
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('PayChain Kenya', R, 15, { align: 'right' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(94, 254, 179)  // emerald
    doc.text('OFFICIAL TRANSACTION STATEMENT', R, 22, { align: 'right' })
    doc.setTextColor(200, 220, 210)
    doc.text(`Statement Ref: ${statementId}`, R, 27, { align: 'right' })
    doc.text(`Issued: ${now.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`, R, 32, { align: 'right' })

    // ── ACCOUNT DETAILS BLOCK ────────────────────────────────────────────────
    let y = 48
    doc.setTextColor(6, 32, 27)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Account Details', L, y)

    doc.setDrawColor(220, 230, 225)
    doc.setLineWidth(0.3)
    doc.line(L, y + 2, R, y + 2)

    y += 8
    const col2 = W / 2 + 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 100, 95)

    const acctLines = [
      ['Account Name',   merchant?.name        || '—', 'Business',   merchant?.businessName || '—'],
      ['Paybill / PayChain Account',  `880100 / ${formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')}`, 'Email', merchant?.email || '—'],
      ['Phone',          merchant?.phone        || '—', 'Statement Period', periodLabel],
    ]
    acctLines.forEach(([lk, lv, rk, rv]) => {
      doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal')
      doc.text(lk + ':', L, y)
      doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold')
      doc.text(fitText(lv, col2 - (L + 32) - 4), L + 32, y)
      doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal')
      doc.text(rk + ':', col2, y)
      doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold')
      doc.text(fitText(rv, R - (col2 + 30)), col2 + 30, y)
      y += 7
    })

    // ── SUMMARY STRIP ────────────────────────────────────────────────────────
    // netBalanceImpact (not the raw amount field) both filters to
    // 'completed'/'verified' rows AND corrects for the NCBA types that don't
    // store the true balance-moving figure (ncba_inbound stores the gross
    // pre-fee amount; the NCBA payout types store principal only, excluding
    // their fee) — see its doc comment. Skipping either check is what made
    // Total Money In/Out (and the running BALANCE column below) diverge from
    // the merchant's real account balance.
    const totalIn   = rows.reduce((s, t) => { const d = netBalanceImpact(t); return d > 0 ? s + d : s }, 0)
    const totalOut  = rows.reduce((s, t) => { const d = netBalanceImpact(t); return d < 0 ? s - d : s }, 0)
    const fmtKES    = (n) => formatKES(n)
    const fmtNum    = (n) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // ── OPENING BALANCE ──────────────────────────────────────────────────────
    // The running balance column needs a real starting point, not zero, or
    // a "Last 7 Days" statement's closing balance would never match the
    // merchant's actual account balance. Work backwards from that real,
    // authoritative balance (merchant.kesBalance) by undoing every
    // transaction that happened after this period ended.
    const netChangeWithinPeriod = rows.reduce((s, t) => s + netBalanceImpact(t), 0)
    const netChangeAfterPeriod = periodEnd
      ? liveTransactions
          .filter(t => new Date(t.createdAt || t.timestamp) > periodEnd)
          .reduce((s, t) => s + netBalanceImpact(t), 0)
      : 0
    const openingBalance = (merchant?.kesBalance || 0) - netChangeWithinPeriod - netChangeAfterPeriod

    y += 3
    const summaryItems = [
      { label: 'Total Money In',  value: fmtKES(totalIn),  color: [6, 32, 27] },
      { label: 'Total Money Out', value: fmtKES(totalOut), color: [180, 30, 30] },
      { label: 'Net Position',    value: fmtKES(totalIn - totalOut), color: totalIn >= totalOut ? [6, 32, 27] : [180, 30, 30] },
      { label: 'Transactions',    value: String(rows.length), color: [40, 80, 120] },
    ]
    const boxW = (R - L) / summaryItems.length - 2
    summaryItems.forEach((item, i) => {
      const bx = L + i * (boxW + 2)
      doc.setFillColor(244, 247, 245)
      doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 110, 105)
      doc.text(item.label.toUpperCase(), bx + boxW / 2, y + 6, { align: 'center' })
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...item.color)
      doc.text(item.value, bx + boxW / 2, y + 13, { align: 'center' })
    })

    // ── TRANSACTION TABLE ────────────────────────────────────────────────────
    y += 24
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(6, 32, 27)
    doc.text('Transaction Ledger', L, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 130, 125)
    doc.text(`${rows.length} record${rows.length !== 1 ? 's' : ''}`, R, y, { align: 'right' })
    y += 5
    doc.text(`Opening Balance: ${fmtKES(openingBalance)}`, L, y)

    // Build rows with running balance — starts from the real opening
    // balance above, not zero, so BALANCE (KES) and the closing strip
    // below always reconcile with the merchant's actual live account balance.
    let runBalance = openingBalance
    const tableRows = [...rows]
      .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp))
      .map(tx => {
        const dt = new Date(tx.createdAt || tx.timestamp)
        const dateStr = dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' })
        const timeStr = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
        const isIn  = isCreditTransaction(tx.type)
        const isOut = isDebitTransaction(tx.type)
        const isSwp = tx.type === 'fx_swap'
        const rawAmt = tx.amount || tx.kesAmount || 0

        // PAID IN/OUT still shows the row's own face amount either way (a
        // merchant reviewing a failed payout needs to see what was
        // attempted, and a completed NCBA row should show what the customer
        // actually paid / what the recipient actually received) — only the
        // running BALANCE column uses netBalanceImpact, since that's the
        // only figure guaranteed to match what really happened to the
        // account balance (zero for unsettled rows, fee-corrected for the
        // NCBA types that don't store the true balance-moving amount).
        let paidIn = '', paidOut = ''
        if (isIn)  paidIn  = fmtNum(rawAmt)
        if (isOut) paidOut = fmtNum(rawAmt)
        if (isSwp) paidOut = fmtNum(tx.kesAmount || 0)
        runBalance += netBalanceImpact(tx)

        // Standard PDF Helvetica has no glyph for "→" — it renders as garbage.
        // Use a plain ASCII arrow here (the on-screen UI still uses the real one).
        const desc = isSwp
          ? `FX Swap -> ${tx.usdcAmount || 0} USDC`
          : (tx.sender?.name !== tx.recipient?.name
              ? `${formatName(tx.sender?.name) || '—'} -> ${formatName(tx.recipient?.name) || '—'}`
              : formatName(tx.sender?.name) || formatName(tx.recipient?.name) || '—')

        return [
          `${dateStr}\n${timeStr}`,
          (tx.reference || '—').slice(0, 14),
          desc.slice(0, 32),
          paidIn,
          paidOut,
          fmtNum(runBalance),
          (tx.status || '').toUpperCase().slice(0, 9),
        ]
      })

    // Column widths are sized to the verified printable width (R - L = 182mm)
    // and to the measured worst-case text width of their content at this
    // font size, so no cell can overflow into its neighbour. Amounts drop
    // the "KES" prefix per-cell (it's on the column header instead) — that
    // alone was the difference between fitting and overflowing.
    autoTable(doc, {
      startY: y + 4,
      head: [['DATE/TIME', 'REF', 'DESCRIPTION', 'PAID IN (KES)', 'PAID OUT (KES)', 'BALANCE (KES)', 'STATUS']],
      body: tableRows,
      theme: 'plain',
      tableWidth: R - L,
      headStyles: {
        fillColor: [6, 32, 27],
        textColor: [255, 255, 255],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
        halign: 'left',
        lineWidth: 0,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 40, 35],
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineColor: [230, 235, 232],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: [246, 249, 247] },
      columnStyles: {
        0: { cellWidth: 20, halign: 'left',  fontStyle: 'normal' },
        1: { cellWidth: 28, halign: 'left',  fontStyle: 'normal', fontSize: 6.5 },
        2: { cellWidth: 32, halign: 'left' },
        3: { cellWidth: 26, halign: 'right', textColor: [6, 120, 60], fontStyle: 'bold' },
        4: { cellWidth: 26, halign: 'right', textColor: [160, 30, 30], fontStyle: 'bold' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'center', fontSize: 6.5 },
      },
      // Green highlight for paid-in cells, red for paid-out
      didParseCell(data) {
        if (data.section === 'body') {
          if (data.column.index === 3 && data.cell.raw) data.cell.styles.textColor = [6, 120, 60]
          if (data.column.index === 4 && data.cell.raw) data.cell.styles.textColor = [160, 30, 30]
          if (data.column.index === 6) {
            const v = String(data.cell.raw)
            if (v === 'COMPLETED') { data.cell.styles.textColor = [6, 120, 60]; data.cell.styles.fontStyle = 'bold' }
            if (v === 'PENDING')   { data.cell.styles.textColor = [160, 110, 6]; data.cell.styles.fontStyle = 'bold' }
            if (v === 'FAILED')    { data.cell.styles.textColor = [160, 30, 30]; data.cell.styles.fontStyle = 'bold' }
          }
        }
      },
      // Page-break header repeat
      didDrawPage(data) {
        if (data.pageNumber > 1) {
          doc.setFillColor(6, 32, 27)
          doc.rect(0, 0, W, 12, 'F')
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
          doc.text(`PayChain — ${statementId} — continued`, L, 8)
          doc.text(`Page ${data.pageNumber}`, R, 8, { align: 'right' })
        }
      },
      margin: { left: L, right: W - R },
    })

    // ── CLOSING BALANCE STRIP ────────────────────────────────────────────────
    const endY = doc.lastAutoTable.finalY + 4
    doc.setFillColor(6, 32, 27)
    doc.rect(L, endY, R - L, 12, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(94, 254, 179)
    doc.text('Closing Balance', L + 4, endY + 7.5)
    doc.setTextColor(255, 255, 255)
    doc.text(fmtKES(runBalance), R - 4, endY + 7.5, { align: 'right' })

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = H - 14
    doc.setDrawColor(200, 210, 205); doc.setLineWidth(0.3)
    doc.line(L, footerY - 4, R, footerY - 4)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 150, 145)
    doc.text('This is a computer-generated statement and requires no signature. For support: support@paychain.co.ke | +254 743 283 782', W / 2, footerY, { align: 'center' })
    doc.text(`© ${now.getFullYear()} Paychain Ltd  •  Ref: ${statementId}  •  Page 1 of ${doc.internal.getNumberOfPages()}`, W / 2, footerY + 5, { align: 'center' })

    const filename = `PayChain_Statement_${now.toISOString().slice(0,10)}.pdf`
    doc.save(filename)
    addNotification({ type: 'notifications', title: 'Statement Downloaded', message: 'Your official transaction statement has been downloaded.' })

    // Hand back the exact same PDF (as base64) so the caller can also email
    // this merchant a copy — same document, not a separately regenerated one.
    const pdfBase64 = doc.output('datauristring').split(',')[1]
    return { pdfBase64, filename }
  }

  const generateAuditReceipt = () => {
    if (!selectedTx) return
    
    const doc = new jsPDF({
      unit: 'mm',
      format: [148, 210] // A5 Format
    })
    
    const pageWidth = doc.internal.pageSize.getWidth()
    const tx = selectedTx
    
    // Header - Premium Midnight Accent
    doc.setFillColor(22, 39, 35) // #162723 matching the detail panel header
    doc.rect(0, 0, pageWidth, 40, 'F')
    
    // Logo — transparent PNG, aspect-correct (source 968x230)
    const auditLogoW = 42, auditLogoH = auditLogoW * (230 / 968)
    doc.addImage(statementLogo, 'PNG', (pageWidth / 2) - (auditLogoW / 2), 7, auditLogoW, auditLogoH)

    // Receipt Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('OFFICIAL AUDIT RECEIPT', pageWidth / 2, 35, { align: 'center' })

    // Main Content
    doc.setTextColor(22, 39, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('REFERENCE ID', 20, 55)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(tx.reference, 20, 62)
    
    // Divider
    doc.setDrawColor(230, 230, 230)
    doc.line(20, 63, pageWidth - 20, 63)

    // Grid details
    const labelY = 73, rowH = 15
    const sentTo = formatName(tx.sender?.name) || formatName(tx.recipient?.name) || 'Internal Treasury'
    const counterpartyPhone = formatPhoneOrDash(tx.sender?.id || tx.recipient?.id)

    // Column 1
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('DATE & TIME', 20, labelY)
    doc.text('SENT TO', 20, labelY + rowH)
    doc.text('PHONE NUMBER', 20, labelY + rowH * 2)
    doc.text('PAYMENT TYPE', 20, labelY + rowH * 3)
    doc.text('STATUS', 20, labelY + rowH * 4)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text(formatDateISO(tx.createdAt || tx.timestamp), 20, labelY + 7)
    doc.text(sentTo, 20, labelY + rowH + 7)
    doc.text(counterpartyPhone, 20, labelY + rowH * 2 + 7)
    doc.text(tx.type.replace('_', ' ').toUpperCase(), 20, labelY + rowH * 3 + 7)
    doc.text(tx.status.toUpperCase(), 20, labelY + rowH * 4 + 7)

    // Column 2 - Amount Focus
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('TOTAL AMOUNT', 85, labelY)

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    const amountStr = tx.type === 'fx_swap'
      ? `${tx.usdcAmount} USDC`
      : formatKES(tx.amount || tx.kesAmount || 0)
    doc.text(amountStr, 85, labelY + 10)

    const gridBottom = labelY + rowH * 4 + 7
    doc.setDrawColor(230, 230, 230)
    doc.line(20, gridBottom + 6, pageWidth - 20, gridBottom + 6)

    // Record note — this used to claim "cryptographically verified" /
    // "Audit Hash" / "Verified by PayChain Ledger Node", none of which are
    // real: the hash was Math.random(), and no such ledger service exists.
    // A merchant relying on that claim for a bank/tax submission would be
    // relying on fabricated verification. The reference ID above is the
    // one real, lookup-able identifier for this transaction.
    const stripY = gridBottom + 11
    doc.setFillColor(245, 247, 249)
    doc.rect(20, stripY, pageWidth - 40, 13, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text('OFFICIAL PAYCHAIN TRANSACTION RECORD', pageWidth / 2, stripY + 8.5, { align: 'center' })

    // Barcode — unique per transaction reference
    const barcodeY = stripY + 17, barcodeW = 100, barcodeH = 14
    drawBarcodePdf(doc, tx.reference, (pageWidth - barcodeW) / 2, barcodeY, barcodeW, barcodeH)
    doc.setFontSize(8)
    doc.setFont('courier', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(tx.reference, pageWidth / 2, barcodeY + barcodeH + 4, { align: 'center' })

    // Footer
    const footerY = barcodeY + barcodeH + 9
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'italic')
    doc.text('This receipt reflects PayChain\'s record of the transaction identified by the reference above.', pageWidth / 2, footerY, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.text(`PayChain Kenya · ${PAYCHAIN_PHONE} · Generated ${new Date().toLocaleDateString()}`, pageWidth / 2, footerY + 4.5, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text(PAYCHAIN_SLOGAN.toUpperCase(), pageWidth / 2, footerY + 9.5, { align: 'center' })

    doc.save(`PayChain_Audit_Receipt_${tx.reference}.pdf`)
    
    addNotification({
      type: 'notifications',
      title: 'Receipt Generated',
      message: `Official Audit Receipt for TXN ${tx.reference} has been downloaded.`
    })
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const TX_LABEL = {
    inbound:      'Payment In',
    outbound:     'Outbound',
    bulk_pay:     'Bulk Pay',
    settlement:   'Settlement',
    fx_swap:      'FX Swap',
    top_up:       'Top Up',
    withdrawal:   'Withdrawal',
    ncba_inbound: 'Payment In',
    ncba_outbound:'Bank Transfer',
    mpesa_b2c:    'M-PESA Withdrawal',
    ncba_mobile_b2w: 'Mobile Money Withdrawal',
    mpesa_b2b:    'Paybill/Till Payout',
    ncba_lipa_na_mpesa: 'Paybill/Till Payout',
    ncba_kplc:    'KPLC Bill Payment',
    ncba_kplc_prepaid: 'KPLC Prepaid Token',
    ncba_ncwsc:   'NCWSC Bill Payment',
  }
  const TX_COLOR = {
    inbound:      'bg-emerald-500/10 text-emerald-700',
    outbound:     'bg-amber-500/10  text-amber-700',
    bulk_pay:     'bg-orange-500/10 text-orange-700',
    settlement:   'bg-blue-500/10   text-blue-700',
    fx_swap:      'bg-purple-500/10 text-purple-700',
    top_up:       'bg-teal-500/10 text-teal-700',
    withdrawal:   'bg-rose-500/10 text-rose-700',
    ncba_inbound: 'bg-emerald-500/10 text-emerald-700',
    ncba_outbound:'bg-amber-500/10  text-amber-700',
    mpesa_b2c:    'bg-rose-500/10 text-rose-700',
    ncba_mobile_b2w: 'bg-rose-500/10 text-rose-700',
    mpesa_b2b:    'bg-indigo-500/10 text-indigo-700',
    ncba_lipa_na_mpesa: 'bg-indigo-500/10 text-indigo-700',
    ncba_kplc:    'bg-amber-500/10 text-amber-700',
    ncba_kplc_prepaid: 'bg-amber-500/10 text-amber-700',
    ncba_ncwsc:   'bg-sky-500/10 text-sky-700',
  }
  const txLabel = (type) => TX_LABEL[type] || type.replace(/_/g,' ')
  const txColor = (type) => TX_COLOR[type] || 'bg-slate-500/10 text-slate-700'

  const txAmount = (tx) => {
    if (tx.type === 'fx_swap') return `${(tx.usdcAmount || 0).toFixed(4)} USDC`
    return formatKES(tx.amount || tx.kesAmount || 0)
  }
  const txSign = (tx) => getAmountSign(tx.type)
  const txAmountColor = (tx) => getAmountColorClass(tx.type)

  // 'failed' used to render with the same amber dot as 'pending' — visually
  // indistinguishable from a payout still in flight. A failed row is always
  // refunded in full (see bulkPayController.js/mpesaController.js), so it
  // needs to read as unambiguously over, not still-processing.
  const txStatusMeta = (status) => {
    if (status === 'verified' || status === 'completed') return { dot: 'bg-green-500', text: 'text-emerald-600' }
    if (status === 'failed') return { dot: 'bg-red-500', text: 'text-red-600' }
    return { dot: 'bg-amber-500', text: 'text-amber-600' }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);

  const inboundTxs = liveTransactions.filter(t => isCreditTransaction(t.type));
  
  const stats = {
    today: inboundTxs.filter(t => new Date(t.createdAt || t.timestamp) >= today).reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0),
    week: inboundTxs.filter(t => new Date(t.createdAt || t.timestamp) >= weekAgo).reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0),
    month: inboundTxs.filter(t => new Date(t.createdAt || t.timestamp) >= monthAgo).reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0),
    allTime: inboundTxs.reduce((s, t) => s + (t.kesAmount || t.amount || 0), 0)
  };

  return (
    <MerchantLayout title="Transactions">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full">
        {/* Page Title & Subtext */}
        <div className="mb-6 lg:mb-8">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight">Transactions</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80">All money movements — payments in, withdrawals, swaps and bulk pays for account {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')}</p>
        </div>

        {liveTransactions.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 editorial-shadow p-12 lg:p-20 flex flex-col items-center justify-center text-center animate-fade-in-up mt-8">
            <div className="w-24 h-24 bg-surface-container-low rounded-full flex items-center justify-center mb-6 border border-slate-200">
              <span className="material-symbols-outlined text-5xl text-emerald-600/50">receipt_long</span>
            </div>
            <h3 className="text-2xl font-headline font-bold text-primary mb-3">No Transactions Yet</h3>
            <p className="text-[15px] text-on-surface-variant font-medium max-w-md mx-auto leading-relaxed opacity-80">
              Real-time payments made to your business account will appear here instantly. Instruct your customers to pay via M-Pesa Paybill <strong className="text-primary">880100</strong>, Account Number <strong className="text-primary">{formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')}</strong>.
            </p>
          </div>
        ) : (
          <>
            {/* Section 1: Summary Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8 lg:mb-12 animate-fade-in-up [animation-delay:100ms]">
              {[
                { label: 'Today', value: formatKES(stats.today), text: 'text-emerald-700 font-bold' },
                { label: 'This Week', value: formatKES(stats.week), text: 'text-emerald-700 font-bold' },
                { label: 'This Month', value: formatKES(stats.month), text: 'text-emerald-700 font-bold' },
                { label: 'All Time', value: formatKES(stats.allTime), text: 'text-emerald-700 font-bold' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-outline-variant/10 shadow-sm transition-transform hover:scale-105 group">
                  <p className="text-[9px] lg:text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1 lg:mb-2">{stat.label}</p>
                  <p className={`${stat.text} font-headline font-bold text-lg lg:text-2xl transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{stat.value}</p>
                </div>
              ))}
            </div>

        {/* Section 2: Filter Bar */}
        <div data-tour="transactions-filter-bar" className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
          <div className="flex items-center gap-1 bg-surface-container-low/40 backdrop-blur-md p-1.5 rounded-full w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth border border-on-surface-variant/30 shadow-md">
            {['All', 'Inbound', 'Outbound', 'FX Swaps'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 text-xs font-black rounded-full transition-all whitespace-nowrap min-w-fit ${
                  activeTab === tab
                    ? 'bg-white text-primary shadow-lg scale-100'
                    : 'text-on-surface-variant hover:bg-white/20 hover:text-primary active:scale-95'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-72 group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg transition-colors group-focus-within:text-primary">search</span>
              <input
                className="w-full bg-surface-container-low/40 backdrop-blur-md border border-on-surface-variant/30 rounded-full py-3 pl-12 pr-6 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-white/60 transition-all placeholder:text-on-surface-variant/30 font-medium"
                placeholder="Search reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              data-tour="export-statement-btn"
              onClick={() => setShowExportModal(true)}
              className="bg-[#0A2540] backdrop-blur-md border border-white/10 text-blue-100 p-3 rounded-full transition-all flex items-center justify-center gap-2 md:px-6 shadow-xl hover:bg-[#0C2D4E] hover:text-white active:scale-95 duration-200 group shrink-0"
            >
              <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-y-0.5 text-blue-300">download</span>
              <span className="text-xs font-black uppercase tracking-[0.2em] hidden md:inline">Download Statement</span>
            </button>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Section 3: Transaction List & Pagination */}
          <div className="col-span-12 space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10 editorial-shadow">
              <div className="overflow-x-auto text-on-surface">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0A2540] border-b border-white/10 transition-colors shadow-lg">
                      <th className="px-6 py-3 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Date/Time</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Type</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Party</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Amount</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-on-surface">
                    {paginatedRows.map((tx) => (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedTx(tx)}
                        className={`hover:bg-surface-container-low transition-colors cursor-pointer group ${
                          selectedTx?.id === tx.id ? 'bg-surface-container-low/50' : 'bg-white'
                        }`}
                      >
                        <td className="px-6 py-2">
                          <p className="text-[13px] font-semibold text-primary leading-tight">{formatTxDate(tx.createdAt || tx.timestamp)}</p>
                          <p className="text-[10px] text-on-surface-variant leading-tight tabular-nums">{formatTxTime(tx.createdAt || tx.timestamp)}</p>
                        </td>
                        <td className="px-6 py-2">
                          <span className={`px-2 py-1 text-[9px] font-bold rounded-full uppercase tracking-tighter ${txColor(tx.type)}`}>
                            {txLabel(tx.type)}
                          </span>
                        </td>
                        <td className="px-6 py-2">
                          <p className="text-[13px] font-semibold text-primary leading-tight">{formatName(tx.sender?.name) || formatName(tx.recipient?.name) || 'PayChain'}</p>
                          <p className="text-[10px] font-mono text-on-surface-variant group-hover:text-primary transition-colors leading-tight tabular-nums">
                            {[formatPhoneDisplay(tx.sender?.id || tx.recipient?.id), tx.reference].filter(Boolean).join(' · ')}
                          </p>
                        </td>
                        <td className="px-6 py-2">
                          <p className={`text-[13px] font-bold tabular-nums transition-all duration-300 ${txAmountColor(tx)}`}>
                            {txSign(tx)}{txAmount(tx)}
                          </p>
                        </td>
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${txStatusMeta(tx.status).dot}`}></div>
                            <span className={`text-[11px] font-semibold capitalize ${tx.status === 'failed' ? txStatusMeta(tx.status).text : ''}`}>{tx.status === 'failed' ? 'Failed & Refunded' : tx.status}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View - Vertical Info Sheet Layout */}
            <div className="lg:hidden divide-y divide-outline-variant/10 border-t border-b border-outline-variant/20">
              {paginatedRows.map((tx) => (
                <div 
                  key={tx.id} 
                  onClick={() => setSelectedTx(tx)}
                  className={`bg-white p-4 transition-all active:bg-surface-container-low flex flex-col gap-1 ${
                    selectedTx?.id === tx.id ? 'bg-surface-container-low/50 ring-2 ring-inset ring-primary/20' : ''
                  }`}
                >
                  {/* Date/Time */}
                  <p className="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em]">
                    {formatTxDate(tx.createdAt || tx.timestamp)}
                  </p>
                  <p className="text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-widest -mt-1 mb-2 tabular-nums">
                    {formatTxTime(tx.createdAt || tx.timestamp)}
                  </p>

                  {/* Type Badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter rounded ${txColor(tx.type)}`}>
                      {txLabel(tx.type)}
                    </span>
                  </div>

                  {/* Party & Reference */}
                  <p className="text-base font-bold text-primary leading-tight">
                    {formatName(tx.sender?.name) || formatName(tx.recipient?.name) || 'PayChain'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/40 font-mono tracking-tight mb-2 tabular-nums">
                    {[formatPhoneDisplay(tx.sender?.id || tx.recipient?.id), tx.reference].filter(Boolean).join(' · ')}
                  </p>

                  {/* Amount */}
                  <p className={`text-xl font-headline tracking-tighter tabular-nums ${txAmountColor(tx)}`}>
                    {txSign(tx)}{txAmount(tx)}
                  </p>

                  {/* Status */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/5">
                    <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${txStatusMeta(tx.status).text}`}>
                      {tx.status === 'failed' ? 'Failed & Refunded' : tx.status}
                    </span>
                    <span className="material-symbols-outlined text-primary/20 text-lg">arrow_forward</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-8 flex items-center justify-between bg-surface-container-low/30 px-6 py-4 rounded-3xl border border-outline-variant/10 shadow-sm animate-fade-in-up [animation-delay:200ms]">
              <div className="flex flex-col">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] opacity-60">Listing Volume</p>
                <p className="text-xs font-bold text-primary mt-0.5">
                  Showing <span className="text-primary-container bg-primary/10 px-1.5 py-0.5 rounded-md mx-0.5 font-mono">{paginatedRows.length}</span> of <span className="text-primary">{totalItems.toLocaleString()}</span> transactions
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-surface-container-lowest disabled:hover:text-primary transition-all duration-300 active:scale-90"
                >
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>
                <div className="flex items-center gap-1.5 px-3">
                  <span className="text-xs font-bold text-primary">{currentPage}</span>
                  <span className="text-[10px] font-bold text-outline-variant uppercase tracking-widest">of</span>
                  <span className="text-xs font-bold text-on-surface-variant">{totalPages || 1}</span>
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm hover:bg-primary hover:text-white disabled:opacity-20 disabled:hover:bg-surface-container-lowest disabled:hover:text-primary transition-all duration-300 active:scale-90"
                >
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
              </div>
            </div>
              </div>
            </div>
          </>
        )}
          </div>

          {/* Section 4: Detail Panel (Side-Slide Drawer) */}
          {selectedTx && (
            <div className="fixed inset-0 z-[100] flex justify-end">
              {/* Overlay Backdrop - Click to close */}
              <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" 
                onClick={() => setSelectedTx(null)}
              ></div>
              
              <div className="
                w-[calc(100%-64px)] sm:w-full sm:max-w-md h-full overflow-y-auto
                bg-white rounded-none shadow-2xl relative border-l border-outline-variant/10 flex flex-col animate-slide-in-right
              ">
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="absolute top-4 right-4 w-10 h-10 lg:w-12 lg:h-12 rounded-none bg-transparent flex items-center justify-center hover:bg-white/10 transition-colors z-20"
                >
                  <span className="material-symbols-outlined text-white">close</span>
                </button>

                {/* Header Section - Fixed 5cm height (approx 189px) */}
                <div className="h-[189px] min-h-[189px] px-8 lg:px-12 flex flex-col items-center justify-center text-center border-b border-white/5 relative bg-[#162723] overflow-hidden">
                  <div className="mb-4 transition-transform duration-700 hover:scale-[1.01]">
                    <img src={logo} alt="PayChain Logo" className="h-12 lg:h-16 w-auto object-contain" />
                  </div>
                  <h3 className="font-bold text-xl lg:text-2xl uppercase tracking-[0.1em] leading-none text-white">Transaction Details</h3>
                  <p className="text-white/40 text-[10px] font-bold mt-4 tracking-[0.2em] uppercase">REFERENCE ID: {selectedTx.reference}</p>
                </div>

                {/* Info List Section - strictly vertical */}
                <div className="flex-1 p-8 lg:p-12 space-y-10">
                  
                  {/* Settlement Section */}
                  <div className="space-y-3">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Settlement</p>
                    <p className={`text-3xl lg:text-4xl font-headline tabular-nums transition-all duration-300 ${!showAmounts && 'blur-lg'} ${selectedTx.status === 'failed' ? 'text-on-surface-variant/40 line-through' : getAmountColorClass(selectedTx.type)}`}>
                      {getAmountSign(selectedTx.type)}{selectedTx.type === 'fx_swap' ? formatUSDC(selectedTx.usdcAmount) : formatKES(selectedTx.amount || selectedTx.kesAmount || 0)}
                    </p>
                    {selectedTx.status === 'failed' && (
                      <p className="text-[11px] font-bold text-red-600">This payout failed and the full amount was refunded to your balance.</p>
                    )}
                  </div>

                  {/* Network Status Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Network Status</p>
                    <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-none border ${selectedTx.status === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-700' : selectedTx.status === 'completed' || selectedTx.status === 'verified' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-amber-500/10 border-amber-500/20 text-amber-700'}`}>
                      <div className={`w-2 h-2 rounded-full animate-pulse ${selectedTx.status === 'failed' ? 'bg-red-500' : selectedTx.status === 'completed' || selectedTx.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <p className="text-[11px] font-black uppercase tracking-widest">{selectedTx.status === 'failed' ? 'Failed & Refunded' : selectedTx.status}</p>
                    </div>
                  </div>

                  {/* Counterparty Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Counterparty</p>
                    <div>
                      <p className="text-lg font-bold text-primary">{formatName(selectedTx.sender?.name) || formatName(selectedTx.recipient?.name) || 'Internal Treasury'}</p>
                      <p className="text-[10px] text-on-surface-variant/40 font-bold mt-1 uppercase tracking-widest">{formatPhoneDisplay(selectedTx.sender?.id || selectedTx.recipient?.id) || 'SYSTEM'}</p>
                    </div>
                  </div>

                  {/* Timestamp Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Timestamp</p>
                    <p className="text-xs font-bold text-primary/70 uppercase tracking-widest tabular-nums">
                      {formatTxDate(selectedTx?.createdAt || selectedTx?.timestamp)} · {formatTxTime(selectedTx?.createdAt || selectedTx?.timestamp)}
                    </p>
                  </div>

                  {/* Resulting Balance Section — same "balance after" figure M-Pesa's own SMS shows, only present on transactions written after balanceAfter was added */}
                  {selectedTx?.balanceAfter != null && (
                    <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                      <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Balance After</p>
                      <p className="text-lg font-bold text-primary">{formatKES(selectedTx.balanceAfter)}</p>
                    </div>
                  )}

                  {/* Verification Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5 border-b border-outline-variant/5 pb-10">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Verification</p>
                    <div className="bg-surface-container-low px-4 py-3 rounded-none border border-outline-variant/10 flex items-center gap-3 w-fit">
                      <span className="material-symbols-outlined text-lg text-primary/40">shield_with_heart</span>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-[0.1em]">PayChain Transaction Record</span>
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="pt-2 flex flex-col items-center gap-6">
                    <button 
                      onClick={generateAuditReceipt}
                      className="w-fit min-w-[240px] bg-[#162723] hover:bg-emerald-950 active:scale-[0.98] text-white py-3.5 px-10 rounded-none font-bold text-xs shadow-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                    >
                      <span className="material-symbols-outlined text-lg">receipt_long</span>
                      Generate Audit Receipt
                    </button>
                    
                    <button 
                      onClick={() => setSelectedTx(null)}
                      className="text-on-surface-variant/40 hover:text-primary font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2"
                    >
                      Done
                    </button>
                  </div>
                </div>

                {/* Footer Section — used to claim this was "cryptographically
                    signed and stored on the immutable ledger," which isn't
                    true for any transaction type here (this is a MongoDB
                    record, not a blockchain entry, except for actual
                    Stellar fx_swap transfers) */}
                <div className="bg-[#162723] p-6 border-t border-white/5 text-center mt-auto">
                  <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.2em] leading-relaxed">
                    This is PayChain's official record of this transaction.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Export Statement Modal — period selection */}
          {showExportModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
                onClick={() => setShowExportModal(false)}
              ></div>

              <div className={`relative w-full bg-white rounded-3xl border border-outline-variant/10 shadow-2xl animate-fade-in-up overflow-hidden transition-all duration-200 ${exportPreset === 'custom' ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="px-6 lg:px-8 pt-6 lg:pt-8 pb-5 border-b border-outline-variant/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-headline font-bold text-primary">Download Statement</h3>
                      <p className="text-xs text-on-surface-variant opacity-70 mt-1">Choose the period this statement should cover.</p>
                    </div>
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:bg-surface-container-low hover:text-primary transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                </div>

                <div className="px-6 lg:px-8 py-6 space-y-5">
                  <div className="grid grid-cols-2 gap-2">
                    {EXPORT_PRESETS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setExportPreset(p.key)}
                        className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all text-left ${
                          exportPreset === p.key
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-on-surface-variant border-outline-variant/20 hover:border-primary/30 hover:text-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {exportPreset === 'custom' && (
                    <div className="pt-1">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2">Pick a start and end date</p>
                      <CalendarRangePicker
                        from={customFrom}
                        to={customTo}
                        maxDate={new Date()}
                        onChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }}
                      />
                    </div>
                  )}
                </div>

                <div className="px-6 lg:px-8 pb-6 lg:pb-8 flex items-center gap-3">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-low transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmExport}
                    disabled={exportPreset === 'custom' && !customFrom}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#0A2540] hover:bg-[#0C2D4E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}
    </MerchantLayout>
  )
}
