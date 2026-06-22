/**
 * KRA PAYE Calculator (2024/2026 Standards)
 * Calculates Net Pay based on Gross Pay, NSSF, SHIF/NHIF, and PAYE tax bands.
 */

export const calculatePAYE = (grossPay) => {
  const gross = parseFloat(grossPay);
  if (isNaN(gross) || gross <= 0) {
    return {
      grossPay: 0,
      nssf: 0,
      shif: 0,
      taxablePay: 0,
      paye: 0,
      personalRelief: 0,
      netPay: 0,
    };
  }

  // 1. NSSF Deduction (Tier I & Tier II standard - approx 6% up to a cap, simplified for this demo)
  // Max NSSF is usually around 2,160 KES if gross > 36,000
  let nssf = 0;
  if (gross > 18000) {
    nssf = 1080 + Math.min((gross - 18000) * 0.06, 1080); 
  } else {
    nssf = gross * 0.06;
  }

  // 2. SHIF / NHIF Deduction (Approx 2.75% of gross pay as per new SHIF rules)
  const shif = gross * 0.0275;

  // 3. Taxable Pay
  const taxablePay = gross - nssf;

  // 4. PAYE Calculation (Monthly Tax Bands)
  // Band 1: Up to 24,000 @ 10%
  // Band 2: 24,001 - 32,333 @ 25%
  // Band 3: 32,334 - 500,000 @ 30%
  // Band 4: 500,001 - 800,000 @ 32.5%
  // Band 5: Over 800,000 @ 35%
  
  let tax = 0;
  let remaining = taxablePay;

  if (remaining > 24000) {
    tax += 24000 * 0.10;
    remaining -= 24000;

    if (remaining > 8333) {
      tax += 8333 * 0.25;
      remaining -= 8333;

      if (remaining > 467667) {
        tax += 467667 * 0.30;
        remaining -= 467667;

        if (remaining > 300000) {
          tax += 300000 * 0.325;
          remaining -= 300000;
          
          if (remaining > 0) {
            tax += remaining * 0.35;
          }
        } else {
          tax += remaining * 0.325;
        }
      } else {
        tax += remaining * 0.30;
      }
    } else {
      tax += remaining * 0.25;
    }
  } else {
    tax += remaining * 0.10;
  }

  // 5. Personal Relief
  const personalRelief = 2400; // Standard monthly relief
  
  // 6. Final PAYE
  let finalPaye = tax - personalRelief;
  if (finalPaye < 0) finalPaye = 0; // PAYE cannot be negative

  // 7. Net Pay
  const netPay = gross - nssf - shif - finalPaye;

  return {
    grossPay: Number(gross.toFixed(2)),
    nssf: Number(nssf.toFixed(2)),
    shif: Number(shif.toFixed(2)),
    taxablePay: Number(taxablePay.toFixed(2)),
    paye: Number(finalPaye.toFixed(2)),
    personalRelief,
    netPay: Number(netPay.toFixed(2)),
  };
};
