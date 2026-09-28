import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "./task-utils";

/** Convert a `yyyy-mm-dd` input value to a local-timezone timestamp. */
function dateInputToTimestamp(value: string): number | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day).getTime();
}

/** Convert a stored timestamp back into a `yyyy-mm-dd` value for the input. */
function timestampToDateInput(timestamp?: number | null): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type TaskFormState = {
  projectId: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  storyPoints: string;
  assigneeId: string;
  dueDate: string;
  labels: string;
};

const EMPTY_FORM: TaskFormState = {
  projectId: "",
  title: "",
  description: "",
  type: "task",
  status: "todo",
  priority: "medium",
  storyPoints: "",
  assigneeId: "unassigned",
  dueDate: "",
  labels: "",
};

export type TaskFormDialogProps = {
  open: boolean;
  onClose: () => void;
  projects: any[] | undefined;
  members: any[] | undefined;
  /** When present the dialog edits this task instead of creating a new one. */
  editingTask?: any | null;
  /** Pre-fills the project for quick-add from a filtered view. */
  defaultProjectId?: string;
  defaultStatus?: string;
};

export default function TaskFormDialog({
  open,
  onClose,
  projects,
  members,
  editingTask,
  defaultProjectId,
  defaultStatus,
}: TaskFormDialogProps) {
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);

  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Guards against re-seeding (and wiping) the form when the projects query
  // re-emits while the user is still typing.
  const seededKeyRef = useRef<string | null>(null);

  // Re-seed the form whenever the dialog opens or the target task changes.
  useEffect(() => {
    if (!open) {
      seededKeyRef.current = null;
      return;
    }

    const seedKey = editingTask?._id ?? `new:${defaultStatus ?? "todo"}`;
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;

    if (editingTask) {
      setForm({
        projectId: editingTask.projectId ?? "",
        title: editingTask.title ?? "",
        description: editingTask.description ?? "",
        type: editingTask.type ?? "task",
        status: editingTask.status ?? "todo",
        priority: editingTask.priority ?? "medium",
        storyPoints: editingTask.storyPoints ? String(editingTask.storyPoints) : "",
        assigneeId: editingTask.assigneeId ?? "unassigned",
        dueDate: timestampToDateInput(editingTask.dueDate),
        labels: (editingTask.labels ?? []).join(", "),
      });
    } else {
      const fallbackProject =
        defaultProjectId || projects?.[0]?._id || "";
      setForm({
        ...EMPTY_FORM,
        projectId: fallbackProject,
        status: defaultStatus || "todo",
      });
    }
    setTitleError(null);
  }, [open, editingTask, defaultProjectId, defaultStatus, projects]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = form.title.trim();
    if (!title) {
      setTitleError("Give the task a title before saving.");
      return;
    }
    if (!form.projectId) {
      setTitleError(null);
      toast.error("Pick a project for this task");
      return;
    }

    setTitleError(null);
    setSaving(true);

    const labels = form.labels
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
    const storyPoints = form.storyPoints ? Number(form.storyPoints) : undefined;
    const dueDate = dateInputToTimestamp(form.dueDate);
    const assigneeId =
      form.assigneeId && form.assigneeId !== "unassigned"
        ? form.assigneeId
        : undefined;

    try {
      if (editingTask) {
        await updateTask({
          taskId: editingTask._id,
          title,
          description: form.description.trim() || undefined,
          type: form.type as any,
          status: form.status as any,
          priority: form.priority as any,
          storyPoints,
          assigneeId: assigneeId as any,
          labels,
          dueDate,
        });
        toast.success("Task updated");
      } else {
        await createTask({
          projectId: form.projectId as any,
          title,
          description: form.description.trim() || undefined,
          type: form.type as any,
          status: form.status as any,
          priority: form.priority as any,
          storyPoints,
          assigneeId: assigneeId as any,
          labels,
          dueDate,
        });
        toast.success("Task created");
      }
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
      toast.error("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const noProjects = projects !== undefined && projects.length === 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="glass-card max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {editingTask
              ? "Update the work item and save your changes."
              : "Add a work item to a project backlog."}
          </DialogDescription>
        </DialogHeader>

        {noProjects ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Create a project first — tasks live inside projects.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <div>
              <label htmlFor="task-title" className="mb-1.5 block text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(event) => {
                  setForm({ ...form, title: event.target.value });
                  if (titleError) setTitleError(null);
                }}
                placeholder="e.g. Implement login authentication"
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? "task-title-error" : undefined}
                autoFocus
              />
              {titleError && (
                <p id="task-title-error" className="mt-1.5 text-xs text-destructive">
                  {titleError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="task-description" className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Optional details, acceptance criteria, links…"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Project</label>
                <Select
                  value={form.projectId}
                  onValueChange={(value) => setForm({ ...form, projectId: value })}
                  disabled={Boolean(editingTask)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project._id} value={project._id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Type</label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm({ ...form, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
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
                <label className="mb-1.5 block text-sm font-medium">Priority</label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm({ ...form, priority: value })}
                >
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="task-points" className="mb-1.5 block text-sm font-medium">
                  Story Points
                </label>
                <Input
                  id="task-points"
                  type="number"
                  min={0}
                  max={100}
                  value={form.storyPoints}
                  onChange={(event) => setForm({ ...form, storyPoints: event.target.value })}
                  placeholder="3"
                />
              </div>

              <div>
                <label htmlFor="task-due" className="mb-1.5 block text-sm font-medium">
                  Due Date
                </label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Assignee</label>
                <Select
                  value={form.assigneeId}
                  onValueChange={(value) => setForm({ ...form, assigneeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members?.map((member) => (
                      <SelectItem key={member._id} value={member._id}>
                        {member.name || member.email || "User"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="task-labels" className="mb-1.5 block text-sm font-medium">
                  Labels
                </label>
                <Input
                  id="task-labels"
                  value={form.labels}
                  onChange={(event) => setForm({ ...form, labels: event.target.value })}
                  placeholder="frontend, auth"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Comma separated</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingTask ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
