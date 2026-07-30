import React, { useState, useRef } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { formatAccountNumber } from '../utils/formatAccountNumber'
import SettlementQrCard from '../components/ui/SettlementQrCard'
import { useToast } from '../context/NotificationContext'
import { getAppUrl } from '../utils/appUrl'

export default function MyAccounts() {
  const { merchant } = useMerchantAuth()
  const { addToast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [entries, setEntries] = useState(10)
  const [qrAccount, setQrAccount] = useState(null)
  const qrModalContainerRef = useRef(null)

  const accountsData = [
    {
      service: 'PayChain Account',
      // ncbaVirtualAccountNumber is null until NCBA_INSTITUTION_PREFIX is
      // configured on the backend (i.e. until NCBA assigns PayChain's
      // 4-digit institution code) — falls back to the 8-digit merchant
      // code, which is already safe to use as an interim account number
      // (PayChain's webhook matches it inside NCBA's Narrative field).
      accountNumber: merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending bank assignment',
      type: 'M-Pesa / Bank Transfer / EFT / PesaLink',
      name: merchant?.businessName || 'Merchant',
      // NCBA's real M-Pesa Paybill business number — how a customer sends
      // money into the account number above via M-Pesa (Pay Bill > 880100 >
      // Account No. = the NCBA virtual account above). Constant, not
      // merchant-specific.
      linkedTransferAccount: 'M-Pesa Paybill 880100',
      manager: merchant?.name || 'Owner',
      status: (merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode) ? 'Active' : 'Pending'
    }
  ]

  const closeQrModal = () => setQrAccount(null)

  const getQrDataUrl = () => qrModalContainerRef.current?.querySelector('canvas')?.toDataURL('image/png')

  const handleDownloadQr = () => {
    const dataUrl = getQrDataUrl()
    if (!dataUrl) {
      addToast({ title: 'Download Failed', message: 'QR code was not ready — please try again.', type: 'error' })
      return
    }
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = dataUrl
    a.download = `PayChain-QR-${qrAccount?.accountNumber || 'account'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // A physical counter sticker, not a screenshot of the dark in-app card —
  // white background and high-contrast ink so it actually prints cleanly on
  // a home/office printer or label stock, sized to a common small sticker
  // (3.5in square) rather than a full page.
  const handlePrintSticker = () => {
    const dataUrl = getQrDataUrl()
    if (!dataUrl) {
      addToast({ title: 'Print Failed', message: 'QR code was not ready — please try again.', type: 'error' })
      return
    }
    const businessName = qrAccount?.name || 'Merchant'
    const acctDisplay = formatAccountNumber(qrAccount?.accountNumber)
    const printWindow = window.open('', '', 'width=500,height=650')
    if (!printWindow) {
      addToast({ title: 'Print Blocked', message: 'Allow pop-ups for this site to print the sticker.', type: 'error' })
      return
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>PayChain Payment Sticker</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #e2e8f0;
            }
            .sticker {
              width: 3.5in;
              height: 3.5in;
              background: #ffffff;
              border: 3px solid #00351D;
              border-radius: 28px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 0.25in;
              text-align: center;
            }
            .badge {
              background: #00351D;
              color: #5EFEB3;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              padding: 5px 14px;
              border-radius: 999px;
              margin-bottom: 10px;
            }
            h1 {
              font-size: 16px;
              font-weight: 800;
              color: #00351D;
              margin: 0 0 12px 0;
              letter-spacing: 0.02em;
              max-width: 90%;
              overflow-wrap: break-word;
            }
            img.qr {
              width: 1.7in;
              height: 1.7in;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 8px;
              margin-bottom: 12px;
            }
            .acct {
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.08em;
              color: #00351D;
              font-family: 'Courier New', monospace;
            }
            .footer {
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: #64748b;
              margin-top: 10px;
            }
            @media print {
              body { background: #fff; }
              .sticker { border: 2px solid #00351D; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="sticker">
            <span class="badge">Scan to Pay</span>
            <h1>${businessName}</h1>
            <img class="qr" src="${dataUrl}" alt="Payment QR" />
            <span class="acct">ACC: ${acctDisplay}</span>
            <span class="footer">M-Pesa Paybill 880100 · PayChain</span>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 400); };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <MerchantLayout title="My Accounts">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full space-y-8 lg:space-y-12">

        {/* Page Header */}
        <div className="mb-6 lg:mb-10">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight leading-tight">My Accounts</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80 leading-relaxed">
            Manage your registered PayChain accounts, linked transfer accounts, and assigned managers.
          </p>
        </div>

        {/* Data Grid Section */}
        <div className="bg-white rounded-[32px] border border-slate-300 shadow-sm editorial-shadow overflow-hidden animate-fade-in-up">

          <div className="p-6 lg:p-8 border-b border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">point_of_sale</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-primary">Accounts</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-70">All Registered Accounts</p>
              </div>
            </div>
          </div>

          <div className="p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="text-on-surface-variant opacity-70">Show</span>
                <select
                  className="bg-surface-container-low border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500/50"
                  value={entries}
                  onChange={(e) => setEntries(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-on-surface-variant opacity-70">entries</span>
              </div>

              <div className="relative w-full md:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Search accounts..."
                  className="w-full bg-surface-container-low border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-primary focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar pb-4">
              <table className="w-full text-left min-w-[900px] border-collapse border border-slate-300">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Service</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Account Number</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Type</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Name</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Linked Transfer Account</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">Manager</th>
                    <th className="py-4 px-4 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-primary/60">QR Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {accountsData.map((account, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-5 px-4 border border-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-sm font-bold text-primary">{account.service}</span>
                        </div>
                      </td>
                      <td className="py-5 px-4 border border-slate-300 text-sm font-bold tracking-tight text-primary">{formatAccountNumber(account.accountNumber)}</td>
                      <td className="py-5 px-4 border border-slate-300 text-xs font-medium text-on-surface-variant"><span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{account.type}</span></td>
                      <td className="py-5 px-4 border border-slate-300 text-sm font-bold text-primary">{account.name}</td>
                      <td className="py-5 px-4 border border-slate-300 text-xs font-medium text-on-surface-variant italic opacity-60">{account.linkedTransferAccount}</td>
                      <td className="py-5 px-4 border border-slate-300 text-sm font-bold text-primary">{account.manager}</td>
                      <td className="py-5 px-4 border border-slate-300">
                        <button
                          onClick={() => setQrAccount(account)}
                          disabled={account.status !== 'Active'}
                          title={account.status !== 'Active' ? 'This account is still pending bank assignment' : 'Generate QR code'}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#06201B] text-[#5EFEB3] rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-125 active:scale-95 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100"
                        >
                          <span className="material-symbols-outlined text-sm">qr_code_2</span>
                          Generate QR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t border-slate-300">
              <p className="text-xs font-medium text-on-surface-variant opacity-80">
                Showing {accountsData.length} to {accountsData.length} of {accountsData.length} entries
              </p>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-50" disabled>Previous</button>
                <button className="px-4 py-2 rounded-lg bg-[#06201B] text-white text-xs font-bold shadow-md">1</button>
                <button className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-50" disabled>Next</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Per-account QR modal */}
      {qrAccount && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] animate-in fade-in duration-200" onClick={closeQrModal} />
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-[#0B0E14] rounded-[32px] shadow-2xl w-full max-w-xs pointer-events-auto overflow-hidden animate-in zoom-in-95 duration-300 p-6 relative">
              <button
                onClick={closeQrModal}
                className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>

              <SettlementQrCard
                qrData={`${getAppUrl()}/pay/account/${qrAccount.accountNumber}`}
                businessName={qrAccount.name}
                accountNumber={qrAccount.accountNumber}
                containerRef={qrModalContainerRef}
              />

              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleDownloadQr}
                  className="flex-1 py-3.5 bg-[#5EFEB3] text-[#00351D] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-105 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download
                </button>
                <button
                  onClick={handlePrintSticker}
                  className="flex-1 py-3.5 bg-white/10 border border-white/15 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print Sticker
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </MerchantLayout>
  )
}
