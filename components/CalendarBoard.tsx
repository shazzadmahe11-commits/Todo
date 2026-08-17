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
    supabase.from("completions").select("id,task_id,task_title,completed_on")
      .gte("completed_on", start).lt("completed_on", end).order("completed_on", { ascending: true })
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
  const totalCompletions = Object.values(days).reduce((s, a) => s + a.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Calendar card */}
      <div className="card" style={{ padding: 20 }}>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={goPrev}
            style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--bg2)",
              color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.3px" }}>{MONTH_NAMES[month]}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>{year}</div>
          </div>
          <button onClick={goNext}
            style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--bg2)",
              color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)",
              textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 0", fontFamily: "'JetBrains Mono', monospace" }}>{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
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
                style={{
                  aspectRatio: "1", borderRadius: 10, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", cursor: count > 0 ? "pointer" : "default",
                  border: isToday && !isSelected ? "2px solid var(--accent)" : "1.5px solid transparent",
                  backgroundColor: isSelected ? "var(--accent)" : count > 0 ? "var(--accent-bg)" : "transparent",
                  transition: "all 0.12s ease",
                  boxShadow: isSelected ? "0 2px 8px rgba(34,197,94,0.30)" : "none",
                }}>
                <span style={{
                  fontSize: 13, fontWeight: isToday || isSelected ? 800 : count > 0 ? 600 : 400,
                  color: isSelected ? "white" : isToday ? "var(--accent)" : count > 0 ? "var(--accent-fg)" : "var(--muted)",
                  lineHeight: 1,
                }}>{d}</span>
                {count > 0 && (
                  <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <div key={i} style={{ width: 4, height: 4, borderRadius: "50%",
                        backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : "var(--accent)" }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Summary */}
        {!loading && totalCompletions > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border2)",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>This month</span>
            <span className="pill">{totalCompletions} task{totalCompletions !== 1 ? "s" : ""} completed</span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid var(--border)", borderTopColor: "var(--accent)" }} className="spin" />
        </div>
      )}

      {/* Selected day detail */}
      {selected && (
        <div className="card fade-up" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                Completed on
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{selected}</div>
            </div>
            <span className="pill">{selectedEntries.length} task{selectedEntries.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedEntries.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                borderRadius: 12, backgroundColor: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(34,197,94,0.25)" }}>
                  <svg width="10" height="9" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", wordBreak: "break-word" }}>{e.task_title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && Object.keys(days).length === 0 && (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>No completions yet</p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Complete some tasks to see them here</p>
        </div>
      )}
    </div>
  );
}
