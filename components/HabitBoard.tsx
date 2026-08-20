"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Habit {
  id: string;
  name: string;
  color: string;
  frequency: "daily" | "weekly" | "monthly";
  icon: string;
  position: number;
  created_at: string;
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  completed_on: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  "#22c55e","#3b82f6","#a855f7","#f59e0b",
  "#ef4444","#14b8a6","#ec4899","#f97316",
];

const PRESET_ICONS: { id: string; label: string }[] = [
  { id: "run",      label: "🏃" },
  { id: "book",     label: "📚" },
  { id: "water",    label: "💧" },
  { id: "gym",      label: "🏋️" },
  { id: "sleep",    label: "😴" },
  { id: "meditate", label: "🧘" },
  { id: "food",     label: "🥗" },
  { id: "code",     label: "💻" },
  { id: "walk",     label: "🚶" },
  { id: "star",     label: "⭐" },
];

const ICON_MAP: Record<string, string> = Object.fromEntries(PRESET_ICONS.map(i => [i.id, i.label]));

function habitEmoji(icon: string) { return ICON_MAP[icon] ?? "⭐"; }

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const c = new Date(d); c.setHours(0,0,0,0);
  c.setDate(c.getDate() - (c.getDay() + 6) % 7);
  return c;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Calculate current streak (consecutive periods completed up to today)
