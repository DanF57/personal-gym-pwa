// Lightweight pub/sub for sync status — decoupled from React

// States: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
let current = {
  status: navigator.onLine ? 'idle' : 'offline',
  lastSyncedAt: null,
  error: null
}

const listeners = new Set()

export function getSyncStatus() {
  return current
}

export function setSyncStatus(update) {
  current = { ...current, ...update }
  listeners.forEach(fn => fn(current))
}

export function subscribeSyncStatus(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Track online/offline automatically
window.addEventListener('online', () => {
  if (current.status === 'offline') {
    setSyncStatus({ status: 'idle' })
  }
})

window.addEventListener('offline', () => {
  setSyncStatus({ status: 'offline', error: null })
})
