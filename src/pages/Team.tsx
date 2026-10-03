import { cssVar } from "@/lib/theme-colors";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import IntelligencePanel from "@/components/IntelligencePanel";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { staggeredEnter } from "@/lib/motion";
import { insightSeverityStyles } from "@/lib/badge-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const EMPTY_FORM = { name: "", email: "", jobTitle: "", department: "", project: "", role: "member" };

function AddMemberDialog({
  open,
  onClose,
  projects,
  defaultProject,
}: {
  open: boolean;
  onClose: () => void;
  projects: { _id: string; name: string }[];
  defaultProject: string | null;
}) {
  const addMember = useMutation(api.team.addMember);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, project: defaultProject ?? "" });
    }
  }, [open, defaultProject]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Enter the person's name");
      return;
    }
    setSaving(true);
    try {
      const result: any = await addMember({
        name: form.name,
        email: form.email || undefined,
        jobTitle: form.jobTitle || undefined,
        department: form.department || undefined,
        project: form.project || undefined,
        role: form.role || undefined,
      });
      toast.success(
        result?.alreadyExisted
          ? `${result.userName} is already on the team — profile updated`
          : `${result.userName} added to the team`
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add team member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Adds the person to the AIE workspace. Give them a project seat to
            include them in that project's board, sprint and workload.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Name</Label>
            <Input
              id="member-name"
              value={form.name}
              placeholder="Dana Reyes"
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={form.email}
                placeholder="dana@company.com"
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-title">Job title</Label>
              <Input
                id="member-title"
                value={form.jobTitle}
                placeholder="QA Lead"
                onChange={(e) => set("jobTitle", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-dept">Department</Label>
              <Input
                id="member-dept"
                value={form.department}
                placeholder="Engineering"
                onChange={(e) => set("department", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select
                value={form.project || "none"}
                onValueChange={(v) => set("project", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Workspace only</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Adding…" : "Add member"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const workload = useQuery(
    api.team.getWorkload,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [selectedProjectId, projects]);

  const roster = useMemo(() => {
    if (!workload) return [];
    return [...workload].sort(
      (a, b) =>
        Number(b.onProject) - Number(a.onProject) ||
        (a.user as any)?.name?.localeCompare((b.user as any)?.name ?? "")
    );
  }, [workload]);

  const chartData = useMemo(() => {
    if (!workload) return [];
    const avg =
      workload.reduce((s, m) => s + m.activePoints, 0) /
      Math.max(1, workload.length);
    return workload
      .filter((m) => m.activePoints > 0 || m.completedPoints > 0)
      .map((m) => ({
        name: (m.user as any)?.name?.split(" ")[0] || "Unknown",
        active: m.activePoints,
        completed: m.completedPoints,
        average: Math.round(avg),
        overloaded: m.activePoints > avg * 1.5,
      }));
  }, [workload]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Workload visibility and capacity tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add member
          </Button>
        </div>
      </div>

      <AddMemberDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projects={(projects ?? []).map((p) => ({ _id: p._id as string, name: p.name }))}
        defaultProject={
          projects?.find((p) => p._id === selectedProjectId)?.name ?? null
        }
      />

      <IntelligencePanel kind="team" />

      {projects && projects.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {projects.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelectedProjectId(p._id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium aie-interactive",
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

      {/* Workload Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold">Workload Distribution</h3>
            <p className="text-xs text-muted-foreground">Active vs completed story points per member</p>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="active" fill={cssVar("--chart-1")} radius={[4, 4, 0, 0]} name="Active SP" />
                <Bar dataKey="completed" fill={cssVar("--chart-3")} radius={[4, 4, 0, 0]} name="Completed SP" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Team Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roster.map((member, i) => {
          const user = member.user as any;
          const avg =
            roster.reduce((s, m) => s + m.activePoints, 0) /
            Math.max(1, roster.length);
          const isOverloaded = member.activePoints > avg * 1.5 && member.activePoints > 6;
          return (
            <motion.div
              key={member._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={staggeredEnter(i)}
              className="glass-card p-5"
              style={isOverloaded ? { boxShadow: `0 0 0 2px ${insightSeverityStyles.high.text}40` } : undefined}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                  style={isOverloaded ? { backgroundColor: insightSeverityStyles.high.bg, color: insightSeverityStyles.high.text } : { backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
                >
                  {user?.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.name || user?.email || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.jobTitle || member.role || "Team Member"}
                    {user?.department ? ` · ${user.department}` : ""}
                  </p>
                </div>
                {!member.onProject && (
                  <Badge variant="secondary" className="text-[10px]">
                    No project seat
                  </Badge>
                )}
                {isOverloaded && (
                  <Badge className="text-[10px]" style={{ backgroundColor: insightSeverityStyles.high.bg, color: insightSeverityStyles.high.text }}>
                    Overloaded
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold">{member.activePoints}</p>
                  <p className="text-[10px] text-muted-foreground">Active SP</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color: insightSeverityStyles.low.text }}>{member.completedPoints}</p>
                  <p className="text-[10px] text-muted-foreground">Done SP</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{member.totalTasks}</p>
                  <p className="text-[10px] text-muted-foreground">Total Tasks</p>
                </div>
              </div>
              {/* Workload bar */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Workload</span>
                  <span>{member.activePoints} / {Math.round(avg * 2)} SP</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ backgroundColor: isOverloaded ? insightSeverityStyles.high.text : "var(--primary)", width: `${Math.min(100, (member.activePoints / Math.max(1, avg * 2)) * 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {workload && !workload.length && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No team members yet</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add member
          </Button>
        </div>
      )}
    </div>
  );
}
