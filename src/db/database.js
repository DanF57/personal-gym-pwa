import { openDB } from 'idb'

const DB_NAME = 'gym-tracker-db'
const DB_VERSION = 1

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('exercises')) {
        const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' })
        exerciseStore.createIndex('category', 'category')
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
        sessionStore.createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
  })
}

// Exercises
export async function getAllExercises() {
  const db = await getDB()
  return db.getAll('exercises')
}

export async function addExercise(exercise) {
  const db = await getDB()
  return db.put('exercises', exercise)
}

export async function deleteExercise(id) {
  const db = await getDB()
  return db.delete('exercises', id)
}

// Sessions
export async function getAllSessions() {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  return sessions.sort((a, b) => b.date - a.date)
}

export async function getSession(id) {
  const db = await getDB()
  return db.get('sessions', id)
}

export async function addSession(session) {
  const db = await getDB()
  return db.put('sessions', session)
}

export async function deleteSession(id) {
  const db = await getDB()
  return db.delete('sessions', id)
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
