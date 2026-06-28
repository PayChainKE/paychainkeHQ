import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'scroll', 'wheel', 'click',
]

/**
 * Idle-logout timer based on a last-active TIMESTAMP (not a pauseable clock).
 *
 * Behaviour:
 *   • Any interaction on this tab stamps Date.now() as "last active".
 *   • A periodic check fires every 30 s to see if the idle window has passed.
 *   • When the tab becomes VISIBLE again, an immediate check runs:
 *       – Been away < timeout   → still within session, reset the poll timer.
 *       – Been away >= timeout  → log out immediately on return.
 *
 * This means:
 *   • Switching tabs for a few minutes  → NOT logged out on return.
 *   • Switching tabs for 40+ minutes    → logged out the moment they return.
 *   • Sitting idle on this tab for 40 min → warning at 35 min, logout at 40 min.
 */
export default function useIdleTimer({
  timeout   = 40 * 60 * 1000,   // 40 minutes total idle
  warningMs =  5 * 60 * 1000,   // warn 5 minutes before logout
  onWarn    = () => {},
  onIdle    = () => {},
  onActive  = () => {},
  enabled   = true,
} = {}) {
  const lastActiveAt = useRef(Date.now())
  const warnTimer    = useRef(null)
  const idleTimer    = useRef(null)
  const isWarning    = useRef(false)
  const pollInterval = useRef(null)

  const clearTimers = () => {
    clearTimeout(warnTimer.current)
    clearTimeout(idleTimer.current)
    clearInterval(pollInterval.current)
  }

  // Stamp now and (re)arm the warn + idle timeouts.
  const reset = useCallback(() => {
    if (!enabled) return
    lastActiveAt.current = Date.now()

    clearTimeout(warnTimer.current)
    clearTimeout(idleTimer.current)

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

  // Check elapsed time against the stored timestamp.
  // Called both on a poll interval and on tab-visible events.
  const checkElapsed = useCallback(() => {
    if (!enabled) return
    const idle = Date.now() - lastActiveAt.current
    if (idle >= timeout) {
      onIdle()
    } else if (idle >= timeout - warningMs && !isWarning.current) {
      isWarning.current = true
      onWarn()
    }
  }, [enabled, timeout, warningMs, onWarn, onIdle])

  useEffect(() => {
    if (!enabled) { clearTimers(); return }

    // Arm the timers and stamp last-active for the first time.
    reset()

    // Reset last-active stamp on any real user interaction.
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Poll every 30 s so the warning fires even if the user never moves the
    // mouse (e.g. reading a long page). Uses elapsed-time check, not a new
    // setTimeout chain, so it works correctly alongside the tab-visibility logic.
    pollInterval.current = setInterval(checkElapsed, 30_000)

    // Tab visibility: check elapsed time immediately on return.
    //   < timeout  → they're fine; re-arm the timer for the remaining window.
    //   >= timeout → log them out right now.
    const handleVisibility = () => {
      if (!document.hidden) {
        checkElapsed()
        // If checkElapsed didn't fire onIdle, re-arm the remaining countdown.
        const remaining = timeout - (Date.now() - lastActiveAt.current)
        if (remaining > 0) {
          clearTimeout(warnTimer.current)
          clearTimeout(idleTimer.current)
          isWarning.current = false

          if (remaining > warningMs) {
            warnTimer.current = setTimeout(() => {
              isWarning.current = true
              onWarn()
              idleTimer.current = setTimeout(onIdle, warningMs)
            }, remaining - warningMs)
          } else {
            isWarning.current = true
            onWarn()
            idleTimer.current = setTimeout(onIdle, remaining)
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, reset, checkElapsed, timeout, warningMs, onWarn, onIdle])

  return { reset }
}
