import { getAllExercises, addExercise } from './database'

const DEFAULT_EXERCISES = [
  // Push
  { name: 'Bench Press', category: 'push' },
  { name: 'Incline Bench Press', category: 'push' },
  { name: 'Overhead Press', category: 'push' },
  { name: 'Dumbbell Shoulder Press', category: 'push' },
  { name: 'Dumbbell Chest Fly', category: 'push' },
  { name: 'Tricep Pushdown', category: 'push' },
  { name: 'Dips', category: 'push' },
  // Pull
  { name: 'Deadlift', category: 'pull' },
  { name: 'Barbell Row', category: 'pull' },
  { name: 'Pull-up', category: 'pull' },
  { name: 'Chin-up', category: 'pull' },
  { name: 'Lat Pulldown', category: 'pull' },
  { name: 'Seated Cable Row', category: 'pull' },
  { name: 'Face Pull', category: 'pull' },
  { name: 'Barbell Curl', category: 'pull' },
  { name: 'Dumbbell Curl', category: 'pull' },
  // Legs
  { name: 'Squat', category: 'legs' },
  { name: 'Front Squat', category: 'legs' },
  { name: 'Leg Press', category: 'legs' },
  { name: 'Romanian Deadlift', category: 'legs' },
  { name: 'Leg Curl', category: 'legs' },
  { name: 'Leg Extension', category: 'legs' },
  { name: 'Calf Raise', category: 'legs' },
  { name: 'Bulgarian Split Squat', category: 'legs' },
  { name: 'Hip Thrust', category: 'legs' },
  // Core
  { name: 'Plank', category: 'core' },
  { name: 'Cable Crunch', category: 'core' },
  { name: 'Hanging Leg Raise', category: 'core' },
  { name: 'Ab Wheel Rollout', category: 'core' },
  // Cardio
  { name: 'Treadmill Run', category: 'cardio' },
  { name: 'Rowing Machine', category: 'cardio' },
  { name: 'Cycling', category: 'cardio' },
]

// Generate a deterministic UUID from exercise name so seeding
// on different devices/sessions always produces the same IDs.
// This prevents duplicates when sync pulls old records after a logout.
async function deterministicId(name) {
  const data = new TextEncoder().encode(`gym-tracker-exercise:${name.toLowerCase()}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')
}

let seedPromise = null

export function seedExercises() {
  if (!seedPromise) {
    seedPromise = doSeed()
  }
  return seedPromise
}

async function doSeed() {
  const existing = await getAllExercises()
  if (existing.length > 0) return

  for (const ex of DEFAULT_EXERCISES) {
    await addExercise({
      id: await deterministicId(ex.name),
      name: ex.name,
      category: ex.category,
      isCustom: false,
      createdAt: Date.now()
    })
  }
}