function calcStreak(dates: Set<string>, frequency: Habit["frequency"]): number {
  const today = new Date(); today.setHours(0,0,0,0);
  let streak = 0;
  let cursor = new Date(today);

  for (let i = 0; i < 365; i++) {
    let key: string;
    if (frequency === "daily") {
      key = toDateStr(cursor);
    } else if (frequency === "weekly") {
      const sow = startOfWeek(cursor);
      key = toDateStr(sow);
    } else {
      key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`;
    }

    const matched = [...dates].some(d => {
      if (frequency === "daily") return d === key;
      if (frequency === "weekly") return toDateStr(startOfWeek(new Date(d+"T00:00:00"))) === key;
      return d.startsWith(key);
    });

    if (matched) {
      streak++;
      if (frequency === "daily") cursor.setDate(cursor.getDate() - 1);
      else if (frequency === "weekly") cursor.setDate(cursor.getDate() - 7);
      else cursor.setMonth(cursor.getMonth() - 1);
    } else {
      // Allow today to be incomplete without breaking streak
      if (i === 0) { if (frequency === "daily") cursor.setDate(cursor.getDate() - 1); else if (frequency === "weekly") cursor.setDate(cursor.getDate() - 7); else cursor.setMonth(cursor.getMonth() - 1); continue; }
      break;
    }
  }
  return streak;
}

function isDoneToday(dates: Set<string>, frequency: Habit["frequency"]): boolean {
  const today = toDateStr(new Date());
  if (frequency === "daily") return dates.has(today);
  if (frequency === "weekly") {
    const sow = toDateStr(startOfWeek(new Date()));
    return [...dates].some(d => toDateStr(startOfWeek(new Date(d+"T00:00:00"))) === sow);
  }
  const monthKey = today.slice(0,7);
  return [...dates].some(d => d.startsWith(monthKey));
}

// Last 7 day dots (for daily) or last 7 weeks/months
function lastNDots(dates: Set<string>, frequency: Habit["frequency"], n = 7): boolean[] {
  const result: boolean[] = [];
  const today = new Date(); today.setHours(0,0,0,0);

  for (let i = n-1; i >= 0; i--) {
    const cursor = new Date(today);
    if (frequency === "daily") {
      cursor.setDate(cursor.getDate() - i);
      result.push(dates.has(toDateStr(cursor)));
    } else if (frequency === "weekly") {
      cursor.setDate(cursor.getDate() - i * 7);
      const sow = toDateStr(startOfWeek(cursor));
      result.push([...dates].some(d => toDateStr(startOfWeek(new Date(d+"T00:00:00"))) === sow));
    } else {
      cursor.setMonth(cursor.getMonth() - i);
      const mk = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`;
      result.push([...dates].some(d => d.startsWith(mk)));
    }
  }
  return result;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HabitBoard() {
  const supabase = getSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { user } = useAuth();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newIcon, setNewIcon] = useState("star");
  const [newFreq, setNewFreq] = useState<Habit["frequency"]>("daily");
  const [submitting, setSubmitting] = useState(false);
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);

  async function loadAll() {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const [{ data: hd, error: he }, { data: cd, error: ce }] = await Promise.all([
        db.from("habits").select("*").order("position", { ascending: true }),
        db.from("habit_completions").select("id,habit_id,completed_on").order("completed_on", { ascending: false }),
      ]);
      if (he) throw he; if (ce) throw ce;
      setHabits(hd ?? []);
      setCompletions(cd ?? []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not load."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [user]);

  // Map habit_id → Set of completed_on dates
  const completionMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of completions) {
      const s = m.get(c.habit_id) ?? new Set<string>();
      s.add(c.completed_on); m.set(c.habit_id, s);
    }
    return m;
  }, [completions]);

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || submitting || !user) return;
    setSubmitting(true);
    try {
      const { error } = await db.from("habits").insert({
        name, color: newColor, icon: newIcon, frequency: newFreq,
        position: habits.length, user_id: user.id,
      });
      if (error) throw error;
      setNewName(""); setNewColor(PRESET_COLORS[0]); setNewIcon("star"); setNewFreq("daily");
      setShowForm(false); await loadAll();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not add."); }
    finally { setSubmitting(false); }
  }

  async function toggleToday(habit: Habit) {
    if (!user) return;
    const dates = completionMap.get(habit.id) ?? new Set<string>();
    const done = isDoneToday(dates, habit.frequency);
    const today = toDateStr(new Date());

    if (done) {
      // Delete today's completion
      await db.from("habit_completions")
        .delete().eq("habit_id", habit.id).eq("completed_on", today);
    } else {
      await db.from("habit_completions").insert({
        habit_id: habit.id, completed_on: today, user_id: user.id,
      });
    }
    await loadAll();
  }

  async function deleteHabit(id: string) {
    setHabits(prev => prev.filter(h => h.id !== id));
    await db.from("habits").delete().eq("id", id);
  }

  async function editHabit(id: string, u: { name?: string; color?: string; icon?: string; frequency?: Habit["frequency"] }) {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...u } : h));
    try { const { error } = await db.from("habits").update(u).eq("id", id); if (error) throw error; }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not save."); await loadAll(); }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const doneCount = habits.filter(h => isDoneToday(completionMap.get(h.id) ?? new Set(), h.frequency)).length;
  const bestStreak = habits.reduce((best, h) => {
    return Math.max(best, calcStreak(completionMap.get(h.id) ?? new Set(), h.frequency));
  }, 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--text)", letterSpacing:"-0.4px", lineHeight:1.2, margin:0 }}>Habits</h1>
          <p style={{ fontSize:13, color:"var(--text3)", marginTop:3 }}>{dateStr}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-accent"
          style={{ borderRadius:12, padding:"8px 16px", fontSize:14, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", flexShrink:0 }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span> New habit
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[
          { label:"Active habits", value: String(habits.length), color:"var(--text)" },
          { label:"Done today",    value: `${doneCount} / ${habits.length}`, color: doneCount === habits.length && habits.length > 0 ? "#22c55e" : "var(--text)" },
          { label:"Best streak",  value: `${bestStreak}d`, color:"#f59e0b" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card fade-up" style={{ padding:20 }}>
          <form onSubmit={addHabit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Habit name…" autoFocus className="input"
              maxLength={80} style={{ fontSize:15, fontWeight:500 }} />

            {/* Icon picker */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Icon</p>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {PRESET_ICONS.map(ic => (
                  <button type="button" key={ic.id} onClick={() => setNewIcon(ic.id)}
                    style={{ width:38, height:38, borderRadius:10, fontSize:18, cursor:"pointer",
                      border: newIcon === ic.id ? `2px solid ${newColor}` : "1.5px solid var(--border)",
                      backgroundColor: newIcon === ic.id ? newColor+"1a" : "var(--bg2)",
                      transition:"all 0.12s ease" }}>
                    {ic.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Color</p>
              <div style={{ display:"flex", gap:8 }}>
                {PRESET_COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setNewColor(c)}
                    style={{ width:26, height:26, borderRadius:"50%", backgroundColor:c, cursor:"pointer",
                      border: newColor === c ? "3px solid var(--text)" : "3px solid transparent",
                      transition:"border 0.12s ease" }} />
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Frequency</p>
              <div style={{ display:"flex", gap:6 }}>
                {(["daily","weekly","monthly"] as const).map(f => (
                  <button type="button" key={f} onClick={() => setNewFreq(f)}
                    style={{ padding:"6px 14px", borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer",
                      fontFamily:"'JetBrains Mono', monospace", border:"1.5px solid",
                      borderColor: newFreq === f ? newColor : "var(--border)",
                      backgroundColor: newFreq === f ? newColor+"1a" : "var(--bg2)",
                      color: newFreq === f ? newColor : "var(--text3)", transition:"all 0.12s ease" }}>
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost"
                style={{ borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={!newName.trim() || submitting} className="btn-accent"
                style={{ borderRadius:10, padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {submitting ? "…" : "Add habit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div style={{ padding:"10px 14px", borderRadius:10, fontSize:13,
          backgroundColor:"var(--warn-bg)", color:"var(--warn)", border:"1px solid var(--warn-bdr)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:"60px 0" }}>
          <div style={{ width:24, height:24, borderRadius:"50%", border:"2.5px solid var(--border)", borderTopColor:"var(--accent)" }} className="spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="card" style={{ padding:"48px 24px", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>
          <p style={{ fontSize:14, fontWeight:600, color:"var(--text2)" }}>No habits yet</p>
          <p style={{ fontSize:13, color:"var(--muted)", marginTop:4 }}>Add your first habit to start building streaks</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {habits.map(habit => {
            const dates = completionMap.get(habit.id) ?? new Set<string>();
            const done = isDoneToday(dates, habit.frequency);
            const streak = calcStreak(dates, habit.frequency);
            const dots = lastNDots(dates, habit.frequency, 7);
            const isExpanded = expandedHabit === habit.id;

            return (
              <HabitRow key={habit.id}
                habit={habit} dates={dates} done={done} streak={streak} dots={dots}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedHabit(isExpanded ? null : habit.id)}
                onToggleToday={() => toggleToday(habit)}
                onDelete={() => deleteHabit(habit.id)}
                onSave={u => editHabit(habit.id, u)} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── HabitRow ────────────────────────────────────────────────────────────────
function HabitRow({ habit, dates, done, streak, dots, isExpanded, onToggleExpand, onToggleToday, onDelete, onSave }: {
  habit: Habit; dates: Set<string>; done: boolean; streak: number; dots: boolean[]; isExpanded: boolean;
  onToggleExpand: () => void; onToggleToday: () => void; onDelete: () => void;
  onSave: (u: { name?: string; color?: string; icon?: string; frequency?: Habit["frequency"] }) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(habit.name);
  const [editColor, setEditColor] = useState(habit.color);
  const [editIcon, setEditIcon] = useState(habit.icon);
  const [editFreq, setEditFreq] = useState<Habit["frequency"]>(habit.frequency);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  function startEdit() {
    setEditName(habit.name); setEditColor(habit.color); setEditIcon(habit.icon); setEditFreq(habit.frequency);
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); }
  function commitEdit() {
    const n = editName.trim();
    if (!n) return;
    onSave({ name: n, color: editColor, icon: editIcon, frequency: editFreq });
    setEditing(false);
  }

  return (
    <div className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ overflow:"hidden", borderLeft:`3px solid ${habit.color}`, transition:"box-shadow 0.15s ease",
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.10)" : undefined }}>

      <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
        {/* Top row: icon badge + name/badges + actions */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ flexShrink:0, width:34, height:34, borderRadius:9, marginTop:1,
            backgroundColor: habit.color+"1f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
            {habitEmoji(habit.icon)}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            {editing ? (
              <input ref={editRef} value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                className="input" maxLength={80} style={{ fontSize:14, fontWeight:600 }} />
            ) : (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:3 }}>{habit.name}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {streak > 0 && (
                    <span style={{ fontSize:12, fontWeight:700, color:"#f59e0b", display:"flex", alignItems:"center", gap:3 }}>
                      🔥 {streak} {habit.frequency === "daily" ? "day" : habit.frequency === "weekly" ? "week" : "month"}{streak !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span style={{ fontSize:11, color:"var(--text3)", fontFamily:"'JetBrains Mono', monospace" }}>
                    {habit.frequency}
                  </span>
                </div>
              </>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            {editing ? (
              <>
                <button onClick={commitEdit} className="btn-accent"
                  style={{ borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Save</button>
                <button onClick={cancelEdit} className="btn-ghost"
                  style={{ borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
              </>
            ) : (
              <>
                <ActionBtn onClick={onToggleExpand} label={isExpanded ? "Collapse" : "Expand"}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition:"transform 0.15s ease" }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </ActionBtn>
                <ActionBtn onClick={startEdit} label="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </ActionBtn>
                <ActionBtn onClick={onDelete} label="Delete" danger>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                </ActionBtn>
              </>
            )}
          </div>
        </div>

        {/* Bottom row: unmistakable "mark done" button + history dots */}
        {!editing && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
            <button onClick={onToggleToday}
              style={{ flexShrink:0, display:"flex", alignItems:"center", gap:7, cursor:"pointer",
                border: done ? "none" : `1.5px solid ${habit.color}70`,
                backgroundColor: done ? habit.color : "transparent",
                color: done ? "#fff" : habit.color,
                borderRadius:999, padding:"7px 14px 7px 10px",
                fontSize:13, fontWeight:700, fontFamily:"'Plus Jakarta Sans', sans-serif",
                boxShadow: done ? `0 2px 10px ${habit.color}50` : "none",
                transition:"all 0.15s ease" }}
              onMouseEnter={e => { if (!done) (e.currentTarget as HTMLButtonElement).style.backgroundColor = habit.color + "1a"; }}
              onMouseLeave={e => { if (!done) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              title={done ? "Mark as not done" : "Mark as done"} aria-label={done ? "Mark as not done" : "Mark as done"}>
              <span style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                border: done ? "none" : `1.5px solid ${habit.color}`,
                backgroundColor: done ? "rgba(255,255,255,0.25)" : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {done && <svg width="10" height="8" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              {done ? "Done today" : "Mark as done"}
            </button>

            <div style={{ display:"flex", gap:4, flexShrink:0 }}>
              {dots.map((filled, i) => (
                <div key={i} style={{ width:8, height:8, borderRadius:"50%",
                  backgroundColor: filled ? habit.color : "var(--border)",
                  opacity: filled ? 1 : 0.4 }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ padding:"0 16px 16px 16px", display:"flex", flexDirection:"column", gap:14,
          borderTop:"1px solid var(--border2)", marginTop:0, paddingTop:14 }}>
          {/* Icon picker */}
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Icon</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {PRESET_ICONS.map(ic => (
                <button type="button" key={ic.id} onClick={() => setEditIcon(ic.id)}
                  style={{ width:34, height:34, borderRadius:9, fontSize:16, cursor:"pointer",
                    border: editIcon === ic.id ? `2px solid ${editColor}` : "1.5px solid var(--border)",
                    backgroundColor: editIcon === ic.id ? editColor+"1a" : "var(--bg2)",
                    transition:"all 0.12s ease" }}>
                  {ic.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Color</p>
            <div style={{ display:"flex", gap:8 }}>
              {PRESET_COLORS.map(c => (
                <button type="button" key={c} onClick={() => setEditColor(c)}
                  style={{ width:24, height:24, borderRadius:"50%", backgroundColor:c, cursor:"pointer",
                    border: editColor === c ? "3px solid var(--text)" : "3px solid transparent",
                    transition:"border 0.12s ease" }} />
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Frequency</p>
            <div style={{ display:"flex", gap:6 }}>
              {(["daily","weekly","monthly"] as const).map(f => (
                <button type="button" key={f} onClick={() => setEditFreq(f)}
                  style={{ padding:"6px 14px", borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer",
                    fontFamily:"'JetBrains Mono', monospace", border:"1.5px solid",
                    borderColor: editFreq === f ? editColor : "var(--border)",
                    backgroundColor: editFreq === f ? editColor+"1a" : "var(--bg2)",
                    color: editFreq === f ? editColor : "var(--text3)", transition:"all 0.12s ease" }}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expanded: simple month view */}
      {isExpanded && !editing && (
        <div style={{ borderTop:"1px solid var(--border2)", padding:"16px" }}>
          <MonthView habit={habit} dates={dates} />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, label, danger }: {
  children: React.ReactNode; onClick: () => void; label: string; danger?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} aria-label={label} title={label}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width:30, height:30, borderRadius:8, border:"1px solid", flexShrink:0,
        borderColor: h && danger ? "var(--warn-bdr)" : h ? "var(--border)" : "transparent",
        backgroundColor: h && danger ? "var(--warn-bg)" : h ? "var(--bg2)" : "transparent",
        color: h && danger ? "var(--warn)" : h ? "var(--text)" : "var(--muted)",
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.12s ease" }}>
      {children}
    </button>
  );
}

// ── MonthView — simple grid of days for the current month ─────────────────────
function MonthView({ habit, dates }: { habit: Habit; dates: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(now);
  const monthName = now.toLocaleDateString("en-US", { month:"long", year:"numeric" });

  // For weekly habits, mark the whole week if any day in that week is completed
  function isDayMarked(day: number): boolean {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (habit.frequency === "daily") return dates.has(dateStr);
    if (habit.frequency === "weekly") {
      const d = new Date(year, month, day);
      const sow = toDateStr(startOfWeek(d));
      return [...dates].some(c => toDateStr(startOfWeek(new Date(c+"T00:00:00"))) === sow);
    }
    const mk = `${year}-${String(month+1).padStart(2,"0")}`;
    return [...dates].some(c => c.startsWith(mk));
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  // Total completions this month
  const completedDays = days.filter(d => isDayMarked(d)).length;
  const pct = Math.round((completedDays / daysInMonth) * 100);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"var(--text3)" }}>{monthName}</span>
        <span style={{ fontSize:12, color:"var(--text3)" }}>
          <span style={{ color:habit.color, fontWeight:700 }}>{completedDays}</span> / {daysInMonth} days · {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height:4, borderRadius:999, backgroundColor:"var(--border)", marginBottom:12, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, borderRadius:999, backgroundColor:habit.color, transition:"width 0.3s ease" }} />
      </div>

      {/* Day grid — simple numbered squares */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {["M","T","W","T","F","S","S"].map((d,i) => (
          <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"var(--muted)",
            paddingBottom:4, fontFamily:"'JetBrains Mono', monospace" }}>{d}</div>
        ))}
        {/* Offset for first day of month */}
        {Array.from({ length: (new Date(year, month, 1).getDay() + 6) % 7 }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map(day => {
          const marked = isDayMarked(day);
          const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isToday = ds === todayStr;
          const isFuture = day > now.getDate();

          return (
            <div key={day} style={{ aspectRatio:"1", borderRadius:6, display:"flex",
              alignItems:"center", justifyContent:"center",
              backgroundColor: marked ? habit.color : isFuture ? "transparent" : "var(--bg2)",
              border: isToday ? `2px solid ${habit.color}` : marked ? "none" : "1px solid var(--border2)",
              opacity: isFuture ? 0.3 : 1 }}>
              <span style={{ fontSize:11, fontWeight: isToday ? 800 : 500,
                color: marked ? "white" : isToday ? habit.color : "var(--text3)" }}>
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:12, marginTop:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:10, height:10, borderRadius:3, backgroundColor:habit.color }} />
          <span style={{ fontSize:11, color:"var(--muted)" }}>Done</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:10, height:10, borderRadius:3, backgroundColor:"var(--bg2)", border:"1px solid var(--border2)" }} />
          <span style={{ fontSize:11, color:"var(--muted)" }}>Missed</span>
        </div>
      </div>
    </div>
  );
}
