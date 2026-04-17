import { supabase } from '../lib/supabase'
import {
  getUnsyncedExercises,
  getUnsyncedSessions,
  getUnsyncedRoutines,
  markExercisesSynced,
  markSessionsSynced,
  markRoutinesSynced,
  putExerciseRaw,
  putSessionRaw,
  putRoutineRaw,
  getAllExercisesIncludeDeleted,
  getAllSessionsIncludeDeleted,
  getAllRoutinesIncludeDeleted,
  getSetting,
  putSetting
} from './database'
import { setSyncStatus } from './syncStatus'

let syncing = false
let retryTimeout = null
let realtimeChannel = null
const MAX_RETRIES = 3
const RETRY_DELAY = 10_000

// ─── Main sync entry point ──────────────────────────────────

export async function syncAll(attempt = 0) {
  if (syncing) return
  if (!navigator.onLine) {
    setSyncStatus({ status: 'offline' })
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  syncing = true
  setSyncStatus({ status: 'syncing', error: null })

  let failed = false

  try {
    await pushExercises(session.user.id)
    await pushSessions(session.user.id)
    await pushRoutines(session.user.id)
    await pullExercises()
    await pullSessions()
    await pullRoutines()
    const now = Date.now()
    await putSetting('lastSyncAt', now)
    setSyncStatus({ status: 'synced', lastSyncedAt: now, error: null })
  } catch (err) {
    console.error(`Sync error (attempt ${attempt + 1}):`, err)
    failed = true
    setSyncStatus({ status: 'error', error: err.message })
  } finally {
    syncing = false
  }

  if (failed && attempt < MAX_RETRIES) {
    const delay = RETRY_DELAY * Math.pow(2, attempt)
    clearTimeout(retryTimeout)
    retryTimeout = setTimeout(() => syncAll(attempt + 1), delay)
  }
}

// ─── Push local changes to Supabase ─────────────────────────

async function pushExercises(userId) {
  const unsynced = await getUnsyncedExercises()
  if (unsynced.length === 0) return

  const rows = unsynced.map(e => ({
    id: e.id,
    user_id: userId,
    name: e.name,
    category: e.category,
    is_custom: e.isCustom ?? false,
    deleted: e.deleted ?? false,
    created_at: e.createdAt,
    updated_at: e.updatedAt
    // server_updated_at is set by the Postgres trigger, never by the client
  }))

  const { error } = await supabase
    .from('exercises')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`Push exercises: ${error.message}`)

  await markExercisesSynced(unsynced.map(e => e.id))
}

async function pushSessions(userId) {
  const unsynced = await getUnsyncedSessions()
  if (unsynced.length === 0) return

  const rows = unsynced.map(s => ({
    id: s.id,
    user_id: userId,
    date: s.date,
    duration_minutes: s.durationMinutes,
    notes: s.notes || '',
    entries: s.entries,
    deleted: s.deleted ?? false,
    created_at: s.createdAt,
    updated_at: s.updatedAt
  }))

  const { error } = await supabase
    .from('sessions')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`Push sessions: ${error.message}`)

  await markSessionsSynced(unsynced.map(s => s.id))
}

// ─── Pull remote changes (uses server_updated_at for ordering) ──

async function pullExercises() {
  const lastPull = (await getSetting('lastPullExercises')) || 0

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .gt('server_updated_at', lastPull)
    .order('server_updated_at', { ascending: true })

  if (error) throw new Error(`Pull exercises: ${error.message}`)

  const localAll = await getAllExercisesIncludeDeleted()
  const localMap = new Map(localAll.map(e => [e.id, e]))

  for (const row of data) {
    const local = localMap.get(row.id)

    // Skip if local has unsynced changes — they'll be pushed on the next cycle
    if (local && (!local.syncedAt || local.updatedAt > local.syncedAt)) {
      continue
    }

    await putExerciseRaw({
      id: row.id,
      name: row.name,
      category: row.category,
      isCustom: row.is_custom,
      deleted: row.deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverUpdatedAt: row.server_updated_at,
      syncedAt: Date.now()
    })
  }

  if (data.length > 0) {
    await putSetting('lastPullExercises', data[data.length - 1].server_updated_at)
  }

  // Self-heal: soft-delete any local duplicates (same name, different ID).
  // Keeps the one referenced in sessions; if tied, keeps most recently updated.
  // Deletions get pushed to Supabase on next push cycle, cleaning it up there too.
  await deduplicateLocalExercises()
}

