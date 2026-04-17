import { useState, useEffect, useCallback } from 'react'
import {
  getAllRoutines,
  addRoutine as dbAdd,
  deleteRoutine as dbDelete
} from '../db/database'
import { syncAll } from '../db/sync'

export function useRoutines() {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await getAllRoutines()
    setRoutines(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveRoutine = useCallback(async (routine) => {
    await dbAdd(routine)
    await load()
    syncAll()
  }, [load])

  const removeRoutine = useCallback(async (id) => {
    await dbDelete(id)
    await load()
    syncAll()
  }, [load])

  return { routines, loading, saveRoutine, removeRoutine, reload: load }
}
