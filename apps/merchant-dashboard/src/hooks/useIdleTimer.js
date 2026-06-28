import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

/**
 * Silent idle-logout — tab-away time is NEVER counted as idle.
 *
 * How it works:
 *   - lastActive tracks the last user interaction timestamp.
 *   - When the tab is hidden, hiddenAt records the moment.
 *   - When the tab becomes visible again, lastActive is advanced by the
 *     full away duration — effectively removing that time from the idle clock.
 *   - A 10-second interval checks idle time ONLY while the tab is visible.
 *
 * Result:
 *   - Away in another tab for 2 min, 2 hours, all day → NOT logged out on return.
 *   - Sitting idle ON this tab for 40 min with no interaction → silent logout.
 */
export default function useIdleTimer({
  timeout = 40 * 60 * 1000,
  onIdle  = () => {},
  enabled = true,
} = {}) {
  const onIdleRef = useRef(onIdle)
  useEffect(() => { onIdleRef.current = onIdle })

  useEffect(() => {
    if (!enabled) return

    let lastActive = Date.now()
    let hiddenAt   = null

    const handleActivity = () => { lastActive = Date.now() }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt !== null) {
        // Advance lastActive by the time we were away so it doesn't count
        lastActive += Date.now() - hiddenAt
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const interval = setInterval(() => {
      if (!document.hidden && Date.now() - lastActive >= timeout) {
        onIdleRef.current()
      }
    }, 10_000)

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, timeout])
}
