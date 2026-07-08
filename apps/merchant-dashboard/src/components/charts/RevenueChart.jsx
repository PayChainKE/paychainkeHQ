import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Filler)

const fmtCompactKES = (value) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`
  if (abs >= 1_000) return `KSh ${(value / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`
  return `KSh ${value.toLocaleString('en-KE')}`
}

// Dual-series (money in / money out) line chart for the Overview page's
// Revenue Overview card. Both lines share one y-axis, always floored at
// zero — these are absolute movement amounts, never meaningfully negative,
// so an axis that dips below zero was just Chart.js's default padding
// producing a confusing "-KSh 0.5k" tick with nothing behind it.
export default function RevenueChart({ labels, inbound, outbound }) {
  const cfg = {
    labels,
    datasets: [
      {
        label: 'Money In',
        data: inbound,
        borderColor: '#00855D',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 400)
          gradient.addColorStop(0, 'rgba(0, 133, 93, 0.14)')
          gradient.addColorStop(1, 'rgba(0, 133, 93, 0)')
          return gradient
        },
        tension: 0.45,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#00855D',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        borderWidth: 3,
        capBezierPoints: true,
      },
      {
        label: 'Money Out',
        data: outbound,
        borderColor: '#D97706',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 400)
          gradient.addColorStop(0, 'rgba(217, 119, 6, 0.10)')
          gradient.addColorStop(1, 'rgba(217, 119, 6, 0)')
          return gradient
        },
        tension: 0.45,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#D97706',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        borderWidth: 3,
        borderDash: [6, 4],
        capBezierPoints: true,
      },
    ]
  }

  const opts = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f302b',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
        bodyFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' },
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
        callbacks: {
          label: (item) => `${item.dataset.label}: ${fmtCompactKES(item.parsed.y)}`,
        },
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 10 }, color: '#404942' }
      },
      y: {
        beginAtZero: true,
        min: 0,
        grid: { color: '#e1fadf', drawBorder: false },
        ticks: {
          font: { family: 'Plus Jakarta Sans', size: 10 },
          color: '#404942',
          maxTicksLimit: 5,
          callback: (value) => fmtCompactKES(value),
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
