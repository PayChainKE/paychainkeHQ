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

export const sendSMS = async (phoneNumber, message) => {
  try {
    const response = await sendAfricasTalkingSms(phoneNumber, message);

    // Africa's Talking resolves (HTTP 201, no exception) even when a
    // message is rejected per-recipient — e.g. InvalidSenderId,
    // UserInBlackList, InsufficientBalance. The SDK call "succeeding"
    // only means AT accepted the API request, not that the SMS was
    // actually queued for delivery, so that has to be checked explicitly.
    const recipient = response?.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.status !== 'Success') {
      console.error(`Failed to send SMS: AT rejected recipient — ${recipient.status} (code ${recipient.statusCode})`);
      return { success: false, error: `${recipient.status} (code ${recipient.statusCode})` };
    }

    return { success: true, message: 'SMS sent successfully' };
  } catch (error) {
    console.error('Failed to send SMS:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown SMS delivery error' };
  }
};
