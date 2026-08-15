import React from 'react'
import { formatAccountNumber } from '../../utils/formatAccountNumber'

// Premium settlement-QR card — dark bezel frame, corner brackets, an
// animated "scan me" badge + curved arrow pointing at the code, a soft
// pulsing halo. Shared between Wallet.jsx ("My QR") and MyAccounts.jsx
// (per-row QR modal) so both stay visually identical rather than drifting
// apart.
//
// qrCodeDataUri is a PayChain-branded QR (PayChain mark composited into the
// center) fetched from GET /api/callbacks/account-qr by the caller —
// encodes a link to this merchant's own /pay/account/:code checkout page
// (see mpesaController.js#generateAccountQr for why this is generated and
// hosted by PayChain rather than using NCBA's own Dynamic QR product).
export default function SettlementQrCard({ qrCodeDataUri, businessName, accountNumber, size = 144 }) {
  return (
    <div className="p-[1.5px] rounded-[26px] bg-gradient-to-br from-[#5EFEB3]/50 via-[#1E2532] to-[#2775CA]/40 shadow-[0_8px_30px_rgba(0,0,0,0.6)] w-full">
      <div className="bg-[#131722] p-5 rounded-[24px] flex flex-col items-center justify-center border border-[#1E2532] relative group w-full h-fit overflow-hidden">
        {/* Corner brackets — viewfinder accent */}
        <span className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#5EFEB3]/60 rounded-tl-md pointer-events-none z-20"></span>
        <span className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#5EFEB3]/60 rounded-tr-md pointer-events-none z-20"></span>
        <span className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#5EFEB3]/60 rounded-bl-md pointer-events-none z-20"></span>
        <span className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#5EFEB3]/60 rounded-br-md pointer-events-none z-20"></span>

        {/* "Scan me" sticker + curved arrow — points the eye down at the QR */}
        <div className="relative z-10 flex flex-col items-center mb-1">
          <span
            title={businessName}
            className="animate-wiggle inline-block max-w-[170px] truncate bg-[#5EFEB3] text-[#00351D] px-3 py-1.5 rounded-full rounded-bl-sm text-[10px] font-black uppercase tracking-wide shadow-[0_6px_16px_rgba(94,254,179,0.35)]"
          >
            Scan me to pay {businessName || formatAccountNumber(accountNumber)}
          </span>
          <svg
            width="52" height="32" viewBox="0 0 52 32" fill="none"
            className="-mb-1 animate-bounce [animation-duration:1.8s]"
          >
            <path d="M8 2 C 40 2, 40 16, 22 22" stroke="#5EFEB3" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 6" />
            <path d="M14 18 L22 24 L29 16" stroke="#5EFEB3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>

        <div className="bg-white p-3 rounded-[16px] shadow-lg mb-5 relative z-10 transition-transform group-hover:scale-[1.02] w-[168px] h-[168px] flex items-center justify-center shrink-0 border border-white/10">
          {/* Soft pulsing halo — signals "live/scannable" without being distracting */}
          <span className="absolute inset-0 rounded-[16px] bg-[#5EFEB3]/25 animate-ping [animation-duration:2.5s]"></span>
          {qrCodeDataUri ? (
            <img
              src={qrCodeDataUri}
              alt="Scan to pay QR code"
              className="relative z-10 object-contain"
              style={{ width: size, height: size }}
            />
          ) : (
            <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
              <div className="w-6 h-6 border-2 border-[#00351D]/15 border-t-[#00351D] rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <div className="text-center relative z-10 w-full flex flex-col items-center">
          <div className="inline-block px-2.5 py-1 bg-[#2775CA]/10 border border-[#2775CA]/20 rounded-md mb-2.5">
            <p className="text-[#2775CA] text-[9px] font-black uppercase tracking-[0.2em] leading-none">Settlement QR</p>
          </div>
          <div className="space-y-1.5 w-full">
            <p className="text-white text-[15px] font-mono font-bold tracking-widest leading-none">ACC: {formatAccountNumber(accountNumber)}</p>
            <p className="text-[#8B98A9] text-[8px] font-bold uppercase tracking-widest leading-tight break-words px-1 opacity-80">MERCHANT: {businessName}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
