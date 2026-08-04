import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServerClient();

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, recurrence, archived, created_at")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  const { data: completions, error: completionsError } = await supabase
    .from("completions")
    .select("task_id, completed_on")
    .order("completed_on", { ascending: false });

  if (completionsError) {
    return NextResponse.json(
      { error: completionsError.message },
      { status: 500 }
    );
  }

  const lastCompletedByTask = new Map<string, string>();
  for (const c of completions ?? []) {
    if (!lastCompletedByTask.has(c.task_id)) {
      lastCompletedByTask.set(c.task_id, c.completed_on);
    }
  }

  const enriched = (tasks ?? []).map((t) => ({
    ...t,
    last_completed_on: lastCompletedByTask.get(t.id) ?? null,
  }));

  return NextResponse.json({ tasks: enriched });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const recurrence = ["none", "daily", "weekly", "monthly"].includes(
    body.recurrence
  )
    ? body.recurrence
    : "none";

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({ title, recurrence })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
