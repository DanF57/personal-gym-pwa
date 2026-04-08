import { useState, useEffect } from 'react'
import { getSyncStatus, subscribeSyncStatus } from '../db/syncStatus'

export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus)

  useEffect(() => {
    return subscribeSyncStatus(setStatus)
  }, [])

  return status
}
