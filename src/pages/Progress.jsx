import { useState, useMemo, useEffect } from 'react'
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
import { useRoutines } from '../hooks/useRoutines'
import { getExerciseHistory, estimated1RM, entryVolume, heaviestWeight } from '../utils/stats'
import { useLocation } from 'react-router-dom'
import { formatDate, formatWeight, formatVolume } from '../utils/format'
import { CATEGORIES, CATEGORY_MAP } from '../utils/categories'
import './Progress.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: null }
]

// ─── Overview cards ──────────────────────────────────────────

function OverviewCards({ sessions }) {
  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const thisWeek = sessions.filter(s => s.date >= weekAgo)
    const weekVolume = thisWeek.reduce((t, s) => {
      return t + s.entries.reduce((et, e) => et + entryVolume(e), 0)
    }, 0)

    // Recent PRs: best weight per exercise across all sessions
    const prMap = {}
    for (const s of sessions) {
      for (const entry of s.entries) {
        const hw = heaviestWeight(entry)
        if (!prMap[entry.exerciseId] || hw > prMap[entry.exerciseId].weight) {
          prMap[entry.exerciseId] = { name: entry.exerciseName, weight: hw, date: s.date }
        }
      }
    }
    const recentPRs = Object.values(prMap)
      .sort((a, b) => b.date - a.date)
      .slice(0, 3)

    return { weekSessions: thisWeek.length, weekVolume, totalSessions: sessions.length, recentPRs }
  }, [sessions])

  return (
    <div className="overview-section">
      <div className="overview-grid">
        <div className="overview-card card">
          <span className="overview-value">{stats.weekSessions}</span>
          <span className="overview-label">This week</span>
        </div>
        <div className="overview-card card">
          <span className="overview-value">{formatVolume(stats.weekVolume)}<small>kg</small></span>
          <span className="overview-label">Week volume</span>
        </div>
        <div className="overview-card card">
          <span className="overview-value">{stats.totalSessions}</span>
          <span className="overview-label">Total sessions</span>
        </div>
      </div>
      {stats.recentPRs.length > 0 && (
        <div className="recent-prs card">
          <h3 className="section-subtitle">Recent PRs</h3>
          {stats.recentPRs.map((pr, i) => (
            <div key={i} className="pr-row">
              <span className="pr-name">{pr.name}</span>
              <span className="pr-weight">{formatWeight(pr.weight)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Filter chips ────────────────────────────────────────────

function FilterChips({ active, onChange, routines }) {
  const splitChips = useMemo(() => {
    const chips = []
    for (const r of routines) {
      for (const s of r.splits) {
        chips.push({
          key: `split:${r.id}:${s.id}`,
          label: s.name,
          routineName: r.name
        })
      }
    }
    return chips
  }, [routines])

  // Selecting a category clears split and vice versa
  const activeCategory = active === 'all' || (!active.startsWith('split:') && active) ? active : 'all'
  const activeSplit = active.startsWith('split:') ? active : null

  const handleCategory = (val) => onChange(val)
  const handleSplit = (key) => onChange(activeSplit === key ? 'all' : key)

  return (
    <div className="filter-section">
      <div className="filter-row">
        <span className="filter-row-label">Muscle</span>
        <div className="filter-chips">
          <button
            className={`filter-chip ${activeCategory === 'all' && !activeSplit ? 'filter-chip--active' : ''}`}
            onClick={() => handleCategory('all')}
          >All</button>
          {CATEGORIES.filter(c => c.value !== 'other').map(cat => (
            <button
              key={cat.value}
              className={`filter-chip ${activeCategory === cat.value ? 'filter-chip--active' : ''}`}
              onClick={() => handleCategory(cat.value)}
            >{cat.label}</button>
          ))}
        </div>
      </div>
      {splitChips.length > 0 && (
        <div className="filter-row">
          <span className="filter-row-label">Split</span>
          <div className="filter-chips">
            {splitChips.map(chip => (
              <button
                key={chip.key}
                className={`filter-chip filter-chip--split ${activeSplit === chip.key ? 'filter-chip--active' : ''}`}
                onClick={() => handleSplit(chip.key)}
              >{chip.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sparkline (tiny inline chart) ───────────────────────────

function Sparkline({ data }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80
  const h = 24
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ')

  const trending = data[data.length - 1] >= data[0]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={trending ? 'var(--color-success)' : 'var(--color-danger)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Exercise summary card ──────────────────────────────────

function ExerciseCard({ exercise, sessions, onClick }) {
  const data = useMemo(() => {
    const history = getExerciseHistory(sessions, exercise.id)
    if (history.length === 0) return null

    const weights = history.map(h => heaviestWeight(h.entry))
    const best = Math.max(...weights)
    const latest = weights[weights.length - 1]

    let bestE1RM = 0
    for (const h of history) {
      for (const set of h.entry.sets) {
        const e = estimated1RM(set.weight, set.reps)
        if (e > bestE1RM) bestE1RM = e
      }
    }

    return { sessions: history.length, best, latest, bestE1RM, sparkData: weights }
  }, [exercise.id, sessions])

  if (!data) return null

  return (
    <button className="exercise-card card" onClick={onClick}>
      <div className="exercise-card-top">
        <span className="exercise-card-name">{exercise.name}</span>
        <Sparkline data={data.sparkData} />
      </div>
      <div className="exercise-card-stats">
        <span className="exercise-card-stat">
          <strong>{formatWeight(data.best)}</strong> PR
        </span>
        <span className="exercise-card-stat">
          <strong>{formatWeight(data.latest)}</strong> last
        </span>
        <span className="exercise-card-stat">
          <strong>{data.sessions}</strong> sessions
        </span>
      </div>
    </button>
  )
}

// ─── Full exercise detail (charts) ──────────────────────────

function ExerciseDetail({ exercise, sessions, onBack }) {
  const [range, setRange] = useState(RANGES[1])

  const history = useMemo(() => {
    let data = getExerciseHistory(sessions, exercise.id)
    if (range.days) {
      const cutoff = Date.now() - range.days * 86400000
      data = data.filter(h => h.date >= cutoff)
    }
    return data
  }, [sessions, exercise.id, range])

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

  const stats = useMemo(() => {
    if (history.length === 0) return null
    let bestWeight = 0, bestE1RM = 0, totalVolume = 0
    for (const h of history) {
      const hw = heaviestWeight(h.entry)
      if (hw > bestWeight) bestWeight = hw
      for (const set of h.entry.sets) {
        const e = estimated1RM(set.weight, set.reps)
        if (e > bestE1RM) bestE1RM = e
      }
      totalVolume += entryVolume(h.entry)
    }
    return { sessions: history.length, bestWeight, bestE1RM: Math.round(bestE1RM * 10) / 10, totalVolume }
  }, [history])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: { color: '#9999b0', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11, weight: '600' } }
      },
      tooltip: {
        backgroundColor: '#1c1c2e', titleColor: '#f0f0f5', bodyColor: '#9999b0',
        borderColor: '#2a2a45', borderWidth: 1, padding: 10, cornerRadius: 8, titleFont: { weight: '700' }
      }
    },
    scales: {
      x: { ticks: { color: '#666680', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(42, 42, 69, 0.5)' } },
      y: { ticks: { color: '#666680', font: { size: 10 } }, grid: { color: 'rgba(42, 42, 69, 0.5)' } }
    }
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        All Exercises
      </button>

      <h2 className="detail-exercise-name">{exercise.name}</h2>
      <span className="detail-category-badge">{CATEGORY_MAP[exercise.category] || exercise.category}</span>

      <div className="range-tabs">
        {RANGES.map(r => (
          <button
            key={r.label}
            className={`range-tab ${range.label === r.label ? 'active' : ''}`}
            onClick={() => setRange(r)}
          >{r.label}</button>
        ))}
      </div>

      {history.length === 0 && (
        <div className="empty-state">
          <p>No data in this time range.</p>
        </div>
      )}

      {stats && (
        <div className="progress-stats">
          <div className="progress-stat card">
            <span className="progress-stat-value">{formatWeight(stats.bestWeight)}</span>
            <span className="progress-stat-label">Best Weight</span>
          </div>
          <div className="progress-stat card">
            <span className="progress-stat-value">{formatWeight(stats.bestE1RM)}</span>
            <span className="progress-stat-label">Est. 1RM</span>
          </div>
          <div className="progress-stat card">
            <span className="progress-stat-value">{stats.sessions}</span>
            <span className="progress-stat-label">Sessions</span>
          </div>
        </div>
      )}

      {chartData && (
        <>
          <div className="chart-container card">
            <h3 className="chart-title">Weight & Estimated 1RM</h3>
            <div className="chart-wrapper">
              <Line
                data={{
                  labels: chartData.labels,
                  datasets: [
                    {
                      label: 'Best Weight', data: chartData.weights,
                      borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6
                    },
                    {
                      label: 'Est. 1RM', data: chartData.e1rms,
                      borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.1)',
                      fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderDash: [5, 3]
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
                  datasets: [{
                    label: 'Volume (kg)', data: chartData.volumes,
                    borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6
                  }]
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ─── Main Progress page ─────────────────────────────────────

export default function Progress() {
  const { exercises } = useExercises()
  const { sessions } = useSessions()
  const { routines } = useRoutines()
  const location = useLocation()
  const [filter, setFilter] = useState('all')
  const [selectedExercise, setSelectedExercise] = useState(null)

  // Accept exercise from navigation state (e.g. from Exercise Library)
  useEffect(() => {
    if (location.state?.exerciseId && exercises.length > 0) {
      const ex = exercises.find(e => e.id === location.state.exerciseId)
      if (ex) setSelectedExercise(ex)
      // Clear state so back+forward doesn't re-trigger
      window.history.replaceState({}, '')
    }
  }, [location.state, exercises])

  // Build split lookup for filtering
  const splitExerciseIds = useMemo(() => {
    const map = {}
    for (const r of routines) {
      for (const s of r.splits) {
        map[`split:${r.id}:${s.id}`] = new Set(s.exercises.map(e => e.exerciseId))
      }
    }
    return map
  }, [routines])

  // Exercises that have at least one session
  const exercisesWithData = useMemo(() => {
    const usedIds = new Set()
    for (const s of sessions) {
      for (const entry of s.entries) {
        usedIds.add(entry.exerciseId)
      }
    }
    return exercises.filter(e => usedIds.has(e.id))
  }, [exercises, sessions])

  // Apply filter
  const filteredExercises = useMemo(() => {
    if (filter === 'all') return exercisesWithData
    if (filter.startsWith('split:')) {
      const ids = splitExerciseIds[filter]
      return ids ? exercisesWithData.filter(e => ids.has(e.id)) : []
    }
    return exercisesWithData.filter(e => e.category === filter)
  }, [exercisesWithData, filter, splitExerciseIds])

  // If viewing detail
  if (selectedExercise) {
    return (
      <div className="page">
        <ExerciseDetail
          exercise={selectedExercise}
          sessions={sessions}
          onBack={() => setSelectedExercise(null)}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Progress</h1>

      <OverviewCards sessions={sessions} />

      <FilterChips active={filter} onChange={setFilter} routines={routines} />

      {filteredExercises.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p>{filter === 'all' ? 'Log some workouts to see your progress!' : 'No exercises with data in this filter.'}</p>
        </div>
      ) : (
        <div className="exercise-cards-grid">
          {filteredExercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              sessions={sessions}
              onClick={() => setSelectedExercise(ex)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
