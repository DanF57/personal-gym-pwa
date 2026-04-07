import { useState, useReducer, useEffect, useRef } from 'react'
import { useExercises } from '../hooks/useExercises'
import { useSessions } from '../hooks/useSessions'
import { generateId } from '../utils/id'
import Modal from '../components/Modal'
import './LogWorkout.css'

function workoutReducer(state, action) {
  switch (action.type) {
    case 'ADD_EXERCISE':
      return {
        ...state,
        entries: [...state.entries, {
          id: generateId(),
          exerciseId: action.exercise.id,
          exerciseName: action.exercise.name,
          sets: [{ id: generateId(), reps: '', weight: '', done: false }]
        }]
      }
    case 'REMOVE_EXERCISE':
      return {
        ...state,
        entries: state.entries.filter(e => e.id !== action.entryId)
      }
    case 'ADD_SET': {
      return {
        ...state,
        entries: state.entries.map(entry => {
          if (entry.id !== action.entryId) return entry
          const lastSet = entry.sets[entry.sets.length - 1]
          return {
            ...entry,
            sets: [...entry.sets, {
              id: generateId(),
              reps: lastSet?.reps || '',
              weight: lastSet?.weight || '',
              done: false
            }]
          }
        })
      }
    }
    case 'REMOVE_SET':
      return {
        ...state,
        entries: state.entries.map(entry => {
          if (entry.id !== action.entryId) return entry
          return {
            ...entry,
            sets: entry.sets.filter(s => s.id !== action.setId)
          }
        })
      }
    case 'UPDATE_SET':
      return {
        ...state,
        entries: state.entries.map(entry => {
          if (entry.id !== action.entryId) return entry
          return {
            ...entry,
            sets: entry.sets.map(set => {
              if (set.id !== action.setId) return set
              return { ...set, [action.field]: action.value }
            })
          }
        })
      }
    case 'TOGGLE_SET':
      return {
        ...state,
        entries: state.entries.map(entry => {
          if (entry.id !== action.entryId) return entry
          return {
            ...entry,
            sets: entry.sets.map(set => {
              if (set.id !== action.setId) return set
              return { ...set, done: !set.done }
            })
          }
        })
      }
    default:
      return state
  }
}

function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  const seconds = elapsed % 60
  const pad = n => String(n).padStart(2, '0')

  return (
    <span className="timer">
      {hours > 0 ? `${hours}:` : ''}{pad(minutes)}:{pad(seconds)}
    </span>
  )
}

