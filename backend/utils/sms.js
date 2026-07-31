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

export const sendSMS = async (phoneNumber, message) => {
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

    return { success: true, message: 'SMS sent successfully', messageId };
  } catch (error) {
    console.error('Failed to send SMS:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown SMS delivery error' };
  }
};
