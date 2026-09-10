import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import { notifyAdmins, escapeHtml } from './securityAlerts.js';
import { logAudit } from './auditLog.js';

// Ad-hoc, single-shot outbound money movements — the pattern a compromised
// account would actually use to drain funds one request at a time.
// Deliberately excludes 'bulk_pay' and anything tagged with a
// payoutBatchId: Bulk Pay is already one deliberate PIN-authorized batch
// (see bulkPayController.js#authorizeBatch), a fundamentally different and
// already-controlled flow — a legitimate 50-person payroll run must never
// trip this.
const AD_HOC_OUTBOUND_TYPES = [
  'withdrawal', 'ncba_outbound', 'mpesa_b2c', 'mpesa_b2b',
  'ncba_mobile_b2w', 'ncba_lipa_na_mpesa',
  'ncba_kplc', 'ncba_kplc_prepaid', 'ncba_ncwsc',
];

const WINDOW_MS = 5 * 60 * 1000;
// A 3rd ad-hoc outbound transfer landing inside the window trips the lock —
// i.e. up to 2 are allowed through freely, the 3rd is the one blocked.
const MAX_FREE_IN_WINDOW = 2;
// Self-healing, not admin-gated: a false positive (a genuine merchant
// paying 3 real bills back-to-back) resolves itself in 15 minutes instead
// of stranding them until someone reviews it. Comfortably longer than
// WINDOW_MS, so by the time it lifts, the transfers that tripped it have
// already aged out of the 5-minute count on their own.
const LOCK_DURATION_MS = 15 * 60 * 1000;

export class OutboundVelocityLockedError extends Error {}

// Call AFTER PIN verification but BEFORE the balance is actually debited,
// on every ad-hoc (non-Bulk-Pay) money-out endpoint (bank payout, M-Pesa
// B2C, Lipa na M-Pesa, etc). Throws OutboundVelocityLockedError the instant
// this would be the merchant's 3rd ad-hoc outbound transfer inside 5
// minutes, and locks outbound transfers on the account for 15 minutes —
// auto-clearing on its own after that, no admin action required. An admin
// can still clear it early via the OTP-gated 'unlock_outbound' action
// (adminController.js) if they've reviewed it and are confident it's safe.
// Login and everything else on the account is unaffected; only money-out
// is blocked, so a false positive doesn't strand a merchant out of their
// own account.
export async function assertOutboundVelocityOk(merchantId) {
  const merchant = await Merchant.findById(merchantId).select('outboundLocked outboundLockedAt businessName email phone');
  if (!merchant) return; // caller's own not-found handling already covers this

  if (merchant.outboundLocked) {
    const lockedAtMs = merchant.outboundLockedAt ? new Date(merchant.outboundLockedAt).getTime() : 0;
    const elapsedMs = Date.now() - lockedAtMs;

    if (elapsedMs < LOCK_DURATION_MS) {
      const minutesLeft = Math.max(1, Math.ceil((LOCK_DURATION_MS - elapsedMs) / 60000));
      throw new OutboundVelocityLockedError(
        `Outbound transfers are temporarily locked for security. Try again in about ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
      );
    }

    // 15 minutes have passed — auto-clear and let this request proceed to
    // the normal velocity check below rather than staying locked forever.
    await Merchant.updateOne(
      { _id: merchantId },
      { $set: { outboundLocked: false, outboundLockedAt: null, outboundLockReason: null } }
    );
    logAudit({
      action: 'merchant.outbound_velocity_auto_unlock',
      category: 'security',
      severity: 'info',
      message: 'Outbound transfer lock auto-expired after 15 minutes',
      merchant,
      actor: { type: 'system', id: null, email: null, name: 'system' },
    });
  }

  const since = new Date(Date.now() - WINDOW_MS);
  const recentCount = await Transaction.countDocuments({
    merchantId,
    type: { $in: AD_HOC_OUTBOUND_TYPES },
    payoutBatchId: null,
    createdAt: { $gte: since },
  });

  if (recentCount < MAX_FREE_IN_WINDOW) return;

  await Merchant.updateOne(
    { _id: merchantId },
    {
      $set: {
        outboundLocked: true,
        outboundLockedAt: new Date(),
        outboundLockReason: `${recentCount + 1} ad-hoc outbound transfers within 5 minutes`,
      },
    }
  );

  logAudit({
    action: 'merchant.outbound_velocity_lock',
    category: 'security',
    severity: 'critical',
    message: 'Outbound transfers auto-locked for 15 minutes — rapid transfer pattern detected',
    merchant,
    actor: { type: 'system', id: null, email: null, name: 'system' },
  });

  notifyAdmins({
    type: 'outbound_velocity_lockout',
    severity: 'critical',
    subject: `Outbound transfers auto-locked: ${merchant.businessName || merchant.email}`,
    heading: 'Rapid Outbound Transfer Pattern Detected',
    details: `<strong>${escapeHtml(merchant.businessName || merchant.phone || merchant.email)}</strong> attempted ${recentCount + 1} outbound transfers within 5 minutes — the exact pattern of an account being drained after a takeover. Outbound transfers (bank payouts, M-Pesa, bill pay) have been automatically locked on this account for 15 minutes and will unlock on their own — no action required. The merchant can still log in and view their account; only money-out is blocked. If you've confirmed this is a real threat, you can also clear or re-review the account via Merchants &gt; this account.`,
    metadata: { merchantId: String(merchantId) },
  });

  throw new OutboundVelocityLockedError(
    'Unusual transfer activity detected. Outbound transfers have been temporarily locked on this account for 15 minutes for security — our team has been notified.'
  );
}
