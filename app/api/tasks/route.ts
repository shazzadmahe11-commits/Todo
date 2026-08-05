import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServerClient();

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, recurrence, archived, due_date, created_at")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (tasksError)
    return NextResponse.json({ error: tasksError.message }, { status: 500 });

  const { data: completions, error: completionsError } = await supabase
    .from("completions")
    .select("task_id, completed_on")
    .order("completed_on", { ascending: false });

  if (completionsError)
    return NextResponse.json({ error: completionsError.message }, { status: 500 });

  const { data: subtasks, error: subtasksError } = await supabase
    .from("subtasks")
    .select("id, task_id, title, completed, position, created_at")
    .order("position", { ascending: true });

  if (subtasksError)
    return NextResponse.json({ error: subtasksError.message }, { status: 500 });

  const lastCompletedByTask = new Map<string, string>();
  for (const c of completions ?? []) {
    if (!lastCompletedByTask.has(c.task_id))
      lastCompletedByTask.set(c.task_id, c.completed_on);
  }

  const subtasksByTask = new Map<string, typeof subtasks>();
  for (const s of subtasks ?? []) {
    const list = subtasksByTask.get(s.task_id) ?? [];
    list.push(s);
    subtasksByTask.set(s.task_id, list);
  }

  const enriched = (tasks ?? []).map((t) => ({
    ...t,
    last_completed_on: lastCompletedByTask.get(t.id) ?? null,
    subtasks: subtasksByTask.get(t.id) ?? [],
  }));

  return NextResponse.json({ tasks: enriched });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const recurrence = ["none", "daily", "weekly", "monthly"].includes(body.recurrence)
    ? body.recurrence : "none";
  const due_date = body.due_date || null;

  if (!title)
    return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("tasks")
    .insert({ title, recurrence, due_date })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: { ...data, subtasks: [] } }, { status: 201 });
}
