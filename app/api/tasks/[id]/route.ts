import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// PATCH /api/tasks/:id — edit title, recurrence, due_date
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed)
      return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    updates.title = trimmed;
  }
  if (["none", "daily", "weekly", "monthly"].includes(body.recurrence))
    updates.recurrence = body.recurrence;
  if ("due_date" in body)
    updates.due_date = body.due_date || null;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data });
}

// DELETE /api/tasks/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("tasks").delete().eq("id", params.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
