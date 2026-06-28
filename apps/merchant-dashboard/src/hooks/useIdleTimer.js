import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'scroll', 'wheel', 'click',
]

/**
 * Silent idle-logout timer based on a last-active timestamp.
 *
 * Rules:
 *   - Any user interaction on this tab stamps Date.now() as "last active".
 *   - Away from tab < timeout  → fine, re-arm countdown for remaining time.
 *   - Away from tab >= timeout → silent logout the moment they return.
 *   - Idle on tab for >= timeout → silent logout, no warning shown.
 */
export default function useIdleTimer({
  timeout = 40 * 60 * 1000, // 40 minutes
  onIdle  = () => {},
  enabled = true,
} = {}) {
  const lastActiveAt = useRef(Date.now())
  const idleTimer    = useRef(null)
  const pollInterval = useRef(null)

  const clearAll = () => {
    clearTimeout(idleTimer.current)
    clearInterval(pollInterval.current)
  }

  const reset = useCallback(() => {
    if (!enabled) return
    lastActiveAt.current = Date.now()
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(onIdle, timeout)
  }, [enabled, timeout, onIdle])

  const checkElapsed = useCallback(() => {
    if (!enabled) return
    if (Date.now() - lastActiveAt.current >= timeout) onIdle()
  }, [enabled, timeout, onIdle])

  useEffect(() => {
    if (!enabled) { clearAll(); return }

    reset()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Poll every 30 s to catch the timeout even if the user never moves the mouse
    pollInterval.current = setInterval(checkElapsed, 30_000)

    // On tab return: check how long they were actually away
    const handleVisibility = () => {
      if (!document.hidden) {
        const elapsed = Date.now() - lastActiveAt.current
        if (elapsed >= timeout) {
          onIdle()
        } else {
          // Re-arm for the remaining window
          clearTimeout(idleTimer.current)
          idleTimer.current = setTimeout(onIdle, timeout - elapsed)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearAll()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, reset, checkElapsed, timeout, onIdle])

  return { reset }
}
