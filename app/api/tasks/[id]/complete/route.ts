import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { todayStr } from "@/lib/recurrence";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, recurrence")
    .eq("id", params.id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("completions").insert({
    task_id: task.id,
    task_title: task.title,
    completed_on: todayStr(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // One-off tasks are archived once completed so they drop off the list
  // for good, while still showing up in the calendar history.
  if (task.recurrence === "none") {
    const { error: archiveError } = await supabase
      .from("tasks")
      .update({ archived: true })
      .eq("id", task.id);

    if (archiveError) {
      return NextResponse.json(
        { error: archiveError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}

// Undo today's completion (e.g. accidental tap).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  const today = todayStr();

  const { error: deleteError } = await supabase
    .from("completions")
    .delete()
    .eq("task_id", params.id)
    .eq("completed_on", today);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // If it was a one-off task, bring it back to the active list.
  const { error: unarchiveError } = await supabase
    .from("tasks")
    .update({ archived: false })
    .eq("id", params.id)
    .eq("recurrence", "none");

  if (unarchiveError) {
    return NextResponse.json(
      { error: unarchiveError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
