import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
import { useSessions } from '../hooks/useSessions'
import { CATEGORIES } from '../utils/categories'
import './ExerciseLibrary.css'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const { exercises } = useExercises()
  const { sessions } = useSessions()
  const [search, setSearch] = useState('')

  const exerciseCounts = {}
  for (const session of sessions) {
    for (const entry of session.entries) {
      exerciseCounts[entry.exerciseId] = (exerciseCounts[entry.exerciseId] || 0) + 1
    }
  }

  const filtered = exercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = []
    acc[ex.category].push(ex)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="library-header">
        <h1 className="page-title">Exercises</h1>
      </div>

      <input
        type="text"
        placeholder="Search exercises..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="library-search"
      />

      <div className="library-list">
        {CATEGORIES.map(cat => {
          const exs = grouped[cat.value]
          if (!exs || exs.length === 0) return null
          return (
            <div key={cat.value} className="library-group">
              <h3 className="library-group-title">{cat.label}</h3>
              {exs.map(ex => (
                <div key={ex.id} className="library-item">
                  <button
                    className="library-item-link"
                    onClick={() => navigate('/progress', { state: { exerciseId: ex.id } })}
                  >
                    <span className="library-item-name">{ex.name}</span>
                    {exerciseCounts[ex.id] > 0 && (
                      <span className="badge badge-accent">{exerciseCounts[ex.id]} sessions</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>No exercises match your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}
