// Mock waitlist data for PayChain admin
// TODO: Replace mock data with API call
// GET /api/waitlist
const names = [
  'James Kamau','Mary Wanjiku','Peter Otieno','Grace Akinyi','David Mwangi','Sarah Njeri',
  'John Kipchoge','Agnes Wambui','Samuel Odhiambo','Catherine Muthoni','Michael Mutua',
  'Esther Chebet','Francis Kariuki','Beatrice Adhiambo','Daniel Kimani','Alice Nyambura',
  'George Omondi','Mercy Wangari','Joseph Njenga','Priscilla Auma','Paul Njoroge','Evelyn Karanja',
  'Kelvin Rotich','Ruth Wairimu','Emmanuel Ouma','Lilian Korir','Victor Muriuki','Hannah Ochieng',
  'Brian Kibet','Faith Mutheu','Ibrahim Noor','Clarence Mworia','Martha Nduta','Lewis Kimani',
  'Esther Waceke','Brenda Nyambura','Anthony Gitau','Sandra Omuya','Nicholas Maina','Betty Aoko',
  'Roland Ochieng','Lydia Naliaka','Kenneth Wambua','Gloria Muchiri','Patrick Njenga','Susan Mueni',
  'Timothy Kiptanui'
];

const businessNames = [
  'Kamau General Store','Wanjiku Fashions','Nairobi Spice Restaurant','Eastleigh Traders','Gikomba Wholesale Ltd',
  'Westlands Café','Mombasa Road Auto Parts','Ngong Road Hardware','Thika Supermart','Safari Electronics',
  'Mama Mboga Supplies','Kilimani Bakery','CBD Mobile Repairs','Juja Student Center','Rift Valley Textiles',
  'Kasarani Grocers','Langata Poultry','Karura Coffee House','Embakasi Motors','Kilimani Salon',
  'Nairobi Prints Ltd','MarketView Stationery','Omondi Supply Co','Kisumu Fish Mart','Nyeri Farm Produce'
];

function seedRandom(seed) {
  let s = seed % 2147483647;
  return function() {
    s = s * 16807 % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = seedRandom(12345);

const revenueRanges = [
  'Under KES 50,000','KES 50,000–200,000','KES 200,000–500,000','KES 500,000–1,000,000','Over KES 1,000,000'
];

const businessTypes = ['Retail','Hospitality','Import & Export','Service Agency','Other'];

const challenges = [
  'Frequent SMS payment fraud attempts causing chargebacks',
  'Difficulty reconciling shilling fluctuations in mobile money payouts',
  'Manual payroll requires too many steps, looking for automation',
  'Suspected shilling/shilling-related losses from unverified vendors',
  'Need credit facility but banks keep rejecting small business loans',
  'High fees on cross-border receipts affecting margin',
  'No reliable receipts for reconciliations with suppliers'
];

const referralSources = ['google','facebook','whatsapp','referral','twitter','instagram','direct','partner'];

function randPick(arr) { return arr[Math.floor(rng() * arr.length)]; }

function formatPhone() {
  // 07XX XXX XXX
  const a = Math.floor(rng()*90)+10;
  const b = Math.floor(rng()*900)+100;
  const c = Math.floor(rng()*900)+100;
  return `07${a} ${b} ${c}`;
}

function daysAgo(maxDays) {
  const d = Math.floor(rng() * maxDays);
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
}

const waitlistData = [];
for (let i=0;i<47;i++){
  const name = names[i % names.length];
  const businessName = businessNames[i % businessNames.length] + (rng() > 0.85 ? ` ${Math.floor(rng()*90)+10}` : '');
  // Weighted statuses: 30 pending, 8 approved, 5 contacted, 3 converted, 1 rejected
  let status = 'pending';
  if (i < 30) status = 'pending';
  else if (i < 38) status = 'approved';
  else if (i < 43) status = 'contacted';
  else if (i < 46) status = 'converted';
  else status = 'rejected';

  const entry = {
    id: `wl_${10000 + i}`,
    name,
    businessName,
    phone: formatPhone(),
    businessType: randPick(businessTypes),
    revenueRange: randPick(revenueRanges),
    challenge: randPick(challenges),
    status,
    priority: rng() > 0.8,
    notes: rng() > 0.6 ? (rng()>0.9? 'Interested in cash advance pilot' : 'Wants onboarding help') : '',
    referralSource: randPick(referralSources),
    createdAt: daysAgo(60)
  };
  waitlistData.push(entry);
}

export const waitlistDataExport = waitlistData;
export const waitlistStats = {
  total: 47,
  pending: 30,
  approved: 8,
  contacted: 5,
  converted: 3,
  rejected: 1
};

export { waitlistData };
