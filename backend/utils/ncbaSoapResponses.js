// Builds SOAP acknowledgements for NCBA's Account-Level Notification Push
// service, per NCBA's own documented response schema:
//
//   <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
//     <soapenv:Body>
//       <NCBAPaymentNotificationResult>
//         <Result>OK</Result>
//       </NCBAPaymentNotificationResult>
//     </soapenv:Body>
//   </soapenv:Envelope>
//
// NCBA's push service reads the <Result> tag as a raw string: if it
// *contains* "OK" (anywhere in the string, e.g. "OK: Duplicate
// Notification") the notification is considered delivered and is not
// retried; otherwise it's queued for retry. Pass/fail is therefore always
// communicated via this tag, never via HTTP status — the guide expects a
// 200-level response on every call, mirroring how mpesaController.js acks
// Safaricom's webhooks.

function escapeXmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildEnvelope(bodyXml) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
    `<soapenv:Body>${bodyXml}</soapenv:Body>` +
    '</soapenv:Envelope>'
  );
}

function buildResultXml(resultText) {
  return buildEnvelope(
    `<NCBAPaymentNotificationResult><Result>${escapeXmlText(resultText)}</Result></NCBAPaymentNotificationResult>`
  );
}

export function buildNcbaOkResult(detail) {
  return buildResultXml(detail ? `OK: ${detail}` : 'OK');
}

export function buildNcbaFailResult(detail) {
  return buildResultXml(detail ? `FAIL: ${detail}` : 'FAIL');
}
