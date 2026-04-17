import { useState, useRef } from 'react'
import { useRoutines } from '../hooks/useRoutines'
import { useExercises } from '../hooks/useExercises'
import { generateId } from '../utils/id'
import { CATEGORIES } from '../utils/categories'
import Modal from '../components/Modal'
import './Routines.css'

function SplitEditor({ split, exercises, onUpdate, onRemove }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef(null)

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filteredExercises.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = []
    acc[ex.category].push(ex)
    return acc
  }, {})

  const addExercise = (ex) => {
    onUpdate({
      ...split,
      exercises: [...split.exercises, {
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: 3
      }]
    })
    setPickerOpen(false)
    setSearch('')
  }

  const removeExercise = (idx) => {
    onUpdate({
      ...split,
      exercises: split.exercises.filter((_, i) => i !== idx)
    })
  }

  const updateSets = (idx, sets) => {
    const num = Math.max(1, Math.min(20, parseInt(sets) || 1))
    onUpdate({
      ...split,
      exercises: split.exercises.map((e, i) => i === idx ? { ...e, sets: num } : e)
    })
  }

  return (
    <div className="split-card card">
      <div className="split-header">
        <input
          type="text"
          className="split-name-input"
          placeholder="Split name (e.g. Push Day)"
          value={split.name}
          onChange={e => onUpdate({ ...split, name: e.target.value })}
        />
        <button className="btn btn-sm btn-danger" onClick={onRemove}>Remove</button>
      </div>

      {split.exercises.length > 0 && (
        <div className="split-exercises">
          <div className="split-ex-header">
            <span>Exercise</span>
            <span>Sets</span>
            <span></span>
          </div>
          {split.exercises.map((ex, idx) => (
            <div key={idx} className="split-ex-row">
              <span className="split-ex-name">{ex.exerciseName}</span>
              <div className="split-ex-sets">
                <button
                  className="sets-btn"
                  onClick={() => updateSets(idx, ex.sets - 1)}
                >−</button>
                <span className="sets-value">{ex.sets}</span>
                <button
                  className="sets-btn"
                  onClick={() => updateSets(idx, ex.sets + 1)}
                >+</button>
              </div>
              <button
                className="split-ex-remove"
                onClick={() => removeExercise(idx)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-ghost btn-sm btn-full"
        onClick={() => setPickerOpen(true)}
        style={{ marginTop: '0.5rem' }}
      >
        + Add Exercise
      </button>

      <Modal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setSearch('') }}
        title="Add Exercise to Split"
        fullScreen
      >
        <input
          ref={searchRef}
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="exercise-search"
          autoFocus
        />
        <div className="exercise-picker-list">
          {CATEGORIES.map(cat => {
            const exs = grouped[cat.value]
            if (!exs || exs.length === 0) return null
            return (
              <div key={cat.value}>
                <h4 className="picker-category">{cat.label}</h4>
                {exs.map(ex => (
                  <button
                    key={ex.id}
                    className="picker-exercise"
                    onClick={() => addExercise(ex)}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            )
          })}
          {filteredExercises.length === 0 && (
            <p className="empty-state" style={{ padding: '2rem' }}>No exercises found</p>
          )}
        </div>
      </Modal>
    </div>
  )
}

function RoutineEditor({ initial, onSave, onCancel }) {
  const { exercises } = useExercises()
  const [name, setName] = useState(initial?.name || '')
  const [splits, setSplits] = useState(
    initial?.splits?.map(s => ({ ...s })) || []
  )

  const addSplit = () => {
    setSplits([...splits, { id: generateId(), name: '', exercises: [] }])
  }

  const updateSplit = (idx, updated) => {
    setSplits(splits.map((s, i) => i === idx ? updated : s))
  }

  const removeSplit = (idx) => {
    setSplits(splits.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return alert('Give your routine a name')
    if (splits.length === 0) return alert('Add at least one split')
    const emptySplit = splits.find(s => !s.name.trim() || s.exercises.length === 0)
    if (emptySplit) return alert('Each split needs a name and at least one exercise')

    onSave({
      id: initial?.id || generateId(),
      name: trimmed,
      splits,
      createdAt: initial?.createdAt || Date.now()
    })
  }

  return (
    <div className="routine-editor">
      <div className="editor-header">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>← Back</button>
        <button className="btn btn-success btn-sm" onClick={handleSave}>Save</button>
      </div>

      <input
        type="text"
        className="routine-name-input"
        placeholder="Routine name (e.g. Push Pull Legs)"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />

      <div className="splits-list">
        {splits.map((split, idx) => (
          <SplitEditor
            key={split.id}
            split={split}
            exercises={exercises}
            onUpdate={(s) => updateSplit(idx, s)}
            onRemove={() => removeSplit(idx)}
          />
        ))}
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={addSplit}
        style={{ marginTop: '0.8rem' }}
      >
        + Add Split
      </button>
    </div>
  )
}

function RoutineCard({ routine, onEdit, onDelete }) {
  return (
    <div className="routine-card card">
      <div className="routine-card-header">
        <h3 className="routine-card-name">{routine.name}</h3>
        <div className="routine-card-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(routine)}>Edit</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(routine)}>Delete</button>
        </div>
      </div>
      <div className="routine-splits-preview">
        {routine.splits.map(split => (
          <div key={split.id} className="split-preview">
            <span className="split-preview-name">{split.name}</span>
            <span className="split-preview-count">{split.exercises.length} exercises</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Routines() {
  const { routines, saveRoutine, removeRoutine } = useRoutines()
  const [editing, setEditing] = useState(null) // null = list, 'new' = create, routine obj = edit

  const handleSave = async (routine) => {
    await saveRoutine(routine)
    setEditing(null)
  }

  const handleDelete = async (routine) => {
    if (!confirm(`Delete "${routine.name}"?`)) return
    await removeRoutine(routine.id)
  }

  if (editing !== null) {
    return (
      <div className="page">
        <RoutineEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="routines-header">
        <h1 className="page-title">Routines</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          + Create
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <p>No routines yet. Create one to quickly start workouts with pre-set exercises.</p>
        </div>
      ) : (
        <div className="routines-list">
          {routines.map(r => (
            <RoutineCard
              key={r.id}
              routine={r}
              onEdit={(routine) => setEditing(routine)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
