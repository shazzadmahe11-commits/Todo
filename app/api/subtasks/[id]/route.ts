import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// PATCH /api/subtasks/:id — toggle completed or edit title
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") updates.completed = body.completed;
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    updates.title = t;
  }
  const { data, error } = await supabase
    .from("subtasks").update(updates).eq("id", params.id).select().single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subtask: data });
}

// DELETE /api/subtasks/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("subtasks").delete().eq("id", params.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
