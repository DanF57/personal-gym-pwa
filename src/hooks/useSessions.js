import { useState, useEffect, useCallback } from 'react'
import {
  getAllSessions,
  getSession as dbGet,
  addSession as dbAdd,
  updateSession as dbUpdate,
  deleteSession as dbDelete
} from '../db/database'
import { syncAll } from '../db/sync'

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
    syncAll()
  }, [load])

  const updateSession = useCallback(async (id, changes) => {
    await dbUpdate(id, changes)
    await load()
    syncAll()
  }, [load])

  const removeSession = useCallback(async (id) => {
    await dbDelete(id)
    await load()
    syncAll()
  }, [load])

  const getSessionById = useCallback(async (id) => {
    return dbGet(id)
  }, [])

  return { sessions, loading, saveSession, updateSession, removeSession, getSessionById, reload: load }
}
