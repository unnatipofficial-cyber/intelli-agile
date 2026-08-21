import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle2,
  Clock,
  Gauge,
  BarChart3,
} from "lucide-react";
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

export default function Team() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const workload = useQuery(
    api.team.getWorkload,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );

  if (!selectedProjectId && projects && projects.length > 0) {
    setSelectedProjectId(projects[0]._id);
  }

  const chartData = useMemo(() => {
    if (!workload) return [];
    const avg = workload.reduce((s, m) => s + m.activePoints, 0) / Math.max(1, workload.length);
    return workload.map((m) => ({
      name: (m.user as any)?.name?.split(" ")[0] || "Unknown",
      active: m.activePoints,
      completed: m.completedPoints,
      average: Math.round(avg),
      overloaded: m.activePoints > avg * 1.5,
    }));
  }, [workload]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">Workload visibility and capacity tracking</p>
        </div>
      </div>

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
                <Bar dataKey="active" fill="#606060" radius={[4, 4, 0, 0]} name="Active SP" />
                <Bar dataKey="completed" fill="#a0a0a0" radius={[4, 4, 0, 0]} name="Completed SP" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Team Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {workload?.map((member, i) => {
          const user = member.user as any;
          const isActive = member.activePoints > 0;
          const avg = workload.reduce((s, m) => s + m.activePoints, 0) / Math.max(1, workload.length);
          const isOverloaded = member.activePoints > avg * 1.5 && member.activePoints > 6;
          return (
            <motion.div
              key={member._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn("glass-card p-5", isOverloaded && "ring-2 ring-orange-400/50")}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold",
                  isOverloaded ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : "bg-primary/10 text-primary"
                )}>
                  {user?.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{user?.jobTitle || member.role || "Team Member"}</p>
                </div>
                {isOverloaded && (
                  <Badge className="text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
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
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{member.completedPoints}</p>
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
                    className={cn("h-full rounded-full transition-all", isOverloaded ? "bg-orange-400" : "bg-primary")}
                    style={{ width: `${Math.min(100, (member.activePoints / Math.max(1, avg * 2)) * 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!workload?.length && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No team members assigned yet</p>
        </div>
      )}
    </div>
  );
}
