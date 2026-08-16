import { normalizeKraPin, isValidKraPin, kraPinTaxpayerType } from '../utils/kraPinValidator.js';

describe('kraPinValidator', () => {
  test('normalizeKraPin trims and uppercases', () => {
    expect(normalizeKraPin('  p051892647a  ')).toBe('P051892647A');
    expect(normalizeKraPin(null)).toBe(null);
    expect(normalizeKraPin(undefined)).toBe(undefined);
  });

  test('accepts well-formed, non-sequential individual (A) and non-individual (P) PINs, case-insensitively', () => {
    expect(isValidKraPin('P051892647A')).toBe(true);
    expect(isValidKraPin('A047261953Z')).toBe(true);
    expect(isValidKraPin('p051892647a')).toBe(true);
  });

  test('rejects malformed PINs', () => {
    expect(isValidKraPin('')).toBe(false);
    expect(isValidKraPin(null)).toBe(false);
    expect(isValidKraPin('B051892647A')).toBe(false); // wrong leading letter
    expect(isValidKraPin('P05189264A')).toBe(false); // 8 digits, not 9
    expect(isValidKraPin('P0518926470A')).toBe(false); // 10 digits
    expect(isValidKraPin('P051892647')).toBe(false); // missing trailing letter
    expect(isValidKraPin('051892647A')).toBe(false); // missing leading letter
    expect(isValidKraPin('P05189264AA')).toBe(false); // two trailing letters
  });

  test('rejects obviously-fake digit patterns even when shape is correct', () => {
    // The classic "example" PIN people type when they just want past a
    // required field, or a bot fills in — this is exactly why the format
    // hint no longer uses it as its own example.
    expect(isValidKraPin('P123456789A')).toBe(false); // ascending run
    expect(isValidKraPin('P987654321A')).toBe(false); // descending run
    expect(isValidKraPin('P012345678A')).toBe(false); // ascending run from 0
    expect(isValidKraPin('P111111111A')).toBe(false); // all same digit
    expect(isValidKraPin('P000000000A')).toBe(false); // all zeros
    expect(isValidKraPin('P999999999A')).toBe(false); // all nines
  });

  test('kraPinTaxpayerType distinguishes individual vs non-individual, null on invalid/fake', () => {
    expect(kraPinTaxpayerType('A047261953Z')).toBe('individual');
    expect(kraPinTaxpayerType('P051892647Z')).toBe('non_individual');
    expect(kraPinTaxpayerType('garbage')).toBe(null);
    expect(kraPinTaxpayerType('P123456789A')).toBe(null);
  });
});
