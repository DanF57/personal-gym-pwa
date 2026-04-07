// Epley formula for estimated 1RM
export function estimated1RM(weight, reps) {
  if (reps === 1) return weight
  if (reps === 0 || weight === 0) return 0
  return weight * (1 + reps / 30)
}

// Total volume for a single entry (exercise in a session)
export function entryVolume(entry) {
  return entry.sets.reduce((total, set) => {
    return total + (set.weight || 0) * (set.reps || 0)
  }, 0)
}

// Total volume for an entire session
export function sessionVolume(session) {
  return session.entries.reduce((total, entry) => {
    return total + entryVolume(entry)
  }, 0)
}

// Best set in an entry (highest estimated 1RM)
export function bestSet(entry) {
  let best = null
  let bestE1RM = 0
  for (const set of entry.sets) {
    const e1rm = estimated1RM(set.weight || 0, set.reps || 0)
    if (e1rm > bestE1RM) {
      bestE1RM = e1rm
      best = set
    }
  }
  return best
}

// Heaviest weight in an entry
export function heaviestWeight(entry) {
  return Math.max(...entry.sets.map(s => s.weight || 0))
}

// Get all entries for a specific exercise across all sessions
export function getExerciseHistory(sessions, exerciseId) {
  const history = []
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.exerciseId === exerciseId) {
        history.push({
          date: session.date,
          sessionId: session.id,
          entry
        })
      }
    }
  }
  return history.sort((a, b) => a.date - b.date)
}
