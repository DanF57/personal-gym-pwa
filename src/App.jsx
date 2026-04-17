import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import LogWorkout from './pages/LogWorkout'
import SessionHistory from './pages/SessionHistory'
import SessionDetail from './pages/SessionDetail'
import Progress from './pages/Progress'
import ExerciseLibrary from './pages/ExerciseLibrary'
import Routines from './pages/Routines'
import { seedExercises } from './db/seed'
import { syncAll, startAutoSync, stopAutoSync } from './db/sync'
import './App.css'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (user) {
      // Sync first (pulls existing exercises from cloud), then seed if empty
      syncAll()
        .catch(() => {})
        .finally(() => seedExercises(user.id))
        .then(() => {
          setReady(true)
          startAutoSync()
        })

      return () => stopAutoSync()
    }
  }, [user])

  if (loading) return null

  if (!user) return <Login />

  if (!ready) return null

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LogWorkout />} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/history" element={<SessionHistory />} />
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/exercises" element={<ExerciseLibrary />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
