import { AlertOctagon, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Shared vocabulary for the AIE Tasks module.
 *
 * These mirror the Convex `tasks` table validators exactly, so the UI and the
 * backend never drift apart.
 */

export type TaskStatus = "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskType = "task" | "bug" | "subtask";

export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

export const TASK_PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

export const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: "task", label: "Task" },
  { id: "bug", label: "Bug" },
  { id: "subtask", label: "Subtask" },
];

/** Lower rank sorts first, so "critical" rises to the top. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Priority icons exist so priority is never communicated by colour alone —
 * every badge carries both an icon and a text label.
 */
export const PRIORITY_ICONS: Record<
  TaskPriority,
  ComponentType<{ className?: string }>
> = {
  critical: AlertOctagon,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
};

export type TaskLike = {
  _id: string;
  title?: string;
  status?: string;
  priority?: string;
  dueDate?: number | null;
};

export function statusLabel(status?: string): string {
  return TASK_STATUSES.find((s) => s.id === status)?.label ?? "To Do";
}

export function priorityLabel(priority?: string): string {
  return TASK_PRIORITIES.find((p) => p.id === priority)?.label ?? "Medium";
}

export function isCompleted(task: TaskLike): boolean {
  return task.status === "done";
}

/** Midnight of the current day in the viewer's local timezone. */
export function startOfToday(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

const ONE_DAY = 24 * 60 * 60 * 1000;

/** Past due and not finished. */
export function isOverdue(task: TaskLike): boolean {
  if (!task.dueDate || isCompleted(task)) return false;
  return task.dueDate < startOfToday();
}

/** Due later today and not finished. */
export function isDueToday(task: TaskLike): boolean {
  if (!task.dueDate || isCompleted(task)) return false;
  const start = startOfToday();
  return task.dueDate >= start && task.dueDate < start + ONE_DAY;
}

export function formatDueDate(timestamp?: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Human label combining relative wording with the calendar date. */
export function describeDueDate(timestamp?: number | null): string {
  if (!timestamp) return "";
  const start = startOfToday();
  if (timestamp < start) return `Overdue · ${formatDueDate(timestamp)}`;
  if (timestamp < start + ONE_DAY) return "Due today";
  if (timestamp < start + 2 * ONE_DAY) return "Due tomorrow";
  return formatDueDate(timestamp);
}
