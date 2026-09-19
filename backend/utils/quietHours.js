import { EAT_OFFSET_MS } from './eatSchedule.js';

// SMS to merchants is held between these EAT hours — nobody wants a
// "you haven't logged in for a while" text at 2am. [start, end) wraps midnight.
export const QUIET_START_HOUR = 20; // 8pm
export const QUIET_END_HOUR = 7;    // 7am

export function isQuietHoursEAT(now = new Date()) {
  const hour = new Date(now.getTime() + EAT_OFFSET_MS).getUTCHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}
