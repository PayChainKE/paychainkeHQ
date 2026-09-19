import Merchant from '../models/Merchant.js';
import { KYB_DOC_LABELS, KYB_REQUIREMENTS_BY_BUSINESS_TYPE } from '../config/kybRequirements.js';
import { isValidKraPin, normalizeKraPin, KRA_PIN_FORMAT_HINT } from './kraPinValidator.js';

// Automatic first-pass checks on a KYC application, shown to the reviewer at
// the top of the workstation so obvious problems are caught before anyone
// spends time on the documents themselves. Purely advisory — a flag never
// blocks or changes an application, the reviewer still decides. Computed
// fresh on every read (no stored copy that can go stale, no migration).
//
// Returns [{ code, severity: 'critical' | 'warning', message }].
export async function computePrechecks(app) {
  const flags = [];
  const docs = (app.kybDocuments || []).filter((d) => d.status !== 'rejected');
  const has = (type) => {
    if (type === 'national_id') {
      return docs.some((d) => d.type === 'national_id')
        || (docs.some((d) => d.type === 'national_id_front') && docs.some((d) => d.type === 'national_id_back'));
    }
    return docs.some((d) => d.type === type);
  };

  // Missing required documents for this business type.
  const requirement = KYB_REQUIREMENTS_BY_BUSINESS_TYPE[app.businessType];
  if (requirement) {
    const missing = (requirement.required || []).filter((t) => !has(t));
    if (missing.length) {
      flags.push({
        code: 'documents_missing',
        severity: 'warning',
        message: `Missing required document${missing.length === 1 ? '' : 's'}: ${missing.map((t) => KYB_DOC_LABELS[t] || t).join(', ')}.`,
      });
    }
    // A registered entity should also quote its registration number.
    if ((requirement.required || []).includes('business_registration') && !String(app.businessNumber || '').trim()) {
      flags.push({ code: 'business_number_missing', severity: 'warning', message: 'No business registration number was entered.' });
    }
  } else if (!app.businessType) {
    flags.push({ code: 'business_type_missing', severity: 'warning', message: 'No business type was selected.' });
  }

  // National ID: present, and not already on another account.
  if (!app.nationalId) {
    flags.push({ code: 'national_id_missing', severity: 'warning', message: 'No National ID number was entered.' });
  } else {
    const dup = await Merchant.findOne({ nationalId: app.nationalId, _id: { $ne: app._id } }).select('businessName name').lean();
    if (dup) {
      flags.push({
        code: 'national_id_duplicate',
        severity: 'critical',
        message: `This National ID number is already registered to another account (${dup.businessName || dup.name || 'unnamed'}).`,
      });
    }
  }

  // KRA PIN: well-formed, and not shared with another account.
  const pin = normalizeKraPin(app.kraPin);
  if (pin) {
    if (!isValidKraPin(pin)) {
      flags.push({ code: 'kra_pin_invalid', severity: 'warning', message: `KRA PIN "${pin}" is not a valid format. ${KRA_PIN_FORMAT_HINT}` });
    } else {
      const dupPin = await Merchant.findOne({ kraPin: { $regex: `^${pin}$`, $options: 'i' }, _id: { $ne: app._id } }).select('businessName name').lean();
      if (dupPin) {
        flags.push({ code: 'kra_pin_duplicate', severity: 'warning', message: `This KRA PIN is also on another account (${dupPin.businessName || dupPin.name || 'unnamed'}).` });
      }
    }
  }

  return flags;
}
