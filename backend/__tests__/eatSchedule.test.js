import { mostRecentSlot, nextSlot, parseTimeOfDay, normalizeDays } from '../utils/eatSchedule.js';

// EAT is UTC+3, so "09:00 EAT" is 06:00 UTC on the same calendar day.
// 2026-09-15 is a Tuesday; 2026-09-16 Wednesday; 2026-09-19 Saturday.
const TUE_TH_SAT = [2, 4, 6];
const at = (iso) => new Date(iso);

describe('eatSchedule', () => {
  test('parseTimeOfDay accepts HH:MM only', () => {
    expect(parseTimeOfDay('09:00')).toEqual({ h: 9, m: 0 });
    expect(parseTimeOfDay('23:59')).toEqual({ h: 23, m: 59 });
    expect(parseTimeOfDay('9:00')).toBeNull();
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('09:60')).toBeNull();
    expect(parseTimeOfDay(null)).toBeNull();
  });

  test('normalizeDays dedupes, sorts, and drops junk', () => {
    expect(normalizeDays([6, 2, 2, 4, 9, -1, 'x', 1.5])).toEqual([2, 4, 6]);
    expect(normalizeDays('nope')).toEqual([]);
  });

  test('mostRecentSlot: just after a slot returns that slot', () => {
    // Tue 09:05 EAT -> Tue 09:00 EAT = 06:00 UTC
    expect(mostRecentSlot(at('2026-09-15T06:05:00Z'), TUE_TH_SAT, '09:00').toISOString()).toBe('2026-09-15T06:00:00.000Z');
  });

  test('mostRecentSlot: before today\'s slot falls back to the previous slot day', () => {
    // Thu 08:00 EAT (before 09:00) -> previous is Tue 09:00 EAT
    expect(mostRecentSlot(at('2026-09-17T05:00:00Z'), TUE_TH_SAT, '09:00').toISOString()).toBe('2026-09-15T06:00:00.000Z');
  });

  test('mostRecentSlot: exactly on the slot counts as reached', () => {
    expect(mostRecentSlot(at('2026-09-15T06:00:00Z'), TUE_TH_SAT, '09:00').toISOString()).toBe('2026-09-15T06:00:00.000Z');
  });

  test('EAT day boundary: 23:30 UTC Monday is already Tuesday 02:30 EAT', () => {
    // Monday 2026-09-14 23:30 UTC = Tuesday 02:30 EAT. A 01:00 EAT Tuesday slot has passed.
    expect(mostRecentSlot(at('2026-09-14T23:30:00Z'), [2], '01:00').toISOString()).toBe('2026-09-14T22:00:00.000Z');
  });

  test('nextSlot: strictly after now, skips non-slot days', () => {
    // Wed 12:00 EAT -> next is Thu 09:00 EAT = Thu 06:00 UTC
    expect(nextSlot(at('2026-09-16T09:00:00Z'), TUE_TH_SAT, '09:00').toISOString()).toBe('2026-09-17T06:00:00.000Z');
    // exactly on a slot -> the following one (Thu -> Sat)
    expect(nextSlot(at('2026-09-17T06:00:00Z'), TUE_TH_SAT, '09:00').toISOString()).toBe('2026-09-19T06:00:00.000Z');
  });

  test('a single weekly day wraps a full week', () => {
    expect(nextSlot(at('2026-09-15T06:00:00Z'), [2], '09:00').toISOString()).toBe('2026-09-22T06:00:00.000Z');
    expect(mostRecentSlot(at('2026-09-15T05:59:00Z'), [2], '09:00').toISOString()).toBe('2026-09-08T06:00:00.000Z');
  });

  test('empty / invalid schedules yield null', () => {
    expect(mostRecentSlot(new Date(), [], '09:00')).toBeNull();
    expect(nextSlot(new Date(), [2], 'bad')).toBeNull();
  });
});
