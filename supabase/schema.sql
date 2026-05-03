-- =============================================================
-- Gym Tracker - Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- Exercises table
-- user_id is nullable: NULL = catalog exercise (admin-managed, shared across all users)
--                      non-null = user-owned exercise (legacy, no longer created via UI)
create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  is_custom boolean default false,
  deleted boolean default false,
  created_at bigint not null,
  updated_at bigint not null,
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

-- Exercises: all authenticated users can read the catalog (user_id IS NULL)
create policy "Users read catalog exercises"
  on public.exercises
  for select
  using (user_id is null);

-- Exercises: users can manage their own exercises (legacy sync edge cases)
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

-- Routines table (splits stored as JSONB array)
create table if not exists public.routines (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  splits jsonb not null default '[]',
  deleted boolean default false,
  created_at bigint not null,
  updated_at bigint not null,
  server_updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create or replace trigger routines_server_ts
  before insert or update on public.routines
  for each row execute function set_server_updated_at();

create index if not exists idx_routines_user on public.routines(user_id);
create index if not exists idx_routines_server_updated on public.routines(server_updated_at);

alter table public.routines enable row level security;

create policy "Users manage own routines"
  on public.routines
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- Trigger: remove soft-deleted exercises from routines
-- Fires after an exercise is soft-deleted (deleted flips to true).
-- Strips that exerciseId from every split's exercises array in all
-- non-deleted routines belonging to the same user.
-- =============================================================

create or replace function public.remove_deleted_exercise_from_routines()
returns trigger as $$
begin
  if (old.deleted is distinct from true) and new.deleted = true then
    update public.routines r
    set splits = (
      select jsonb_agg(
        jsonb_set(
          split_elem,
          '{exercises}',
          coalesce(
            (
              select jsonb_agg(ex)
              from jsonb_array_elements(split_elem -> 'exercises') as ex
              where ex ->> 'exerciseId' != new.id::text
            ),
            '[]'::jsonb
          )
        )
      )
      from jsonb_array_elements(r.splits) as split_elem
    )
    where r.user_id = new.user_id
      and r.deleted = false;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace trigger exercises_cleanup_routines
  after update on public.exercises
  for each row execute function public.remove_deleted_exercise_from_routines();

-- =============================================================
-- Enable Realtime for all tables
-- =============================================================

alter publication supabase_realtime add table public.exercises;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.routines;
