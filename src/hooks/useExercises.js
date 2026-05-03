import { useState, useEffect, useCallback } from 'react'
import { getAllExercises } from '../db/database'

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

  return { exercises, loading, reload: load }
}
