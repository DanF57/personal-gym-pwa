import { useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import { useSessions } from '../hooks/useSessions'
import Modal from '../components/Modal'
import './ExerciseLibrary.css'

const CATEGORIES = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'other', label: 'Other' }
]

export default function ExerciseLibrary() {
  const { exercises, addExercise, removeExercise } = useExercises()
  const { sessions } = useSessions()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('push')

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

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    await addExercise(name, newCategory)
    setNewName('')
    setNewCategory('push')
    setAddOpen(false)
  }

  const handleDelete = async (ex) => {
    if (!ex.isCustom) return
    if (!confirm(`Delete "${ex.name}"?`)) return
    await removeExercise(ex.id)
  }

  return (
    <div className="page">
      <div className="library-header">
        <h1 className="page-title">Exercises</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          + Add
        </button>
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
                  <div className="library-item-info">
                    <span className="library-item-name">{ex.name}</span>
                    {exerciseCounts[ex.id] > 0 && (
                      <span className="badge badge-accent">{exerciseCounts[ex.id]} sessions</span>
                    )}
                  </div>
                  {ex.isCustom && (
                    <button className="library-item-delete" onClick={() => handleDelete(ex)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Exercise">
        <div className="add-form">
          <label className="form-label">
            Name
            <input
              type="text"
              placeholder="e.g. Lateral Raise"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="form-input"
              autoFocus
            />
          </label>
          <label className="form-label">
            Category
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="form-input"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary btn-full" onClick={handleAdd} style={{ marginTop: '0.5rem' }}>
            Add Exercise
          </button>
        </div>
      </Modal>
    </div>
  )
}
