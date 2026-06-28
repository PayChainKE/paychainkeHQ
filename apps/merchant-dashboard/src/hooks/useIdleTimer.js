import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

/**
 * Silent idle-logout.
 *
 * - Tracks last-activity as a plain timestamp (no React state, no re-renders).
 * - A 10-second interval checks whether the idle window has elapsed.
 * - Works correctly across tab switches: the timer is wall-clock time, not
 *   "time spent on this tab", so 40+ minutes away = logout; 2 minutes away = fine.
 * - onIdle is stored in a ref so changing it never re-creates the effect.
 */
export default function useIdleTimer({
  timeout = 40 * 60 * 1000, // 40 minutes
  onIdle  = () => {},
  enabled = true,
} = {}) {
  const onIdleRef = useRef(onIdle)
  // Keep the ref current without triggering the effect
  useEffect(() => { onIdleRef.current = onIdle })

  useEffect(() => {
    if (!enabled) return

    let lastActive = Date.now()

    const handleActivity = () => { lastActive = Date.now() }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    const interval = setInterval(() => {
      if (Date.now() - lastActive >= timeout) {
        onIdleRef.current()
      }
    }, 10_000) // check every 10 s

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [enabled, timeout]) // onIdle intentionally excluded — accessed via ref above
}