function SetRow({ set, index, entryId, dispatch }) {
  return (
    <div className={`set-row ${set.done ? 'set-done' : ''}`}>
      <span className="set-number">{index + 1}</span>
      <input
        type="number"
        placeholder="0"
        value={set.weight}
        onChange={e => dispatch({ type: 'UPDATE_SET', entryId, setId: set.id, field: 'weight', value: e.target.value })}
        className="set-input weight-input"
        inputMode="decimal"
      />
      <span className="set-unit">kg</span>
      <span className="set-x">&times;</span>
      <input
        type="number"
        placeholder="0"
        value={set.reps}
        onChange={e => dispatch({ type: 'UPDATE_SET', entryId, setId: set.id, field: 'reps', value: e.target.value })}
        className="set-input reps-input"
        inputMode="numeric"
      />
      <span className="set-unit">reps</span>
      <button
        className={`set-check ${set.done ? 'checked' : ''}`}
        onClick={() => dispatch({ type: 'TOGGLE_SET', entryId, setId: set.id })}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <button
        className="set-delete"
        onClick={() => dispatch({ type: 'REMOVE_SET', entryId, setId: set.id })}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function ExerciseEntry({ entry, dispatch }) {
  return (
    <div className="exercise-entry card fade-in">
      <div className="exercise-entry-header">
        <h3 className="exercise-entry-name">{entry.exerciseName}</h3>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => dispatch({ type: 'REMOVE_EXERCISE', entryId: entry.id })}
        >
          Remove
        </button>
      </div>
      <div className="sets-header">
        <span className="sets-header-num">Set</span>
        <span className="sets-header-weight">Weight</span>
        <span></span>
        <span></span>
        <span className="sets-header-reps">Reps</span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      {entry.sets.map((set, i) => (
        <SetRow key={set.id} set={set} index={i} entryId={entry.id} dispatch={dispatch} />
      ))}
      <button
        className="btn btn-ghost btn-sm btn-full"
        onClick={() => dispatch({ type: 'ADD_SET', entryId: entry.id })}
        style={{ marginTop: '0.5rem' }}
      >
        + Add Set
      </button>
    </div>
  )
}

export default function LogWorkout() {
  const [active, setActive] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [workout, dispatch] = useReducer(workoutReducer, { entries: [] })
  const { exercises } = useExercises()
  const { saveSession } = useSessions()
  const searchRef = useRef(null)

  const startWorkout = () => {
    setActive(true)
    setStartTime(Date.now())
  }

  const cancelWorkout = () => {
    if (workout.entries.length > 0 && !confirm('Discard this workout?')) return
    setActive(false)
    setStartTime(null)
    dispatch({ type: 'RESET' })
    window.location.reload()
  }

  const finishWorkout = async () => {
    const validEntries = workout.entries
      .map(entry => ({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        sets: entry.sets
          .filter(s => s.done && s.weight && s.reps)
          .map(s => ({
            reps: Number(s.reps),
            weight: Number(s.weight),
            unit: 'kg'
          }))
      }))
      .filter(entry => entry.sets.length > 0)

    if (validEntries.length === 0) {
      alert('Complete at least one set before finishing!')
      return
    }

    const durationMinutes = Math.round((Date.now() - startTime) / 60000)

    await saveSession({
      id: generateId(),
      date: startTime,
      durationMinutes,
      notes: '',
      entries: validEntries,
      createdAt: startTime,
      updatedAt: Date.now()
    })

    setActive(false)
    setStartTime(null)
    window.location.reload()
  }

  const selectExercise = (exercise) => {
    dispatch({ type: 'ADD_EXERCISE', exercise })
    setPickerOpen(false)
    setSearch('')
  }

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  )

  const groupedExercises = filteredExercises.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = []
    acc[ex.category].push(ex)
    return acc
  }, {})

  useEffect(() => {
    if (pickerOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [pickerOpen])

  if (!active) {
    return (
      <div className="page">
        <div className="start-workout-container">
          <div className="start-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 6.5h11M6.5 17.5h11M2 12h4M18 12h4M6 6.5v11M18 6.5v11" />
            </svg>
          </div>
          <h1 className="start-title">Ready to Train?</h1>
          <p className="start-subtitle">Start a new workout to track your exercises, sets, and progress.</p>
          <button className="btn btn-primary btn-lg" onClick={startWorkout}>
            Start Workout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="workout-header">
        <div>
          <h1 className="page-title">Workout</h1>
          <Timer startTime={startTime} />
        </div>
        <div className="workout-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={cancelWorkout}>Cancel</button>
          <button className="btn btn-success btn-sm" onClick={finishWorkout}>Finish</button>
        </div>
      </div>

      <div className="entries-list">
        {workout.entries.map(entry => (
          <ExerciseEntry key={entry.id} entry={entry} dispatch={dispatch} />
        ))}
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={() => setPickerOpen(true)}
        style={{ marginTop: '1rem' }}
      >
        + Add Exercise
      </button>

      <Modal open={pickerOpen} onClose={() => { setPickerOpen(false); setSearch('') }} title="Choose Exercise">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="exercise-search"
        />
        <div className="exercise-picker-list">
          {Object.entries(groupedExercises).map(([category, exs]) => (
            <div key={category}>
              <h4 className="picker-category">{category}</h4>
              {exs.map(ex => (
                <button
                  key={ex.id}
                  className="picker-exercise"
                  onClick={() => selectExercise(ex)}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          ))}
          {filteredExercises.length === 0 && (
            <p className="empty-state" style={{ padding: '2rem' }}>No exercises found</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
