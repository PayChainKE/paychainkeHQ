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
        borderColor: accentColor,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, `${accentColor}33`); // 20% opacity
          gradient.addColorStop(1, `${accentColor}00`); // 0% opacity
          return gradient;
        },
        tension: 0.5, // Smoother curve
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: accentColor,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        borderWidth: 3,
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
          callback: (value) => `KSh ${value/1000}k`
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
