import Automation from '../models/Automation.js';
import { mostRecentSlot } from '../utils/eatSchedule.js';

// A slot the server slept through is only honoured this long after it was due.
export const MISSED_SLOT_GRACE_MS = 12 * 60 * 60 * 1000;

export async function recordRun(key, status, summary, extra = {}) {
  await Automation.updateOne(
    { key },
    { $set: { lastRunAt: new Date(), lastRunStatus: status, lastRunSummary: String(summary).slice(0, 500), ...extra } }
  );
}

// Interval automations ("check every hour"): claims the next run atomically by
// stamping lastSlotAt = now, only if enough time has passed. Whichever
// tick/instance wins the update does the run; the rest get null.
export async function claimSweep(key, now, everyMs) {
  return Automation.findOneAndUpdate(
    { key, enabled: true, $or: [{ lastSlotAt: null }, { lastSlotAt: { $lte: new Date(now.getTime() - everyMs) } }] },
    { $set: { lastSlotAt: now } },
    { returnDocument: 'after' }
  );
}

// Weekly-slot automations ("Mondays 08:00 EAT"): claims the most recent slot
// atomically. Returns { state: 'not_due' | 'claimed' | 'missed', slot, auto }.
export async function claimSlot(auto, now) {
  const cfg = auto.config || {};
  const slot = mostRecentSlot(now, cfg.days, cfg.time);
  if (!slot) return { state: 'not_due' };
  if (auto.lastSlotAt && auto.lastSlotAt.getTime() >= slot.getTime()) return { state: 'not_due' };
  const claimed = await Automation.findOneAndUpdate(
    { key: auto.key, $or: [{ lastSlotAt: null }, { lastSlotAt: { $lt: slot } }] },
    { $set: { lastSlotAt: slot } },
    { returnDocument: 'after' }
  );
  if (!claimed) return { state: 'not_due' };
  if (now.getTime() - slot.getTime() > MISSED_SLOT_GRACE_MS) return { state: 'missed', slot, auto: claimed };
  return { state: 'claimed', slot, auto: claimed };
}
