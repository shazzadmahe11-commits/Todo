"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Task,
  Recurrence,
  RECURRENCE_LABELS,
  isPending,
  todayStr,
} from "@/lib/recurrence";

const RECURRENCE_OPTIONS: Recurrence[] = ["none", "daily", "weekly", "monthly"];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
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

  useEffect(() => {
    loadTasks();
  }, []);

  const { pending, done } = useMemo(() => {
    const now = new Date();
    const pending: Task[] = [];
    const done: Task[] = [];
    for (const t of tasks) {
      (isPending(t, now) ? pending : done).push(t);
    }
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
        body: JSON.stringify({ title: trimmed, recurrence }),
      });
      if (!res.ok) throw new Error("Could not add that task.");
      setTitle("");
      setRecurrence("none");
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeTask(id: string) {
    // optimistic update
    const today = todayStr();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, last_completed_on: today } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("Could not mark that complete.");
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      await loadTasks();
    }
  }

  async function undoComplete(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, last_completed_on: null } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${id}/complete`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not undo that.");
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      await loadTasks();
    }
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete that task.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      await loadTasks();
    }
  }

  return (
    <div>
      <form onSubmit={addTask} className="mb-10 flex flex-col gap-3">
        <div className="flex gap-2 border-b border-line pb-2 focus-within:border-ink">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add something to do…"
            className="flex-1 bg-transparent font-body text-base text-ink placeholder:text-muted focus:outline-none"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="font-mono text-xs uppercase tracking-wider text-accent disabled:text-muted"
          >
            Add
          </button>
        </div>
        <div className="flex gap-1.5">
          {RECURRENCE_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => setRecurrence(opt)}
              className={`rounded-sm px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                recurrence === opt
                  ? "bg-accent text-paper"
                  : "bg-accentSoft text-accent hover:bg-accent/20"
              }`}
            >
              {RECURRENCE_LABELS[opt]}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <p className="mb-6 font-mono text-xs text-warn">{error}</p>
      )}

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
                  <TaskRow
                    key={t.id}
                    task={t}
                    onComplete={() => completeTask(t.id)}
                    onDelete={() => deleteTask(t.id)}
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
                  <TaskRow
                    key={t.id}
                    task={t}
                    completed
                    onUndo={() => undoComplete(t.id)}
                    onDelete={() => deleteTask(t.id)}
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

function SectionLabel({
  children,
  count,
}: {
  children: React.ReactNode;
  count: number;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
      {children}
      <span className="text-muted/60">{count}</span>
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

function TaskRow({
  task,
  completed = false,
  onComplete,
  onUndo,
  onDelete,
}: {
  task: Task;
  completed?: boolean;
  onComplete?: () => void;
  onUndo?: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 rounded px-1 py-2.5 hover:bg-accentSoft/50">
      <button
        onClick={completed ? onUndo : onComplete}
        aria-label={completed ? "Mark not done" : "Mark done"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          completed
            ? "border-accent bg-accent text-paper"
            : "border-muted/60 text-transparent hover:border-accent"
        }`}
      >
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <span
        className={`flex-1 font-body text-[15px] ${
          completed ? "text-muted line-through decoration-muted/60" : "text-ink"
        }`}
      >
        {task.title}
      </span>

      {task.recurrence !== "none" && (
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
          {RECURRENCE_LABELS[task.recurrence]}
        </span>
      )}

      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="ml-1 shrink-0 font-mono text-xs text-muted opacity-0 transition-opacity hover:text-warn group-hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
