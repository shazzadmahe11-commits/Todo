export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  recurrence: Recurrence;
  archived: boolean;
  created_at: string;
  last_completed_on: string | null;
}

// Returns YYYY-MM-DD for "today" — computed on whichever machine calls it.
// Client and server both just use the browser/server's local date, which is
// fine for a single-user personal app.
export function todayStr(): string {
  const d = new Date();
  return toDateStr(d);
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0 = Sunday
  const diff = (dow + 6) % 7; // days since Monday
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// A task is "pending" (should show in the active list) if it has never been
// completed in its current recurrence window.
export function isPending(task: Task, now: Date = new Date()): boolean {
  if (!task.last_completed_on) return true;

  const last = new Date(task.last_completed_on + "T00:00:00");

  switch (task.recurrence) {
    case "none":
      return false; // one-off tasks are archived on completion, but just in case
    case "daily":
      return toDateStr(last) !== toDateStr(now);
    case "weekly":
      return last < startOfWeek(now);
    case "monthly":
      return last < startOfMonth(now);
    default:
      return true;
  }
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};
