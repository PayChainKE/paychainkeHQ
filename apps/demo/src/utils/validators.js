// Kenyan-specific input formatters & validators (shared shape with mobile app).
// Formatters run on every keystroke to STRIP illegal characters and enforce max length.
// Validators run on blur/submit to verify the final value matches the expected format.

const VALID = { valid: true };

export const normalizePhoneKE = (raw) => {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

export const isValidPhoneKE = (raw) => /^(?:7\d{8}|1\d{8})$/.test(normalizePhoneKE(raw));

export const formatters = {
  phoneKE: (raw) => {
    let d = raw.replace(/\D/g, '');
    // Normalize +254 0xxx (double-prefix) → 0xxx so the validator accepts it
    if (d.startsWith('2540')) d = '0' + d.slice(4);
    return d.slice(0, 12);
  },
  kraPin:       (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
  nationalId:   (raw) => raw.replace(/\D/g, '').slice(0, 8),
  paybill:      (raw) => raw.replace(/\D/g, '').slice(0, 7),
  till:         (raw) => raw.replace(/\D/g, '').slice(0, 7),
  bankAccount:  (raw) => raw.replace(/\D/g, '').slice(0, 16),
  amount: (raw) => {
    const clean = raw.replace(/[^\d.]/g, '');
    const parts = clean.split('.');
    return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
  },
  integer:      (raw) => raw.replace(/\D/g, ''),
  personName:   (raw) => raw.replace(/[^A-Za-z\s'.\-]/g, '').slice(0, 60),
  businessName: (raw) => raw.replace(/[^\w\s&.,'()\-]/g, '').slice(0, 80),
  email:        (raw) => raw.toLowerCase().replace(/\s/g, '').slice(0, 100),
  nssf:         (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
  shif:         (raw) => raw.replace(/\D/g, '').slice(0, 12),
  etims:        (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
  cuNumber:     (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
  businessReg:  (raw) => raw.toUpperCase().replace(/[^A-Z0-9/\-]/g, '').slice(0, 30),
  pin4:         (raw) => raw.replace(/\D/g, '').slice(0, 4),
  pin6:         (raw) => raw.replace(/\D/g, '').slice(0, 6),
  otp6:         (raw) => raw.replace(/\D/g, '').slice(0, 6),
  text:         (raw) => raw.slice(0, 200),
  // Card number: digits, max 19 (covers Amex 15 + Visa/MC 16).
  cardNumber:   (raw) => raw.replace(/\D/g, '').slice(0, 19),
  // Card expiry: MM/YY, auto-insert slash after 2 digits.
  cardExpiry: (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  },
  // Card CVV: 3-4 digits.
  cardCvv:      (raw) => raw.replace(/\D/g, '').slice(0, 4),
};

export const validators = {
  phoneKE: (v) => {
    if (!v) return { valid: false, error: 'Phone number is required.' };
    if (!isValidPhoneKE(v)) {
      return { valid: false, error: 'Enter a valid Kenyan number (e.g. 0712345678, 0112345678, +254712345678).' };
    }
    return VALID;
  },
  kraPin: (v) => {
    if (!v) return { valid: false, error: 'KRA PIN is required.' };
    if (!/^[A-Z]\d{9}[A-Z]$/.test(v)) return { valid: false, error: 'Format must be A123456789Z.' };
    return VALID;
  },
  nationalId: (v) => {
    if (!v) return { valid: false, error: 'National ID is required.' };
    if (!/^\d{7,9}$/.test(v)) return { valid: false, error: 'ID must be 7 to 9 digits.' };
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
    if (!v) return VALID;
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
  cardNumber: (v) => {
    if (!v) return { valid: false, error: 'Card number required.' };
    const digits = v.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return { valid: false, error: 'Card number must be 13-19 digits.' };
    // Luhn checksum.
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    if (sum % 10 !== 0) return { valid: false, error: 'Card number is invalid.' };
    return VALID;
  },
  cardExpiry: (v) => {
    if (!v) return { valid: false, error: 'Expiry required.' };
    const m = v.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return { valid: false, error: 'Format: MM/YY.' };
    const month = parseInt(m[1], 10);
    if (month < 1 || month > 12) return { valid: false, error: 'Month must be 01-12.' };
    const year = 2000 + parseInt(m[2], 10);
    const now = new Date();
    const exp = new Date(year, month, 0, 23, 59, 59);
    if (exp < now) return { valid: false, error: 'Card has expired.' };
    return VALID;
  },
  cardCvv: (v) => {
    if (!v) return { valid: false, error: 'CVV required.' };
    if (!/^\d{3,4}$/.test(v)) return { valid: false, error: 'CVV must be 3 or 4 digits.' };
    return VALID;
  },
};

// Browser <input> attribute hints per field kind.
export const inputAttrs = {
  phoneKE:      { type: 'tel',    inputMode: 'tel',     autoComplete: 'tel-national', autoCapitalize: 'off' },
  kraPin:       { type: 'text',   inputMode: 'text',    autoComplete: 'off',          autoCapitalize: 'characters' },
  nationalId:   { type: 'text',   inputMode: 'numeric', autoComplete: 'off',          autoCapitalize: 'off' },
  paybill:      { type: 'text',   inputMode: 'numeric', autoComplete: 'off',          autoCapitalize: 'off' },
  till:         { type: 'text',   inputMode: 'numeric', autoComplete: 'off',          autoCapitalize: 'off' },
  bankAccount:  { type: 'text',   inputMode: 'numeric', autoComplete: 'off',          autoCapitalize: 'off' },
  amount:       { type: 'text',   inputMode: 'decimal', autoComplete: 'off',          autoCapitalize: 'off' },
  integer:      { type: 'text',   inputMode: 'numeric', autoComplete: 'off',          autoCapitalize: 'off' },
  personName:   { type: 'text',   inputMode: 'text',    autoComplete: 'name',         autoCapitalize: 'words' },
  businessName: { type: 'text',   inputMode: 'text',    autoComplete: 'organization', autoCapitalize: 'words' },
  email:        { type: 'email',  inputMode: 'email',   autoComplete: 'email',        autoCapitalize: 'off' },
  nssf:         { type: 'text',   inputMode: 'text',    autoComplete: 'off',          autoCapitalize: 'characters' },
  shif:         { type: 'text',   inputMode: 'numeric', autoComplete: 'off',          autoCapitalize: 'off' },
  etims:        { type: 'text',   inputMode: 'text',    autoComplete: 'off',          autoCapitalize: 'characters' },
  cuNumber:     { type: 'text',   inputMode: 'text',    autoComplete: 'off',          autoCapitalize: 'characters' },
  businessReg:  { type: 'text',   inputMode: 'text',    autoComplete: 'off',          autoCapitalize: 'characters' },
  pin4:         { type: 'password', inputMode: 'numeric', autoComplete: 'one-time-code', autoCapitalize: 'off' },
  pin6:         { type: 'password', inputMode: 'numeric', autoComplete: 'one-time-code', autoCapitalize: 'off' },
  otp6:         { type: 'text',   inputMode: 'numeric', autoComplete: 'one-time-code', autoCapitalize: 'off' },
  text:         { type: 'text',   inputMode: 'text',    autoComplete: 'off',          autoCapitalize: 'sentences' },
  cardNumber:   { type: 'text',   inputMode: 'numeric', autoComplete: 'cc-number', autoCapitalize: 'off' },
  cardExpiry:   { type: 'text',   inputMode: 'numeric', autoComplete: 'cc-exp',    autoCapitalize: 'off' },
  cardCvv:      { type: 'password', inputMode: 'numeric', autoComplete: 'cc-csc',  autoCapitalize: 'off' },
};
