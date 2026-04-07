import { useState, useEffect, useCallback } from 'react'
import {
  getAllSessions,
  getSession as dbGet,
  addSession as dbAdd,
  deleteSession as dbDelete
} from '../db/database'

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await getAllSessions()
    setSessions(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveSession = useCallback(async (session) => {
    await dbAdd(session)
    await load()
  }, [load])

  const removeSession = useCallback(async (id) => {
    await dbDelete(id)
    await load()
  }, [load])

  const getSessionById = useCallback(async (id) => {
    return dbGet(id)
  }, [])

  return { sessions, loading, saveSession, removeSession, getSessionById, reload: load }
}
