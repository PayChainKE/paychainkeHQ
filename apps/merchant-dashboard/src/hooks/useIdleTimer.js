import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'scroll', 'wheel', 'click',
]

/**
 * Logout-on-idle timer that is TAB-AWARE:
 *   • The timer only counts time the user is actively on this tab.
 *   • Switching to another tab PAUSES the countdown.
 *   • Coming back to this tab RESETS the countdown (they're active again).
 *
 * @param {object}   opts
 * @param {number}   opts.timeout    Total idle ms before logout (default 40 min)
 * @param {number}   opts.warningMs  ms before logout to show the warning (default 5 min)
 * @param {function} opts.onWarn     Called when warning countdown starts
 * @param {function} opts.onIdle     Called when full timeout expires → trigger logout
 * @param {function} opts.onActive   Called when activity detected after warning shown
 * @param {boolean}  opts.enabled    Pass false to disable when logged out
 */
export default function useIdleTimer({
  timeout   = 40 * 60 * 1000,
  warningMs =  5 * 60 * 1000,
  onWarn    = () => {},
  onIdle    = () => {},
  onActive  = () => {},
  enabled   = true,
} = {}) {
  const warnTimer  = useRef(null)
  const idleTimer  = useRef(null)
  const isWarning  = useRef(false)

  const clearTimers = () => {
    clearTimeout(warnTimer.current)
    clearTimeout(idleTimer.current)
  }

  const reset = useCallback(() => {
    clearTimers()
    if (!enabled) return

    if (isWarning.current) {
      isWarning.current = false
      onActive()
    }

    warnTimer.current = setTimeout(() => {
      isWarning.current = true
      onWarn()
      idleTimer.current = setTimeout(onIdle, warningMs)
    }, timeout - warningMs)
  }, [enabled, timeout, warningMs, onWarn, onIdle, onActive])

  useEffect(() => {
    if (!enabled) { clearTimers(); return }

    // Start fresh
    reset()

    // Reset on any real user interaction
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Tab visibility handler:
    //   hidden  → pause (clear timers so they don't fire while away)
    //   visible → reset (treat returning as activity; restart the full countdown)
    const handleVisibility = () => {
      if (document.hidden) {
        clearTimers()
      } else {
        reset()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, reset])

  return { reset }
}
