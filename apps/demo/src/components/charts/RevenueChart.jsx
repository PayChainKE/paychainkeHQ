import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Filler)

export default function RevenueChart({ labels, data, accentColor = '#1d9e75' }) {
  const cfg = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data,
        borderColor: '#00855D',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, `rgba(0, 133, 93, 0.1)`);
          gradient.addColorStop(1, `rgba(0, 133, 93, 0)`);
          return gradient;
        },
        tension: 0.45,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 4,
        capBezierPoints: true,
      }
    ]
  }

  const opts = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f302b',
        titleFont: { family: 'Plus Jakarta Sans', size: 12 },
        bodyFont: { family: 'Plus Jakarta Sans', size: 14, weight: 'bold' },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 10 }, color: '#404942' }
      },
      y: {
        grid: { color: '#e1fadf', drawBorder: false },
        ticks: { 
          font: { family: 'Plus Jakarta Sans', size: 10 }, 
          color: '#404942',
          callback: (value) => `Ksh ${value/1000}k`
        }
      }
    },
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    }
  }

  return (
    <div className="h-full w-full">
      <Line data={cfg} options={opts} />
    </div>
  )
}