async function deduplicateLocalExercises() {
  const allLocal = await getAllExercisesIncludeDeleted()
  const active = allLocal.filter(e => !e.deleted)

  // Build map: name → [exercises]
  const byName = new Map()
  for (const ex of active) {
    const key = ex.name.toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(ex)
  }

  // Collect IDs used in sessions
  const allSessions = await getAllSessionsIncludeDeleted()
  const usedIds = new Set()
  for (const session of allSessions) {
    if (session.deleted) continue
    for (const entry of session.entries || []) {
      if (entry.exerciseId) usedIds.add(entry.exerciseId)
    }
  }

  for (const [, group] of byName) {
    if (group.length <= 1) continue

    // Sort: exercises used in sessions first, then by most recently updated
    const sorted = [...group].sort((a, b) => {
      const aUsed = usedIds.has(a.id) ? 1 : 0
      const bUsed = usedIds.has(b.id) ? 1 : 0
      if (bUsed !== aUsed) return bUsed - aUsed
      return b.updatedAt - a.updatedAt
    })

    const [keeper, ...remove] = sorted
    const removeIds = new Set(remove.map(e => e.id))

    // Remap session entries that reference removed IDs → keeper ID
    for (const session of allSessions) {
      let changed = false
      const updatedEntries = (session.entries || []).map(entry => {
        if (removeIds.has(entry.exerciseId)) {
          changed = true
          return { ...entry, exerciseId: keeper.id }
        }
        return entry
      })
      if (changed) {
        await putSessionRaw({
          ...session,
          entries: updatedEntries,
          updatedAt: Date.now(),
          syncedAt: null
        })
      }
    }

    // Soft-delete duplicates (syncedAt: null triggers push on next cycle)
    for (const ex of remove) {
      await putExerciseRaw({
        ...ex,
        deleted: true,
        updatedAt: Date.now(),
        syncedAt: null
      })
    }
  }
}

async function pullSessions() {
  const lastPull = (await getSetting('lastPullSessions')) || 0

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gt('server_updated_at', lastPull)
    .order('server_updated_at', { ascending: true })

  if (error) throw new Error(`Pull sessions: ${error.message}`)

  const localAll = await getAllSessionsIncludeDeleted()
  const localMap = new Map(localAll.map(s => [s.id, s]))

  for (const row of data) {
    const local = localMap.get(row.id)

    if (local && (!local.syncedAt || local.updatedAt > local.syncedAt)) {
      continue
    }

    await putSessionRaw({
      id: row.id,
      date: row.date,
      durationMinutes: row.duration_minutes,
      notes: row.notes,
      entries: row.entries,
      deleted: row.deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverUpdatedAt: row.server_updated_at,
      syncedAt: Date.now()
    })
  }

  if (data.length > 0) {
    await putSetting('lastPullSessions', data[data.length - 1].server_updated_at)
  }
}

// ─── Push/Pull routines ────────────────────────────────────

async function pushRoutines(userId) {
  const unsynced = await getUnsyncedRoutines()
  if (unsynced.length === 0) return

  const rows = unsynced.map(r => ({
    id: r.id,
    user_id: userId,
    name: r.name,
    splits: r.splits,
    deleted: r.deleted ?? false,
    created_at: r.createdAt,
    updated_at: r.updatedAt
  }))

  const { error } = await supabase
    .from('routines')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`Push routines: ${error.message}`)

  await markRoutinesSynced(unsynced.map(r => r.id))
}

