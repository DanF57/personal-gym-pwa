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
      id: crypto.randomUUID(),
      name: ex.name,
      category: ex.category,
      isCustom: false,
      createdAt: Date.now()
    })
  }
}
