-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  task_title text not null,
  completed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists completions_completed_on_idx on completions (completed_on);
create index if not exists completions_task_id_idx on completions (task_id);

-- Row Level Security: this app talks to Supabase only from server-side API
-- routes using the service role key, so RLS can stay locked down by default.
alter table tasks enable row level security;
alter table completions enable row level security;
-- No policies are created, which means the anon/public key has zero access.
-- Only the service role key (used server-side, never sent to the browser)
-- can read or write. This is what keeps a personal, no-login app safe to
-- deploy on a public Vercel URL.