async function pullRoutines() {
  const lastPull = (await getSetting('lastPullRoutines')) || 0

  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .gt('server_updated_at', lastPull)
    .order('server_updated_at', { ascending: true })

  if (error) throw new Error(`Pull routines: ${error.message}`)

  const localAll = await getAllRoutinesIncludeDeleted()
  const localMap = new Map(localAll.map(r => [r.id, r]))

  for (const row of data) {
    const local = localMap.get(row.id)
    if (local && (!local.syncedAt || local.updatedAt > local.syncedAt)) {
      continue
    }
    await putRoutineRaw({
      id: row.id,
      name: row.name,
      splits: row.splits,
      deleted: row.deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverUpdatedAt: row.server_updated_at,
      syncedAt: Date.now()
    })
  }

  if (data.length > 0) {
    await putSetting('lastPullRoutines', data[data.length - 1].server_updated_at)
  }
}

// ─── Handle a single Realtime change event ──────────────────

async function handleRealtimeChange(table, payload) {
  const row = payload.new

  if (table === 'exercises') {
    const local = await getAllExercisesIncludeDeleted()
    const existing = local.find(e => e.id === row.id)
    if (existing && (!existing.syncedAt || existing.updatedAt > existing.syncedAt)) {
      return // local has unsynced changes, skip
    }
    await putExerciseRaw({
      id: row.id,
      name: row.name,
      category: row.category,
      isCustom: row.is_custom,
      deleted: row.deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverUpdatedAt: row.server_updated_at,
      syncedAt: Date.now()
    })
    await putSetting('lastPullExercises', row.server_updated_at)
  }

  if (table === 'sessions') {
    const local = await getAllSessionsIncludeDeleted()
    const existing = local.find(s => s.id === row.id)
    if (existing && (!existing.syncedAt || existing.updatedAt > existing.syncedAt)) {
      return
    }
    await putSessionRaw({
      id: row.id,
      date: row.date,
      durationMinutes: row.duration_minutes,
      notes: row.notes,
      entries: row.entries,
      deleted: row.deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverUpdatedAt: row.server_updated_at,
      syncedAt: Date.now()
    })
    await putSetting('lastPullSessions', row.server_updated_at)
  }

  if (table === 'routines') {
    const local = await getAllRoutinesIncludeDeleted()
    const existing = local.find(r => r.id === row.id)
    if (existing && (!existing.syncedAt || existing.updatedAt > existing.syncedAt)) {
      return
    }
    await putRoutineRaw({
      id: row.id,
      name: row.name,
      splits: row.splits,
      deleted: row.deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverUpdatedAt: row.server_updated_at,
      syncedAt: Date.now()
    })
    await putSetting('lastPullRoutines', row.server_updated_at)
  }

  setSyncStatus({ status: 'synced', lastSyncedAt: Date.now(), error: null })
}

// ─── Realtime subscription ──────────────────────────────────

function subscribeRealtime() {
  if (realtimeChannel) return

  realtimeChannel = supabase
    .channel('sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exercises' },
      (payload) => handleRealtimeChange('exercises', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' },
      (payload) => handleRealtimeChange('sessions', payload)
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routines' },
      (payload) => handleRealtimeChange('routines', payload)
    )
    .subscribe()
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}

// ─── Auto-sync lifecycle ────────────────────────────────────

function onVisibilityChange() {
  if (document.visibilityState === 'visible') syncAll()
}

function onOnline() {
  // Push any offline changes when reconnecting
  syncAll()
}

export function startAutoSync() {
  syncAll()
  subscribeRealtime()

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

export function stopAutoSync() {
  clearTimeout(retryTimeout)
  unsubscribeRealtime()
  window.removeEventListener('online', onOnline)
  document.removeEventListener('visibilitychange', onVisibilityChange)
}
