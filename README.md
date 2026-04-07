# Gym Tracker

Personal gym workout tracker built as a Progressive Web App. All data lives locally in the browser via IndexedDB — no backend, no accounts.

## Data Model

Three IndexedDB stores power the app:

**`exercises`** — The exercise library. Each exercise has an `id`, `name`, `category` (push/pull/legs/core/cardio), and `isCustom` flag. Seeded with 32 default exercises on first launch. Users can add custom exercises.

**`sessions`** — Completed workouts. Each session contains:
- `date` and `durationMinutes` for when/how long
- `entries[]` — one per exercise performed, each holding:
  - `exerciseId` and `exerciseName` (denormalized so history survives exercise deletion)
  - `sets[]` — each with `reps`, `weight`, and `unit`

**`settings`** — Key-value pairs for user preferences (e.g. weight unit).

## Data Flow

```
exercises store ──> useExercises hook ──> Exercise picker (LogWorkout)
                                     ──> Exercise Library page
                                     ──> Progress page (dropdown)

sessions store  ──> useSessions hook  ──> Session History (list)
                                     ──> Session Detail (single view)
                                     ──> Progress page (charts)
```

- **Logging a workout** reads from `exercises` (to pick which exercises to perform) and writes to `sessions` (on finish). Only sets marked as "done" with valid weight/reps are saved.
- **Progress charts** query all sessions, filter entries matching the selected `exerciseId`, then compute per-session best weight, estimated 1RM (Epley formula), and total volume.
- **Exercise names are denormalized** into session entries at save time. This means session history always displays correctly even if an exercise is later renamed or deleted.

## Features

- **Log Workout** — Live timer, add exercises from searchable picker, log sets with weight/reps, confirm each set with a checkmark
- **Session History** — Reverse-chronological list with exercise count, total sets, and volume per session. Tap to view full breakdown with estimated 1RM per set.
- **Progress** — Per-exercise line charts for weight and estimated 1RM over time, volume per session, with date range filters (30d/90d/1y/all) and stats cards
- **Exercise Library** — Grouped by category, search, add custom exercises, session count badges

## Running

```
npm install
npm run dev
```

## Tech

React 19, Vite, IndexedDB (via `idb`), Chart.js, React Router, date-fns. PWA via `vite-plugin-pwa`.
