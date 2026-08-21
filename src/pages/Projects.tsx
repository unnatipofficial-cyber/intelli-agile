import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  FolderKanban,
  Calendar,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "on-hold": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  planning: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  medium: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

interface ProjectFormData {
  name: string;
  description: string;
  status: "active" | "completed" | "on-hold" | "planning";
  priority: "low" | "medium" | "high" | "critical";
  endDate: string;
}

function ProjectForm({
  open,
  onClose,
  initialData,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: ProjectFormData;
  projectId?: string;
}) {
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const [form, setForm] = useState<ProjectFormData>(
    initialData || { name: "", description: "", status: "active", priority: "medium", endDate: "" }
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (projectId) {
        await updateProject({ projectId: projectId as any, ...form });
        toast.success("Project updated successfully");
      } else {
        await createProject(form);
        toast.success("Project created successfully");
      }
      onClose();
    } catch (err) {
      toast.error("Failed to save project");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle>{projectId ? "Edit Project" : "Create Project"}</DialogTitle>
          <DialogDescription>
            {projectId ? "Update project details" : "Set up a new project workspace"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Project Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter project name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project description"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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
          <div>
            <label className="text-sm font-medium mb-1.5 block">End Date</label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : projectId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const projects = useQuery(api.projects.list);
  const deleteProject = useMutation(api.projects.remove);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [search, setSearch] = useState("");

  const filteredProjects = projects?.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteProject({ projectId: id as any });
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Plan, track, and manage your projects</p>
        </div>
        <Button onClick={() => { setEditingProject(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredProjects?.map((project, i) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="glass-card p-5 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${project.color || "#606060"}15`, color: project.color || "#606060" }}
                  >
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={cn("text-[10px] capitalize", statusColors[project.status])}>
                      {project.status.replace("-", " ")}
                    </Badge>
                    <DropdownMenu
                      onEdit={() => {
                        setEditingProject(project);
                        setShowForm(true);
                      }}
                      onDelete={() => handleDelete(project._id, project.name)}
                    />
                  </div>
                </div>
                <h3 className="font-semibold text-base mb-1">{project.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                  {project.description || "No description"}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{project.members?.length || 0} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{project.taskCount || 0} tasks</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] capitalize ml-auto", priorityColors[project.priority])}>
                    {project.priority}
                  </Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!filteredProjects?.length && projects && (
        <div className="text-center py-12">
          <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {search ? "No projects match your search" : "No projects yet. Create your first project to get started."}
          </p>
        </div>
      )}

      <ProjectForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingProject(null); }}
        initialData={editingProject ? {
          name: editingProject.name,
          description: editingProject.description || "",
          status: editingProject.status,
          priority: editingProject.priority,
          endDate: editingProject.endDate || "",
        } : undefined}
        projectId={editingProject?._id}
      />
    </div>
  );
}

function DropdownMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 glass-card shadow-lg py-1 animate-fade-in-up">
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 text-left"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 text-left text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
