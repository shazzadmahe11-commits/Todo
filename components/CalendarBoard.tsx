"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";
import { toDateStr } from "@/lib/recurrence";

type DayEntry = { id: string; task_title: string };
type DaysMap = Record<string, DayEntry[]>;
type CompletionRow = { id: string; task_id: string; task_title: string; completed_on: string; };

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
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
    <div className="flex flex-col gap-5">
      <div className="glass p-5 sm:p-6" style={{ boxShadow:"0 8px 40px rgba(0,0,0,0.12)" }}>
        {/* Month nav */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <button onClick={goPrev} aria-label="Previous month"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:text-soft active:scale-90 transition-all"
            style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="text-center">
            <h1 className="font-display text-2xl italic grad-text select-none">{MONTH_NAMES[month]}</h1>
            <p className="font-mono text-[11px] text-muted mt-0.5">{year}</p>
          </div>
          <button onClick={goNext} aria-label="Next month"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:text-soft active:scale-90 transition-all"
            style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Weekday labels */}
        <div className="mb-2 grid grid-cols-7">
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} className="text-center font-mono text-[10px] uppercase tracking-widest text-muted py-1">{w}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const count = days[dateKey]?.length ?? 0;
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selected;

            return (
              <button key={i}
                onClick={() => setSelected(count > 0 ? (isSelected ? null : dateKey) : null)}
                disabled={count === 0}
                className="relative flex aspect-square flex-col items-center justify-center rounded-2xl transition-all active:scale-90"
                style={
                  isSelected
                    ? { background:"linear-gradient(135deg,#7C6FCD,#4ABFBF)", boxShadow:"0 4px 16px rgba(124,111,205,0.45)", transform:"scale(1.05)" }
                    : count > 0
                    ? { background:"var(--glass)", border:"1px solid var(--glass-border)" }
                    : { background:"transparent" }
                }>
                {isToday && !isSelected && (
                  <div style={{ position:"absolute", inset:0, borderRadius:"1rem", border:"2px solid #7C6FCD", opacity:0.6 }} />
                )}
                <span className={`font-mono text-[12px] font-semibold ${isSelected ? "text-white" : count > 0 ? "text-bright" : "text-muted"}`} style={{ opacity: count === 0 ? 0.3 : 1 }}>
                  {d}
                </span>
                {count > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full"
                        style={{ background: isSelected ? "rgba(255,255,255,0.6)" : "linear-gradient(135deg,#7C6FCD,#4ABFBF)" }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Summary bar */}
        {!loading && totalCompletions > 0 && (
          <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop:"1px solid var(--line)" }}>
            <span className="font-mono text-[10px] text-muted uppercase tracking-widest">This month</span>
            <span className="font-mono text-[11px] grad-text">{totalCompletions} completed</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full pulse-dot"
                style={{ background:"linear-gradient(135deg,#7C6FCD,#4ABFBF)", animationDelay:`${i*200}ms` }} />
            ))}
          </div>
        </div>
      )}

      {/* Selected day */}
      {selected && (
        <div className="glass p-5 fade-up" style={{ boxShadow:"0 8px 32px rgba(0,0,0,0.10)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1">Completed on</p>
              <p className="font-display text-lg italic grad-text">{selected}</p>
            </div>
            <span className="shrink-0 rounded-full px-3 py-1 font-mono text-[10px] text-muted"
              style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
              {selectedEntries.length} task{selectedEntries.length !== 1 ? "s" : ""}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {selectedEntries.map(e => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background:"linear-gradient(135deg,#7C6FCD,#4ABFBF)", boxShadow:"0 2px 8px rgba(124,111,205,0.35)" }}>
                  <svg width="9" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="font-body text-[14px] text-bright min-w-0 break-words">{e.task_title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && Object.keys(days).length === 0 && (
        <div className="glass flex flex-col items-center gap-3 py-14 text-center">
          <span className="text-3xl">📅</span>
          <p className="font-body text-sm text-muted">No completions recorded this month yet.</p>
        </div>
      )}
    </div>
  );
}
