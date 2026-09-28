import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TaskCard from "@/components/tasks/TaskCard";
import TaskListRow from "@/components/tasks/TaskListRow";
import TaskFormDialog from "@/components/tasks/TaskFormDialog";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import {
  PRIORITY_RANK,
  TASK_PRIORITIES,
  TASK_STATUSES,
  isCompleted,
  isDueToday,
  isOverdue,
  statusLabel,
} from "@/components/tasks/task-utils";
import type { TaskPriority, TaskStatus } from "@/components/tasks/task-utils";
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Columns3,
  Flame,
  Inbox,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

type SortKey = "newest" | "oldest" | "priority" | "due";
type DueFilter = "all" | "today" | "overdue";
type Scope = "all" | "mine";
type ViewMode = "list" | "board";

/* ── Stat tile ────────────────────────────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: "primary" | "success" | "warning" | "danger" | "muted";
  hint?: string;
}) {
  const toneClasses: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-emerald-500 bg-emerald-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    danger: "text-destructive bg-destructive/10",
    muted: "text-muted-foreground bg-muted/60",
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            toneClasses[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function Tasks() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [scope, setScope] = useState<Scope>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [formDefaultStatus, setFormDefaultStatus] = useState<string>("todo");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [confirmClearCompleted, setConfirmClearCompleted] = useState(false);

  const projects = useQuery(api.projects.list);
  const members = useQuery(api.team.listMembers);

  const workspaceArgs = useMemo(
    () => (scope === "mine" && user?._id ? { assigneeId: user._id } : {}),
    [scope, user?._id],
  );
  const tasks = useQuery(api.tasks.listWorkspace, workspaceArgs);

  const updateStatus = useMutation(api.tasks.updateStatus);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const bulkDelete = useMutation(api.tasks.bulkDelete);

  const isLoading = tasks === undefined;

  /* ── Derived data ───────────────────────────────────────────── */

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    const query = search.trim().toLowerCase();

    const result = tasks.filter((task) => {
      if (query) {
        const haystack = [
          task.title,
          task.description ?? "",
          ...(task.labels ?? []),
          task.project?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (dueFilter === "today" && !isDueToday(task)) return false;
      if (dueFilter === "overdue" && !isOverdue(task)) return false;
      return true;
    });

    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        case "priority":
          return (
            (PRIORITY_RANK[a.priority as TaskPriority] ?? 99) -
            (PRIORITY_RANK[b.priority as TaskPriority] ?? 99)
          );
        case "due": {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate - b.dueDate;
        }
        case "newest":
        default:
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
    });
    return sorted;
  }, [tasks, search, statusFilter, priorityFilter, dueFilter, sort]);

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const completed = all.filter(isCompleted).length;
    const inProgress = all.filter((task) => task.status === "in-progress").length;
    const highPriority = all.filter(
      (task) => !isCompleted(task) && (task.priority === "high" || task.priority === "critical"),
    ).length;
    const overdue = all.filter(isOverdue).length;
    const total = all.length;
    return {
      total,
      completed,
      inProgress,
      highPriority,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks]);

  const completedVisible = useMemo(
    () => filteredTasks.filter(isCompleted),
    [filteredTasks],
  );

  const boardColumns = useMemo(() => {
    const grouped: Record<string, any[]> = {
      todo: [],
      "in-progress": [],
      review: [],
      done: [],
    };
    filteredTasks.forEach((task) => {
      (grouped[task.status] ?? grouped.todo).push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    dueFilter !== "all";

  const detailTask = useMemo(
    () => (tasks ?? []).find((task) => task._id === detailTaskId) ?? null,
    [tasks, detailTaskId],
  );

  const defaultProjectId = projects?.[0]?._id;

  /* ── Handlers ───────────────────────────────────────────────── */

  const handleMove = async (task: any, status: string) => {
    if (!task || task.status === status) return;
    try {
      await updateStatus({ taskId: task._id, status: status as any });
      toast.success(`Moved to ${statusLabel(status)}`);
    } catch (error) {
      console.error("Failed to move task:", error);
      toast.error("Failed to move task");
    }
  };

  const handleDrop = (event: React.DragEvent, status: string) => {
    event.preventDefault();
    setDragOverStatus(null);
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = (tasks ?? []).find((item) => item._id === taskId);
    if (task) handleMove(task, status);
  };

  const handleToggleComplete = async (task: any) => {
    const nextStatus = isCompleted(task) ? "todo" : "done";
    try {
      await updateStatus({ taskId: task._id, status: nextStatus as any });
      toast.success(nextStatus === "done" ? "Task completed" : "Task reopened");
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    }
  };

  const handlePriorityChange = async (task: any, priority: string) => {
    try {
      await updateTask({ taskId: task._id, priority: priority as any });
      toast.success(`Priority set to ${priority}`);
    } catch (error) {
      console.error("Failed to update priority:", error);
      toast.error("Failed to update priority");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await removeTask({ taskId: pendingDelete._id });
      toast.success("Task deleted");
      if (detailTaskId === pendingDelete._id) setDetailTaskId(null);
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("Failed to delete task");
    } finally {
      setPendingDelete(null);
    }
  };

  const handleClearCompleted = async () => {
    const ids = completedVisible.map((task) => task._id);
    if (ids.length === 0) return;
    try {
      await bulkDelete({ taskIds: ids as any });
      toast.success(`Cleared ${ids.length} completed task${ids.length === 1 ? "" : "s"}`);
      setDetailTaskId(null);
    } catch (error) {
      console.error("Failed to clear completed tasks:", error);
      toast.error("Failed to clear completed tasks");
    } finally {
      setConfirmClearCompleted(false);
    }
  };

  const openCreateForm = (status = "todo") => {
    setEditingTask(null);
    setFormDefaultStatus(status);
    setShowForm(true);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDueFilter("all");
  };

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Plan, track and ship work items across your projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openCreateForm()} className="gap-2">
            <Plus className="w-4 h-4" /> New Task
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More task actions">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card">
              <DropdownMenuItem
                disabled={completedVisible.length === 0}
                onClick={() => setConfirmClearCompleted(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 w-4 h-4" />
                Clear completed ({completedVisible.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile icon={Inbox} label="Total" value={stats.total} tone="muted" />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          tone="success"
          hint={`${stats.completionRate}% completion rate`}
        />
        <StatTile icon={CircleDot} label="In Progress" value={stats.inProgress} tone="primary" />
        <StatTile icon={Flame} label="High Priority" value={stats.highPriority} tone="warning" />
        <StatTile icon={CalendarClock} label="Overdue" value={stats.overdue} tone="danger" />
      </div>

      {/* Completion progress */}
      <div className="glass-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium">Overall completion</span>
          <span className="tabular-nums text-muted-foreground">
            {stats.completed} of {stats.total} tasks · {stats.completionRate}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.completionRate}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full aie-gradient"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, descriptions, labels…"
              aria-label="Search tasks"
              className="pl-9"
            />
          </div>

          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TASK_PRIORITIES.map((priority) => (
                <SelectItem key={priority.id} value={priority.id}>
                  {priority.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as DueFilter)}>
            <SelectTrigger className="w-[130px]" aria-label="Filter by due date">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any due date</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[140px]" aria-label="Sort tasks">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="due">Due date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label="All"
            />
            {TASK_STATUSES.map((status) => (
              <FilterChip
                key={status.id}
                active={statusFilter === status.id}
                onClick={() => setStatusFilter(status.id)}
                label={status.label}
              />
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Scope toggle */}
            <div className="flex rounded-xl glass-card p-0.5" role="group" aria-label="Task scope">
              <ScopeButton active={scope === "all"} onClick={() => setScope("all")}>
                All work
              </ScopeButton>
              <ScopeButton active={scope === "mine"} onClick={() => setScope("mine")}>
                Assigned to me
              </ScopeButton>
            </div>

            {/* View toggle */}
            <div className="flex rounded-xl glass-card p-0.5" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                aria-label="List view"
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                aria-pressed={view === "board"}
                aria-label="Board view"
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "board"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Columns3 className="w-3.5 h-3.5" /> Board
              </button>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {filteredTasks.length} of {stats.total} tasks
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          hasAnyTasks={stats.total > 0}
          onClearFilters={clearFilters}
          onCreate={() => openCreateForm()}
          onShowAll={() => {
            clearFilters();
            setScope("all");
          }}
          scope={scope}
        />
      ) : view === "list" ? (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filteredTasks.map((task) => (
              <TaskListRow
                key={task._id}
                task={task}
                onOpen={(t) => setDetailTaskId(t._id)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setShowForm(true);
                }}
                onDelete={(t) => setPendingDelete(t)}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const columnTasks = boardColumns[status.id] ?? [];
            return (
              <div
                key={status.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverStatus !== status.id) setDragOverStatus(status.id);
                }}
                onDragLeave={() =>
                  setDragOverStatus((current) => (current === status.id ? null : current))
                }
                onDrop={(event) => handleDrop(event, status.id)}
                className={cn(
                  "min-h-[320px] rounded-2xl bg-muted/30 p-3 transition-colors",
                  dragOverStatus === status.id && "bg-primary/10 ring-1 ring-primary/30",
                )}
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-sm font-semibold">{status.label}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
                    {columnTasks.length}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => openCreateForm(status.id)}
                    aria-label={`Add task to ${status.label}`}
                    className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onMove={handleMove}
                        onOpen={(t) => setDetailTaskId(t._id)}
                        onEdit={(t) => {
                          setEditingTask(t);
                          setShowForm(true);
                        }}
                        onDelete={(t) => setPendingDelete(t)}
                        onToggleComplete={handleToggleComplete}
                      />
                    ))}
                  </AnimatePresence>
                  {columnTasks.length === 0 && (
                    <p className="py-6 text-center text-[11px] text-muted-foreground/60">
                      Drop tasks here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <TaskFormDialog
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTask(null);
        }}
        projects={projects}
        members={members}
        editingTask={editingTask}
        defaultProjectId={defaultProjectId}
        defaultStatus={formDefaultStatus}
      />

      <TaskDetailSheet
        task={detailTask}
        open={Boolean(detailTask)}
        onClose={() => setDetailTaskId(null)}
        onEdit={(task) => {
          setDetailTaskId(null);
          setEditingTask(task);
          setShowForm(true);
        }}
        onDelete={(task) => setPendingDelete(task)}
        onStatusChange={handleMove}
        onPriorityChange={handlePriorityChange}
        onToggleComplete={handleToggleComplete}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmClearCompleted}
        onOpenChange={(open) => !open && setConfirmClearCompleted(false)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear completed tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              {completedVisible.length} completed task
              {completedVisible.length === 1 ? "" : "s"} in the current view will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearCompleted}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Clear completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Small presentational helpers ─────────────────────────────── */

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-primary text-primary-foreground"
          : "glass-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  hasAnyTasks,
  scope,
  onCreate,
  onShowAll,
  onClearFilters,
}: {
  hasAnyTasks: boolean;
  scope: Scope;
  onCreate: () => void;
  onShowAll: () => void;
  onClearFilters: () => void;
}) {
  if (!hasAnyTasks) {
    return (
      <div className="glass-card flex flex-col items-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl aie-gradient">
          <Inbox className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-lg font-semibold">No tasks yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Create your first work item to start tracking progress with AIE.
        </p>
        <Button onClick={onCreate} className="mt-5 gap-2">
          <Plus className="w-4 h-4" /> Create your first task
        </Button>
      </div>
    );
  }

  const assignedToMe = scope === "mine";

  return (
    <div className="glass-card flex flex-col items-center px-6 py-16 text-center">
      <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <h2 className="text-base font-semibold">
        {assignedToMe ? "Nothing assigned to you" : "No matching tasks found"}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {assignedToMe
          ? "Switch to “All work” to see every task, or assign something to yourself."
          : "Try a different search term or relax your filters."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {assignedToMe && (
          <Button variant="outline" onClick={onShowAll}>
            Show all tasks
          </Button>
        )}
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}
