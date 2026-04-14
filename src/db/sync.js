import { supabase } from '../lib/supabase'
import {
  getUnsyncedExercises,
  getUnsyncedSessions,
  markExercisesSynced,
  markSessionsSynced,
  putExerciseRaw,
  putSessionRaw,
  getAllExercisesIncludeDeleted,
  getAllSessionsIncludeDeleted,
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
    await pullExercises()
    await pullSessions()
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
