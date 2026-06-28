import React, { useState } from 'react'
import useInstallPrompt from '../../hooks/useInstallPrompt'

export default function InstallBanner() {
  const { showBanner, isIOS, triggerInstall, dismiss } = useInstallPrompt()
  const [installing, setInstalling] = useState(false)

  if (!showBanner) return null

  async function handleInstall() {
    setInstalling(true)
    await triggerInstall()
    setInstalling(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] px-4 pb-4 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-400">
        <div className="bg-[#06201B] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] border border-emerald-900/60 overflow-hidden">
          {/* Green accent top line */}
          <div className="h-[3px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600" />

          <div className="flex items-center gap-4 px-4 py-3.5">
            {/* App icon */}
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
              <img src="/favicon.png" alt="PayChain" className="w-8 h-8 object-contain rounded-lg" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white leading-tight">Install PayChain</p>
              {isIOS ? (
                <p className="text-[11px] text-emerald-300/80 font-medium mt-0.5 leading-tight">
                  Tap <span className="inline-flex items-center gap-0.5 font-bold text-white">
                    <span className="material-symbols-outlined text-[13px]">ios_share</span> Share
                  </span> then <strong className="text-white">Add to Home Screen</strong>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-300/80 font-medium mt-0.5 leading-tight">
                  Add to your home screen for instant access
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {!isIOS && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#06201B] text-[12px] font-black uppercase tracking-widest rounded-xl shadow-md active:scale-[0.97] transition-all disabled:opacity-60 flex items-center gap-1.5"
                >
                  {installing
                    ? <div className="w-3.5 h-3.5 border-2 border-[#06201B]/30 border-t-[#06201B] rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-[14px]">download</span>
                  }
                  Install
                </button>
              )}
              <button
                onClick={dismiss}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
