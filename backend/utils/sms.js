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
    await sendAfricasTalkingSms(phoneNumber, message);
    return { success: true, message: 'SMS sent successfully' };
  } catch (error) {
    console.error('Failed to send SMS:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown SMS delivery error' };
  }
};
