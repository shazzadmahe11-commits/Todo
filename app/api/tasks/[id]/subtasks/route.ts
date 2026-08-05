import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// POST /api/tasks/:id/subtasks — add a subtask
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title)
    return NextResponse.json({ error: "Title is required." }, { status: 400 });

  // position = count of existing subtasks
  const { count } = await supabase
    .from("subtasks")
    .select("id", { count: "exact", head: true })
    .eq("task_id", params.id);

  const { data, error } = await supabase
    .from("subtasks")
    .insert({ task_id: params.id, title, position: count ?? 0 })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ subtask: data }, { status: 201 });
}
