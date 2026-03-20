// Mock merchants data for PayChain admin
// TODO: Replace mock data with API call
// GET /api/merchants
const names = [
  'James Kamau','Mary Wanjiku','Peter Otieno','Grace Akinyi','David Mwangi','Sarah Njeri',
  'John Kipchoge','Agnes Wambui','Samuel Odhiambo','Catherine Muthoni','Michael Mutua',
  'Esther Chebet','Francis Kariuki','Beatrice Adhiambo','Daniel Kimani','Alice Nyambura',
  'George Omondi','Mercy Wangari','Joseph Njenga','Priscilla Auma','Paul Njoroge','Evelyn Karanja',
  'Kelvin Rotich'
];

const businessNames = [
  'Kamau General Store','Wanjiku Fashions','Nairobi Spice Restaurant','Eastleigh Traders','Gikomba Wholesale Ltd',
  'Westlands Café','Mombasa Road Auto Parts','Ngong Road Hardware','Thika Supermart','Safari Electronics',
  'Mama Mboga Supplies','Kilimani Bakery','CBD Mobile Repairs','Juja Student Center','Rift Valley Textiles',
  'Kasarani Grocers','Langata Poultry','Karura Coffee House','Embakasi Motors','Kilimani Salon'
];

function seedRandom(seed) { let s = seed % 2147483647; return function(){ s = s * 16807 % 2147483647; return (s -1)/2147483646; }; }
const rng = seedRandom(4242);

function formatPhone(){ const a = Math.floor(rng()*90)+10; const b = Math.floor(rng()*900)+100; const c = Math.floor(rng()*900)+100; return `07${a} ${b} ${c}`; }
function daysAgo(max){ const d = Math.floor(rng()*max); const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString(); }

function formatKES(n){ return `KES ${n.toLocaleString()}`; }

const merchantsList = [];
let totalCollectedAll = 0;
let totalTxAll = 0;

for (let i=0;i<23;i++){
  const name = names[i % names.length];
  const businessName = businessNames[i % businessNames.length] + (rng()>0.7?` Ltd` : '');

  const accountStatus = i < 18 ? 'active' : (i < 20 ? 'suspended' : (i < 22 ? 'under_review' : 'inactive'));

  const kycStatus = i < 16 ? 'verified' : (i < 20 ? 'pending' : (i === 21 ? 'under_review' : 'rejected'));

  const trustScore = Math.floor(rng()*100);
  const totalCollected = Math.floor((rng()*4400 + 50) * 1000); // 50k - 4.5M
  const totalPaidOut = Math.floor(totalCollected * (0.6 + rng()*0.2));
  const totalFxSwapped = rng() > 0.85 ? Math.floor((rng()*450)*100) : 0;
  const kesBalance = Math.floor(rng()*195000)+5000;
  const usdcBalance = rng() > 0.8 ? Math.floor(rng()*1950)+50 : 0;
  const totalTransactions = Math.floor(rng()*1950)+50;

  totalCollectedAll += totalCollected;
  totalTxAll += totalTransactions;

  const joinedAt = daysAgo(120);

  const cashAdvanceEligible = trustScore > 60 && (new Date(joinedAt) < new Date(Date.now() - 90*24*3600*1000));
  const activeAdvance = cashAdvanceEligible && rng()>0.7 ? {
    amount: Math.floor(rng()*450000)+50000,
    disbursedAt: daysAgo(80),
    repaidAmount: Math.floor(rng()*200000),
    repaymentRate: Math.floor(5 + rng()*10),
    status: 'active'
  } : null;

  const tillNumber = rng() > 0.13 ? `PC${Math.floor(100000 + rng()*899999)}` : null;

  const entry = {
    id: `mer_${20000 + i}`,
    name,
    businessName,
    phone: formatPhone(),
    email: `${name.split(' ')[0].toLowerCase()}@${businessName.replace(/[^a-zA-Z]/g,'').toLowerCase()}.co.ke`,
    businessType: ['Retail','Hospitality','Import & Export','Service Agency','Other'][Math.floor(rng()*5)],
    revenueRange: ['Under KES 50,000','KES 50,000–200,000','KES 200,000–500,000','KES 500,000–1,000,000','Over KES 1,000,000'][Math.floor(rng()*5)],
    accountStatus,
    tillNumber,
    kycStatus,
    trustScore: { current: trustScore, lastUpdated: daysAgo(10) },
    financials: {
      totalCollected: totalCollected,
      totalPaidOut: totalPaidOut,
      totalFxSwapped: totalFxSwapped,
      kesBalance: kesBalance,
      usdcBalance: usdcBalance,
      totalTransactions: totalTransactions,
      lastTransactionAt: daysAgo(7),
      monthlyAvgRevenue: Math.floor(totalCollected / Math.max(1, Math.floor((Date.now() - new Date(joinedAt))/ (30*24*3600*1000))))
    },
    cashAdvance: { isEligible: cashAdvanceEligible, activeAdvance },
    priority: rng() > 0.8,
    notes: rng()>0.6? 'Requested lower disbursement fee' : '',
    joinedAt
  };
  merchantsList.push(entry);
}

export const merchantsData = merchantsList;
export const merchantStats = {
  total: merchantsList.length,
  active: 18,
  suspended: 2,
  underReview: 2,
  inactive: 1,
  kycVerified: 16,
  cashAdvanceEligible: merchantsList.filter(m => m.cashAdvance.isEligible).length,
  totalCollectedAllTime: totalCollectedAll,
  totalTransactionsAllTime: totalTxAll
};
