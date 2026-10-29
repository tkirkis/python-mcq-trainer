-- PyQuiz sync backend. Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Append-only event log: one row per study event (answer, mock result, setting change...).
-- Merge = union of rows; nothing is ever updated or deleted by the app.

create table if not exists public.events (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,              -- globally unique event id: <device>-<time>-<counter>
  device_id  text        not null,
  ts         bigint      not null,              -- client clock (ms), used for ordering only
  body       jsonb       not null,              -- the event itself
  created_at timestamptz not null default now(), -- server clock, used as the pull cursor
  primary key (user_id, id)
);

create index if not exists events_user_created on public.events (user_id, created_at);

alter table public.events enable row level security;

-- Each signed-in user can read and insert only their own rows. There is deliberately no UPDATE or
-- DELETE policy: the log is append-only, so a buggy or compromised client cannot erase progress.
drop policy if exists "read own events" on public.events;
create policy "read own events" on public.events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own events" on public.events;
create policy "insert own events" on public.events
  for insert to authenticated with check (auth.uid() = user_id);

-- Tiny public function used by the GitHub keep-alive workflow (free projects pause after a week
-- without activity). It reveals nothing.
create or replace function public.ping() returns text language sql stable as $$ select 'pong'::text $$;
grant execute on function public.ping() to anon, authenticated;
