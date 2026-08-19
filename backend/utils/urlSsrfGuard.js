import dns from 'dns';
import net from 'net';

// Blocks a developer-registered webhook URL (or any other merchant/user-
// supplied outbound URL) from pointing at PayChain's own internal network —
// loopback, RFC1918 private ranges, link-local (which includes the
// 169.254.169.254 cloud metadata endpoint on AWS/GCP/Azure), and other
// non-public ranges. Without this, registering a webhook whose hostname
// resolves to an internal address turns every signed webhook delivery into
// an SSRF probe of PayChain's own backend network, launched from the
// backend itself.
//
// Checks both hostname *shape* (rejects raw loopback/private literals
// outright, cheaply) and the DNS-resolved IP (catches a public-looking
// hostname that actually resolves to a private address, and rebinding
// attempts, since resolution happens fresh on every call rather than being
// cached from registration time).

const IPV4_PRIVATE_RANGES = [
  { base: '0.0.0.0', bits: 8 },
  { base: '10.0.0.0', bits: 8 },
  { base: '100.64.0.0', bits: 10 }, // carrier-grade NAT
  { base: '127.0.0.0', bits: 8 },
  { base: '169.254.0.0', bits: 16 }, // link-local — includes cloud metadata (169.254.169.254)
  { base: '172.16.0.0', bits: 12 },
  { base: '192.0.0.0', bits: 24 },
  { base: '192.168.0.0', bits: 16 },
  { base: '198.18.0.0', bits: 15 },
  { base: '224.0.0.0', bits: 4 }, // multicast
  { base: '240.0.0.0', bits: 4 }, // reserved
];

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIpv4(ip) {
  const target = ipv4ToInt(ip);
  return IPV4_PRIVATE_RANGES.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' || // loopback
    normalized === '::' ||
    normalized.startsWith('::ffff:') && isPrivateIpv4(normalized.slice(7)) || // IPv4-mapped
    /^fe[89ab][0-9a-f]:/.test(normalized) || // link-local fe80::/10
    /^f[cd][0-9a-f]{2}:/.test(normalized) // unique local fc00::/7
  );
}

export function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // unrecognized shape — fail closed
}

// Throws with a user-facing message on any disallowed URL. Callers should
// treat a throw as a 400 validation error, not a 500 — this is meant to run
// at the point a merchant/developer submits a URL for PayChain to fetch.
export async function assertPublicHttpsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('A valid https:// url is required.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('A valid https:// url is required.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'metadata.google.internal') {
    throw new Error('This URL cannot be used — it points at a local or internal address.');
  }

  // A bare IP literal in the URL — check directly, no DNS lookup needed.
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('This URL cannot be used — it points at a local or internal address.');
    }
    return;
  }

  let addresses;
  try {
    addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve this URL\'s hostname.');
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateOrReservedIp(a.address))) {
    throw new Error('This URL cannot be used — it points at a local or internal address.');
  }
}
