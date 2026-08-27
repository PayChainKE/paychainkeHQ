// One-off: seeds the Tax & Compliance filing calendar with Kenya's
// standard recurring deadlines as an editable starting point — NOT
// verified against PayChain's actual filing obligations (VAT
// registration, financial year-end). Review/adjust in the admin
// Tax & Compliance page after running this once.
//
// Safe to re-run: skips any deadline whose label already exists.
//
// Run on Render (Shell tab, already has real env vars in process.env):
//   node backend/scripts/seed-tax-deadlines.js
import mongoose from 'mongoose';
import TaxDeadline from '../models/TaxDeadline.js';

await mongoose.connect(process.env.MONGO_URI);

const defaults = [
  { label: 'VAT Return (VAT3)', taxType: 'VAT', recurrence: 'monthly', dayOfMonth: 20, reminderLeadDays: 7 },
  { label: 'PAYE Return', taxType: 'PAYE', recurrence: 'monthly', dayOfMonth: 9, reminderLeadDays: 7 },
  { label: 'Corporate Income Tax Return', taxType: 'Corporate Income Tax', recurrence: 'annual', annualMonth: 6, annualDay: 30, reminderLeadDays: 14 },
];

for (const d of defaults) {
  const existing = await TaxDeadline.findOne({ label: d.label });
  if (existing) {
    console.log(`Skipping "${d.label}" — already exists.`);
    continue;
  }
  const created = await TaxDeadline.create(d);
  console.log(`Created "${created.label}" (${created._id})`);
}

console.log('\nDone. Review/adjust dates in the admin Tax & Compliance page — these are standard Kenyan filing deadlines, not verified against PayChain\'s specific registration/year-end.');
process.exit(0);
