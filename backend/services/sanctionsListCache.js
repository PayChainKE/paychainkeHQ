import axios from 'axios';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { XMLParser } from 'fast-xml-parser';
import Merchant from '../models/Merchant.js';
import SanctionsListEntry from '../models/SanctionsListEntry.js';
import { logAudit } from '../utils/auditLog.js';
import { notifyAdmins, escapeHtml } from '../utils/securityAlerts.js';

// Free, no-auth, publicly-published sanctions feeds — chosen specifically
// because they require no vendor account, no API key, and no cost (see the
// fraud-prevention plan this implements: PEP data has no free source and is
// deliberately out of scope until a paid provider is chosen). EU
// Consolidated was left out for the same reason — its public feed requires
// a registered subscription key, which would mean guessing at
// authentication details rather than a genuinely no-auth download.
const OFAC_SDN_CSV_URL = 'https://www.treasury.gov/ofac/downloads/sdn.csv';
const UN_CONSOLIDATED_XML_URL = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml';

// A name shorter than this after normalization is too generic to screen
// meaningfully (a single common first name would match dozens of entries by
// chance) — skip it rather than manufacture noise.
const MIN_NAME_LENGTH = 6;

// Deliberately high — this is a "flag for human review", not an
// auto-block, but a low bar here would bury real hits under false
// positives on common names and train admins to ignore the alert.
// Configurable in case real-world results show it needs tuning.
const MATCH_THRESHOLD = Number(process.env.SANCTIONS_MATCH_THRESHOLD) || 0.92;

// In-memory copy of everything in SanctionsListEntry, refreshed alongside
// the Mongo collection (same "cache backed by a DB collection" shape as
// services/tariffCardCache.js) — screening every signup against a live DB
// query would be needless per-request latency for data that only changes
// once a day.
let cache = [];

