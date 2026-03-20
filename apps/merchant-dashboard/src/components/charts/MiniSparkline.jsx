import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement } from 'chart.js'
ChartJS.register(LinearScale,CategoryScale,PointElement,LineElement)

export default function MiniSparkline({ data }){
  const cfg = { labels: data.map((_,i)=>i), datasets:[{data, borderColor:'#1D9E75', backgroundColor:'transparent', tension:0.3, pointRadius:0, borderWidth:2 }] }
  const opts = { plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:false}}, elements:{line:{borderJoinStyle:'round'}}, maintainAspectRatio:false }
  return <div style={{width:120,height:40}}><Line data={cfg} options={opts} /></div>
}
