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

let syncing = false
let retryTimeout = null
const MAX_RETRIES = 3
const RETRY_DELAY = 10_000 // 10 seconds

export async function syncAll(attempt = 0) {
  if (syncing) return
  if (!navigator.onLine) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  syncing = true
  let failed = false

  try {
    await pushExercises(session.user.id)
    await pushSessions(session.user.id)
    await pullExercises()
    await pullSessions()
    await putSetting('lastSyncAt', Date.now())
  } catch (err) {
    console.error(`Sync error (attempt ${attempt + 1}):`, err)
    failed = true
  } finally {
    syncing = false
  }

  // Retry on failure with backoff
  if (failed && attempt < MAX_RETRIES) {
    const delay = RETRY_DELAY * Math.pow(2, attempt) // 10s, 20s, 40s
    console.log(`Retrying sync in ${delay / 1000}s...`)
    clearTimeout(retryTimeout)
    retryTimeout = setTimeout(() => syncAll(attempt + 1), delay)
  }
}

// --- Push local changes to Supabase ---

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

// --- Pull remote changes into IndexedDB (timestamp-safe) ---

async function pullExercises() {
  const lastPull = (await getSetting('lastPullExercises')) || 0

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .gt('updated_at', lastPull)
    .order('updated_at', { ascending: true })

  if (error) throw new Error(`Pull exercises: ${error.message}`)

  // Build a map of local records for timestamp comparison
  const localAll = await getAllExercisesIncludeDeleted()
  const localMap = new Map(localAll.map(e => [e.id, e]))

  for (const row of data) {
    const local = localMap.get(row.id)

    // Skip if local version is newer (edited offline while remote was also updated)
    if (local && local.updatedAt > row.updated_at && (!local.syncedAt || local.updatedAt > local.syncedAt)) {
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
      syncedAt: Date.now()
    })
  }

  if (data.length > 0) {
    await putSetting('lastPullExercises', data[data.length - 1].updated_at)
  }
}

async function pullSessions() {
  const lastPull = (await getSetting('lastPullSessions')) || 0

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gt('updated_at', lastPull)
    .order('updated_at', { ascending: true })

  if (error) throw new Error(`Pull sessions: ${error.message}`)

  // Build a map of local records for timestamp comparison
  const localAll = await getAllSessionsIncludeDeleted()
  const localMap = new Map(localAll.map(s => [s.id, s]))

  for (const row of data) {
    const local = localMap.get(row.id)

    // Skip if local version is newer (edited offline while remote was also updated)
    if (local && local.updatedAt > row.updated_at && (!local.syncedAt || local.updatedAt > local.syncedAt)) {
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
      syncedAt: Date.now()
    })
  }

  if (data.length > 0) {
    await putSetting('lastPullSessions', data[data.length - 1].updated_at)
  }
}

// --- Auto-sync setup ---

let syncInterval = null

function onVisibilityChange() {
  if (document.visibilityState === 'visible') syncAll()
}

export function startAutoSync() {
  syncAll()

  syncInterval = setInterval(syncAll, 5 * 60 * 1000)

  window.addEventListener('online', syncAll)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  clearTimeout(retryTimeout)
  window.removeEventListener('online', syncAll)
  document.removeEventListener('visibilitychange', onVisibilityChange)
}
