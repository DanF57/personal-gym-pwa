import { useState, useEffect, useCallback } from 'react'
import { getAllExercises, addExercise as dbAdd, deleteExercise as dbDelete } from '../db/database'
import { generateId } from '../utils/id'

export function useExercises() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await getAllExercises()
    data.sort((a, b) => a.name.localeCompare(b.name))
    setExercises(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addExercise = useCallback(async (name, category) => {
    const exercise = {
      id: generateId(),
      name,
      category,
      isCustom: true,
      createdAt: Date.now()
    }
    await dbAdd(exercise)
    await load()
    return exercise
  }, [load])

  const removeExercise = useCallback(async (id) => {
    await dbDelete(id)
    await load()
  }, [load])

  return { exercises, loading, addExercise, removeExercise, reload: load }
}
