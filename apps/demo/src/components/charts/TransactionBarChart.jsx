import React from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale,LinearScale,BarElement,Tooltip)

export default function TransactionBarChart({ labels, data }){
  const cfg = { labels, datasets:[{label:'Transactions', data, backgroundColor:'#0B4D2E'}] }
  const opts = { plugins:{legend:{display:false}}, maintainAspectRatio:false }
  return <div style={{height:180}}><Bar data={cfg} options={opts} /></div>
}
