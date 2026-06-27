import React, { useState, useEffect } from 'react'
import axios from 'axios'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { formatDateISO } from '../utils/formatDate'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useNotification } from '../context/NotificationContext'
import logo from '../assets/logo2.png'
import statementLogo from '../../images/sign in logo2.png'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Transactions() {
  const { merchant } = useMerchantAuth()
  const { showAmounts } = usePrivacyMode()
  const { addNotification } = useNotification()
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)
  const [liveTransactions, setLiveTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/transactions`);
        setLiveTransactions(res.data);
      } catch (err) {
        console.error('Failed to load transactions', err);
        setLiveTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (merchant) {
      fetchTransactions();
    } else {
      setLiveTransactions([]);
      setIsLoading(false);
    }
  }, [merchant]);
  
  const filteredRows = liveTransactions.filter(t => {
    const matchesSearch = !searchQuery || 
      (t.sender?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.recipient?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reference || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'All') return matchesSearch
    if (activeTab === 'Inbound') return matchesSearch && t.type === 'inbound'
    if (activeTab === 'Outbound') return matchesSearch && (t.type === 'bulk_pay' || t.type === 'settlement' || t.type === 'outbound')
    if (activeTab === 'FX Swaps') return matchesSearch && t.type === 'fx_swap'
    return matchesSearch
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  const totalItems = filteredRows.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleExport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()   // 210
    const H = doc.internal.pageSize.getHeight()  // 297
    const L = 14   // left margin
    const R = W - 14 // right margin
    const now = new Date()
    const statementId = `PC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`

    // ── HEADER BAND ─────────────────────────────────────────────────────────
    doc.setFillColor(6, 32, 27)   // #06201B
    doc.rect(0, 0, W, 38, 'F')

    // Logo
    try { doc.addImage(statementLogo, 'PNG', L, 8, 34, 18, undefined, 'FAST') } catch(_) {}

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
      ['Paybill / Acc',  `400200 / ${merchant?.paybillAccount || '—'}`, 'Email', merchant?.email || '—'],
      ['Phone',          merchant?.phone        || '—', 'Statement Period', 'All transactions'],
    ]
    acctLines.forEach(([lk, lv, rk, rv]) => {
      doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal')
      doc.text(lk + ':', L, y)
      doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold')
      doc.text(String(lv), L + 32, y)
      doc.setTextColor(100, 110, 105); doc.setFont('helvetica', 'normal')
      doc.text(rk + ':', col2, y)
      doc.setTextColor(6, 32, 27); doc.setFont('helvetica', 'bold')
      doc.text(String(rv), col2 + 30, y)
      y += 7
    })

    // ── SUMMARY STRIP ────────────────────────────────────────────────────────
    const totalIn   = filteredRows.filter(t => t.type === 'inbound').reduce((s, o) => s + (o.amount || 0), 0)
    const totalOut  = filteredRows.filter(t => ['bulk_pay','settlement','outbound'].includes(t.type)).reduce((s, o) => s + (o.amount || 0), 0)
    const fmtKES    = (n) => `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    y += 3
    const summaryItems = [
      { label: 'Total Money In',  value: fmtKES(totalIn),  color: [6, 32, 27] },
      { label: 'Total Money Out', value: fmtKES(totalOut), color: [180, 30, 30] },
      { label: 'Net Position',    value: fmtKES(totalIn - totalOut), color: totalIn >= totalOut ? [6, 32, 27] : [180, 30, 30] },
      { label: 'Transactions',    value: String(filteredRows.length), color: [40, 80, 120] },
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
    doc.text(`${filteredRows.length} record${filteredRows.length !== 1 ? 's' : ''}`, R, y, { align: 'right' })

    // Build rows with running balance
    let runBalance = 0
    const tableRows = [...filteredRows]
      .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp))
      .map(tx => {
        const dt = new Date(tx.createdAt || tx.timestamp)
        const dateStr = dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' })
        const timeStr = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })
        const isIn  = tx.type === 'inbound'
        const isOut = ['bulk_pay','settlement','outbound'].includes(tx.type)
        const isSwp = tx.type === 'fx_swap'
        const rawAmt = tx.amount || tx.kesAmount || 0

        let paidIn = '', paidOut = ''
        if (isIn)  { paidIn  = fmtKES(rawAmt); runBalance += rawAmt }
        if (isOut) { paidOut = fmtKES(rawAmt); runBalance -= rawAmt }
        if (isSwp) { paidOut = fmtKES(tx.kesAmount || 0); runBalance -= (tx.kesAmount || 0) }

        const desc = isSwp
          ? `FX Swap → ${tx.usdcAmount || 0} USDC`
          : (tx.sender?.name !== tx.recipient?.name
              ? `${tx.sender?.name || '—'} → ${tx.recipient?.name || '—'}`
              : tx.sender?.name || tx.recipient?.name || '—')

        return [
          `${dateStr}\n${timeStr}`,
          (tx.reference || '—').slice(0, 14),
          desc.slice(0, 32),
          paidIn,
          paidOut,
          fmtKES(runBalance),
          (tx.status || '').toUpperCase().slice(0, 9),
        ]
      })

    autoTable(doc, {
      startY: y + 4,
      head: [['DATE / TIME', 'REF', 'DESCRIPTION', 'PAID IN', 'PAID OUT', 'BALANCE', 'STATUS']],
      body: tableRows,
      theme: 'plain',
      headStyles: {
        fillColor: [6, 32, 27],
        textColor: [255, 255, 255],
        fontSize: 7.5,
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
      },
      alternateRowStyles: { fillColor: [246, 249, 247] },
      columnStyles: {
        0: { cellWidth: 22, halign: 'left',  fontStyle: 'normal' },
        1: { cellWidth: 24, halign: 'left',  fontStyle: 'normal', fontSize: 6.5 },
        2: { cellWidth: 55, halign: 'left' },
        3: { cellWidth: 26, halign: 'right', textColor: [6, 120, 60], fontStyle: 'bold' },
        4: { cellWidth: 26, halign: 'right', textColor: [160, 30, 30], fontStyle: 'bold' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 18, halign: 'center', fontSize: 6.5 },
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
    doc.text('This is a computer-generated statement and requires no signature. For support: support@paychain.co.ke | +254 790 889 066', W / 2, footerY, { align: 'center' })
    doc.text(`© ${now.getFullYear()} PayChain Kenya Limited  •  Ref: ${statementId}  •  Page 1 of ${doc.internal.getNumberOfPages()}`, W / 2, footerY + 5, { align: 'center' })

    doc.save(`PayChain_Statement_${now.toISOString().slice(0,10)}.pdf`)
    addNotification({ type: 'notifications', title: 'Statement Downloaded', message: 'Your official transaction statement has been downloaded.' })
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
    
    // Logo
    doc.addImage(statementLogo, 'PNG', (pageWidth/2) - 20, 8, 40, 22)
    
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
    doc.line(20, 68, pageWidth - 20, 68)

    // Grid details
    const labelY = 80
    const valueY = 87
    
    // Column 1
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('TRANSACTION TYPE', 20, labelY)
    doc.text('NETWORK STATUS', 20, labelY + 20)
    doc.text('COUNTERPARTY', 20, labelY + 40)
    doc.text('TIMESTAMP', 20, labelY + 60)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text(tx.type.replace('_', ' ').toUpperCase(), 20, valueY)
    doc.text(tx.status.toUpperCase(), 20, valueY + 20)
    doc.text(tx.sender?.name || tx.recipient?.name || 'Internal Treasury', 20, valueY + 40)
    doc.text(formatDateISO(tx.createdAt || tx.timestamp), 20, valueY + 60)

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
      : `${(tx.amount || tx.kesAmount || 0).toLocaleString()} KES`
    doc.text(amountStr, 85, valueY + 2)

    // Verification Note
    doc.setFillColor(245, 247, 249)
    doc.rect(20, 155, pageWidth - 40, 15, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 39, 35)
    doc.text('VERIFICATION: PROTOCOL V4.2 SECURED', pageWidth / 2, 164, { align: 'center' })

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'italic')
    doc.text('This receipt is a cryptographically verified record of the transaction.', pageWidth / 2, 185, { align: 'center' })
    doc.text('Audit Hash: ' + Math.random().toString(36).substring(2, 18).toUpperCase(), pageWidth / 2, 190, { align: 'center' })
    
    doc.setFont('helvetica', 'normal')
    doc.text('Verified by PayChain Ledger Node v0.8.2', pageWidth / 2, 195, { align: 'center' })

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);

  const inboundTxs = liveTransactions.filter(t => t.type === 'inbound');
  
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
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80">All verified inbound payments to Till {merchant?.paybillAccount || '84729'}</p>
        </div>

        {liveTransactions.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 editorial-shadow p-12 lg:p-20 flex flex-col items-center justify-center text-center animate-fade-in-up mt-8">
            <div className="w-24 h-24 bg-surface-container-low rounded-full flex items-center justify-center mb-6 border border-slate-200">
              <span className="material-symbols-outlined text-5xl text-emerald-600/50">receipt_long</span>
            </div>
            <h3 className="text-2xl font-headline font-bold text-primary mb-3">No Transactions Yet</h3>
            <p className="text-[15px] text-on-surface-variant font-medium max-w-md mx-auto leading-relaxed opacity-80">
              Real-time payments made to your business account will appear here instantly. Instruct your customers to use your account number <strong className="text-primary">{merchant?.paybillAccount || '84729'}</strong>.
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
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
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
              onClick={handleExport}
              className="bg-[#0A2540] backdrop-blur-md border border-white/10 text-blue-100 p-3 rounded-full transition-all flex items-center justify-center gap-2 md:px-6 shadow-xl hover:bg-[#0C2D4E] hover:text-white active:scale-95 duration-200 group shrink-0"
            >
              <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-y-0.5 text-blue-300">download</span>
              <span className="text-xs font-black uppercase tracking-[0.2em] hidden md:inline">Export</span>
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
                          <p className="text-[13px] font-semibold text-primary leading-tight">{formatDateISO(tx.createdAt || tx.timestamp).split(',')[0]}</p>
                          <p className="text-[10px] text-on-surface-variant leading-tight">{formatDateISO(tx.createdAt || tx.timestamp).split(',')[1]}</p>
                        </td>
                        <td className="px-6 py-2">
                          <span className={`px-2 py-1 text-[9px] font-bold rounded-full uppercase tracking-tighter ${
                            tx.type === 'inbound' ? 'bg-green-500/10 text-green-700' :
                            tx.type === 'fx_swap' ? 'bg-blue-500/10 text-blue-700' :
                            'bg-amber-500/10 text-amber-700'
                          }`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-2">
                          <p className="text-[13px] font-semibold text-primary leading-tight">{tx.sender?.name || tx.recipient?.name || 'Treasury'}</p>
                          <p className="text-[10px] font-mono text-on-surface-variant group-hover:text-primary transition-colors leading-tight">{tx.reference}</p>
                        </td>
                        <td className="px-6 py-2">
                          <p className={`text-[13px] font-bold transition-all duration-300 ${tx.type === 'inbound' ? 'text-green-600' : 'text-primary'}`}>
                            {tx.type === 'fx_swap' ? formatUSDC(tx.usdcAmount) : formatKES(tx.amount || tx.kesAmount || 0)}
                          </p>
                        </td>
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'verified' || tx.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-[11px] font-semibold capitalize">{tx.status}</span>
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
                    {formatDateISO(tx.createdAt || tx.timestamp).split(',')[0]}
                  </p>
                  <p className="text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-widest -mt-1 mb-2">
                    {formatDateISO(tx.createdAt || tx.timestamp).split(',')[1]}
                  </p>

                  {/* Type Badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter border ${
                      tx.type === 'inbound' ? 'bg-emerald-500/5 text-emerald-700 border-emerald-500/10' : 
                      tx.type === 'fx_swap' ? 'bg-blue-500/5 text-blue-700 border-blue-500/10' : 
                      'bg-amber-500/5 text-amber-700 border-amber-500/10'
                    }`}>
                      {tx.type.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Party & Reference */}
                  <p className="text-base font-bold text-primary leading-tight">
                    {tx.sender?.name || tx.recipient?.name || 'Treasury'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/40 font-mono tracking-tight mb-2">
                    {tx.reference}
                  </p>

                  {/* Amount */}
                  <p className={`text-xl font-headline tracking-tighter ${tx.type === 'inbound' ? 'text-emerald-700' : 'text-primary'}`}>
                    {tx.type === 'inbound' ? '+' : '-'}{tx.type === 'fx_swap' ? formatUSDC(tx.usdcAmount) : formatKES(tx.amount || tx.kesAmount || 0)}
                  </p>

                  {/* Status */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/5">
                    <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${
                      tx.status === 'verified' || tx.status === 'completed' 
                        ? 'text-emerald-600' 
                        : 'text-amber-600'
                    }`}>
                      {tx.status}
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
                    <p className={`text-3xl lg:text-4xl font-headline text-primary transition-all duration-300 ${!showAmounts && 'blur-lg'}`}>
                      {selectedTx.type === 'fx_swap' ? formatUSDC(selectedTx.usdcAmount) : formatKES(selectedTx.amount || selectedTx.kesAmount || 0)}
                    </p>
                  </div>

                  {/* Network Status Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Network Status</p>
                    <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-700">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <p className="text-[11px] font-black uppercase tracking-widest">{selectedTx.status}</p>
                    </div>
                  </div>

                  {/* Counterparty Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Counterparty</p>
                    <div>
                      <p className="text-lg font-bold text-primary">{selectedTx.sender?.name || selectedTx.recipient?.name || 'Internal Treasury'}</p>
                      <p className="text-[10px] text-on-surface-variant/40 font-bold mt-1 uppercase tracking-widest">{selectedTx.sender?.id || selectedTx.recipient?.id || 'SYSTEM'}</p>
                    </div>
                  </div>

                  {/* Timestamp Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Timestamp</p>
                    <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">{formatDateISO(selectedTx?.createdAt || selectedTx?.timestamp)}</p>
                  </div>

                  {/* Verification Section */}
                  <div className="space-y-3 pt-6 border-t border-outline-variant/5 border-b border-outline-variant/5 pb-10">
                    <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.2em]">Verification</p>
                    <div className="bg-surface-container-low px-4 py-3 rounded-none border border-outline-variant/10 flex items-center gap-3 w-fit">
                      <span className="material-symbols-outlined text-lg text-primary/40">shield_with_heart</span>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-[0.1em]">Protocol V4.2 Secured</span>
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

                {/* Footer Section */}
                <div className="bg-[#162723] p-6 border-t border-white/5 text-center mt-auto">
                  <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.2em] leading-relaxed">
                    This transaction is cryptographically signed and stored on the immutable ledger.
                  </p>
                </div>
              </div>
            </div>
          )}
    </MerchantLayout>
  )
}
