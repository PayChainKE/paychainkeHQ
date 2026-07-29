import { useEffect, useRef, useState, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];
const POLL_MS = 5000;

/**
 * Wall-clock idle timer, deliberately simple: a single setInterval compares
 * Date.now() against a plain ref (never React state) updated by activity
 * listeners. No visibilitychange handling — idle time keeps accruing whether
 * the merchant switched tabs, switched apps, or just walked away, which is
 * the whole point (a stranger picking up the device shouldn't get a free
 * pass just because the tab was in the background).
 *
 * Once the warning fires, ambient activity (mousemove over the modal
 * backdrop etc.) is ignored — only the explicit `resetActivity()` call from
 * "Stay Logged In" extends the session. Otherwise the modal's own countdown
 * would visually disagree with the real idle clock.
 *
 * This history matters: this exact feature was reworked 7 times and then
 * removed entirely in an earlier iteration of this codebase after repeated
 * false-logout bugs, most of them caused by visibilitychange races or by
 * putting the callback identity in the effect's dependency array. Neither
 * pattern is used here on purpose.
 */
export function useIdleTimer({ timeoutMs, warningMs, onIdle, enabled }) {
  const lastActiveRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
    warningShownRef.current = false;
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    lastActiveRef.current = Date.now();
    warningShownRef.current = false;
    setShowWarning(false);

    const markActive = () => {
      if (warningShownRef.current) return;
      lastActiveRef.current = Date.now();
    };

    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActiveRef.current;
      if (elapsed >= timeoutMs) {
        onIdleRef.current?.();
        return;
      }
      if (elapsed >= timeoutMs - warningMs && !warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
      }
    }, POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [enabled, timeoutMs, warningMs]);

  return { showWarning, resetActivity };
}
