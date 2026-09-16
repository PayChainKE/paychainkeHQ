import React from 'react'
import noConnectionIllustration from '../../assets/no-connection.png'

// Mirrors apps/mobile-app/src/components/ui/NoConnectionState.tsx — shown in
// place of a page's normal empty state when its most recent fetch actually
// failed (network down, request timeout, server unreachable), rather than
// falling through to a "No transactions yet"-style empty state that looks
// identical to a genuinely empty account and gives no indication anything
// went wrong. `onRetry`, when provided, re-runs the fetch that failed.
export default function NoConnectionState({ onRetry, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <img src={noConnectionIllustration} alt="" className="w-48 h-auto mb-4" />
      <p className="text-on-surface-variant font-medium text-[13px] leading-relaxed mb-5 max-w-xs">
        {message || 'Check your internet connection and try again.'}
      </p>
      {!!onRetry && (
        <button
          onClick={onRetry}
          className="bg-[#00351D] text-white px-6 py-3 rounded-full text-[13px] font-bold hover:bg-black transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
