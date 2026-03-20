import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
ChartJS.register(LinearScale,CategoryScale,PointElement,LineElement,Tooltip,Filler)

export default function RevenueChart({ labels, data }){
  const cfg = { labels, datasets:[{label:'Revenue', data, borderColor:'#1D9E75', backgroundColor:'rgba(29,158,117,0.08)', tension:0.4, fill:true, pointRadius:0, borderWidth:2 }]}
  const opts = { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:'#F0F0EE'}}}, maintainAspectRatio:false }
  return <div style={{height:220}}><Line data={cfg} options={opts} /></div>
}
