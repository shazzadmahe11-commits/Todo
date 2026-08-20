"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";
import { Task, Subtask, Recurrence, RECURRENCE_LABELS, isPending, todayStr, dueSoonLabel } from "@/lib/recurrence";
import { PRESET_CATEGORIES, categoryColor, categoryLabel, groupTasksByCategory, extractCustomCategories } from "@/lib/category";

const RECURRENCE_OPTIONS: Recurrence[] = ["none", "daily", "weekly", "monthly"];
type TaskRowDB = { id: string; title: string; recurrence: Recurrence; archived: boolean; due_date: string | null; category: string; created_at: string; };
type CompletionRowDB = { task_id: string; completed_on: string; };
type SubtaskRowDB = { id: string; task_id: string; title: string; completed: boolean; position: number; created_at: string; };

// Supabase/Postgrest errors are plain objects with a `message` field, not
// JS `Error` instances — so `e instanceof Error` misses them and hides the
// real reason behind a generic fallback. This pulls the real message out.
function errMsg(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

export default function TaskBoard() {
  const supabase = getSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [category, setCategory] = useState<string>("personal");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("collapsedCategories");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  function toggleCollapsed(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      try { localStorage.setItem("collapsedCategories", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  async function loadTasks() {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const { data: td, error: te } = await supabase.from("tasks").select("id,title,recurrence,archived,due_date,category,created_at").eq("archived", false).order("created_at", { ascending: true });
      if (te) throw te;
      const { data: cd, error: ce } = await supabase.from("completions").select("task_id,completed_on").order("completed_on", { ascending: false });
      if (ce) throw ce;
      const { data: sd, error: se } = await supabase.from("subtasks").select("id,task_id,title,completed,position,created_at").order("position", { ascending: true });
      if (se) throw se;
      const lc = new Map<string, string>();
      for (const c of (cd ?? []) as CompletionRowDB[]) { if (!lc.has(c.task_id)) lc.set(c.task_id, c.completed_on); }
      const sm = new Map<string, Subtask[]>();
      for (const s of (sd ?? []) as SubtaskRowDB[]) { const l = sm.get(s.task_id) ?? []; l.push(s); sm.set(s.task_id, l); }
      setTasks(((td ?? []) as TaskRowDB[]).map(t => ({ ...t, last_completed_on: lc.get(t.id) ?? null, subtasks: sm.get(t.id) ?? [] })));
    } catch (e: unknown) { setError(errMsg(e, "Could not load.")); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTasks(); }, [user]);

  const { pending, done } = useMemo(() => {
    const now = new Date(); const p: Task[] = [], d: Task[] = [];
    for (const t of tasks) (isPending(t, now) ? p : d).push(t);
    p.sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1);
    return { pending: p, done: d };
  }, [tasks]);

  const pendingGroups = useMemo(() => groupTasksByCategory(pending), [pending]);
  const doneGroups = useMemo(() => groupTasksByCategory(done), [done]);
  const customCategories = useMemo(() => extractCustomCategories(tasks), [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || submitting || !user) return;
    setSubmitting(true);
    try {
      const { error } = await db.from("tasks").insert({ title: t, recurrence, due_date: dueDate || null, category, user_id: user.id });
      if (error) throw error;
      setTitle(""); setRecurrence("none"); setCategory("personal"); setDueDate(""); setShowForm(false);
      await loadTasks();
    } catch (e: unknown) { setError(errMsg(e, "Could not add.")); }
    finally { setSubmitting(false); }
  }

  async function completeTask(id: string) {
    if (!user) return;
    const today = todayStr();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, last_completed_on: today } : t));
    try {
      const task = tasks.find(t => t.id === id);
      const { error: ce } = await db.from("completions").insert({ task_id: id, task_title: task?.title ?? "", completed_on: today, user_id: user.id });
      if (ce) throw ce;
      if (task?.recurrence === "none") await db.from("tasks").update({ archived: true }).eq("id", id);
      await loadTasks();
    } catch (e: unknown) { setError(errMsg(e, "Could not complete.")); await loadTasks(); }
  }

  async function undoComplete(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, last_completed_on: null } : t));
    try {
      await db.from("completions").delete().eq("task_id", id).eq("completed_on", todayStr());
      await db.from("tasks").update({ archived: false }).eq("id", id).eq("recurrence", "none");
      await loadTasks();
    } catch (e: unknown) { setError(errMsg(e, "Could not undo.")); await loadTasks(); }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await db.from("tasks").delete().eq("id", id); } catch { await loadTasks(); }
  }

  async function saveEdit(id: string, u: { title?: string; recurrence?: Recurrence; due_date?: string | null; category?: string }) {
    try { const { error } = await db.from("tasks").update(u).eq("id", id); if (error) throw error; await loadTasks(); }
    catch (e: unknown) { setError(errMsg(e, "Could not save.")); }
  }

  async function addSubtask(taskId: string, t: string) {
    if (!user) return;
    const { count } = await db.from("subtasks").select("id", { count: "exact", head: true }).eq("task_id", taskId);
    const { error } = await db.from("subtasks").insert({ task_id: taskId, title: t, position: count ?? 0, user_id: user.id });
    if (error) setError(error.message); else await loadTasks();
  }

  async function toggleSubtask(id: string, completed: boolean) {
    setTasks(prev => prev.map(t => ({ ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, completed } : s) })));
    await db.from("subtasks").update({ completed }).eq("id", id);
  }

  async function deleteSubtask(id: string) {
    setTasks(prev => prev.map(t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== id) })));
    await db.from("subtasks").delete().eq("id", id);
  }

  async function editSubtask(id: string, title: string) {
    setTasks(prev => prev.map(t => ({ ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, title } : s) })));
    try { await db.from("subtasks").update({ title }).eq("id", id); }
    catch (e: unknown) { setError(errMsg(e, "Could not update subtask.")); await loadTasks(); }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.4px", lineHeight: 1.2 }}>Today</h1>
          <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 3 }}>{dateStr}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-accent"
          style={{ borderRadius: 12, padding: "8px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add task
        </button>
      </div>

      {/* Add task form */}
      {showForm && (
        <div className="card fade-up" style={{ padding: 20 }}>
          <form onSubmit={addTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?"
              autoFocus className="input" maxLength={200} style={{ fontSize: 14, fontWeight: 500 }} />
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="no-scroll">
              {RECURRENCE_OPTIONS.map(opt => (
                <button type="button" key={opt} onClick={() => setRecurrence(opt)}
                  style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", border: "1.5px solid",
                    borderColor: recurrence === opt ? "var(--accent)" : "var(--border)",
                    backgroundColor: recurrence === opt ? "var(--accent-bg)" : "var(--bg2)",
                    color: recurrence === opt ? "var(--accent-fg)" : "var(--text3)", transition: "all 0.12s ease" }}>
                  {RECURRENCE_LABELS[opt]}
                </button>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", display: "block", marginBottom: 6 }}>Category</label>
              <CategoryPicker value={category} onChange={setCategory} customCategories={customCategories} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", whiteSpace: "nowrap" }}>Due</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="input" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }} />
                {dueDate && (
                  <button type="button" onClick={() => setDueDate("")}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setShowForm(false); setTitle(""); setRecurrence("none"); setCategory("personal"); setDueDate(""); }}
                  className="btn-ghost" style={{ borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={!title.trim() || submitting}
                  className="btn-accent" style={{ borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {submitting ? "…" : "Add"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13,
          backgroundColor: "var(--warn-bg)", color: "var(--warn)", border: "1px solid var(--warn-bdr)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid var(--border)", borderTopColor: "var(--accent)" }} className="spin" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Pending */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>To do</span>
              {pending.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-fg)", backgroundColor: "var(--accent-bg)",
                  border: "1px solid var(--border)", borderRadius: 999, padding: "1px 8px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {pending.length}
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🌿</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>All done for now</p>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Add a task to get started</p>
              </div>
            ) : (
              /* ── Grouped by category, each with a colored label; tasks are their own cards with gap between ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {pendingGroups.map(g => {
                  const key = `pending:${g.category}`;
                  const isCollapsed = collapsed.has(key);
                  return (
                  <div key={g.category}>
                    <button type="button" onClick={() => toggleCollapsed(key)}
                      style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8,
                        background: "none", border: "none", cursor: "pointer", padding: "2px 0", width: "100%" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: categoryColor(g.category), flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: categoryColor(g.category), letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {categoryLabel(g.category)}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {g.tasks.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {g.tasks.map(t => (
                          <TaskItem key={t.id} task={t}
                            onComplete={() => completeTask(t.id)}
                            onDelete={() => deleteTask(t.id)}
                            onSave={u => saveEdit(t.id, u)}
                            onAddSubtask={st => addSubtask(t.id, st)}
                            onToggleSubtask={toggleSubtask}
                            onDeleteSubtask={deleteSubtask}
                            onEditSubtask={editSubtask} />
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Done */}
          {done.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Completed</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", backgroundColor: "var(--bg2)",
                  border: "1px solid var(--border)", borderRadius: 999, padding: "1px 8px", fontFamily: "'JetBrains Mono', monospace" }}>
                  {done.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, opacity: 0.72 }}>
                {doneGroups.map(g => {
                  const key = `done:${g.category}`;
                  const isCollapsed = collapsed.has(key);
                  return (
                  <div key={g.category}>
                    <button type="button" onClick={() => toggleCollapsed(key)}
                      style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8,
                        background: "none", border: "none", cursor: "pointer", padding: "2px 0", width: "100%" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: categoryColor(g.category), flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: categoryColor(g.category), letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {categoryLabel(g.category)}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {g.tasks.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {g.tasks.map(t => (
                          <TaskItem key={t.id} task={t} completed
                            onUndo={() => undoComplete(t.id)}
                            onDelete={() => deleteTask(t.id)}
                            onSave={u => saveEdit(t.id, u)}
                            onAddSubtask={st => addSubtask(t.id, st)}
                            onToggleSubtask={toggleSubtask}
                            onDeleteSubtask={deleteSubtask}
                            onEditSubtask={editSubtask} />
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function CategoryPicker({ value, onChange, customCategories }: {
  value: string;
  onChange: (v: string) => void;
  customCategories: string[];
}) {
  const [showInput, setShowInput] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const isPreset = (PRESET_CATEGORIES as readonly string[]).includes(value.trim().toLowerCase());
  const isCustom = !isPreset && value.trim() !== "";
  // All pills to show: presets + existing custom ones
  const allPills = [
    ...PRESET_CATEGORIES,
    ...customCategories.filter(c => !(PRESET_CATEGORIES as readonly string[]).includes(c.toLowerCase())),
  ];

  function handleAddNew(e: React.FormEvent) {
    e.preventDefault();
    const v = inputVal.trim();
    if (!v) return;
    onChange(v);
    setInputVal("");
    setShowInput(false);
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {allPills.map(c => {
        const isSelected = value.trim().toLowerCase() === c.trim().toLowerCase();
        return (
          <button type="button" key={c}
            onClick={() => { onChange(c); setShowInput(false); setInputVal(""); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1.5px solid",
              borderColor: isSelected ? categoryColor(c) : "var(--border)",
              backgroundColor: isSelected ? categoryColor(c) + "1f" : "var(--bg2)",
              color: isSelected ? categoryColor(c) : "var(--text3)",
              transition: "all 0.12s ease",
            }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: categoryColor(c), flexShrink: 0 }} />
            {categoryLabel(c)}
          </button>
        );
      })}

      {/* Show selected custom value as a pill if it's not already in allPills */}
      {isCustom && !customCategories.some(c => c.trim().toLowerCase() === value.trim().toLowerCase()) && (
        <button type="button"
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1.5px solid ${categoryColor(value)}`,
            backgroundColor: categoryColor(value) + "1f",
            color: categoryColor(value),
          }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: categoryColor(value), flexShrink: 0 }} />
          {categoryLabel(value)}
        </button>
      )}

      {/* + New button */}
      {showInput ? (
        <form onSubmit={handleAddNew} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input autoFocus value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder="New category…" className="input"
            style={{ width: 140, padding: "5px 10px", fontSize: 12 }} maxLength={40}
            onBlur={() => { if (!inputVal.trim()) { setShowInput(false); } }} />
          <button type="submit" disabled={!inputVal.trim()}
            style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              backgroundColor: "var(--accent)", color: "white", border: "none" }}>
            Add
          </button>
          <button type="button" onClick={() => { setShowInput(false); setInputVal(""); }}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowInput(true)}
          style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "1.5px dashed var(--border)", backgroundColor: "transparent", color: "var(--text3)" }}>
          + New
        </button>
      )}
    </div>
  );
}

function TaskItem({ task, completed = false, onComplete, onUndo, onDelete, onSave, onAddSubtask, onToggleSubtask, onDeleteSubtask, onEditSubtask }: {
  task: Task; completed?: boolean;
  onComplete?: () => void; onUndo?: () => void; onDelete: () => void;
  onSave: (u: { title?: string; recurrence?: Recurrence; due_date?: string | null; category?: string }) => void;
  onAddSubtask: (t: string) => void;
  onToggleSubtask: (id: string, c: boolean) => void;
  onDeleteSubtask: (id: string) => void;
  onEditSubtask: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editRec, setEditRec] = useState<Recurrence>(task.recurrence);
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [editCategory, setEditCategory] = useState(task.category);
  const [subInput, setSubInput] = useState("");
  const [hovered, setHovered] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  function startEdit() { setEditTitle(task.title); setEditRec(task.recurrence); setEditDue(task.due_date ?? ""); setEditCategory(task.category); setEditing(true); }
  function cancelEdit() { setEditing(false); setSubInput(""); }
  function commitEdit() { const t = editTitle.trim(); if (!t) return; onSave({ title: t, recurrence: editRec, due_date: editDue || null, category: editCategory }); setEditing(false); setSubInput(""); }
  function handleSubAdd(e: React.FormEvent) { e.preventDefault(); const t = subInput.trim(); if (!t) return; setSubInput(""); onAddSubtask(t); }

  const dueLabel = dueSoonLabel(task.due_date);
  const isOverdue = dueLabel === "Overdue";
  const doneCount = task.subtasks.filter(s => s.completed).length;

  return (
    <div className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ overflow: "hidden", transition: "box-shadow 0.15s ease",
        borderLeft: `3px solid ${categoryColor(task.category)}`,
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.10)" : undefined }}>

      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" }}>
        {/* Checkbox */}
        <button onClick={completed ? onUndo : onComplete}
          style={{ flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: "50%", cursor: "pointer",
            border: completed ? "none" : "2px solid var(--border)",
            backgroundColor: completed ? "var(--accent)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s ease",
            boxShadow: completed ? "0 2px 8px rgba(34,197,94,0.30)" : "none" }}
          onMouseEnter={e => { if (!completed) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-bg)"; } }}
          onMouseLeave={e => { if (!completed) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; } }}>
          {completed && (
            <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input ref={editRef} value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
              className="input" maxLength={200} style={{ fontSize: 13, fontWeight: 500 }} />
          ) : (
            <span style={{ display: "block", fontSize: 13, fontWeight: 500, lineHeight: 1.4,
              color: completed ? "var(--muted)" : "var(--text)",
              textDecoration: completed ? "line-through" : "none", wordBreak: "break-word" }}>
              {task.title}
            </span>
          )}

          {/* Badges */}
          {!editing && (dueLabel || task.recurrence !== "none" || task.subtasks.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
              {dueLabel && (
                <span className={isOverdue ? "pill pill-warn" : "pill"}
                  style={!isOverdue ? { color: "var(--text3)", backgroundColor: "var(--bg2)" } : {}}>
                  {isOverdue ? "⚠ " : "📅 "}{dueLabel}
                </span>
              )}
              {task.recurrence !== "none" && (
                <span className="pill" style={{ color: "var(--text3)", backgroundColor: "var(--bg2)", border: "1px solid var(--border)" }}>
                  ↻ {RECURRENCE_LABELS[task.recurrence]}
                </span>
              )}
              {task.subtasks.length > 0 && (
                <span className="pill" style={{ color: "var(--text3)", backgroundColor: "var(--bg2)", border: "1px solid var(--border)" }}>
                  {doneCount}/{task.subtasks.length} subtasks
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {editing ? (
            <>
              <button onClick={commitEdit} className="btn-accent"
                style={{ borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
              <button onClick={cancelEdit} className="btn-ghost"
                style={{ borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </>
          ) : (
            <>
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

      {/* Edit panel */}
      {editing && (
        <div style={{ padding: "0 16px 14px 50px", display: "flex", flexDirection: "column", gap: 10,
          borderTop: "1px solid var(--border2)" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 12 }} className="no-scroll">
            {RECURRENCE_OPTIONS.map(opt => (
              <button type="button" key={opt} onClick={() => setEditRec(opt)}
                style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", border: "1.5px solid",
                  borderColor: editRec === opt ? "var(--accent)" : "var(--border)",
                  backgroundColor: editRec === opt ? "var(--accent-bg)" : "var(--bg2)",
                  color: editRec === opt ? "var(--accent-fg)" : "var(--text3)" }}>
                {RECURRENCE_LABELS[opt]}
              </button>
            ))}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", display: "block", marginBottom: 6 }}>Category</label>
            <CategoryPicker value={editCategory} onChange={setEditCategory} customCategories={customCategories} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)" }}>Due</label>
            <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
              className="input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} />
            {editDue && (
              <button type="button" onClick={() => setEditDue("")}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}>×</button>
            )}
          </div>
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--border2)" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", display: "block", marginBottom: 6 }}>Add subtask</label>
            <form onSubmit={handleSubAdd} style={{ display: "flex", gap: 8 }}>
              <input value={subInput} onChange={e => setSubInput(e.target.value)}
                placeholder="Subtask title…" className="input"
                style={{ fontSize: 13, padding: "7px 12px" }} maxLength={200} />
              <button type="submit" disabled={!subInput.trim()} className="btn-accent"
                style={{ borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Add
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Subtasks */}
      {task.subtasks.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border2)", padding: "8px 16px 12px 50px" }}>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
            {task.subtasks.map((s, i) => (
              <SubtaskItem key={s.id} subtask={s} isLast={i === task.subtasks.length - 1}
                onToggle={c => onToggleSubtask(s.id, c)}
                onDelete={() => onDeleteSubtask(s.id)}
                onEdit={t => onEditSubtask(s.id, t)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SubtaskItem({ subtask, isLast, onToggle, onDelete, onEdit }: {
  subtask: Subtask; isLast: boolean;
  onToggle: (c: boolean) => void; onDelete: () => void; onEdit: (title: string) => void;
}) {
  const [h, setH] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); settledRef.current = false; } }, [editing]);
  useEffect(() => { if (!editing) setVal(subtask.title); }, [subtask.title, editing]);

  function commit() {
    if (settledRef.current) return; settledRef.current = true;
    const t = val.trim();
    if (t && t !== subtask.title) onEdit(t); else setVal(subtask.title);
    setEditing(false);
  }
  function cancel() { settledRef.current = true; setVal(subtask.title); setEditing(false); }

  return (
    <li onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8,
        borderBottom: isLast ? "none" : "1px solid var(--border2)",
        backgroundColor: h || editing ? "var(--bg2)" : "transparent", transition: "background 0.12s ease" }}>
      <button onClick={() => onToggle(!subtask.completed)}
        style={{ flexShrink: 0, width: 17, height: 17, borderRadius: "50%", cursor: "pointer",
          border: subtask.completed ? "none" : "2px solid var(--border)",
          backgroundColor: subtask.completed ? "var(--accent)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
        {subtask.completed && (
          <svg width="8" height="7" viewBox="0 0 12 10" fill="none">
            <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {editing ? (
        <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          onBlur={commit} maxLength={200}
          className="input" style={{ flex: 1, fontSize: 13, padding: "3px 8px" }} />
      ) : (
        <span onDoubleClick={() => setEditing(true)}
          style={{ flex: 1, fontSize: 13, color: subtask.completed ? "var(--muted)" : "var(--text2)",
            textDecoration: subtask.completed ? "line-through" : "none", wordBreak: "break-word", cursor: "text" }}>
          {subtask.title}
        </span>
      )}
      {!editing && (
        <div style={{ display: "flex", gap: 2, opacity: h ? 1 : 0, transition: "opacity 0.15s ease" }}>
          <ActionBtn onClick={() => setEditing(true)} label="Edit" size={24}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </ActionBtn>
          <ActionBtn onClick={onDelete} label="Delete" danger size={24}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </ActionBtn>
        </div>
      )}
    </li>
  );
}

function ActionBtn({ children, onClick, label, danger, size = 30 }: {
  children: React.ReactNode; onClick: () => void; label: string; danger?: boolean; size?: number;
}) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} aria-label={label} title={label}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: size, height: size, borderRadius: 8, border: "1px solid", flexShrink: 0,
        borderColor: h && danger ? "var(--warn-bdr)" : h ? "var(--border)" : "transparent",
        backgroundColor: h && danger ? "var(--warn-bg)" : h ? "var(--bg2)" : "transparent",
        color: h && danger ? "var(--warn)" : h ? "var(--text)" : "var(--muted)",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.12s ease" }}>
      {children}
    </button>
  );
}
