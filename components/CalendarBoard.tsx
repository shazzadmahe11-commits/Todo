"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";
import { toDateStr } from "@/lib/recurrence";

type DayEntry = { id: string; task_title: string };
type DaysMap = Record<string, DayEntry[]>;

type CompletionRow = {
  id: string;
  task_id: string;
  task_title: string;
  completed_on: string;
};

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const WEEKDAY_LABELS = ["M","T","W","T","F","S","S"];

export default function CalendarBoard() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [days, setDays] = useState<DaysMap>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setSelected(null);

    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const nextMonth = new Date(year, month + 1, 1);
    const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

    supabase
      .from("completions")
      .select("id, task_id, task_title, completed_on")
      .gte("completed_on", start)
      .lt("completed_on", end)
      .order("completed_on", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const byDay: DaysMap = {};
        for (const row of (data ?? []) as CompletionRow[]) {
          const list = byDay[row.completed_on] ?? [];
          list.push({ id: row.id, task_title: row.task_title });
          byDay[row.completed_on] = list;
        }
        setDays(byDay);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, year, month]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    return result;
  }, [year, month]);

  function goPrev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function goNext() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const todayKey = toDateStr(new Date());
  const selectedEntries = selected ? days[selected] ?? [] : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <button onClick={goPrev} aria-label="Previous month"
          className="font-mono text-sm text-muted hover:text-soft transition-colors">←</button>
        <h1 className="font-display text-lg italic grad-text select-none">
          {MONTH_NAMES[month]} {year}
        </h1>
        <button onClick={goNext} aria-label="Next month"
          className="font-mono text-sm text-muted hover:text-soft transition-colors">→</button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-center font-mono text-[10px] uppercase tracking-wide text-muted">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const count = days[dateKey]?.length ?? 0;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selected;

          return (
            <button key={i}
              onClick={() => setSelected(count > 0 ? dateKey : null)}
              disabled={count === 0}
              className={`relative flex aspect-square flex-col items-center justify-center rounded font-mono text-xs transition-all ${
                isSelected ? "bg-grad text-paper shadow-lg"
                : count > 0 ? "bg-surface text-soft border border-line hover:border-gradA hover:text-bright"
                : "text-muted/50"
              } ${isToday && !isSelected ? "ring-1 ring-gradA/60" : ""}`}>
              {d}
              {count > 0 && (
                <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-paper/60" : "bg-gradB"}`} />
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-6 font-mono text-xs text-muted">Loading…</p>}

      {selected && (
        <div className="mt-8 border-t border-line pt-5">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">{selected}</h2>
          <ul className="flex flex-col gap-2">
            {selectedEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 font-body text-[15px] text-bright">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradB" />
                {e.task_title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && Object.keys(days).length === 0 && (
        <p className="mt-8 rounded border border-dashed border-line px-4 py-6 text-center font-body text-sm text-muted">
          No completions yet this month.
        </p>
      )}
    </div>
  );
}
