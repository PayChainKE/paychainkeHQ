// Mock analytics data
// TODO: Replace mock data with API call
// GET /api/analytics/overview
function daysAgoLabel(i){ const d = new Date(); d.setDate(d.getDate() - (29 - i)); const opts = { day: '2-digit', month: 'short' }; return d.toLocaleDateString('en-GB', opts); }

const labels = Array.from({length:30}).map((_,i)=>daysAgoLabel(i));

// signups: mostly 1-3 per day, some spikes
const signups = labels.map((_,i)=>{
  const base = Math.random() > 0.9 ? Math.floor(5 + Math.random()*3) : Math.floor(1 + Math.random()*3);
  return base;
});

// merchant growth: mostly 0/1
const merchantGrowthData = labels.map(() => (Math.random() > 0.9 ? 1 : (Math.random() > 0.85 ? 1 : 0)));

export const signupsOverTime = { labels, data: signups };

export const merchantGrowth = { labels, data: merchantGrowthData };

export const businessTypeData = {
  labels: ['Retail','Hospitality','Import & Export','Service Agency','Other'],
  waitlist: [18,9,8,7,5],
  merchants: [8,4,5,4,2]
};

export const revenueRangeData = {
  labels: ['Under KES 50K','KES 50K–200K','KES 200K–500K','KES 500K–1M','Over KES 1M'],
  data: [8,19,22,13,8]
};

export const trustScoreDistribution = {
  labels: ['0–20','21–40','41–60','61–80','81–100'],
  data: [2,3,8,7,3]
};

export const weekdaySignups = {
  labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  data: [11,14,17,16,19,9,7]
};

export const monthlySummary = [
  { month: 'October 2025', newSignups: 0, newMerchants: 0, cumMerchants: 0, estRevenue: 0 },
  { month: 'November 2025', newSignups: 4, newMerchants: 0, cumMerchants: 0, estRevenue: 0 },
  { month: 'December 2025', newSignups: 7, newMerchants: 3, cumMerchants: 3, estRevenue: 18500 },
  { month: 'January 2026', newSignups: 12, newMerchants: 8, cumMerchants: 11, estRevenue: 47200 },
  { month: 'February 2026', newSignups: 14, newMerchants: 7, cumMerchants: 18, estRevenue: 62800 },
  { month: 'March 2026', newSignups: 10, newMerchants: 5, cumMerchants: 23, estRevenue: 38400 }
];

export const topChallenges = [
  { phrase: 'SMS payment fraud', count: 29 },
  { phrase: 'Manual payroll transfers', count: 21 },
  { phrase: 'Shilling depreciation', count: 18 },
  { phrase: 'Bank credit rejection', count: 16 },
  { phrase: 'Supplier payment delays', count: 14 },
  { phrase: 'No transaction records', count: 11 },
  { phrase: 'Forex bureau costs', count: 9 },
  { phrase: 'KRA compliance', count: 8 }
];
