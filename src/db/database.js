import { openDB } from 'idb'

const DB_NAME = 'gym-tracker-db'
const DB_VERSION = 2

let dbInstance = null

function getDB() {
  if (!dbInstance) {
    dbInstance = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' })
          exerciseStore.createIndex('category', 'category')
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
          sessionStore.createIndex('date', 'date')
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      }
    })
  }
  return dbInstance
}

// Exercises
export async function getAllExercises() {
  const db = await getDB()
  const all = await db.getAll('exercises')
  return all.filter(e => !e.deleted)
}

export async function getAllExercisesIncludeDeleted() {
  const db = await getDB()
  return db.getAll('exercises')
}

export async function addExercise(exercise) {
  const db = await getDB()
  const record = {
    ...exercise,
    updatedAt: Date.now(),
    syncedAt: null,
    deleted: false
  }
  return db.put('exercises', record)
}

export async function deleteExercise(id) {
  const db = await getDB()
  const existing = await db.get('exercises', id)
  if (existing) {
    // Soft delete for sync
    existing.deleted = true
    existing.updatedAt = Date.now()
    existing.syncedAt = null
    return db.put('exercises', existing)
  }
}

export async function putExerciseRaw(exercise) {
  const db = await getDB()
  return db.put('exercises', exercise)
}

// Sessions
export async function getAllSessions() {
  const db = await getDB()
  const all = await db.getAll('sessions')
  return all.filter(s => !s.deleted).sort((a, b) => b.date - a.date)
}

export async function getAllSessionsIncludeDeleted() {
  const db = await getDB()
  return db.getAll('sessions')
}

export async function getSession(id) {
  const db = await getDB()
  const session = await db.get('sessions', id)
  return session?.deleted ? null : session
}

export async function addSession(session) {
  const db = await getDB()
  const record = {
    ...session,
    updatedAt: Date.now(),
    syncedAt: null,
    deleted: false
  }
  return db.put('sessions', record)
}

export async function deleteSession(id) {
  const db = await getDB()
  const existing = await db.get('sessions', id)
  if (existing) {
    existing.deleted = true
    existing.updatedAt = Date.now()
    existing.syncedAt = null
    return db.put('sessions', existing)
  }
}

export async function putSessionRaw(session) {
  const db = await getDB()
  return db.put('sessions', session)
}

// Settings
export async function getSetting(key) {
  const db = await getDB()
  const entry = await db.get('settings', key)
  return entry?.value
}

export async function putSetting(key, value) {
  const db = await getDB()
  return db.put('settings', { key, value })
}

// Sync helpers
export async function getUnsyncedExercises() {
  const all = await getAllExercisesIncludeDeleted()
  return all.filter(e => !e.syncedAt || e.updatedAt > e.syncedAt)
}

export async function getUnsyncedSessions() {
  const all = await getAllSessionsIncludeDeleted()
  return all.filter(s => !s.syncedAt || s.updatedAt > s.syncedAt)
}

export async function markExercisesSynced(ids) {
  const db = await getDB()
  const tx = db.transaction('exercises', 'readwrite')
  const store = tx.objectStore('exercises')
  const now = Date.now()
  for (const id of ids) {
    const record = await store.get(id)
    if (record) {
      record.syncedAt = now
      await store.put(record)
    }
  }
  await tx.done
}

export async function markSessionsSynced(ids) {
  const db = await getDB()
  const tx = db.transaction('sessions', 'readwrite')
  const store = tx.objectStore('sessions')
  const now = Date.now()
  for (const id of ids) {
    const record = await store.get(id)
    if (record) {
      record.syncedAt = now
      await store.put(record)
    }
  }
  await tx.done
}
