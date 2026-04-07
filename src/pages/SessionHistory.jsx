import { useNavigate } from 'react-router-dom'
import { useSessions } from '../hooks/useSessions'
import { formatDate, formatDuration, formatVolume } from '../utils/format'
import { sessionVolume } from '../utils/stats'
import './SessionHistory.css'

export default function SessionHistory() {
  const { sessions, loading } = useSessions()
  const navigate = useNavigate()

  if (loading) {
    return <div className="page"><p className="loading-text">Loading...</p></div>
  }

  return (
    <div className="page">
      <h1 className="page-title">History</h1>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p>No workouts yet. Start your first workout to see it here!</p>
        </div>
      ) : (
        <div className="session-list">
          {sessions.map((session, i) => {
            const volume = sessionVolume(session)
            const exerciseCount = session.entries.length
            const totalSets = session.entries.reduce((sum, e) => sum + e.sets.length, 0)

            return (
              <button
                key={session.id}
                className="session-card card fade-in"
                onClick={() => navigate(`/history/${session.id}`)}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="session-card-top">
                  <span className="session-date">{formatDate(session.date)}</span>
                  <span className="session-duration">{formatDuration(session.durationMinutes)}</span>
                </div>
                <div className="session-exercises">
                  {session.entries.map(e => e.exerciseName).join(', ')}
                </div>
                <div className="session-stats">
                  <div className="session-stat">
                    <span className="stat-value">{exerciseCount}</span>
                    <span className="stat-label">exercises</span>
                  </div>
                  <div className="session-stat">
                    <span className="stat-value">{totalSets}</span>
                    <span className="stat-label">sets</span>
                  </div>
                  <div className="session-stat">
                    <span className="stat-value">{formatVolume(volume)}</span>
                    <span className="stat-label">volume (kg)</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