function normalizeName(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents/diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sorting the words before comparing makes the match order-insensitive —
// sanctions lists commonly store "LAST, FIRST" while a signup form captures
// "First Last"; a plain string distance would score that pair as very
// dissimilar despite being the same name.
function tokenSortKey(raw) {
  return normalizeName(raw).split(' ').filter(Boolean).sort().join(' ');
}

// Standard Jaro similarity (0-1).
function jaroSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

// Jaro-Winkler — boosts the Jaro score for names sharing a common prefix,
// which real near-duplicate names (typos, transliteration variants) do far
// more often than coincidental matches.
function jaroWinklerSimilarity(s1, s2) {
  const jaro = jaroSimilarity(s1, s2);
  const maxPrefix = 4;
  let prefixLen = 0;
  for (let i = 0; i < Math.min(maxPrefix, s1.length, s2.length); i++) {
    if (s1[i] !== s2[i]) break;
    prefixLen++;
  }
  return jaro + prefixLen * 0.1 * (1 - jaro);
}

function nameSimilarity(a, b) {
  return jaroWinklerSimilarity(tokenSortKey(a), tokenSortKey(b));
}

// OFAC's SDN.CSV ships with no header row — this is the stable, long-
// standing 12-column layout (ent_num, SDN_Name, SDN_Type, Program, Title,
// Call_Sign, Vess_type, Tonnage, GRT, Vess_flag, Vess_owner, Remarks).
// Alias names live in a separate companion file (SDN_ALT.CSV) that isn't
// fetched here — primary-name screening only for this pass; adding aliases
// later just means joining that second file on ent_num.
async function fetchOfacEntries() {
  const { data } = await axios.get(OFAC_SDN_CSV_URL, { responseType: 'stream', timeout: 30_000 });
  const entries = [];
  await new Promise((resolve, reject) => {
    data
      .pipe(csvParser({
        headers: ['ent_num', 'sdnName', 'sdnType', 'program', 'title', 'callSign', 'vessType', 'tonnage', 'grt', 'vessFlag', 'vessOwner', 'remarks'],
      }))
      .on('data', (row) => {
        if (!row.sdnName) return;
        entries.push({
          source: 'OFAC',
          sourceRef: String(row.ent_num || row.sdnName),
          primaryName: row.sdnName.trim(),
          akaNames: [],
          entryType: (row.sdnType || '').trim().toLowerCase() === 'individual' ? 'individual' : 'entity',
          // OFAC's own placeholder for "not applicable" in this dataset —
          // store it as null rather than the literal string.
          program: (row.program || '').trim() === '-0-' ? null : (row.program || '').trim() || null,
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });
  return entries;
}

// Defensive against the exact UN schema drifting between publications —
// fast-xml-parser collapses a single child into an object instead of a
// one-item array, so every list access below goes through this helper
// rather than assuming an array.
function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractUnAliases(node, aliasTag) {
  return toArray(node?.[aliasTag]).map((a) => (typeof a === 'string' ? a : a?.ALIAS_NAME)).filter(Boolean);
}

async function fetchUnEntries() {
  const { data } = await axios.get(UN_CONSOLIDATED_XML_URL, { responseType: 'text', timeout: 30_000 });
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  const parsed = parser.parse(data);
  const root = parsed?.CONSOLIDATED_LIST;
  if (!root) {
    console.warn('sanctionsListCache: UN feed parsed but had no CONSOLIDATED_LIST root — schema may have changed.');
    return [];
  }

  const entries = [];
  for (const individual of toArray(root.INDIVIDUALS?.INDIVIDUAL)) {
    const nameParts = [individual.FIRST_NAME, individual.SECOND_NAME, individual.THIRD_NAME, individual.FOURTH_NAME].filter(Boolean);
    const primaryName = nameParts.join(' ').trim();
    if (!primaryName) continue;
    entries.push({
      source: 'UN',
      sourceRef: String(individual.DATAID || primaryName),
      primaryName,
      akaNames: extractUnAliases(individual, 'INDIVIDUAL_ALIAS'),
      entryType: 'individual',
      program: individual.UN_LIST_TYPE || null,
    });
  }
  for (const entity of toArray(root.ENTITIES?.ENTITY)) {
    const primaryName = String(entity.FIRST_NAME || '').trim();
    if (!primaryName) continue;
    entries.push({
      source: 'UN',
      sourceRef: String(entity.DATAID || primaryName),
      primaryName,
      akaNames: extractUnAliases(entity, 'ENTITY_ALIAS'),
      entryType: 'entity',
      program: entity.UN_LIST_TYPE || null,
    });
  }

  if (entries.length === 0) {
    console.warn('sanctionsListCache: UN feed returned 0 usable entries — check UN_CONSOLIDATED_XML_URL / tag names are still current.');
  }
  return entries;
}

// Downloads both feeds, upserts every entry into Mongo, and reloads the
// in-memory cache from what's now in the DB. Each source is fetched/upserted
// independently — one feed being unreachable or having changed shape must
// not stop the other from refreshing.
export async function loadSanctionsList() {
  const results = await Promise.allSettled([fetchOfacEntries(), fetchUnEntries()]);
  const [ofacResult, unResult] = results;

  for (const [label, result] of [['OFAC', ofacResult], ['UN', unResult]]) {
    if (result.status === 'rejected') {
      console.error(`sanctionsListCache: failed to fetch ${label} feed:`, result.reason?.message || result.reason);
      continue;
    }
    const entries = result.value;
    if (entries.length === 0) continue;
    const ops = entries.map((e) => ({
      updateOne: {
        filter: { source: e.source, sourceRef: e.sourceRef },
        update: { $set: { ...e, updatedAt: new Date() } },
        upsert: true,
      },
    }));
    try {
      await SanctionsListEntry.bulkWrite(ops, { ordered: false });
    } catch (err) {
      console.error(`sanctionsListCache: bulkWrite failed for ${label}:`, err?.message || err);
    }
  }

  cache = await SanctionsListEntry.find({}).lean();
  console.log(`sanctionsListCache: loaded ${cache.length} sanctions list entries (OFAC + UN).`);

  // A name added to a watchlist after a merchant already signed up must
  // still get caught — not just a one-time check at signup — so every
  // refresh also re-screens the whole merchant base against what's now
  // loaded. Cheap at current pilot scale; would need batching/indexing if
  // the merchant base grows into the tens of thousands.
  await rescreenAllMerchants().catch((err) => {
    console.error('sanctionsListCache: rescreenAllMerchants failed:', err?.message || err);
  });
}

export function startSanctionsListRefreshInterval() {
  setInterval(() => {
    loadSanctionsList().catch((err) => console.error('Sanctions list refresh failed:', err));
  }, 24 * 60 * 60 * 1000); // daily — these lists don't change fast enough to need more
}

// Returns the single best match above MATCH_THRESHOLD across primary names
// and aliases for every cached entry, or null. Pure/synchronous — reads
// only the in-memory cache, safe to call inline during a request.
export function screenNameForSanctions(rawName) {
  const normalized = normalizeName(rawName);
  if (normalized.length < MIN_NAME_LENGTH) return null;

  let best = null;
  for (const entry of cache) {
    const candidates = [entry.primaryName, ...(entry.akaNames || [])];
    for (const candidate of candidates) {
      const score = nameSimilarity(rawName, candidate);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { source: entry.source, matchedName: entry.primaryName, matchedAlias: candidate !== entry.primaryName ? candidate : null, score };
      }
    }
  }
  return best;
}

// Screens both the registrant's personal name and the business name, flags
// the merchant on a hit, and tells admins. Shared by registerMerchant (at
// signup) and rescreenAllMerchants (the daily catch-up sweep) so a hit
// surfaces identically either way. Only acts if the merchant isn't already
// flagged for anything — once an admin has reviewed and cleared a flag,
// the daily sweep won't keep re-raising the same standing match, avoiding
// notification spam; a genuinely new/different match on an already-flagged
// account would currently be silent, an acceptable tradeoff given `flagged`
// is a single boolean, not a list of reasons.
export async function screenMerchantForSanctions(merchant) {
  if (merchant.flagged) return null;

  const match = screenNameForSanctions(merchant.name) || screenNameForSanctions(merchant.businessName);
  if (!match) return null;

  const label = match.matchedAlias ? `${match.matchedName} (aka ${match.matchedAlias})` : match.matchedName;
  const flagReason = `Possible sanctions/watchlist name match ("${label}", ${match.source} list, ${(match.score * 100).toFixed(0)}% similarity) — pending manual review.`;

  await Merchant.updateOne(
    { _id: merchant._id },
    { $set: { flagged: true, flagReason, flaggedAt: new Date(), flaggedBy: null } }
  );

  logAudit({
    action: 'merchant.sanctions_screening_hit',
    category: 'security',
    severity: 'critical',
    message: flagReason,
    merchant,
    actor: { type: 'system', id: null, email: null, name: 'system' },
    metadata: { source: match.source, score: match.score },
  });

  notifyAdmins({
    type: 'sanctions_watchlist_match',
    severity: 'critical',
    subject: `Sanctions watchlist match: ${merchant.businessName || merchant.email}`,
    heading: 'Possible Sanctions/Watchlist Name Match',
    details: `<strong>${escapeHtml(merchant.businessName || merchant.name || merchant.email)}</strong> was flagged for manual review after a name-matching hit against the ${escapeHtml(match.source)} public sanctions list (${escapeHtml(label)}, ${(match.score * 100).toFixed(0)}% similarity). This is an automated fuzzy-name match, not a confirmed identity — review before taking any action on the account.`,
    metadata: { merchantId: String(merchant._id), source: match.source, score: match.score },
  });

  return match;
}

async function rescreenAllMerchants() {
  const merchants = await Merchant.find({ flagged: { $ne: true } }).select('_id name businessName email flagged').lean();
  for (const merchant of merchants) {
    await screenMerchantForSanctions(merchant).catch((err) => {
      console.error(`sanctionsListCache: rescreen failed for merchant ${merchant._id}:`, err?.message || err);
    });
  }
}
