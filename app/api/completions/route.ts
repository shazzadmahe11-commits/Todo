import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// GET /api/completions?month=YYYY-MM
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  const month = req.nextUrl.searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Query param 'month' must look like YYYY-MM." },
      { status: 400 }
    );
  }

  const [year, mon] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextMonth = new Date(year, mon, 1); // mon is 1-indexed here so this rolls to next month
  const end = `${nextMonth.getFullYear()}-${String(
    nextMonth.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("completions")
    .select("id, task_id, task_title, completed_on")
    .gte("completed_on", start)
    .lt("completed_on", end)
    .order("completed_on", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byDay = new Map<string, { id: string; task_title: string }[]>();
  for (const row of data ?? []) {
    const list = byDay.get(row.completed_on) ?? [];
    list.push({ id: row.id, task_title: row.task_title });
    byDay.set(row.completed_on, list);
  }

  return NextResponse.json({
    days: Object.fromEntries(byDay.entries()),
  });
}
