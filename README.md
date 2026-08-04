# Do.

A small, minimal to-do app with recurring tasks and a calendar of what you've
completed. Built with Next.js (App Router) and Supabase. Meant for one
person — no login, no accounts.

## How it works

- **Tasks** live in a `tasks` table: a title, and a recurrence (`none`,
  `daily`, `weekly`, `monthly`).
- **Completions** live in a separate `completions` table — one row every time
  you check something off, with the date. This is what powers the calendar.
- A task reappears in "To do" once its recurrence window has passed (a daily
  task reappears the next day, a weekly one the following week, etc). A
  one-time task disappears for good once completed, but stays in your
  history.
- All database access happens server-side, in Next.js route handlers, using
  Supabase's **service role key**. The browser never talks to Supabase
  directly, so there's nothing to expose or lock down with auth — the app is
  safe to deploy on a public Vercel URL as long as you don't share it.

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run everything in `supabase/schema.sql` (creates
   the two tables, indexes, and locks down RLS).
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not the anon key) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Run it locally

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + service role key into .env.local
npm run dev
```

Open http://localhost:3000.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, "Add New Project" → import that repo.
3. Add the two environment variables from `.env.local` in the Vercel project
   settings (Settings → Environment Variables).
4. Deploy.

That's it — no other config needed. Since there's no login, treat your
Vercel URL like a shared secret (don't post it publicly) if you'd rather
keep it private. If you ever want to lock it down further, the simplest
option is Vercel's built-in Password Protection (Project Settings →
Deployment Protection, available on Pro) or adding Supabase email auth later.

## Project structure

```
app/
  page.tsx                     Today's list
  calendar/page.tsx            Completed-task calendar
  api/tasks/route.ts           list + create tasks
  api/tasks/[id]/route.ts      delete a task
  api/tasks/[id]/complete/     mark complete / undo
  api/completions/route.ts     completions for a given month
components/
  TaskBoard.tsx                today's list UI
  CalendarBoard.tsx            calendar UI
lib/
  supabase.ts                  server-side Supabase client
  recurrence.ts                recurrence + date logic
supabase/
  schema.sql                   run this once in Supabase
```

## Extending it

- **Editing a task's title/recurrence**: not built in, but straightforward —
  add a `PATCH` handler to `app/api/tasks/[id]/route.ts`.
- **Due dates / times**: currently recurrence just tracks "have I done this
  in the current day/week/month", not a specific due time. Add a `due_at`
  column if you want that.
- **Multiple people**: this is intentionally single-user (no auth, wide-open
  service-role access from the server). If you ever share it, add Supabase
  Auth and a `user_id` column with row-level security policies.
