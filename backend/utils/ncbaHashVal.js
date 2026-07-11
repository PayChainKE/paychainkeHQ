import crypto from 'crypto';

// Replicates NCBA's own HashVal algorithm exactly, per the C# reference
// implementation in NCBA's Account-Level Notification Push Service Guide:
//
//   strHash = secretKey + TransType + TransID + TransTime + TransAmount +
//             AccountNr + Narrative + PhoneNr + CustomerName + Status
//   sha256Hex = lowercase hex string of SHA-256(strHash)   (NOT raw bytes —
//               the guide's sample hashes byte-by-byte into a hex string
//               first: `Sb.Append(b.ToString("x2"))`)
//   HashVal = Base64(UTF-8 bytes of sha256Hex)
//
// Note that User, Password, and FtCrNarration are deliberately excluded —
// NCBA's own worked example only feeds the fields above into the hash, in
// this exact order.
export function computeNcbaHashVal(secretKey, fields) {
  const {
    transType, transId, transTime, transAmount, accountNr, narrative, phoneNr, customerName, status,
  } = fields;

  const concatenated = [
    secretKey, transType, transId, transTime, transAmount, accountNr, narrative, phoneNr, customerName, status,
  ]
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join('');

  const sha256Hex = crypto.createHash('sha256').update(concatenated, 'utf8').digest('hex');
  return Buffer.from(sha256Hex, 'utf8').toString('base64');
}

/**
 * Constant-time comparison of a received HashVal against the value we
 * independently compute — protects against a forged notification even if
 * User/Password were somehow guessed or leaked.
 */
export function verifyNcbaHashVal(receivedHashVal, secretKey, fields) {
  const expected = computeNcbaHashVal(secretKey, fields);
  const a = Buffer.from(String(receivedHashVal ?? ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
