import { XMLParser, XMLValidator } from 'fast-xml-parser';

// Hard ceiling on inbound webhook bodies. A single SOAP notification is a
// handful of scalar fields — a legitimate payload is a few hundred bytes to
// a few KB. Anything past this is either misconfigured or hostile.
const MAX_PAYLOAD_BYTES = 64 * 1024;

// Belt-and-braces XXE guard. fast-xml-parser has no DTD/external-entity
// resolver at all (it cannot fetch a file:// or http:// URI while parsing),
// so XXE is not structurally reachable through it — but we still refuse any
// payload that *declares* a DOCTYPE or ENTITY outright. A real NCBA push
// never needs either, so this can only reject attacks, never a legitimate
// bank payload.
const DOCTYPE_OR_ENTITY = /<!\s*(DOCTYPE|ENTITY)\b/i;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Collapses `soapenv:Envelope`, `ns1:TxnAmt`, etc. down to `Envelope`,
  // `TxnAmt` — NCBA's SOAP namespace prefixes vary by environment/version,
  // and we only ever care about the local tag name.
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export class XmlSecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'XmlSecurityError';
  }
}

/**
 * Safely parse an inbound SOAP/XML payload into a plain object tree.
 * Throws XmlSecurityError for anything oversized, malformed, or carrying a
 * DOCTYPE/ENTITY declaration. Never resolves external entities or DTDs.
 */
export function parseSoapXmlSafely(rawXml) {
  if (typeof rawXml !== 'string' || rawXml.trim().length === 0) {
    throw new XmlSecurityError('Empty or non-string XML payload');
  }
  if (Buffer.byteLength(rawXml, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new XmlSecurityError('XML payload exceeds maximum allowed size');
  }
  if (DOCTYPE_OR_ENTITY.test(rawXml)) {
    throw new XmlSecurityError('DOCTYPE/ENTITY declarations are not permitted');
  }

  const validation = XMLValidator.validate(rawXml, { allowBooleanAttributes: true });
  if (validation !== true) {
    throw new XmlSecurityError(`Malformed XML: ${validation.err?.msg || 'parse error'}`);
  }

  return parser.parse(rawXml);
}

/**
 * Depth-first search for the first tag named `key` anywhere in a parsed XML
 * object tree, returning its text/value. SOAP envelopes nest the fields we
 * care about at a Body-dependent depth, so we search rather than hard-code
 * a path.
 */
export function findFirstTagValue(node, key) {
  if (node === null || typeof node !== 'object') return undefined;

  if (Object.prototype.hasOwnProperty.call(node, key)) {
    const value = node[key];
    return typeof value === 'object' ? findFirstTagValue(value, key) ?? value : value;
  }

  for (const child of Object.values(node)) {
    if (child && typeof child === 'object') {
      const found = findFirstTagValue(child, key);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}
