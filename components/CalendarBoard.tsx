"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";
import { toDateStr } from "@/lib/recurrence";

type DayEntry = { id: string; task_title: string };
type DaysMap = Record<string, DayEntry[]>;
type CompletionRow = { id: string; task_id: string; task_title: string; completed_on: string; };

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

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
    setLoading(true); setSelected(null);
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const nm = new Date(year, month + 1, 1);
    const end = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}-01`;
    supabase.from("completions").select("id,task_id,task_title,completed_on").gte("completed_on", start).lt("completed_on", end).order("completed_on", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const byDay: DaysMap = {};
        for (const row of (data ?? []) as CompletionRow[]) {
          const list = byDay[row.completed_on] ?? [];
          list.push({ id: row.id, task_title: row.task_title });
          byDay[row.completed_on] = list;
        }
        setDays(byDay); setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, year, month]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const dim = new Date(year, month + 1, 0).getDate();
    const result: (number | null)[] = [];
    for (let i = 0; i < offset; i++) result.push(null);
    for (let d = 1; d <= dim; d++) result.push(d);
    return result;
  }, [year, month]);

  function goPrev() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function goNext() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  const todayKey = toDateStr(new Date());
  const selectedEntries = selected ? days[selected] ?? [] : [];
  const totalCompletions = Object.values(days).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Month nav card */}
      <div className="card p-5">
        <div className="mb-5 flex items-center justify-between">
          <button onClick={goPrev} aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-all hover:border-gradA hover:text-soft"
            style={{ backgroundColor: "var(--surface-2)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className="text-center">
            <h1 className="font-display text-xl italic grad-text select-none leading-none">
              {MONTH_NAMES[month]}
            </h1>
            <p className="font-mono text-[11px] text-muted mt-0.5">{year}</p>
          </div>

          <button onClick={goNext} aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-all hover:border-gradA hover:text-soft"
            style={{ backgroundColor: "var(--surface-2)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} className="text-center font-mono text-[9px] uppercase tracking-wider text-muted py-1">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const count = days[dateKey]?.length ?? 0;
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selected;

            return (
              <button key={i} onClick={() => setSelected(count > 0 ? (isSelected ? null : dateKey) : null)}
                disabled={count === 0}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg font-mono text-xs transition-all ${
                  isSelected ? "bg-grad text-paper shadow-md scale-105"
                  : count > 0 ? "border border-line text-soft hover:border-gradA hover:scale-105"
                  : "text-muted/40 cursor-default"
                } ${isToday && !isSelected ? "ring-2 ring-gradA/50" : ""}`}
                style={count > 0 && !isSelected ? { backgroundColor: "var(--surface-2)" } : {}}>
                <span className="text-[12px] font-medium">{d}</span>
                {count > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span key={i} className={`h-1 w-1 rounded-full ${isSelected ? "bg-paper/60" : "bg-gradB"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Month summary */}
        {!loading && totalCompletions > 0 && (
          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted uppercase tracking-wider">This month</span>
            <span className="font-mono text-[11px] text-soft">{totalCompletions} task{totalCompletions !== 1 ? "s" : ""} completed</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-gradA animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      )}

      {/* Selected day detail */}
      {selected && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-0.5">Completed on</p>
              <p className="font-display text-base italic text-bright">{selected}</p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 font-mono text-[10px] text-soft" style={{ backgroundColor: "var(--surface-2)" }}>
              {selectedEntries.length} task{selectedEntries.length !== 1 ? "s" : ""}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {selectedEntries.map(e => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 border border-line" style={{ backgroundColor: "var(--surface-2)" }}>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-grad text-paper">
                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="font-body text-[14px] text-bright">{e.task_title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && Object.keys(days).length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-12 text-center">
          <div className="text-2xl">📅</div>
          <p className="font-body text-sm text-muted">No completions recorded this month yet.</p>
        </div>
      )}
    </div>
  );
}
