import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessions } from '../hooks/useSessions'
import { formatDateTime, formatDuration, formatWeight, formatVolume } from '../utils/format'
import { sessionVolume, entryVolume, estimated1RM, heaviestWeight } from '../utils/stats'
import './SessionDetail.css'

// Convert timestamp to datetime-local input value (YYYY-MM-DDTHH:mm)
function toLocalInput(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getSessionById, updateSession, removeSession } = useSessions()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const dateRef = useRef(null)

  useEffect(() => {
    getSessionById(id).then(s => {
      setSession(s)
      setLoading(false)
    })
  }, [id, getSessionById])

  const handleDateChange = async (e) => {
    const newDate = new Date(e.target.value).getTime()
    if (isNaN(newDate)) return
    await updateSession(id, { date: newDate })
    setSession(prev => ({ ...prev, date: newDate }))
  }

  const openDatePicker = () => {
    dateRef.current?.showPicker?.()
    dateRef.current?.focus()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this workout? This cannot be undone.')) return
    await removeSession(id)
    navigate('/history')
  }

  if (loading) {
    return <div className="page"><p className="loading-text">Loading...</p></div>
  }

  if (!session) {
    return (
      <div className="page">
        <p className="loading-text">Session not found</p>
        <button className="btn btn-ghost" onClick={() => navigate('/history')}>Back to History</button>
      </div>
    )
  }

  const volume = sessionVolume(session)
  const totalSets = session.entries.reduce((sum, e) => sum + e.sets.length, 0)

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/history')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        History
      </button>

      <div className="detail-header">
        <button className="detail-date-btn" onClick={openDatePicker} title="Tap to change date">
          <h1 className="page-title">{formatDateTime(session.date)}</h1>
          <svg className="detail-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <input
          ref={dateRef}
          type="datetime-local"
          className="detail-date-input"
          value={toLocalInput(session.date)}
          onChange={handleDateChange}
        />
        <div className="detail-stats">
          <div className="detail-stat">
            <span className="stat-value">{formatDuration(session.durationMinutes)}</span>
            <span className="stat-label">duration</span>
          </div>
          <div className="detail-stat">
            <span className="stat-value">{session.entries.length}</span>
            <span className="stat-label">exercises</span>
          </div>
          <div className="detail-stat">
            <span className="stat-value">{totalSets}</span>
            <span className="stat-label">sets</span>
          </div>
          <div className="detail-stat">
            <span className="stat-value">{formatVolume(volume)}</span>
            <span className="stat-label">volume</span>
          </div>
        </div>
      </div>

      <div className="detail-entries">
        {session.entries.map((entry, i) => (
          <div key={i} className="detail-entry card fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="detail-entry-header">
              <h3 className="detail-entry-name">{entry.exerciseName}</h3>
              <div className="detail-entry-meta">
                <span className="badge badge-primary">{formatWeight(heaviestWeight(entry))}</span>
              </div>
            </div>
            <table className="sets-table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Weight</th>
                  <th>Reps</th>
                  <th>Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                {entry.sets.map((set, j) => (
                  <tr key={j}>
                    <td>{j + 1}</td>
                    <td>{formatWeight(set.weight, set.unit || 'kg')}</td>
                    <td>{set.reps}</td>
                    <td className="e1rm">{estimated1RM(set.weight, set.reps).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="detail-entry-footer">
              <span>Volume: {formatVolume(entryVolume(entry))} kg</span>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-danger btn-full" onClick={handleDelete} style={{ marginTop: '1.5rem' }}>
        Delete Workout
      </button>
    </div>
  )
}
