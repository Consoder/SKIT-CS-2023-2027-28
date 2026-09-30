import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Filler);

// Single-series only: each chart shows one measure on one axis (the title
// names it, so no legend). Series colour is the palette's blue; text stays
// in neutral ink.
const SERIES = '#3987e5';
const GRID = 'rgba(148, 163, 184, 0.08)';
const TICK = '#94a3b8';

function baseOptions({ yMax, format, unit }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx) => (ctx.parsed.y === null ? 'No scans' : `${format(ctx.parsed.y)}${unit ? ` ${unit}` : ''}`),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: '#334155' },
        ticks: { color: TICK, maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: TICK, precision: 0, maxTicksLimit: 5, font: { size: 11 } },
      },
    },
  };
}

export default function TimeSeriesChart({ type = 'bar', labels, values, label, yMax, unit = '', format = (v) => v, height = 220 }) {
  const [showTable, setShowTable] = useState(false);
  const options = baseOptions({ yMax, format, unit });

  const data = {
    labels,
    datasets: [
      type === 'bar'
        ? {
            label,
            data: values,
            backgroundColor: SERIES,
            hoverBackgroundColor: '#5598e7',
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            maxBarThickness: 22,
            categoryPercentage: 0.8,
            barPercentage: 0.85,
          }
        : {
            label,
            data: values,
            borderColor: SERIES,
            backgroundColor: 'rgba(57, 135, 229, 0.12)',
            fill: true,
            borderWidth: 2,
            tension: 0.3,
            spanGaps: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHitRadius: 12,
            pointBackgroundColor: SERIES,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
          },
    ],
  };

  const ChartComponent = type === 'bar' ? Bar : Line;

  return (
    <div>
      {showTable ? (
        <div className="scroll-thin overflow-auto" style={{ maxHeight: height }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 text-right font-medium">{label}</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((day, i) => (
                <tr key={day} className="border-t border-slate-800 text-slate-300">
                  <td className="py-1">{day}</td>
                  <td className="py-1 text-right tabular-nums">{values[i] === null ? '—' : format(values[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={`${label} per day for the last ${labels.length} days`}>
          <ChartComponent data={data} options={options} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowTable((value) => !value)}
        className="no-print mt-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
      >
        {showTable ? 'Show chart' : 'View as table'}
      </button>
    </div>
  );
}
