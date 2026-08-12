"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/context/AuthContext";
import {
  Task, Subtask, Recurrence,
  RECURRENCE_LABELS, isPending, todayStr, dueSoonLabel,
} from "@/lib/recurrence";

const RECURRENCE_OPTIONS: Recurrence[] = ["none", "daily", "weekly", "monthly"];

type TaskRowDB = { id: string; title: string; recurrence: Recurrence; archived: boolean; due_date: string | null; created_at: string; };
type CompletionRowDB = { task_id: string; completed_on: string; };
type SubtaskRowDB = { id: string; task_id: string; title: string; completed: boolean; position: number; created_at: string; };

export default function TaskBoard() {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadTasks() {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const { data: taskData, error: taskErr } = await supabase.from("tasks").select("id,title,recurrence,archived,due_date,created_at").eq("archived", false).order("created_at", { ascending: true });
      if (taskErr) throw taskErr;
      const { data: compData, error: compErr } = await supabase.from("completions").select("task_id,completed_on").order("completed_on", { ascending: false });
      if (compErr) throw compErr;
      const { data: subData, error: subErr } = await supabase.from("subtasks").select("id,task_id,title,completed,position,created_at").order("position", { ascending: true });
      if (subErr) throw subErr;

      const lastCompleted = new Map<string, string>();
      for (const c of (compData ?? []) as CompletionRowDB[]) {
        if (!lastCompleted.has(c.task_id)) lastCompleted.set(c.task_id, c.completed_on);
      }
      const subtasksByTask = new Map<string, Subtask[]>();
      for (const s of (subData ?? []) as SubtaskRowDB[]) {
        const list = subtasksByTask.get(s.task_id) ?? [];
        list.push(s); subtasksByTask.set(s.task_id, list);
      }
      setTasks(((taskData ?? []) as TaskRowDB[]).map(t => ({
        ...t, last_completed_on: lastCompleted.get(t.id) ?? null, subtasks: subtasksByTask.get(t.id) ?? [],
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load tasks.");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadTasks(); }, [user]);

  const { pending, done } = useMemo(() => {
    const now = new Date();
    const pending: Task[] = [], done: Task[] = [];
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
      setTitle(""); setRecurrence("none"); setDueDate("");
      await loadTasks();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not add task.");
    } finally { setSubmitting(false); }
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
    try {
      const { error } = await db.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
      await loadTasks();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Could not save."); }
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
    <div className="flex flex-col gap-8">
      {/* Add task card */}
      <div className="card p-5">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted">New task</p>
        <form onSubmit={addTask} className="flex flex-col gap-4">
          <div className="flex gap-3 items-center border-b border-line pb-3 focus-within:border-gradA transition-colors">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?"
              className="flex-1 bg-transparent font-body text-[15px] text-bright placeholder:text-muted focus:outline-none"
              maxLength={200} />
            <button type="submit" disabled={!title.trim() || submitting}
              className="shrink-0 rounded-full bg-grad px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-paper disabled:opacity-40 transition-opacity">
              Add
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {RECURRENCE_OPTIONS.map(opt => (
                <button type="button" key={opt} onClick={() => setRecurrence(opt)}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wide transition-all ${
                    recurrence === opt ? "bg-grad text-paper shadow-sm" : "border border-line text-muted hover:border-gradA hover:text-soft"
                  }`} style={recurrence !== opt ? { backgroundColor: "var(--surface-2)" } : {}}>
                  {RECURRENCE_LABELS[opt]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {dueDate && <button type="button" onClick={() => setDueDate("")} className="font-mono text-[10px] text-muted hover:text-warn">✕</button>}
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-muted focus:border-gradA focus:text-bright focus:outline-none transition-colors"
                style={{ backgroundColor: "var(--surface-2)" }} title="Due date" />
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-warn/30 px-4 py-3 font-mono text-xs text-warn" style={{ backgroundColor: "rgba(224,112,96,0.08)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-gradA animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Pending */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">To do</h2>
              {pending.length > 0 && (
                <span className="rounded-full px-2 py-0.5 font-mono text-[10px] text-soft border border-line" style={{ backgroundColor: "var(--surface-2)" }}>
                  {pending.length}
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 py-12 text-center">
                <div className="text-2xl">✓</div>
                <p className="font-body text-sm text-muted">All clear. Nothing left to do.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                {pending.map((t, i) => (
                  <TaskItem key={t.id} task={t} isLast={i === pending.length - 1}
                    onComplete={() => completeTask(t.id)}
                    onDelete={() => deleteTask(t.id)}
                    onSave={u => saveTaskEdit(t.id, u)}
                    onAddSubtask={st => addSubtask(t.id, st)}
                    onToggleSubtask={toggleSubtask}
                    onDeleteSubtask={deleteSubtask}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Done */}
          {done.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">Done for now</h2>
                <span className="rounded-full px-2 py-0.5 font-mono text-[10px] text-soft border border-line" style={{ backgroundColor: "var(--surface-2)" }}>
                  {done.length}
                </span>
              </div>
              <div className="card overflow-hidden opacity-80">
                {done.map((t, i) => (
                  <TaskItem key={t.id} task={t} completed isLast={i === done.length - 1}
                    onUndo={() => undoComplete(t.id)}
                    onDelete={() => deleteTask(t.id)}
                    onSave={u => saveTaskEdit(t.id, u)}
                    onAddSubtask={st => addSubtask(t.id, st)}
                    onToggleSubtask={toggleSubtask}
                    onDeleteSubtask={deleteSubtask}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
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
  const [editRecurrence, setEditRecurrence] = useState<Recurrence>(task.recurrence);
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [subtaskInput, setSubtaskInput] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  function startEdit() { setEditTitle(task.title); setEditRecurrence(task.recurrence); setEditDue(task.due_date ?? ""); setEditing(true); setExpanded(true); }
  function cancelEdit() { setEditing(false); }
  function commitEdit() { const t = editTitle.trim(); if (!t) return; onSave({ title: t, recurrence: editRecurrence, due_date: editDue || null }); setEditing(false); }
  function handleSubtaskAdd(e: React.FormEvent) { e.preventDefault(); const t = subtaskInput.trim(); if (!t) return; setSubtaskInput(""); onAddSubtask(t); }

  const dueLabel = dueSoonLabel(task.due_date);
  const isOverdue = dueLabel === "Overdue";
  const doneCount = task.subtasks.filter(s => s.completed).length;
  const hasSubtasks = task.subtasks.length > 0;

  return (
    <div className={`group transition-colors ${!isLast ? "border-b border-line-soft" : ""}`}
      style={{ backgroundColor: expanded ? "var(--surface-hov)" : undefined }}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Checkbox */}
        <button onClick={completed ? onUndo : onComplete}
          aria-label={completed ? "Undo" : "Complete"}
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all ${
            completed ? "border-transparent bg-grad text-paper" : "border-line text-transparent hover:border-gradA"
          }`}>
          <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Title */}
        {editing ? (
          <input ref={editRef} value={editTitle} onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="flex-1 bg-transparent font-body text-[15px] text-bright focus:outline-none" maxLength={200} />
        ) : (
          <button onClick={() => setExpanded(x => !x)} className="flex-1 text-left">
            <span className={`font-body text-[15px] leading-snug ${completed ? "text-muted line-through" : "text-bright"}`}>
              {task.title}
            </span>
          </button>
        )}

        {/* Badges */}
        {!editing && (
          <div className="flex shrink-0 items-center gap-2">
            {dueLabel && (
              <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                isOverdue ? "bg-warn/10 text-warn" : "border border-line text-muted"
              }`} style={!isOverdue ? { backgroundColor: "var(--surface-2)" } : {}}>
                {dueLabel}
              </span>
            )}
            {task.recurrence !== "none" && (
              <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted" style={{ backgroundColor: "var(--surface-2)" }}>
                {RECURRENCE_LABELS[task.recurrence]}
              </span>
            )}
            {hasSubtasks && (
              <span className="font-mono text-[11px] text-muted">{doneCount}/{task.subtasks.length}</span>
            )}
          </div>
        )}

        {/* Actions */}
        {editing ? (
          <div className="flex items-center gap-2 ml-1">
            <button onClick={commitEdit} className="rounded-full bg-grad px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-paper">Save</button>
            <button onClick={cancelEdit} className="font-mono text-[10px] text-muted hover:text-soft">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setExpanded(x => !x)} aria-label="Expand"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-soft transition-colors"
              style={{ backgroundColor: "var(--surface-2)" }}>
              <span className="font-mono text-[9px]">{expanded ? "▲" : "▼"}</span>
            </button>
            <button onClick={startEdit} aria-label="Edit"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-soft transition-colors"
              style={{ backgroundColor: "var(--surface-2)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button onClick={onDelete} aria-label="Delete"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-warn transition-colors"
              style={{ backgroundColor: "var(--surface-2)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="flex flex-wrap gap-2 px-5 pb-4 pt-1 border-t border-line-soft">
          <div className="flex gap-1.5 flex-wrap">
            {RECURRENCE_OPTIONS.map(opt => (
              <button type="button" key={opt} onClick={() => setEditRecurrence(opt)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wide transition-all ${
                  editRecurrence === opt ? "bg-grad text-paper" : "border border-line text-muted hover:border-gradA"
                }`} style={editRecurrence !== opt ? { backgroundColor: "var(--surface-2)" } : {}}>
                {RECURRENCE_LABELS[opt]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
              className="rounded-lg border border-line px-2.5 py-1 font-mono text-[10px] text-muted focus:border-gradA focus:text-bright focus:outline-none"
              style={{ backgroundColor: "var(--surface-2)" }} />
            {editDue && <button type="button" onClick={() => setEditDue("")} className="font-mono text-[10px] text-muted hover:text-warn">Clear</button>}
          </div>
        </div>
      )}

      {/* Subtasks panel */}
      {expanded && !editing && (
        <div className="px-5 pb-4 pt-1 border-t border-line-soft">
          {task.subtasks.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {task.subtasks.map(s => (
                <SubtaskItem key={s.id} subtask={s}
                  onToggle={c => onToggleSubtask(s.id, c)}
                  onDelete={() => onDeleteSubtask(s.id)} />
              ))}
            </ul>
          )}
          <form onSubmit={handleSubtaskAdd} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 focus-within:border-gradA transition-colors" style={{ backgroundColor: "var(--surface-2)" }}>
            <span className="font-mono text-[10px] text-muted">↳</span>
            <input value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)}
              placeholder="Add a subtask…"
              className="flex-1 bg-transparent font-body text-xs text-bright placeholder:text-muted focus:outline-none"
              maxLength={200} />
            <button type="submit" disabled={!subtaskInput.trim()}
              className="font-mono text-[10px] uppercase tracking-wide text-gradA disabled:text-muted transition-colors grad-text disabled:[background:none] disabled:[-webkit-text-fill-color:var(--muted)]">
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
    <li className="group/sub flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surfaceHov">
      <button onClick={() => onToggle(!subtask.completed)}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
          subtask.completed ? "border-transparent bg-grad text-paper" : "border-line text-transparent hover:border-gradA"
        }`}>
        <svg width="7" height="6" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <span className={`flex-1 font-body text-[13px] ${subtask.completed ? "text-muted line-through" : "text-soft"}`}>
        {subtask.title}
      </span>
      <button onClick={onDelete}
        className="font-mono text-sm text-muted opacity-0 hover:text-warn group-hover/sub:opacity-100 transition-all">×</button>
    </li>
  );
}
