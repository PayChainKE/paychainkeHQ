// Kenyan-specific input formatters & validators.
// Formatters run on every keystroke to STRIP illegal characters and enforce max length.
// Validators run on blur/submit to verify the final value matches the expected format.

export type ValidationResult = { valid: boolean; error?: string };

export type FieldKind =
  | 'phoneKE'
  | 'kraPin'
  | 'nationalId'
  | 'paybill'
  | 'till'
  | 'bankAccount'
  | 'amount'
  | 'integer'
  | 'personName'
  | 'businessName'
  | 'email'
  | 'nssf'
  | 'shif'
  | 'etims'
  | 'cuNumber'
  | 'businessReg'
  | 'pin4'
  | 'pin6'
  | 'otp6'
  | 'text';

// ─── Formatters ──────────────────────────────────────────────────────────────
// Each takes raw input and returns the cleaned value to store in state.
export const formatters: Record<FieldKind, (raw: string) => string> = {
  // Kenyan mobile: digits only, max 10 (e.g. 0712345678) or 12 with country code (254712345678).
  phoneKE: (raw) => raw.replace(/\D/g, '').slice(0, 12),
  // KRA PIN: A123456789Z — letter + 9 digits + letter, 11 chars, uppercase.
  kraPin: (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
  // National ID: 7-8 digits.
  nationalId: (raw) => raw.replace(/\D/g, '').slice(0, 8),
  // M-Pesa Paybill: 5-7 digits.
  paybill: (raw) => raw.replace(/\D/g, '').slice(0, 7),
  // Till / Buy Goods: 5-7 digits.
  till: (raw) => raw.replace(/\D/g, '').slice(0, 7),
  // Bank account: digits, 8-16 length.
  bankAccount: (raw) => raw.replace(/\D/g, '').slice(0, 16),
  // Money: digits + single decimal, max 12 chars before strip.
  amount: (raw) => {
    const clean = raw.replace(/[^\d.]/g, '');
    const parts = clean.split('.');
    return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
  },
  // Plain integer.
  integer: (raw) => raw.replace(/\D/g, ''),
  // Person name: letters, spaces, hyphens, apostrophes, dots (initials).
  personName: (raw) => raw.replace(/[^A-Za-z\s'.\-]/g, '').slice(0, 60),
  // Business name: alphanumeric + business punctuation.
  businessName: (raw) => raw.replace(/[^\w\s&.,'()\-]/g, '').slice(0, 80),
  // Email: strip whitespace, lowercase, cap at 100.
  email: (raw) => raw.toLowerCase().replace(/\s/g, '').slice(0, 100),
  // NSSF: alphanumeric (some have letter prefix), uppercase.
  nssf: (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
  // SHIF (formerly NHIF): digits, up to 12.
  shif: (raw) => raw.replace(/\D/g, '').slice(0, 12),
  // KRA eTIMS invoice number: alphanumeric, uppercase.
  etims: (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
  // KRA Control Unit number: alphanumeric, uppercase.
  cuNumber: (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
  // Business registration: alphanumeric with dashes/slashes (e.g. CPR/2020/123456).
  businessReg: (raw) => raw.toUpperCase().replace(/[^A-Z0-9/\-]/g, '').slice(0, 30),
  // 4-digit PIN.
  pin4: (raw) => raw.replace(/\D/g, '').slice(0, 4),
  // 6-digit PIN.
  pin6: (raw) => raw.replace(/\D/g, '').slice(0, 6),
  // 6-digit OTP.
  otp6: (raw) => raw.replace(/\D/g, '').slice(0, 6),
  // Generic free text.
  text: (raw) => raw.slice(0, 200),
};

// Mirrors backend/utils/kraPinValidator.js exactly — same shape check (one
// leading A/P, 9 digits, one trailing letter) plus the same
// obviously-fake-pattern rejection (all nine digits identical, or a
// strictly ascending/descending run like 123456789). Keep both in sync if
// either changes: this only saves a merchant a round trip to the server,
// the backend validator is still the actual source of truth.
const KRA_PIN_SHAPE_REGEX = /^([AP])(\d{9})([A-Z])$/i;

const isPlausibleKraPinDigits = (digits: string): boolean => {
  const d = digits.split('').map(Number);
  if (d.every((n) => n === d[0])) return false;
  let ascending = true, descending = true;
  for (let i = 1; i < d.length; i++) {
    if (d[i] !== d[i - 1] + 1) ascending = false;
    if (d[i] !== d[i - 1] - 1) descending = false;
  }
  return !ascending && !descending;
};

export const isValidKraPin = (raw: string): boolean => {
  const match = KRA_PIN_SHAPE_REGEX.exec(String(raw ?? ''));
  if (!match) return false;
  return isPlausibleKraPinDigits(match[2]);
};

// ─── Validators ──────────────────────────────────────────────────────────────
const VALID: ValidationResult = { valid: true };

export const validators: Record<FieldKind, (v: string) => ValidationResult> = {
  phoneKE: (v) => {
    if (!v) return { valid: false, error: 'Phone number is required.' };
    const clean = v.replace(/\D/g, '');
    if (!/^(?:254)?(7\d{8}|1\d{8})$/.test(clean) && !/^0?(7\d{8}|1\d{8})$/.test(clean)) {
      return { valid: false, error: 'Enter a valid Kenyan number (e.g. 0712345678).' };
    }
    return VALID;
  },
  kraPin: (v) => {
    if (!v) return { valid: false, error: 'KRA PIN is required.' };
    if (!isValidKraPin(v)) return { valid: false, error: 'Enter a real KRA PIN — format A/P + 9 digits + a letter, e.g. P051892647A.' };
    return VALID;
  },
  nationalId: (v) => {
    if (!v) return { valid: false, error: 'National ID is required.' };
    if (!/^\d{7,8}$/.test(v)) return { valid: false, error: 'ID must be 7 or 8 digits.' };
    return VALID;
  },
  paybill: (v) => {
    if (!v) return { valid: false, error: 'Paybill is required.' };
    if (!/^\d{5,7}$/.test(v)) return { valid: false, error: 'Paybill must be 5-7 digits.' };
    return VALID;
  },
  till: (v) => {
    if (!v) return { valid: false, error: 'Till number is required.' };
    if (!/^\d{5,7}$/.test(v)) return { valid: false, error: 'Till must be 5-7 digits.' };
    return VALID;
  },
  bankAccount: (v) => {
    if (!v) return { valid: false, error: 'Account number is required.' };
    if (!/^\d{8,16}$/.test(v)) return { valid: false, error: 'Account must be 8-16 digits.' };
    return VALID;
  },
  amount: (v) => {
    if (!v) return { valid: false, error: 'Amount is required.' };
    const n = parseFloat(v);
    if (Number.isNaN(n) || n <= 0) return { valid: false, error: 'Enter an amount greater than 0.' };
    return VALID;
  },
  integer: (v) => {
    if (!v) return { valid: false, error: 'Value is required.' };
    if (!/^\d+$/.test(v)) return { valid: false, error: 'Must be a whole number.' };
    return VALID;
  },
  personName: (v) => {
    if (!v) return { valid: false, error: 'Name is required.' };
    if (v.trim().length < 2) return { valid: false, error: 'Name must be at least 2 characters.' };
    if (!/^[A-Za-z][A-Za-z\s'.\-]*$/.test(v.trim())) return { valid: false, error: 'Letters, spaces, hyphens only.' };
    return VALID;
  },
  businessName: (v) => {
    if (!v) return { valid: false, error: 'Business name is required.' };
    if (v.trim().length < 2) return { valid: false, error: 'Name must be at least 2 characters.' };
    return VALID;
  },
  email: (v) => {
    if (!v) return { valid: false, error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { valid: false, error: 'Enter a valid email address.' };
    return VALID;
  },
  nssf: (v) => {
    if (!v) return VALID; // optional in most flows
    if (!/^[A-Z0-9]{6,12}$/.test(v)) return { valid: false, error: 'NSSF must be 6-12 alphanumeric characters.' };
    return VALID;
  },
  shif: (v) => {
    if (!v) return VALID;
    if (!/^\d{6,12}$/.test(v)) return { valid: false, error: 'SHIF must be 6-12 digits.' };
    return VALID;
  },
  etims: (v) => {
    if (!v) return VALID;
    if (!/^[A-Z0-9]{6,20}$/.test(v)) return { valid: false, error: 'Invalid eTIMS reference.' };
    return VALID;
  },
  cuNumber: (v) => {
    if (!v) return VALID;
    if (!/^[A-Z0-9]{6,20}$/.test(v)) return { valid: false, error: 'Invalid Control Unit number.' };
    return VALID;
  },
  businessReg: (v) => {
    if (!v) return VALID;
    if (!/^[A-Z0-9/\-]{4,30}$/.test(v)) return { valid: false, error: 'Invalid registration number.' };
    return VALID;
  },
  pin4: (v) => {
    if (!v) return { valid: false, error: 'PIN required.' };
    if (!/^\d{4}$/.test(v)) return { valid: false, error: 'PIN must be 4 digits.' };
    return VALID;
  },
  pin6: (v) => {
    if (!v) return { valid: false, error: 'PIN required.' };
    if (!/^\d{6}$/.test(v)) return { valid: false, error: 'PIN must be 6 digits.' };
    return VALID;
  },
  otp6: (v) => {
    if (!v) return { valid: false, error: 'Code required.' };
    if (!/^\d{6}$/.test(v)) return { valid: false, error: 'Code must be 6 digits.' };
    return VALID;
  },
  text: (v) => (v ? VALID : { valid: false, error: 'Required.' }),
};

// ─── Convenience: keyboard + capitalization hints per field ──────────────────
export const inputHints: Record<
  FieldKind,
  { keyboardType: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'decimal-pad'; autoCapitalize: 'none' | 'sentences' | 'words' | 'characters' }
> = {
  phoneKE:      { keyboardType: 'phone-pad',     autoCapitalize: 'none' },
  kraPin:       { keyboardType: 'default',       autoCapitalize: 'characters' },
  nationalId:   { keyboardType: 'numeric',       autoCapitalize: 'none' },
  paybill:      { keyboardType: 'numeric',       autoCapitalize: 'none' },
  till:         { keyboardType: 'numeric',       autoCapitalize: 'none' },
  bankAccount:  { keyboardType: 'numeric',       autoCapitalize: 'none' },
  amount:       { keyboardType: 'decimal-pad',   autoCapitalize: 'none' },
  integer:      { keyboardType: 'numeric',       autoCapitalize: 'none' },
  personName:   { keyboardType: 'default',       autoCapitalize: 'words' },
  businessName: { keyboardType: 'default',       autoCapitalize: 'words' },
  email:        { keyboardType: 'email-address', autoCapitalize: 'none' },
  nssf:         { keyboardType: 'default',       autoCapitalize: 'characters' },
  shif:         { keyboardType: 'numeric',       autoCapitalize: 'none' },
  etims:        { keyboardType: 'default',       autoCapitalize: 'characters' },
  cuNumber:     { keyboardType: 'default',       autoCapitalize: 'characters' },
  businessReg:  { keyboardType: 'default',       autoCapitalize: 'characters' },
  pin4:         { keyboardType: 'numeric',       autoCapitalize: 'none' },
  pin6:         { keyboardType: 'numeric',       autoCapitalize: 'none' },
  otp6:         { keyboardType: 'numeric',       autoCapitalize: 'none' },
  text:         { keyboardType: 'default',       autoCapitalize: 'sentences' },
};
