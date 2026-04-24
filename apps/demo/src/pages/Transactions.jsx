import React, { useState, useEffect } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { transactionsData } from '../mockData/transactions'
import { formatDateISO } from '../utils/formatDate'
import { formatKES, formatUSDC } from '../utils/formatCurrency'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useNotification } from '../context/NotificationContext'
import logo from '../assets/logo2.png'
import statementLogo from '../../images/sign in logo2.png'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Transactions() {
  const { showAmounts } = usePrivacyMode()
  const { addNotification } = useNotification()
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)
  
  const filteredRows = transactionsData.filter(t => {
    const matchesSearch = !searchQuery || 
      (t.sender?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.recipient?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reference || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'All') return matchesSearch
    if (activeTab === 'Inbound') return matchesSearch && t.type === 'inbound'
    if (activeTab === 'Outbound') return matchesSearch && (t.type === 'bulk_pay' || t.type === 'settlement')
    if (activeTab === 'FX Swaps') return matchesSearch && t.type === 'fx_swap'
    return matchesSearch
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  
  const totalItems = filteredRows.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleExport = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Stats calculation
    const totalIn = filteredRows.filter(t => t.type === 'inbound').reduce((s, o) => s + (o.amount || 0), 0)
    const totalOut = filteredRows.filter(t => t.type === 'bulk_pay' || t.type === 'settlement').reduce((s, o) => s + (o.amount || 0), 0)
    const swpKES = filteredRows.filter(t => t.type === 'fx_swap').reduce((s, o) => s + (o.kesAmount || 0), 0)
    const swpUSDC = filteredRows.filter(t => t.type === 'fx_swap').reduce((s, o) => s + (o.usdcAmount || 0), 0)
    
    // Header - Professional Midnight Theme
    doc.setFillColor(10, 37, 64) // #0A2540
    doc.rect(0, 0, pageWidth, 45, 'F')
    
    // Logo - Adjusted for higher visibility
    doc.addImage(statementLogo, 'PNG', 15, 12, 40, 22, undefined, 'FAST')
    
    // Identity
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYCHAIN', pageWidth - 15, 20, { align: 'right' })
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('OFFICIAL BUSINESS STATEMENT', pageWidth - 15, 28, { align: 'right' })
    doc.text(`STATEMENT ID: PC-ST-${Math.random().toString(36).substring(7).toUpperCase()}`, pageWidth - 15, 33, { align: 'right' })
    doc.text(`ISSUED: ${new Date().toLocaleString()}`, pageWidth - 15, 38, { align: 'right' })

    // Official Narrative Section
    doc.setTextColor(10, 37, 64)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Business Overview', 15, 55)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const narrative = `This document serves as the official transaction summary for Till PC847291. It provides a comprehensive record of all financial movements, including inbound payments, outbound settlements, and currency swaps. These records are cryptographically verified and stored on the PayChainKE immutable ledger for your business security.`
    const lines = doc.splitTextToSize(narrative, pageWidth - 30)
    doc.text(lines, 15, 62)

    // Summary Statistics Card
    autoTable(doc, {
      startY: 75,
      head: [['TOTAL MONEY IN', 'TOTAL MONEY OUT', 'TOTAL SWAPPED']],
      body: [[
        `KES ${totalIn.toLocaleString()}`,
        `KES ${totalOut.toLocaleString()}`,
        `KES ${swpKES.toLocaleString()} / ${swpUSDC} USDC`
      ]],
      theme: 'plain',
      headStyles: { 
        fillColor: [240, 245, 250], 
        textColor: [10, 37, 64],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 12,
        fontStyle: 'bold',
        textColor: [10, 37, 64],
        halign: 'center'
      },
      margin: { left: 15, right: 15 }
    })

    // Transaction Table
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Transaction Details', 15, doc.lastAutoTable.finalY + 15)

    const tableData = filteredRows.map(tx => {
      const dateTime = formatDateISO(tx.timestamp).split(',')
      const party = tx.sender?.name || tx.recipient?.name || 'Treasury'
      const amount = tx.type === 'fx_swap' 
        ? `${tx.usdcAmount} USDC` 
        : `KES ${(tx.amount || tx.kesAmount || 0).toLocaleString()}`
        
      return [
        dateTime[0].trim(),
        tx.type.replace('_', ' ').toUpperCase(),
        tx.reference,
        party,
        amount,
        tx.status.toUpperCase()
      ]
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['DATE', 'TYPE', 'REFERENCE', 'PARTY', 'AMOUNT', 'STATUS']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [10, 37, 64], 
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 5
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [245, 247, 249]
      },
      margin: { left: 15, right: 15 }
    })

    // Footer
    const finalY = doc.lastAutoTable.finalY || 150
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`END OF STATEMENT - PAGE ${doc.internal.getNumberOfPages()}`, pageWidth / 2, finalY + 15, { align: 'center' })
    
    // Cryptographic signature line
    doc.setDrawColor(200, 200, 200)
    doc.line(15, doc.internal.pageSize.getHeight() - 25, pageWidth - 15, doc.internal.pageSize.getHeight() - 25)
    doc.text('Verify authenticity at paychain.ke/verify', 15, doc.internal.pageSize.getHeight() - 15)
    doc.text('Audit Hash: ' + Math.random().toString(36).substring(2, 18).toUpperCase(), pageWidth - 15, doc.internal.pageSize.getHeight() - 15, { align: 'right' })

    doc.save(`PayChain_Official_Statement_${new Date().toISOString().split('T')[0]}.pdf`)
    
    addNotification({
      type: 'notifications',
      title: 'Statement Downloaded',
      message: 'Your official transaction statement has been generated and downloaded successfully.'
    })
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
    doc.text(formatDateISO(tx.timestamp), 20, valueY + 60)

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

  return (
    <MerchantLayout title="Transactions">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full">
        {/* Page Title & Subtext */}
        <div className="mb-6 lg:mb-8">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight">Transactions</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80">All verified inbound payments to Till PC847291</p>
        </div>

        {/* Section 1: Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8 lg:mb-12 animate-fade-in-up [animation-delay:100ms]">
          {[
            { label: 'Today', value: 'KES 12,450.00', text: 'text-emerald-700 font-bold' },
            { label: 'This Week', value: 'KES 84,920.50', text: 'text-emerald-700 font-bold' },
            { label: 'This Month', value: 'KES 245,100.00', text: 'text-emerald-700 font-bold' },
            { label: 'All Time', value: 'KES 1.84M', text: 'text-emerald-700 font-bold' },
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
                      <th className="px-6 py-5 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Date/Time</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Type</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Party</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Amount</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-blue-100 uppercase tracking-[0.2em] opacity-60">Status</th>
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
                        <td className="px-6 py-5">
                          <p className="text-sm font-semibold text-primary">{formatDateISO(tx.timestamp).split(',')[0]}</p>
                          <p className="text-[11px] text-on-surface-variant">{formatDateISO(tx.timestamp).split(',')[1]}</p>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter ${
                            tx.type === 'inbound' ? 'bg-green-500/10 text-green-700' :
                            tx.type === 'fx_swap' ? 'bg-blue-500/10 text-blue-700' :
                            'bg-amber-500/10 text-amber-700'
                          }`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-semibold text-primary">{tx.sender?.name || tx.recipient?.name || 'Treasury'}</p>
                          <p className="text-[11px] font-mono text-on-surface-variant group-hover:text-primary transition-colors">{tx.reference}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className={`text-sm font-bold transition-all duration-300 ${tx.type === 'inbound' ? 'text-green-600' : 'text-primary'}`}>
                            {tx.type === 'fx_swap' ? formatUSDC(tx.usdcAmount) : formatKES(tx.amount || tx.kesAmount || 0)}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'verified' || tx.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <span className="text-xs font-semibold capitalize">{tx.status}</span>
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
                  className={`bg-white p-6 transition-all active:bg-surface-container-low flex flex-col gap-1.5 ${
                    selectedTx?.id === tx.id ? 'bg-surface-container-low/50 ring-2 ring-inset ring-primary/20' : ''
                  }`}
                >
                  {/* Date/Time */}
                  <p className="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-[0.2em]">
                    {formatDateISO(tx.timestamp).split(',')[0]}
                  </p>
                  <p className="text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-widest -mt-1 mb-2">
                    {formatDateISO(tx.timestamp).split(',')[1]}
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
                    <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">{formatDateISO(selectedTx.timestamp)}</p>
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
        </div>
      </div>
    </MerchantLayout>
  )
}
