import { cssVar } from "@/lib/theme-colors";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Columns3,
  Clock,
  GripVertical,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { priorityStyles, priorityBorderColors } from "@/lib/badge-colors";

const columns = [
  { id: "todo", label: "To Do", icon: Clock, color: cssVar("--muted-foreground"), bgColor: "bg-muted/40" },
  { id: "in-progress", label: "In Progress", icon: Loader2, color: cssVar("--chart-1"), bgColor: "bg-muted/40" },
  { id: "review", label: "Review", icon: Eye, color: cssVar("--chart-4"), bgColor: "bg-muted/30" },
  { id: "done", label: "Done", icon: CheckCircle2, color: cssVar("--chart-3"), bgColor: "bg-muted/30" },
] as const;

function TaskCard({
  task,
  onMoveRight,
  onMoveLeft,
  isFirst,
  isLast,
}: {
  task: any;
  onMoveRight: () => void;
  onMoveLeft: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: isDragging ? 1.02 : 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card p-3 border-l-[3px] cursor-grab active:cursor-grabbing"
      style={{ borderLeftColor: priorityBorderColors[task.priority] || cssVar("--muted-foreground") }}
      draggable
      onDragStart={(e: any) => {
        e.dataTransfer.setData("taskId", task._id);
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="text-[10px] capitalize" style={priorityStyles[task.priority]}>
          {task.priority}
        </Badge>
        {task.storyPoints && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {task.storyPoints} SP
          </Badge>
        )}
        {task.type === "bug" && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Bug</Badge>
        )}
        {task.labels?.map((label: string) => (
          <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{label}</Badge>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          {task.assignee && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">
                {(task.assignee as any)?.name?.charAt(0) || "?"}
              </div>
              <span className="text-[10px] text-muted-foreground">{(task.assignee as any)?.name?.split(" ")[0]}</span>
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          {!isFirst && (
            <button
              onClick={onMoveLeft}
              className="p-1 rounded hover:bg-accent/50 text-muted-foreground transition-colors"
              title="Move left"
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
            </button>
          )}
          {!isLast && (
            <button
              onClick={onMoveRight}
              className="p-1 rounded hover:bg-accent/50 text-muted-foreground transition-colors"
              title="Move right"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function SprintBoard() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const activeSprint = useQuery(
    api.sprints.getActive,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const sprintTasks = useQuery(
    api.tasks.listBySprint,
    activeSprint ? { sprintId: activeSprint._id } : "skip"
  );
  const updateStatus = useMutation(api.tasks.updateStatus);
  const moveSprint = useMutation(api.tasks.moveToSprint);

  if (!selectedProjectId && projects && projects.length > 0) {
    setSelectedProjectId(projects[0]._id);
  }

  const tasksByStatus = useMemo(() => {
    const result: Record<string, any[]> = { todo: [], "in-progress": [], review: [], done: [] };
    if (sprintTasks) {
      sprintTasks.forEach((task) => {
        const status = task.status as string;
        if (result[status]) result[status].push(task);
        else result.todo.push(task);
      });
    }
    return result;
  }, [sprintTasks]);

  const handleDrop = useCallback(
    async (taskId: string, newStatus: string) => {
      try {
        await updateStatus({ taskId: taskId as any, status: newStatus as any });
        toast.success(`Task moved to ${newStatus.replace("-", " ")}`);
      } catch {
        toast.error("Failed to move task");
      }
    },
    [updateStatus]
  );

  const handleMoveRight = useCallback(
    async (taskId: string, currentStatus: string) => {
      const statusOrder = ["todo", "in-progress", "review", "done"];
      const idx = statusOrder.indexOf(currentStatus);
      if (idx < statusOrder.length - 1) {
        await handleDrop(taskId, statusOrder[idx + 1]);
      }
    },
    [handleDrop]
  );

  const handleMoveLeft = useCallback(
    async (taskId: string, currentStatus: string) => {
      const statusOrder = ["todo", "in-progress", "review", "done"];
      const idx = statusOrder.indexOf(currentStatus);
      if (idx > 0) {
        await handleDrop(taskId, statusOrder[idx - 1]);
      }
    },
    [handleDrop]
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sprint Board</h1>
          <p className="text-sm text-muted-foreground">
            {activeSprint ? `${activeSprint.name} — ${activeSprint.goal || "No goal set"}` : "No active sprint"}
          </p>
        </div>
        {activeSprint && (
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {activeSprint.completedPoints} / {activeSprint.totalPoints} SP
            </Badge>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full aie-gradient transition-all"
                style={{
                  width: `${activeSprint.totalPoints > 0 ? (activeSprint.completedPoints / activeSprint.totalPoints) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Project selector */}
      {projects && projects.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {projects.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelectedProjectId(p._id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                selectedProjectId === p._id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass-card hover:bg-accent/50"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Kanban Board */}
      {activeSprint ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const tasks = tasksByStatus[col.id] || [];
            const Icon = col.icon;
            return (
              <div
                key={col.id}
                className={cn("rounded-2xl p-3 min-h-[400px]", col.bgColor)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("taskId");
                  if (taskId) handleDrop(taskId, col.id);
                }}
              >
                <div className="flex items-center gap-2 px-2 py-2 mb-3">
                  <Icon className="w-4 h-4" style={{ color: col.color }} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-5">
                    {tasks.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {tasks.map((task) => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onMoveRight={() => handleMoveRight(task._id, col.id)}
                        onMoveLeft={() => handleMoveLeft(task._id, col.id)}
                        isFirst={col.id === "todo"}
                        isLast={col.id === "done"}
                      />
                    ))}
                  </AnimatePresence>
                  {tasks.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground/50">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <Columns3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-2">No active sprint for this project</p>
          <p className="text-xs text-muted-foreground">Create a sprint and add tasks to see the board</p>
        </div>
      )}
    </div>
  );
}
