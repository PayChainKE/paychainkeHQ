import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

/**
 * Silent idle-logout on wall-clock time.
 *
 * The 50-minute clock runs continuously regardless of which tab is active.
 * - User interacts on the dashboard → resets the 50-minute clock.
 * - 50 minutes pass with no interaction (on any tab) → silent logout.
 * - Away in another tab < 50 min → NOT logged out on return.
 * - Away in another tab >= 50 min → logged out (interval fires while hidden,
 *   or within 10 s of the interval tick after they return).
 */
export default function useIdleTimer({
  timeout = 50 * 60 * 1000,
  onIdle  = () => {},
  enabled = true,
} = {}) {
  const onIdleRef = useRef(onIdle)
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
    }, 10_000)

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [enabled, timeout])
}
