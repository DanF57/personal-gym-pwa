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
  updated_at bigint not null,
  -- Server-managed timestamp for reliable sync ordering (not client clock)
  server_updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
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
  updated_at bigint not null,
  -- Server-managed timestamp for reliable sync ordering (not client clock)
  server_updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Trigger function: auto-set server_updated_at on every insert/update
create or replace function set_server_updated_at()
returns trigger as $$
begin
  new.server_updated_at := (extract(epoch from now()) * 1000)::bigint;
  return new;
end;
$$ language plpgsql;

create or replace trigger exercises_server_ts
  before insert or update on public.exercises
  for each row execute function set_server_updated_at();

create or replace trigger sessions_server_ts
  before insert or update on public.sessions
  for each row execute function set_server_updated_at();

-- Indexes for performance
create index if not exists idx_exercises_user on public.exercises(user_id);
create index if not exists idx_exercises_server_updated on public.exercises(server_updated_at);
create index if not exists idx_sessions_user on public.sessions(user_id);
create index if not exists idx_sessions_server_updated on public.sessions(server_updated_at);
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

-- =============================================================
-- Enable Realtime for both tables
-- =============================================================

alter publication supabase_realtime add table public.exercises;
alter publication supabase_realtime add table public.sessions;
