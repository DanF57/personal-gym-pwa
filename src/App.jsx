import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LogWorkout from './pages/LogWorkout'
import SessionHistory from './pages/SessionHistory'
import SessionDetail from './pages/SessionDetail'
import Progress from './pages/Progress'
import ExerciseLibrary from './pages/ExerciseLibrary'
import { seedExercises } from './db/seed'
import './App.css'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedExercises().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LogWorkout />} />
          <Route path="/history" element={<SessionHistory />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
