import React from 'react'
import { useMerchantAuth } from '../../context/MerchantAuthContext'

// Shown on every signed-in page while an admin has paused this merchant's
// incoming payments. Reads the live account flag, so it can't be dismissed
// while the pause is on and disappears by itself when it's lifted.
export default function CollectionsPausedNotice() {
  const { merchant } = useMerchantAuth()
  if (!merchant?.inboundLocked) return null

  const reason = merchant.inboundLockReason || 'scheduled system maintenance'
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <span className="material-symbols-outlined text-amber-700 text-[22px] shrink-0">engineering</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-amber-950">Payment collection is temporarily paused</p>
        <p className="text-[13px] text-amber-900 mt-0.5 leading-relaxed">
          This is due to {reason}. Please ask your customers not to pay you through PayChain, including by paybill, until
          collection resumes: any payment sent in the meantime is held and not added to your balance. You can still view
          your history and withdraw your balance. We'll notify you as soon as collection resumes.
        </p>
      </div>
    </div>
  )
}
