import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// ─── SpotlightTour ───────────────────────────────────────────────────────────
// Shared engine behind every onboarding walkthrough — replaces the old
// generic centered-modal pattern (every *Walkthrough.jsx used to render the
// exact same "icon + title + body in a box" regardless of what it was
// describing) with a real coach-mark: it finds the actual DOM element a step
// is talking about (`data-tour="<target>"`), scrolls it into view, and draws
// a glowing spotlight + pointer around it with the explanation anchored
// right next to it. A step can also carry a `route` — if the merchant isn't
// already on that page, the tour navigates there itself before targeting.
//
// Step shape: { target?, route?, icon, title, body, placement? }
//   - target: the value of a `data-tour="..."` attribute somewhere on the
//     page. Omit for a pure intro/outro step, which renders as a centered
//     card instead of a spotlight (there's nothing to point at yet).
//   - route: path to navigate to first if the merchant isn't already there.
//   - placement: 'top'|'bottom'|'left'|'right'|'auto' (default 'auto').
//
// Step index is persisted to sessionStorage under `storageKey` — every page
// in this app wraps itself in its own <MerchantLayout>, so navigating to a
// step's `route` unmounts and remounts this component; without persisting
// the index, a cross-page tour would silently reset to step 0 on every
// step that required navigation.
export default function SpotlightTour({
  steps,
  visible,
  onFinish,
  onSkip,
  storageKey,
  finishLabel = 'Done',
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const [stepIndex, setStepIndex] = useState(() => {
    if (!visible) return 0
    const saved = Number(sessionStorage.getItem(storageKey))
    return Number.isInteger(saved) && saved >= 0 && saved < steps.length ? saved : 0
  })
  const [rect, setRect] = useState(null)
  const [targetMissing, setTargetMissing] = useState(false)
  const [entered, setEntered] = useState(false)
  const cardRef = useRef(null)

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  const persistIndex = useCallback((i) => {
    sessionStorage.setItem(storageKey, String(i))
  }, [storageKey])

  const cleanup = useCallback(() => {
    sessionStorage.removeItem(storageKey)
  }, [storageKey])

  // Navigate to the step's route first, if we're not already there.
  useEffect(() => {
    if (!visible || !step) return
    if (step.route && location.pathname !== step.route) {
      persistIndex(stepIndex)
      navigate(step.route)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex, step?.route])

  // Locate the target element (polls briefly — the page just navigated or a
  // section may still be loading its own data), scroll it into view, and
  // track its position across resize/scroll so the spotlight stays glued to
  // it instead of drifting.
  useLayoutEffect(() => {
    if (!visible || !step) return
    if (!step.target) {
      setRect(null)
      setTargetMissing(false)
      return
    }

    let cancelled = false
    let attempts = 0
    let scrolledIntoView = false
    setEntered(false)
    setTargetMissing(false)

    const locate = () => {
      if (cancelled) return
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el) {
        if (!scrolledIntoView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          scrolledIntoView = true
        }
        // Give the smooth-scroll a moment to settle before measuring, then
        // keep measuring on every animation frame so the spotlight tracks
        // scroll/layout shifts (e.g. images finishing loading above it)
        // without needing a real scroll-event listener on every ancestor.
        const measure = () => {
          if (cancelled) return
          const r = el.getBoundingClientRect()
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
          setTargetMissing(false)
          setEntered(true)
          rafRef.current = requestAnimationFrame(measure)
        }
        rafRef.current = requestAnimationFrame(measure)
        return
      }
      attempts += 1
      if (attempts > 30) {
        // ~3s of polling — give up and fall back to a centered card rather
        // than leaving the tour stuck on a target that never rendered
        // (e.g. an empty-state page that hides the button being described).
        setTargetMissing(true)
        setEntered(true)
        return
      }
      timeoutRef.current = setTimeout(locate, 100)
    }

    const timeoutRef = { current: null }
    const rafRef = { current: null }
    locate()

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [visible, stepIndex, step?.target])

  if (!visible || !step) return null

  const goNext = () => {
    if (isLast) {
      cleanup()
      onFinish?.()
      return
    }
    const next = stepIndex + 1
    setStepIndex(next)
    persistIndex(next)
  }

  const goBack = () => {
    if (stepIndex === 0) return
    const prev = stepIndex - 1
    setStepIndex(prev)
    persistIndex(prev)
  }

  const skip = () => {
    cleanup()
    onSkip ? onSkip() : onFinish?.()
  }

  const showSpotlight = !!step.target && rect && !targetMissing

  return (
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop — dark PayChain-green tint rather than plain black, and a
          soft blur so the highlighted element still reads as "the same app"
          rather than a jarring modal takeover. */}
      <div className="absolute inset-0 bg-[#03110b]/78 backdrop-blur-[2px] transition-opacity duration-300" />

      {showSpotlight && (
        <SpotlightRing rect={rect} entered={entered} />
      )}

      <TourCard
        ref={cardRef}
        step={step}
        rect={showSpotlight ? rect : null}
        stepIndex={stepIndex}
        totalSteps={steps.length}
        isLast={isLast}
        entered={entered}
        onNext={goNext}
        onBack={stepIndex > 0 ? goBack : null}
        onSkip={skip}
        finishLabel={finishLabel}
      />
    </div>
  )
}

// ─── SpotlightRing ───────────────────────────────────────────────────────────
// The glowing cutout around the target — a box exactly matching its rect,
// with a huge box-shadow standing in for the rest of the backdrop (the
// classic "spotlight via box-shadow" technique: the box itself is invisible,
// only its shadow paints, and the shadow's spread is large enough to cover
// the full viewport in every direction). pointer-events: none so it's purely
// decorative and never blocks a real click landing on the app underneath.
function SpotlightRing({ rect, entered }) {
  const pad = 8
  return (
    <div
      className={`absolute rounded-2xl pointer-events-none transition-all duration-500 ease-out ${entered ? 'opacity-100' : 'opacity-0 scale-95'}`}
      style={{
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: '0 0 0 9999px rgba(3,17,11,0.78), 0 0 0 2px rgba(52,211,153,0.9), 0 0 0 6px rgba(52,211,153,0.25), 0 0 42px 10px rgba(52,211,153,0.35)',
      }}
    >
      <div className="absolute inset-0 rounded-2xl ring-1 ring-emerald-300/40 animate-pulse-slow" />
    </div>
  )
}

// ─── TourCard ────────────────────────────────────────────────────────────────
// The step content itself — anchored beside the spotlighted element when
// there is one (auto-picks whichever side of the target has the most room,
// clamped to stay fully on-screen), or centered on the viewport for an
// intro/outro step with no target.
const TourCard = React.forwardRef(function TourCard(
  { step, rect, stepIndex, totalSteps, isLast, entered, onNext, onBack, onSkip, finishLabel },
  ref
) {
  const [pos, setPos] = useState(null)
  const CARD_W = 360
  const GAP = 18

  useLayoutEffect(() => {
    if (!rect) { setPos(null); return }
    const cardEl = ref.current
    const cardH = cardEl?.offsetHeight || 220
    const vw = window.innerWidth
    const vh = window.innerHeight

    const spaceBelow = vh - (rect.top + rect.height)
    const spaceAbove = rect.top
    const placeBelow = step.placement === 'top' ? false : step.placement === 'bottom' ? true : spaceBelow >= cardH + GAP || spaceBelow >= spaceAbove

    let top = placeBelow ? rect.top + rect.height + GAP : rect.top - cardH - GAP
    top = Math.max(12, Math.min(top, vh - cardH - 12))

    let left = rect.left + rect.width / 2 - CARD_W / 2
    left = Math.max(12, Math.min(left, vw - CARD_W - 12))

    // Arrow points from the card back at the horizontal center of the
    // target, wherever that lands relative to the (possibly clamped) card.
    const arrowLeft = Math.max(24, Math.min(rect.left + rect.width / 2 - left, CARD_W - 24))

    setPos({ top, left, arrowUp: !placeBelow, arrowLeft })
  }, [rect, step.placement, ref])

  const centered = !rect
  const style = centered
    ? {}
    : pos
      ? { position: 'absolute', top: pos.top, left: pos.left, width: CARD_W }
      : { position: 'absolute', opacity: 0, top: 0, left: 0, width: CARD_W }

  return (
    <div
      className={centered
        ? 'absolute inset-0 flex items-center justify-center p-6'
        : ''}
    >
      <div
        ref={ref}
        style={style}
        className={`relative bg-gradient-to-b from-[#0a2b20] to-[#06201b] rounded-[24px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] border border-emerald-400/10 overflow-hidden transition-all duration-400 ease-out ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        } ${centered ? 'w-full max-w-sm' : ''}`}
      >
        {!centered && pos && (
          <div
            className={`absolute w-3.5 h-3.5 bg-[#0a2b20] border-emerald-400/10 rotate-45 ${
              pos.arrowUp ? 'bottom-0 translate-y-1/2 border-b border-r' : 'top-0 -translate-y-1/2 border-t border-l'
            }`}
            style={{ left: pos.arrowLeft - 7 }}
          />
        )}

        {/* Thin gilded accent line — the one flourish that reads "premium"
            at a glance, echoed from the emerald/gold thread already used in
            the sidebar's active-state accents elsewhere in this app. */}
        <div className="h-[3px] w-full bg-gradient-to-r from-emerald-500 via-amber-300 to-emerald-500" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-6 bg-emerald-400' : 'w-1 bg-white/15'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="text-[10px] font-black uppercase tracking-widest text-white/35 hover:text-white/70 transition-colors"
            >
              Skip Tour
            </button>
          </div>

          <div className="flex items-start gap-4 mb-1">
            <div className="w-11 h-11 rounded-xl bg-emerald-400/10 border border-emerald-300/20 flex items-center justify-center text-emerald-300 shrink-0">
              <span className="material-symbols-outlined text-[22px]">{step.icon}</span>
            </div>
            <div className="pt-0.5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/80 mb-1">
                {stepIndex + 1} / {totalSteps}
              </p>
              <h3 className="font-headline text-lg text-white font-bold tracking-tight leading-snug">
                {step.title}
              </h3>
            </div>
          </div>
          <p className="text-[13px] text-white/60 font-medium leading-relaxed mt-3 mb-6">
            {step.body}
          </p>

          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-3 rounded-xl text-white/50 font-black text-[11px] uppercase tracking-widest hover:bg-white/5 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-[#06201B] font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_20px_-6px_rgba(52,211,153,0.5)]"
            >
              {isLast ? finishLabel : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
