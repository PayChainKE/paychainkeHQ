import {
  canReceivePayments,
  normalizeInboundBlockReason,
  merchantBlockedMessage,
  DEFAULT_INBOUND_BLOCK_REASON,
  MAX_INBOUND_BLOCK_REASON,
} from '../utils/merchantPaymentAcceptance.js';

describe('canReceivePayments', () => {
  it('refuses missing, locked and blocked merchants', () => {
    expect(canReceivePayments(null)).toBe(false);
    expect(canReceivePayments({ status: 'locked' })).toBe(false);
    expect(canReceivePayments({ status: 'active', inboundLocked: true })).toBe(false);
    expect(canReceivePayments({ status: 'active', inboundLocked: false })).toBe(true);
  });
});

describe('normalizeInboundBlockReason', () => {
  it('falls back to the default when empty', () => {
    expect(normalizeInboundBlockReason('   ')).toBe(DEFAULT_INBOUND_BLOCK_REASON);
    expect(normalizeInboundBlockReason(undefined)).toBe(DEFAULT_INBOUND_BLOCK_REASON);
  });
  it('tidies text so it reads inside a sentence', () => {
    expect(normalizeInboundBlockReason('  year-end   maintenance. ')).toBe('year-end maintenance');
  });
  it('rejects text too long to send', () => {
    expect(normalizeInboundBlockReason('x'.repeat(MAX_INBOUND_BLOCK_REASON + 1))).toBeNull();
    expect(normalizeInboundBlockReason('x'.repeat(MAX_INBOUND_BLOCK_REASON))).not.toBeNull();
  });
});

describe('merchantBlockedMessage', () => {
  it('gives the merchant the reason admin chose', () => {
    expect(merchantBlockedMessage({ inboundLocked: true, inboundLockReason: 'a scheduled system upgrade' }))
      .toContain('due to a scheduled system upgrade');
  });
  it('defaults for blocks made before reasons existed', () => {
    expect(merchantBlockedMessage({ inboundLocked: true })).toContain(`due to ${DEFAULT_INBOUND_BLOCK_REASON}`);
  });
});
