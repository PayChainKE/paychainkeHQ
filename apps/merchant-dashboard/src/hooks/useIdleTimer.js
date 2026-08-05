import { useEffect, useRef, useState, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];
const POLL_MS = 5000;

// Persisted counterpart to the in-tab idle clock below. The in-tab timer
// (lastActiveRef) lives in memory and is discarded the moment the tab
// closes — reopening the app afterwards restored whatever session was
// cached in localStorage with no idea how long it had actually been away,
// so someone could close the tab 10 minutes into an idle session and
// reopen it hours later straight onto the dashboard. These two functions
// let an AuthContext persist "when were we last active" across tab
// closes, and check it BEFORE trusting a cached session on mount — same
// 15-minute policy as the in-tab timer, just surviving a closed tab too.
export function markPersistedActive(storageKey) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — the in-tab
    // timer still works, this is just a best-effort backstop.
  }
}

export function isPersistedIdleExpired(storageKey, timeoutMs) {
  if (!storageKey) return false;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false; // no record yet — never force-logout a session that predates this check
    const lastActive = Number(raw);
    if (!Number.isFinite(lastActive)) return false;
    return Date.now() - lastActive > timeoutMs;
  } catch {
    return false;
  }
}

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
export function useIdleTimer({ timeoutMs, warningMs, onIdle, enabled, storageKey }) {
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
    markPersistedActive(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    lastActiveRef.current = Date.now();
    warningShownRef.current = false;
    setShowWarning(false);
    markPersistedActive(storageKey);

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
      // Synced once per poll (not per raw DOM event — mousemove alone can
      // fire hundreds of times a second, and localStorage writes are
      // synchronous) so a closed tab still has a reasonably fresh
      // last-active timestamp to check against on the next app open.
      if (!warningShownRef.current) markPersistedActive(storageKey);
    }, POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [enabled, timeoutMs, warningMs]);

  return { showWarning, resetActivity };
}
