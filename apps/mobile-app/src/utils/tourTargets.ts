import { View } from 'react-native';

// ─── Tour target registry ───────────────────────────────────────────────────
// React Native's mobile equivalent of the web dashboard's `data-tour="..."`
// attribute + `document.querySelector` — there's no DOM here, so a target
// component instead registers its own measurable View ref under a string
// key, and SpotlightTour looks it up by that same key when a step needs it.
//
// Plain module-level Map (not React Context) is deliberate: registration is
// a ref side-effect that never needs to trigger a re-render of anything
// between the target and the tour engine — a Map read directly when the
// tour actually needs to measure something is simpler and cheaper than
// threading a context value through every screen that has a target.
const targets = new Map<string, React.RefObject<View | null>>();

export function registerTourTarget(id: string, ref: React.RefObject<View | null>) {
  targets.set(id, ref);
}

export function unregisterTourTarget(id: string) {
  targets.delete(id);
}

export function getTourTarget(id: string): React.RefObject<View | null> | undefined {
  return targets.get(id);
}
