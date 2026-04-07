import { useState, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useExercises } from '../hooks/useExercises'
import { useSessions } from '../hooks/useSessions'
import { getExerciseHistory, estimated1RM, entryVolume, heaviestWeight } from '../utils/stats'
import { formatDate, formatWeight } from '../utils/format'
import './Progress.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: null }
]

export default function Progress() {
  const { exercises } = useExercises()
  const { sessions } = useSessions()
  const [selectedId, setSelectedId] = useState('')
  const [range, setRange] = useState(RANGES[1])

  const history = useMemo(() => {
    if (!selectedId) return []
    let data = getExerciseHistory(sessions, selectedId)
    if (range.days) {
      const cutoff = Date.now() - range.days * 86400000
      data = data.filter(h => h.date >= cutoff)
    }
    return data
  }, [sessions, selectedId, range])

  const chartData = useMemo(() => {
    if (history.length === 0) return null

    const labels = history.map(h => formatDate(h.date))
    const weights = history.map(h => heaviestWeight(h.entry))
    const e1rms = history.map(h => {
      let best = 0
      for (const set of h.entry.sets) {
        const val = estimated1RM(set.weight, set.reps)
        if (val > best) best = val
      }
      return Math.round(best * 10) / 10
    })
    const volumes = history.map(h => entryVolume(h.entry))

    return { labels, weights, e1rms, volumes }
  }, [history])

  const overallStats = useMemo(() => {
    if (history.length === 0) return null
    let bestWeight = 0
    let bestE1RM = 0
    let totalVolume = 0
    for (const h of history) {
      const hw = heaviestWeight(h.entry)
      if (hw > bestWeight) bestWeight = hw
      for (const set of h.entry.sets) {
        const e = estimated1RM(set.weight, set.reps)
        if (e > bestE1RM) bestE1RM = e
      }
      totalVolume += entryVolume(h.entry)
    }
    return {
      sessions: history.length,
      bestWeight,
      bestE1RM: Math.round(bestE1RM * 10) / 10,
      totalVolume
    }
  }, [history])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#9999b0',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: '#1c1c2e',
        titleColor: '#f0f0f5',
        bodyColor: '#9999b0',
        borderColor: '#2a2a45',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { weight: '700' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#666680', font: { size: 10 }, maxRotation: 45 },
        grid: { color: 'rgba(42, 42, 69, 0.5)' }
      },
      y: {
        ticks: { color: '#666680', font: { size: 10 } },
        grid: { color: 'rgba(42, 42, 69, 0.5)' }
      }
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Progress</h1>

      <select
        className="exercise-select"
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
      >
        <option value="">Select an exercise...</option>
        {exercises.map(ex => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>

      {selectedId && (
        <div className="range-tabs">
          {RANGES.map(r => (
            <button
              key={r.label}
              className={`range-tab ${range.label === r.label ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {selectedId && history.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p>No data for this exercise yet. Log some workouts to see your progress!</p>
        </div>
      )}

      {chartData && (
        <>
          <div className="progress-stats">
            <div className="progress-stat card">
              <span className="progress-stat-value">{formatWeight(overallStats.bestWeight)}</span>
              <span className="progress-stat-label">Best Weight</span>
            </div>
            <div className="progress-stat card">
              <span className="progress-stat-value">{formatWeight(overallStats.bestE1RM)}</span>
              <span className="progress-stat-label">Est. 1RM</span>
            </div>
            <div className="progress-stat card">
              <span className="progress-stat-value">{overallStats.sessions}</span>
              <span className="progress-stat-label">Sessions</span>
            </div>
          </div>

          <div className="chart-container card">
            <h3 className="chart-title">Weight & Estimated 1RM</h3>
            <div className="chart-wrapper">
              <Line
                data={{
                  labels: chartData.labels,
                  datasets: [
                    {
                      label: 'Best Weight',
                      data: chartData.weights,
                      borderColor: '#6366f1',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 6
                    },
                    {
                      label: 'Est. 1RM',
                      data: chartData.e1rms,
                      borderColor: '#22d3ee',
                      backgroundColor: 'rgba(34, 211, 238, 0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                      borderDash: [5, 3]
                    }
                  ]
                }}
                options={chartOptions}
              />
            </div>
          </div>

          <div className="chart-container card">
            <h3 className="chart-title">Volume per Session</h3>
            <div className="chart-wrapper">
              <Line
                data={{
                  labels: chartData.labels,
                  datasets: [
                    {
                      label: 'Volume (kg)',
                      data: chartData.volumes,
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 6
                    }
                  ]
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </>
      )}

      {!selectedId && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p>Select an exercise above to view your progress over time.</p>
        </div>
      )}
    </div>
  )
}
