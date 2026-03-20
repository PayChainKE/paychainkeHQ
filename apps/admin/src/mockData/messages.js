// Mock contact messages
// TODO: Replace mock data with API call
// GET /api/messages
const names = ['James Kamau','Mary Wanjiku','Peter Otieno','Grace Akinyi','David Mwangi','Sarah Njeri','Agnes Wambui','Samuel Odhiambo','Catherine Muthoni','Michael Mutua','Esther Chebet','Francis Kariuki','Beatrice Adhiambo','Daniel Kimani','Alice Nyambura','George Omondi','Mercy Wangari','Joseph Njenga'];

const contactTypes = ['merchant','investor','partnership','press','developer','careers','other'];

const subjects = [
  'Interested in the beta waitlist',
  'Partnership opportunity — SACCO integration',
  'Investment deck request',
  'Press enquiry — TechCabal article',
  'API integration question',
  'How does Cash Advance work?',
  'Unable to complete waitlist form',
  'Careers — Product Manager role'
];

function seedRandom(seed) { let s = seed % 2147483647; return function(){ s = s * 16807 % 2147483647; return (s -1)/2147483646; }; }
const rng = seedRandom(777);
function formatPhone(){ const a = Math.floor(rng()*90)+10; const b = Math.floor(rng()*900)+100; const c = Math.floor(rng()*900)+100; return `07${a} ${b} ${c}`; }
function daysAgo(max){ const d = Math.floor(rng()*max); const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString(); }

const messagesList = [];
for (let i=0;i<18;i++){
  const name = names[i % names.length];
  const contactType = contactTypes[Math.floor(rng()*contactTypes.length)];
  const subject = subjects[i % subjects.length];
  const msg = [
    'Hello, I am interested in joining the beta waitlist and would like more info on onboarding timelines.',
    'We are a SACCO looking to integrate PayChain for bulk payouts; can we schedule a call?',
    'Please send the investment deck for the merchant payments product.',
    'We are writing an article about fintech in East Africa — can we interview your CEO?',
    'I am integrating your API and getting 403 responses on webhook tests.',
    'How exactly does your Cash Advance product calculate fees and repayment?',
    'I tried to submit the waitlist form but it fails on the phone number field.'
  ][i % 7];

  messagesList.push({
    id: `msg_${3000 + i}`,
    name,
    email: `${name.split(' ')[0].toLowerCase()}@example.com`,
    phone: rng()>0.4 ? formatPhone() : '',
    contactType,
    subject,
    message: msg,
    referralSource: ['google','linkedin','press','whatsapp','direct'][Math.floor(rng()*5)],
    isRead: i < 12,
    repliedAt: i < 5 ? daysAgo(1 + Math.floor(rng()*10)) : null,
    createdAt: daysAgo(30)
  });
}

export const messagesData = messagesList;
export const messageStats = { total: messagesList.length, unread: messagesList.filter(m => !m.isRead).length };
