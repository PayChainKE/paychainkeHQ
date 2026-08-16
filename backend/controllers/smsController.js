import SmsLog from '../models/SmsLog.js';

// Africa's Talking's SMS Delivery Report webhook — POSTs
// application/x-www-form-urlencoded with (at minimum) `id` (the messageId
// from the original send response) and `status` (their SMSC's final
// delivery status: Success, Failed, Rejected, Buffered, etc.), plus an
// optional `failureReason`. This is NOT sent automatically — it only
// arrives once this URL is configured as the "Delivery Reports Callback
// URL" in Africa's Talking's dashboard (Settings → SMS), a one-time manual
// step outside this codebase. Until that's configured, SmsLog rows just
// stay at 'queued' forever, same as today.
//
// @route   POST /api/callbacks/sms/delivery-report
// @access  Public (webhook)
export const smsDeliveryReport = async (req, res) => {
  // Acknowledge immediately — AT expects a fast response and retries on
  // anything else, same convention as every other webhook in this app.
  res.status(200).send('OK');

  try {
    const { id, status, failureReason } = req.body || {};
    if (!id) {
      // Logs only the known/expected fields, not the raw body — a webhook
      // payload shape can change or carry unexpected fields, and this
      // shouldn't become a place that echoes whatever an inbound POST sent.
      console.warn(JSON.stringify({ level: 'warn', event: 'sms_delivery_report_missing_id', status, failureReason }));
      return;
    }

    const normalizedStatus = String(status || '').toLowerCase();
    const deliveryStatus = normalizedStatus === 'success'
      ? 'delivered'
      : ['failed', 'rejected', 'expired'].includes(normalizedStatus)
      ? 'failed'
      : 'queued'; // Buffered/Sent/anything else — still in flight

    const update = {
      atStatus: status || null,
      deliveryStatus,
      failureReason: failureReason || (deliveryStatus === 'failed' ? status : null),
    };
    if (deliveryStatus === 'delivered') update.deliveredAt = new Date();

    const result = await SmsLog.updateOne({ messageId: id }, { $set: update });
    if (result.matchedCount === 0) {
      console.warn(JSON.stringify({ level: 'warn', event: 'sms_delivery_report_unknown_message_id', messageId: id, status }));
    } else {
      console.log(JSON.stringify({ level: 'info', event: 'sms_delivery_report_received', messageId: id, status, deliveryStatus }));
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sms_delivery_report_error', error: error.message }));
  }
};
