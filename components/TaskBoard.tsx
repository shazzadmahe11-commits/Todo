"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";
import { Task, Subtask, Recurrence, RECURRENCE_LABELS, isPending, todayStr, dueSoonLabel } from "@/lib/recurrence";

const RECURRENCE_OPTIONS: Recurrence[] = ["none", "daily", "weekly", "monthly"];
type TaskRowDB = { id: string; title: string; recurrence: Recurrence; archived: boolean; due_date: string | null; created_at: string; };
type CompletionRowDB = { task_id: string; completed_on: string; };
type SubtaskRowDB = { id: string; task_id: string; title: string; completed: boolean; position: number; created_at: string; };

export default function TaskBoard() {
  const supabase = getSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadTasks() {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const { data: taskData, error: te } = await supabase.from("tasks").select("id,title,recurrence,archived,due_date,created_at").eq("archived", false).order("created_at", { ascending: true });
      if (te) throw te;
      const { data: compData, error: ce } = await supabase.from("completions").select("task_id,completed_on").order("completed_on", { ascending: false });
      if (ce) throw ce;
      const { data: subData, error: se } = await supabase.from("subtasks").select("id,task_id,title,completed,position,created_at").order("position", { ascending: true });
      if (se) throw se;
      const lastCompleted = new Map<string, string>();
      for (const c of (compData ?? []) as CompletionRowDB[]) { if (!lastCompleted.has(c.task_id)) lastCompleted.set(c.task_id, c.completed_on); }
      const subtasksByTask = new Map<string, Subtask[]>();
      for (const s of (subData ?? []) as SubtaskRowDB[]) { const l = subtasksByTask.get(s.task_id) ?? []; l.push(s); subtasksByTask.set(s.task_id, l); }
      setTasks(((taskData ?? []) as TaskRowDB[]).map(t => ({ ...t, last_completed_on: lastCompleted.get(t.id) ?? null, subtasks: subtasksByTask.get(t.id) ?? [] })));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not load tasks."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTasks(); }, [user]);

  const { pending, done } = useMemo(() => {
    const now = new Date(); const pending: Task[] = [], done: Task[] = [];
    for (const t of tasks) (isPending(t, now) ? pending : done).push(t);
    pending.sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1);
    return { pending, done };
  }, [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting || !user) return;
    setSubmitting(true); setError(null);
    try {
      const { error } = await db.from("tasks").insert({ title: trimmed, recurrence, due_date: dueDate || null, user_id: user.id });
      if (error) throw error;
      setTitle(""); setRecurrence("none"); setDueDate(""); setShowForm(false);
      await loadTasks();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not add task."); }
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
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not complete."); await loadTasks(); }
  }

  async function undoComplete(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, last_completed_on: null } : t));
    try {
      await db.from("completions").delete().eq("task_id", id).eq("completed_on", todayStr());
      await db.from("tasks").update({ archived: false }).eq("id", id).eq("recurrence", "none");
      await loadTasks();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not undo."); await loadTasks(); }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await db.from("tasks").delete().eq("id", id); } catch { await loadTasks(); }
  }

  async function saveTaskEdit(id: string, updates: { title?: string; recurrence?: Recurrence; due_date?: string | null }) {
    try { const { error } = await db.from("tasks").update(updates).eq("id", id); if (error) throw error; await loadTasks(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not save."); }
  }

  async function addSubtask(taskId: string, subTitle: string) {
    if (!user) return;
    const { count } = await db.from("subtasks").select("id", { count: "exact", head: true }).eq("task_id", taskId);
    const { error } = await db.from("subtasks").insert({ task_id: taskId, title: subTitle, position: count ?? 0, user_id: user.id });
    if (error) setError(error.message); else await loadTasks();
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    setTasks(prev => prev.map(t => ({ ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, completed } : s) })));
    await db.from("subtasks").update({ completed }).eq("id", subtaskId);
  }

  async function deleteSubtask(subtaskId: string) {
    setTasks(prev => prev.map(t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) })));
    await db.from("subtasks").delete().eq("id", subtaskId);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Add task trigger */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="glass glass-hover w-full flex items-center gap-3 px-5 py-4 text-left active:scale-[0.99] transition-all"
          style={{ boxShadow:"0 4px 24px rgba(0,0,0,0.10)" }}>
          <span className="grad-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xl leading-none font-light">+</span>
          <span className="font-body text-[15px] text-muted">Add a task…</span>
        </button>
      ) : (
        <div className="glass p-5" style={{ boxShadow:"0 8px 32px rgba(0,0,0,0.12)" }}>
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">New task</p>
            <button onClick={() => { setShowForm(false); setTitle(""); setRecurrence("none"); setDueDate(""); }}
              className="h-7 w-7 flex items-center justify-center rounded-full text-muted hover:text-soft transition-colors"
              style={{ background:"var(--surface-2)" }}>
              <span className="text-sm">✕</span>
            </button>
          </div>
          <form onSubmit={addTask} className="flex flex-col gap-4">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus
              className="w-full bg-transparent font-body text-[16px] text-bright placeholder:text-muted focus:outline-none border-b pb-2 transition-colors"
              style={{ borderColor:"var(--line)" }}
              onFocus={e => e.currentTarget.style.borderColor = "#7C6FCD"}
              onBlur={e => e.currentTarget.style.borderColor = "var(--line)"}
              maxLength={200} />
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {RECURRENCE_OPTIONS.map(opt => (
                <button type="button" key={opt} onClick={() => setRecurrence(opt)}
                  className={`shrink-0 rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-all active:scale-95 ${
                    recurrence === opt ? "grad-btn text-white" : "text-muted hover:text-soft"
                  }`}
                  style={recurrence !== opt ? { background:"var(--surface-2)", border:"1px solid var(--line)" } : {}}>
                  {RECURRENCE_LABELS[opt]}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted shrink-0">Due</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="rounded-xl px-3 py-1.5 font-mono text-[11px] text-muted focus:outline-none transition-colors"
                  style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#7C6FCD"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--line)"} />
                {dueDate && <button type="button" onClick={() => setDueDate("")} className="text-muted hover:text-warn text-sm transition-colors">✕</button>}
              </div>
              <button type="submit" disabled={!title.trim() || submitting} className="grad-btn shrink-0 rounded-full px-6 py-2.5 font-mono text-[11px] uppercase tracking-wider text-white">
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="rounded-2xl px-4 py-3 font-mono text-xs text-warn"
          style={{ background:"var(--warn-bg)", border:"1px solid var(--warn-border)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full pulse-dot"
                style={{ background:"linear-gradient(135deg,#7C6FCD,#4ABFBF)", animationDelay:`${i*200}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Section label="To do" count={pending.length}>
            {pending.length === 0 ? (
              <div className="glass flex flex-col items-center gap-3 py-14 text-center">
                <div className="grad-btn flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white">✓</div>
                <p className="font-body text-sm text-muted">All clear. Nothing left to do.</p>
              </div>
            ) : (
              <div className="glass overflow-hidden" style={{ boxShadow:"0 4px 24px rgba(0,0,0,0.10)" }}>
                {pending.map((t, i) => (
                  <TaskItem key={t.id} task={t} isLast={i === pending.length - 1}
                    onComplete={() => completeTask(t.id)} onDelete={() => deleteTask(t.id)}
                    onSave={u => saveTaskEdit(t.id, u)} onAddSubtask={st => addSubtask(t.id, st)}
                    onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} />
                ))}
              </div>
            )}
          </Section>

          {done.length > 0 && (
            <Section label="Done" count={done.length}>
              <div className="glass overflow-hidden" style={{ boxShadow:"0 4px 24px rgba(0,0,0,0.08)", opacity:0.8 }}>
                {done.map((t, i) => (
                  <TaskItem key={t.id} task={t} completed isLast={i === done.length - 1}
                    onUndo={() => undoComplete(t.id)} onDelete={() => deleteTask(t.id)}
                    onSave={u => saveTaskEdit(t.id, u)} onAddSubtask={st => addSubtask(t.id, st)}
                    onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 px-1">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</h2>
        {count > 0 && (
          <span className="rounded-full px-2 py-0.5 font-mono text-[10px] text-muted"
            style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function TaskItem({ task, completed = false, isLast, onComplete, onUndo, onDelete, onSave, onAddSubtask, onToggleSubtask, onDeleteSubtask }: {
  task: Task; completed?: boolean; isLast: boolean;
  onComplete?: () => void; onUndo?: () => void; onDelete: () => void;
  onSave: (u: { title?: string; recurrence?: Recurrence; due_date?: string | null }) => void;
  onAddSubtask: (t: string) => void;
  onToggleSubtask: (id: string, c: boolean) => void;
  onDeleteSubtask: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editRec, setEditRec] = useState<Recurrence>(task.recurrence);
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [subInput, setSubInput] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  function startEdit() { setEditTitle(task.title); setEditRec(task.recurrence); setEditDue(task.due_date ?? ""); setEditing(true); setExpanded(true); }
  function cancelEdit() { setEditing(false); }
  function commitEdit() { const t = editTitle.trim(); if (!t) return; onSave({ title: t, recurrence: editRec, due_date: editDue || null }); setEditing(false); }
  function handleSubAdd(e: React.FormEvent) { e.preventDefault(); const t = subInput.trim(); if (!t) return; setSubInput(""); onAddSubtask(t); }

  const dueLabel = dueSoonLabel(task.due_date);
  const isOverdue = dueLabel === "Overdue";
  const doneCount = task.subtasks.filter(s => s.completed).length;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid var(--line-soft)" }}>
      <div className="flex items-start gap-3 px-4 py-4">
        {/* Checkbox */}
        <button onClick={completed ? onUndo : onComplete} aria-label={completed ? "Undo" : "Complete"}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all active:scale-85"
          style={completed
            ? { background:"linear-gradient(135deg,#7C6FCD,#4ABFBF)", boxShadow:"0 2px 10px rgba(124,111,205,0.40)" }
            : { border:"2px solid var(--line)", background:"transparent" }}
          onMouseEnter={e => { if (!completed) e.currentTarget.style.borderColor="#7C6FCD"; }}
          onMouseLeave={e => { if (!completed) e.currentTarget.style.borderColor="var(--line)"; }}>
          {completed && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input ref={editRef} value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
              className="w-full bg-transparent font-body text-[15px] text-bright focus:outline-none border-b pb-0.5"
              style={{ borderColor:"#7C6FCD" }} maxLength={200} />
          ) : (
            <button onClick={() => setExpanded(x => !x)} className="w-full text-left">
              <span className={`font-body text-[15px] leading-snug break-words ${completed ? "text-muted line-through" : "text-bright"}`}>
                {task.title}
              </span>
            </button>
          )}
          {/* Badges */}
          {!editing && (dueLabel || task.recurrence !== "none" || task.subtasks.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dueLabel && (
                <span className="rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
                  style={isOverdue
                    ? { background:"var(--warn-bg)", border:"1px solid var(--warn-border)", color:"var(--warn)" }
                    : { background:"var(--surface-2)", border:"1px solid var(--line)", color:"var(--muted)" }}>
                  {dueLabel}
                </span>
              )}
              {task.recurrence !== "none" && (
                <span className="rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted"
                  style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
                  {RECURRENCE_LABELS[task.recurrence]}
                </span>
              )}
              {task.subtasks.length > 0 && (
                <span className="rounded-full px-2.5 py-0.5 font-mono text-[9px] text-muted"
                  style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
                  {doneCount}/{task.subtasks.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <button onClick={commitEdit} className="grad-btn rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white">Save</button>
              <button onClick={cancelEdit} className="h-8 w-8 flex items-center justify-center rounded-full text-muted hover:text-soft transition-colors"
                style={{ background:"var(--surface-2)" }}>✕</button>
            </>
          ) : (
            <>
              <button onClick={() => setExpanded(x => !x)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-soft active:scale-90 transition-all"
                style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
                <span className="font-mono text-[9px]">{expanded ? "▲" : "▼"}</span>
              </button>
              <button onClick={startEdit}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-soft active:scale-90 transition-all"
                style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button onClick={onDelete}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-warn active:scale-90 transition-all"
                style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop:"1px solid var(--line-soft)" }}>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-3">
            {RECURRENCE_OPTIONS.map(opt => (
              <button type="button" key={opt} onClick={() => setEditRec(opt)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-all active:scale-95 ${editRec === opt ? "grad-btn text-white" : "text-muted"}`}
                style={editRec !== opt ? { background:"var(--surface-2)", border:"1px solid var(--line)" } : {}}>
                {RECURRENCE_LABELS[opt]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider shrink-0">Due</label>
            <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
              className="rounded-xl px-3 py-1.5 font-mono text-[10px] text-muted focus:outline-none"
              style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}
              onFocus={e => e.currentTarget.style.borderColor="#7C6FCD"}
              onBlur={e => e.currentTarget.style.borderColor="var(--line)"} />
            {editDue && <button type="button" onClick={() => setEditDue("")} className="font-mono text-[10px] text-muted hover:text-warn transition-colors">Clear</button>}
          </div>
        </div>
      )}

      {/* Subtasks */}
      {expanded && !editing && (
        <div className="px-4 pb-4" style={{ borderTop:"1px solid var(--line-soft)" }}>
          {task.subtasks.length > 0 && (
            <ul className="mt-3 mb-3 flex flex-col gap-1.5">
              {task.subtasks.map(s => (
                <SubtaskItem key={s.id} subtask={s}
                  onToggle={c => onToggleSubtask(s.id, c)} onDelete={() => onDeleteSubtask(s.id)} />
              ))}
            </ul>
          )}
          <form onSubmit={handleSubAdd} className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-all"
            style={{ background:"var(--surface-2)", border:"1px solid var(--line)" }}
            onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor="#7C6FCD"}
            onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor="var(--line)"}>
            <span className="font-mono text-[11px] text-muted shrink-0">↳</span>
            <input value={subInput} onChange={e => setSubInput(e.target.value)} placeholder="Add a subtask…"
              className="flex-1 min-w-0 bg-transparent font-body text-[13px] text-bright placeholder:text-muted focus:outline-none"
              maxLength={200} />
            <button type="submit" disabled={!subInput.trim()}
              className="shrink-0 font-mono text-[10px] uppercase tracking-wide grad-text disabled:[-webkit-text-fill-color:var(--muted)] disabled:[background:none] transition-all">
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SubtaskItem({ subtask, onToggle, onDelete }: { subtask: Subtask; onToggle: (c: boolean) => void; onDelete: () => void; }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors"
      style={{ background:"var(--glass)", border:"1px solid var(--line-soft)" }}>
      <button onClick={() => onToggle(!subtask.completed)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all active:scale-90"
        style={subtask.completed
          ? { background:"linear-gradient(135deg,#7C6FCD,#4ABFBF)", boxShadow:"0 1px 6px rgba(124,111,205,0.35)" }
          : { border:"2px solid var(--line)", background:"transparent" }}
        onMouseEnter={e => { if (!subtask.completed) e.currentTarget.style.borderColor="#7C6FCD"; }}
        onMouseLeave={e => { if (!subtask.completed) e.currentTarget.style.borderColor="var(--line)"; }}>
        {subtask.completed && (
          <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span className={`flex-1 min-w-0 font-body text-[13px] break-words ${subtask.completed ? "text-muted line-through" : "text-soft"}`}>
        {subtask.title}
      </span>
      <button onClick={onDelete} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-warn active:scale-90 transition-all"
        style={{ background:"var(--surface-2)" }}>
        <span className="text-sm leading-none">×</span>
      </button>
    </li>
  );
}
