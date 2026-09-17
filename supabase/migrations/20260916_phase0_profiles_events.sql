-- Phase 0: learner profiles and the append-only event log (PRD 10.4, F-AC-3).

-- ── 1. profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  settings jsonb not null default '{}'::jsonb
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: own row select" on public.profiles;
create policy "profiles: own row select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: own row update" on public.profiles;
create policy "profiles: own row update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── 2. events (append-only) ─────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  device_day date not null,
  created_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists events_user_created_idx on public.events (user_id, created_at);
alter table public.events enable row level security;
drop policy if exists "events: own rows select" on public.events;
create policy "events: own rows select" on public.events for select using (auth.uid() = user_id);
drop policy if exists "events: own rows insert" on public.events;
create policy "events: own rows insert" on public.events for insert with check (auth.uid() = user_id);
-- No update or delete policies: the log is append-only for clients. Account deletion cascades from auth.users.

-- ── 3. grants ───────────────────────────────────────────────────────────────
grant select, update on public.profiles to authenticated;
grant select, insert on public.events to authenticated;
revoke all on public.profiles from anon;
revoke all on public.events from anon;
