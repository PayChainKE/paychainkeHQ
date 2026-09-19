import AutomationEvent from '../models/AutomationEvent.js';

// Atomically claims "stage X of automation K for subject S". Returns true if
// THIS caller got it (and so must do the work), false if someone already did —
// a previous run, an overlapping tick, or another server instance. The claim is
// written BEFORE the message is sent, so a crash between claim and send loses
// one message rather than ever sending two: at-most-once, the right trade for
// customer-facing messages.
export async function claimEvent(key, subjectId, stage) {
  try {
    await AutomationEvent.create({ key, subjectId: String(subjectId), stage });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

// Marks a claimed event as having failed to send (kept, not retried — see above).
export async function markEventFailed(key, subjectId, stage, detail) {
  await AutomationEvent.updateOne(
    { key, subjectId: String(subjectId), stage },
    { $set: { outcome: 'failed', detail: String(detail || '').slice(0, 300) } }
  ).catch(() => {});
}

// Whether the event was already claimed — for dry-run previews, which must
// show who WOULD be messaged without claiming anything.
export async function hasEvent(key, subjectId, stage) {
  return !!(await AutomationEvent.exists({ key, subjectId: String(subjectId), stage }));
}
