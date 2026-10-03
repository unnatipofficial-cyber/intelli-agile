import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { staggeredEnter } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  ListTodo,
  Bug,
  ArrowUpCircle,
  GripVertical,
  Pencil,
  Trash2,
  Filter,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { priorityStyles, statusStyles } from "@/lib/badge-colors";

const typeIcons: Record<string, any> = {
  task: ListTodo,
  bug: Bug,
  subtask: ArrowUpCircle,
};

interface TaskForm {
  title: string;
  description: string;
  type: "task" | "bug" | "subtask";
  priority: "low" | "medium" | "high" | "critical";
  storyPoints: number;
  assigneeId?: string;
  labels: string[];
  dueDate?: string;
}

function TaskFormDialog({
  open,
  onClose,
  projectId,
  editingTask,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string | undefined;
  editingTask?: any;
}) {
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const teamMembers = useQuery(api.team.listMembers);
  const [form, setForm] = useState<TaskForm>(
    editingTask
      ? {
          title: editingTask.title,
          description: editingTask.description || "",
          type: editingTask.type,
          priority: editingTask.priority,
          storyPoints: editingTask.storyPoints || 0,
          assigneeId: editingTask.assigneeId,
          labels: editingTask.labels || [],
          dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split("T")[0] : undefined,
        }
      : { title: "", description: "", type: "task", priority: "medium", storyPoints: 3, labels: [] }
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !projectId) return;
    setLoading(true);
    try {
      const data = {
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        priority: form.priority,
        storyPoints: form.storyPoints || undefined,
        assigneeId: form.assigneeId ? (form.assigneeId as any) : undefined,
        labels: form.labels.length > 0 ? form.labels : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).getTime() : undefined,
      };
      if (editingTask) {
        await updateTask({ taskId: editingTask._id, ...data });
        toast.success("Task updated");
      } else {
        await createTask({ projectId: projectId as any, status: "todo", ...data });
        toast.success("Task created");
      }
      onClose();
    } catch {
      toast.error("Failed to save task");
    }
    setLoading(false);
  };

  if (!projectId) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Type</label>
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="subtask">Subtask</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Story Points</label>
              <Input type="number" min={0} max={21} value={form.storyPoints} onChange={(e) => setForm({ ...form, storyPoints: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Due Date</label>
              <Input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value || undefined })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assignee</label>
            <Select value={form.assigneeId || "unassigned"} onValueChange={(v) => setForm({ ...form, assigneeId: v === "unassigned" ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers?.map((m) => (
                  <SelectItem key={m._id} value={m._id}>{m.name || m.email || "User"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : editingTask ? "Update" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Backlog() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const backlogTasks = useQuery(
    api.tasks.listBacklog,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const allTasks = useQuery(
    api.tasks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const deleteTask = useMutation(api.tasks.remove);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [selectedProjectId, projects]);

  const backlogItems = useMemo(() => {
    if (!backlogTasks) return [];
    let items = backlogTasks;
    if (search) {
      items = items.filter(
        (t) => t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filterPriority !== "all") items = items.filter((t) => t.priority === filterPriority);
    if (filterStatus !== "all") items = items.filter((t) => t.status === filterStatus);
    if (filterType !== "all") items = items.filter((t) => t.type === filterType);
    return items;
  }, [backlogTasks, search, filterPriority, filterStatus, filterType]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await deleteTask({ taskId: id as any });
    toast.success("Task deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backlog</h1>
          <p className="text-sm text-muted-foreground">Organize and prioritize work items</p>
        </div>
        <Button onClick={() => { setEditingTask(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search backlog..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="subtask">Subtask</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{backlogItems.length} items</span>
        <span>{backlogItems.reduce((s, t) => s + (t.storyPoints || 0), 0)} total story points</span>
      </div>

      {/* Backlog items */}
      <div className="space-y-2">
        <AnimatePresence>
          {backlogItems.map((task, i) => {
            const TypeIcon = typeIcons[task.type] || ListTodo;
            return (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={staggeredEnter(i)}
                className="glass-card p-4 flex items-center gap-3 group"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0 cursor-grab" />
                <TypeIcon className={cn("w-4 h-4 shrink-0", task.type === "bug" ? "text-red-500" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.storyPoints && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{task.storyPoints} SP</Badge>
                  )}
                  <Badge className="text-[10px] capitalize" style={priorityStyles[task.priority]}>{task.priority}</Badge>
                  <Badge className="text-[10px] capitalize" style={statusStyles[task.status]}>{task.status.replace("-", " ")}</Badge>
                  {task.assignee && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                      {(task.assignee as any)?.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingTask(task); setShowForm(true); }} className="p-1 rounded hover:bg-accent/50 text-muted-foreground">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(task._id)} className="p-1 rounded hover:bg-accent/50 text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!backlogItems.length && (
        <div className="text-center py-12">
          <ListTodo className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {search || filterPriority !== "all" || filterStatus !== "all"
              ? "No items match your filters"
              : "Your backlog is empty. Add your first work item."}
          </p>
        </div>
      )}

      <TaskFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingTask(null); }}
        projectId={selectedProjectId || undefined}
        editingTask={editingTask}
      />
    </div>
  );
}
