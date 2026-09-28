import { motion } from "framer-motion";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { priorityStyles } from "@/lib/badge-colors";
import {
  ArrowUpCircle,
  Bug,
  CalendarDays,
  ListTodo,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  PRIORITY_ICONS,
  describeDueDate,
  isCompleted,
  isOverdue,
  priorityLabel,
  statusLabel,
} from "./task-utils";
import type { TaskPriority } from "./task-utils";

const TYPE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  task: ListTodo,
  bug: Bug,
  subtask: ArrowUpCircle,
};

export type TaskListRowProps = {
  task: any;
  onOpen: (task: any) => void;
  onEdit: (task: any) => void;
  onDelete: (task: any) => void;
  onToggleComplete: (task: any) => void;
};

/** Compact list representation of a work item, used by the Tasks list view. */
export default function TaskListRow({
  task,
  onOpen,
  onEdit,
  onDelete,
  onToggleComplete,
}: TaskListRowProps) {
  const done = isCompleted(task);
  const overdue = isOverdue(task);
  const PriorityIcon =
    PRIORITY_ICONS[(task.priority as TaskPriority) ?? "medium"] ??
    PRIORITY_ICONS.medium;
  const TypeIcon = TYPE_ICONS[task.type] ?? ListTodo;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="glass-card group flex items-start gap-3 p-3 sm:items-center sm:p-4"
    >
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggleComplete(task)}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className="mt-0.5 shrink-0 sm:mt-0"
      />

      <TypeIcon
        className={cn(
          "mt-1 w-4 h-4 shrink-0 sm:mt-0",
          task.type === "bug" ? "text-red-500" : "text-muted-foreground",
        )}
      />

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            "block w-full truncate rounded-sm text-left text-sm font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {task.project?.name && <span className="truncate">{task.project.name}</span>}
          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "font-semibold text-destructive",
              )}
            >
              <CalendarDays className="w-3 h-3" />
              {describeDueDate(task.dueDate)}
            </span>
          )}
          {task.description && (
            <span className="hidden min-w-0 flex-1 truncate sm:inline">
              {task.description}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        <Badge className="gap-1 text-[10px]" style={priorityStyles[task.priority]}>
          <PriorityIcon className="w-2.5 h-2.5" />
          {priorityLabel(task.priority)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {statusLabel(task.status)}
        </Badge>
        {task.storyPoints ? (
          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
            {task.storyPoints} SP
          </Badge>
        ) : null}
        {task.assignee ? (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
            title={task.assignee.name ?? "Assignee"}
          >
            {task.assignee.name?.charAt(0) ?? "?"}
          </div>
        ) : null}

        <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
            className="rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            aria-label={`Delete ${task.title}`}
            className="rounded p-1 text-destructive hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
