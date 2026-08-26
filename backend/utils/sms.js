/**
 * Public "send an SMS" entrypoint used by controllers across the codebase
 * (M-Pesa payment confirmations, NCBA transaction alerts, merchant SMS OTP).
 * Real dispatch logic (Africa's Talking SDK, phone normalization, sender ID)
 * lives in utils/notificationService.js — this function's job is purely to
 * insulate every caller from a delivery failure: it never throws, always
 * resolves to { success, error? }, so a down/misconfigured SMS provider can
 * never stall or crash a core banking/database flow.
 */
import { sendAfricasTalkingSms } from './notificationService.js';
import { formatPhoneDisplay } from './formatPhoneDisplay.js';
import SmsLog from '../models/SmsLog.js';

// Global, process-wide throttle — a strict minimum gap between successive
// dispatches to Africa's Talking, regardless of which controller/request
// triggered them. Confirmed live (2026-08-04, see doc comment on
// smsSanitizer.js#sendStaggeredSms): two sends landing too close together
// get the second one queued by Africa's Talking for MINUTES, not seconds —
// a per-account send-rate limit, not something scoped to a single request.
// sendStaggeredSms and the SMS broadcast controller's own delay only
// stagger sends made within the SAME function call; they don't protect
// against two DIFFERENT concurrent transactions — e.g. two merchants both
// getting paid around the same time — whose SMS could still collide
// without a shared, app-wide gate. This is that gate: every real send in
// the app already funnels through sendSMS below, so throttling here
// covers every call site at once rather than requiring each one to
// remember to stagger itself.
//
// Two priority lanes, not one plain FIFO — a single shared queue would mean
// a large admin broadcast mid-flight blocks every real payment SMS behind
// it for however long the broadcast takes to drain (worse than the problem
// this throttle exists to fix). 'normal' (the default — payments, OTP, bulk
// pay) always jumps ahead of 'low' (broadcast) on the next available slot;
// 'low' items only get pulled when nothing urgent is waiting, and a
// broadcast that's mid-drain pauses the instant urgent traffic shows up
// rather than finishing its own backlog first.
// Configurable via SMS_MIN_SEND_GAP_MS so this can be tuned without a code
// change once your Africa's Talking account's real per-account throughput
// is confirmed with them — lowering it without confirming that risks the
// exact MINUTES-long queuing this gate exists to prevent (see comment
// above). Defaults to the confirmed-safe 2000ms if unset/invalid.
const MIN_SEND_GAP_MS = Number(process.env.SMS_MIN_SEND_GAP_MS) > 0
  ? Number(process.env.SMS_MIN_SEND_GAP_MS)
  : 2000;
let lastDispatchAt = 0;
const normalQueue = [];
const lowQueue = [];
let pumping = false;

async function pumpSendQueue() {
  if (pumping) return;
  pumping = true;
  while (normalQueue.length || lowQueue.length) {
    const item = normalQueue.length ? normalQueue.shift() : lowQueue.shift();
    const wait = MIN_SEND_GAP_MS - (Date.now() - lastDispatchAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastDispatchAt = Date.now();
    // sendSMS/dispatchSms never throws (documented contract above) — no
    // try/catch needed to keep one bad send from wedging the pump loop.
    item.resolve(await item.task());
  }
  pumping = false;
}

function enqueueSend(task, priority) {
  return new Promise((resolve) => {
    (priority === 'low' ? lowQueue : normalQueue).push({ task, resolve });
    pumpSendQueue();
  });
}

export const sendSMS = (phoneNumber, message, opts = {}) =>
  enqueueSend(() => dispatchSms(phoneNumber, message), opts.priority);

async function dispatchSms(phoneNumber, message) {
  try {
    const response = await sendAfricasTalkingSms(phoneNumber, message);

    // Africa's Talking resolves (HTTP 201, no exception) even when a
    // message is rejected per-recipient — e.g. InvalidSenderId,
    // UserInBlackList, InsufficientBalance. The SDK call "succeeding"
    // only means AT accepted the API request, not that the SMS was
    // actually queued for delivery, so that has to be checked explicitly.
    const recipient = response?.SMSMessageData?.Recipients?.[0];
    const messageId = recipient?.messageId || null;

    // Durable record of every real send — see models/SmsLog.js for why.
    // Skipped for the console-simulation branch (recipient.status ===
    // 'Simulated', see notificationService.js) since there's no real AT
    // message to trace and no messageId to log against. A DB hiccup here
    // must never affect the actual send result below.
    if (recipient && recipient.status !== 'Simulated') {
      try {
        await SmsLog.create({
          to: formatPhoneDisplay(phoneNumber) || phoneNumber,
          messageId,
          atStatus: recipient.status,
          cost: recipient.cost || null,
          deliveryStatus: recipient.status === 'Success' ? 'queued' : 'rejected',
          failureReason: recipient.status !== 'Success' ? `${recipient.status} (code ${recipient.statusCode})` : null,
        });
      } catch (logErr) {
        console.error('Failed to persist SmsLog:', logErr?.message || logErr);
      }
    }

    if (recipient && recipient.status !== 'Success') {
      console.error(`Failed to send SMS: AT rejected recipient — ${recipient.status} (code ${recipient.statusCode})`);
      return { success: false, error: `${recipient.status} (code ${recipient.statusCode})`, messageId };
    }

    // AT's own docs promise Recipients always has exactly one entry per
    // single-recipient request, but if that ever isn't true (malformed/
    // partial response, an AT-side error shaped differently than the
    // documented rejection format), `recipient` is undefined and this used
    // to fall through to a false-positive "success" below — reporting a
    // send that never actually happened, with nothing in SmsLog to show
    // for it. Treat a missing Recipients entry as a real failure instead.
    if (!recipient) {
      console.error('Failed to send SMS: AT response had no Recipients entry', JSON.stringify(response));
      try {
        await SmsLog.create({
          to: formatPhoneDisplay(phoneNumber) || phoneNumber,
          messageId: null,
          atStatus: null,
          deliveryStatus: 'failed',
          failureReason: 'NO_RECIPIENT_IN_AT_RESPONSE',
        });
      } catch (logErr) {
        console.error('Failed to persist SmsLog:', logErr?.message || logErr);
      }
      return { success: false, error: 'Africa\'s Talking response had no Recipients entry' };
    }

    return { success: true, message: 'SMS sent successfully', messageId };
  } catch (error) {
    const errorMessage = error?.message || 'Unknown SMS delivery error';
    console.error('Failed to send SMS:', errorMessage);
    // A thrown exception here (bad phone, AT SDK/HTTP error, missing
    // config) previously left zero trace in SmsLog — only the two
    // "AT responded, here's what it said" paths above ever wrote a row.
    // That made a thrown failure indistinguishable from "never attempted"
    // when investigating from the database instead of live server logs.
    try {
      await SmsLog.create({
        to: formatPhoneDisplay(phoneNumber) || phoneNumber,
        messageId: null,
        atStatus: null,
        deliveryStatus: 'failed',
        failureReason: `THREW: ${errorMessage}`.slice(0, 500),
      });
    } catch (logErr) {
      console.error('Failed to persist SmsLog:', logErr?.message || logErr);
    }
    return { success: false, error: errorMessage };
  }
}
