import { cssVar } from "@/lib/theme-colors";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Target,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [cssVar("--chart-1"), cssVar("--chart-2"), cssVar("--chart-3"), cssVar("--chart-4"), cssVar("--chart-5"), cssVar("--destructive")];

export default function Analytics() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const allTasks = useQuery(
    api.tasks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const sprints = useQuery(
    api.sprints.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const risks = useQuery(
    api.risks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const velocity = useQuery(
    api.sprints.getVelocity,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const workload = useQuery(
    api.team.getWorkload,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );

  useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [selectedProjectId, projects]);

  const taskCompletion = useMemo(() => {
    if (!allTasks) return [];
    const done = allTasks.filter((t) => t.status === "done").length;
    const total = allTasks.length;
    return [
      { name: "Completed", value: done },
      { name: "Remaining", value: total - done },
    ];
  }, [allTasks]);

  const priorityDistribution = useMemo(() => {
    if (!allTasks) return [];
    const counts: Record<string, number> = {};
    allTasks.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allTasks]);

  const typeDistribution = useMemo(() => {
    if (!allTasks) return [];
    const counts: Record<string, number> = {};
    allTasks.forEach((t) => {
      counts[t.type] = (counts[t.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allTasks]);

  const sprintProgress = useMemo(() => {
    if (!sprints) return [];
    return sprints.map((s) => ({
      name: s.name,
      completed: s.completedPoints,
      total: s.totalPoints,
      remaining: s.totalPoints - s.completedPoints,
      progress: s.totalPoints > 0 ? Math.round((s.completedPoints / s.totalPoints) * 100) : 0,
    }));
  }, [sprints]);

  const riskTrend = useMemo(() => {
    if (!risks) return [];
    const open = risks.filter((r) => r.status === "open").length;
    const mitigated = risks.filter((r) => r.status === "mitigated").length;
    const closed = risks.filter((r) => r.status === "closed").length;
    return [
      { name: "Open", value: open },
      { name: "Mitigated", value: mitigated },
      { name: "Closed", value: closed },
    ];
  }, [risks]);

  const cardClass = "glass-card p-5";

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Velocities, burndowns, and workload analytics</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Velocity Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Sprint Velocity</h3>
              <p className="text-xs text-muted-foreground">Story points delivered per sprint</p>
            </div>
          </div>
          <div className="h-[250px]">
            {velocity && velocity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="sprintName" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="velocity" fill={cssVar("--chart-1")} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No velocity data yet</div>
            )}
          </div>
        </motion.div>

        {/* Task Completion */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Task Completion</h3>
              <p className="text-xs text-muted-foreground">Overall task completion rate</p>
            </div>
          </div>
          <div className="h-[250px] flex items-center">
            {taskCompletion.some((d) => d.value > 0) ? (
              <>
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={taskCompletion} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        <Cell fill={cssVar("--chart-3")} />
                        <Cell fill={cssVar("--muted")} />
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  {taskCompletion.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? "#a0a0a0" : "#d0d0d0" }} />
                      <div>
                        <p className="text-sm font-semibold">{item.value}</p>
                        <p className="text-xs text-muted-foreground">{item.name}</p>
                      </div>
                    </div>
                  ))}
                  {allTasks && (
                    <p className="text-2xl font-bold text-primary">
                      {allTasks.length > 0 ? Math.round((taskCompletion[0].value / allTasks.length) * 100) : 0}%
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full text-muted-foreground text-sm">No tasks yet</div>
            )}
          </div>
        </motion.div>

        {/* Sprint Progress */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold">Sprint Progress</h3>
              <p className="text-xs text-muted-foreground">Completed vs remaining per sprint</p>
            </div>
          </div>
          <div className="h-[250px]">
            {sprintProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sprintProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill={cssVar("--chart-3")} name="Completed" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="remaining" stackId="a" fill={cssVar("--muted")} name="Remaining" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No sprint data</div>
            )}
          </div>
        </motion.div>

        {/* Priority Distribution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={cardClass}>
          <div className="mb-4">
            <h3 className="text-sm font-bold">Priority Distribution</h3>
            <p className="text-xs text-muted-foreground">Tasks by priority level</p>
          </div>
          <div className="h-[250px] flex items-center">
            {priorityDistribution.length > 0 ? (
              <>
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={priorityDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {priorityDistribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {priorityDistribution.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{item.name}</span>
                      <span className="ml-auto font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full text-muted-foreground text-sm">No data</div>
            )}
          </div>
        </motion.div>

        {/* Team Workload */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={cardClass}>
          <div className="mb-4">
            <h3 className="text-sm font-bold">Team Workload</h3>
            <p className="text-xs text-muted-foreground">Active story points per team member</p>
          </div>
          <div className="h-[250px]">
            {workload && workload.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workload.filter((m) => m.activePoints > 0 || m.completedPoints > 0).map((m) => ({ name: (m.user as any)?.name?.split(" ")[0] || "?", active: m.activePoints, completed: m.completedPoints }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                  <Legend />
                  <Bar dataKey="active" fill={cssVar("--chart-3")} name="Active" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill={cssVar("--chart-3")} name="Completed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No team data</div>
            )}
          </div>
        </motion.div>

        {/* Risk Status */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className={cardClass}>
          <div className="mb-4">
            <h3 className="text-sm font-bold">Risk Status</h3>
            <p className="text-xs text-muted-foreground">Open, mitigated, and closed risks</p>
          </div>
          <div className="h-[250px] flex items-center">
            {riskTrend.some((d) => d.value > 0) ? (
              <>
                <div className="w-1/2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={riskTrend} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        <Cell fill={cssVar("--destructive")} />
                        <Cell fill={cssVar("--chart-4")} />
                        <Cell fill={cssVar("--chart-3")} />
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  {riskTrend.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ["#cc3333", "#808080", "#a0a0a0"][i] }} />
                      <div>
                        <p className="text-sm font-semibold">{item.value}</p>
                        <p className="text-xs text-muted-foreground">{item.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full text-muted-foreground text-sm">No risks tracked</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
