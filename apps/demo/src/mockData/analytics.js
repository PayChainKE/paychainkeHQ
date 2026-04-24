export const revenueByDay = {
  labels: Array.from({length:30}).map((_,i)=>{
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
  }),
  data: Array.from({length:30}).map(()=> Math.floor(5000 + Math.random()*20000))
}

export const revenueByMonth = {
  labels: ['Oct','Nov','Dec','Jan','Feb','Mar'],
  data: [180000,220000,295000,315000,331200,284750]
}

export const transactionsByHour = {
  labels: ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm'],
  data: [2,4,8,12,15,18,22,19,16,14,11,8,6,4,2]
}

export const topCustomers = [
  { name: 'Peter Otieno', phone: '0711 234 567', totalSpent: 87500, transactionCount: 34, lastVisit: '3 days ago' },
  { name: 'Mary Wanjiku', phone: '0722 123 456', totalSpent: 64200, transactionCount: 21, lastVisit: '1 day ago' },
  { name: 'Paul Njoroge', phone: '0729 987 321', totalSpent: 40120, transactionCount: 12, lastVisit: '7 days ago' }
]
