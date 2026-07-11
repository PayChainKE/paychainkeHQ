import crypto from 'crypto';

// Constant-time string compare — a plain `===` leaks how many leading bytes
// matched via response timing, which is a real attack surface on any
// credential check reachable from the public internet. Both buffers must be
// equal length for timingSafeEqual to run at all, so unequal lengths are
// handled (and still compared against *something* of the right length) so
// that a wrong-length guess doesn't short-circuit faster than a right-length
// wrong guess.
export function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a ?? ''));
  const bBuf = Buffer.from(String(b ?? ''));
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, Buffer.alloc(aBuf.length));
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
