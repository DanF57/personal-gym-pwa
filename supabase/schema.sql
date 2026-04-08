-- =============================================================
-- Gym Tracker - Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- Exercises table
create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null,
  is_custom boolean default true,
  deleted boolean default false,
  created_at bigint not null,
  updated_at bigint not null
);

-- Sessions table (entries stored as JSONB array)
create table if not exists public.sessions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date bigint not null,
  duration_minutes integer,
  notes text default '',
  entries jsonb not null default '[]',
  deleted boolean default false,
  created_at bigint not null,
  updated_at bigint not null
);

-- Indexes for performance
create index if not exists idx_exercises_user on public.exercises(user_id);
create index if not exists idx_exercises_updated on public.exercises(updated_at);
create index if not exists idx_sessions_user on public.sessions(user_id);
create index if not exists idx_sessions_updated on public.sessions(updated_at);
create index if not exists idx_sessions_date on public.sessions(date);

-- =============================================================
-- Row Level Security (RLS)
-- Each user can only read/write their own data
-- =============================================================

alter table public.exercises enable row level security;
alter table public.sessions enable row level security;

-- Exercises: users can do everything with their own rows
create policy "Users manage own exercises"
  on public.exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sessions: users can do everything with their own rows
create policy "Users manage own sessions"
  on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
