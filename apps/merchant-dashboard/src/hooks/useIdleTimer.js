import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'scroll', 'wheel', 'click',
]

/**
 * Calls onWarn() when the user has been idle for (timeout - warningMs),
 * then calls onIdle() after the full timeout.  Any user activity resets
 * both timers and calls onActive() so the warning modal can be dismissed.
 *
 * @param {object} opts
 * @param {number}   opts.timeout    Total idle ms before logout (default 15 min)
 * @param {number}   opts.warningMs  How many ms before logout to show warning (default 2 min)
 * @param {function} opts.onWarn     Called when warning countdown starts
 * @param {function} opts.onIdle     Called when the full timeout expires → logout
 * @param {function} opts.onActive   Called when activity is detected after warning
 * @param {boolean}  opts.enabled    Pass false to disable (e.g. when logged out)
 */
export default function useIdleTimer({
  timeout    = 15 * 60 * 1000,
  warningMs  = 2  * 60 * 1000,
  onWarn     = () => {},
  onIdle     = () => {},
  onActive   = () => {},
  enabled    = true,
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
      idleTimer.current = setTimeout(() => {
        onIdle()
      }, warningMs)
    }, timeout - warningMs)
  }, [enabled, timeout, warningMs, onWarn, onIdle, onActive])

  useEffect(() => {
    if (!enabled) { clearTimers(); return }

    reset()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [enabled, reset])

  return { reset }
}
