export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  recurrence: Recurrence;
  archived: boolean;
  due_date: string | null;
  category: string;
  created_at: string;
  last_completed_on: string | null;
  subtasks: Subtask[];
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const diff = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isPending(task: Task, now: Date = new Date()): boolean {
  if (!task.last_completed_on) return true;
  const last = new Date(task.last_completed_on + "T00:00:00");
  switch (task.recurrence) {
    case "none":    return false;
    case "daily":   return toDateStr(last) !== toDateStr(now);
    case "weekly":  return last < startOfWeek(now);
    case "monthly": return last < startOfMonth(now);
    default:        return true;
  }
}

export function dueSoonLabel(due: string | null): string | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return "Overdue";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7)  return `Due in ${diff} days`;
  return null; // far away — don't clutter the UI
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none:    "One-time",
  daily:   "Daily",
  weekly:  "Weekly",
  monthly: "Monthly",
};
