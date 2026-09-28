import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { priorityStyles } from "@/lib/badge-colors";
import {
  ArrowUpCircle,
  Bug,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  Layers,
  ListTodo,
  Pencil,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import {
  PRIORITY_ICONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  describeDueDate,
  isCompleted,
  isOverdue,
  priorityLabel,
} from "./task-utils";
import type { TaskPriority } from "./task-utils";

const TYPE_META: Record<string, { label: string; icon: typeof ListTodo }> = {
  task: { label: "Task", icon: ListTodo },
  bug: { label: "Bug", icon: Bug },
  subtask: { label: "Subtask", icon: ArrowUpCircle },
};

export type TaskDetailSheetProps = {
  task: any | null;
  open: boolean;
  onClose: () => void;
  onEdit: (task: any) => void;
  onDelete: (task: any) => void;
  onStatusChange: (task: any, status: string) => void;
  onPriorityChange: (task: any, priority: string) => void;
  onToggleComplete: (task: any) => void;
};

/**
 * Full task details in a side sheet.
 *
 * This is also the keyboard/pointer-friendly way to change status, so the board
 * never depends on drag-and-drop alone.
 */
export default function TaskDetailSheet({
  task,
  open,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onToggleComplete,
}: TaskDetailSheetProps) {
  if (!task) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="right" className="glass-card" />
      </Sheet>
    );
  }

  const done = isCompleted(task);
  const overdue = isOverdue(task);
  const typeMeta = TYPE_META[task.type] ?? TYPE_META.task;
  const TypeIcon = typeMeta.icon;
  const PriorityIcon =
    PRIORITY_ICONS[(task.priority as TaskPriority) ?? "medium"] ??
    PRIORITY_ICONS.medium;

  const createdLabel = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="glass-card w-full gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="gap-3 border-b border-border/50 p-5 pr-12">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TypeIcon className="w-3.5 h-3.5" />
            <span>{typeMeta.label}</span>
            {task.project?.name && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{task.project.name}</span>
              </>
            )}
          </div>
          <SheetTitle className={cn("text-lg leading-snug", done && "line-through opacity-70")}>
            {task.title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Details and controls for this work item
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={done ? "outline" : "default"}
              onClick={() => onToggleComplete(task)}
              className="gap-1.5"
            >
              {done ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" /> Reopen
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark complete
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(task)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(task)}
              className="gap-1.5 text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>

          {/* Status & priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <Select
                value={task.status}
                onValueChange={(value) => onStatusChange(task, value)}
              >
                <SelectTrigger aria-label="Task status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Priority
              </label>
              <Select
                value={task.priority}
                onValueChange={(value) => onPriorityChange(task, value)}
              >
                <SelectTrigger aria-label="Task priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority.id} value={priority.id}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {task.description || (
                <span className="text-muted-foreground">No description yet.</span>
              )}
            </p>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 p-3 text-sm">
            <MetaRow icon={PriorityIcon} label="Priority">
              <Badge className="gap-1 text-[10px]" style={priorityStyles[task.priority]}>
                <PriorityIcon className="w-2.5 h-2.5" />
                {priorityLabel(task.priority)}
              </Badge>
            </MetaRow>

            <MetaRow icon={User} label="Assignee">
              {task.assignee?.name || (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </MetaRow>

            <MetaRow icon={CalendarClock} label="Due">
              {task.dueDate ? (
                <span className={cn(overdue && "font-semibold text-destructive")}>
                  {describeDueDate(task.dueDate)}
                </span>
              ) : (
                <span className="text-muted-foreground">No due date</span>
              )}
            </MetaRow>

            <MetaRow icon={Layers} label="Story points">
              {task.storyPoints ?? <span className="text-muted-foreground">—</span>}
            </MetaRow>

            <MetaRow icon={FolderKanban} label="Project">
              {task.project?.name || <span className="text-muted-foreground">—</span>}
            </MetaRow>

            <MetaRow icon={CalendarClock} label="Created">
              {createdLabel}
            </MetaRow>
          </div>

          {/* Labels */}
          {task.labels?.length ? (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Labels
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map((label: string) => (
                  <Badge key={label} variant="secondary" className="text-[10px]">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {task.sprint?.name ? (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sprint
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {task.sprint.name}
              </Badge>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="truncate text-sm">{children}</div>
    </div>
  );
}
