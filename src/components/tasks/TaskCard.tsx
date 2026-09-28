import { motion } from "framer-motion";
import { useState } from "react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { priorityBorderColors, priorityStyles } from "@/lib/badge-colors";
import {
  ArrowUpCircle,
  Bug,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  PRIORITY_ICONS,
  TASK_STATUSES,
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

export type TaskCardProps = {
  task: any;
  /** Fired by the drag-and-drop board when a card is dropped on a column. */
  onMove: (task: any, status: string) => void;
  onOpen: (task: any) => void;
  onEdit: (task: any) => void;
  onDelete: (task: any) => void;
  onToggleComplete: (task: any) => void;
};

/**
 * A single work item as it appears on the Tasks Kanban board.
 *
 * Draggable with the native HTML5 drag-and-drop API, but every mutation is also
 * reachable from the overflow menu so the board stays usable on touch devices
 * that do not fire drag events.
 */
export default function TaskCard({
  task,
  onMove,
  onOpen,
  onEdit,
  onDelete,
  onToggleComplete,
}: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const done = isCompleted(task);
  const overdue = isOverdue(task);

  const PriorityIcon =
    PRIORITY_ICONS[(task.priority as TaskPriority) ?? "medium"] ??
    PRIORITY_ICONS.medium;
  const TypeIcon = TYPE_ICONS[task.type] ?? ListTodo;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: isDragging ? 1.02 : 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={(event: any) => {
        event.dataTransfer.setData("text/plain", task._id);
        event.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={cn(
        "glass-card group relative border-l-[3px] p-3 transition-shadow",
        isDragging ? "opacity-60 shadow-lg" : "cursor-grab active:cursor-grabbing",
      )}
      style={{
        borderLeftColor: priorityBorderColors[task.priority] ?? undefined,
      }}
    >
      <div className="flex items-start gap-2">
        <TypeIcon
          className={cn(
            "mt-0.5 w-3.5 h-3.5 shrink-0",
            task.type === "bug" ? "text-red-500" : "text-muted-foreground",
          )}
        />

        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            "flex-1 text-left text-sm font-medium leading-snug rounded-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${task.title}`}
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/50 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 glass-card">
            <DropdownMenuItem onClick={() => onOpen(task)}>Open details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="mr-2 w-3.5 h-3.5" /> Edit task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleComplete(task)}>
              <CheckCircle2 className="mr-2 w-3.5 h-3.5" />
              {done ? "Reopen task" : "Mark complete"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Move to
            </DropdownMenuLabel>
            {TASK_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status.id}
                disabled={task.status === status.id}
                onClick={() => onMove(task, status.id)}
              >
                {status.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(task)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 w-3.5 h-3.5" /> Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge
          className="gap-1 text-[10px]"
          style={priorityStyles[task.priority]}
        >
          <PriorityIcon className="w-2.5 h-2.5" />
          {priorityLabel(task.priority)}
        </Badge>

        <Badge variant="outline" className="text-[10px]">
          {statusLabel(task.status)}
        </Badge>

        {task.storyPoints ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
            {task.storyPoints} SP
          </Badge>
        ) : null}

        {task.labels?.slice(0, 2).map((label: string) => (
          <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {label}
          </Badge>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          {task.dueDate ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px]",
                overdue ? "font-semibold text-destructive" : "text-muted-foreground",
              )}
            >
              <CalendarDays className="w-3 h-3" />
              {describeDueDate(task.dueDate)}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">No due date</span>
          )}
        </div>

        {task.assignee ? (
          <div className="flex shrink-0 items-center gap-1" title={task.assignee.name ?? "Assignee"}>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
              {task.assignee.name?.charAt(0) ?? "?"}
            </div>
            <span className="max-w-[72px] truncate text-[10px] text-muted-foreground">
              {task.assignee.name?.split(" ")[0]}
            </span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
