"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Task, Subtask, Recurrence,
  RECURRENCE_LABELS, isPending, todayStr, dueSoonLabel,
} from "@/lib/recurrence";

const RECURRENCE_OPTIONS: Recurrence[] = ["none", "daily", "weekly", "monthly"];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load tasks.");
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTasks(); }, []);

  const { pending, done } = useMemo(() => {
    const now = new Date();
    const pending: Task[] = [];
    const done: Task[] = [];
    for (const t of tasks) {
      (isPending(t, now) ? pending : done).push(t);
    }
    pending.sort((a, b) => {
      const da = a.due_date ?? "9999-99-99";
      const db = b.due_date ?? "9999-99-99";
      return da < db ? -1 : da > db ? 1 : 0;
    });
    return { pending, done };
  }, [tasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, recurrence, due_date: dueDate || null }),
      });
      if (!res.ok) throw new Error("Could not add that task.");
      setTitle(""); setRecurrence("none"); setDueDate("");
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeTask(id: string) {
    const today = todayStr();
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, last_completed_on: today } : t));
    try {
      const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error();
      await loadTasks();
    } catch { setError("Could not mark complete."); await loadTasks(); }
  }

  async function undoComplete(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, last_completed_on: null } : t));
    try {
      const res = await fetch(`/api/tasks/${id}/complete`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadTasks();
    } catch { setError("Could not undo."); await loadTasks(); }
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await fetch(`/api/tasks/${id}`, { method: "DELETE" }); }
    catch { await loadTasks(); }
  }

  async function saveTaskEdit(id: string, updates: { title?: string; recurrence?: Recurrence; due_date?: string | null }) {
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Could not save changes.");
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function addSubtask(taskId: string, title: string) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Could not add subtask.");
    await loadTasks();
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    setTasks((prev) => prev.map((t) => ({
      ...t,
      subtasks: t.subtasks.map((s) => s.id === subtaskId ? { ...s, completed } : s),
    })));
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
    } catch { await loadTasks(); }
  }

  async function deleteSubtask(subtaskId: string) {
    setTasks((prev) => prev.map((t) => ({
      ...t,
      subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
    })));
    try { await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" }); }
    catch { await loadTasks(); }
  }

  return (
    <div>
      {/* Add task form */}
      <form onSubmit={addTask} className="mb-10 flex flex-col gap-3">
        <div className="flex gap-2 border-b border-line pb-2 focus-within:border-gradA transition-colors">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add something to do…"
            className="flex-1 bg-transparent font-body text-base text-bright placeholder:text-muted focus:outline-none"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="font-mono text-xs uppercase tracking-wider grad-text disabled:text-muted disabled:[background:none] disabled:[-webkit-text-fill-color:#5A5A72]"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button type="button" key={opt} onClick={() => setRecurrence(opt)}
                className={`rounded-sm px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                  recurrence === opt
                    ? "bg-grad text-paper"
                    : "bg-surface text-soft border border-line hover:border-gradA"
                }`}>
                {RECURRENCE_LABELS[opt]}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ml-auto rounded-sm border border-line bg-surface px-2 py-1 font-mono text-[11px] text-muted focus:border-gradA focus:text-bright focus:outline-none"
            title="Due date (optional)"
          />
        </div>
      </form>

      {error && <p className="mb-6 font-mono text-xs text-warn">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <SectionLabel count={pending.length}>To do</SectionLabel>
            {pending.length === 0 ? (
              <EmptyState>Nothing pending. Good place to be.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-1">
                {pending.map((t) => (
                  <TaskRow key={t.id} task={t}
                    onComplete={() => completeTask(t.id)}
                    onDelete={() => deleteTask(t.id)}
                    onSave={(u) => saveTaskEdit(t.id, u)}
                    onAddSubtask={(title) => addSubtask(t.id, title)}
                    onToggleSubtask={toggleSubtask}
                    onDeleteSubtask={deleteSubtask}
                  />
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <SectionLabel count={done.length}>Done for now</SectionLabel>
              <ul className="flex flex-col gap-1">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} completed
                    onUndo={() => undoComplete(t.id)}
                    onDelete={() => deleteTask(t.id)}
                    onSave={(u) => saveTaskEdit(t.id, u)}
                    onAddSubtask={(title) => addSubtask(t.id, title)}
                    onToggleSubtask={toggleSubtask}
                    onDeleteSubtask={deleteSubtask}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task, completed = false,
  onComplete, onUndo, onDelete, onSave, onAddSubtask, onToggleSubtask, onDeleteSubtask,
}: {
  task: Task; completed?: boolean;
  onComplete?: () => void; onUndo?: () => void; onDelete: () => void;
  onSave: (u: { title?: string; recurrence?: Recurrence; due_date?: string | null }) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
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

  function startEdit() {
    setEditTitle(task.title);
    setEditRecurrence(task.recurrence);
    setEditDue(task.due_date ?? "");
    setEditing(true);
    setExpanded(true);
  }

  function cancelEdit() { setEditing(false); }

  function commitEdit() {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    onSave({ title: trimmed, recurrence: editRecurrence, due_date: editDue || null });
    setEditing(false);
  }

  function handleSubtaskAdd(e: React.FormEvent) {
    e.preventDefault();
    const t = subtaskInput.trim();
    if (!t) return;
    setSubtaskInput("");
    onAddSubtask(t);
  }

  const dueLabel = dueSoonLabel(task.due_date);
  const isOverdue = dueLabel === "Overdue";
  const hasSubtasks = task.subtasks.length > 0;
  const doneSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <li className="group rounded border border-transparent hover:border-line hover:bg-surfaceHov transition-colors">
      <div className="flex items-center gap-3 px-2 py-2.5">
        {/* Complete / undo button */}
        <button
          onClick={completed ? onUndo : onComplete}
          aria-label={completed ? "Undo completion" : "Mark done"}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
            completed
              ? "border-gradB bg-grad text-paper"
              : "border-line text-transparent hover:border-gradA"
          }`}
        >
          <CheckIcon />
        </button>

        {editing ? (
          <input
            ref={editRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="flex-1 bg-transparent font-body text-[15px] text-bright focus:outline-none"
            maxLength={200}
          />
        ) : (
          <button
            onClick={() => setExpanded((x) => !x)}
            className={`flex-1 text-left font-body text-[15px] transition-colors ${
              completed ? "text-muted line-through decoration-muted/60" : "text-bright"
            }`}
          >
            {task.title}
          </button>
        )}

        {/* Badges */}
        <div className="flex shrink-0 items-center gap-2">
          {dueLabel && !editing && (
            <span className={`font-mono text-[10px] uppercase tracking-wide ${
              isOverdue ? "text-warn" : "text-soft"
            }`}>
              {dueLabel}
            </span>
          )}
          {task.recurrence !== "none" && !editing && (
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
              {RECURRENCE_LABELS[task.recurrence]}
            </span>
          )}
          {hasSubtasks && !editing && (
            <span className="font-mono text-[10px] text-muted">
              {doneSubtasks}/{task.subtasks.length}
            </span>
          )}
        </div>

        {/* Actions */}
        {editing ? (
          <div className="flex gap-2">
            <button onClick={commitEdit} className="font-mono text-xs grad-text">Save</button>
            <button onClick={cancelEdit} className="font-mono text-xs text-muted">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={startEdit} aria-label="Edit task"
              className="font-mono text-xs text-muted hover:text-soft">✎</button>
            <button onClick={onDelete} aria-label="Delete task"
              className="font-mono text-xs text-muted hover:text-warn">×</button>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="flex flex-wrap gap-2 px-10 pb-3">
          <div className="flex gap-1">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button type="button" key={opt} onClick={() => setEditRecurrence(opt)}
                className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                  editRecurrence === opt
                    ? "bg-grad text-paper"
                    : "bg-surface text-soft border border-line hover:border-gradA"
                }`}>
                {RECURRENCE_LABELS[opt]}
              </button>
            ))}
          </div>
          <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)}
            className="rounded-sm border border-line bg-surface px-2 py-0.5 font-mono text-[10px] text-muted focus:border-gradA focus:text-bright focus:outline-none"
          />
          {editDue && (
            <button type="button" onClick={() => setEditDue("")}
              className="font-mono text-[10px] text-muted hover:text-warn">Clear date</button>
          )}
        </div>
      )}

      {/* Subtasks panel */}
      {expanded && !editing && (
        <div className="px-10 pb-3">
          {task.subtasks.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1.5">
              {task.subtasks.map((s) => (
                <SubtaskRow key={s.id} subtask={s}
                  onToggle={(c) => onToggleSubtask(s.id, c)}
                  onDelete={() => onDeleteSubtask(s.id)}
                />
              ))}
            </ul>
          )}
          <form onSubmit={handleSubtaskAdd} className="flex gap-2">
            <input
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              placeholder="Add subtask…"
              className="flex-1 border-b border-line bg-transparent font-body text-xs text-bright placeholder:text-muted focus:border-gradA focus:outline-none transition-colors"
              maxLength={200}
            />
            <button type="submit" disabled={!subtaskInput.trim()}
              className="font-mono text-[10px] uppercase tracking-wide grad-text disabled:text-muted disabled:[background:none] disabled:[-webkit-text-fill-color:#5A5A72]">
              Add
            </button>
          </form>
        </div>
      )}

      {/* Expand chevron */}
      {!editing && (
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex w-full items-center justify-center pb-1 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <span className="font-mono text-[9px] text-muted">{expanded ? "▲" : "▼"}</span>
        </button>
      )}
    </li>
  );
}

function SubtaskRow({
  subtask, onToggle, onDelete,
}: {
  subtask: Subtask;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <li className="group/sub flex items-center gap-2">
      <button
        onClick={() => onToggle(!subtask.completed)}
        aria-label={subtask.completed ? "Mark not done" : "Mark done"}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
          subtask.completed
            ? "border-gradB bg-grad text-paper"
            : "border-line text-transparent hover:border-gradA"
        }`}
      >
        <CheckIcon size={7} />
      </button>
      <span className={`flex-1 font-body text-xs ${
        subtask.completed ? "text-muted line-through" : "text-soft"
      }`}>
        {subtask.title}
      </span>
      <button onClick={onDelete} aria-label="Delete subtask"
        className="font-mono text-xs text-muted opacity-0 hover:text-warn group-hover/sub:opacity-100">
        ×
      </button>
    </li>
  );
}

function CheckIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
      {children}
      <span className="text-muted/50">{count}</span>
    </h2>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed border-line px-4 py-6 text-center font-body text-sm text-muted">
      {children}
    </p>
  );
}
